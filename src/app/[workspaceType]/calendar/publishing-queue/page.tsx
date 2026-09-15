import type { Metadata } from 'next'
import QueuePage from '@/components/calendar/QueuePage'
import { CapabilityGate, NoAccessState } from '@/components/calendar/states'
import { canAccessCalendarCapability } from '@/lib/calendar/entitlements'
import { resolveCalendarSession } from '@/lib/calendar/queries'

export const metadata: Metadata = {
  title: 'Publishing Queue · Calendar · Caption Fox',
  description: 'Manage queued content, track approvals, and ensure on-time delivery across all channels.',
}

export default async function Page({
  params, searchParams,
}: {
  params: Promise<{ workspaceType: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { workspaceType } = await params
  const session = await resolveCalendarSession(`/${workspaceType}`)
  if (!session) return <NoAccessState basePath={`/${workspaceType}`} />
  if (!canAccessCalendarCapability(session.ctx, 'calendar.publishingQueue')) {
    return <CapabilityGate ctx={session.ctx} capability="calendar.publishingQueue" surfaceLabel="Publishing Queue" />
  }
  return <QueuePage session={session} searchParams={await searchParams} />
}
