import { NextResponse, type NextRequest } from 'next/server'
import { canAccessCalendarCapability } from '@/lib/calendar/entitlements'
import {
  fetchConflicts, fetchQueueItems, fetchScheduleEntries, resolveCalendarSession,
  MAX_PAGE_SIZE,
} from '@/lib/calendar/queries'
import { readParams, resolveRange, pickView } from '@/lib/calendar/range'
import {
  conflictsToCsv, exportFilename, importTemplateCsv, MIME, queueToCsv,
  scheduleToCsv, scheduleToIcs,
} from '@/lib/calendar/export'

/**
 * Server-side export. The browser never assembles the file, so an export can
 * only ever contain rows the signed-in member is allowed to read, scoped to the
 * active workspace and to the same filters, range and search the page used.
 */
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const format = params.format === 'ics' ? 'ics' : params.format === 'template' ? 'template' : 'csv'

  if (format === 'template') {
    return new NextResponse(importTemplateCsv(), {
      headers: {
        'Content-Type': MIME.csv,
        'Content-Disposition': `attachment; filename="caption-fox-calendar-import-template.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  // Only a path we own — never an attacker-supplied redirect target.
  const basePath = /^\/[a-z-]{2,32}$/.test(params.basePath ?? '') ? params.basePath : '/creator'

  const session = await resolveCalendarSession(basePath)
  if (!session) {
    return NextResponse.json({ error: 'Not authorised for this workspace.' }, { status: 403 })
  }
  const { ctx } = session
  if (!canAccessCalendarCapability(ctx, 'calendar.export')) {
    return NextResponse.json({ error: 'You do not have permission to export.' }, { status: 403 })
  }

  const filters = readParams(params)
  const surface = ['calendar', 'queue', 'agenda', 'conflicts'].includes(params.surface) ? params.surface : 'calendar'

  try {
    if (surface === 'queue') {
      if (!canAccessCalendarCapability(ctx, 'calendar.publishingQueue')) {
        return NextResponse.json({ error: 'Not available on your plan.' }, { status: 403 })
      }
      const range = resolveRange(ctx, filters, 'range', { agendaDays: 31 })
      const result = await fetchQueueItems(session, range, {
        ...filters, pageSize: MAX_PAGE_SIZE, page: 1,
        sort: filters.sort ?? 'scheduled_at',
      })
      if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
      return file(queueToCsv(result.data.items, ctx.timezone, ctx.locale), 'publishing-queue', 'csv')
    }

    if (surface === 'conflicts') {
      if (!canAccessCalendarCapability(ctx, 'calendar.conflicts')) {
        return NextResponse.json({ error: 'Not available on your plan.' }, { status: 403 })
      }
      const range = resolveRange(ctx, filters, 'range', { agendaDays: 31 })
      const result = await fetchConflicts(session, range, { ...filters, pageSize: 60, page: 1 })
      if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
      return file(conflictsToCsv(result.data.conflicts, ctx.timezone, ctx.locale), 'conflicts', 'csv')
    }

    const view = pickView(filters.view, ['month', 'week', 'day', 'agenda'] as const, surface === 'agenda' ? 'agenda' : 'month')
    const range = resolveRange(ctx, filters, view === 'agenda' ? 'range' : view)
    const result = await fetchScheduleEntries(session, range, filters)
    if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })

    if (format === 'ics') {
      return file(
        scheduleToIcs(result.data, { workspaceName: 'Caption Fox', timeZone: ctx.timezone }),
        surface === 'agenda' ? 'agenda' : 'calendar',
        'ics',
      )
    }
    return file(scheduleToCsv(result.data, ctx.timezone, ctx.locale), surface === 'agenda' ? 'agenda' : 'calendar', 'csv')
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('[calendar:export]', error)
    return NextResponse.json({ error: 'Export failed. Contact support with reference CAL-EXPORT.' }, { status: 500 })
  }
}

function file(body: string, prefix: string, extension: 'csv' | 'ics') {
  return new NextResponse(body, {
    headers: {
      'Content-Type': MIME[extension],
      'Content-Disposition': `attachment; filename="${exportFilename(prefix, extension)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
