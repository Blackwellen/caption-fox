import type { Metadata } from 'next'
import Link from 'next/link'
import { requireActiveGrant } from '@/lib/affiliate-grant'
import { DIRECT_COMMISSION_RATE, OVERRIDE_COMMISSION_RATE } from '@/lib/affiliate'
import { AffiliateCard, AffiliatePage, AffiliateStat } from '@/components/affiliate/portal/AffiliatePortalUI'

export const metadata: Metadata = { title: 'Programme — Affiliate Portal' }

export default async function ProgrammePage({ params }: { params: Promise<{ grantId: string }> }) {
  const grant = await requireActiveGrant((await params).grantId)
  const joined = new Date(grant.affiliate.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <AffiliatePage title="Programme" description="How the Caption Fox affiliate programme pays you.">
      <div className="grid gap-4 sm:grid-cols-3">
        <AffiliateStat label="Direct commission" value={`${Math.round(DIRECT_COMMISSION_RATE * 100)}%`} hint="of a referred customer's first payment" />
        <AffiliateStat label="Override commission" value={`${Math.round(OVERRIDE_COMMISSION_RATE * 100)}%`} hint="of your sub-affiliates' sales" />
        <AffiliateStat label="Member since" value={joined} />
      </div>
      <AffiliateCard title="Programme terms">
        <ul className="list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-shell-text-2">
          <li>Share your personal referral link or code. Customers who sign up through it are attributed to you.</li>
          <li>Commission is earned when a referred customer converts to a paid plan and is shown as pending until then.</li>
          <li>Affiliates you recruit earn you an override on their sales for as long as both accounts remain active.</li>
          <li>Suspended affiliate accounts do not earn commission on new referrals.</li>
        </ul>
        <Link href="/legal/affiliate-terms" className="mt-4 inline-flex text-[13.5px] font-semibold text-shell-blue hover:underline">
          Read the full affiliate terms
        </Link>
      </AffiliateCard>
    </AffiliatePage>
  )
}
