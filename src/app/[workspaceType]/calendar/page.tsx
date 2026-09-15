import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CalendarPage from '@/components/calendar/CalendarPage'
import { NoAccessState } from '@/components/calendar/states'
import { canAccessCalendarCapability } from '@/lib/calendar/entitlements'
import { resolveCalendarSession } from '@/lib/calendar/queries'

export const metadata: Metadata = {
  title: 'Calendar · Campaign Manager · Caption Fox',
  description: 'Manage your marketing schedule, delivery queue, and upcoming campaigns.',
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
  // The Calendar surface itself is available on every plan; a workspace type
  // without the module never reaches here (resolveCalendarSession returns null).
  if (!canAccessCalendarCapability(session.ctx, 'calendar.view')) notFound()

  return <CalendarPage session={session} searchParams={await searchParams} />
}
