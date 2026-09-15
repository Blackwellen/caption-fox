import 'server-only'
import { XMLParser } from './xml'
import { count, dayString, isoDate, money } from './http'
import { ProviderApiError, type Adapter, type AdapterContext, type InsightRequest, type RemoteCampaign, type RemoteInsight } from './types'

// Microsoft Advertising (Bing Ads) API v13.
// Docs: https://learn.microsoft.com/advertising/guides/
//
// Microsoft is the one platform in this module with no REST surface: Customer
// Management, Campaign Management and Reporting are all SOAP 1.1. This adapter
// therefore speaks SOAP directly — a small envelope builder plus a tolerant XML
// reader — rather than pretending a JSON API exists.
//
// Reporting is asynchronous: submit, poll, download a zipped CSV.

const ENDPOINTS = {
  customer: 'https://clientcenter.api.bingads.microsoft.com/Api/CustomerManagement/v13/CustomerManagementService.svc',
  campaign: 'https://campaign.api.bingads.microsoft.com/Api/Advertiser/CampaignManagement/v13/CampaignManagementService.svc',
  reporting: 'https://reporting.api.bingads.microsoft.com/Api/Advertiser/Reporting/v13/ReportingService.svc',
}

const NS = {
  customer: 'https://bingads.microsoft.com/Customer/v13',
  campaign: 'https://bingads.microsoft.com/CampaignManagement/v13',
  reporting: 'https://bingads.microsoft.com/Reporting/v13',
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function envelope(namespace: string, ctx: AdapterContext, action: string, body: string, accountId?: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
  <s:Header xmlns="${namespace}">
    <AuthenticationToken>${escapeXml(ctx.accessToken)}</AuthenticationToken>
    <DeveloperToken>${escapeXml(ctx.extras.developer_token ?? '')}</DeveloperToken>
    ${ctx.extras.customer_id ? `<CustomerId>${escapeXml(ctx.extras.customer_id)}</CustomerId>` : ''}
    ${accountId ? `<CustomerAccountId>${escapeXml(accountId)}</CustomerAccountId>` : ''}
  </s:Header>
  <s:Body>
    <${action} xmlns="${namespace}">${body}</${action}>
  </s:Body>
</s:Envelope>`
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

async function soap(
  ctx: AdapterContext,
  service: keyof typeof ENDPOINTS,
  action: string,
  body: string,
  accountId?: string,
): Promise<XMLParser> {
  const namespace = NS[service]
  const response = await fetch(ENDPOINTS[service], {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: action,
      'User-Agent': 'CaptionFox-Advertising/1.0',
    },
    body: envelope(namespace, ctx, action, body, accountId),
    signal: ctx.signal ?? AbortSignal.timeout(60_000),
  })

  const text = await response.text()
  if (!response.ok) {
    const parser = new XMLParser(text)
    // SOAP faults carry the useful detail; the raw envelope is not shown.
    const message = parser.first('faultstring') ?? parser.first('Message')
      ?? `Microsoft Advertising rejected the request (${response.status}).`
    const authFailure = response.status === 401 || /AuthenticationTokenExpired|InvalidCredentials/i.test(text)
    throw new ProviderApiError(
      authFailure
        ? 'Microsoft Advertising rejected the stored authorisation. Reconnect the account.'
        : message.slice(0, 200),
      'microsoft', response.status, response.status >= 500 || response.status === 429, 'ms-soap',
    )
  }
  return new XMLParser(text)
}

const STATUS: Record<string, RemoteCampaign['status']> = {
  Active: 'active', Paused: 'paused', Deleted: 'archived',
  BudgetPaused: 'paused', BudgetAndManualPaused: 'paused', Draft: 'draft',
}

const OBJECTIVE: Record<string, RemoteCampaign['objective']> = {
  Search: 'traffic', Shopping: 'sales', DynamicSearchAds: 'traffic',
  Audience: 'awareness', PerformanceMax: 'sales', App: 'app_installs',
}

export const microsoftAdapter: Adapter = {
  provider: 'microsoft',

  async listAccounts(ctx) {
    const parser = await soap(ctx, 'customer', 'GetAccountsInfo', `
      <CustomerId i:nil="${ctx.extras.customer_id ? 'false' : 'true'}">${escapeXml(ctx.extras.customer_id ?? '')}</CustomerId>
      <OnlyParentAccounts>false</OnlyParentAccounts>`)

    return parser.list('AccountInfo').map(node => ({
      externalId: node.value('Id') ?? '',
      name: node.value('Name') ?? node.value('Number') ?? 'Microsoft account',
      // GetAccountsInfo omits currency and timezone; both come from the account
      // record and default until a full GetAccount call is made.
      currency: ctx.extras.currency ?? 'USD',
      timezone: 'UTC',
      status: node.value('AccountLifeCycleStatus') === 'Active' ? 'active' as const : 'paused' as const,
    })).filter(account => account.externalId.length > 0)
  },

  async listCampaigns(ctx, accountExternalId) {
    const parser = await soap(ctx, 'campaign', 'GetCampaignsByAccountId', `
      <AccountId>${escapeXml(accountExternalId)}</AccountId>
      <CampaignType>Search Shopping DynamicSearchAds Audience PerformanceMax</CampaignType>`,
      accountExternalId)

    return parser.list('Campaign').map(node => ({
      externalId: node.value('Id') ?? '',
      accountExternalId,
      name: node.value('Name') ?? '',
      objective: OBJECTIVE[node.value('CampaignType') ?? ''] ?? 'traffic',
      status: STATUS[node.value('Status') ?? ''] ?? 'draft',
      budgetAmount: money(node.value('DailyBudget')),
      budgetType: node.value('DailyBudget') ? 'daily' as const : null,
      buyingType: node.value('BiddingScheme') ?? null,
      startsAt: isoDate(node.value('StartDate')),
      endsAt: isoDate(node.value('EndDate')),
    })).filter(campaign => campaign.externalId.length > 0)
  },

  async listAdSets(ctx, accountExternalId) {
    // Microsoft ad groups belong to a campaign, so campaigns are walked first.
    const campaigns = await microsoftAdapter.listCampaigns(ctx, accountExternalId)
    const adSets: Awaited<ReturnType<Adapter['listAdSets']>> = []

    for (const campaign of campaigns) {
      const parser = await soap(ctx, 'campaign', 'GetAdGroupsByCampaignId', `
        <CampaignId>${escapeXml(campaign.externalId)}</CampaignId>`, accountExternalId)
      for (const node of parser.list('AdGroup')) {
        const id = node.value('Id')
        if (!id) continue
        adSets.push({
          externalId: id,
          campaignExternalId: campaign.externalId,
          name: node.value('Name') ?? '',
          status: STATUS[node.value('Status') ?? ''] ?? 'draft',
          budgetAmount: money(node.value('CpcBid')),
          budgetType: null,
          optimisationGoal: node.value('AdRotation') ?? null,
          startsAt: isoDate(node.value('StartDate')),
          endsAt: isoDate(node.value('EndDate')),
        })
      }
    }
    return adSets
  },

  async listCreatives(ctx, accountExternalId) {
    const adSets = await microsoftAdapter.listAdSets(ctx, accountExternalId)
    const creatives: Awaited<ReturnType<Adapter['listCreatives']>> = []

    for (const adSet of adSets) {
      const parser = await soap(ctx, 'campaign', 'GetAdsByAdGroupId', `
        <AdGroupId>${escapeXml(adSet.externalId)}</AdGroupId>
        <AdTypes>
          <AdType>Text</AdType><AdType>ExpandedText</AdType>
          <AdType>ResponsiveSearch</AdType><AdType>ResponsiveAd</AdType>
          <AdType>Image</AdType><AdType>Product</AdType>
        </AdTypes>`, accountExternalId)

      for (const node of parser.list('Ad')) {
        const id = node.value('Id')
        if (!id) continue
        const type = node.value('Type') ?? ''
        creatives.push({
          externalId: id,
          campaignExternalId: adSet.campaignExternalId,
          adSetExternalId: adSet.externalId,
          name: node.value('Title') ?? node.value('TitlePart1') ?? `Ad ${id}`,
          format: type === 'Image' ? 'image' : type === 'ResponsiveAd' ? 'display' : 'text',
          status: STATUS[node.value('Status') ?? ''] === 'active' ? 'active'
            : STATUS[node.value('Status') ?? ''] === 'paused' ? 'paused' : 'draft',
          reviewStatus: node.value('EditorialStatus') === 'Active' ? 'approved'
            : node.value('EditorialStatus') === 'Disapproved' ? 'disapproved'
              : node.value('EditorialStatus') === 'ActiveLimited' ? 'changes_requested' : 'under_review',
          providerFeedback: null,
          thumbnailUrl: null,
          aspectRatio: null,
          durationSeconds: null,
          headline: node.value('TitlePart1') ?? node.value('Title') ?? null,
          bodyText: node.value('Text') ?? null,
          destinationUrl: node.value('FinalUrls') ?? null,
        })
      }
    }
    return creatives
  },

  async listAudiences(ctx, accountExternalId) {
    const parser = await soap(ctx, 'campaign', 'GetAudiencesByIds', `
      <AudienceIds i:nil="true" />
      <Type>RemarketingList CustomAudience InMarketAudience SimilarRemarketingList</Type>`,
      accountExternalId)

    return parser.list('Audience').map(node => ({
      externalId: node.value('Id') ?? '',
      name: node.value('Name') ?? '',
      audienceType: node.value('Type') === 'CustomAudience' ? 'crm_list' as const
        : node.value('Type') === 'SimilarRemarketingList' ? 'lookalike' as const
          : node.value('Type') === 'InMarketAudience' ? 'interest' as const : 'website_visitors' as const,
      description: node.value('Description') ?? null,
      sizeEstimate: count(node.value('SearchSize')) || null,
      matchedUsers: count(node.value('SearchSize')) || null,
      matchRate: null,
      recencyDays: count(node.value('MembershipDuration')) || null,
      status: 'ready' as const,
      lastRefreshedAt: null,
    })).filter(audience => audience.externalId.length > 0)
  },

  async getInsights(ctx, request: InsightRequest) {
    const columns = {
      account: ['AccountId', 'TimePeriod', 'Spend', 'Impressions', 'Clicks', 'Conversions', 'Revenue', 'CurrencyCode'],
      campaign: ['CampaignId', 'TimePeriod', 'Spend', 'Impressions', 'Clicks', 'Conversions', 'Revenue', 'CurrencyCode'],
      ad_set: ['AdGroupId', 'TimePeriod', 'Spend', 'Impressions', 'Clicks', 'Conversions', 'Revenue', 'CurrencyCode'],
      creative: ['AdId', 'TimePeriod', 'Spend', 'Impressions', 'Clicks', 'Conversions', 'Revenue', 'CurrencyCode'],
      audience: ['CampaignId', 'TimePeriod', 'Spend', 'Impressions', 'Clicks', 'Conversions', 'Revenue', 'CurrencyCode'],
    }[request.level]

    const reportType = {
      account: 'AccountPerformanceReportRequest', campaign: 'CampaignPerformanceReportRequest',
      ad_set: 'AdGroupPerformanceReportRequest', creative: 'AdPerformanceReportRequest',
      audience: 'CampaignPerformanceReportRequest',
    }[request.level]

    const idColumn = columns[0]
    const [sy, sm, sd] = request.since.split('-').map(Number)
    const [ey, em, ed] = request.until.split('-').map(Number)

    const submitted = await soap(ctx, 'reporting', 'SubmitGenerateReport', `
      <ReportRequest i:type="${reportType}">
        <Format>Csv</Format>
        <ReturnOnlyCompleteData>false</ReturnOnlyCompleteData>
        <Aggregation>Daily</Aggregation>
        <Columns>${columns.map(column => `<${idColumn.replace(/Id$/, '')}ReportColumn>${column}</${idColumn.replace(/Id$/, '')}ReportColumn>`).join('')}</Columns>
        <Scope><AccountIds><a:long xmlns:a="http://schemas.microsoft.com/2003/10/Serialization/Arrays">${escapeXml(request.accountExternalId)}</a:long></AccountIds></Scope>
        <Time>
          <CustomDateRangeStart><Day>${sd}</Day><Month>${sm}</Month><Year>${sy}</Year></CustomDateRangeStart>
          <CustomDateRangeEnd><Day>${ed}</Day><Month>${em}</Month><Year>${ey}</Year></CustomDateRangeEnd>
        </Time>
      </ReportRequest>`, request.accountExternalId)

    const requestId = submitted.first('ReportRequestId')
    if (!requestId) {
      throw new ProviderApiError('Microsoft did not return a report request id.', 'microsoft', 502, true, 'ms-report')
    }

    let downloadUrl: string | null = null
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await sleep(3_000)
      const polled = await soap(ctx, 'reporting', 'PollGenerateReport', `
        <ReportRequestId>${escapeXml(requestId)}</ReportRequestId>`, request.accountExternalId)
      const status = polled.first('Status')
      if (status === 'Success') { downloadUrl = polled.first('ReportDownloadUrl') ?? null; break }
      if (status === 'Error') {
        throw new ProviderApiError('Microsoft could not generate the report.', 'microsoft', 502, true, 'ms-report')
      }
    }
    // A completed report with no rows returns no URL; that is not an error.
    if (!downloadUrl) return []

    const download = await fetch(downloadUrl)
    if (!download.ok) {
      throw new ProviderApiError('Could not download the Microsoft report.', 'microsoft', download.status, true, 'ms-report')
    }
    return parseReportCsv(await download.text(), request, idColumn, ctx.extras.currency ?? 'USD')
  },

  async setCampaignStatus(ctx, campaignExternalId, status) {
    const accountId = ctx.extras.account_id
    if (!accountId) throw new Error('Microsoft campaign updates need the owning account id.')
    await soap(ctx, 'campaign', 'UpdateCampaigns', `
      <AccountId>${escapeXml(accountId)}</AccountId>
      <Campaigns>
        <Campaign>
          <Id>${escapeXml(campaignExternalId)}</Id>
          <Status>${status === 'active' ? 'Active' : 'Paused'}</Status>
        </Campaign>
      </Campaigns>`, accountId)
  },
}

/**
 * Microsoft report CSVs open with a metadata preamble and close with a
 * copyright footer, so the header row is located rather than assumed.
 */
function parseReportCsv(text: string, request: InsightRequest, idColumn: string, fallbackCurrency: string): RemoteInsight[] {
  const lines = text.split(/\r?\n/)
  const headerIndex = lines.findIndex(line => line.includes(idColumn) && line.includes('TimePeriod'))
  if (headerIndex === -1) return []

  const header = splitCsv(lines[headerIndex]).map(cell => cell.replace(/^"|"$/g, '').trim())
  const at = (name: string) => header.indexOf(name)
  const rows: RemoteInsight[] = []

  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim() || line.startsWith('"©') || line.startsWith('©')) continue
    const cells = splitCsv(line).map(cell => cell.replace(/^"|"$/g, ''))
    const id = at(idColumn) >= 0 ? cells[at(idColumn)] : ''
    if (!id) continue
    rows.push({
      entityType: request.level,
      entityExternalId: id,
      date: dayString(at('TimePeriod') >= 0 ? cells[at('TimePeriod')] : null),
      currency: at('CurrencyCode') >= 0 ? (cells[at('CurrencyCode')] || fallbackCurrency) : fallbackCurrency,
      attributionWindow: request.attributionWindow,
      spend: count(at('Spend') >= 0 ? cells[at('Spend')] : 0),
      impressions: count(at('Impressions') >= 0 ? cells[at('Impressions')] : 0),
      reach: 0,
      clicks: count(at('Clicks') >= 0 ? cells[at('Clicks')] : 0),
      conversions: count(at('Conversions') >= 0 ? cells[at('Conversions')] : 0),
      revenue: count(at('Revenue') >= 0 ? cells[at('Revenue')] : 0),
      videoViews: 0,
      video3sViews: 0,
      engagements: 0,
      isEstimated: false,
    })
  }
  return rows
}

function splitCsv(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1 }
      else quoted = !quoted
    } else if (character === ',' && !quoted) { cells.push(current); current = '' }
    else current += character
  }
  cells.push(current)
  return cells
}
