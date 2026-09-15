import { NextResponse, type NextRequest } from 'next/server'
import { exchangeCode, providerCredentials, SocialAuthError } from '@/lib/social/oauth'
import { REQUIRED_SCOPES } from '@/lib/social/providers'
import { socialServiceClient } from '@/lib/social/service-client'
import { storeTokens } from '@/lib/social/vault'
import { SOCIAL_PROVIDERS, type SocialProvider } from '@/types/social'

export const runtime = 'nodejs'

function back(origin: string, returnTo: string, params: Record<string, string>) {
  const url = new URL(returnTo.startsWith('/') ? returnTo : '/app/social/connections', origin)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return NextResponse.redirect(url)
}

/**
 * Completes a channel connection. The state row proves the flow started in this
 * workspace for this user; it is single-use, so a replayed callback is rejected.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
  const { provider: raw } = await context.params
  if (!SOCIAL_PROVIDERS.includes(raw as SocialProvider)) {
    return back(origin, '/app/social/connections', { connect_error: 'Unknown provider.' })
  }
  const provider = raw as SocialProvider

  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const providerError = request.nextUrl.searchParams.get('error_description')
    ?? request.nextUrl.searchParams.get('error')

  const service = socialServiceClient()
  if (!state) return back(origin, '/app/social/connections', { connect_error: 'The authorisation response was missing its state.' })

  const { data: stateRow } = await service.from('social_oauth_states')
    .select('*').eq('state', state).maybeSingle()
  if (!stateRow) {
    return back(origin, '/app/social/connections', { connect_error: 'That authorisation link has already been used or has expired.' })
  }
  // Single use, whatever the outcome.
  await service.from('social_oauth_states').delete().eq('state', state)

  const returnTo = (stateRow.return_to as string) ?? '/app/social/connections'
  if (new Date(stateRow.expires_at as string) < new Date()) {
    return back(origin, returnTo, { connect_error: 'The authorisation timed out. Start the connection again.' })
  }
  if (stateRow.provider !== provider) {
    return back(origin, returnTo, { connect_error: 'The authorisation response did not match the requested provider.' })
  }
  if (providerError) return back(origin, returnTo, { connect_error: providerError.slice(0, 200) })
  if (!code) return back(origin, returnTo, { connect_error: 'The provider did not return an authorisation code.' })

  const credentials = providerCredentials(provider)
  if (!credentials) return back(origin, returnTo, { connect_error: `${provider} is no longer configured on this deployment.` })

  try {
    const tokens = await exchangeCode({
      provider, credentials, code,
      redirectUri: stateRow.redirect_uri as string,
      codeVerifier: (stateRow.code_verifier as string | null) ?? undefined,
    })

    const workspaceId = stateRow.workspace_id as string
    const granted = tokens.scopes.length ? tokens.scopes : (stateRow.requested_scopes as string[])
    const required = REQUIRED_SCOPES[provider]
    const missing = required.filter(scope => !granted.includes(scope))

    let channelId = stateRow.channel_id as string | null
    const patch = {
      workspace_id: workspaceId,
      platform: provider,
      granted_scopes: granted,
      required_scopes: required,
      token_status: 'valid' as const,
      token_expires_at: tokens.expiresAt?.toISOString() ?? null,
      health: missing.length ? ('warning' as const) : ('healthy' as const),
      permission_mode: missing.length ? ('read_only' as const) : ('read_write' as const),
      is_active: true,
      disconnected_at: null,
      connected_by: stateRow.user_id as string,
      updated_at: new Date().toISOString(),
    }

    if (channelId) {
      await service.from('social_channels').update(patch).eq('id', channelId).eq('workspace_id', workspaceId)
    } else {
      // The account profile is filled in by the first sync; the connection is
      // created immediately so the user sees it and its scopes right away.
      const { data: created, error } = await service.from('social_channels').insert({
        ...patch,
        account_name: `${provider} account`,
        connected_at: new Date().toISOString(),
      }).select('id').single()
      if (error || !created) return back(origin, returnTo, { connect_error: 'The connection could not be saved.' })
      channelId = created.id
    }

    await storeTokens({ channelId: channelId!, workspaceId, tokens })

    await service.from('social_connection_issues')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('channel_id', channelId).eq('status', 'open')
      .in('issue_type', ['token_expired', 'token_expiring', 'account_disconnected'])

    if (missing.length) {
      await service.from('social_connection_issues').insert({
        workspace_id: workspaceId, channel_id: channelId,
        issue_type: 'missing_permission', severity: 'warning',
        message: `Missing ${missing.length} required permission${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 4).join(', ')}`,
        action_kind: 'update_scopes',
      })
    }

    await service.from('social_sync_runs').insert({
      workspace_id: workspaceId, channel_id: channelId,
      kind: 'profile', trigger_source: 'reconnect', status: 'running',
      triggered_by: stateRow.user_id as string,
    })

    await service.from('social_activity').insert({
      workspace_id: workspaceId,
      actor_id: stateRow.user_id as string,
      action: 'social.connection.connected',
      entity_type: 'social_channel',
      entity_id: channelId,
      channel_id: channelId,
      summary: `Connected a ${provider} channel`,
      detail: missing.length ? `${missing.length} requested permission(s) were not granted.` : 'All required permissions granted.',
      href: '/app/social/connections',
      severity: missing.length ? 'warning' : 'success',
    })

    return back(origin, returnTo, { connected: provider })
  } catch (error) {
    const message = error instanceof SocialAuthError
      ? `${error.message} (ref ${error.reference})`
      : 'The provider rejected the authorisation.'
    return back(origin, returnTo, { connect_error: message.slice(0, 300) })
  }
}
