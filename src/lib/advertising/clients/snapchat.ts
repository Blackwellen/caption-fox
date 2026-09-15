import 'server-only'
import { providerFetch, paginate, money, count, isoDate, dayString } from './http'
import type { Adapter, AdapterContext, InsightRequest, RemoteCampaign, RemoteCreative, RemoteAudience } from './types'

// Snapchat Marketing API v1.
// Docs: https://developers.snap.com/api/marketing-api/Ads-API/introduction
//
// Every collection comes back as a wrapper array of single-key objects, e.g.
// { campaigns: [{ sub_request_status, campaign: {...} }] }. unwrapList flattens
// that shape. Money is in micro-currency.

type Wrapper<K extends string, T> = { [P in K]?: Array<Record<string, unknown>> } & {
  paging?: { next_link?: string | null }
}

const micro = (value: unknown): number | null => {
  const raw = money(value)
  return raw === null ? null : raw / 1_000_000
}

function unwrapList<T>(payload: Record<string, unknown> | undefined, collection: string, item: string): T[] {
  const rows = payload?.[collection]
  if (!Array.isArray(rows)) return []
  return rows.map(row => (row as Record<string, unknown>)[item] as T).filter(Boolean)
}

function listAll<T>(ctx: AdapterContext, path: string, collection: string, item: string): Promise<T[]> {
  return paginate<Wrapper<string, T>, T>(
    cursor => providerFetch<Wrapper<string, T>>(ctx, {
      path: cursor ?? path, query: cursor ? {} : { limit: 500 },
    }),
    page => {
      const next = page.paging?.next_link ?? null
      return { items: unwrapList<T>(page as Record<string, unknown>, collection, item), next }
    },
  )
}

const OBJECTIVE: Record<string, RemoteCampaign['objective']> = {
  BRAND_AWARENESS: 'awareness', AWARENESS: 'awareness', WEB_VIEW: 'traffic',
  TRAFFIC: 'traffic', ENGAGEMENT: 'engagement', VIDEO_VIEW: 'video_views',
  APP_INSTALL: 'app_installs', LEAD_GENERATION: 'leads',
  WEB_CONVERSION: 'conversions', CATALOG_SALES: 'sales',
}

const STATUS: Record<string, RemoteCampaign['status']> = {
  ACTIVE: 'active', PAUSED: 'paused', ARCHIVED: 'archived', COMPLETED: 'completed',
}

const REVIEW: Record<string, RemoteCreative['reviewStatus']> = {
  APPROVED: 'approved', PENDING: 'under_review', REJECTED: 'disapproved',
}

const AUDIENCE_TYPE: Record<string, RemoteAudience['audienceType']> = {
  CUSTOMER_LIST: 'crm_list', PIXEL: 'website_visitors', MOBILE_APP: 'app_users',
  ENGAGEMENT: 'engagers', LOOKALIKE: 'lookalike', SAM: 'lookalike',
}

export const snapchatAdapter: Adapter = {
  provider: 'snapchat',

  async listAccounts(ctx) {
    type Org = { id: string; name: string }
    type Row = { id: string; name: string; currency: string; timezone: string; status: string }

    const orgs = await providerFetch<Record<string, unknown>>(ctx, { path: '/me/organizations' })
    const organisations = unwrapList<Org>(orgs, 'organizations', 'organization')

    const accounts: RemoteAccount[] = []
    for (const organisation of organisations) {
      const rows = await listAll<Row>(ctx, `/organizations/${organisation.id}/adaccounts`, 'adaccounts', 'adaccount')
      for (const row of rows) {
        accounts.push({
          externalId: row.id,
          name: row.name ?? row.id,
          currency: row.currency ?? 'USD',
          timezone: row.timezone ?? 'UTC',
          status: row.status === 'ACTIVE' ? 'active' : 'paused',
        })
      }
    }
    return accounts
  },

  async listCampaigns(ctx, accountExternalId) {
    type Row = {
      id: string; name: string; status: string; objective?: string
      daily_budget_micro?: number; lifetime_spend_cap_micro?: number
      start_time?: string; end_time?: string
    }
    const rows = await listAll<Row>(ctx, `/adaccounts/${accountExternalId}/campaigns`, 'campaigns', 'campaign')
    return rows.map(row => ({
      externalId: row.id,
      accountExternalId,
      name: row.name,
      objective: OBJECTIVE[row.objective ?? ''] ?? 'conversions',
      status: STATUS[row.status] ?? 'draft',
      budgetAmount: micro(row.daily_budget_micro ?? row.lifetime_spend_cap_micro),
      budgetType: row.daily_budget_micro ? 'daily' : row.lifetime_spend_cap_micro ? 'lifetime' : null,
      buyingType: null,
      startsAt: isoDate(row.start_time),
      endsAt: isoDate(row.end_time),
    }))
  },

  async listAdSets(ctx, accountExternalId) {
    type Row = {
      id: string; campaign_id: string; name: string; status: string
      daily_budget_micro?: number; lifetime_budget_micro?: number
      optimization_goal?: string; start_time?: string; end_time?: string
    }
    const rows = await listAll<Row>(ctx, `/adaccounts/${accountExternalId}/adsquads`, 'adsquads', 'adsquad')
    return rows.map(row => ({
      externalId: row.id,
      campaignExternalId: row.campaign_id,
      name: row.name,
      status: STATUS[row.status] ?? 'draft',
      budgetAmount: micro(row.daily_budget_micro ?? row.lifetime_budget_micro),
      budgetType: row.daily_budget_micro ? 'daily' : row.lifetime_budget_micro ? 'lifetime' : null,
      optimisationGoal: row.optimization_goal ?? null,
      startsAt: isoDate(row.start_time),
      endsAt: isoDate(row.end_time),
    }))
  },

  async listCreatives(ctx, accountExternalId) {
    type Row = {
      id: string; ad_squad_id?: string; name: string; status: string
      review_status?: string; review_status_reasons?: string[]
      type?: string; creative?: { headline?: string; brand_name?: string; web_view_properties?: { url?: string } }
    }
    const rows = await listAll<Row>(ctx, `/adaccounts/${accountExternalId}/ads`, 'ads', 'ad')
    return rows.map(row => ({
      externalId: row.id,
      campaignExternalId: null,
      adSetExternalId: row.ad_squad_id ?? null,
      name: row.name,
      // Snapchat inventory is video-first; SNAP_AD is a full-screen video unit.
      format: row.type === 'STORY' ? 'story' : row.type === 'COLLECTION' ? 'carousel' : 'video',
      status: STATUS[row.status] === 'active' ? 'active' : STATUS[row.status] === 'paused' ? 'paused' : 'draft',
      reviewStatus: REVIEW[row.review_status ?? ''] ?? 'under_review',
      providerFeedback: row.review_status_reasons?.join(', ') ?? null,
      thumbnailUrl: null,
      aspectRatio: '9:16',
      durationSeconds: null,
      headline: row.creative?.headline ?? null,
      bodyText: null,
      destinationUrl: row.creative?.web_view_properties?.url ?? null,
    }))
  },

  async listAudiences(ctx, accountExternalId) {
    type Row = {
      id: string; name: string; source_type?: string; description?: string
      approximate_number_users?: number; status?: string
      retention_in_days?: number; updated_at?: string
    }
    const rows = await listAll<Row>(ctx, `/adaccounts/${accountExternalId}/segments`, 'segments', 'segment')
    return rows.map(row => ({
      externalId: row.id,
      name: row.name,
      audienceType: AUDIENCE_TYPE[row.source_type ?? ''] ?? 'custom',
      description: row.description ?? null,
      sizeEstimate: row.approximate_number_users ?? null,
      matchedUsers: row.approximate_number_users ?? null,
      matchRate: null,
      recencyDays: row.retention_in_days ?? null,
      status: row.status === 'ACTIVE' ? 'ready' : 'review',
      lastRefreshedAt: isoDate(row.updated_at),
    }))
  },

  async getInsights(ctx, request: InsightRequest) {
    const scope = {
      account: `/adaccounts/${request.accountExternalId}/stats`,
      campaign: `/adaccounts/${request.accountExternalId}/stats`,
      ad_set: `/adaccounts/${request.accountExternalId}/stats`,
      creative: `/adaccounts/${request.accountExternalId}/stats`,
      audience: `/adaccounts/${request.accountExternalId}/stats`,
    }[request.level]

    const breakdown = {
      account: undefined, campaign: 'campaign', ad_set: 'adsquad',
      creative: 'ad', audience: 'campaign',
    }[request.level]

    type Stat = {
      id?: string; type?: string
      timeseries?: Array<{ start_time?: string; stats?: Record<string, number> }>
      stats?: Record<string, number>
      start_time?: string
    }
    const response = await providerFetch<Record<string, unknown>>(ctx, {
      path: scope,
      query: {
        granularity: 'DAY',
        start_time: `${request.since}T00:00:00.000-00:00`,
        end_time: `${request.until}T00:00:00.000-00:00`,
        breakdown,
        fields: 'spend,impressions,swipes,conversion_purchases,conversion_purchases_value,' +
          'video_views,video_views_time_based,total_impressions',
      },
    })

    const buckets = unwrapList<Stat>(response, 'timeseries_stats', 'timeseries_stat')
    const rows: RemoteInsight[] = []
    for (const bucket of buckets) {
      for (const point of bucket.timeseries ?? []) {
        const stats = point.stats ?? {}
        rows.push({
          entityType: request.level,
          entityExternalId: bucket.id ?? request.accountExternalId,
          date: dayString(point.start_time),
          currency: ctx.extras.currency ?? 'USD',
          attributionWindow: request.attributionWindow,
          spend: micro(stats.spend) ?? 0,
          impressions: count(stats.impressions),
          reach: 0,
          clicks: count(stats.swipes),
          conversions: count(stats.conversion_purchases),
          revenue: micro(stats.conversion_purchases_value) ?? 0,
          videoViews: count(stats.video_views),
          video3sViews: count(stats.video_views_time_based),
          engagements: 0,
          isEstimated: false,
        })
      }
    }
    return rows
  },

  async setCampaignStatus(ctx, campaignExternalId, status) {
    await providerFetch(ctx, {
      method: 'PUT',
      path: `/adaccounts/${ctx.extras.account_id ?? ''}/campaigns`,
      body: { campaigns: [{ id: campaignExternalId, status: status === 'active' ? 'ACTIVE' : 'PAUSED' }] },
    })
  },
}

type RemoteAccount = Awaited<ReturnType<Adapter['listAccounts']>>[number]
type RemoteInsight = Awaited<ReturnType<Adapter['getInsights']>>[number]
