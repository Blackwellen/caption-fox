import 'server-only'
import { providerFetch, paginate, money, count, isoDate, dayString } from './http'
import type { Adapter, AdapterContext, InsightRequest, RemoteCampaign, RemoteCreative } from './types'

// Reddit Ads API v3.
// Docs: https://ads-api.reddit.com/docs/
// Cursor pagination via pagination.next_url; money in micro-currency.

type Paged<T> = { data?: T[]; pagination?: { next_url?: string | null } }

const micro = (value: unknown): number | null => {
  const raw = money(value)
  return raw === null ? null : raw / 1_000_000
}

function listAll<T>(ctx: AdapterContext, path: string) {
  return paginate<Paged<T>, T>(
    cursor => providerFetch<Paged<T>>(ctx, { path, query: { page_size: 100, after: cursor ?? undefined } }),
    page => {
      const next = page.pagination?.next_url ?? null
      const after = next ? new URL(next, 'https://ads-api.reddit.com').searchParams.get('after') : null
      return { items: page.data ?? [], next: after }
    },
  )
}

const OBJECTIVE: Record<string, RemoteCampaign['objective']> = {
  IMPRESSIONS: 'awareness', REACH: 'awareness', CLICKS: 'traffic',
  TRAFFIC: 'traffic', CONVERSIONS: 'conversions', VIDEO_VIEWABLE_IMPRESSIONS: 'video_views',
  APP_INSTALLS: 'app_installs', LEAD_GENERATION: 'leads', CATALOG_SALES: 'sales',
}

const STATUS: Record<string, RemoteCampaign['status']> = {
  ACTIVE: 'active', PAUSED: 'paused', ARCHIVED: 'archived',
  DELETED: 'archived', DRAFT: 'draft', COMPLETED: 'completed',
}

const REVIEW: Record<string, RemoteCreative['reviewStatus']> = {
  APPROVED: 'approved', PENDING: 'under_review', REJECTED: 'disapproved', UNREVIEWED: 'not_submitted',
}

export const redditAdapter: Adapter = {
  provider: 'reddit',

  async listAccounts(ctx) {
    type Row = { id: string; name?: string; currency?: string; time_zone_id?: string; status?: string }
    const me = await providerFetch<{ data?: { id?: string } }>(ctx, { path: '/me' })
    const rows = me.data?.id
      ? await listAll<Row>(ctx, `/business_accounts/${me.data.id}/ad_accounts`)
      : await listAll<Row>(ctx, '/ad_accounts')
    return rows.map(row => ({
      externalId: row.id,
      name: row.name ?? row.id,
      currency: row.currency ?? 'USD',
      timezone: row.time_zone_id ?? 'UTC',
      status: row.status === 'ACTIVE' ? 'active' : 'paused' as const,
    }))
  },

  async listCampaigns(ctx, accountExternalId) {
    type Row = {
      id: string; name: string; configured_status: string; effective_status?: string
      objective?: string; spend_cap?: number; funding_instrument_id?: string
      created_at?: string; ended_at?: string
    }
    const rows = await listAll<Row>(ctx, `/ad_accounts/${accountExternalId}/campaigns`)
    return rows.map(row => ({
      externalId: row.id,
      accountExternalId,
      name: row.name,
      objective: OBJECTIVE[row.objective ?? ''] ?? 'conversions',
      status: STATUS[row.effective_status ?? row.configured_status] ?? 'draft',
      budgetAmount: micro(row.spend_cap),
      budgetType: row.spend_cap ? 'lifetime' : null,
      buyingType: null,
      startsAt: isoDate(row.created_at),
      endsAt: isoDate(row.ended_at),
    }))
  },

  async listAdSets(ctx, accountExternalId) {
    type Row = {
      id: string; campaign_id: string; name: string
      configured_status: string; effective_status?: string
      goal_value?: number; goal_type?: string; bid_strategy?: string
      start_time?: string; end_time?: string
    }
    const rows = await listAll<Row>(ctx, `/ad_accounts/${accountExternalId}/ad_groups`)
    return rows.map(row => ({
      externalId: row.id,
      campaignExternalId: row.campaign_id,
      name: row.name,
      status: STATUS[row.effective_status ?? row.configured_status] ?? 'draft',
      budgetAmount: micro(row.goal_value),
      budgetType: row.goal_type === 'LIFETIME_SPEND' ? 'lifetime' : row.goal_type ? 'daily' : null,
      optimisationGoal: row.bid_strategy ?? null,
      startsAt: isoDate(row.start_time),
      endsAt: isoDate(row.end_time),
    }))
  },

  async listCreatives(ctx, accountExternalId) {
    type Row = {
      id: string; ad_group_id?: string; campaign_id?: string; name: string
      configured_status: string; effective_status?: string
      review_state?: string; rejection_reason?: string
      type?: string; click_url?: string; preview_expiry?: string
      post?: { thumbnail_url?: string; title?: string; body?: string }
    }
    const rows = await listAll<Row>(ctx, `/ad_accounts/${accountExternalId}/ads`)
    return rows.map(row => ({
      externalId: row.id,
      campaignExternalId: row.campaign_id ?? null,
      adSetExternalId: row.ad_group_id ?? null,
      name: row.name ?? row.post?.title ?? `Ad ${row.id}`,
      format: row.type === 'VIDEO' ? 'video' : row.type === 'CAROUSEL' ? 'carousel' : 'image',
      status: row.effective_status === 'ACTIVE' ? 'active' : row.effective_status === 'PAUSED' ? 'paused' : 'draft',
      reviewStatus: REVIEW[row.review_state ?? ''] ?? 'under_review',
      providerFeedback: row.rejection_reason ?? null,
      thumbnailUrl: row.post?.thumbnail_url ?? null,
      aspectRatio: null,
      durationSeconds: null,
      headline: row.post?.title ?? null,
      bodyText: row.post?.body ?? null,
      destinationUrl: row.click_url ?? null,
    }))
  },

  async listAudiences(ctx, accountExternalId) {
    type Row = { id: string; name: string; type?: string; status?: string; size?: number; updated_at?: string }
    const rows = await listAll<Row>(ctx, `/ad_accounts/${accountExternalId}/custom_audiences`)
    return rows.map(row => ({
      externalId: row.id,
      name: row.name,
      audienceType: row.type === 'CUSTOMER_LIST' ? 'crm_list' as const
        : row.type === 'PIXEL' ? 'website_visitors' as const : 'custom' as const,
      description: null,
      sizeEstimate: row.size ?? null,
      matchedUsers: row.size ?? null,
      matchRate: null,
      recencyDays: null,
      status: row.status === 'READY' ? 'ready' as const : 'review' as const,
      lastRefreshedAt: isoDate(row.updated_at),
    }))
  },

  async getInsights(ctx, request: InsightRequest) {
    const breakdown = {
      account: 'ACCOUNT_ID', campaign: 'CAMPAIGN_ID',
      ad_set: 'AD_GROUP_ID', creative: 'AD_ID', audience: 'CAMPAIGN_ID',
    }[request.level]

    type Row = Record<string, string | number>
    const response = await providerFetch<{ data?: { metrics?: Row[] } }>(ctx, {
      method: 'POST',
      path: `/ad_accounts/${request.accountExternalId}/reports`,
      body: {
        data: {
          breakdowns: [breakdown],
          fields: ['spend', 'impressions', 'clicks', 'conversion_purchase_total_items',
            'conversion_purchase_total_value', 'video_started', 'video_watched_3s', 'cpc'],
          starts_at: `${request.since}T00:00:00Z`,
          ends_at: `${request.until}T23:59:59Z`,
          time_zone_id: 'UTC',
          group_by: ['DATE'],
        },
      },
    })

    return (response.data?.metrics ?? []).map(row => ({
      entityType: request.level,
      entityExternalId: String(row[breakdown.toLowerCase()] ?? row[breakdown] ?? request.accountExternalId),
      date: dayString(row.date),
      currency: ctx.extras.currency ?? 'USD',
      attributionWindow: request.attributionWindow,
      spend: micro(row.spend) ?? 0,
      impressions: count(row.impressions),
      reach: 0,
      clicks: count(row.clicks),
      conversions: count(row.conversion_purchase_total_items),
      revenue: micro(row.conversion_purchase_total_value) ?? 0,
      videoViews: count(row.video_started),
      video3sViews: count(row.video_watched_3s),
      engagements: 0,
      isEstimated: false,
    }))
  },

  async setCampaignStatus(ctx, campaignExternalId, status) {
    const accountId = ctx.extras.account_id
    if (!accountId) throw new Error('Reddit campaign updates need the owning ad account id.')
    await providerFetch(ctx, {
      method: 'PATCH',
      path: `/ad_accounts/${accountId}/campaigns/${campaignExternalId}`,
      body: { data: { configured_status: status === 'active' ? 'ACTIVE' : 'PAUSED' } },
    })
  },
}
