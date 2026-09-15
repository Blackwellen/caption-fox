import type { Metadata } from 'next'
import AgendaPage from '@/components/calendar/AgendaPage'
import { CapabilityGate, NoAccessState } from '@/components/calendar/states'
import { canAccessCalendarCapability } from '@/lib/calendar/entitlements'
import { resolveCalendarSession } from '@/lib/calendar/queries'

export const metadata: Metadata = {
  title: 'Agenda · Calendar · Caption Fox',
  description: 'Plan and manage your daily and weekly delivery work across campaigns, content and tasks.',
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
  if (!canAccessCalendarCapability(session.ctx, 'calendar.agenda')) {
    return <CapabilityGate ctx={session.ctx} capability="calendar.agenda" surfaceLabel="Agenda" />
  }
  return <AgendaPage session={session} searchParams={await searchParams} />
}
