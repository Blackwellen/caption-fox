import type { Metadata } from 'next'
import AffiliateDashboard from '@/components/affiliate/AffiliateDashboard'
import { requireActiveGrant } from '@/lib/affiliate-grant'

export const metadata: Metadata = { title: 'Affiliate Portal — Caption Fox' }

export default async function AffiliatePortalHome({ params }: { params: Promise<{ grantId: string }> }) {
  await requireActiveGrant((await params).grantId)
  return <AffiliateDashboard />
}
