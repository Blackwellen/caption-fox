import 'server-only'
import { randomUUID } from 'node:crypto'
import { serviceClient } from './service-client'
import { adapterContextFor, ReauthorisationRequired } from './connections'
import { getAdapter } from './clients'
import { ProviderApiError } from './clients/types'
import { AD_PROVIDERS, type AdProvider } from './providers'
import { recordActivity } from './activity'

// Advertising sync engine.
//
// Idempotent by construction: every write is an upsert keyed on the provider's
// own identifiers, so a retried or duplicated run converges rather than
// duplicating records. A run is tracked in ad_sync_runs from queue to finish so
// the Accounts page can show real state instead of a spinner that never ends.
//
// Sync never runs inline in a page render. Callers are the manual "Sync now"
// action, the connect callback, and the scheduled job route.

export type SyncScope = 'full' | 'incremental' | 'metrics' | 'entities' | 'audiences' | 'creatives'

export type SyncResult = {
  runId: string
  status: 'succeeded' | 'partial' | 'failed'
  recordsWritten: number
  errors: string[]
}

/** How far back a full sync pulls metrics. Incremental pulls the last 7 days. */
const FULL_WINDOW_DAYS = 90
const INCREMENTAL_WINDOW_DAYS = 7
const CHUNK = 500

function windowFor(scope: SyncScope): { since: string; until: string } {
  const until = new Date()
  const since = new Date(until)
  since.setUTCDate(since.getUTCDate() - (scope === 'incremental' ? INCREMENTAL_WINDOW_DAYS : FULL_WINDOW_DAYS))
  return { since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) }
}

async function chunkedUpsert(table: string, rows: Record<string, unknown>[], onConflict: string): Promise<number> {
  if (rows.length === 0) return 0
  const client = serviceClient()
  let written = 0
  for (let index = 0; index < rows.length; index += CHUNK) {
    const batch = rows.slice(index, index + CHUNK)
    const { error } = await client.from(table).upsert(batch, { onConflict, ignoreDuplicates: false })
    if (error) throw new Error(`Could not write ${table}: ${error.message}`)
    written += batch.length
  }
  return written
}

export type SyncInput = {
  workspaceId: string
  connectionId: string
  provider: AdProvider
  /** Restrict the run to one account; omit to sync every account. */
  accountId?: string
  scope?: SyncScope
  triggeredBy?: string | null
  triggerSource?: 'manual' | 'schedule' | 'webhook' | 'connect'
  /** Repeated calls with the same key resolve to the same run. */
  idempotencyKey?: string
}

export async function runSync(input: SyncInput): Promise<SyncResult> {
  const client = serviceClient()
  const scope = input.scope ?? 'full'
  const idempotencyKey = input.idempotencyKey ?? randomUUID()

  // An identical key already in flight or finished returns that run untouched.
  const { data: existing } = await client
    .from('ad_sync_runs')
    .select('id, status, records_written')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (existing) {
    return {
      runId: existing.id as string,
      status: (existing.status === 'succeeded' || existing.status === 'partial' ? existing.status : 'failed'),
      recordsWritten: (existing.records_written as number) ?? 0,
      errors: [],
    }
  }

  const { data: run, error: runError } = await client.from('ad_sync_runs').insert({
    workspace_id: input.workspaceId,
    connection_id: input.connectionId,
    account_id: input.accountId ?? null,
    provider: input.provider,
    scope,
    status: 'running',
    triggered_by: input.triggeredBy ?? null,
    trigger_source: input.triggerSource ?? 'manual',
    idempotency_key: idempotencyKey,
    started_at: new Date().toISOString(),
  }).select('id').single()

  if (runError || !run) throw new Error('Could not start the sync run.')
  const runId = run.id as string

  const errors: string[] = []
  let written = 0

  try {
    await client.from('ad_connections')
      .update({ last_sync_attempt_at: new Date().toISOString() })
      .eq('id', input.connectionId)

    written = await syncConnection(input, scope, errors)

    const status: SyncResult['status'] = errors.length === 0 ? 'succeeded' : written > 0 ? 'partial' : 'failed'
    const now = new Date().toISOString()

    await client.from('ad_sync_runs').update({
      status, records_written: written, finished_at: now,
      error_message: errors.length ? errors.join(' | ').slice(0, 500) : null,
    }).eq('id', runId)

    await client.from('ad_connections').update({
      status: status === 'failed' ? 'attention' : 'connected',
      last_synced_at: status === 'failed' ? undefined : now,
      last_error: errors.length ? errors[0].slice(0, 400) : null,
      updated_at: now,
    }).eq('id', input.connectionId)

    await recordActivity({
      workspaceId: input.workspaceId,
      actorId: input.triggeredBy ?? null,
      eventType: status === 'failed' ? 'sync.failed' : 'sync.completed',
      entityType: 'connection',
      entityId: input.connectionId,
      entityLabel: AD_PROVIDERS[input.provider].name,
      provider: input.provider,
      summary: status === 'failed'
        ? `${AD_PROVIDERS[input.provider].name} sync failed`
        : `${AD_PROVIDERS[input.provider].name} synced ${written.toLocaleString('en-GB')} records`,
      sourceRoute: 'advertising/accounts',
    })

    return { runId, status, recordsWritten: written, errors }
  } catch (error) {
    const message = describeError(error, input.provider)
    const now = new Date().toISOString()

    await client.from('ad_sync_runs').update({
      status: 'failed', records_written: written, finished_at: now,
      error_code: error instanceof ProviderApiError ? String(error.status) : 'internal',
      error_message: message.slice(0, 500),
    }).eq('id', runId)

    await client.from('ad_connections').update({
      status: error instanceof ReauthorisationRequired ? 'expired' : 'attention',
      last_error: message.slice(0, 400), updated_at: now,
    }).eq('id', input.connectionId)

    await client.from('ad_issues').insert({
      workspace_id: input.workspaceId,
      connection_id: input.connectionId,
      account_id: input.accountId ?? null,
      provider: input.provider,
      severity: 'critical',
      issue_type: error instanceof ReauthorisationRequired ? 'auth_expired' : 'sync_failed',
      title: `${AD_PROVIDERS[input.provider].name} sync failed`,
      detail: message.slice(0, 400),
      required_action: error instanceof ReauthorisationRequired
        ? 'Reconnect the account to restore access.'
        : 'Retry the sync. If it keeps failing, check the platform status and your app permissions.',
    })

    return { runId, status: 'failed', recordsWritten: written, errors: [message] }
  }
}

async function syncConnection(input: SyncInput, scope: SyncScope, errors: string[]): Promise<number> {
  const client = serviceClient()
  const adapter = getAdapter(input.provider)
  const capabilities = AD_PROVIDERS[input.provider].capabilities
  let written = 0

  const ctx = await adapterContextFor({
    workspaceId: input.workspaceId,
    connectionId: input.connectionId,
    provider: input.provider,
  })

  // ---------------------------------------------------------- accounts
  if (capabilities.readAccounts && (scope === 'full' || scope === 'entities' || scope === 'incremental')) {
    const accounts = await adapter.listAccounts(ctx)
    written += await chunkedUpsert('ad_accounts', accounts.map(account => ({
      workspace_id: input.workspaceId,
      connection_id: input.connectionId,
      provider: input.provider,
      external_id: account.externalId,
      name: account.name,
      currency: account.currency,
      timezone: account.timezone,
      status: account.status,
      sync_status: 'syncing',
      last_sync_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })), 'workspace_id,provider,external_id')
  }

  // Accounts to walk: either the one requested, or every account on this
  // connection. Ids are read back so the local uuid is available for children.
  let accountQuery = client.from('ad_accounts')
    .select('id, external_id, currency, timezone')
    .eq('workspace_id', input.workspaceId)
    .eq('connection_id', input.connectionId)
  if (input.accountId) accountQuery = accountQuery.eq('id', input.accountId)
  const { data: accounts } = await accountQuery

  const window = windowFor(scope)

  for (const account of accounts ?? []) {
    const accountId = account.id as string
    const externalId = account.external_id as string
    const accountCtx = { ...ctx, extras: { ...ctx.extras, account_id: externalId, currency: account.currency as string } }

    try {
      const campaignIds = new Map<string, string>()
      const adSetIds = new Map<string, string>()

      // ------------------------------------------------------ campaigns
      if (capabilities.readCampaigns && scope !== 'audiences' && scope !== 'creatives' && scope !== 'metrics') {
        const campaigns = await adapter.listCampaigns(accountCtx, externalId)
        written += await chunkedUpsert('ad_campaigns', campaigns.map(campaign => ({
          workspace_id: input.workspaceId,
          account_id: accountId,
          provider: input.provider,
          external_id: campaign.externalId,
          name: campaign.name,
          objective: campaign.objective,
          status: campaign.status,
          buying_type: campaign.buyingType,
          budget_amount: campaign.budgetAmount,
          budget_type: campaign.budgetType,
          currency: account.currency,
          starts_at: campaign.startsAt,
          ends_at: campaign.endsAt,
          provider_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })), 'account_id,external_id')
      }

      const { data: storedCampaigns } = await client.from('ad_campaigns')
        .select('id, external_id').eq('account_id', accountId)
      for (const row of storedCampaigns ?? []) {
        if (row.external_id) campaignIds.set(row.external_id as string, row.id as string)
      }

      // -------------------------------------------------------- ad sets
      if (capabilities.readAdSets && (scope === 'full' || scope === 'entities' || scope === 'incremental')) {
        const adSets = await adapter.listAdSets(accountCtx, externalId)
        const rows = adSets
          .filter(adSet => campaignIds.has(adSet.campaignExternalId))
          .map(adSet => ({
            workspace_id: input.workspaceId,
            campaign_id: campaignIds.get(adSet.campaignExternalId)!,
            account_id: accountId,
            provider: input.provider,
            external_id: adSet.externalId,
            name: adSet.name,
            status: adSet.status,
            budget_amount: adSet.budgetAmount,
            budget_type: adSet.budgetType,
            optimisation_goal: adSet.optimisationGoal,
            starts_at: adSet.startsAt,
            ends_at: adSet.endsAt,
            updated_at: new Date().toISOString(),
          }))
        written += await chunkedUpsert('ad_sets', rows, 'campaign_id,external_id')
      }

      const { data: storedAdSets } = await client.from('ad_sets')
        .select('id, external_id').eq('account_id', accountId)
      for (const row of storedAdSets ?? []) {
        if (row.external_id) adSetIds.set(row.external_id as string, row.id as string)
      }

      // ------------------------------------------------------ creatives
      if (capabilities.readCreatives && (scope === 'full' || scope === 'creatives' || scope === 'entities' || scope === 'incremental')) {
        const creatives = await adapter.listCreatives(accountCtx, externalId)
        // ad_creatives has no natural unique key on (account, external_id), so
        // existing rows are matched explicitly before insert.
        const { data: existingCreatives } = await client.from('ad_creatives')
          .select('id, external_id').eq('account_id', accountId)
        const existingByExternal = new Map((existingCreatives ?? []).map(row => [row.external_id as string, row.id as string]))

        for (const creative of creatives) {
          const payload = {
            workspace_id: input.workspaceId,
            account_id: accountId,
            campaign_id: creative.campaignExternalId ? campaignIds.get(creative.campaignExternalId) ?? null : null,
            ad_set_id: creative.adSetExternalId ? adSetIds.get(creative.adSetExternalId) ?? null : null,
            provider: input.provider,
            external_id: creative.externalId,
            name: creative.name,
            format: creative.format,
            status: creative.status,
            review_status: creative.reviewStatus,
            review_source: 'provider',
            provider_feedback: creative.providerFeedback,
            thumbnail_path: creative.thumbnailUrl,
            aspect_ratio: creative.aspectRatio,
            duration_seconds: creative.durationSeconds,
            headline: creative.headline,
            body_text: creative.bodyText,
            destination_url: creative.destinationUrl,
            updated_at: new Date().toISOString(),
          }
          const existingId = existingByExternal.get(creative.externalId)
          if (existingId) await client.from('ad_creatives').update(payload).eq('id', existingId)
          else await client.from('ad_creatives').insert(payload)
          written += 1
        }
      }

      // ------------------------------------------------------ audiences
      if (capabilities.readAudiences && (scope === 'full' || scope === 'audiences' || scope === 'entities')) {
        const audiences = await adapter.listAudiences(accountCtx, externalId)
        const { data: existingAudiences } = await client.from('ad_audiences')
          .select('id, external_id').eq('account_id', accountId)
        const existingByExternal = new Map((existingAudiences ?? []).map(row => [row.external_id as string, row.id as string]))

        for (const audience of audiences) {
          const payload = {
            workspace_id: input.workspaceId,
            account_id: accountId,
            provider: input.provider,
            external_id: audience.externalId,
            name: audience.name,
            audience_type: audience.audienceType,
            description: audience.description,
            size_estimate: audience.sizeEstimate,
            matched_users: audience.matchedUsers,
            match_rate: audience.matchRate,
            recency_days: audience.recencyDays,
            refresh_status: audience.status === 'ready' ? 'ready' : 'review',
            status: audience.status,
            last_refreshed_at: audience.lastRefreshedAt,
            updated_at: new Date().toISOString(),
          }
          const existingId = existingByExternal.get(audience.externalId)
          if (existingId) await client.from('ad_audiences').update(payload).eq('id', existingId)
          else await client.from('ad_audiences').insert(payload)
          written += 1
        }
      }

      // -------------------------------------------------------- metrics
      if (capabilities.readReports && scope !== 'entities' && scope !== 'audiences' && scope !== 'creatives') {
        written += await syncMetrics({
          workspaceId: input.workspaceId,
          accountId, externalId, provider: input.provider,
          ctx: accountCtx, window, campaignIds, adSetIds,
        })
      }

      await client.from('ad_accounts').update({
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', accountId)
    } catch (error) {
      const message = describeError(error, input.provider)
      errors.push(`${externalId}: ${message}`)
      await client.from('ad_accounts').update({
        sync_status: error instanceof ReauthorisationRequired ? 'expired' : 'failed',
        updated_at: new Date().toISOString(),
      }).eq('id', accountId)
    }
  }

  return written
}

async function syncMetrics(input: {
  workspaceId: string
  accountId: string
  externalId: string
  provider: AdProvider
  ctx: Awaited<ReturnType<typeof adapterContextFor>>
  window: { since: string; until: string }
  campaignIds: Map<string, string>
  adSetIds: Map<string, string>
}): Promise<number> {
  const client = serviceClient()
  const adapter = getAdapter(input.provider)
  let written = 0

  // Creative-level ids are resolved lazily; most accounts have far more
  // creatives than campaigns and the map is only needed if creatives report.
  const { data: creativeRows } = await client.from('ad_creatives')
    .select('id, external_id').eq('account_id', input.accountId)
  const creativeIds = new Map((creativeRows ?? []).map(row => [row.external_id as string, row.id as string]))

  const levels: { level: 'account' | 'campaign' | 'ad_set' | 'creative'; resolve: (externalId: string) => string | null }[] = [
    { level: 'account', resolve: () => input.accountId },
    { level: 'campaign', resolve: id => input.campaignIds.get(id) ?? null },
    { level: 'ad_set', resolve: id => input.adSetIds.get(id) ?? null },
    { level: 'creative', resolve: id => creativeIds.get(id) ?? null },
  ]

  for (const { level, resolve } of levels) {
    let insights
    try {
      insights = await adapter.getInsights(input.ctx, {
        accountExternalId: input.externalId,
        level,
        since: input.window.since,
        until: input.window.until,
        attributionWindow: '7d_click',
      })
    } catch (error) {
      // A level the provider will not report is skipped rather than failing the
      // whole account: account-level totals are still useful without ad-level.
      if (error instanceof ProviderApiError && (error.status === 400 || error.status === 404)) continue
      throw error
    }

    const rows = insights
      .map(insight => {
        const entityId = resolve(insight.entityExternalId)
        if (!entityId) return null
        return {
          workspace_id: input.workspaceId,
          account_id: input.accountId,
          entity_type: level,
          entity_id: entityId,
          provider: input.provider,
          metric_date: insight.date,
          currency: insight.currency,
          attribution_window: insight.attributionWindow,
          spend: insight.spend,
          impressions: insight.impressions,
          reach: insight.reach,
          clicks: insight.clicks,
          conversions: insight.conversions,
          revenue: insight.revenue,
          video_views: insight.videoViews,
          video_3s_views: insight.video3sViews,
          engagements: insight.engagements,
          is_estimated: insight.isEstimated,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)

    written += await chunkedUpsert('ad_metrics_daily', rows, 'entity_type,entity_id,metric_date,attribution_window')
  }

  return written
}

function describeError(error: unknown, provider: AdProvider): string {
  if (error instanceof ReauthorisationRequired) return error.message
  if (error instanceof ProviderApiError) return error.message
  if (error instanceof Error) return error.message
  return `An unexpected error occurred while syncing ${AD_PROVIDERS[provider].name}.`
}
