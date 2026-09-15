import MessagingComposePage from '@/components/messaging/MessagingComposePage'

export const metadata = { title: 'New WhatsApp Message · Caption Fox' }

export default function ComposeWhatsAppPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  return <MessagingComposePage module="whatsapp" searchParams={searchParams} />
}
