import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import type { AdProvider } from './providers'
import { AD_PROVIDERS } from './providers'

// Server-only OAuth configuration and token exchange for every ad platform.
//
// One generic OAuth 2.0 engine plus a per-provider config table. The awkward
// providers are handled by narrow, documented flags rather than bespoke code
// paths, so adding a platform stays a data change.

export type TokenAuthStyle = 'body' | 'basic'

export type OAuthConfig = {
  authorizeUrl: string
  tokenUrl: string
  /** Where the provider expects client credentials on the token call. */
  tokenAuth: TokenAuthStyle
  /** Provider requires PKCE (S256). */
  pkce: boolean
  /** Scope delimiter; most use a space, a few use a comma. */
  scopeSeparator: string
  /** Extra query params appended to the authorize URL. */
  authorizeParams?: Record<string, string>
  /** Extra form fields sent on the token request. */
  tokenParams?: Record<string, string>
  /** Provider ignores the standard `code`/`grant_type` names. */
  nonStandard?: 'tiktok'
  /** Host template for the data API; {region}/{tenant} substituted from extras. */
  apiBase: string
  /** Access tokens that never refresh (Meta long-lived) need re-auth instead. */
  refreshable: boolean
  /** Seconds before expiry at which a proactive refresh is attempted. */
  refreshSkewSeconds: number
}

export const OAUTH_CONFIG: Record<AdProvider, OAuthConfig> = {
  meta: {
    authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    tokenAuth: 'body', pkce: false, scopeSeparator: ',',
    apiBase: 'https://graph.facebook.com/v21.0',
    // Meta issues a 60-day long-lived token; it is extended, not refreshed.
    refreshable: false, refreshSkewSeconds: 86400 * 7,
  },
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    tokenAuth: 'body', pkce: false, scopeSeparator: ' ',
    authorizeParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
    apiBase: 'https://googleads.googleapis.com/v18',
    refreshable: true, refreshSkewSeconds: 300,
  },
  microsoft: {
    authorizeUrl: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token',
    tokenAuth: 'body', pkce: true, scopeSeparator: ' ',
    authorizeParams: { response_mode: 'query' },
    apiBase: 'https://campaign.api.bingads.microsoft.com',
    refreshable: true, refreshSkewSeconds: 300,
  },
  tiktok: {
    authorizeUrl: 'https://business-api.tiktok.com/portal/auth',
    tokenUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/',
    tokenAuth: 'body', pkce: false, scopeSeparator: ',',
    nonStandard: 'tiktok',
    apiBase: 'https://business-api.tiktok.com/open_api/v1.3',
    // TikTok access tokens are long-lived and re-authorised rather than refreshed.
    refreshable: false, refreshSkewSeconds: 86400,
  },
  linkedin: {
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    tokenAuth: 'body', pkce: false, scopeSeparator: ' ',
    apiBase: 'https://api.linkedin.com/rest',
    refreshable: true, refreshSkewSeconds: 300,
  },
  pinterest: {
    authorizeUrl: 'https://www.pinterest.com/oauth/',
    tokenUrl: 'https://api.pinterest.com/v5/oauth/token',
    tokenAuth: 'basic', pkce: false, scopeSeparator: ',',
    apiBase: 'https://api.pinterest.com/v5',
    refreshable: true, refreshSkewSeconds: 300,
  },
  reddit: {
    authorizeUrl: 'https://www.reddit.com/api/v1/authorize',
    tokenUrl: 'https://www.reddit.com/api/v1/access_token',
    tokenAuth: 'basic', pkce: false, scopeSeparator: ' ',
    authorizeParams: { duration: 'permanent' },
    apiBase: 'https://ads-api.reddit.com/api/v3',
    refreshable: true, refreshSkewSeconds: 300,
  },
  snapchat: {
    authorizeUrl: 'https://accounts.snapchat.com/login/oauth2/authorize',
    tokenUrl: 'https://accounts.snapchat.com/login/oauth2/access_token',
    tokenAuth: 'body', pkce: false, scopeSeparator: ' ',
    apiBase: 'https://adsapi.snapchat.com/v1',
    refreshable: true, refreshSkewSeconds: 300,
  },
  x: {
    authorizeUrl: 'https://x.com/i/oauth2/authorize',
    tokenUrl: 'https://api.x.com/2/oauth2/token',
    tokenAuth: 'basic', pkce: true, scopeSeparator: ' ',
    apiBase: 'https://ads-api.x.com/12',
    refreshable: true, refreshSkewSeconds: 300,
  },
  yahoo: {
    authorizeUrl: 'https://api.login.yahoo.com/oauth2/request_auth',
    tokenUrl: 'https://api.login.yahoo.com/oauth2/get_token',
    tokenAuth: 'basic', pkce: false, scopeSeparator: ' ',
    apiBase: 'https://dspapi.admanagerplus.yahoo.com/traffic/v1',
    refreshable: true, refreshSkewSeconds: 300,
  },
  amazon: {
    authorizeUrl: 'https://www.amazon.com/ap/oa',
    tokenUrl: 'https://api.amazon.com/auth/o2/token',
    tokenAuth: 'body', pkce: false, scopeSeparator: ' ',
    apiBase: 'https://advertising-api{region}.amazon.com',
    refreshable: true, refreshSkewSeconds: 300,
  },
}

/** Amazon hosts differ per region; na uses the bare host. */
export function resolveApiBase(provider: AdProvider, extras: Record<string, string> = {}): string {
  const template = OAUTH_CONFIG[provider].apiBase
  const region = extras.region === 'eu' ? '-eu' : extras.region === 'fe' ? '-fe' : ''
  return template
    .replace('{region}', region)
    .replace('{tenant}', extras.tenant || 'common')
}

function resolveUrl(template: string, extras: Record<string, string>): string {
  return template.replace('{tenant}', extras.tenant || 'common')
}

// ------------------------------------------------------------------ PKCE

export type Pkce = { verifier: string; challenge: string }

export function createPkce(): Pkce {
  const verifier = randomBytes(48).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export function createState(): string {
  return randomBytes(32).toString('base64url')
}

// ------------------------------------------------------- authorize URL

export function buildAuthorizeUrl(input: {
  provider: AdProvider
  clientId: string
  redirectUri: string
  state: string
  codeChallenge?: string
  extras?: Record<string, string>
}): string {
  const config = OAUTH_CONFIG[input.provider]
  const definition = AD_PROVIDERS[input.provider]
  const extras = input.extras ?? {}
  const url = new URL(resolveUrl(config.authorizeUrl, extras))

  const params = url.searchParams
  params.set('response_type', 'code')
  params.set('redirect_uri', input.redirectUri)
  params.set('state', input.state)
  params.set('scope', definition.scopes.join(config.scopeSeparator))

  // TikTok identifies the app as app_id, everyone else as client_id.
  if (config.nonStandard === 'tiktok') params.set('app_id', input.clientId)
  else params.set('client_id', input.clientId)

  if (config.pkce && input.codeChallenge) {
    params.set('code_challenge', input.codeChallenge)
    params.set('code_challenge_method', 'S256')
  }
  for (const [key, value] of Object.entries(config.authorizeParams ?? {})) {
    params.set(key, value)
  }
  return url.toString()
}

// -------------------------------------------------------- token exchange

export type TokenSet = {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  scopes: string[]
  /** Provider-specific identifiers returned alongside the token. */
  meta: Record<string, unknown>
}

export class ProviderAuthError extends Error {
  constructor(
    message: string,
    readonly provider: AdProvider,
    readonly status: number,
    /** Safe reference for support; never contains the token or secret. */
    readonly reference: string = randomBytes(6).toString('hex'),
  ) {
    super(message)
    this.name = 'ProviderAuthError'
  }
}

type TokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  refresh_expires_in?: number
  scope?: string | string[]
  token_type?: string
  // TikTok wraps everything in { code, message, data }
  code?: number
  message?: string
  data?: Record<string, unknown>
  error?: string
  error_description?: string
}

async function postToken(
  provider: AdProvider,
  clientId: string,
  clientSecret: string,
  form: Record<string, string>,
  extras: Record<string, string>,
): Promise<TokenSet> {
  const config = OAUTH_CONFIG[provider]
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
    'User-Agent': 'CaptionFox-Advertising/1.0',
  }
  const body = new URLSearchParams(form)

  if (config.nonStandard === 'tiktok') {
    // TikTok expects JSON with app_id/secret rather than an OAuth form.
    const res = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ app_id: clientId, secret: clientSecret, auth_code: form.code, grant_type: 'authorization_code' }),
    })
    return parseTokenResponse(provider, res.status, await safeJson(res))
  }

  if (config.tokenAuth === 'basic') {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
  } else {
    body.set('client_id', clientId)
    body.set('client_secret', clientSecret)
  }
  for (const [key, value] of Object.entries(config.tokenParams ?? {})) body.set(key, value)

  const res = await fetch(resolveUrl(config.tokenUrl, extras), { method: 'POST', headers, body })
  return parseTokenResponse(provider, res.status, await safeJson(res))
}

async function safeJson(res: Response): Promise<TokenResponse> {
  const text = await res.text()
  try { return JSON.parse(text) as TokenResponse } catch { return { error: 'invalid_response', error_description: text.slice(0, 200) } }
}

function parseTokenResponse(provider: AdProvider, status: number, json: TokenResponse): TokenSet {
  // TikTok signals failure with a non-zero code and a 200 status.
  const payload = (json.data && typeof json.data === 'object' ? json.data as TokenResponse : json)
  if (json.code !== undefined && json.code !== 0) {
    throw new ProviderAuthError(json.message || 'Authorisation was rejected by the provider.', provider, status)
  }
  if (status >= 400 || json.error) {
    // error_description can echo request detail; keep it short and token-free.
    const detail = json.error_description ?? json.error ?? `HTTP ${status}`
    throw new ProviderAuthError(String(detail).slice(0, 200), provider, status)
  }
  const accessToken = payload.access_token
  if (!accessToken) {
    throw new ProviderAuthError('Provider did not return an access token.', provider, status)
  }
  const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : null
  const rawScope = payload.scope
  const scopes = Array.isArray(rawScope)
    ? rawScope
    : typeof rawScope === 'string'
      ? rawScope.split(/[ ,]+/).filter(Boolean)
      : AD_PROVIDERS[provider].scopes

  const meta: Record<string, unknown> = {}
  for (const key of ['advertiser_ids', 'scope_meta', 'account_id', 'open_id', 'seller_id']) {
    if (payload[key as keyof TokenResponse] !== undefined) meta[key] = payload[key as keyof TokenResponse]
  }

  return {
    accessToken,
    refreshToken: payload.refresh_token ?? null,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
    scopes,
    meta,
  }
}

export function exchangeCode(input: {
  provider: AdProvider
  clientId: string
  clientSecret: string
  code: string
  redirectUri: string
  codeVerifier?: string | null
  extras?: Record<string, string>
}): Promise<TokenSet> {
  const form: Record<string, string> = {
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
  }
  if (input.codeVerifier) form.code_verifier = input.codeVerifier
  return postToken(input.provider, input.clientId, input.clientSecret, form, input.extras ?? {})
}

export function refreshAccessToken(input: {
  provider: AdProvider
  clientId: string
  clientSecret: string
  refreshToken: string
  extras?: Record<string, string>
}): Promise<TokenSet> {
  return postToken(input.provider, input.clientId, input.clientSecret, {
    grant_type: 'refresh_token',
    refresh_token: input.refreshToken,
  }, input.extras ?? {})
}

/** Meta has no refresh grant; a long-lived token is extended in place. */
export function extendMetaToken(input: {
  clientId: string
  clientSecret: string
  accessToken: string
}): Promise<TokenSet> {
  return postToken('meta', input.clientId, input.clientSecret, {
    grant_type: 'fb_exchange_token',
    fb_exchange_token: input.accessToken,
  }, {})
}

export function tokenNeedsRefresh(provider: AdProvider, expiresAt: Date | string | null | undefined): boolean {
  if (!expiresAt) return false
  const expiry = new Date(expiresAt).getTime()
  if (Number.isNaN(expiry)) return false
  return expiry - Date.now() < OAUTH_CONFIG[provider].refreshSkewSeconds * 1000
}

/** Canonical redirect URI the customer must whitelist in their developer app. */
export function redirectUriFor(provider: AdProvider, appUrl: string): string {
  return `${appUrl.replace(/\/$/, '')}/api/advertising/oauth/${provider}/callback`
}
