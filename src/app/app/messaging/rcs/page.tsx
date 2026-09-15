import MessagingChannelPage from '@/components/messaging/MessagingChannelPage'
import type { RawParams } from '@/lib/messaging/query'

export const metadata = { title: 'RCS Messaging · Caption Fox', description: 'Create branded rich messaging with carousels and actions, and track campaign performance.' }

export default function RcsMessagingPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <MessagingChannelPage module="rcs" searchParams={searchParams} />
}
