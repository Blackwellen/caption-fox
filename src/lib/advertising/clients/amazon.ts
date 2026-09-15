import 'server-only'
import { providerFetch, money, count, isoDate, dayString } from './http'
import { ProviderApiError, type Adapter, type AdapterContext, type InsightRequest, type RemoteCampaign, type RemoteInsight } from './types'

// Amazon Ads API (Sponsored Products v3 + Reporting v3).
// Docs: https://advertising.amazon.com/API/docs/en-us/
//
// Amazon requires two headers on every call: the LWA client id and the profile
// scope. Profiles are per marketplace, so one connection can surface several
// "accounts" in Caption Fox terms.

function amazonHeaders(ctx: AdapterContext, profileId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Amazon-Advertising-API-ClientId': ctx.extras.client_id ?? '',
  }
  if (profileId) headers['Amazon-Advertising-API-Scope'] = profileId
  return headers
}

const STATUS: Record<string, RemoteCampaign['status']> = {
  ENABLED: 'active', PAUSED: 'paused', ARCHIVED: 'archived', DRAFT: 'draft',
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const amazonAdapter: Adapter = {
  provider: 'amazon',

  async listAccounts(ctx) {
    type Row = {
      profileId: number; countryCode: string; currencyCode: string; timezone: string
      accountInfo?: { name?: string; type?: string; id?: string }
    }
    const rows = await providerFetch<Row[]>(ctx, { path: '/v2/profiles', headers: amazonHeaders(ctx) })
    return (rows ?? []).map(row => ({
      externalId: String(row.profileId),
      name: row.accountInfo?.name
        ? `${row.accountInfo.name} (${row.countryCode})`
        : `Profile ${row.profileId} (${row.countryCode})`,
      currency: row.currencyCode ?? 'USD',
      timezone: row.timezone ?? 'UTC',
      status: 'active' as const,
    }))
  },

  async listCampaigns(ctx, accountExternalId) {
    type Row = {
      campaignId: string; name: string; state: string; targetingType?: string
      budget?: { budget?: number; budgetType?: string }
      startDate?: string; endDate?: string
    }
    const response = await providerFetch<{ campaigns?: Row[] }>(ctx, {
      method: 'POST',
      path: '/sp/campaigns/list',
      headers: {
        ...amazonHeaders(ctx, accountExternalId),
        'Content-Type': 'application/vnd.spCampaign.v3+json',
        Accept: 'application/vnd.spCampaign.v3+json',
      },
      body: { maxResults: 500, stateFilter: { include: ['ENABLED', 'PAUSED', 'ARCHIVED'] } },
    })
    return (response.campaigns ?? []).map(row => ({
      externalId: String(row.campaignId),
      accountExternalId,
      name: row.name,
      // Sponsored Products is a retail sales format by definition.
      objective: 'sales' as const,
      status: STATUS[row.state] ?? 'draft',
      budgetAmount: money(row.budget?.budget),
      budgetType: row.budget?.budgetType === 'DAILY' ? 'daily' as const : 'lifetime' as const,
      buyingType: row.targetingType ?? null,
      startsAt: isoDate(row.startDate),
      endsAt: isoDate(row.endDate),
    }))
  },

  async listAdSets(ctx, accountExternalId) {
    type Row = { adGroupId: string; campaignId: string; name: string; state: string; defaultBid?: number }
    const response = await providerFetch<{ adGroups?: Row[] }>(ctx, {
      method: 'POST',
      path: '/sp/adGroups/list',
      headers: {
        ...amazonHeaders(ctx, accountExternalId),
        'Content-Type': 'application/vnd.spAdGroup.v3+json',
        Accept: 'application/vnd.spAdGroup.v3+json',
      },
      body: { maxResults: 500 },
    })
    return (response.adGroups ?? []).map(row => ({
      externalId: String(row.adGroupId),
      campaignExternalId: String(row.campaignId),
      name: row.name,
      status: STATUS[row.state] ?? 'draft',
      budgetAmount: money(row.defaultBid),
      budgetType: null,
      optimisationGoal: null,
      startsAt: null,
      endsAt: null,
    }))
  },

  async listCreatives(ctx, accountExternalId) {
    type Row = { adId: string; adGroupId: string; campaignId: string; state: string; asin?: string; sku?: string }
    const response = await providerFetch<{ productAds?: Row[] }>(ctx, {
      method: 'POST',
      path: '/sp/productAds/list',
      headers: {
        ...amazonHeaders(ctx, accountExternalId),
        'Content-Type': 'application/vnd.spProductAd.v3+json',
        Accept: 'application/vnd.spProductAd.v3+json',
      },
      body: { maxResults: 500 },
    })
    return (response.productAds ?? []).map(row => ({
      externalId: String(row.adId),
      campaignExternalId: String(row.campaignId),
      adSetExternalId: String(row.adGroupId),
      name: row.asin ? `ASIN ${row.asin}` : row.sku ? `SKU ${row.sku}` : `Ad ${row.adId}`,
      // Sponsored Products renders the retail listing; there is no uploaded asset.
      format: 'display' as const,
      status: STATUS[row.state] === 'active' ? 'active' as const
        : STATUS[row.state] === 'paused' ? 'paused' as const : 'archived' as const,
      reviewStatus: 'approved' as const,
      providerFeedback: null,
      thumbnailUrl: null,
      aspectRatio: null,
      durationSeconds: null,
      headline: null,
      bodyText: null,
      destinationUrl: row.asin ? `https://www.amazon.com/dp/${row.asin}` : null,
    }))
  },

  /** Amazon Ads has no audience read API on Sponsored Products. */
  async listAudiences() {
    return []
  },

  async getInsights(ctx, request: InsightRequest) {
    const groupBy = {
      account: 'campaign', campaign: 'campaign', ad_set: 'adGroup',
      creative: 'advertiser', audience: 'campaign',
    }[request.level]

    const idColumn = {
      account: 'campaignId', campaign: 'campaignId', ad_set: 'adGroupId',
      creative: 'adId', audience: 'campaignId',
    }[request.level]

    // Reporting v3 is asynchronous: request, poll, then download.
    const created = await providerFetch<{ reportId?: string }>(ctx, {
      method: 'POST',
      path: '/reporting/reports',
      headers: {
        ...amazonHeaders(ctx, request.accountExternalId),
        'Content-Type': 'application/vnd.createasyncreportrequest.v3+json',
      },
      body: {
        startDate: request.since,
        endDate: request.until,
        configuration: {
          adProduct: 'SPONSORED_PRODUCTS',
          groupBy: [groupBy],
          columns: [idColumn, 'date', 'cost', 'impressions', 'clicks', 'purchases30d', 'sales30d'],
          reportTypeId: 'spCampaigns',
          timeUnit: 'DAILY',
          format: 'GZIP_JSON',
        },
      },
    })

    if (!created.reportId) {
      throw new ProviderApiError('Amazon did not return a report id.', 'amazon', 502, true, 'amazon-report')
    }

    // Poll with a bounded budget so a stuck report cannot hang the sync worker.
    let downloadUrl: string | null = null
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await sleep(3_000)
      const status = await providerFetch<{ status?: string; url?: string }>(ctx, {
        path: `/reporting/reports/${created.reportId}`,
        headers: amazonHeaders(ctx, request.accountExternalId),
      })
      if (status.status === 'COMPLETED' && status.url) { downloadUrl = status.url; break }
      if (status.status === 'FAILED') {
        throw new ProviderApiError('Amazon could not generate the report.', 'amazon', 502, true, 'amazon-report')
      }
    }
    if (!downloadUrl) {
      throw new ProviderApiError('Amazon report timed out. The sync will retry.', 'amazon', 504, true, 'amazon-report')
    }

    // The signed download is pre-authenticated, so no auth header is sent.
    const download = await fetch(downloadUrl)
    if (!download.ok) {
      throw new ProviderApiError('Could not download the Amazon report.', 'amazon', download.status, true, 'amazon-report')
    }
    const decompressed = download.body?.pipeThrough(new DecompressionStream('gzip'))
    const text = decompressed ? await new Response(decompressed).text() : await download.text()

    let rows: Record<string, unknown>[] = []
    try { rows = JSON.parse(text) as Record<string, unknown>[] } catch { rows = [] }

    return rows.map(row => ({
      entityType: request.level,
      entityExternalId: String(row[idColumn] ?? request.accountExternalId),
      date: dayString(row.date),
      currency: ctx.extras.currency ?? 'USD',
      attributionWindow: request.attributionWindow,
      spend: count(row.cost),
      impressions: count(row.impressions),
      reach: 0,
      clicks: count(row.clicks),
      conversions: count(row.purchases30d),
      revenue: count(row.sales30d),
      videoViews: 0,
      video3sViews: 0,
      engagements: 0,
      // Amazon attributes on a fixed 30-day window regardless of the request.
      isEstimated: true,
    })) as RemoteInsight[]
  },

  async setCampaignStatus(ctx, campaignExternalId, status) {
    const profileId = ctx.extras.account_id
    if (!profileId) throw new Error('Amazon campaign updates need the owning profile id.')
    await providerFetch(ctx, {
      method: 'PUT',
      path: '/sp/campaigns',
      headers: {
        ...amazonHeaders(ctx, profileId),
        'Content-Type': 'application/vnd.spCampaign.v3+json',
      },
      body: { campaigns: [{ campaignId: campaignExternalId, state: status === 'active' ? 'ENABLED' : 'PAUSED' }] },
    })
  },
}
