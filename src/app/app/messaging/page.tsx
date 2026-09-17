import OverviewPage from '@/components/messaging/pages/OverviewPage'
import { MESSAGING_DESIGN_PAGE } from '@/components/messaging/design/kit'
import type { RawParams } from '@/lib/messaging/query'

export const metadata = {
  title: 'Messaging Overview · Caption Fox',
  description: 'Orchestrate lifecycle messaging across channels, track performance, and take action to drive engagement and conversions.',
}

export default async function MessagingOverviewRoute({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <div className={MESSAGING_DESIGN_PAGE}><OverviewPage searchParams={await searchParams} /></div>
}
