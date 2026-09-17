import { NextResponse, type NextRequest } from 'next/server'
import { getSocialSession } from '@/lib/social/server'
import { canAccessSocialCapability, canConnectAnotherChannel } from '@/lib/social/entitlements'
import { PERMISSIONS } from '@/lib/permissions'
import { encryptionAvailable } from '@/lib/social/crypto'
import {
  buildAuthorizeUrl, createPkce, createState, providerCredentials,
  redirectUriFor, SOCIAL_OAUTH_CONFIG,
} from '@/lib/social/oauth'
import { REQUIRED_SCOPES } from '@/lib/social/providers'
import { socialServiceClient } from '@/lib/social/service-client'
import { SOCIAL_PROVIDERS, type SocialProvider } from '@/types/social'

export const runtime = 'nodejs'

/**
 * Begins a channel connection. The authorize URL is built server-side and the
 * state (plus PKCE verifier) is stored server-side, so the browser never sees
 * a client secret and a forged callback cannot be replayed.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider: raw } = await context.params
  if (!SOCIAL_PROVIDERS.includes(raw as SocialProvider)) {
    return NextResponse.json({ error: 'Unknown provider.' }, { status: 404 })
  }
  const provider = raw as SocialProvider

  const session = await getSocialSession()
  const access = canAccessSocialCapability(session.ctx, PERMISSIONS.SOCIAL_CONNECTIONS_CONNECT)
  if (!access.allowed) return NextResponse.json({ error: access.message }, { status: 403 })

  const quota = canConnectAnotherChannel(session.ctx)
  if (!quota.allowed) return NextResponse.json({ error: quota.message, upgrade: true }, { status: 402 })

  if (!encryptionAvailable()) {
    return NextResponse.json({
      error: 'Credential encryption is not configured on this deployment. Set SOCIAL_ENCRYPTION_KEY before connecting a channel.',
    }, { status: 503 })
  }

  const credentials = providerCredentials(provider)
  if (!credentials) {
    const config = SOCIAL_OAUTH_CONFIG[provider]
    return NextResponse.json({
      error: `${provider} is not configured on this deployment. Add ${config.clientIdEnv} and ${config.clientSecretEnv}, created at ${config.consoleUrl}.`,
      setupUrl: config.consoleUrl,
    }, { status: 503 })
  }

  const body = await request.json().catch(() => ({})) as { channelId?: string; returnTo?: string }
  if (body.channelId) {
    const { data } = await session.supabase.from('social_channels')
      .select('id').eq('id', body.channelId).eq('workspace_id', session.ctx.workspaceId).maybeSingle()
    if (!data) return NextResponse.json({ error: 'That channel is not available in this workspace.' }, { status: 404 })
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
  const redirectUri = redirectUriFor(provider, origin)
  const state = createState()
  const pkce = SOCIAL_OAUTH_CONFIG[provider].pkce ? createPkce() : null
  const scopes = REQUIRED_SCOPES[provider]

  await socialServiceClient().from('social_oauth_states').insert({
    state,
    workspace_id: session.ctx.workspaceId,
    user_id: session.userId,
    provider,
    code_verifier: pkce?.verifier ?? null,
    redirect_uri: redirectUri,
    requested_scopes: scopes,
    channel_id: body.channelId ?? null,
    // Only a path inside this workspace's Social module is accepted as a return target.
    return_to: typeof body.returnTo === 'string' && body.returnTo.startsWith(`${session.basePath}/`) && !body.returnTo.includes('//')
      ? body.returnTo
      : `${session.basePath}/connections`,
  })

  return NextResponse.json({
    authorizeUrl: buildAuthorizeUrl({
      provider, clientId: credentials.clientId, redirectUri, state,
      codeChallenge: pkce?.challenge, scopes,
    }),
  })
}
