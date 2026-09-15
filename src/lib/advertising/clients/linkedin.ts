import 'server-only'
import { providerFetch, money, count, isoDate, dayString } from './http'
import type { Adapter, AdapterContext, InsightRequest, RemoteCampaign, RemoteCreative, RemoteAudience } from './types'

// LinkedIn Marketing API (Rest.li 2.0).
// Docs: https://learn.microsoft.com/linkedin/marketing/
//
// Entity mapping, because LinkedIn's hierarchy is one level off ours:
//   LinkedIn Campaign Group -> Caption Fox campaign
//   LinkedIn Campaign       -> Caption Fox ad set
//   LinkedIn Creative       -> Caption Fox creative

type Element<T> = { elements?: T[]; paging?: { start?: number; count?: number; total?: number } }

const DEFAULT_VERSION = '202411'

function linkedinHeaders(ctx: AdapterContext): Record<string, string> {
  return {
    'LinkedIn-Version': ctx.extras.api_version || DEFAULT_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
  }
}

/** LinkedIn uses offset paging with start/count. */
async function listAll<T>(ctx: AdapterContext, path: string, query: Record<string, string | number>): Promise<T[]> {
  const items: T[] = []
  const pageSize = 100
  for (let start = 0; start < pageSize * 50; start += pageSize) {
    const response = await providerFetch<Element<T>>(ctx, {
      path, headers: linkedinHeaders(ctx), query: { ...query, start, count: pageSize },
    })
    const batch = response.elements ?? []
    items.push(...batch)
    if (batch.length < pageSize) break
  }
  return items
}

/** urn:li:sponsoredAccount:123 -> 123 */
const urnId = (urn: string | undefined | null): string => String(urn ?? '').split(':').pop() ?? ''

const STATUS: Record<string, RemoteCampaign['status']> = {
  ACTIVE: 'active', PAUSED: 'paused', ARCHIVED: 'archived',
  COMPLETED: 'completed', DRAFT: 'draft', CANCELED: 'archived', PENDING_DELETION: 'archived',
}

const OBJECTIVE: Record<string, RemoteCampaign['objective']> = {
  BRAND_AWARENESS: 'awareness', WEBSITE_VISIT: 'traffic', ENGAGEMENT: 'engagement',
  VIDEO_VIEW: 'video_views', LEAD_GENERATION: 'leads', WEBSITE_CONVERSION: 'conversions',
  JOB_APPLICANT: 'leads', TALENT_LEAD: 'leads',
}

const REVIEW: Record<string, RemoteCreative['reviewStatus']> = {
  APPROVED: 'approved', UNDER_REVIEW: 'under_review', REJECTED: 'disapproved',
  PENDING: 'under_review', DRAFT: 'not_submitted',
}

const AUDIENCE_TYPE: Record<string, RemoteAudience['audienceType']> = {
  USER: 'crm_list', COMPANY: 'crm_list', WEBSITE: 'website_visitors',
  LOOKALIKE: 'lookalike', VIDEO: 'video_viewers', ENGAGEMENT: 'engagers',
}

export const linkedinAdapter: Adapter = {
  provider: 'linkedin',

  async listAccounts(ctx) {
    type Row = { id: number; name: string; currency: string; status: string }
    const rows = await listAll<Row>(ctx, '/adAccounts', { q: 'search' })
    return rows.map(row => ({
      externalId: String(row.id),
      name: row.name ?? `Account ${row.id}`,
      currency: row.currency ?? 'USD',
      // LinkedIn reports in UTC and does not expose an account timezone here.
      timezone: 'UTC',
      status: row.status === 'ACTIVE' ? 'active' : row.status === 'CANCELED' ? 'closed' : 'paused',
    }))
  },

  async listCampaigns(ctx, accountExternalId) {
    type Row = {
      id: number; name: string; status: string; objectiveType?: string
      totalBudget?: { amount: string; currencyCode: string }
      runSchedule?: { start?: number; end?: number }
    }
    const rows = await listAll<Row>(ctx, `/adAccounts/${accountExternalId}/adCampaignGroups`, { q: 'search' })
    return rows.map(row => ({
      externalId: String(row.id),
      accountExternalId,
      name: row.name,
      objective: OBJECTIVE[row.objectiveType ?? ''] ?? 'conversions',
      status: STATUS[row.status] ?? 'draft',
      budgetAmount: money(row.totalBudget?.amount),
      budgetType: row.totalBudget ? 'lifetime' : null,
      buyingType: null,
      startsAt: row.runSchedule?.start ? new Date(row.runSchedule.start).toISOString() : null,
      endsAt: row.runSchedule?.end ? new Date(row.runSchedule.end).toISOString() : null,
    }))
  },

  async listAdSets(ctx, accountExternalId) {
    type Row = {
      id: number; name: string; status: string; campaignGroup?: string
      dailyBudget?: { amount: string }; totalBudget?: { amount: string }
      optimizationTargetType?: string; runSchedule?: { start?: number; end?: number }
    }
    const rows = await listAll<Row>(ctx, `/adAccounts/${accountExternalId}/adCampaigns`, { q: 'search' })
    return rows.map(row => ({
      externalId: String(row.id),
      campaignExternalId: urnId(row.campaignGroup),
      name: row.name,
      status: STATUS[row.status] ?? 'draft',
      budgetAmount: money(row.dailyBudget?.amount ?? row.totalBudget?.amount),
      budgetType: row.dailyBudget ? 'daily' : row.totalBudget ? 'lifetime' : null,
      optimisationGoal: row.optimizationTargetType ?? null,
      startsAt: row.runSchedule?.start ? new Date(row.runSchedule.start).toISOString() : null,
      endsAt: row.runSchedule?.end ? new Date(row.runSchedule.end).toISOString() : null,
    }))
  },

  async listCreatives(ctx, accountExternalId) {
    type Row = {
      id: string; campaign?: string; intendedStatus?: string
      review?: { status?: string; rejectionReasons?: string[] }
      content?: { reference?: string; textAd?: { headline?: string; description?: string } }
      createdAt?: number
    }
    const rows = await listAll<Row>(ctx, `/adAccounts/${accountExternalId}/creatives`, { q: 'criteria' })
    return rows.map(row => ({
      externalId: urnId(row.id) || row.id,
      campaignExternalId: null,
      adSetExternalId: urnId(row.campaign),
      name: row.content?.textAd?.headline ?? `Creative ${urnId(row.id)}`,
      // The read API does not expose the underlying asset type reliably.
      format: 'display' as const,
      status: row.intendedStatus === 'ACTIVE' ? 'active' : row.intendedStatus === 'PAUSED' ? 'paused' : 'draft',
      reviewStatus: REVIEW[row.review?.status ?? ''] ?? 'under_review',
      providerFeedback: row.review?.rejectionReasons?.join(', ') ?? null,
      thumbnailUrl: null,
      aspectRatio: null,
      durationSeconds: null,
      headline: row.content?.textAd?.headline ?? null,
      bodyText: row.content?.textAd?.description ?? null,
      destinationUrl: null,
    }))
  },

  async listAudiences(ctx, accountExternalId) {
    type Row = {
      id: string; name: string; type?: string; destinations?: unknown[]
      audienceSize?: number; status?: string; created?: number; lastModified?: number
    }
    const rows = await listAll<Row>(ctx, '/dmpSegments', {
      q: 'account', account: `urn:li:sponsoredAccount:${accountExternalId}`,
    })
    return rows.map(row => ({
      externalId: urnId(row.id) || row.id,
      name: row.name,
      audienceType: AUDIENCE_TYPE[row.type ?? ''] ?? 'custom',
      description: null,
      sizeEstimate: row.audienceSize ?? null,
      matchedUsers: row.audienceSize ?? null,
      matchRate: null,
      recencyDays: null,
      status: row.status === 'READY' ? 'ready' : 'review',
      lastRefreshedAt: row.lastModified ? new Date(row.lastModified).toISOString() : null,
    }))
  },

  async getInsights(ctx, request: InsightRequest) {
    const pivot = {
      account: 'ACCOUNT', campaign: 'CAMPAIGN_GROUP', ad_set: 'CAMPAIGN',
      creative: 'CREATIVE', audience: 'CAMPAIGN',
    }[request.level]

    const [sy, sm, sd] = request.since.split('-').map(Number)
    const [ey, em, ed] = request.until.split('-').map(Number)
    const range = `(start:(year:${sy},month:${sm},day:${sd}),end:(year:${ey},month:${em},day:${ed}))`

    type Row = {
      dateRange?: { start?: { year: number; month: number; day: number } }
      pivotValues?: string[]
      costInLocalCurrency?: string; impressions?: number; clicks?: number
      externalWebsiteConversions?: number; conversionValueInLocalCurrency?: string
      videoViews?: number; videoFirstQuartileCompletions?: number
      likes?: number; comments?: number; shares?: number
    }
    const response = await providerFetch<Element<Row>>(ctx, {
      path: '/adAnalytics',
      headers: linkedinHeaders(ctx),
      query: {
        q: 'analytics', pivot, timeGranularity: 'DAILY', dateRange: range,
        accounts: `List(urn:li:sponsoredAccount:${request.accountExternalId})`,
        fields: 'dateRange,pivotValues,costInLocalCurrency,impressions,clicks,' +
          'externalWebsiteConversions,conversionValueInLocalCurrency,videoViews,' +
          'videoFirstQuartileCompletions,likes,comments,shares',
      },
    })

    return (response.elements ?? []).map(row => {
      const start = row.dateRange?.start
      const date = start
        ? `${start.year}-${String(start.month).padStart(2, '0')}-${String(start.day).padStart(2, '0')}`
        : dayString(null)
      return {
        entityType: request.level,
        entityExternalId: urnId(row.pivotValues?.[0]) || request.accountExternalId,
        date,
        currency: ctx.extras.currency ?? 'USD',
        attributionWindow: request.attributionWindow,
        spend: count(row.costInLocalCurrency),
        impressions: count(row.impressions),
        // LinkedIn does not report deduplicated reach.
        reach: 0,
        clicks: count(row.clicks),
        conversions: count(row.externalWebsiteConversions),
        revenue: count(row.conversionValueInLocalCurrency),
        videoViews: count(row.videoViews),
        video3sViews: 0,
        engagements: count(row.likes) + count(row.comments) + count(row.shares),
        isEstimated: false,
      }
    })
  },

  async setCampaignStatus(ctx, campaignExternalId, status) {
    const accountId = ctx.extras.account_id
    if (!accountId) throw new Error('LinkedIn campaign updates need the owning account id.')
    await providerFetch(ctx, {
      method: 'POST',
      path: `/adAccounts/${accountId}/adCampaignGroups/${campaignExternalId}`,
      headers: { ...linkedinHeaders(ctx), 'X-RestLi-Method': 'PARTIAL_UPDATE' },
      body: { patch: { $set: { status: status === 'active' ? 'ACTIVE' : 'PAUSED' } } },
    })
  },
}

export const __linkedinInternals = { urnId, isoDate }
