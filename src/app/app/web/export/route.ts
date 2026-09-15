import { NextResponse, type NextRequest } from 'next/server'
import { getWebSession } from '@/lib/web/server'
import { parseWebQuery, type RawParams } from '@/lib/web/query'
import { listExperiments, listForms, listFunnels, listPages, listTrackingEvents } from '@/lib/web/data'
import {
  EXPERIMENT_STATUS_LABELS, EXPERIMENT_TYPE_LABELS, FORM_STATUS_LABELS, FORM_TYPE_LABELS,
  FUNNEL_STATUS_LABELS, FUNNEL_TYPE_LABELS, PAGE_STATUS_LABELS, PAGE_TYPE_LABELS,
  TRACKING_HEALTH_LABELS, type WebModule,
} from '@/lib/web/constants'
import { canAccessWebModule } from '@/lib/web/entitlements'

type Entity = 'pages' | 'forms' | 'funnels' | 'experiments' | 'tracking_events'

const ENTITY_MODULE: Record<Entity, WebModule> = {
  pages: 'pages', forms: 'forms', funnels: 'funnels', experiments: 'experiments', tracking_events: 'tracking',
}

/** RFC 4180 escaping — values are user content and may contain commas/quotes. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = Array.isArray(value) ? value.join(' | ') : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return '﻿' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')
}

/**
 * Exports the current, filtered, permission-scoped view as CSV. The export
 * mirrors exactly what the user can see: same workspace, same filters. It
 * never widens scope beyond RLS. Mirrors src/app/app/messaging/export/route.ts.
 */
export async function GET(request: NextRequest) {
  const session = await getWebSession()
  const { supabase, ctx, capabilities, userId } = session

  if (!capabilities.export) {
    return NextResponse.json({ error: 'Your role does not allow exports.' }, { status: 403 })
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries()) as RawParams
  const entity = ((params.entity as string) ?? 'pages') as Entity
  if (!(entity in ENTITY_MODULE)) {
    return NextResponse.json({ error: 'Unknown export type.' }, { status: 400 })
  }

  const access = canAccessWebModule(ctx, ENTITY_MODULE[entity])
  if (!access.allowed) return NextResponse.json({ error: access.message }, { status: 403 })

  const query = parseWebQuery(params)
  let filename = `caption-fox-web-${entity}`
  let csv = ''

  if (entity === 'pages') {
    const { rows, error } = await listPages(supabase, ctx.workspaceId, query, { limit: 5000 })
    if (error) return NextResponse.json({ error }, { status: 500 })
    csv = toCsv(
      ['Page', 'Slug', 'Type', 'Status', 'Owner', 'Sessions', 'Conversions', 'Conversion rate', 'Published', 'Updated'],
      rows.map(row => [
        row.name, row.slug, PAGE_TYPE_LABELS[row.page_type], PAGE_STATUS_LABELS[row.status],
        row.owner?.full_name ?? row.owner?.email ?? '', row.sessions, row.conversions,
        row.sessions > 0 ? `${((row.conversions / row.sessions) * 100).toFixed(1)}%` : '0%',
        row.published_at ?? '', row.updated_at.slice(0, 10),
      ]),
    )
  } else if (entity === 'forms') {
    const { rows, error } = await listForms(supabase, ctx.workspaceId, query, { limit: 5000 })
    if (error) return NextResponse.json({ error }, { status: 500 })
    csv = toCsv(
      ['Form', 'Type', 'Status', 'Owner', 'Submissions', 'Completed', 'Completion rate', 'Avg time (s)', 'Destination', 'Updated'],
      rows.map(row => [
        row.name, FORM_TYPE_LABELS[row.form_type], FORM_STATUS_LABELS[row.status],
        row.owner?.full_name ?? row.owner?.email ?? '', row.submissions_count, row.completed_count,
        row.submissions_count > 0 ? `${((row.completed_count / row.submissions_count) * 100).toFixed(1)}%` : '0%',
        row.avg_completion_seconds, row.destination_label ?? '', row.updated_at.slice(0, 10),
      ]),
    )
  } else if (entity === 'funnels') {
    const { rows, error } = await listFunnels(supabase, ctx.workspaceId, query, { limit: 5000 })
    if (error) return NextResponse.json({ error }, { status: 500 })
    csv = toCsv(
      ['Funnel', 'Type', 'Status', 'Owner', 'Entries', 'Conversions', 'Conversion rate', 'Updated'],
      rows.map(row => [
        row.name, FUNNEL_TYPE_LABELS[row.funnel_type], FUNNEL_STATUS_LABELS[row.status],
        row.owner?.full_name ?? row.owner?.email ?? '', row.entries, row.conversions,
        row.entries > 0 ? `${((row.conversions / row.entries) * 100).toFixed(1)}%` : '0%',
        row.updated_at.slice(0, 10),
      ]),
    )
  } else if (entity === 'experiments') {
    const { rows, error } = await listExperiments(supabase, ctx.workspaceId, query, { limit: 5000 })
    if (error) return NextResponse.json({ error }, { status: 500 })
    csv = toCsv(
      ['Experiment', 'Type', 'Status', 'Owner', 'Control visitors', 'Control conversions', 'Variant visitors', 'Variant conversions', 'Winner', 'Updated'],
      rows.map(row => [
        row.name, EXPERIMENT_TYPE_LABELS[row.experiment_type], EXPERIMENT_STATUS_LABELS[row.status],
        row.owner?.full_name ?? row.owner?.email ?? '', row.control_visitors, row.control_conversions,
        row.variant_visitors, row.variant_conversions, row.winner ?? '', row.updated_at.slice(0, 10),
      ]),
    )
  } else {
    const { rows, error } = await listTrackingEvents(supabase, ctx.workspaceId, query, { limit: 5000 })
    if (error) return NextResponse.json({ error }, { status: 500 })
    csv = toCsv(
      ['Event', 'Category', 'Source', 'Destinations', 'Status', 'Volume', 'Coverage', 'Last received', 'Updated'],
      rows.map(row => [
        row.event_name, row.event_category, row.source, row.destinations, TRACKING_HEALTH_LABELS[row.status],
        row.volume, `${row.coverage_percent}%`, row.last_received_at ?? '', row.updated_at.slice(0, 10),
      ]),
    )
  }

  filename = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`

  // Exports are auditable events — they leave the platform boundary.
  await supabase.from('web_activity').insert({
    workspace_id: ctx.workspaceId, actor_id: userId, entity_type: 'system',
    action: 'exported', summary: `exported ${entity.replace('_', ' ')} to CSV`,
    metadata: { filters: params },
  })

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
