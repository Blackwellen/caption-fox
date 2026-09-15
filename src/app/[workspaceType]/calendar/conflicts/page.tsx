import type { Metadata } from 'next'
import ConflictsPage from '@/components/calendar/ConflictsPage'
import { CapabilityGate, NoAccessState } from '@/components/calendar/states'
import { canAccessCalendarCapability } from '@/lib/calendar/entitlements'
import { resolveCalendarSession } from '@/lib/calendar/queries'

export const metadata: Metadata = {
  title: 'Conflicts · Calendar · Caption Fox',
  description: 'Detect and resolve scheduling clashes, capacity issues, approval blockers, and potential schedule risk.',
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
  if (!canAccessCalendarCapability(session.ctx, 'calendar.conflicts')) {
    return <CapabilityGate ctx={session.ctx} capability="calendar.conflicts" surfaceLabel="Conflicts" />
  }
  return <ConflictsPage session={session} searchParams={await searchParams} />
}
