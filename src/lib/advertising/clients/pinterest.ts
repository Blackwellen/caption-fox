import 'server-only'
import { providerFetch, paginate, money, count, isoDate, dayString } from './http'
import type { Adapter, AdapterContext, InsightRequest, RemoteCampaign, RemoteCreative, RemoteAudience } from './types'

// Pinterest Ads API v5.
// Docs: https://developers.pinterest.com/docs/api/v5/
// Bookmark-based pagination; money is reported in micro-currency.

type Bookmarked<T> = { items?: T[]; bookmark?: string | null }

const micro = (value: unknown): number | null => {
  const raw = money(value)
  return raw === null ? null : raw / 1_000_000
}

function listAll<T>(ctx: AdapterContext, path: string, query: Record<string, string | number> = {}) {
  return paginate<Bookmarked<T>, T>(
    bookmark => providerFetch<Bookmarked<T>>(ctx, {
      path, query: { ...query, page_size: 250, bookmark: bookmark ?? undefined },
    }),
    page => ({ items: page.items ?? [], next: page.bookmark ?? null }),
  )
}

const OBJECTIVE: Record<string, RemoteCampaign['objective']> = {
  AWARENESS: 'awareness', CONSIDERATION: 'traffic', VIDEO_VIEW: 'video_views',
  WEB_CONVERSION: 'conversions', CATALOG_SALES: 'sales', WEB_SESSIONS: 'traffic',
}

const STATUS: Record<string, RemoteCampaign['status']> = {
  ACTIVE: 'active', PAUSED: 'paused', ARCHIVED: 'archived', DRAFT: 'draft', COMPLETED: 'completed',
}

const REVIEW: Record<string, RemoteCreative['reviewStatus']> = {
  APPROVED: 'approved', PENDING: 'under_review', REJECTED: 'disapproved',
}

const AUDIENCE_TYPE: Record<string, RemoteAudience['audienceType']> = {
  CUSTOMER_LIST: 'crm_list', VISITOR: 'website_visitors', ENGAGEMENT: 'engagers',
  ACTALIKE: 'lookalike', PERSONA: 'interest',
}

export const pinterestAdapter: Adapter = {
  provider: 'pinterest',

  async listAccounts(ctx) {
    type Row = { id: string; name: string; currency: string; country: string; owner?: { username: string } }
    const rows = await listAll<Row>(ctx, '/ad_accounts')
    return rows.map(row => ({
      externalId: row.id,
      name: row.name ?? row.id,
      currency: row.currency ?? 'USD',
      // Pinterest reports in the account's country timezone; not exposed here.
      timezone: 'UTC',
      status: 'active' as const,
    }))
  },

  async listCampaigns(ctx, accountExternalId) {
    type Row = {
      id: string; name: string; status: string; objective_type: string
      daily_spend_cap?: number; lifetime_spend_cap?: number
      start_time?: number; end_time?: number
    }
    const rows = await listAll<Row>(ctx, `/ad_accounts/${accountExternalId}/campaigns`)
    return rows.map(row => ({
      externalId: row.id,
      accountExternalId,
      name: row.name,
      objective: OBJECTIVE[row.objective_type] ?? 'conversions',
      status: STATUS[row.status] ?? 'draft',
      budgetAmount: micro(row.daily_spend_cap ?? row.lifetime_spend_cap),
      budgetType: row.daily_spend_cap ? 'daily' : row.lifetime_spend_cap ? 'lifetime' : null,
      buyingType: null,
      startsAt: row.start_time ? new Date(row.start_time * 1000).toISOString() : null,
      endsAt: row.end_time ? new Date(row.end_time * 1000).toISOString() : null,
    }))
  },

  async listAdSets(ctx, accountExternalId) {
    type Row = {
      id: string; campaign_id: string; name: string; status: string
      budget_in_micro_currency?: number; budget_type?: string
      optimization_goal_metadata?: { conversion_tag_v3_goal_metadata?: { conversion_event?: string } }
      start_time?: number; end_time?: number
    }
    const rows = await listAll<Row>(ctx, `/ad_accounts/${accountExternalId}/ad_groups`)
    return rows.map(row => ({
      externalId: row.id,
      campaignExternalId: row.campaign_id,
      name: row.name,
      status: STATUS[row.status] ?? 'draft',
      budgetAmount: micro(row.budget_in_micro_currency),
      budgetType: row.budget_type === 'LIFETIME' ? 'lifetime' : row.budget_type ? 'daily' : null,
      optimisationGoal: row.optimization_goal_metadata?.conversion_tag_v3_goal_metadata?.conversion_event ?? null,
      startsAt: row.start_time ? new Date(row.start_time * 1000).toISOString() : null,
      endsAt: row.end_time ? new Date(row.end_time * 1000).toISOString() : null,
    }))
  },

  async listCreatives(ctx, accountExternalId) {
    type Row = {
      id: string; ad_group_id: string; campaign_id?: string; name: string
      status: string; review_status?: string; rejection_reasons?: string[]
      creative_type?: string; destination_url?: string; pin_id?: string
    }
    const rows = await listAll<Row>(ctx, `/ad_accounts/${accountExternalId}/ads`)
    return rows.map(row => ({
      externalId: row.id,
      campaignExternalId: row.campaign_id ?? null,
      adSetExternalId: row.ad_group_id ?? null,
      name: row.name ?? `Ad ${row.id}`,
      format: row.creative_type === 'VIDEO' ? 'video'
        : row.creative_type === 'CAROUSEL' ? 'carousel'
          : row.creative_type === 'SHOPPING' ? 'display' : 'image',
      status: STATUS[row.status] === 'active' ? 'active' : STATUS[row.status] === 'paused' ? 'paused' : 'draft',
      reviewStatus: REVIEW[row.review_status ?? ''] ?? 'under_review',
      providerFeedback: row.rejection_reasons?.join(', ') ?? null,
      thumbnailUrl: null,
      aspectRatio: null,
      durationSeconds: null,
      headline: null,
      bodyText: null,
      destinationUrl: row.destination_url ?? null,
    }))
  },

  async listAudiences(ctx, accountExternalId) {
    type Row = {
      id: string; name: string; audience_type: string; description?: string
      size?: number; status?: string; updated_time?: number
    }
    const rows = await listAll<Row>(ctx, `/ad_accounts/${accountExternalId}/audiences`)
    return rows.map(row => ({
      externalId: row.id,
      name: row.name,
      audienceType: AUDIENCE_TYPE[row.audience_type] ?? 'custom',
      description: row.description ?? null,
      sizeEstimate: row.size ?? null,
      matchedUsers: row.size ?? null,
      matchRate: null,
      recencyDays: null,
      status: row.status === 'READY' ? 'ready' : 'review',
      lastRefreshedAt: row.updated_time ? new Date(row.updated_time * 1000).toISOString() : null,
    }))
  },

  async getInsights(ctx, request: InsightRequest) {
    const path = {
      account: `/ad_accounts/${request.accountExternalId}/analytics`,
      campaign: `/ad_accounts/${request.accountExternalId}/campaigns/analytics`,
      ad_set: `/ad_accounts/${request.accountExternalId}/ad_groups/analytics`,
      creative: `/ad_accounts/${request.accountExternalId}/ads/analytics`,
      audience: `/ad_accounts/${request.accountExternalId}/campaigns/analytics`,
    }[request.level]

    const idKey = {
      account: 'AD_ACCOUNT_ID', campaign: 'CAMPAIGN_ID',
      ad_set: 'AD_GROUP_ID', creative: 'AD_ID', audience: 'CAMPAIGN_ID',
    }[request.level]

    type Row = Record<string, string | number>
    const rows = await providerFetch<Row[]>(ctx, {
      path,
      query: {
        start_date: request.since,
        end_date: request.until,
        granularity: 'DAY',
        columns: [
          idKey, 'SPEND_IN_MICRO_DOLLAR', 'IMPRESSION_1', 'TOTAL_CLICKTHROUGH',
          'TOTAL_CONVERSIONS', 'TOTAL_CONVERSIONS_VALUE_IN_MICRO_DOLLAR',
          'VIDEO_MRC_VIEWS_1', 'TOTAL_ENGAGEMENT',
        ].join(','),
      },
    })

    return (Array.isArray(rows) ? rows : []).map(row => ({
      entityType: request.level,
      entityExternalId: String(row[idKey] ?? request.accountExternalId),
      date: dayString(row.DATE),
      currency: ctx.extras.currency ?? 'USD',
      attributionWindow: request.attributionWindow,
      spend: micro(row.SPEND_IN_MICRO_DOLLAR) ?? 0,
      impressions: count(row.IMPRESSION_1),
      // Pinterest reports impressions rather than deduplicated reach here.
      reach: 0,
      clicks: count(row.TOTAL_CLICKTHROUGH),
      conversions: count(row.TOTAL_CONVERSIONS),
      revenue: micro(row.TOTAL_CONVERSIONS_VALUE_IN_MICRO_DOLLAR) ?? 0,
      videoViews: count(row.VIDEO_MRC_VIEWS_1),
      video3sViews: 0,
      engagements: count(row.TOTAL_ENGAGEMENT),
      isEstimated: false,
    }))
  },

  async setCampaignStatus(ctx, campaignExternalId, status) {
    const accountId = ctx.extras.account_id
    if (!accountId) throw new Error('Pinterest campaign updates need the owning ad account id.')
    await providerFetch(ctx, {
      method: 'PATCH',
      path: `/ad_accounts/${accountId}/campaigns`,
      body: [{ id: campaignExternalId, status: status === 'active' ? 'ACTIVE' : 'PAUSED' }],
    })
  },
}

export const __pinterestInternals = { isoDate }
