import 'server-only'
import { providerFetch, money, count, isoDate, dayString } from './http'
import { ProviderApiError, type Adapter, type AdapterContext, type InsightRequest, type RemoteCampaign, type RemoteCreative, type RemoteAudience } from './types'

// TikTok Business API v1.3.
// Docs: https://business-api.tiktok.com/portal/docs
//
// TikTok authenticates with an Access-Token header and returns every payload
// wrapped in { code, message, data }. A non-zero code is a failure even on a
// 200 response, so every call goes through unwrap().

type Envelope<T> = { code?: number; message?: string; data?: T }
type Listing<T> = { list?: T[]; page_info?: { total_page?: number; page?: number } }

const auth = (token: string) => ({ 'Access-Token': token })

function unwrap<T>(ctx: AdapterContext, envelope: Envelope<T>): T {
  if (envelope.code !== undefined && envelope.code !== 0) {
    throw new ProviderApiError(
      envelope.message || 'TikTok rejected the request.',
      ctx.provider, 400, envelope.code === 40100, 'tiktok',
    )
  }
  return (envelope.data ?? {}) as T
}

/** TikTok paginates with page/page_size and reports total_page. */
async function listAll<T>(ctx: AdapterContext, path: string, query: Record<string, string | number>): Promise<T[]> {
  const items: T[] = []
  let page = 1
  for (let guard = 0; guard < 50; guard += 1) {
    const data = unwrap<Listing<T>>(ctx, await providerFetch<Envelope<Listing<T>>>(ctx, {
      path, authHeader: auth, query: { ...query, page, page_size: 100 },
    }))
    items.push(...(data.list ?? []))
    const total = data.page_info?.total_page ?? 1
    if (page >= total) break
    page += 1
  }
  return items
}

const OBJECTIVE: Record<string, RemoteCampaign['objective']> = {
  REACH: 'awareness', TRAFFIC: 'traffic', VIDEO_VIEWS: 'video_views',
  LEAD_GENERATION: 'leads', APP_PROMOTION: 'app_installs', WEB_CONVERSIONS: 'conversions',
  PRODUCT_SALES: 'sales', ENGAGEMENT: 'engagement', RF_REACH: 'awareness',
}

const STATUS: Record<string, RemoteCampaign['status']> = {
  ENABLE: 'active', DISABLE: 'paused', CAMPAIGN_STATUS_ENABLE: 'active',
  CAMPAIGN_STATUS_DISABLE: 'paused', CAMPAIGN_STATUS_DELETE: 'archived',
  CAMPAIGN_STATUS_ADVERTISER_AUDIT_DENY: 'paused', CAMPAIGN_STATUS_ALL: 'active',
  ADGROUP_STATUS_DELIVERY_OK: 'active', ADGROUP_STATUS_DISABLE: 'paused',
}

const REVIEW: Record<string, RemoteCreative['reviewStatus']> = {
  AD_STATUS_DELIVERY_OK: 'approved', AD_STATUS_AUDIT: 'under_review',
  AD_STATUS_REAUDIT: 'under_review', AD_STATUS_DISABLE: 'changes_requested',
  AD_STATUS_AUDIT_DENY: 'disapproved', AD_STATUS_DELETE: 'not_submitted',
}

const AUDIENCE_TYPE: Record<string, RemoteAudience['audienceType']> = {
  CUSTOMER_FILE: 'crm_list', ENGAGEMENT: 'engagers', LOOKALIKE: 'lookalike',
  APP_ACTIVITY: 'app_users', PIXEL: 'website_visitors', BUSINESS_ACCOUNT: 'engagers',
}

function advertiserIds(ctx: AdapterContext): string[] {
  const raw = ctx.extras.advertiser_ids
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch { /* fall through to comma-separated */ }
  return raw.split(',').map(value => value.trim()).filter(Boolean)
}

export const tiktokAdapter: Adapter = {
  provider: 'tiktok',

  async listAccounts(ctx) {
    const ids = advertiserIds(ctx)
    if (ids.length === 0) return []
    type Row = { advertiser_id: string; name: string; currency: string; timezone: string; status: string }
    const data = unwrap<Listing<Row>>(ctx, await providerFetch<Envelope<Listing<Row>>>(ctx, {
      path: '/advertiser/info/', authHeader: auth,
      query: { advertiser_ids: JSON.stringify(ids) },
    }))
    return (data.list ?? []).map(row => ({
      externalId: row.advertiser_id,
      name: row.name ?? row.advertiser_id,
      currency: row.currency ?? 'USD',
      timezone: row.timezone ?? 'UTC',
      status: row.status === 'STATUS_ENABLE' ? 'active' : row.status === 'STATUS_DISABLE' ? 'paused' : 'active',
    }))
  },

  async listCampaigns(ctx, accountExternalId) {
    type Row = {
      campaign_id: string; campaign_name: string; objective_type: string
      operation_status: string; secondary_status?: string; budget?: number
      budget_mode?: string; create_time?: string; modify_time?: string
    }
    const rows = await listAll<Row>(ctx, '/campaign/get/', { advertiser_id: accountExternalId })
    return rows.map(row => ({
      externalId: row.campaign_id,
      accountExternalId,
      name: row.campaign_name,
      objective: OBJECTIVE[row.objective_type] ?? 'conversions',
      status: STATUS[row.secondary_status ?? row.operation_status] ?? 'draft',
      budgetAmount: money(row.budget),
      budgetType: row.budget_mode === 'BUDGET_MODE_TOTAL' ? 'lifetime' : row.budget_mode ? 'daily' : null,
      buyingType: null,
      startsAt: isoDate(row.create_time),
      endsAt: null,
    }))
  },

  async listAdSets(ctx, accountExternalId) {
    type Row = {
      adgroup_id: string; campaign_id: string; adgroup_name: string
      operation_status: string; secondary_status?: string
      budget?: number; budget_mode?: string; optimization_goal?: string
      schedule_start_time?: string; schedule_end_time?: string
    }
    const rows = await listAll<Row>(ctx, '/adgroup/get/', { advertiser_id: accountExternalId })
    return rows.map(row => ({
      externalId: row.adgroup_id,
      campaignExternalId: row.campaign_id,
      name: row.adgroup_name,
      status: STATUS[row.secondary_status ?? row.operation_status] ?? 'draft',
      budgetAmount: money(row.budget),
      budgetType: row.budget_mode === 'BUDGET_MODE_TOTAL' ? 'lifetime' : row.budget_mode ? 'daily' : null,
      optimisationGoal: row.optimization_goal ?? null,
      startsAt: isoDate(row.schedule_start_time),
      endsAt: isoDate(row.schedule_end_time),
    }))
  },

  async listCreatives(ctx, accountExternalId) {
    type Row = {
      ad_id: string; campaign_id: string; adgroup_id: string; ad_name: string
      operation_status: string; secondary_status?: string
      ad_format?: string; video_id?: string; image_ids?: string[]
      ad_text?: string; call_to_action?: string; landing_page_url?: string
      image_urls?: string[]; audit_fail_reason?: string
    }
    const rows = await listAll<Row>(ctx, '/ad/get/', { advertiser_id: accountExternalId })
    return rows.map(row => ({
      externalId: row.ad_id,
      campaignExternalId: row.campaign_id ?? null,
      adSetExternalId: row.adgroup_id ?? null,
      name: row.ad_name,
      format: row.video_id ? 'video' : (row.image_ids?.length ?? 0) > 1 ? 'carousel' : 'image',
      status: row.operation_status === 'ENABLE' ? 'active' : row.operation_status === 'DISABLE' ? 'paused' : 'draft',
      reviewStatus: REVIEW[row.secondary_status ?? ''] ?? 'under_review',
      providerFeedback: row.audit_fail_reason ?? null,
      thumbnailUrl: row.image_urls?.[0] ?? null,
      aspectRatio: null,
      durationSeconds: null,
      headline: null,
      bodyText: row.ad_text ?? null,
      destinationUrl: row.landing_page_url ?? null,
    }))
  },

  async listAudiences(ctx, accountExternalId) {
    type Row = {
      audience_id: string; name: string; audience_type: string
      audience_sub_type?: string; cover_num?: number; is_valid?: boolean
      create_time?: string; expired_time?: string; calculate_type?: string
    }
    const rows = await listAll<Row>(ctx, '/dmp/custom_audience/list/', { advertiser_id: accountExternalId })
    return rows.map(row => ({
      externalId: row.audience_id,
      name: row.name,
      audienceType: AUDIENCE_TYPE[row.audience_type] ?? 'custom',
      description: null,
      sizeEstimate: row.cover_num ?? null,
      matchedUsers: row.cover_num ?? null,
      matchRate: null,
      recencyDays: null,
      status: row.is_valid === false ? 'review' : 'ready',
      lastRefreshedAt: isoDate(row.create_time),
    }))
  },

  async getInsights(ctx, request: InsightRequest) {
    const dataLevel = {
      account: 'AUCTION_ADVERTISER', campaign: 'AUCTION_CAMPAIGN',
      ad_set: 'AUCTION_ADGROUP', creative: 'AUCTION_AD', audience: 'AUCTION_CAMPAIGN',
    }[request.level]
    const dimension = {
      account: 'advertiser_id', campaign: 'campaign_id',
      ad_set: 'adgroup_id', creative: 'ad_id', audience: 'campaign_id',
    }[request.level]

    type Row = { dimensions?: Record<string, string>; metrics?: Record<string, string> }
    const rows = await listAll<Row>(ctx, '/report/integrated/get/', {
      advertiser_id: request.accountExternalId,
      report_type: 'BASIC',
      data_level: dataLevel,
      dimensions: JSON.stringify([dimension, 'stat_time_day']),
      metrics: JSON.stringify([
        'spend', 'impressions', 'reach', 'clicks', 'conversion', 'total_purchase_value',
        'video_play_actions', 'video_watched_2s', 'engagements',
      ]),
      start_date: request.since,
      end_date: request.until,
    })

    return rows.map(row => ({
      entityType: request.level,
      entityExternalId: row.dimensions?.[dimension] ?? request.accountExternalId,
      date: dayString(row.dimensions?.stat_time_day),
      currency: ctx.extras.currency ?? 'USD',
      attributionWindow: request.attributionWindow,
      spend: count(row.metrics?.spend),
      impressions: count(row.metrics?.impressions),
      reach: count(row.metrics?.reach),
      clicks: count(row.metrics?.clicks),
      conversions: count(row.metrics?.conversion),
      revenue: count(row.metrics?.total_purchase_value),
      videoViews: count(row.metrics?.video_play_actions),
      // TikTok reports a 2-second watch; used as the nearest hook-rate signal.
      video3sViews: count(row.metrics?.video_watched_2s),
      engagements: count(row.metrics?.engagements),
      isEstimated: false,
    }))
  },

  async setCampaignStatus(ctx, campaignExternalId, status) {
    const advertiserId = ctx.extras.advertiser_id
    if (!advertiserId) throw new Error('TikTok campaign updates need the owning advertiser id.')
    unwrap(ctx, await providerFetch<Envelope<unknown>>(ctx, {
      method: 'POST', path: '/campaign/status/update/', authHeader: auth,
      body: {
        advertiser_id: advertiserId,
        campaign_ids: [campaignExternalId],
        operation_status: status === 'active' ? 'ENABLE' : 'DISABLE',
      },
    }))
  },
}
