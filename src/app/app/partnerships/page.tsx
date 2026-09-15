import PartnershipModulePage from '@/components/partnerships/ModulePage'
import { PARTNERSHIP_MODULE_META } from '@/lib/partnerships/constants'
import type { RawParams } from '@/lib/partnerships/query'

export const metadata = {
  title: 'Partnerships · Caption Fox',
  description: PARTNERSHIP_MODULE_META.overview.description,
}

export default function PartnershipsOverviewPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <PartnershipModulePage module="overview" searchParams={searchParams} />
}
