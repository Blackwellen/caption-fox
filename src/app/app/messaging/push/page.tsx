import MessagingChannelPage from '@/components/messaging/MessagingChannelPage'
import type { RawParams } from '@/lib/messaging/query'

export const metadata = { title: 'Push Messaging · Caption Fox', description: 'Create and send mobile and web push notifications, build journeys, and track engagement performance.' }

export default function PushMessagingPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <MessagingChannelPage module="push" searchParams={searchParams} />
}
