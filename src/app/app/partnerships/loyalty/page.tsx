import PartnershipModulePage from '@/components/partnerships/ModulePage'
import { PARTNERSHIP_MODULE_META } from '@/lib/partnerships/constants'
import type { RawParams } from '@/lib/partnerships/query'

export const metadata = {
  title: 'Loyalty · Partnerships · Caption Fox',
  description: PARTNERSHIP_MODULE_META.loyalty.description,
}

export default function LoyaltyPartnershipsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <PartnershipModulePage module="loyalty" searchParams={searchParams} />
}
