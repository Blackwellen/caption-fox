import MessagingComposePage from '@/components/messaging/MessagingComposePage'

export const metadata = { title: 'New Email Message · Caption Fox' }

export default function ComposeEmailPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  return <MessagingComposePage module="email" searchParams={searchParams} />
}
