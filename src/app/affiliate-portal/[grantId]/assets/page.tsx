import type { Metadata } from 'next'
import Link from 'next/link'
import { requireActiveGrant } from '@/lib/affiliate-grant'
import { AffiliatePage, EmptyState } from '@/components/affiliate/portal/AffiliatePortalUI'

export const metadata: Metadata = { title: 'Assets — Affiliate Portal' }

export default async function AssetsPage({ params }: { params: Promise<{ grantId: string }> }) {
  const { grantId } = await params
  await requireActiveGrant(grantId)

  return (
    <AffiliatePage title="Assets" description="Brand and campaign assets the partnerships team shares with affiliates.">
      <EmptyState
        title="No assets have been shared with your programme yet"
        body="When the partnerships team publishes approved banners, logos or copy for affiliates, they will appear here. Until then, promote your referral link directly."
        action={
          <Link href={`/affiliate-portal/${grantId}/links`} className="inline-flex h-10 items-center rounded-[10px] bg-shell-blue px-4 text-[14px] font-semibold text-white hover:bg-shell-blue-hover">
            Get your referral link
          </Link>
        }
      />
    </AffiliatePage>
  )
}
