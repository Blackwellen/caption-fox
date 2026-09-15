import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolvePostAuthDestination } from '@/lib/auth/post-auth'

// Single post-authentication router: every sign-in, sign-up verification and
// OAuth return lands here and is sent to the right place server-side
// (invite → onboarding → safe returnTo → workspace/supplier home).
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const login = new URL('/login', url.origin)
    const next = url.searchParams.get('next')
    if (next) login.searchParams.set('next', next)
    return NextResponse.redirect(login)
  }

  const destination = await resolvePostAuthDestination(supabase, user, {
    next: url.searchParams.get('next'),
    invite: url.searchParams.get('invite'),
    type: url.searchParams.get('type'),
  })
  return NextResponse.redirect(new URL(destination, url.origin))
}
