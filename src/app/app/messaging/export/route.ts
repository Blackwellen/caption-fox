import { NextResponse, type NextRequest } from 'next/server'
import { getMessagingSession } from '@/lib/messaging/server'
import { parseMessagingQuery, type RawParams } from '@/lib/messaging/query'
import { listMessages, listTemplates, listJourneys, listAudiences } from '@/lib/messaging/data'
import { CHANNEL_LABELS, MESSAGE_STATUS_LABELS, type MessagingChannel } from '@/lib/messaging/constants'
import { canAccessMessagingModule } from '@/lib/messaging/entitlements'
import type { MessagingModule } from '@/lib/messaging/constants'

type Entity = 'messages' | 'templates' | 'journeys' | 'audiences'

const ENTITY_MODULE: Record<Entity, MessagingModule> = {
  messages: 'overview', templates: 'templates', journeys: 'journeys', audiences: 'overview',
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
 * Exports the current, filtered, permission-scoped view as CSV.
 * The export mirrors exactly what the user can see: same workspace, same
 * filters, same channel scope. It never widens scope beyond RLS.
 */
export async function GET(request: NextRequest) {
  const session = await getMessagingSession()
  const { supabase, ctx, capabilities, channels, userId } = session

  if (!capabilities.export) {
    return NextResponse.json({ error: 'Your role does not allow exports.' }, { status: 403 })
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries()) as RawParams
  const entity = ((params.entity as string) ?? 'messages') as Entity
  if (!(entity in ENTITY_MODULE)) {
    return NextResponse.json({ error: 'Unknown export type.' }, { status: 400 })
  }

  const access = canAccessMessagingModule(ctx, ENTITY_MODULE[entity])
  if (!access.allowed) return NextResponse.json({ error: access.message }, { status: 403 })

  const query = parseMessagingQuery(params)
  let filename = `caption-fox-messaging-${entity}`
  let csv = ''

  if (entity === 'messages') {
    const { rows, error } = await listMessages(supabase, ctx.workspaceId, query, { channels, limit: 5000 })
    if (error) return NextResponse.json({ error }, { status: 500 })
    csv = toCsv(
      ['Message', 'Channel', 'Type', 'Status', 'Approval', 'Owner', 'Sent', 'Delivered', 'Opened', 'Clicked', 'Converted', 'Opt-outs', 'Scheduled', 'Sent at', 'Updated'],
      rows.map(row => [
        row.name, CHANNEL_LABELS[row.channel as MessagingChannel] ?? row.channel, row.message_type,
        MESSAGE_STATUS_LABELS[row.status as keyof typeof MESSAGE_STATUS_LABELS] ?? row.status,
        row.approval_status.replace('_', ' '), row.owner?.full_name ?? row.owner?.email ?? '',
        row.sent_count, row.delivered_count, row.opened_count, row.clicked_count, row.converted_count, row.opt_out_count,
        row.scheduled_at ?? '', row.sent_at ?? '', row.updated_at.slice(0, 10),
      ]),
    )
  } else if (entity === 'templates') {
    const { rows } = await listTemplates(supabase, ctx.workspaceId, { limit: 5000 })
    csv = toCsv(
      ['Template', 'Channel', 'Category', 'Status', 'Uses', 'Unique recipients', 'Avg reuse rate', 'CTR uplift', 'Owner', 'Updated'],
      rows.map(row => [
        row.name, CHANNEL_LABELS[row.channel as MessagingChannel] ?? row.channel, row.category, row.status,
        row.usage_count, row.unique_recipients, row.avg_reuse_rate, row.ctr_uplift ?? '',
        row.owner?.full_name ?? row.owner?.email ?? '', row.updated_at.slice(0, 10),
      ]),
    )
  } else if (entity === 'journeys') {
    const { rows } = await listJourneys(supabase, ctx.workspaceId, { limit: 5000 })
    csv = toCsv(
      ['Journey', 'Type', 'Status', 'Audience', 'Contacts in flow', 'On-track rate', 'Conversion rate', 'Health', 'Owner', 'Updated'],
      rows.map(row => [
        row.name, row.journey_type, row.status, row.audience?.name ?? '', row.contacts_in_flow,
        row.on_track_rate, row.conversion_rate, row.health, row.owner?.full_name ?? row.owner?.email ?? '', row.updated_at.slice(0, 10),
      ]),
    )
  } else {
    const rows = await listAudiences(supabase, ctx.workspaceId)
    csv = toCsv(
      ['Audience', 'Segment type', 'Contacts', 'Tags', 'Updated'],
      rows.map(row => [row.name, row.segment_type, row.contact_count, row.tags, row.updated_at.slice(0, 10)]),
    )
  }

  filename = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`

  // Exports are auditable events — they leave the platform boundary.
  await supabase.from('messaging_activity').insert({
    workspace_id: ctx.workspaceId, actor_id: userId, entity_type: 'system',
    action: 'exported', summary: `exported ${entity} to CSV`, surface: entity,
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
