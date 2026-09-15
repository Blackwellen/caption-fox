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

const CAMPAIGN_OBJECTIVES = ['awareness', 'traffic', 'engagement', 'leads', 'app_installs', 'video_views', 'sales', 'conversions'] as const

/**
 * Creates a campaign as a Caption Fox DRAFT on a connected account. It is never
 * marked live: publishing to the platform is a separate, provider-confirmed
 * step. A same-name draft on the same account created within the last minute
 * is returned instead of duplicated, so a double-submit cannot create two.
 */
export async function createDraftCampaignAction(input: {
  workspaceId: string
  workspaceType: string
  accountId: string
  name: string
  objective: string
  budgetAmount: number
  budgetType: 'daily' | 'lifetime'
  startsAt: string
  endsAt: string | null
}): Promise<{ ok: true; id: string; message: string } | { ok: false; error: string; field?: string }> {
  const { supabase, user, workspace } = await requireSession()
  if (workspace.id !== input.workspaceId) return { ok: false, error: 'Workspace mismatch.' }
  const role = await assertMembership(supabase, workspace.id, user.id)
  if (!role) return { ok: false, error: 'You are not a member of this workspace.' }

  const { data: connections } = await supabase
    .from('ad_connections').select('provider').eq('workspace_id', workspace.id).in('status', ['connected', 'attention'])
  const ctx = await entitlementContextFor(workspace.id, input.workspaceType, role)
  ctx.connectedProviders = [...new Set((connections ?? []).map(row => row.provider as string))]
  const gate = canAccessAdvertisingCapability(ctx, 'campaigns.create')
  if (!gate.allowed) return { ok: false, error: gate.message }

  const name = input.name.trim()
  if (name.length < 3 || name.length > 120) return { ok: false, error: 'Name must be between 3 and 120 characters.', field: 'name' }
  if (!(CAMPAIGN_OBJECTIVES as readonly string[]).includes(input.objective)) return { ok: false, error: 'Choose a campaign objective.', field: 'objective' }
  if (!Number.isFinite(input.budgetAmount) || input.budgetAmount <= 0 || input.budgetAmount > 10_000_000) {
    return { ok: false, error: 'Enter a budget between £0.01 and £10,000,000.', field: 'budgetAmount' }
  }
  if (!['daily', 'lifetime'].includes(input.budgetType)) return { ok: false, error: 'Choose a budget type.', field: 'budgetType' }
  const starts = new Date(input.startsAt)
  const ends = input.endsAt ? new Date(input.endsAt) : null
  if (Number.isNaN(starts.getTime())) return { ok: false, error: 'Enter a valid start date.', field: 'startsAt' }
  if (ends && (Number.isNaN(ends.getTime()) || ends < starts)) return { ok: false, error: 'The end date must be on or after the start date.', field: 'endsAt' }

  const { data: account } = await supabase
    .from('ad_accounts').select('id, provider, currency, name').eq('id', input.accountId).eq('workspace_id', workspace.id).maybeSingle()
  if (!account) return { ok: false, error: 'Choose one of this workspace’s ad accounts.', field: 'accountId' }

  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
  const { data: recent } = await supabase
    .from('ad_campaigns').select('id').eq('workspace_id', workspace.id).eq('account_id', account.id)
    .eq('name', name).eq('status', 'draft').gte('created_at', oneMinuteAgo).maybeSingle()
  if (recent) return { ok: true, id: recent.id as string, message: 'Draft already created.' }

  const { data: created, error } = await supabase.from('ad_campaigns').insert({
    workspace_id: workspace.id, account_id: account.id, provider: account.provider,
    name, objective: input.objective, status: 'draft',
    budget_amount: Math.round(input.budgetAmount * 100) / 100, budget_type: input.budgetType,
    currency: account.currency, starts_at: starts.toISOString(), ends_at: ends?.toISOString() ?? null,
    owner_user_id: user.id,
  }).select('id').single()
  if (error || !created) return { ok: false, error: 'Could not create the draft campaign.' }

  await recordActivity({
    workspaceId: workspace.id, actorId: user.id, eventType: 'campaign.created',
    entityType: 'campaign', entityId: created.id as string, entityLabel: name, provider: account.provider as string,
    summary: `Draft campaign "${name}" created on ${account.name}`,
    after: { status: 'draft', budget: input.budgetAmount, objective: input.objective },
    sourceRoute: 'advertising/campaigns',
  })
  revalidatePath(`/${input.workspaceType}/advertising/campaigns`)
  revalidatePath(`/${input.workspaceType}/advertising`)
  return { ok: true, id: created.id as string, message: 'Draft campaign created.' }
}

// --------------------------------------------------------------- creatives

const CREATIVE_MIME_TYPES: Record<string, 'image' | 'video'> = {
  'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image', 'image/gif': 'image',
  'video/mp4': 'video', 'video/quicktime': 'video', 'video/webm': 'video',
}
const MAX_CREATIVE_BYTES = 200 * 1024 * 1024

/**
 * Step 1 of a creative upload: checks the member may upload, then returns
 * where to put the file. With R2 configured that is a 10-minute signed PUT URL
 * under `advertising/{workspaceId}/`; otherwise the private Supabase bucket path.
 */
export async function createCreativeUploadAction(input: {
  workspaceId: string
  workspaceType: string
  fileName: string
  mimeType: string
  sizeBytes: number
}): Promise<
  | { ok: true; provider: 'r2'; url: string; storedPath: string }
  | { ok: true; provider: 'supabase' }
  | { ok: false; error: string }
> {
  const { supabase, user, workspace } = await requireSession()
  if (workspace.id !== input.workspaceId) return { ok: false, error: 'Workspace mismatch.' }
  const role = await assertMembership(supabase, workspace.id, user.id)
  if (!role) return { ok: false, error: 'You are not a member of this workspace.' }
  const { data: connections } = await supabase
    .from('ad_connections').select('provider').eq('workspace_id', workspace.id).in('status', ['connected', 'attention'])
  const ctx = await entitlementContextFor(workspace.id, input.workspaceType, role)
  ctx.connectedProviders = [...new Set((connections ?? []).map(row => row.provider as string))]
  const gate = canAccessAdvertisingCapability(ctx, 'creatives.upload')
  if (!gate.allowed) return { ok: false, error: gate.message }
  if (!CREATIVE_MIME_TYPES[input.mimeType]) return { ok: false, error: 'Upload a JPG, PNG, WebP, GIF, MP4, MOV or WebM file.' }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > MAX_CREATIVE_BYTES) return { ok: false, error: 'Files must be 200 MB or smaller.' }

  const { isR2Configured, createUploadUrl } = await import('@/lib/storage/r2')
  if (!isR2Configured()) return { ok: true, provider: 'supabase' }
  const upload = await createUploadUrl({ area: 'advertising', workspaceId: workspace.id, fileName: input.fileName, contentType: input.mimeType })
  return { ok: true, provider: 'r2', url: upload.url, storedPath: upload.storedPath }
}

/** Removes an R2 object this workspace uploaded but never registered (e.g. a cancelled upload). */
export async function discardCreativeUploadAction(input: { workspaceId: string; storedPath: string }): Promise<ActionResult> {
  const { supabase, user, workspace } = await requireSession()
  if (workspace.id !== input.workspaceId) return { ok: false, error: 'Workspace mismatch.' }
  if (!(await assertMembership(supabase, workspace.id, user.id))) return { ok: false, error: 'Not a member.' }
  if (!input.storedPath.startsWith(`r2:advertising/${workspace.id}/`) || input.storedPath.includes('..')) return { ok: false, error: 'Invalid path.' }
  const { data: used } = await supabase.from('ad_creatives').select('id').eq('workspace_id', workspace.id).eq('asset_path', input.storedPath).maybeSingle()
  if (used) return { ok: false, error: 'This file belongs to a saved creative.' }
  const { deleteObject } = await import('@/lib/storage/r2')
  await deleteObject(input.storedPath)
  return { ok: true }
}

/**
 * Registers a creative the browser has just uploaded — to R2 (path `r2:…`) or
 * to the private `ad-creatives` Supabase bucket. The file itself was written under the member's own
 * workspace folder (enforced by storage policy); this re-checks the path, type,
 * size, account and campaign server-side before creating the draft record.
 */
export async function registerUploadedCreativeAction(input: {
  workspaceId: string
  workspaceType: string
  accountId: string
  campaignId: string | null
  name: string
  storagePath: string
  mimeType: string
  sizeBytes: number
  width: number | null
  height: number | null
  durationSeconds: number | null
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { supabase, user, workspace } = await requireSession()
  if (workspace.id !== input.workspaceId) return { ok: false, error: 'Workspace mismatch.' }
  const role = await assertMembership(supabase, workspace.id, user.id)
  if (!role) return { ok: false, error: 'You are not a member of this workspace.' }

  const { data: connections } = await supabase
    .from('ad_connections').select('provider').eq('workspace_id', workspace.id).in('status', ['connected', 'attention'])
  const ctx = await entitlementContextFor(workspace.id, input.workspaceType, role)
  ctx.connectedProviders = [...new Set((connections ?? []).map(row => row.provider as string))]
  const gate = canAccessAdvertisingCapability(ctx, 'creatives.upload')
  if (!gate.allowed) return { ok: false, error: gate.message }

  const kind = CREATIVE_MIME_TYPES[input.mimeType]
  if (!kind) return { ok: false, error: 'Upload a JPG, PNG, WebP, GIF, MP4, MOV or WebM file.' }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > MAX_CREATIVE_BYTES) {
    return { ok: false, error: 'Files must be 200 MB or smaller.' }
  }
  const onR2 = input.storagePath.startsWith('r2:')
  const allowedPrefix = onR2 ? `r2:advertising/${workspace.id}/` : `${workspace.id}/`
  if (!input.storagePath.startsWith(allowedPrefix) || input.storagePath.includes('..')) {
    return { ok: false, error: 'Invalid upload location.' }
  }
  if (onR2) {
    // Never trust the browser's claims: read the object's real size and type.
    const { inspectObject, deleteObject } = await import('@/lib/storage/r2')
    const object = await inspectObject(input.storagePath)
    if (!object) return { ok: false, error: 'The upload did not complete. Try again.' }
    if (object.size > MAX_CREATIVE_BYTES || object.size <= 0 || (object.contentType && object.contentType !== input.mimeType)) {
      await deleteObject(input.storagePath)
      return { ok: false, error: 'The uploaded file did not match its declared type or size.' }
    }
  }
  const name = input.name.trim()
  if (name.length < 1 || name.length > 120) return { ok: false, error: 'Name the creative (up to 120 characters).' }

  const { data: account } = await supabase
    .from('ad_accounts').select('id, provider').eq('id', input.accountId).eq('workspace_id', workspace.id).maybeSingle()
  if (!account) return { ok: false, error: 'Choose one of this workspace’s ad accounts.' }
  if (input.campaignId) {
    const { data: campaign } = await supabase
      .from('ad_campaigns').select('id').eq('id', input.campaignId).eq('workspace_id', workspace.id).eq('account_id', account.id).maybeSingle()
    if (!campaign) return { ok: false, error: 'That campaign is not on the chosen account.' }
  }

  const ratio = (() => {
    if (!input.width || !input.height) return null
    const value = input.width / input.height
    const known: [string, number][] = [['1:1', 1], ['4:5', 0.8], ['9:16', 0.5625], ['16:9', 1.7778], ['1.91:1', 1.91]]
    const closest = known.reduce((best, entry) => Math.abs(entry[1] - value) < Math.abs(best[1] - value) ? entry : best)
    return Math.abs(closest[1] - value) < 0.05 ? closest[0] : `${input.width}×${input.height}`
  })()

  const { data: created, error } = await supabase.from('ad_creatives').insert({
    workspace_id: workspace.id, account_id: account.id, campaign_id: input.campaignId, provider: account.provider,
    name, format: kind === 'video' ? 'video' : 'image', status: 'draft',
    review_status: 'not_submitted', review_source: 'internal',
    asset_path: input.storagePath, thumbnail_path: kind === 'image' ? input.storagePath : null,
    mime_type: input.mimeType, file_size_bytes: input.sizeBytes, aspect_ratio: ratio,
    duration_seconds: input.durationSeconds, created_by: user.id,
  }).select('id').single()
  if (error || !created) return { ok: false, error: 'Could not save the creative.' }

  await recordActivity({
    workspaceId: workspace.id, actorId: user.id, eventType: 'creative.uploaded',
    entityType: 'creative', entityId: created.id as string, entityLabel: name, provider: account.provider as string,
    summary: `Creative "${name}" uploaded`, sourceRoute: 'advertising/creatives',
  })
  revalidatePath(`/${input.workspaceType}/advertising/creatives`)
  return { ok: true, id: created.id as string }
}

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

const AUDIENCE_TYPES = ['custom', 'lookalike', 'website_visitors', 'engagers', 'crm_list', 'interest', 'video_viewers', 'customer_list', 'app_users'] as const

/**
 * Creates an audience definition as a draft ("review") on a connected account.
 * Nothing is sent to the platform here; the platform builds the actual
 * audience when it is published, so size and match rate start empty.
 */
export async function createDraftAudienceAction(input: {
  workspaceId: string
  workspaceType: string
  accountId: string
  name: string
  audienceType: string
  description: string
  recencyDays: number | null
  refreshSchedule: 'manual' | 'daily' | 'weekly' | 'monthly'
  excludedAudienceId: string | null
}): Promise<{ ok: true; id: string } | { ok: false; error: string; field?: string }> {
  const { supabase, user, workspace } = await requireSession()
  if (workspace.id !== input.workspaceId) return { ok: false, error: 'Workspace mismatch.' }
  const role = await assertMembership(supabase, workspace.id, user.id)
  if (!role) return { ok: false, error: 'You are not a member of this workspace.' }
  const { data: connections } = await supabase
    .from('ad_connections').select('provider').eq('workspace_id', workspace.id).in('status', ['connected', 'attention'])
  const ctx = await entitlementContextFor(workspace.id, input.workspaceType, role)
  ctx.connectedProviders = [...new Set((connections ?? []).map(row => row.provider as string))]
  const gate = canAccessAdvertisingCapability(ctx, 'audiences.create')
  if (!gate.allowed) return { ok: false, error: gate.message }

  const name = input.name.trim()
  if (name.length < 2 || name.length > 120) return { ok: false, error: 'Name must be 2–120 characters.', field: 'name' }
  if (!(AUDIENCE_TYPES as readonly string[]).includes(input.audienceType)) return { ok: false, error: 'Choose an audience type.', field: 'audienceType' }
  if (input.recencyDays !== null && (!Number.isInteger(input.recencyDays) || input.recencyDays < 1 || input.recencyDays > 540)) {
    return { ok: false, error: 'Recency must be between 1 and 540 days.', field: 'recencyDays' }
  }
  if (!['manual', 'daily', 'weekly', 'monthly'].includes(input.refreshSchedule)) return { ok: false, error: 'Choose a refresh schedule.', field: 'refreshSchedule' }

  const { data: account } = await supabase.from('ad_accounts').select('id, provider').eq('id', input.accountId).eq('workspace_id', workspace.id).maybeSingle()
  if (!account) return { ok: false, error: 'Choose one of this workspace’s ad accounts.', field: 'accountId' }
  if (input.excludedAudienceId) {
    const { data: excluded } = await supabase.from('ad_audiences').select('id').eq('id', input.excludedAudienceId).eq('workspace_id', workspace.id).maybeSingle()
    if (!excluded) return { ok: false, error: 'The exclusion audience was not found.', field: 'excludedAudienceId' }
  }

  const { data: created, error } = await supabase.from('ad_audiences').insert({
    workspace_id: workspace.id, account_id: account.id, provider: account.provider, name,
    audience_type: input.audienceType, description: input.description.trim().slice(0, 500) || null,
    recency_days: input.recencyDays, refresh_schedule: input.refreshSchedule,
    refresh_status: 'pending', status: 'review', excluded_audience_id: input.excludedAudienceId, created_by: user.id,
  }).select('id').single()
  if (error || !created) return { ok: false, error: 'Could not create the audience.' }

  await recordActivity({
    workspaceId: workspace.id, actorId: user.id, eventType: 'audience.created',
    entityType: 'audience', entityId: created.id as string, entityLabel: name, provider: account.provider as string,
    summary: `Draft audience "${name}" created`, sourceRoute: 'advertising/audiences',
  })
  revalidatePath(`/${input.workspaceType}/advertising/audiences`)
  return { ok: true, id: created.id as string }
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

async function presetGate(workspaceId: string, workspaceType: string) {
  const { supabase, user, workspace } = await requireSession()
  if (workspace.id !== workspaceId) return { error: 'Workspace mismatch.' } as const
  const role = await assertMembership(supabase, workspace.id, user.id)
  if (!role) return { error: 'You are not a member of this workspace.' } as const
  const ctx = await entitlementContextFor(workspace.id, workspaceType, role)
  const gate = canAccessAdvertisingCapability(ctx, 'reports.manage_presets')
  if (!gate.allowed) return { error: gate.message } as const
  return { supabase, user, workspace } as const
}

export async function deletePresetAction(input: { workspaceId: string; workspaceType: string; presetId: string }): Promise<ActionResult> {
  const session = await presetGate(input.workspaceId, input.workspaceType)
  if ('error' in session) return { ok: false, error: session.error as string }
  const { data: preset } = await session.supabase.from('ad_report_presets').select('name').eq('id', input.presetId).eq('workspace_id', session.workspace.id).maybeSingle()
  if (!preset) return { ok: false, error: 'Preset not found.' }
  await session.supabase.from('ad_report_presets').delete().eq('id', input.presetId).eq('workspace_id', session.workspace.id)
  await recordActivity({ workspaceId: session.workspace.id, actorId: session.user.id, eventType: 'preset.deleted', summary: `Report preset "${preset.name}" deleted`, sourceRoute: 'advertising/reports' })
  revalidatePath(`/${input.workspaceType}/advertising/reports`)
  return { ok: true }
}

export async function setDefaultPresetAction(input: { workspaceId: string; workspaceType: string; presetId: string }): Promise<ActionResult> {
  const session = await presetGate(input.workspaceId, input.workspaceType)
  if ('error' in session) return { ok: false, error: session.error as string }
  const { data: preset } = await session.supabase.from('ad_report_presets').select('name').eq('id', input.presetId).eq('workspace_id', session.workspace.id).maybeSingle()
  if (!preset) return { ok: false, error: 'Preset not found.' }
  await session.supabase.from('ad_report_presets').update({ is_default: false }).eq('workspace_id', session.workspace.id)
  await session.supabase.from('ad_report_presets').update({ is_default: true, updated_at: new Date().toISOString() }).eq('id', input.presetId)
  revalidatePath(`/${input.workspaceType}/advertising/reports`)
  return { ok: true, message: `"${preset.name}" is now the default report.` }
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
