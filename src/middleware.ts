import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// "Remember me" unchecked → cf_remember=0 (persistent) + cf_alive (session
// cookie). Once the browser session ends cf_alive disappears and the next
// request signs the user out.
const REMEMBER_COOKIE = 'cf_remember'
const ALIVE_COOKIE = 'cf_alive'

// Layouts cannot see the request path; the shell needs it to preserve deep
// links through sign-in and to keep the URL on the active workspace type.
const PATH_HEADER = 'x-cf-pathname'

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(PATH_HEADER, request.nextUrl.pathname)
  const forward = () => NextResponse.next({ request: { headers: requestHeaders } })
  let supabaseResponse = forward()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // Keep the forwarded headers in sync with the refreshed auth cookies.
          requestHeaders.set('cookie', request.cookies.toString())
          supabaseResponse = forward()
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname, search } = request.nextUrl

  const redirectTo = (path: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone()
    url.pathname = path
    url.search = ''
    for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v)
    return NextResponse.redirect(url)
  }

  if (user && request.cookies.get(REMEMBER_COOKIE)?.value === '0' && !request.cookies.get(ALIVE_COOKIE)) {
    await supabase.auth.signOut({ scope: 'local' })
    const res = redirectTo('/login', { reason: 'session_ended' })
    supabaseResponse.cookies.getAll().forEach(cookie => res.cookies.set(cookie))
    res.cookies.delete(REMEMBER_COOKIE)
    return res
  }

  // Protect /app/* — redirect to login if unauthenticated
  if (!user && pathname.startsWith('/app')) {
    return redirectTo('/login', { next: pathname + search })
  }

  // Protect /admin/* — redirect to the admin-only sign-in if unauthenticated
  // (not /login: platform admin, workspace users and affiliates use separate
  // sign-in pages even though they share one Supabase auth backend).
  if (!user && pathname.startsWith('/admin') && pathname !== '/admin-login') {
    return redirectTo('/admin-login', { next: pathname })
  }

  if (!user && pathname.startsWith('/onboarding')) {
    return redirectTo('/login', { next: pathname + search })
  }

  // Every workspace-type and supplier route is authenticated; deep links
  // (sub-tab + filters) survive the sign-in round trip.
  if (!user && /^\/(creator|business|brand|agency|supplier)(\/|$)/.test(pathname)) {
    return redirectTo('/login', { next: pathname + search })
  }

  if (!user && pathname.startsWith('/affiliate-portal')) {
    return redirectTo('/affiliates/login')
  }

  if (!user && pathname.startsWith('/affiliates/portal')) {
    return redirectTo('/affiliates/login')
  }

  // Signed-in users skip the sign-in/registration screens. /admin-login stays
  // reachable (a signed-in non-admin must still be able to prove admin access
  // with MFA), as does /affiliates/signup (existing users can apply).
  if (user && ['/login', '/signup', '/forgot-password'].includes(pathname)) {
    const params: Record<string, string> = {}
    const next = request.nextUrl.searchParams.get('next')
    const invite = request.nextUrl.searchParams.get('invite')
    if (next) params.next = next
    if (invite) params.invite = invite
    return redirectTo('/continue', params)
  }
  if (user && pathname === '/affiliates/login') {
    return redirectTo('/affiliates/portal')
  }

  // Old /dashboard route redirect
  if (pathname.startsWith('/dashboard')) {
    return redirectTo('/app/home')
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
