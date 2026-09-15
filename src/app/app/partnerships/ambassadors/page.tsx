import PartnershipModulePage from '@/components/partnerships/ModulePage'
import { PARTNERSHIP_MODULE_META } from '@/lib/partnerships/constants'
import type { RawParams } from '@/lib/partnerships/query'

export const metadata = {
  title: 'Ambassadors · Partnerships · Caption Fox',
  description: PARTNERSHIP_MODULE_META.ambassadors.description,
}

export default function AmbassadorPartnershipsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <PartnershipModulePage module="ambassadors" searchParams={searchParams} />
}
