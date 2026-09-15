import 'server-only'
import { serviceClient } from './service-client'
import { decryptRecord, decryptSecret, encryptRecord, encryptSecret, encryptionAvailable } from './crypto'
import { AD_PROVIDERS, type AdProvider } from './providers'
import {
  OAUTH_CONFIG, extendMetaToken, refreshAccessToken, resolveApiBase,
  tokenNeedsRefresh, type TokenSet,
} from './oauth'
import type { AdapterContext } from './clients/types'

// Credential lifecycle for advertising connections.
//
// Everything here runs with the service role because ad_provider_apps and
// ad_connection_secrets have no RLS policy. Callers MUST have verified
// workspace membership first (see assertMembership).

export type ProviderApp = {
  id: string
  workspaceId: string
  provider: AdProvider
  clientId: string
  clientSecret: string
  extras: Record<string, string>
  redirectUri: string
}

export type ProviderAppSummary = {
  provider: AdProvider
  configured: boolean
  verifiedAt: string | null
  redirectUri: string | null
  lastError: string | null
}

/** Non-secret view of which providers a workspace has registered an app for. */
export async function listProviderApps(workspaceId: string): Promise<ProviderAppSummary[]> {
  const { data } = await serviceClient()
    .from('ad_provider_apps')
    .select('provider, verified_at, redirect_uri, last_error, client_id')
    .eq('workspace_id', workspaceId)

  const byProvider = new Map((data ?? []).map(row => [row.provider as AdProvider, row]))
  return (Object.keys(AD_PROVIDERS) as AdProvider[]).map(provider => {
    const row = byProvider.get(provider)
    return {
      provider,
      configured: !!row?.client_id,
      verifiedAt: row?.verified_at ?? null,
      redirectUri: row?.redirect_uri ?? null,
      lastError: row?.last_error ?? null,
    }
  })
}

export async function saveProviderApp(input: {
  workspaceId: string
  provider: AdProvider
  clientId: string
  clientSecret: string
  extras: Record<string, string>
  redirectUri: string
  configuredBy: string
}): Promise<void> {
  if (!encryptionAvailable()) {
    throw new Error('Credential encryption is not configured on this server. Set ADVERTISING_ENCRYPTION_KEY.')
  }
  const { error } = await serviceClient().from('ad_provider_apps').upsert({
    workspace_id: input.workspaceId,
    provider: input.provider,
    client_id: input.clientId.trim(),
    client_secret_encrypted: encryptSecret(input.clientSecret.trim()),
    extra_encrypted: encryptRecord(input.extras),
    redirect_uri: input.redirectUri,
    configured_by: input.configuredBy,
    last_error: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id,provider' })
  if (error) throw new Error(`Could not save the ${AD_PROVIDERS[input.provider].name} app credentials.`)
}

export async function deleteProviderApp(workspaceId: string, provider: AdProvider): Promise<void> {
  await serviceClient().from('ad_provider_apps').delete()
    .eq('workspace_id', workspaceId).eq('provider', provider)
}

export async function loadProviderApp(workspaceId: string, provider: AdProvider): Promise<ProviderApp | null> {
  const { data } = await serviceClient()
    .from('ad_provider_apps')
    .select('id, client_id, client_secret_encrypted, extra_encrypted, redirect_uri')
    .eq('workspace_id', workspaceId).eq('provider', provider)
    .maybeSingle()
  if (!data) return null

  return {
    id: data.id as string,
    workspaceId,
    provider,
    clientId: data.client_id as string,
    clientSecret: decryptSecret(data.client_secret_encrypted as string),
    extras: decryptRecord(data.extra_encrypted as Record<string, string> | null),
    redirectUri: data.redirect_uri as string,
  }
}

/** Records a setup failure so the Accounts page can show what went wrong. */
export async function recordAppError(workspaceId: string, provider: AdProvider, message: string): Promise<void> {
  await serviceClient().from('ad_provider_apps')
    .update({ last_error: message.slice(0, 400), updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId).eq('provider', provider)
}

// ------------------------------------------------------------ OAuth state

export async function saveOAuthState(input: {
  state: string
  workspaceId: string
  provider: AdProvider
  userId: string
  codeVerifier: string | null
  redirectAfter: string
}): Promise<void> {
  await serviceClient().from('ad_oauth_states').insert({
    state: input.state,
    workspace_id: input.workspaceId,
    provider: input.provider,
    user_id: input.userId,
    code_verifier: input.codeVerifier,
    redirect_after: input.redirectAfter,
    // Ten minutes is long enough for consent screens, short enough to bound replay.
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  })
}

export type ConsumedState = {
  workspaceId: string
  provider: AdProvider
  userId: string
  codeVerifier: string | null
  redirectAfter: string
}

/** Single-use: a state already consumed or expired is rejected. */
export async function consumeOAuthState(state: string): Promise<ConsumedState | null> {
  const client = serviceClient()
  const { data } = await client
    .from('ad_oauth_states')
    .select('workspace_id, provider, user_id, code_verifier, redirect_after, expires_at, consumed_at')
    .eq('state', state)
    .maybeSingle()

  if (!data) return null
  if (data.consumed_at) return null
  if (new Date(data.expires_at as string).getTime() < Date.now()) return null

  await client.from('ad_oauth_states')
    .update({ consumed_at: new Date().toISOString() })
    .eq('state', state)

  return {
    workspaceId: data.workspace_id as string,
    provider: data.provider as AdProvider,
    userId: data.user_id as string,
    codeVerifier: (data.code_verifier as string | null) ?? null,
    redirectAfter: (data.redirect_after as string) ?? '/',
  }
}

export async function pruneOAuthStates(): Promise<void> {
  await serviceClient().from('ad_oauth_states').delete().lt('expires_at', new Date().toISOString())
}

// ------------------------------------------------------- connection tokens

export async function storeConnectionTokens(connectionId: string, workspaceId: string, tokens: TokenSet): Promise<void> {
  await serviceClient().from('ad_connection_secrets').upsert({
    connection_id: connectionId,
    workspace_id: workspaceId,
    access_token_encrypted: encryptSecret(tokens.accessToken),
    refresh_token_encrypted: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
    token_expires_at: tokens.expiresAt?.toISOString() ?? null,
    rotated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'connection_id' })
}

export class ReauthorisationRequired extends Error {
  constructor(readonly provider: AdProvider) {
    super(`The ${AD_PROVIDERS[provider].name} connection needs to be authorised again.`)
    this.name = 'ReauthorisationRequired'
  }
}

/**
 * Returns a usable access token, refreshing it first when it is close to
 * expiry. Throws ReauthorisationRequired when the provider cannot refresh, so
 * the caller can mark the connection and surface a reconnect action.
 */
export async function getFreshAccessToken(input: {
  workspaceId: string
  connectionId: string
  provider: AdProvider
}): Promise<{ accessToken: string; extras: Record<string, string> }> {
  const client = serviceClient()
  const { data } = await client
    .from('ad_connection_secrets')
    .select('access_token_encrypted, refresh_token_encrypted, token_expires_at')
    .eq('connection_id', input.connectionId)
    .maybeSingle()

  if (!data?.access_token_encrypted) throw new ReauthorisationRequired(input.provider)

  const app = await loadProviderApp(input.workspaceId, input.provider)
  if (!app) throw new ReauthorisationRequired(input.provider)

  const accessToken = decryptSecret(data.access_token_encrypted as string)
  const expiresAt = data.token_expires_at as string | null

  if (!tokenNeedsRefresh(input.provider, expiresAt)) {
    return { accessToken, extras: { ...app.extras, client_id: app.clientId } }
  }

  const config = OAUTH_CONFIG[input.provider]
  const refreshToken = data.refresh_token_encrypted
    ? decryptSecret(data.refresh_token_encrypted as string)
    : null

  let refreshed: TokenSet
  try {
    if (input.provider === 'meta') {
      refreshed = await extendMetaToken({ clientId: app.clientId, clientSecret: app.clientSecret, accessToken })
    } else if (config.refreshable && refreshToken) {
      refreshed = await refreshAccessToken({
        provider: input.provider, clientId: app.clientId, clientSecret: app.clientSecret,
        refreshToken, extras: app.extras,
      })
    } else {
      throw new ReauthorisationRequired(input.provider)
    }
  } catch (error) {
    if (error instanceof ReauthorisationRequired) throw error
    await markConnectionExpired(input.connectionId, input.provider)
    throw new ReauthorisationRequired(input.provider)
  }

  // A refresh grant does not always return a new refresh token; keep the old.
  await storeConnectionTokens(input.connectionId, input.workspaceId, {
    ...refreshed,
    refreshToken: refreshed.refreshToken ?? refreshToken,
  })

  return { accessToken: refreshed.accessToken, extras: { ...app.extras, client_id: app.clientId } }
}

async function markConnectionExpired(connectionId: string, provider: AdProvider): Promise<void> {
  const client = serviceClient()
  await client.from('ad_connections')
    .update({ status: 'expired', last_error: 'Authorisation expired and could not be refreshed.', updated_at: new Date().toISOString() })
    .eq('id', connectionId)
  const { data } = await client.from('ad_connections')
    .select('workspace_id').eq('id', connectionId).maybeSingle()
  if (data?.workspace_id) {
    await client.from('ad_issues').insert({
      workspace_id: data.workspace_id,
      connection_id: connectionId,
      provider,
      severity: 'critical',
      issue_type: 'auth_expired',
      title: `${AD_PROVIDERS[provider].name} authorisation expired`,
      detail: 'The stored authorisation could not be refreshed automatically.',
      required_action: 'Reconnect the account to restore reporting and sync.',
    })
  }
}

/** Builds the adapter context for a provider call. */
export async function adapterContextFor(input: {
  workspaceId: string
  connectionId: string
  provider: AdProvider
  accountExtras?: Record<string, string>
  signal?: AbortSignal
}): Promise<AdapterContext> {
  const { accessToken, extras } = await getFreshAccessToken(input)
  const merged = { ...extras, ...(input.accountExtras ?? {}) }
  return {
    provider: input.provider,
    accessToken,
    extras: merged,
    apiBase: resolveApiBase(input.provider, merged),
    signal: input.signal,
  }
}
