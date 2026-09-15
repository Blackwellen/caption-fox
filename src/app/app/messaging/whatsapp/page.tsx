import MessagingChannelPage from '@/components/messaging/MessagingChannelPage'
import type { RawParams } from '@/lib/messaging/query'

export const metadata = { title: 'WhatsApp Messaging · Caption Fox', description: 'Send, automate and analyse WhatsApp conversations with approved templates, journeys and rich engagement.' }

export default function WhatsAppMessagingPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <MessagingChannelPage module="whatsapp" searchParams={searchParams} />
}
