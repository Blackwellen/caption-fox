import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { CircleAlert, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { safeInviteToken } from '@/lib/auth/redirect'
import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/workspace-shared'
import { AuthHeader, Atmosphere } from '@/components/auth/AuthShell'

export const metadata: Metadata = { title: 'Join a workspace — Caption Fox', robots: { index: false } }

const ERRORS: Record<string, string> = {
  email: 'This invitation was sent to a different email address. Sign in with the invited email to accept it.',
  expired: 'This invitation has expired. Ask the workspace owner to send a new one.',
  used: 'This invitation has already been used.',
  failed: 'We couldn’t accept this invitation. Try again.',
}

async function accept(formData: FormData) {
  'use server'
  const token = safeInviteToken(String(formData.get('token') ?? ''))
  if (!token) redirect('/login')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('accept_invitation', { p_token: token })
  if (error || !data) {
    const m = error?.message ?? ''
    const code = m.includes('different email') ? 'email' : m.includes('expired') ? 'expired' : m.includes('already used') ? 'used' : 'failed'
    redirect(`/invite/${token}?error=${code}`)
  }
  const store = await cookies()
  store.set(ACTIVE_WORKSPACE_COOKIE, String(data), { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  redirect('/app/home')
}

const ROLE_LABEL: Record<string, string> = { owner: 'Admin', admin: 'Admin', manager: 'Manager', member: 'Member', viewer: 'Viewer', ugc_creator: 'UGC creator' }

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token: rawToken } = await params
  const { error } = await searchParams
  const token = safeInviteToken(rawToken)
  const supabase = await createClient()
  const [{ data: { user } }, invite] = await Promise.all([
    supabase.auth.getUser(),
    token ? supabase.rpc('get_invitation', { p_token: token }).then(r => (Array.isArray(r.data) ? r.data[0] : null) as { workspace_name: string; role: string; email_hint: string; status: string } | null) : Promise.resolve(null),
  ])

  const unusable = !invite || invite.status !== 'pending'

  return (
    <div className="min-h-screen bg-white">
      <AuthHeader />
      <main id="main" className="relative flex justify-center px-4 py-12 sm:py-20">
        <Atmosphere />
        <section className="cf-pop relative w-full max-w-[520px] rounded-[28px] border border-cf-line-strong/80 bg-white px-6 py-10 text-center shadow-cf-float sm:px-10">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cf-tint-2 text-cf-blue">{unusable ? <CircleAlert size={30} aria-hidden /> : <UserPlus size={30} aria-hidden />}</span>
          <p className="mt-6 text-[13px] font-semibold uppercase tracking-[0.22em] text-cf-blue">Workspace invitation</p>
          {unusable ? (
            <>
              <h1 className="mt-2 text-[26px] font-bold tracking-tight text-cf-ink">{invite?.status === 'expired' ? 'This invitation has expired' : invite?.status === 'accepted' ? 'Invitation already accepted' : 'Invitation not found'}</h1>
              <p className="mt-3 text-[16px] text-cf-muted">Ask the workspace owner to send you a new invitation.</p>
              <Link href={user ? '/continue' : '/login'} className="mt-7 inline-flex h-12 items-center rounded-[10px] bg-cf-blue px-6 font-medium text-white">{user ? 'Continue' : 'Sign in'}</Link>
            </>
          ) : (
            <>
              <h1 className="mt-2 text-[26px] font-bold leading-tight tracking-tight text-cf-ink">Join {invite.workspace_name} on Caption Fox</h1>
              <p className="mt-3 text-[16px] text-cf-muted">You’ve been invited as <strong className="font-semibold text-cf-ink">{ROLE_LABEL[invite.role] ?? invite.role}</strong>. This invitation was sent to {invite.email_hint}.</p>
              {error && ERRORS[error] && <p role="alert" className="mt-5 rounded-xl border border-[#F5C2C0] bg-[#FFF5F5] px-4 py-3 text-left text-[14px] text-[#9B1C1C]">{ERRORS[error]}</p>}
              {user ? (
                <form action={accept} className="mt-7">
                  <input type="hidden" name="token" value={token ?? ''} />
                  <button className="inline-flex h-12 w-full items-center justify-center rounded-[10px] bg-cf-blue px-6 text-[17px] font-medium text-white shadow-cf-button hover:bg-cf-blue-deep">Accept invitation</button>
                  <p className="mt-3 text-[14px] text-cf-muted">Signed in as {user.email}</p>
                </form>
              ) : (
                <div className="mt-7 grid gap-3">
                  <Link href={`/login?invite=${token}`} className="inline-flex h-12 items-center justify-center rounded-[10px] bg-cf-blue px-6 text-[17px] font-medium text-white shadow-cf-button">Sign in to accept</Link>
                  <Link href={`/signup?invite=${token}`} className="inline-flex h-12 items-center justify-center rounded-[10px] border border-cf-line-strong px-6 text-[17px] font-medium text-cf-ink">Create an account</Link>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}
