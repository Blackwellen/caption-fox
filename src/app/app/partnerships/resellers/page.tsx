import PartnershipModulePage from '@/components/partnerships/ModulePage'
import { PARTNERSHIP_MODULE_META } from '@/lib/partnerships/constants'
import type { RawParams } from '@/lib/partnerships/query'

export const metadata = {
  title: 'Resellers · Partnerships · Caption Fox',
  description: PARTNERSHIP_MODULE_META.resellers.description,
}

export default function ResellerPartnershipsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <PartnershipModulePage module="resellers" searchParams={searchParams} />
}
