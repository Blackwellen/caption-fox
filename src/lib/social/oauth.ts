import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { REQUIRED_SCOPES } from './providers'
import type { SocialProvider } from '@/types/social'

// Server-only OAuth configuration and token exchange for social channels.
//
// One OAuth 2.0 engine plus a per-provider config table. Tokens never reach the
// browser: the authorize URL is built here, the callback exchanges the code
// here, and only the encrypted token is persisted.

export interface SocialOAuthConfig {
  authorizeUrl: string
  tokenUrl: string
  tokenAuth: 'body' | 'basic'
  pkce: boolean
  scopeSeparator: string
  authorizeParams?: Record<string, string>
  apiBase: string
  refreshable: boolean
  /** Environment variable names holding this provider's app credentials. */
  clientIdEnv: string
  clientSecretEnv: string
  /** Where the user manages the app that issues these credentials. */
  consoleUrl: string
}

export const SOCIAL_OAUTH_CONFIG: Record<SocialProvider, SocialOAuthConfig> = {
  instagram: {
    authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    tokenAuth: 'body', pkce: false, scopeSeparator: ',',
    apiBase: 'https://graph.facebook.com/v21.0',
    refreshable: false,
    clientIdEnv: 'META_APP_ID', clientSecretEnv: 'META_APP_SECRET',
    consoleUrl: 'https://developers.facebook.com/apps',
  },
  facebook: {
    authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    tokenAuth: 'body', pkce: false, scopeSeparator: ',',
    apiBase: 'https://graph.facebook.com/v21.0',
    refreshable: false,
    clientIdEnv: 'META_APP_ID', clientSecretEnv: 'META_APP_SECRET',
    consoleUrl: 'https://developers.facebook.com/apps',
  },
  threads: {
    authorizeUrl: 'https://threads.net/oauth/authorize',
    tokenUrl: 'https://graph.threads.net/oauth/access_token',
    tokenAuth: 'body', pkce: false, scopeSeparator: ',',
    apiBase: 'https://graph.threads.net/v1.0',
    refreshable: true,
    clientIdEnv: 'THREADS_APP_ID', clientSecretEnv: 'THREADS_APP_SECRET',
    consoleUrl: 'https://developers.facebook.com/apps',
  },
  tiktok: {
    authorizeUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    tokenAuth: 'body', pkce: true, scopeSeparator: ',',
    apiBase: 'https://open.tiktokapis.com/v2',
    refreshable: true,
    clientIdEnv: 'TIKTOK_CLIENT_KEY', clientSecretEnv: 'TIKTOK_CLIENT_SECRET',
    consoleUrl: 'https://developers.tiktok.com/apps',
  },
  linkedin: {
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    tokenAuth: 'body', pkce: false, scopeSeparator: ' ',
    apiBase: 'https://api.linkedin.com/rest',
    refreshable: true,
    clientIdEnv: 'LINKEDIN_CLIENT_ID', clientSecretEnv: 'LINKEDIN_CLIENT_SECRET',
    consoleUrl: 'https://www.linkedin.com/developers/apps',
  },
  youtube: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    tokenAuth: 'body', pkce: false, scopeSeparator: ' ',
    authorizeParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
    apiBase: 'https://www.googleapis.com/youtube/v3',
    refreshable: true,
    clientIdEnv: 'GOOGLE_CLIENT_ID', clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
    consoleUrl: 'https://console.cloud.google.com/apis/credentials',
  },
  x: {
    authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    tokenAuth: 'basic', pkce: true, scopeSeparator: ' ',
    apiBase: 'https://api.twitter.com/2',
    refreshable: true,
    clientIdEnv: 'X_CLIENT_ID', clientSecretEnv: 'X_CLIENT_SECRET',
    consoleUrl: 'https://developer.twitter.com/en/portal/dashboard',
  },
  pinterest: {
    authorizeUrl: 'https://www.pinterest.com/oauth/',
    tokenUrl: 'https://api.pinterest.com/v5/oauth/token',
    tokenAuth: 'basic', pkce: false, scopeSeparator: ',',
    apiBase: 'https://api.pinterest.com/v5',
    refreshable: true,
    clientIdEnv: 'PINTEREST_APP_ID', clientSecretEnv: 'PINTEREST_APP_SECRET',
    consoleUrl: 'https://developers.pinterest.com/apps',
  },
}

export interface ProviderCredentials { clientId: string; clientSecret: string }

/** Reads the workspace-supplied app credentials from the environment. */
export function providerCredentials(provider: SocialProvider): ProviderCredentials | null {
  const config = SOCIAL_OAUTH_CONFIG[provider]
  const clientId = process.env[config.clientIdEnv]
  const clientSecret = process.env[config.clientSecretEnv]
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

export function providerConfigured(provider: SocialProvider): boolean {
  return providerCredentials(provider) !== null
}

export interface Pkce { verifier: string; challenge: string }

export function createPkce(): Pkce {
  const verifier = randomBytes(48).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

export function createState(): string {
  return randomBytes(32).toString('base64url')
}

export function redirectUriFor(provider: SocialProvider, origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/social/oauth/${provider}/callback`
}

export function buildAuthorizeUrl(input: {
  provider: SocialProvider
  clientId: string
  redirectUri: string
  state: string
  codeChallenge?: string
  scopes?: string[]
}): string {
  const config = SOCIAL_OAUTH_CONFIG[input.provider]
  const url = new URL(config.authorizeUrl)
  const params = url.searchParams
  params.set('response_type', 'code')
  params.set('client_id', input.clientId)
  params.set('redirect_uri', input.redirectUri)
  params.set('state', input.state)
  params.set('scope', (input.scopes ?? REQUIRED_SCOPES[input.provider]).join(config.scopeSeparator))
  if (config.pkce && input.codeChallenge) {
    params.set('code_challenge', input.codeChallenge)
    params.set('code_challenge_method', 'S256')
  }
  for (const [key, value] of Object.entries(config.authorizeParams ?? {})) params.set(key, value)
  // TikTok identifies the app as client_key rather than client_id.
  if (input.provider === 'tiktok') {
    params.delete('client_id')
    params.set('client_key', input.clientId)
  }
  return url.toString()
}

export interface TokenSet {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  scopes: string[]
  meta: Record<string, unknown>
}

export class SocialAuthError extends Error {
  constructor(
    message: string,
    readonly provider: SocialProvider,
    readonly status: number,
    /** Safe support reference; never contains a token or secret. */
    readonly reference: string = randomBytes(6).toString('hex'),
  ) {
    super(message)
    this.name = 'SocialAuthError'
  }
}

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  try { return JSON.parse(text) as Record<string, unknown> } catch { return { raw: text.slice(0, 200) } }
}

function parseTokenResponse(provider: SocialProvider, status: number, body: Record<string, unknown>): TokenSet {
  // TikTok wraps the payload in { data: {...} }.
  const payload = (body.data && typeof body.data === 'object' ? body.data : body) as Record<string, unknown>
  const accessToken = payload.access_token as string | undefined
  if (!accessToken) {
    const detail = (payload.error_description ?? payload.error ?? payload.message ?? 'no access token returned') as string
    throw new SocialAuthError(`${provider} rejected the authorisation: ${detail}`, provider, status)
  }
  const expiresIn = Number(payload.expires_in ?? 0)
  const rawScope = payload.scope
  return {
    accessToken,
    refreshToken: (payload.refresh_token as string | undefined) ?? null,
    expiresAt: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null,
    scopes: Array.isArray(rawScope)
      ? rawScope as string[]
      : typeof rawScope === 'string' ? rawScope.split(/[,\s]+/).filter(Boolean) : [],
    meta: { open_id: payload.open_id, token_type: payload.token_type },
  }
}

async function postToken(
  provider: SocialProvider,
  credentials: ProviderCredentials,
  form: Record<string, string>,
): Promise<TokenSet> {
  const config = SOCIAL_OAUTH_CONFIG[provider]
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
    'User-Agent': 'CaptionFox-Social/1.0',
  }
  const body = new URLSearchParams(form)
  if (provider === 'tiktok') {
    body.set('client_key', credentials.clientId)
    body.set('client_secret', credentials.clientSecret)
  } else if (config.tokenAuth === 'basic') {
    headers.Authorization = `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')}`
  } else {
    body.set('client_id', credentials.clientId)
    body.set('client_secret', credentials.clientSecret)
  }
  const res = await fetch(config.tokenUrl, { method: 'POST', headers, body })
  return parseTokenResponse(provider, res.status, await safeJson(res))
}

export function exchangeCode(input: {
  provider: SocialProvider
  credentials: ProviderCredentials
  code: string
  redirectUri: string
  codeVerifier?: string
}): Promise<TokenSet> {
  const form: Record<string, string> = {
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
  }
  if (input.codeVerifier) form.code_verifier = input.codeVerifier
  return postToken(input.provider, input.credentials, form)
}

export function refreshAccessToken(input: {
  provider: SocialProvider
  credentials: ProviderCredentials
  refreshToken: string
}): Promise<TokenSet> {
  return postToken(input.provider, input.credentials, {
    grant_type: 'refresh_token',
    refresh_token: input.refreshToken,
  })
}
