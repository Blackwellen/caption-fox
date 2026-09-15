import PartnershipModulePage from '@/components/partnerships/ModulePage'
import { PARTNERSHIP_MODULE_META } from '@/lib/partnerships/constants'
import type { RawParams } from '@/lib/partnerships/query'

export const metadata = {
  title: 'Co-marketing · Partnerships · Caption Fox',
  description: PARTNERSHIP_MODULE_META.co_marketing.description,
}

export default function CoMarketingPartnershipsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <PartnershipModulePage module="co_marketing" searchParams={searchParams} />
}
