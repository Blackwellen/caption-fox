import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Hourglass, MessageSquareWarning, ShieldX, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AuthHeader, Atmosphere } from '@/components/auth/AuthShell'
import { SignOutButton } from '@/components/auth/SignOutButton'

export const metadata: Metadata = { title: 'Affiliate portal — Caption Fox' }

// Affiliate-only home. Metrics are only rendered after the affiliates row is
// verified server-side; everyone else sees their application status.
export default async function AffiliatePortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/affiliates/login')

  const { data: affiliate } = await supabase.from('affiliates').select('id').eq('user_id', user.id).maybeSingle()
  // Approved affiliates use the grant-scoped portal inside the app shell.
  if (affiliate) redirect(`/affiliate-portal/${affiliate.id}`)

  const header = <AuthHeader right={<div className="flex items-center gap-3"><span className="hidden text-[14px] text-cf-muted sm:inline">{user.email}</span><SignOutButton redirectTo="/affiliates/login" /></div>} />

  const { data: app } = await supabase
    .from('affiliate_applications')
    .select('status, review_note, submitted_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const status = (app?.status as string | undefined) ?? 'none'
  const view = {
    pending: { icon: Hourglass, title: 'Your affiliate application is still under review.', body: 'Our partnerships team reviews every application by hand. We’ll email you as soon as a decision is made.', cta: null },
    needs_info: { icon: MessageSquareWarning, title: 'We need a little more information', body: app?.review_note ? `Our team asked: “${app.review_note}”` : 'Our team needs more details before approving your application.', cta: { href: '/affiliates/signup', label: 'Update your application' } },
    draft: { icon: UserPlus, title: 'Finish your affiliate application', body: 'You’ve started an application but haven’t submitted it yet.', cta: { href: '/affiliates/signup', label: 'Continue application' } },
    rejected: { icon: ShieldX, title: 'Your application wasn’t approved', body: 'This time we weren’t able to approve your application. Contact support if your circumstances have changed.', cta: { href: '/contact', label: 'Contact support' } },
    none: { icon: UserPlus, title: 'This account isn’t an affiliate yet', body: 'Apply to the Caption Fox affiliate program — every application is reviewed by our partnerships team.', cta: { href: '/affiliates/signup', label: 'Apply as an affiliate' } },
  }[status] ?? { icon: UserPlus, title: 'This account isn’t an affiliate yet', body: 'Apply to the Caption Fox affiliate program.', cta: { href: '/affiliates/signup', label: 'Apply as an affiliate' } }
  const Icon = view.icon

  return (
    <div className="min-h-screen bg-white">
      {header}
      <main id="main" className="relative flex min-h-[calc(100vh-82px)] items-start justify-center px-4 py-12 sm:py-20">
        <Atmosphere />
        <section className="cf-pop relative w-full max-w-[520px] rounded-[28px] border border-cf-line-strong/80 bg-white px-6 py-10 text-center shadow-cf-float sm:px-10" aria-live="polite">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cf-tint-2 text-cf-blue"><Icon size={30} aria-hidden /></span>
          <p className="mt-6 text-[13px] font-semibold uppercase tracking-[0.22em] text-cf-blue">Affiliate portal</p>
          <h1 className="mt-2 text-[26px] font-bold leading-tight tracking-tight text-cf-ink">{view.title}</h1>
          <p className="mt-3 text-[16px] leading-snug text-cf-muted">{view.body}</p>
          {view.cta && (
            <Link href={view.cta.href} className="mt-7 inline-flex h-12 items-center rounded-[10px] bg-cf-blue px-6 text-[16px] font-medium text-white shadow-cf-button hover:bg-cf-blue-deep">{view.cta.label}</Link>
          )}
        </section>
      </main>
    </div>
  )
}
