import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import { logAudit } from '@/lib/audit'
import { canAccessEventsCapability, EVENTS_ROUTE_SURFACES } from '@/lib/events/entitlements'
import {
  listEvents, listFollowUpTasks, listPodcastEpisodes, listSponsorships,
  listWebinars, resolveEventsContext,
} from '@/lib/events/queries'
import { eventLocationLabel, eventTypeLabel } from '@/lib/events/format'
import type { EventsFilters } from '@/lib/events/types'

/**
 * Exports respect the CURRENT search, filters, sorting and workspace scope —
 * the same query the screen ran — and they are permission gated. Sponsorship
 * money columns are omitted entirely for roles without financial visibility.
 */

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const params = request.nextUrl.searchParams
  const routeSegment = params.get('workspaceType') ?? ''
  const resource = params.get('resource') ?? 'events'
  const surface = EVENTS_ROUTE_SURFACES[routeSegment]
  if (!surface) return NextResponse.json({ error: 'Unknown workspace surface' }, { status: 400 })

  const { active } = await getActiveWorkspace(supabase, user.id)
  if (!active) return NextResponse.json({ error: 'No active workspace' }, { status: 403 })

  const resolved = await resolveEventsContext(supabase, active.id, user.id, surface)
  if (!resolved) return NextResponse.json({ error: 'No access' }, { status: 403 })
  if (!canAccessEventsCapability(resolved.ctx, 'events.export')) {
    return NextResponse.json({ error: 'Export is not permitted for your role' }, { status: 403 })
  }

  const filters: EventsFilters = {
    q: params.get('q') ?? undefined,
    type: params.get('type') ?? undefined,
    status: params.get('status') ?? undefined,
    owner: params.get('owner') ?? undefined,
    event: params.get('event') ?? undefined,
    tier: params.get('tier') ?? undefined,
    sequence: params.get('sequence') ?? undefined,
    distribution: params.get('distribution') ?? undefined,
    dateFrom: params.get('dateFrom') ?? undefined,
    dateTo: params.get('dateTo') ?? undefined,
    sort: params.get('sort') ?? undefined,
    page: 1,
    pageSize: 50,
  }

  const workspaceId = resolved.workspace.id
  const showMoney = canAccessEventsCapability(resolved.ctx, 'sponsorships.viewFinancials')
  let rows: (string | number)[][] = []
  let header: string[] = []

  switch (resource) {
    case 'webinars': {
      if (!canAccessEventsCapability(resolved.ctx, 'events.webinars')) {
        return NextResponse.json({ error: 'No access' }, { status: 403 })
      }
      const { webinars } = await listWebinars(supabase, workspaceId, { ...filters, pageSize: 50 })
      header = ['Webinar', 'Date', 'Platform', 'Host', 'Status', 'Registrations', 'Attended', 'Attendance rate', 'Recording']
      rows = webinars.map(item => [
        item.name, item.start_at ?? '', item.webinar?.provider ?? item.online_platform ?? '',
        item.hostName ?? '', item.status, item.registrations, item.attended,
        item.attendanceRate === null ? '' : (item.attendanceRate * 100).toFixed(1),
        item.webinar?.recording_state ?? 'none',
      ])
      break
    }
    case 'podcasts': {
      if (!canAccessEventsCapability(resolved.ctx, 'events.podcasts')) {
        return NextResponse.json({ error: 'No access' }, { status: 403 })
      }
      const { episodes } = await listPodcastEpisodes(supabase, workspaceId, { ...filters, pageSize: 50 })
      header = ['Episode', 'Number', 'Show', 'Status', 'Recording type', 'Scheduled', 'Published', 'Distribution', 'Listens', 'Unique listeners']
      rows = episodes.map(item => [
        item.title, item.episode_number ?? '', item.showName ?? '', item.status, item.recording_type,
        item.scheduled_at ?? '', item.published_at ?? '', item.distribution_state,
        item.listens, item.unique_listeners,
      ])
      break
    }
    case 'sponsorships': {
      if (!canAccessEventsCapability(resolved.ctx, 'events.sponsorships')) {
        return NextResponse.json({ error: 'No access' }, { status: 403 })
      }
      const { sponsorships } = await listSponsorships(supabase, workspaceId, { ...filters, pageSize: 50 })
      header = ['Sponsor', 'Event', 'Package', 'Tier', 'Stage', 'Deliverables completed', 'Deliverables total', 'Owner']
      if (showMoney) header.splice(4, 0, 'Value', 'Currency')
      rows = sponsorships.map(item => {
        const base: (string | number)[] = [
          item.sponsor?.name ?? '', item.eventName ?? '', item.packageName ?? '', item.tier,
        ]
        if (showMoney) base.push(item.value, item.currency)
        base.push(item.stage, item.deliverablesCompleted, item.deliverablesTotal, item.ownerName ?? '')
        return base
      })
      break
    }
    case 'follow-up': {
      if (!canAccessEventsCapability(resolved.ctx, 'events.followUp')) {
        return NextResponse.json({ error: 'No access' }, { status: 403 })
      }
      const tasks = await listFollowUpTasks(supabase, workspaceId, filters)
      header = ['Task', 'Contact', 'Event', 'Sequence', 'Status', 'Priority', 'Due', 'Owner', 'Outcome']
      rows = tasks.map(item => [
        item.title, item.contactName ?? '', item.eventName ?? '', item.sequenceName ?? '',
        item.status, item.priority, item.due_at ?? '', item.ownerName ?? '', item.outcome ?? '',
      ])
      break
    }
    default: {
      const { events } = await listEvents(supabase, workspaceId, { ...filters, pageSize: 50 })
      header = ['Event', 'Type', 'Format', 'Status', 'Start', 'End', 'Location', 'Registrations', 'Attended', 'Attendance rate', 'Sponsors', 'Owner']
      rows = events.map(item => [
        item.name, eventTypeLabel(item.event_type), item.format, item.status,
        item.start_at ?? '', item.end_at ?? '', eventLocationLabel(item),
        item.registrations, item.attended,
        item.attendanceRate === null ? '' : (item.attendanceRate * 100).toFixed(1),
        item.sponsorCount, item.ownerName ?? '',
      ])
    }
  }

  await logAudit(supabase, user.id, {
    workspaceId, action: 'events.export.created', entityType: 'events_export',
    metadata: { resource, rows: rows.length, filters },
  })

  const csv = [header, ...rows].map(toCsvLine).join('\r\n')
  const filename = `caption-fox-${resource}-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(`﻿${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

function toCsvLine(cells: (string | number)[]): string {
  return cells.map(cell => {
    const value = String(cell ?? '')
    // Neutralise spreadsheet formula injection on untrusted text.
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
    return `"${safe.replaceAll('"', '""')}"`
  }).join(',')
}
