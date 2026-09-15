import 'server-only'
import { providerFetch, paginate, money, count, isoDate, dayString } from './http'
import type {
  Adapter, AdapterContext, InsightRequest, RemoteAccount, RemoteAdSet,
  RemoteAudience, RemoteCampaign, RemoteCreative, RemoteInsight,
} from './types'

// Meta Marketing API (Graph v21.0).
// Docs: https://developers.facebook.com/docs/marketing-apis
//
// Meta prefixes account ids with "act_". We store the bare id and re-add the
// prefix on the wire so the rest of Caption Fox never sees provider syntax.

type Paging = { paging?: { cursors?: { after?: string }; next?: string } }
type Page<T> = { data?: T[] } & Paging

const withAct = (id: string) => (id.startsWith('act_') ? id : `act_${id}`)
const withoutAct = (id: string) => id.replace(/^act_/, '')

function page<T>(ctx: AdapterContext, path: string, fields: string, extra: Record<string, string> = {}) {
  return paginate<Page<T>, T>(
    cursor => providerFetch<Page<T>>(ctx, {
      path, query: { fields, limit: 200, after: cursor ?? undefined, ...extra },
    }),
    result => ({ items: result.data ?? [], next: result.paging?.cursors?.after ?? null }),
  )
}

// Meta campaign objectives -> Caption Fox objectives.
const OBJECTIVE: Record<string, RemoteCampaign['objective']> = {
  OUTCOME_AWARENESS: 'awareness', OUTCOME_TRAFFIC: 'traffic',
  OUTCOME_ENGAGEMENT: 'engagement', OUTCOME_LEADS: 'leads',
  OUTCOME_APP_PROMOTION: 'app_installs', OUTCOME_SALES: 'sales',
  BRAND_AWARENESS: 'awareness', REACH: 'awareness', LINK_CLICKS: 'traffic',
  POST_ENGAGEMENT: 'engagement', LEAD_GENERATION: 'leads',
  APP_INSTALLS: 'app_installs', VIDEO_VIEWS: 'video_views', CONVERSIONS: 'conversions',
}

const STATUS: Record<string, RemoteCampaign['status']> = {
  ACTIVE: 'active', PAUSED: 'paused', DELETED: 'archived',
  ARCHIVED: 'archived', IN_PROCESS: 'learning', WITH_ISSUES: 'paused',
}

const ACCOUNT_STATUS: Record<number, RemoteAccount['status']> = {
  1: 'active', 2: 'unsettled', 3: 'unsettled', 7: 'paused', 9: 'unsettled', 100: 'closed', 101: 'closed',
}

const REVIEW: Record<string, RemoteCreative['reviewStatus']> = {
  APPROVED: 'approved', PENDING_REVIEW: 'under_review', PREAPPROVED: 'approved',
  DISAPPROVED: 'disapproved', PENDING_BILLING_INFO: 'changes_requested', ADSET_PAUSED: 'approved',
}

const AUDIENCE_TYPE: Record<string, RemoteAudience['audienceType']> = {
  CUSTOM: 'custom', LOOKALIKE: 'lookalike', WEBSITE: 'website_visitors',
  ENGAGEMENT: 'engagers', VIDEO: 'video_viewers', APP: 'app_users',
  OFFLINE_CONVERSION: 'crm_list', CLAIM: 'crm_list', PARTNER: 'crm_list',
}

/** Meta reports conversions and value inside a nested actions array. */
function actionValue(actions: unknown, keys: string[]): number {
  if (!Array.isArray(actions)) return 0
  let total = 0
  for (const entry of actions as { action_type?: string; value?: string }[]) {
    if (entry.action_type && keys.includes(entry.action_type)) total += count(entry.value)
  }
  return total
}

const PURCHASE_ACTIONS = ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase']

export const metaAdapter: Adapter = {
  provider: 'meta',

  async listAccounts(ctx) {
    type Row = { id: string; account_id: string; name: string; currency: string; timezone_name: string; account_status: number }
    const rows = await page<Row>(ctx, '/me/adaccounts', 'account_id,name,currency,timezone_name,account_status')
    return rows.map(row => ({
      externalId: withoutAct(row.account_id ?? row.id),
      name: row.name ?? row.account_id,
      currency: row.currency ?? 'USD',
      timezone: row.timezone_name ?? 'UTC',
      status: ACCOUNT_STATUS[row.account_status] ?? 'active',
    }))
  },

  async listCampaigns(ctx, accountExternalId) {
    type Row = {
      id: string; name: string; objective: string; status: string; effective_status: string
      daily_budget?: string; lifetime_budget?: string; buying_type?: string
      start_time?: string; stop_time?: string
    }
    const rows = await page<Row>(
      ctx, `/${withAct(accountExternalId)}/campaigns`,
      'name,objective,status,effective_status,daily_budget,lifetime_budget,buying_type,start_time,stop_time',
    )
    return rows.map(row => ({
      externalId: row.id,
      accountExternalId,
      name: row.name,
      objective: OBJECTIVE[row.objective] ?? 'conversions',
      status: STATUS[row.effective_status ?? row.status] ?? 'draft',
      // Meta budgets are minor units of the account currency.
      budgetAmount: money(row.daily_budget ?? row.lifetime_budget, true),
      budgetType: row.daily_budget ? 'daily' : row.lifetime_budget ? 'lifetime' : null,
      buyingType: row.buying_type ?? null,
      startsAt: isoDate(row.start_time),
      endsAt: isoDate(row.stop_time),
    }))
  },

  async listAdSets(ctx, accountExternalId) {
    type Row = {
      id: string; campaign_id: string; name: string; effective_status: string; status: string
      daily_budget?: string; lifetime_budget?: string; optimization_goal?: string
      start_time?: string; end_time?: string
    }
    const rows = await page<Row>(
      ctx, `/${withAct(accountExternalId)}/adsets`,
      'campaign_id,name,status,effective_status,daily_budget,lifetime_budget,optimization_goal,start_time,end_time',
    )
    return rows.map(row => ({
      externalId: row.id,
      campaignExternalId: row.campaign_id,
      name: row.name,
      status: STATUS[row.effective_status ?? row.status] ?? 'draft',
      budgetAmount: money(row.daily_budget ?? row.lifetime_budget, true),
      budgetType: row.daily_budget ? 'daily' : row.lifetime_budget ? 'lifetime' : null,
      optimisationGoal: row.optimization_goal ?? null,
      startsAt: isoDate(row.start_time),
      endsAt: isoDate(row.end_time),
    }))
  },

  async listCreatives(ctx, accountExternalId) {
    type Row = {
      id: string; name: string; campaign_id?: string; adset_id?: string
      effective_status: string; status: string
      ad_review_feedback?: { global?: Record<string, string> }
      creative?: {
        id: string; name?: string; object_type?: string; thumbnail_url?: string
        title?: string; body?: string; object_story_spec?: Record<string, unknown>
        asset_feed_spec?: { videos?: unknown[]; images?: unknown[] }
        video_id?: string
      }
    }
    const rows = await page<Row>(
      ctx, `/${withAct(accountExternalId)}/ads`,
      'name,campaign_id,adset_id,status,effective_status,ad_review_feedback,' +
      'creative{id,name,object_type,thumbnail_url,title,body,video_id,asset_feed_spec}',
    )
    return rows.map(row => {
      const creative = row.creative
      const feedback = row.ad_review_feedback?.global
      return {
        externalId: row.id,
        campaignExternalId: row.campaign_id ?? null,
        adSetExternalId: row.adset_id ?? null,
        name: row.name || creative?.name || row.id,
        format: metaFormat(creative),
        status: row.effective_status === 'ACTIVE' ? 'active'
          : row.effective_status === 'ARCHIVED' || row.effective_status === 'DELETED' ? 'archived'
            : row.effective_status === 'PAUSED' ? 'paused' : 'draft',
        reviewStatus: REVIEW[row.effective_status] ?? (feedback ? 'disapproved' : 'approved'),
        providerFeedback: feedback ? Object.values(feedback).join(' ').slice(0, 500) : null,
        thumbnailUrl: creative?.thumbnail_url ?? null,
        aspectRatio: null,
        durationSeconds: null,
        headline: creative?.title ?? null,
        bodyText: creative?.body ?? null,
        destinationUrl: null,
      }
    })
  },

  async listAudiences(ctx, accountExternalId) {
    type Row = {
      id: string; name: string; subtype: string; description?: string
      approximate_count_lower_bound?: number; approximate_count_upper_bound?: number
      delivery_status?: { code: number; description: string }
      retention_days?: number; time_content_updated?: number
    }
    const rows = await page<Row>(
      ctx, `/${withAct(accountExternalId)}/customaudiences`,
      'name,subtype,description,approximate_count_lower_bound,approximate_count_upper_bound,' +
      'delivery_status,retention_days,time_content_updated',
    )
    return rows.map(row => {
      const lower = row.approximate_count_lower_bound ?? null
      const upper = row.approximate_count_upper_bound ?? null
      const size = lower !== null && upper !== null ? Math.round((lower + upper) / 2) : lower ?? upper
      return {
        externalId: row.id,
        name: row.name,
        audienceType: AUDIENCE_TYPE[row.subtype] ?? 'custom',
        description: row.description ?? null,
        sizeEstimate: size,
        matchedUsers: size,
        // Meta does not expose a match rate on the read API.
        matchRate: null,
        recencyDays: row.retention_days ?? null,
        status: row.delivery_status?.code === 200 ? 'ready' : 'review',
        lastRefreshedAt: row.time_content_updated ? new Date(row.time_content_updated * 1000).toISOString() : null,
      }
    })
  },

  async getInsights(ctx, request: InsightRequest) {
    const level = request.level === 'creative' ? 'ad' : request.level === 'ad_set' ? 'adset' : request.level
    type Row = {
      date_start: string; account_currency?: string
      account_id?: string; campaign_id?: string; adset_id?: string; ad_id?: string
      spend?: string; impressions?: string; reach?: string; clicks?: string; frequency?: string
      actions?: unknown; action_values?: unknown
      video_play_actions?: unknown; video_3_sec_watched_actions?: unknown
    }
    const rows = await page<Row>(
      ctx, `/${withAct(request.accountExternalId)}/insights`,
      'account_currency,account_id,campaign_id,adset_id,ad_id,spend,impressions,reach,clicks,' +
      'actions,action_values,video_play_actions,video_3_sec_watched_actions',
      {
        level,
        time_increment: '1',
        time_range: JSON.stringify({ since: request.since, until: request.until }),
        action_attribution_windows: JSON.stringify([metaAttribution(request.attributionWindow)]),
      },
    )
    return rows.map(row => ({
      entityType: request.level,
      entityExternalId: row.ad_id ?? row.adset_id ?? row.campaign_id ?? withoutAct(row.account_id ?? request.accountExternalId),
      date: dayString(row.date_start),
      currency: row.account_currency ?? 'USD',
      attributionWindow: request.attributionWindow,
      spend: count(row.spend),
      impressions: count(row.impressions),
      reach: count(row.reach),
      clicks: count(row.clicks),
      conversions: actionValue(row.actions, PURCHASE_ACTIONS),
      revenue: actionValue(row.action_values, PURCHASE_ACTIONS),
      videoViews: actionValue(row.video_play_actions, ['video_view']),
      video3sViews: actionValue(row.video_3_sec_watched_actions, ['video_view']),
      engagements: actionValue(row.actions, ['post_engagement', 'page_engagement']),
      isEstimated: false,
    }))
  },

  async setCampaignStatus(ctx, campaignExternalId, status) {
    await providerFetch(ctx, {
      method: 'POST',
      path: `/${campaignExternalId}`,
      query: { status: status === 'active' ? 'ACTIVE' : 'PAUSED' },
    })
  },
}

function metaFormat(creative: { object_type?: string; video_id?: string; asset_feed_spec?: { videos?: unknown[]; images?: unknown[] } } | undefined): RemoteCreative['format'] {
  if (!creative) return 'image'
  if (creative.video_id || (creative.asset_feed_spec?.videos?.length ?? 0) > 0) return 'video'
  if ((creative.asset_feed_spec?.images?.length ?? 0) > 1) return 'carousel'
  switch (creative.object_type) {
    case 'VIDEO': return 'video'
    case 'SHARE': return 'carousel'
    case 'PHOTO': return 'image'
    default: return 'image'
  }
}

/** Caption Fox attribution window -> Meta action_attribution_windows value. */
function metaAttribution(window: string): string {
  switch (window) {
    case '1d_click': return '1d_click'
    case '28d_click': return '28d_click'
    case '7d_click_1d_view': return '7d_click'
    case '28d_click_1d_view': return '28d_click'
    default: return '7d_click'
  }
}
