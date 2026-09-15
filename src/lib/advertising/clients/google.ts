import 'server-only'
import { providerFetch, money, count, isoDate, dayString } from './http'
import type {
  Adapter, AdapterContext, InsightRequest, RemoteAccount, RemoteAdSet,
  RemoteAudience, RemoteCampaign, RemoteCreative, RemoteInsight,
} from './types'

// Google Ads API v18 (REST + GAQL).
// Docs: https://developers.google.com/google-ads/api/docs/start
//
// Every read goes through searchStream with a GAQL query. Money arrives in
// micros (1,000,000 micros = one unit of the account currency).

type GaqlRow = Record<string, Record<string, unknown> | undefined>
type SearchResponse = { results?: GaqlRow[]; nextPageToken?: string }

const micros = (value: unknown): number | null => {
  const raw = money(value)
  return raw === null ? null : raw / 1_000_000
}
const microsRequired = (value: unknown): number => micros(value) ?? 0

function headers(ctx: AdapterContext): Record<string, string> {
  const out: Record<string, string> = {
    'developer-token': ctx.extras.developer_token ?? '',
  }
  if (ctx.extras.login_customer_id) {
    out['login-customer-id'] = ctx.extras.login_customer_id.replace(/-/g, '')
  }
  return out
}

/** Runs a GAQL query against one customer, following page tokens. */
async function search(ctx: AdapterContext, customerId: string, query: string): Promise<GaqlRow[]> {
  const id = customerId.replace(/-/g, '')
  const rows: GaqlRow[] = []
  let pageToken: string | undefined

  for (let page = 0; page < 50; page += 1) {
    const response = await providerFetch<SearchResponse>(ctx, {
      method: 'POST',
      path: `/customers/${id}/googleAds:search`,
      headers: headers(ctx),
      body: { query, pageSize: 10_000, ...(pageToken ? { pageToken } : {}) },
    })
    rows.push(...(response.results ?? []))
    if (!response.nextPageToken) break
    pageToken = response.nextPageToken
  }
  return rows
}

const field = (row: GaqlRow, group: string, key: string): unknown => row[group]?.[key]

const CHANNEL_OBJECTIVE: Record<string, RemoteCampaign['objective']> = {
  SEARCH: 'traffic', SHOPPING: 'sales', DISPLAY: 'awareness',
  VIDEO: 'video_views', PERFORMANCE_MAX: 'sales', DEMAND_GEN: 'awareness',
  MULTI_CHANNEL: 'app_installs', LOCAL: 'traffic', SMART: 'conversions',
}

const CAMPAIGN_STATUS: Record<string, RemoteCampaign['status']> = {
  ENABLED: 'active', PAUSED: 'paused', REMOVED: 'archived', UNKNOWN: 'draft',
}

const REVIEW: Record<string, RemoteCreative['reviewStatus']> = {
  APPROVED: 'approved', APPROVED_LIMITED: 'approved', AREA_OF_INTEREST_ONLY: 'approved',
  DISAPPROVED: 'disapproved', UNDER_REVIEW: 'under_review', ELIGIBLE_MAY_SERVE: 'approved',
}

const AD_FORMAT: Record<string, RemoteCreative['format']> = {
  RESPONSIVE_SEARCH_AD: 'text', EXPANDED_TEXT_AD: 'text', TEXT_AD: 'text',
  RESPONSIVE_DISPLAY_AD: 'display', IMAGE_AD: 'image',
  VIDEO_AD: 'video', VIDEO_RESPONSIVE_AD: 'video',
  SHOPPING_PRODUCT_AD: 'display', DISCOVERY_CAROUSEL_AD: 'carousel',
  DEMAND_GEN_CAROUSEL_AD: 'carousel', APP_AD: 'display',
}

const AUDIENCE_TYPE: Record<string, RemoteAudience['audienceType']> = {
  REMARKETING: 'website_visitors', SIMILAR: 'lookalike', CRM_BASED: 'crm_list',
  LOGICAL: 'custom', RULE_BASED: 'website_visitors', EXTERNAL_REMARKETING: 'website_visitors',
  YOUTUBE_USERS: 'video_viewers', MOBILE_APP_CATEGORY: 'app_users',
}

export const googleAdapter: Adapter = {
  provider: 'google',

  async listAccounts(ctx) {
    // listAccessibleCustomers returns resource names only, so each accessible
    // customer is then described through the manager account.
    const listed = await providerFetch<{ resourceNames?: string[] }>(ctx, {
      path: '/customers:listAccessibleCustomers',
      headers: headers(ctx),
    })
    const ids = (listed.resourceNames ?? []).map(name => name.split('/').pop() ?? '').filter(Boolean)
    const accounts: RemoteAccount[] = []

    for (const id of ids) {
      try {
        const rows = await search(ctx, id, `
          SELECT customer.id, customer.descriptive_name, customer.currency_code,
                 customer.time_zone, customer.status, customer.manager
          FROM customer LIMIT 1`)
        const row = rows[0]
        if (!row) continue
        // Manager accounts hold no spend of their own.
        if (field(row, 'customer', 'manager') === true) continue
        accounts.push({
          externalId: String(field(row, 'customer', 'id') ?? id),
          name: String(field(row, 'customer', 'descriptiveName') ?? `Account ${id}`),
          currency: String(field(row, 'customer', 'currencyCode') ?? 'USD'),
          timezone: String(field(row, 'customer', 'timeZone') ?? 'UTC'),
          status: field(row, 'customer', 'status') === 'ENABLED' ? 'active'
            : field(row, 'customer', 'status') === 'CANCELED' ? 'closed' : 'paused',
        })
      } catch {
        // A customer the token cannot describe is skipped rather than failing
        // the whole account list.
        continue
      }
    }
    return accounts
  },

  async listCampaigns(ctx, accountExternalId) {
    const rows = await search(ctx, accountExternalId, `
      SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
             campaign.start_date, campaign.end_date, campaign.bidding_strategy_type,
             campaign_budget.amount_micros, campaign_budget.total_amount_micros,
             campaign_budget.explicitly_shared
      FROM campaign
      WHERE campaign.status != 'REMOVED'`)

    return rows.map(row => {
      const daily = micros(field(row, 'campaignBudget', 'amountMicros'))
      const lifetime = micros(field(row, 'campaignBudget', 'totalAmountMicros'))
      return {
        externalId: String(field(row, 'campaign', 'id')),
        accountExternalId,
        name: String(field(row, 'campaign', 'name') ?? ''),
        objective: CHANNEL_OBJECTIVE[String(field(row, 'campaign', 'advertisingChannelType'))] ?? 'conversions',
        status: CAMPAIGN_STATUS[String(field(row, 'campaign', 'status'))] ?? 'draft',
        budgetAmount: daily ?? lifetime,
        budgetType: daily !== null ? 'daily' : lifetime !== null ? 'lifetime' : null,
        buyingType: (field(row, 'campaign', 'biddingStrategyType') as string) ?? null,
        startsAt: isoDate(field(row, 'campaign', 'startDate')),
        endsAt: isoDate(field(row, 'campaign', 'endDate')),
      }
    })
  },

  async listAdSets(ctx, accountExternalId) {
    // Google ad groups map onto Caption Fox ad sets.
    const rows = await search(ctx, accountExternalId, `
      SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.campaign,
             ad_group.cpc_bid_micros, ad_group.type
      FROM ad_group
      WHERE ad_group.status != 'REMOVED'`)

    return rows.map(row => ({
      externalId: String(field(row, 'adGroup', 'id')),
      campaignExternalId: String(field(row, 'adGroup', 'campaign') ?? '').split('/').pop() ?? '',
      name: String(field(row, 'adGroup', 'name') ?? ''),
      status: CAMPAIGN_STATUS[String(field(row, 'adGroup', 'status'))] ?? 'draft',
      budgetAmount: micros(field(row, 'adGroup', 'cpcBidMicros')),
      budgetType: null,
      optimisationGoal: (field(row, 'adGroup', 'type') as string) ?? null,
      startsAt: null,
      endsAt: null,
    })) as RemoteAdSet[]
  },

  async listCreatives(ctx, accountExternalId) {
    const rows = await search(ctx, accountExternalId, `
      SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type,
             ad_group_ad.ad.final_urls, ad_group_ad.status,
             ad_group_ad.policy_summary.approval_status,
             ad_group_ad.policy_summary.policy_topic_entries,
             ad_group_ad.ad.responsive_search_ad.headlines,
             ad_group_ad.ad.responsive_search_ad.descriptions,
             ad_group.id, campaign.id
      FROM ad_group_ad
      WHERE ad_group_ad.status != 'REMOVED'`)

    return rows.map(row => {
      const ad = row.adGroupAd?.ad as Record<string, unknown> | undefined
      const policy = row.adGroupAd?.policySummary as Record<string, unknown> | undefined
      const topics = Array.isArray(policy?.policyTopicEntries) ? policy.policyTopicEntries as { topic?: string }[] : []
      const rsa = ad?.responsiveSearchAd as { headlines?: { text?: string }[]; descriptions?: { text?: string }[] } | undefined
      const urls = Array.isArray(ad?.finalUrls) ? ad.finalUrls as string[] : []
      return {
        externalId: String(ad?.id ?? ''),
        campaignExternalId: String(field(row, 'campaign', 'id') ?? '') || null,
        adSetExternalId: String(field(row, 'adGroup', 'id') ?? '') || null,
        name: String(ad?.name ?? rsa?.headlines?.[0]?.text ?? `Ad ${ad?.id ?? ''}`),
        format: AD_FORMAT[String(ad?.type)] ?? 'display',
        status: field(row, 'adGroupAd', 'status') === 'ENABLED' ? 'active'
          : field(row, 'adGroupAd', 'status') === 'PAUSED' ? 'paused' : 'draft',
        reviewStatus: REVIEW[String(policy?.approvalStatus)] ?? 'under_review',
        providerFeedback: topics.length > 0 ? topics.map(t => t.topic).filter(Boolean).join(', ').slice(0, 500) : null,
        thumbnailUrl: null,
        aspectRatio: null,
        durationSeconds: null,
        headline: rsa?.headlines?.[0]?.text ?? null,
        bodyText: rsa?.descriptions?.[0]?.text ?? null,
        destinationUrl: urls[0] ?? null,
      }
    }) as RemoteCreative[]
  },

  async listAudiences(ctx, accountExternalId) {
    const rows = await search(ctx, accountExternalId, `
      SELECT user_list.id, user_list.name, user_list.description, user_list.type,
             user_list.size_for_display, user_list.size_for_search,
             user_list.membership_life_span, user_list.membership_status
      FROM user_list`)

    return rows.map(row => {
      const display = count(field(row, 'userList', 'sizeForDisplay'))
      const searchSize = count(field(row, 'userList', 'sizeForSearch'))
      return {
        externalId: String(field(row, 'userList', 'id')),
        name: String(field(row, 'userList', 'name') ?? ''),
        audienceType: AUDIENCE_TYPE[String(field(row, 'userList', 'type'))] ?? 'custom',
        description: (field(row, 'userList', 'description') as string) ?? null,
        sizeEstimate: Math.max(display, searchSize) || null,
        matchedUsers: Math.max(display, searchSize) || null,
        matchRate: null,
        recencyDays: count(field(row, 'userList', 'membershipLifeSpan')) || null,
        status: field(row, 'userList', 'membershipStatus') === 'OPEN' ? 'ready' : 'paused',
        lastRefreshedAt: null,
      }
    }) as RemoteAudience[]
  },

  async getInsights(ctx, request: InsightRequest) {
    const resource = {
      account: 'customer', campaign: 'campaign', ad_set: 'ad_group',
      creative: 'ad_group_ad', audience: 'campaign_audience_view',
    }[request.level]

    const idField = {
      account: 'customer.id', campaign: 'campaign.id', ad_set: 'ad_group.id',
      creative: 'ad_group_ad.ad.id', audience: 'campaign.id',
    }[request.level]

    const rows = await search(ctx, request.accountExternalId, `
      SELECT ${idField}, segments.date, customer.currency_code,
             metrics.cost_micros, metrics.impressions, metrics.clicks,
             metrics.conversions, metrics.conversions_value,
             metrics.video_views, metrics.engagements
      FROM ${resource}
      WHERE segments.date BETWEEN '${request.since}' AND '${request.until}'`)

    const [group, key] = idField.split('.').slice(0, 2)
    return rows.map(row => ({
      entityType: request.level,
      entityExternalId: String(
        request.level === 'creative'
          ? (row.adGroupAd?.ad as Record<string, unknown> | undefined)?.id ?? ''
          : field(row, camel(group), camel(key)) ?? request.accountExternalId,
      ),
      date: dayString(field(row, 'segments', 'date')),
      currency: String(field(row, 'customer', 'currencyCode') ?? 'USD'),
      attributionWindow: request.attributionWindow,
      spend: microsRequired(field(row, 'metrics', 'costMicros')),
      impressions: count(field(row, 'metrics', 'impressions')),
      // Google Ads does not report deduplicated reach on these resources.
      reach: 0,
      clicks: count(field(row, 'metrics', 'clicks')),
      conversions: count(field(row, 'metrics', 'conversions')),
      revenue: count(field(row, 'metrics', 'conversionsValue')),
      videoViews: count(field(row, 'metrics', 'videoViews')),
      video3sViews: 0,
      engagements: count(field(row, 'metrics', 'engagements')),
      // Google conversions are modelled when consent mode is active.
      isEstimated: true,
    })) as RemoteInsight[]
  },

  async setCampaignStatus(ctx, campaignExternalId, status) {
    const customerId = ctx.extras.customer_id?.replace(/-/g, '')
    if (!customerId) throw new Error('Google Ads campaign updates need the owning customer id.')
    await providerFetch(ctx, {
      method: 'POST',
      path: `/customers/${customerId}/campaigns:mutate`,
      headers: headers(ctx),
      body: {
        operations: [{
          update: {
            resourceName: `customers/${customerId}/campaigns/${campaignExternalId}`,
            status: status === 'active' ? 'ENABLED' : 'PAUSED',
          },
          updateMask: 'status',
        }],
      },
    })
  },
}

/** GAQL responses use camelCase group keys; the query uses snake_case. */
function camel(value: string): string {
  return value.replace(/_([a-z])/g, (_, character: string) => character.toUpperCase())
}
