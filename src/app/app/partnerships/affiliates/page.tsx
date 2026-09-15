import PartnershipModulePage from '@/components/partnerships/ModulePage'
import { PARTNERSHIP_MODULE_META } from '@/lib/partnerships/constants'
import type { RawParams } from '@/lib/partnerships/query'

export const metadata = {
  title: 'Affiliates · Partnerships · Caption Fox',
  description: PARTNERSHIP_MODULE_META.affiliates.description,
}

export default function AffiliatePartnershipsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <PartnershipModulePage module="affiliates" searchParams={searchParams} />
}
