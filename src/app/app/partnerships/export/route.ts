import { NextResponse, type NextRequest } from 'next/server'
import { getPartnershipSession } from '@/lib/partnerships/server'
import { parsePartnershipQuery, type RawParams } from '@/lib/partnerships/query'
import { listPartners, listProgrammes } from '@/lib/partnerships/data'
import { PARTNER_STATUS_LABELS, PROGRAMME_STATUS_LABELS } from '@/lib/partnerships/constants'
import { canAccessPartnershipModule } from '@/lib/partnerships/entitlements'
import { MODULE_PROGRAMME_TYPE, type PartnershipModule } from '@/lib/partnerships/constants'

type Entity = 'partners' | 'programmes'

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
 * Exports the current, filtered, permission-scoped Partnerships view as CSV.
 * Mirrors exactly what the user can see: same workspace, same programme
 * type, same filters, same search — never wider than RLS.
 */
export async function GET(request: NextRequest) {
  const session = await getPartnershipSession()
  const { supabase, ctx, capabilities, userId } = session

  if (!capabilities.export) {
    return NextResponse.json({ error: 'Your role does not allow exports.' }, { status: 403 })
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries()) as RawParams
  const entity = ((params.entity as string) ?? 'partners') as Entity
  const moduleParam = ((params.module as string) ?? 'overview') as PartnershipModule
  const programmeType = MODULE_PROGRAMME_TYPE[moduleParam] ?? null

  const access = canAccessPartnershipModule(ctx, moduleParam)
  if (!access.allowed) return NextResponse.json({ error: access.message }, { status: 403 })

  const query = parsePartnershipQuery(params)
  let csv = ''

  if (entity === 'programmes') {
    const { rows, error } = await listProgrammes(supabase, ctx.workspaceId, programmeType, { limit: 5000 })
    if (error) return NextResponse.json({ error }, { status: 500 })
    csv = toCsv(
      ['Programme', 'Type', 'Owner', 'Status', 'Commission type', 'Commission rate %', 'Currency', 'Partners', 'Conversions', 'Commission', 'Revenue', 'Start date', 'End date', 'Updated'],
      rows.map(row => [
        row.name, row.programme_type, row.owner?.full_name ?? row.owner?.email ?? '',
        PROGRAMME_STATUS_LABELS[row.status as keyof typeof PROGRAMME_STATUS_LABELS] ?? row.status,
        row.commission_type, row.commission_rate, row.currency,
        row.partner_count ?? 0, row.conversions ?? 0, row.commission ?? 0, row.revenue ?? 0,
        row.start_date ?? '', row.end_date ?? '', row.updated_at.slice(0, 10),
      ]),
    )
  } else {
    const { rows, error } = await listPartners(supabase, ctx.workspaceId, programmeType, query, { limit: 5000 })
    if (error) return NextResponse.json({ error }, { status: 500 })
    csv = toCsv(
      ['Partner', 'Programme', 'Type', 'Owner', 'Tier', 'Status', 'Health', 'Conversions', 'Commission', 'Revenue', 'Region', 'Joined', 'Last activity'],
      rows.map(row => [
        row.name, row.programme?.name ?? '', row.partner_type,
        row.owner?.full_name ?? row.owner?.email ?? '', row.tier?.name ?? '',
        PARTNER_STATUS_LABELS[row.status as keyof typeof PARTNER_STATUS_LABELS] ?? row.status,
        row.health, row.conversions ?? 0, row.commission ?? 0, row.revenue ?? 0,
        row.region ?? '', row.joined_at?.slice(0, 10) ?? '', row.last_activity_at.slice(0, 10),
      ]),
    )
  }

  const filename = `caption-fox-partnerships-${entity}-${new Date().toISOString().slice(0, 10)}.csv`

  await supabase.from('partnership_activity').insert({
    workspace_id: ctx.workspaceId, actor_id: userId, entity_type: 'system',
    action: 'exported', summary: `exported ${entity} to CSV`, surface: moduleParam,
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

