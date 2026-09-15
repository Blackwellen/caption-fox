import 'server-only'
import type { AdProvider } from '../providers'

// The contract every ad-platform adapter implements. The sync engine only ever
// talks to this interface, so the platforms stay interchangeable and the
// normalisation rules stay in one place.
//
// Adapters return NORMALISED shapes. Provider field names, enums, currency
// minor units and metric aliases are translated inside the adapter, never
// leaked upwards.

export type AdapterContext = {
  provider: AdProvider
  accessToken: string
  /** Non-secret provider extras: developer token, region, api version, ... */
  extras: Record<string, string>
  apiBase: string
  /** Aborts long provider calls so a sync run cannot hang a worker. */
  signal?: AbortSignal
}

export type RemoteAccount = {
  externalId: string
  name: string
  currency: string
  timezone: string
  status: 'active' | 'paused' | 'closed' | 'unsettled'
}

export type RemoteCampaign = {
  externalId: string
  accountExternalId: string
  name: string
  objective: 'awareness' | 'traffic' | 'engagement' | 'leads' | 'app_installs' | 'video_views' | 'sales' | 'conversions'
  status: 'draft' | 'active' | 'learning' | 'paused' | 'completed' | 'archived'
  budgetAmount: number | null
  budgetType: 'daily' | 'lifetime' | null
  buyingType: string | null
  startsAt: string | null
  endsAt: string | null
}

export type RemoteAdSet = {
  externalId: string
  campaignExternalId: string
  name: string
  status: RemoteCampaign['status']
  budgetAmount: number | null
  budgetType: 'daily' | 'lifetime' | null
  optimisationGoal: string | null
  startsAt: string | null
  endsAt: string | null
}

export type RemoteCreative = {
  externalId: string
  campaignExternalId: string | null
  adSetExternalId: string | null
  name: string
  format: 'image' | 'video' | 'carousel' | 'story' | 'reel' | 'display' | 'text'
  status: 'draft' | 'active' | 'paused' | 'archived'
  reviewStatus: 'not_submitted' | 'under_review' | 'approved' | 'changes_requested' | 'disapproved'
  providerFeedback: string | null
  /** Provider-hosted preview. Downloaded into storage by the sync engine. */
  thumbnailUrl: string | null
  aspectRatio: string | null
  durationSeconds: number | null
  headline: string | null
  bodyText: string | null
  destinationUrl: string | null
}

export type RemoteAudience = {
  externalId: string
  name: string
  audienceType: 'custom' | 'lookalike' | 'website_visitors' | 'engagers' | 'crm_list' | 'interest' | 'video_viewers' | 'customer_list' | 'app_users'
  description: string | null
  sizeEstimate: number | null
  matchedUsers: number | null
  /** 0-100. Null when the provider does not disclose a match rate. */
  matchRate: number | null
  recencyDays: number | null
  status: 'ready' | 'review' | 'paused' | 'archived'
  lastRefreshedAt: string | null
}

/** One day of metrics for one entity, already mapped to Caption Fox names. */
export type RemoteInsight = {
  entityType: 'account' | 'campaign' | 'ad_set' | 'creative' | 'audience'
  entityExternalId: string
  date: string
  currency: string
  attributionWindow: string
  spend: number
  impressions: number
  reach: number
  clicks: number
  conversions: number
  revenue: number
  videoViews: number
  video3sViews: number
  engagements: number
  /** True when the provider marks the figure as modelled or incomplete. */
  isEstimated: boolean
}

export type InsightRequest = {
  accountExternalId: string
  level: RemoteInsight['entityType']
  since: string
  until: string
  attributionWindow: string
}

export type Adapter = {
  provider: AdProvider
  listAccounts(ctx: AdapterContext): Promise<RemoteAccount[]>
  listCampaigns(ctx: AdapterContext, accountExternalId: string): Promise<RemoteCampaign[]>
  listAdSets(ctx: AdapterContext, accountExternalId: string): Promise<RemoteAdSet[]>
  listCreatives(ctx: AdapterContext, accountExternalId: string): Promise<RemoteCreative[]>
  listAudiences(ctx: AdapterContext, accountExternalId: string): Promise<RemoteAudience[]>
  getInsights(ctx: AdapterContext, request: InsightRequest): Promise<RemoteInsight[]>
  /** Only defined when the provider capability allows it. */
  setCampaignStatus?(ctx: AdapterContext, campaignExternalId: string, status: 'active' | 'paused'): Promise<void>
}

/** Raised for any provider API failure. Never carries a token or secret. */
export class ProviderApiError extends Error {
  constructor(
    message: string,
    readonly provider: AdProvider,
    readonly status: number,
    readonly retryable: boolean,
    readonly reference: string,
  ) {
    super(message)
    this.name = 'ProviderApiError'
  }
}
