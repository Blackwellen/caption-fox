import MessagingComposePage from '@/components/messaging/MessagingComposePage'

export const metadata = { title: 'New Push Message · Caption Fox' }

export default function ComposePushPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  return <MessagingComposePage module="push" searchParams={searchParams} />
}
