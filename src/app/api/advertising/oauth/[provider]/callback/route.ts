import { NextResponse, type NextRequest } from 'next/server'
import { completeConnectAction } from '@/lib/advertising/actions'

// OAuth callback for every ad platform. The provider segment is informational
// only — the state token is what ties the callback back to the workspace,
// user and PKCE verifier that started the flow, so this route never trusts the
// `provider` path segment for anything security-relevant.

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const providerError = url.searchParams.get('error_description') ?? url.searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin

  if (providerError) {
    return NextResponse.redirect(`${appUrl}/?advertisingError=${encodeURIComponent(providerError)}`)
  }
  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/?advertisingError=${encodeURIComponent('The advertising platform did not return an authorisation code.')}`)
  }

  const result = await completeConnectAction({ state, code })
  const destination = result.ok ? result.redirectTo : result.redirectTo
  const query = result.ok
    ? 'connected=1'
    : `advertisingError=${encodeURIComponent(result.error)}`

  return NextResponse.redirect(`${appUrl}${destination}${destination.includes('?') ? '&' : '?'}${query}`)
}
