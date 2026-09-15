import type { Metadata } from 'next'
import { requireActiveGrant } from '@/lib/affiliate-grant'
import { referralLink } from '@/lib/affiliate'
import { APP_URL } from '@/lib/constants'
import CopyField from '@/components/affiliate/portal/CopyField'
import { AffiliateCard, AffiliatePage } from '@/components/affiliate/portal/AffiliatePortalUI'

export const metadata: Metadata = { title: 'Links & Codes — Affiliate Portal' }

export default async function LinksPage({ params }: { params: Promise<{ grantId: string }> }) {
  const grant = await requireActiveGrant((await params).grantId)
  const link = referralLink(APP_URL, grant.affiliate.code)

  return (
    <AffiliatePage title="Links & Codes" description="Your personal referral link and code. Every signup through them is attributed to you.">
      <AffiliateCard>
        <div className="space-y-5">
          <CopyField label="Referral link" value={link} />
          <CopyField label="Referral code" value={grant.affiliate.code} />
        </div>
        <p className="mt-5 text-[13px] text-shell-muted">
          Use the link in bios, posts and newsletters. The code works for customers who sign up without clicking a link.
        </p>
      </AffiliateCard>
    </AffiliatePage>
  )
}
