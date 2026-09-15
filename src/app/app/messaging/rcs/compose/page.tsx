import MessagingComposePage from '@/components/messaging/MessagingComposePage'

export const metadata = { title: 'New RCS Message · Caption Fox' }

export default function ComposeRcsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  return <MessagingComposePage module="rcs" searchParams={searchParams} />
}
