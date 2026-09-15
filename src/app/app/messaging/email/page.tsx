import MessagingChannelPage from '@/components/messaging/MessagingChannelPage'
import type { RawParams } from '@/lib/messaging/query'

export const metadata = { title: 'Email Messaging · Caption Fox', description: 'Manage lifecycle email campaigns, deliverability, and performance.' }

export default function EmailMessagingPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <MessagingChannelPage module="email" searchParams={searchParams} />
}
