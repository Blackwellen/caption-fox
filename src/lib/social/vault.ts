import 'server-only'
import { socialServiceClient } from './service-client'
import { decryptSecret, encryptSecret } from './crypto'
import { providerCredentials, refreshAccessToken, SOCIAL_OAUTH_CONFIG, type TokenSet } from './oauth'
import type { SocialProvider } from '@/types/social'

// Provider token vault. Tokens are AES-256-GCM encrypted at rest in
// social_channel_secrets (no RLS policy - service role only) and are never
// returned to the browser or written into any log or activity record.

export async function storeTokens(input: {
  channelId: string
  workspaceId: string
  tokens: TokenSet
}): Promise<void> {
  await socialServiceClient().from('social_channel_secrets').upsert({
    channel_id: input.channelId,
    workspace_id: input.workspaceId,
    access_token_encrypted: encryptSecret(input.tokens.accessToken),
    refresh_token_encrypted: input.tokens.refreshToken ? encryptSecret(input.tokens.refreshToken) : null,
    expires_at: input.tokens.expiresAt?.toISOString() ?? null,
    scopes: input.tokens.scopes,
    rotated_at: new Date().toISOString(),
  }, { onConflict: 'channel_id' })
}

export interface LiveToken { accessToken: string; expiresAt: Date | null }

/**
 * Returns a usable access token, refreshing it first when the provider supports
 * refresh and the token is inside its expiry skew. Returns null when the
 * channel needs re-authorisation - callers surface that as a connection issue
 * rather than attempting the provider call.
 */
export async function getLiveToken(channelId: string, provider: SocialProvider): Promise<LiveToken | null> {
  const service = socialServiceClient()
  const { data } = await service.from('social_channel_secrets')
    .select('workspace_id, access_token_encrypted, refresh_token_encrypted, expires_at')
    .eq('channel_id', channelId).maybeSingle()
  if (!data) return null

  const expiresAt = data.expires_at ? new Date(data.expires_at) : null
  const skewMs = 5 * 60 * 1000
  const stale = expiresAt !== null && expiresAt.getTime() - Date.now() < skewMs

  if (!stale) {
    try { return { accessToken: decryptSecret(data.access_token_encrypted), expiresAt } } catch { return null }
  }

  const config = SOCIAL_OAUTH_CONFIG[provider]
  const credentials = providerCredentials(provider)
  if (!config.refreshable || !data.refresh_token_encrypted || !credentials) return null

  try {
    const refreshed = await refreshAccessToken({
      provider, credentials, refreshToken: decryptSecret(data.refresh_token_encrypted),
    })
    await storeTokens({ channelId, workspaceId: data.workspace_id, tokens: refreshed })
    return { accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt }
  } catch {
    await service.from('social_channels')
      .update({ token_status: 'expired', health: 'expired', updated_at: new Date().toISOString() })
      .eq('id', channelId)
    await service.from('social_connection_issues').insert({
      workspace_id: data.workspace_id, channel_id: channelId,
      issue_type: 'token_expired', severity: 'error',
      message: 'The access token expired and could not be refreshed.',
      action_kind: 'renew_token',
    })
    return null
  }
}

export async function clearTokens(channelId: string): Promise<void> {
  await socialServiceClient().from('social_channel_secrets').delete().eq('channel_id', channelId)
}
