import PartnershipModulePage from '@/components/partnerships/ModulePage'
import { PARTNERSHIP_MODULE_META } from '@/lib/partnerships/constants'
import type { RawParams } from '@/lib/partnerships/query'

export const metadata = {
  title: 'Referrals · Partnerships · Caption Fox',
  description: PARTNERSHIP_MODULE_META.referrals.description,
}

export default function ReferralPartnershipsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <PartnershipModulePage module="referrals" searchParams={searchParams} />
}
