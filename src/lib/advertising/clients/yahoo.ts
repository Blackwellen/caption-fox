import 'server-only'
import { providerFetch, money, count, isoDate, dayString } from './http'
import { ProviderApiError, type Adapter, type AdapterContext, type InsightRequest, type RemoteCampaign, type RemoteInsight } from './types'

// Yahoo DSP Traffic and Reporting APIs.
// Docs: https://developer.yahooinc.com/dsp/api/docs/
//
// Traffic endpoints are offset-paginated with page/limit. Reporting is
// asynchronous: submit a job, poll for the job, then download a CSV.

type Envelope<T> = { response?: T[]; errors?: unknown; timestamp?: string }

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function listAll<T>(ctx: AdapterContext, path: string, query: Record<string, string | number> = {}): Promise<T[]> {
  const items: T[] = []
  const limit = 100
  for (let page = 1; page <= 50; page += 1) {
    const response = await providerFetch<Envelope<T>>(ctx, { path, query: { ...query, page, limit } })
    const batch = response.response ?? []
    items.push(...batch)
    if (batch.length < limit) break
  }
  return items
}

const STATUS: Record<string, RemoteCampaign['status']> = {
  ACTIVE: 'active', PAUSED: 'paused', DELETED: 'archived', ENDED: 'completed', DRAFT: 'draft',
}

const OBJECTIVE: Record<string, RemoteCampaign['objective']> = {
  AWARENESS: 'awareness', CONSIDERATION: 'traffic', CONVERSION: 'conversions',
  PERFORMANCE: 'conversions', VIDEO: 'video_views', APP_INSTALL: 'app_installs',
}

export const yahooAdapter: Adapter = {
  provider: 'yahoo',

  async listAccounts(ctx) {
    type Row = { id: number; advertiserName?: string; name?: string; currency?: string; timezone?: string; status?: string }
    const rows = await listAll<Row>(ctx, '/adv')
    return rows.map(row => ({
      externalId: String(row.id),
      name: row.advertiserName ?? row.name ?? `Advertiser ${row.id}`,
      currency: row.currency ?? 'USD',
      timezone: row.timezone ?? 'UTC',
      status: row.status === 'ACTIVE' ? 'active' as const : 'paused' as const,
    }))
  },

  async listCampaigns(ctx, accountExternalId) {
    type Row = {
      id: number; name: string; status: string; advertiserId: number
      budget?: number; budgetType?: string; objective?: string
      startDate?: string; endDate?: string
    }
    const rows = await listAll<Row>(ctx, '/campaign', { advertiserId: accountExternalId })
    return rows.map(row => ({
      externalId: String(row.id),
      accountExternalId,
      name: row.name,
      objective: OBJECTIVE[row.objective ?? ''] ?? 'conversions',
      status: STATUS[row.status] ?? 'draft',
      budgetAmount: money(row.budget),
      budgetType: row.budgetType === 'LIFETIME' ? 'lifetime' as const : 'daily' as const,
      buyingType: null,
      startsAt: isoDate(row.startDate),
      endsAt: isoDate(row.endDate),
    }))
  },

  async listAdSets(ctx, accountExternalId) {
    // Yahoo calls ad sets "lines"; they hang off a campaign.
    type Row = {
      id: number; campaignId: number; name: string; status: string
      budget?: number; budgetType?: string; bidStrategy?: string
      startDate?: string; endDate?: string
    }
    const rows = await listAll<Row>(ctx, '/line', { advertiserId: accountExternalId })
    return rows.map(row => ({
      externalId: String(row.id),
      campaignExternalId: String(row.campaignId),
      name: row.name,
      status: STATUS[row.status] ?? 'draft',
      budgetAmount: money(row.budget),
      budgetType: row.budgetType === 'LIFETIME' ? 'lifetime' as const : 'daily' as const,
      optimisationGoal: row.bidStrategy ?? null,
      startsAt: isoDate(row.startDate),
      endsAt: isoDate(row.endDate),
    }))
  },

  async listCreatives(ctx, accountExternalId) {
    type Row = {
      id: number; lineId: number; name: string; status: string
      adFormat?: string; landingUrl?: string; title?: string; description?: string
      reviewStatus?: string; disapprovalReasons?: string[]
    }
    const rows = await listAll<Row>(ctx, '/ad', { advertiserId: accountExternalId })
    return rows.map(row => ({
      externalId: String(row.id),
      campaignExternalId: null,
      adSetExternalId: String(row.lineId),
      name: row.name ?? row.title ?? `Ad ${row.id}`,
      format: row.adFormat === 'VIDEO' ? 'video' as const
        : row.adFormat === 'CAROUSEL' ? 'carousel' as const
          : row.adFormat === 'NATIVE' ? 'display' as const : 'image' as const,
      status: STATUS[row.status] === 'active' ? 'active' as const
        : STATUS[row.status] === 'paused' ? 'paused' as const : 'draft' as const,
      reviewStatus: row.reviewStatus === 'APPROVED' ? 'approved' as const
        : row.reviewStatus === 'REJECTED' ? 'disapproved' as const : 'under_review' as const,
      providerFeedback: row.disapprovalReasons?.join(', ') ?? null,
      thumbnailUrl: null,
      aspectRatio: null,
      durationSeconds: null,
      headline: row.title ?? null,
      bodyText: row.description ?? null,
      destinationUrl: row.landingUrl ?? null,
    }))
  },

  /** Yahoo DSP audience segments sit behind a separate entitlement. */
  async listAudiences() {
    return []
  },

  async getInsights(ctx, request: InsightRequest) {
    const dimension = {
      account: 'Advertiser ID', campaign: 'Campaign ID',
      ad_set: 'Line ID', creative: 'Ad ID', audience: 'Campaign ID',
    }[request.level]

    const submitted = await providerFetch<{ response?: { jobId?: string; status?: string } }>(ctx, {
      method: 'POST',
      path: '/reports/custom',
      body: {
        reportOption: {
          timezone: 'UTC',
          currency: 1,
          accountIds: [Number(request.accountExternalId)],
        },
        cube: 'performance_stats',
        dimensionTypeIds: [dimension],
        metricTypeIds: ['Impressions', 'Clicks', 'Spend', 'Conversions', 'Total Conversion Value'],
        filters: [
          { field: 'Advertiser ID', operator: '=', value: Number(request.accountExternalId) },
          { field: 'Day', operator: 'between', from: request.since, to: request.until },
        ],
      },
    })

    const jobId = submitted.response?.jobId
    if (!jobId) {
      throw new ProviderApiError('Yahoo did not return a report job id.', 'yahoo', 502, true, 'yahoo-report')
    }

    let downloadUrl: string | null = null
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await sleep(3_000)
      const status = await providerFetch<{ response?: { status?: string; jobResponse?: string } }>(ctx, {
        path: `/reports/custom/${jobId}`,
        query: { advertiserId: request.accountExternalId },
      })
      if (status.response?.status === 'completed' && status.response.jobResponse) {
        downloadUrl = status.response.jobResponse
        break
      }
      if (status.response?.status === 'failed') {
        throw new ProviderApiError('Yahoo could not generate the report.', 'yahoo', 502, true, 'yahoo-report')
      }
    }
    if (!downloadUrl) {
      throw new ProviderApiError('Yahoo report timed out. The sync will retry.', 'yahoo', 504, true, 'yahoo-report')
    }

    const download = await fetch(downloadUrl)
    if (!download.ok) {
      throw new ProviderApiError('Could not download the Yahoo report.', 'yahoo', download.status, true, 'yahoo-report')
    }
    return parseCsv(await download.text(), request, ctx.extras.currency ?? 'USD', dimension)
  },

  async setCampaignStatus(ctx, campaignExternalId, status) {
    await providerFetch(ctx, {
      method: 'PUT',
      path: `/campaign/${campaignExternalId}`,
      body: { id: Number(campaignExternalId), status: status === 'active' ? 'ACTIVE' : 'PAUSED' },
    })
  },
}

/** Minimal CSV reader for the Yahoo report download. Handles quoted fields. */
function parseCsv(text: string, request: InsightRequest, currency: string, dimension: string): RemoteInsight[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0)
  if (lines.length < 2) return []
  const header = splitCsvLine(lines[0])
  const index = (name: string) => header.findIndex(column => column.trim().toLowerCase() === name.toLowerCase())

  const idAt = index(dimension)
  const dayAt = index('Day')
  const spendAt = index('Spend')
  const impressionsAt = index('Impressions')
  const clicksAt = index('Clicks')
  const conversionsAt = index('Conversions')
  const revenueAt = index('Total Conversion Value')

  return lines.slice(1).map(line => {
    const cells = splitCsvLine(line)
    return {
      entityType: request.level,
      entityExternalId: idAt >= 0 ? cells[idAt] : request.accountExternalId,
      date: dayString(dayAt >= 0 ? cells[dayAt] : null),
      currency,
      attributionWindow: request.attributionWindow,
      spend: count(spendAt >= 0 ? cells[spendAt] : 0),
      impressions: count(impressionsAt >= 0 ? cells[impressionsAt] : 0),
      reach: 0,
      clicks: count(clicksAt >= 0 ? cells[clicksAt] : 0),
      conversions: count(conversionsAt >= 0 ? cells[conversionsAt] : 0),
      revenue: count(revenueAt >= 0 ? cells[revenueAt] : 0),
      videoViews: 0,
      video3sViews: 0,
      engagements: 0,
      isEstimated: false,
    }
  })
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1 }
      else quoted = !quoted
    } else if (character === ',' && !quoted) {
      cells.push(current); current = ''
    } else {
      current += character
    }
  }
  cells.push(current)
  return cells
}
