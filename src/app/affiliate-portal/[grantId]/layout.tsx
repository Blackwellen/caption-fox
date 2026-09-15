import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ShieldX } from 'lucide-react'
import { loadAffiliateGrant } from '@/lib/affiliate-grant'
import { getNavigationForContext } from '@/lib/navigation/resolver'
import { initialsFor } from '@/lib/navigation/session'
import { readNavCollapsed } from '@/lib/shell/nav-preference'
import { referralLink } from '@/lib/affiliate'
import { APP_URL } from '@/lib/constants'
import CaptionFoxAppShell from '@/components/shell/app-shell/CaptionFoxAppShell'

/**
 * Affiliate Portal — a grant-scoped portal, not a workspace. It never receives
 * workspace navigation, workspace switching or workspace notifications.
 */
export default async function AffiliatePortalLayout({
  children, params,
}: {
  children: React.ReactNode
  params: Promise<{ grantId: string }>
}) {
  const { grantId } = await params
  const grant = await loadAffiliateGrant(grantId)
  if (grant.state === 'signed-out') redirect('/affiliates/login')
  if (grant.state === 'not-found') notFound()

  const collapsed = await readNavCollapsed(grant.userId)
  const name = grant.fullName ?? grant.email?.split('@')[0] ?? 'Affiliate'

  return (
    <CaptionFoxAppShell
      nav={getNavigationForContext({ context: 'affiliate', grantId: grant.affiliate.id })}
      user={{ name, email: grant.email, initials: initialsFor(grant.fullName, grant.email), secondary: `Affiliate · ${grant.affiliate.code}` }}
      context={{ kind: 'affiliate', label: 'Affiliate Portal', badge: 'Affiliate Portal' }}
      userId={grant.userId}
      notifications={[]}
      initialCollapsed={collapsed}
      copyValue={grant.state === 'active' ? referralLink(APP_URL, grant.affiliate.code) : null}
    >
      {grant.state === 'active' ? children : (
        <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><ShieldX size={26} aria-hidden /></span>
          <h1 className="mt-5 text-[22px] font-bold tracking-tight text-shell-text">Portal access is paused</h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-shell-text-2">
            Your affiliate account is suspended, so programme links, assets and commission records are no longer shared with you.
            New referrals will not earn commission while access is paused.
          </p>
          <Link href="/contact" className="mt-6 inline-flex h-10 items-center rounded-[10px] bg-shell-blue px-4 text-[14px] font-semibold text-white hover:bg-shell-blue-hover">
            Contact support
          </Link>
        </div>
      )}
    </CaptionFoxAppShell>
  )
}
