import MessagingComposePage from '@/components/messaging/MessagingComposePage'

export const metadata = { title: 'New SMS Message · Caption Fox' }

export default function ComposeSmsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  return <MessagingComposePage module="sms" searchParams={searchParams} />
}
