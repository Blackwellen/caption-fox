import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { safeNext } from '@/lib/auth/redirect'

// Email-verification and OAuth return. `next` is validated so a crafted link
// can't bounce a freshly authenticated user to another origin.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'), '/continue')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  const reason = searchParams.get('error_code') === 'otp_expired' ? 'link_expired' : 'auth_callback_failed'
  return NextResponse.redirect(`${origin}/login?error=${reason}`)
}
