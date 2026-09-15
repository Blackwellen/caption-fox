// Advertising provider catalogue.
//
// Client-safe: contains no endpoints, secrets or credentials. Server OAuth and
// API details live in ./oauth.ts and ./clients/.
//
// Two separate ideas that must never be conflated:
//
//   capabilities — what the provider's API can do AND what Caption Fox has
//                  implemented against it. If a flag is false the action is not
//                  offered, rather than offered and failing later.
//   configured   — whether THIS WORKSPACE has registered its own developer app.
//                  Caption Fox ships no shared ad-platform app: every workspace
//                  supplies its own client id and secret so quota and rate
//                  limits are isolated per customer. Until they do, the connect
//                  flow shows setup instructions instead of a dead OAuth window.

export type AdProvider =
  | 'meta' | 'google' | 'microsoft' | 'tiktok' | 'linkedin'
  | 'pinterest' | 'reddit' | 'snapchat' | 'x' | 'yahoo' | 'amazon'

export type AdProviderCapability = {
  readAccounts: boolean
  readCampaigns: boolean
  writeCampaigns: boolean
  pauseCampaigns: boolean
  readAdSets: boolean
  readCreatives: boolean
  uploadCreatives: boolean
  readAudiences: boolean
  createAudiences: boolean
  syncAudiences: boolean
  readReports: boolean
  supportsWebhooks: boolean
}

export type AdProviderFamily = 'social' | 'search' | 'retail'

export type ProviderCredentialField = {
  key: string
  label: string
  hint: string
  secret: boolean
  required: boolean
}

export type AdProviderDefinition = {
  id: AdProvider
  name: string
  shortName: string
  family: AdProviderFamily
  /** Brand colour for logo chips and chart series. */
  brandColor: string
  /** OAuth scopes requested during authorisation. Shown on the Accounts page. */
  scopes: string[]
  /** Normalised metrics this provider does not report, disclosed in reports. */
  unsupportedMetrics: string[]
  /** Extra credentials beyond client id/secret this provider needs. */
  extraCredentials: ProviderCredentialField[]
  /** Where the customer registers their developer app. */
  developerConsoleUrl: string
  /** Provider ads console, linked from account rows. */
  consoleUrl: string
  /** Docs link shown in the setup panel. */
  docsUrl: string
  capabilities: AdProviderCapability
}

const NONE: AdProviderCapability = {
  readAccounts: false, readCampaigns: false, writeCampaigns: false, pauseCampaigns: false,
  readAdSets: false, readCreatives: false, uploadCreatives: false, readAudiences: false,
  createAudiences: false, syncAudiences: false, readReports: false, supportsWebhooks: false,
}

/** Full read ingest: accounts, entities, creatives, audiences and insights. */
const READ: AdProviderCapability = {
  ...NONE,
  readAccounts: true, readCampaigns: true, readAdSets: true,
  readCreatives: true, readAudiences: true, readReports: true,
}

const DEV_TOKEN = (label: string, hint: string): ProviderCredentialField =>
  ({ key: 'developer_token', label, hint, secret: true, required: true })

export const AD_PROVIDERS: Record<AdProvider, AdProviderDefinition> = {
  meta: {
    id: 'meta', name: 'Meta Ads', shortName: 'Meta', family: 'social', brandColor: '#0064E0',
    scopes: ['ads_read', 'ads_management', 'business_management', 'read_insights'],
    unsupportedMetrics: [],
    extraCredentials: [],
    developerConsoleUrl: 'https://developers.facebook.com/apps',
    consoleUrl: 'https://adsmanager.facebook.com',
    docsUrl: 'https://developers.facebook.com/docs/marketing-apis',
    capabilities: {
      ...READ, writeCampaigns: true, pauseCampaigns: true,
      uploadCreatives: true, createAudiences: true, syncAudiences: true, supportsWebhooks: true,
    },
  },
  google: {
    id: 'google', name: 'Google Ads', shortName: 'Google', family: 'search', brandColor: '#1A73E8',
    scopes: ['https://www.googleapis.com/auth/adwords'],
    unsupportedMetrics: ['hookRate'],
    extraCredentials: [
      DEV_TOKEN('Developer token', 'From your Google Ads manager account API Center.'),
      { key: 'login_customer_id', label: 'Manager account ID', hint: 'Ten digits, no dashes. Required when accessing client accounts.', secret: false, required: false },
    ],
    developerConsoleUrl: 'https://console.cloud.google.com/apis/credentials',
    consoleUrl: 'https://ads.google.com',
    docsUrl: 'https://developers.google.com/google-ads/api/docs/start',
    capabilities: {
      ...READ, writeCampaigns: true, pauseCampaigns: true, createAudiences: true, syncAudiences: true,
    },
  },
  microsoft: {
    id: 'microsoft', name: 'Microsoft Advertising', shortName: 'Microsoft', family: 'search', brandColor: '#0F6CBD',
    scopes: ['https://ads.microsoft.com/msads.manage', 'offline_access'],
    unsupportedMetrics: ['hookRate', 'videoViews'],
    extraCredentials: [
      DEV_TOKEN('Developer token', 'From Microsoft Advertising account settings, Developer settings.'),
      { key: 'tenant', label: 'Directory (tenant)', hint: 'Usually "common" unless your app is single tenant.', secret: false, required: false },
    ],
    developerConsoleUrl: 'https://portal.azure.com',
    consoleUrl: 'https://ads.microsoft.com',
    docsUrl: 'https://learn.microsoft.com/advertising/guides/',
    capabilities: { ...READ, pauseCampaigns: true, createAudiences: true },
  },
  tiktok: {
    id: 'tiktok', name: 'TikTok Ads', shortName: 'TikTok', family: 'social', brandColor: '#111827',
    scopes: ['ad.read', 'ad.write', 'audience.read', 'creative.read', 'report.read'],
    unsupportedMetrics: [],
    extraCredentials: [],
    developerConsoleUrl: 'https://business-api.tiktok.com/portal/apps',
    consoleUrl: 'https://ads.tiktok.com',
    docsUrl: 'https://business-api.tiktok.com/portal/docs',
    capabilities: { ...READ, pauseCampaigns: true, uploadCreatives: true, createAudiences: true, syncAudiences: true },
  },
  linkedin: {
    id: 'linkedin', name: 'LinkedIn Ads', shortName: 'LinkedIn', family: 'social', brandColor: '#0A66C2',
    scopes: ['r_ads', 'r_ads_reporting', 'rw_ads'],
    // LinkedIn reports unique impressions, not deduplicated reach or 3s views.
    unsupportedMetrics: ['hookRate', 'reach'],
    extraCredentials: [
      { key: 'api_version', label: 'API version', hint: 'LinkedIn-Version header, e.g. 202411.', secret: false, required: false },
    ],
    developerConsoleUrl: 'https://www.linkedin.com/developers/apps',
    consoleUrl: 'https://www.linkedin.com/campaignmanager',
    docsUrl: 'https://learn.microsoft.com/linkedin/marketing/',
    capabilities: { ...READ, pauseCampaigns: true, createAudiences: true, syncAudiences: true },
  },
  pinterest: {
    id: 'pinterest', name: 'Pinterest Ads', shortName: 'Pinterest', family: 'social', brandColor: '#E60023',
    scopes: ['ads:read', 'ads:write', 'user_accounts:read'],
    unsupportedMetrics: ['hookRate'],
    extraCredentials: [],
    developerConsoleUrl: 'https://developers.pinterest.com/apps',
    consoleUrl: 'https://ads.pinterest.com',
    docsUrl: 'https://developers.pinterest.com/docs/api/v5/',
    capabilities: { ...READ, pauseCampaigns: true, createAudiences: true },
  },
  reddit: {
    id: 'reddit', name: 'Reddit Ads', shortName: 'Reddit', family: 'social', brandColor: '#FF4500',
    scopes: ['identity', 'adsread', 'adsedit'],
    unsupportedMetrics: ['hookRate'],
    extraCredentials: [],
    developerConsoleUrl: 'https://www.reddit.com/prefs/apps',
    consoleUrl: 'https://ads.reddit.com',
    docsUrl: 'https://ads-api.reddit.com/docs/',
    capabilities: { ...READ, pauseCampaigns: true },
  },
  snapchat: {
    id: 'snapchat', name: 'Snapchat Ads', shortName: 'Snapchat', family: 'social', brandColor: '#F5B700',
    scopes: ['snapchat-marketing-api'],
    unsupportedMetrics: [],
    extraCredentials: [],
    developerConsoleUrl: 'https://business.snapchat.com',
    consoleUrl: 'https://ads.snapchat.com',
    docsUrl: 'https://developers.snap.com/api/marketing-api/Ads-API/introduction',
    capabilities: { ...READ, pauseCampaigns: true, createAudiences: true, syncAudiences: true },
  },
  x: {
    id: 'x', name: 'X Ads', shortName: 'X', family: 'social', brandColor: '#0F172A',
    scopes: ['tweet.read', 'users.read', 'offline.access'],
    unsupportedMetrics: ['hookRate'],
    extraCredentials: [
      { key: 'account_id', label: 'Ads account ID', hint: 'From ads.x.com; required by the Ads API path.', secret: false, required: false },
    ],
    developerConsoleUrl: 'https://developer.x.com/en/portal/dashboard',
    consoleUrl: 'https://ads.x.com',
    docsUrl: 'https://developer.x.com/en/docs/x-ads-api',
    // X exposes reporting and campaign reads but no creative asset upload here.
    capabilities: { ...READ, readCreatives: false, pauseCampaigns: true },
  },
  yahoo: {
    id: 'yahoo', name: 'Yahoo Ads (DSP)', shortName: 'Yahoo', family: 'search', brandColor: '#7B0099',
    scopes: ['openid', 'dsp-api'],
    unsupportedMetrics: ['hookRate', 'engagements'],
    extraCredentials: [
      { key: 'advertiser_id', label: 'Advertiser ID', hint: 'Yahoo DSP advertiser this connection reports on.', secret: false, required: false },
    ],
    developerConsoleUrl: 'https://developer.yahoo.com/apps/',
    consoleUrl: 'https://dsp.yahooinc.com',
    docsUrl: 'https://developer.yahooinc.com/dsp/api/docs/',
    capabilities: { ...READ, readAudiences: false, pauseCampaigns: true },
  },
  amazon: {
    id: 'amazon', name: 'Amazon Ads', shortName: 'Amazon', family: 'retail', brandColor: '#FF9900',
    scopes: ['advertising::campaign_management'],
    unsupportedMetrics: ['hookRate', 'reach', 'engagements'],
    extraCredentials: [
      { key: 'region', label: 'Region', hint: 'na, eu or fe. Determines the API host.', secret: false, required: true },
    ],
    developerConsoleUrl: 'https://advertising.amazon.com/API/docs/en-us/setting-up/step-1-create-lwa-app',
    consoleUrl: 'https://advertising.amazon.com',
    docsUrl: 'https://advertising.amazon.com/API/docs/en-us/',
    capabilities: { ...READ, readAudiences: false, pauseCampaigns: true },
  },
}

export const AD_PROVIDER_IDS = Object.keys(AD_PROVIDERS) as AdProvider[]

export function isAdProvider(value: string | null | undefined): value is AdProvider {
  return !!value && value in AD_PROVIDERS
}

export function getProvider(id: string): AdProviderDefinition | null {
  return isAdProvider(id) ? AD_PROVIDERS[id] : null
}

export function providerName(id: string): string {
  return getProvider(id)?.name ?? id
}

export function providerShortName(id: string): string {
  return getProvider(id)?.shortName ?? id
}

export function providerColor(id: string): string {
  return getProvider(id)?.brandColor ?? '#64748B'
}

/** Capability union across the providers a workspace has actually connected. */
export function unionCapabilities(providers: string[]): AdProviderCapability {
  return providers.reduce<AdProviderCapability>((acc, id) => {
    const definition = getProvider(id)
    if (!definition) return acc
    for (const key of Object.keys(acc) as (keyof AdProviderCapability)[]) {
      acc[key] = acc[key] || definition.capabilities[key]
    }
    return acc
  }, { ...NONE })
}

export const CAPABILITY_LABELS: Record<keyof AdProviderCapability, string> = {
  readAccounts: 'Read accounts', readCampaigns: 'Read campaigns',
  writeCampaigns: 'Create campaigns', pauseCampaigns: 'Pause and resume',
  readAdSets: 'Read ad sets', readCreatives: 'Read creatives',
  uploadCreatives: 'Upload creatives', readAudiences: 'Read audiences',
  createAudiences: 'Create audiences', syncAudiences: 'Sync audiences',
  readReports: 'Reporting', supportsWebhooks: 'Webhooks',
}
