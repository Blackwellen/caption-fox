import 'server-only'
import { providerFetch, paginate, money, count, isoDate, dayString } from './http'
import type { Adapter, AdapterContext, InsightRequest, RemoteCampaign, RemoteInsight } from './types'

// X Ads API v12.
// Docs: https://developer.x.com/en/docs/x-ads-api
// Cursor pagination via next_cursor; money in micro-currency.

type Paged<T> = { data?: T[]; next_cursor?: string | null }

const micro = (value: unknown): number | null => {
  const raw = money(value)
  return raw === null ? null : raw / 1_000_000
}

function listAll<T>(ctx: AdapterContext, path: string) {
  return paginate<Paged<T>, T>(
    cursor => providerFetch<Paged<T>>(ctx, { path, query: { count: 200, cursor: cursor ?? undefined } }),
    page => ({ items: page.data ?? [], next: page.next_cursor ?? null }),
  )
}

const OBJECTIVE: Record<string, RemoteCampaign['objective']> = {
  AWARENESS: 'awareness', REACH: 'awareness', WEBSITE_CLICKS: 'traffic',
  WEBSITE_CONVERSIONS: 'conversions', ENGAGEMENTS: 'engagement',
  VIDEO_VIEWS: 'video_views', PREROLL_VIEWS: 'video_views',
  APP_INSTALLS: 'app_installs', APP_ENGAGEMENTS: 'app_installs', FOLLOWERS: 'engagement',
}

export const xAdapter: Adapter = {
  provider: 'x',

  async listAccounts(ctx) {
    type Row = { id: string; name: string; timezone?: string; deleted?: boolean; approval_status?: string }
    const rows = await listAll<Row>(ctx, '/accounts')
    return rows.filter(row => !row.deleted).map(row => ({
      externalId: row.id,
      name: row.name ?? row.id,
      // X reports account currency per funding instrument, not on the account.
      currency: ctx.extras.currency ?? 'USD',
      timezone: row.timezone ?? 'UTC',
      status: row.approval_status === 'ACCEPTED' ? 'active' as const : 'paused' as const,
    }))
  },

  async listCampaigns(ctx, accountExternalId) {
    type Row = {
      id: string; name: string; entity_status: string; servable?: boolean
      daily_budget_amount_local_micro?: number; total_budget_amount_local_micro?: number
      start_time?: string; end_time?: string; deleted?: boolean
    }
    const rows = await listAll<Row>(ctx, `/accounts/${accountExternalId}/campaigns`)
    return rows.filter(row => !row.deleted).map(row => ({
      externalId: row.id,
      accountExternalId,
      name: row.name,
      // X carries the objective on the line item, not the campaign.
      objective: 'conversions' as const,
      status: row.entity_status === 'ACTIVE' ? (row.servable ? 'active' : 'learning')
        : row.entity_status === 'PAUSED' ? 'paused' : 'draft',
      budgetAmount: micro(row.daily_budget_amount_local_micro ?? row.total_budget_amount_local_micro),
      budgetType: row.daily_budget_amount_local_micro ? 'daily' as const
        : row.total_budget_amount_local_micro ? 'lifetime' as const : null,
      buyingType: null,
      startsAt: isoDate(row.start_time),
      endsAt: isoDate(row.end_time),
    }))
  },

  async listAdSets(ctx, accountExternalId) {
    type Row = {
      id: string; campaign_id: string; name: string; entity_status: string
      bid_amount_local_micro?: number; objective?: string; goal?: string
      start_time?: string; end_time?: string; deleted?: boolean
    }
    const rows = await listAll<Row>(ctx, `/accounts/${accountExternalId}/line_items`)
    return rows.filter(row => !row.deleted).map(row => ({
      externalId: row.id,
      campaignExternalId: row.campaign_id,
      name: row.name ?? `Line item ${row.id}`,
      status: row.entity_status === 'ACTIVE' ? 'active' as const
        : row.entity_status === 'PAUSED' ? 'paused' as const : 'draft' as const,
      budgetAmount: micro(row.bid_amount_local_micro),
      budgetType: null,
      optimisationGoal: row.goal ?? row.objective ?? null,
      startsAt: isoDate(row.start_time),
      endsAt: isoDate(row.end_time),
    }))
  },

  /**
   * X promotes existing posts rather than exposing standalone creative assets,
   * and the capability matrix marks readCreatives false for this reason. The
   * method stays defined so the adapter contract is uniform.
   */
  async listCreatives() {
    return []
  },

  async listAudiences(ctx, accountExternalId) {
    type Row = {
      id: string; name: string; list_type?: string; audience_size?: number
      targetable?: boolean; updated_at?: string; permission_level?: string
    }
    const rows = await listAll<Row>(ctx, `/accounts/${accountExternalId}/custom_audiences`)
    return rows.map(row => ({
      externalId: row.id,
      name: row.name,
      audienceType: row.list_type === 'EMAIL' || row.list_type === 'PHONE_NUMBER'
        ? 'crm_list' as const : 'custom' as const,
      description: null,
      sizeEstimate: row.audience_size ?? null,
      matchedUsers: row.audience_size ?? null,
      matchRate: null,
      recencyDays: null,
      status: row.targetable ? 'ready' as const : 'review' as const,
      lastRefreshedAt: isoDate(row.updated_at),
    }))
  },

  async getInsights(ctx, request: InsightRequest) {
    const entity = { account: 'ACCOUNT', campaign: 'CAMPAIGN', ad_set: 'LINE_ITEM', creative: 'PROMOTED_TWEET', audience: 'CAMPAIGN' }[request.level]

    // The stats endpoint requires explicit entity ids, so the ids are collected
    // first and requested in the documented batch size of 20.
    const ids = request.level === 'account'
      ? [request.accountExternalId]
      : (await listAll<{ id: string }>(ctx, `/accounts/${request.accountExternalId}/${entity === 'CAMPAIGN' ? 'campaigns' : 'line_items'}`)).map(row => row.id)

    type Metrics = Record<string, (number | null)[] | undefined>
    type Row = { id: string; id_data?: { metrics?: Metrics }[] }

    const results: RemoteInsight[] = []
    const start = new Date(`${request.since}T00:00:00Z`)

    for (let index = 0; index < ids.length; index += 20) {
      const batch = ids.slice(index, index + 20)
      if (batch.length === 0) break
      const response = await providerFetch<{ data?: Row[] }>(ctx, {
        path: `/stats/accounts/${request.accountExternalId}`,
        query: {
          entity, entity_ids: batch.join(','), granularity: 'DAY',
          start_time: `${request.since}T00:00:00Z`,
          end_time: `${request.until}T00:00:00Z`,
          metric_groups: 'ENGAGEMENT,BILLING,VIDEO,WEB_CONVERSION',
          placement: 'ALL_ON_TWITTER',
        },
      })

      for (const row of response.data ?? []) {
        const metrics = row.id_data?.[0]?.metrics ?? {}
        const days = metrics.impressions?.length ?? 0
        for (let day = 0; day < days; day += 1) {
          const at = new Date(start)
          at.setUTCDate(at.getUTCDate() + day)
          results.push({
            entityType: request.level,
            entityExternalId: row.id,
            date: dayString(at.toISOString()),
            currency: ctx.extras.currency ?? 'USD',
            attributionWindow: request.attributionWindow,
            spend: micro(metrics.billed_charge_local_micro?.[day]) ?? 0,
            impressions: count(metrics.impressions?.[day]),
            reach: 0,
            clicks: count(metrics.clicks?.[day]),
            conversions: count(metrics.conversion_purchases?.[day]),
            revenue: micro(metrics.conversion_purchases_sale_amount?.[day]) ?? 0,
            videoViews: count(metrics.video_total_views?.[day]),
            video3sViews: count(metrics.video_3s100pct_views?.[day]),
            engagements: count(metrics.engagements?.[day]),
            isEstimated: false,
          })
        }
      }
    }
    return results
  },

  async setCampaignStatus(ctx, campaignExternalId, status) {
    const accountId = ctx.extras.account_id
    if (!accountId) throw new Error('X campaign updates need the owning ads account id.')
    await providerFetch(ctx, {
      method: 'PUT',
      path: `/accounts/${accountId}/campaigns/${campaignExternalId}`,
      query: { entity_status: status === 'active' ? 'ACTIVE' : 'PAUSED' },
    })
  },
}

const OBJECTIVE_UNUSED = OBJECTIVE
export const __xInternals = { OBJECTIVE_UNUSED }
