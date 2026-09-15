import MessagingChannelPage from '@/components/messaging/MessagingChannelPage'
import type { RawParams } from '@/lib/messaging/query'

export const metadata = { title: 'SMS Messaging · Caption Fox', description: 'Manage SMS campaigns, journeys, compliance and performance.' }

export default function SmsMessagingPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <MessagingChannelPage module="sms" searchParams={searchParams} />
}
