'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import { getDefaultPermissions } from '@/lib/permissions'
import { canAccessAdvertisingCapability, type AdvertisingContext } from './entitlements'
import { AD_PROVIDERS, isAdProvider, type AdProvider } from './providers'
import {
  buildAuthorizeUrl, createPkce, createState, redirectUriFor, OAUTH_CONFIG,
} from './oauth'
import {
  consumeOAuthState, deleteProviderApp, loadProviderApp, saveOAuthState,
  saveProviderApp, storeConnectionTokens, ReauthorisationRequired,
} from './connections'
import { serviceClient, assertMembership } from './service-client'
import { runSync } from './sync'
import { recordActivity, raiseIssue } from './activity'
import { exchangeCode } from './oauth'

// Server actions for the Advertising module. Every action re-derives the
// workspace, role and entitlement server-side — nothing trusts a client-passed
// permission flag. Mutations are workspace-scoped through RLS by construction:
// they read/write through the request-scoped client except where the
// service-role client is explicitly needed for the secret tables, and every
// service-role write is preceded by assertMembership.

async function requireSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { active } = await getActiveWorkspace(supabase, user.id)
  if (!active) throw new Error('No active workspace.')
  return { supabase, user, workspace: active }
}

async function entitlementContextFor(workspaceId: string, workspaceType: string, role: string) {
  const supabase = await createClient()
  const { data: workspaceRow } = await supabase
    .from('workspaces').select('plan, plan_status, settings').eq('id', workspaceId).maybeSingle()
  const settings = (workspaceRow?.settings ?? {}) as Record<string, unknown>
  const ctx: AdvertisingContext = {
    workspaceType,
    plan: (workspaceRow?.plan as string | null) ?? 'free',
    planStatus: (workspaceRow?.plan_status as string | null) ?? 'active',
    role,
    permissions: getDefaultPermissions(role) as string[],
    flags: (settings.feature_flags ?? {}) as Record<string, boolean>,
  }
  return ctx
}

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

// ------------------------------------------------------------------ setup

export async function saveProviderAppAction(input: {
  workspaceId: string
  workspaceType: string
  provider: string
  clientId: string
  clientSecret: string
  extras: Record<string, string>
}): Promise<ActionResult> {
  const { supabase, user, workspace } = await requireSession()
  if (workspace.id !== input.workspaceId) return { ok: false, error: 'Workspace mismatch.' }
  if (!isAdProvider(input.provider)) return { ok: false, error: 'Unknown advertising platform.' }

  const role = await assertMembership(supabase, workspace.id, user.id)
  if (!role) return { ok: false, error: 'You are not a member of this workspace.' }

  const ctx = await entitlementContextFor(workspace.id, input.workspaceType, role)
  const gate = canAccessAdvertisingCapability(ctx, 'accounts.connect')
  if (!gate.allowed) return { ok: false, error: gate.message }

  if (!input.clientId.trim() || !input.clientSecret.trim()) {
    return { ok: false, error: 'Client ID and client secret are both required.' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3004'
  try {
    await saveProviderApp({
      workspaceId: workspace.id,
      provider: input.provider,
      clientId: input.clientId,
      clientSecret: input.clientSecret,
      extras: input.extras,
      redirectUri: redirectUriFor(input.provider, appUrl),
      configuredBy: user.id,
    })
    await recordActivity({
      workspaceId: workspace.id, actorId: user.id,
      eventType: 'provider_app.configured', provider: input.provider,
      summary: `${AD_PROVIDERS[input.provider].name} developer app connected`,
      sourceRoute: 'advertising/accounts',
    })
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save the app credentials.' }
  }

  revalidatePath(`/${input.workspaceType}/advertising/accounts`)
  return { ok: true, message: `${AD_PROVIDERS[input.provider].name} app saved. You can now connect an account.` }
}

export async function removeProviderAppAction(input: { workspaceId: string; workspaceType: string; provider: string }): Promise<ActionResult> {
  const { supabase, user, workspace } = await requireSession()
  if (workspace.id !== input.workspaceId || !isAdProvider(input.provider)) return { ok: false, error: 'Invalid request.' }
  const role = await assertMembership(supabase, workspace.id, user.id)
  if (!role) return { ok: false, error: 'You are not a member of this workspace.' }
  const ctx = await entitlementContextFor(workspace.id, input.workspaceType, role)
  const gate = canAccessAdvertisingCapability(ctx, 'accounts.disconnect')
  if (!gate.allowed) return { ok: false, error: gate.message }

  await deleteProviderApp(workspace.id, input.provider)
  await recordActivity({
    workspaceId: workspace.id, actorId: user.id,
    eventType: 'provider_app.removed', provider: input.provider,
    summary: `${AD_PROVIDERS[input.provider].name} developer app removed`,
    sourceRoute: 'advertising/accounts',
  })
  revalidatePath(`/${input.workspaceType}/advertising/accounts`)
  return { ok: true }
}

// ------------------------------------------------------------------- oauth

/** Builds the authorize URL and stashes PKCE/state server-side, then redirects. */
export async function startConnectAction(input: { workspaceId: string; workspaceType: string; provider: string }): Promise<void> {
  const { supabase, user, workspace } = await requireSession()
  if (workspace.id !== input.workspaceId || !isAdProvider(input.provider)) redirect(`/${input.workspaceType}/advertising/accounts`)

  const role = await assertMembership(supabase, workspace.id, user.id)
  if (!role) redirect(`/${input.workspaceType}/advertising/accounts`)

  const ctx = await entitlementContextFor(workspace.id, input.workspaceType, role)
  const gate = canAccessAdvertisingCapability(ctx, 'accounts.connect')
  if (!gate.allowed) redirect(`/${input.workspaceType}/advertising/accounts?error=${encodeURIComponent(gate.message)}`)

  const app = await loadProviderApp(workspace.id, input.provider)
  if (!app) {
    redirect(`/${input.workspaceType}/advertising/accounts?error=${encodeURIComponent('Add your developer app credentials for this platform first.')}`)
  }

  const provider = input.provider as AdProvider
  const state = createState()
  const pkce = OAUTH_CONFIG[provider].pkce ? createPkce() : null

  await saveOAuthState({
    state, workspaceId: workspace.id, provider, userId: user.id,
    codeVerifier: pkce?.verifier ?? null,
    redirectAfter: `/${input.workspaceType}/advertising/accounts`,
  })

  const authorizeUrl = buildAuthorizeUrl({
    provider, clientId: app.clientId, redirectUri: app.redirectUri, state,
    codeChallenge: pkce?.challenge, extras: app.extras,
  })
  redirect(authorizeUrl)
}

/**
 * Completes the OAuth exchange. Called from the callback route handler rather
 * than directly from a form, but kept here so the credential logic lives in one
 * place with the rest of the connection lifecycle.
 */
export async function completeConnectAction(input: { state: string; code: string }): Promise<
  { ok: true; redirectTo: string } | { ok: false; redirectTo: string; error: string }
> {
  const consumed = await consumeOAuthState(input.state)
  if (!consumed) {
    return { ok: false, redirectTo: '/', error: 'This authorisation link has expired or was already used.' }
  }

  const fallback = consumed.redirectAfter || '/'
  const app = await loadProviderApp(consumed.workspaceId, consumed.provider)
  if (!app) {
    return { ok: false, redirectTo: fallback, error: 'The developer app credentials could not be found. Reconnect after re-entering them.' }
  }

  try {
    const tokens = await exchangeCode({
      provider: consumed.provider, clientId: app.clientId, clientSecret: app.clientSecret,
      code: input.code, redirectUri: app.redirectUri, codeVerifier: consumed.codeVerifier, extras: app.extras,
    })

    const client = serviceClient()
    const { data: connection, error } = await client.from('ad_connections').upsert({
      workspace_id: consumed.workspaceId,
      provider: consumed.provider,
      status: 'connected',
      scopes: tokens.scopes,
      owner_user_id: consumed.userId,
      connected_by: consumed.userId,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,provider,external_business_id' }).select('id').single()

    if (error || !connection) throw new Error('Could not save the connection.')

    await storeConnectionTokens(connection.id as string, consumed.workspaceId, tokens)
    await recordActivity({
      workspaceId: consumed.workspaceId, actorId: consumed.userId,
      eventType: 'connection.created', entityType: 'connection', entityId: connection.id as string,
      entityLabel: AD_PROVIDERS[consumed.provider].name, provider: consumed.provider,
      summary: `${AD_PROVIDERS[consumed.provider].name} account connected`,
      sourceRoute: 'advertising/accounts',
    })

    // Kick off the first sync in the background; the page shows "Syncing".
    void runSync({
      workspaceId: consumed.workspaceId, connectionId: connection.id as string,
      provider: consumed.provider, scope: 'full', triggeredBy: consumed.userId, triggerSource: 'connect',
    })

    return { ok: true, redirectTo: fallback }
  } catch (error) {
    await raiseIssue({
      workspaceId: consumed.workspaceId, provider: consumed.provider,
      severity: 'critical', issueType: 'auth_expired',
      title: `${AD_PROVIDERS[consumed.provider].name} connection failed`,
      detail: error instanceof Error ? error.message : 'Unknown error during token exchange.',
      requiredAction: 'Check the developer app credentials and try connecting again.',
    })
    return {
      ok: false, redirectTo: fallback,
      error: error instanceof Error ? error.message : 'Could not complete the connection.',
    }
  }
}

// -------------------------------------------------------------------- sync

export async function syncNowAction(input: { workspaceId: string; workspaceType: string; connectionId: string; accountId?: string }): Promise<ActionResult> {
  const { supabase, user, workspace } = await requireSession()
  if (workspace.id !== input.workspaceId) return { ok: false, error: 'Workspace mismatch.' }
  const role = await assertMembership(supabase, workspace.id, user.id)
  if (!role) return { ok: false, error: 'You are not a member of this workspace.' }
  const ctx = await entitlementContextFor(workspace.id, input.workspaceType, role)
  const gate = canAccessAdvertisingCapability(ctx, 'accounts.sync')
  if (!gate.allowed) return { ok: false, error: gate.message }

  const { data: connection } = await supabase
    .from('ad_connections').select('provider').eq('id', input.connectionId).eq('workspace_id', workspace.id).maybeSingle()
  if (!connection) return { ok: false, error: 'Connection not found.' }

  const result = await runSync({
    workspaceId: workspace.id, connectionId: input.connectionId,
    provider: connection.provider as AdProvider, accountId: input.accountId,
    scope: 'incremental', triggeredBy: user.id, triggerSource: 'manual',
  })

  revalidatePath(`/${input.workspaceType}/advertising/accounts`)
  revalidatePath(`/${input.workspaceType}/advertising`)

  if (result.status === 'failed') return { ok: false, error: result.errors[0] ?? 'Sync failed.' }
  return { ok: true, message: `Synced ${result.recordsWritten.toLocaleString('en-GB')} records.` }
}

export async function disconnectAccountAction(input: { workspaceId: string; workspaceType: string; connectionId: string }): Promise<ActionResult> {
  const { supabase, user, workspace } = await requireSession()
  if (workspace.id !== input.workspaceId) return { ok: false, error: 'Workspace mismatch.' }
  const role = await assertMembership(supabase, workspace.id, user.id)
  if (!role) return { ok: false, error: 'You are not a member of this workspace.' }
  const ctx = await entitlementContextFor(workspace.id, input.workspaceType, role)
  const gate = canAccessAdvertisingCapability(ctx, 'accounts.disconnect')
  if (!gate.allowed) return { ok: false, error: gate.message }

  const { data: connection } = await supabase
    .from('ad_connections').select('provider').eq('id', input.connectionId).eq('workspace_id', workspace.id).maybeSingle()

  await supabase.from('ad_connections').update({
    status: 'disconnected', updated_at: new Date().toISOString(),
  }).eq('id', input.connectionId).eq('workspace_id', workspace.id)

  if (connection) {
    await recordActivity({
      workspaceId: workspace.id, actorId: user.id,
      eventType: 'connection.disconnected', entityType: 'connection', entityId: input.connectionId,
      provider: connection.provider as string,
      summary: `${AD_PROVIDERS[connection.provider as AdProvider]?.name ?? connection.provider} account disconnected`,
      sourceRoute: 'advertising/accounts',
    })
  }

  revalidatePath(`/${input.workspaceType}/advertising/accounts`)
  return { ok: true }
}

// --------------------------------------------------------------- campaigns

export async function pauseResumeCampaignAction(input: {
  workspaceId: string
  workspaceType: string
  campaignId: string
  status: 'active' | 'paused'
}): Promise<ActionResult> {
  const { supabase, user, workspace } = await requireSession()
  if (workspace.id !== input.workspaceId) return { ok: false, error: 'Workspace mismatch.' }
  const role = await assertMembership(supabase, workspace.id, user.id)
  if (!role) return { ok: false, error: 'You are not a member of this workspace.' }
  const ctx = await entitlementContextFor(workspace.id, input.workspaceType, role)
  const capability = input.status === 'paused' ? 'campaigns.pause' : 'campaigns.pause'
  const gate = canAccessAdvertisingCapability(ctx, capability)
  if (!gate.allowed) return { ok: false, error: gate.message }

  const { data: campaign } = await supabase
    .from('ad_campaigns')
    .select('id, external_id, status, name, provider, account_id, ad_accounts(connection_id)')
    .eq('id', input.campaignId).eq('workspace_id', workspace.id).maybeSingle()
  if (!campaign) return { ok: false, error: 'Campaign not found.' }
  if (!campaign.external_id) return { ok: false, error: 'This campaign has no provider reference to update.' }

  const account = campaign.ad_accounts as unknown as { connection_id: string | null } | null
  if (!account?.connection_id) return { ok: false, error: 'This account is not connected to a live provider session.' }

  try {
    const { getAdapter } = await import('./clients')
    const { adapterContextFor } = await import('./connections')
    const adapter = getAdapter(campaign.provider as AdProvider)
    if (!adapter.setCampaignStatus) return { ok: false, error: 'This platform does not support pausing campaigns through the API.' }

    const adapterCtx = await adapterContextFor({
      workspaceId: workspace.id, connectionId: account.connection_id,
      provider: campaign.provider as AdProvider,
      accountExtras: { account_id: campaign.account_id as string },
    })
    await adapter.setCampaignStatus(adapterCtx, campaign.external_id, input.status)
  } catch (error) {
    if (error instanceof ReauthorisationRequired) return { ok: false, error: error.message }
    return { ok: false, error: error instanceof Error ? error.message : 'Could not update the campaign on the platform.' }
  }

  const before = { status: campaign.status }
  await supabase.from('ad_campaigns').update({ status: input.status, updated_at: new Date().toISOString() }).eq('id', input.campaignId)
  await recordActivity({
    workspaceId: workspace.id, actorId: user.id,
    eventType: input.status === 'active' ? 'campaign.resumed' : 'campaign.paused',
    entityType: 'campaign', entityId: input.campaignId, entityLabel: campaign.name as string,
    provider: campaign.provider as string,
    summary: `${campaign.name} ${input.status === 'active' ? 'resumed' : 'paused'}`,
    before, after: { status: input.status },
    sourceRoute: 'advertising/campaigns',
  })

  revalidatePath(`/${input.workspaceType}/advertising/campaigns`)
  return { ok: true, message: `Campaign ${input.status === 'active' ? 'resumed' : 'paused'}.` }
}

// --------------------------------------------------------------- creatives

export async function reviewCreativeAction(input: {
  workspaceId: string
  workspaceType: string
  creativeId: string
  decision: 'approved' | 'changes_requested'
  feedback?: string
}): Promise<ActionResult> {
  const { supabase, user, workspace } = await requireSession()
  if (workspace.id !== input.workspaceId) return { ok: false, error: 'Workspace mismatch.' }
  const role = await assertMembership(supabase, workspace.id, user.id)
  if (!role) return { ok: false, error: 'You are not a member of this workspace.' }
  const ctx = await entitlementContextFor(workspace.id, input.workspaceType, role)
  const gate = canAccessAdvertisingCapability(ctx, 'creatives.review')
  if (!gate.allowed) return { ok: false, error: gate.message }

  const { data: creative } = await supabase
    .from('ad_creatives').select('name').eq('id', input.creativeId).eq('workspace_id', workspace.id).maybeSingle()
  if (!creative) return { ok: false, error: 'Creative not found.' }

  await supabase.from('ad_creatives').update({
    review_status: input.decision,
    review_source: 'internal',
    internal_feedback: input.feedback ?? null,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', input.creativeId)

  await recordActivity({
    workspaceId: workspace.id, actorId: user.id,
    eventType: input.decision === 'approved' ? 'creative.approved' : 'creative.changes_requested',
    entityType: 'creative', entityId: input.creativeId, entityLabel: creative.name as string,
    summary: `${creative.name} ${input.decision === 'approved' ? 'approved internally' : 'sent back for changes'}`,
    sourceRoute: 'advertising/creatives',
  })

  revalidatePath(`/${input.workspaceType}/advertising/creatives`)
  return { ok: true }
}

// --------------------------------------------------------------- audiences

export async function refreshAudienceAction(input: { workspaceId: string; workspaceType: string; audienceId: string }): Promise<ActionResult> {
  const { supabase, user, workspace } = await requireSession()
  if (workspace.id !== input.workspaceId) return { ok: false, error: 'Workspace mismatch.' }
  const role = await assertMembership(supabase, workspace.id, user.id)
  if (!role) return { ok: false, error: 'You are not a member of this workspace.' }
  const ctx = await entitlementContextFor(workspace.id, input.workspaceType, role)
  const gate = canAccessAdvertisingCapability(ctx, 'audiences.sync')
  if (!gate.allowed) return { ok: false, error: gate.message }

  const { data: audience } = await supabase
    .from('ad_audiences')
    .select('name, account_id, provider, ad_accounts(connection_id)')
    .eq('id', input.audienceId).eq('workspace_id', workspace.id).maybeSingle()
  if (!audience) return { ok: false, error: 'Audience not found.' }
  const account = audience.ad_accounts as unknown as { connection_id: string | null } | null
  if (!account?.connection_id) return { ok: false, error: 'This audience has no connected account to refresh from.' }

  const result = await runSync({
    workspaceId: workspace.id, connectionId: account.connection_id,
    provider: audience.provider as AdProvider, accountId: audience.account_id as string,
    scope: 'audiences', triggeredBy: user.id, triggerSource: 'manual',
  })

  revalidatePath(`/${input.workspaceType}/advertising/audiences`)
  if (result.status === 'failed') return { ok: false, error: result.errors[0] ?? 'Audience refresh failed.' }
  return { ok: true, message: 'Audience refresh requested.' }
}

// ----------------------------------------------------------------- issues

export async function resolveIssueAction(input: { workspaceId: string; workspaceType: string; issueId: string }): Promise<ActionResult> {
  const { supabase, user, workspace } = await requireSession()
  if (workspace.id !== input.workspaceId) return { ok: false, error: 'Workspace mismatch.' }
  const role = await assertMembership(supabase, workspace.id, user.id)
  if (!role) return { ok: false, error: 'You are not a member of this workspace.' }

  await supabase.from('ad_issues').update({
    resolved_at: new Date().toISOString(), resolved_by: user.id,
  }).eq('id', input.issueId).eq('workspace_id', workspace.id)

  await recordActivity({
    workspaceId: workspace.id, actorId: user.id, eventType: 'issue.resolved',
    entityType: 'issue', entityId: input.issueId, summary: 'Issue marked resolved',
    sourceRoute: 'advertising/accounts',
  })

  revalidatePath(`/${input.workspaceType}/advertising`)
  revalidatePath(`/${input.workspaceType}/advertising/accounts`)
  return { ok: true }
}

// ----------------------------------------------------------------- reports

export async function savePresetAction(input: {
  workspaceId: string
  workspaceType: string
  name: string
  config: Record<string, unknown>
  isShared: boolean
}): Promise<ActionResult> {
  const { supabase, user, workspace } = await requireSession()
  if (workspace.id !== input.workspaceId) return { ok: false, error: 'Workspace mismatch.' }
  const role = await assertMembership(supabase, workspace.id, user.id)
  if (!role) return { ok: false, error: 'You are not a member of this workspace.' }
  const ctx = await entitlementContextFor(workspace.id, input.workspaceType, role)
  const gate = canAccessAdvertisingCapability(ctx, 'reports.manage_presets')
  if (!gate.allowed) return { ok: false, error: gate.message }

  if (!input.name.trim()) return { ok: false, error: 'Name the preset before saving.' }

  const { error } = await supabase.from('ad_report_presets').upsert({
    workspace_id: workspace.id, name: input.name.trim(), config: input.config,
    is_shared: input.isShared, created_by: user.id, updated_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id,name' })
  if (error) return { ok: false, error: 'Could not save the preset.' }

  await recordActivity({
    workspaceId: workspace.id, actorId: user.id, eventType: 'preset.saved',
    summary: `Report preset "${input.name.trim()}" saved`, sourceRoute: 'advertising/reports',
  })
  revalidatePath(`/${input.workspaceType}/advertising/reports`)
  return { ok: true, message: 'Preset saved.' }
}

export async function requestExportAction(input: {
  workspaceId: string
  workspaceType: string
  name: string
  format: 'csv' | 'xlsx' | 'pdf'
  filters: Record<string, unknown>
}): Promise<ActionResult> {
  const { supabase, user, workspace } = await requireSession()
  if (workspace.id !== input.workspaceId) return { ok: false, error: 'Workspace mismatch.' }
  const role = await assertMembership(supabase, workspace.id, user.id)
  if (!role) return { ok: false, error: 'You are not a member of this workspace.' }
  const ctx = await entitlementContextFor(workspace.id, input.workspaceType, role)
  const gate = canAccessAdvertisingCapability(ctx, 'reports.export')
  if (!gate.allowed) return { ok: false, error: gate.message }

  const { error } = await supabase.from('ad_report_exports').insert({
    workspace_id: workspace.id, name: input.name, format: input.format,
    status: 'pending', filters: input.filters, requested_by: user.id,
  })
  if (error) return { ok: false, error: 'Could not queue the export.' }

  await recordActivity({
    workspaceId: workspace.id, actorId: user.id, eventType: 'report.exported',
    summary: `Export "${input.name}" requested (${input.format.toUpperCase()})`,
    sourceRoute: 'advertising/reports',
  })
  revalidatePath(`/${input.workspaceType}/advertising/reports`)
  return { ok: true, message: 'Export queued. It will appear in Recent Exports shortly.' }
}

export async function scheduleReportAction(input: {
  workspaceId: string
  workspaceType: string
  name: string
  cadence: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  recipients: string[]
  format: 'pdf' | 'csv' | 'xlsx'
  presetId?: string | null
}): Promise<ActionResult> {
  const { supabase, user, workspace } = await requireSession()
  if (workspace.id !== input.workspaceId) return { ok: false, error: 'Workspace mismatch.' }
  const role = await assertMembership(supabase, workspace.id, user.id)
  if (!role) return { ok: false, error: 'You are not a member of this workspace.' }
  const ctx = await entitlementContextFor(workspace.id, input.workspaceType, role)
  const gate = canAccessAdvertisingCapability(ctx, 'reports.schedule')
  if (!gate.allowed) return { ok: false, error: gate.message }

  if (input.recipients.length === 0) return { ok: false, error: 'Add at least one recipient.' }

  const { error } = await supabase.from('ad_scheduled_reports').insert({
    workspace_id: workspace.id, preset_id: input.presetId ?? null, name: input.name,
    cadence: input.cadence, recipients: input.recipients, format: input.format,
    created_by: user.id,
  })
  if (error) return { ok: false, error: 'Could not create the schedule.' }

  await recordActivity({
    workspaceId: workspace.id, actorId: user.id, eventType: 'report.scheduled',
    summary: `Scheduled report "${input.name}" created (${input.cadence})`,
    sourceRoute: 'advertising/reports',
  })
  revalidatePath(`/${input.workspaceType}/advertising/reports`)
  return { ok: true, message: 'Scheduled report created.' }
}
