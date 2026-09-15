import { NextResponse, type NextRequest } from 'next/server'
import { getCreatorSession } from '@/lib/creators/server'
import {
  parseBriefsQuery, parseCreatorsQuery, parsePaymentsQuery, parseRightsQuery,
  parseSubmissionsQuery, type RawParams,
} from '@/lib/creators/query'
import {
  listBriefs, listCreators, listPayments, listRights, listSubmissions,
} from '@/lib/creators/data'
import {
  ASSET_TYPE_LABELS, AVAILABILITY_LABELS, BRIEF_STATUS_LABELS, PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS, RELATIONSHIP_LABELS, RIGHTS_STATUS_LABELS,
  SUBMISSION_STATUS_LABELS, USAGE_SCOPE_LABELS,
} from '@/lib/creators/constants'
import { canAccessCreatorModule } from '@/lib/creators/entitlements'
import type { CreatorModule } from '@/lib/creators/constants'

type Entity = 'creators' | 'briefs' | 'submissions' | 'rights' | 'payments'

const ENTITY_MODULE: Record<Entity, CreatorModule> = {
  creators: 'creators', briefs: 'briefs', submissions: 'submissions',
  rights: 'rights', payments: 'payments',
}

/** RFC 4180 escaping — values are user content and may contain commas/quotes. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = Array.isArray(value) ? value.join(' | ') : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(headers: string[], rows: unknown[][]): string {
  // A BOM keeps Excel from mangling non-ASCII creator names.
  return '﻿' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')
}

/**
 * Exports the current, filtered, permission-scoped view as CSV.
 *
 * The export mirrors exactly what the user can see: same workspace, same
 * filters, same search, same sort. It never widens scope beyond RLS, and it
 * never includes fields hidden from the caller's role (bank details, tax
 * profiles and raw invoice files are never part of this export).
 */
export async function GET(request: NextRequest) {
  const session = await getCreatorSession()
  const { supabase, ctx, capabilities, userId } = session

  if (!capabilities.export) {
    return NextResponse.json({ error: 'Your role does not allow exports.' }, { status: 403 })
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries()) as RawParams
  const entity = ((params.entity as string) ?? 'creators') as Entity
  if (!(entity in ENTITY_MODULE)) {
    return NextResponse.json({ error: 'Unknown export type.' }, { status: 400 })
  }

  const access = canAccessCreatorModule(ctx, ENTITY_MODULE[entity])
  if (!access.allowed) return NextResponse.json({ error: access.message }, { status: 403 })
  if (entity === 'payments' && !capabilities.viewPayments) {
    return NextResponse.json({ error: 'Your role does not allow viewing payments.' }, { status: 403 })
  }

  let csv = ''

  if (entity === 'creators') {
    const query = parseCreatorsQuery(params)
    const { rows, error } = await listCreators(supabase, ctx.workspaceId, { ...query, page: 1, size: 5000 })
    if (error) return NextResponse.json({ error }, { status: 500 })
    csv = toCsv(
      ['Creator', 'Handle', 'Niche', 'Region', 'Audience', 'Engagement %', 'Avg rate', 'Currency', 'Status', 'Availability', 'Rights readiness', 'Shortlisted', 'Owner', 'Updated'],
      rows.map(row => [
        row.name, row.handle ?? '', row.niche ?? '', row.region ?? '',
        row.audience_size, row.engagement_rate, row.avg_rate ?? '', row.currency ?? 'GBP',
        RELATIONSHIP_LABELS[row.relationship_status as keyof typeof RELATIONSHIP_LABELS] ?? row.relationship_status,
        AVAILABILITY_LABELS[row.availability as keyof typeof AVAILABILITY_LABELS] ?? row.availability,
        row.rights_readiness, row.shortlisted ? 'Yes' : 'No',
        row.owner?.full_name ?? row.owner?.email ?? '', row.updated_at.slice(0, 10),
      ]),
    )
  } else if (entity === 'briefs') {
    const query = parseBriefsQuery(params)
    const { rows, error } = await listBriefs(supabase, ctx.workspaceId, query, { all: true, limit: 5000 })
    if (error) return NextResponse.json({ error }, { status: 500 })
    csv = toCsv(
      ['Brief', 'Campaign', 'Status', 'Approval stage', 'Priority', 'Creators assigned', 'Budget', 'Currency', 'Deadline', 'Owner', 'Updated'],
      rows.map(row => [
        row.title, row.campaign?.name ?? '',
        BRIEF_STATUS_LABELS[row.status as keyof typeof BRIEF_STATUS_LABELS] ?? row.status,
        row.approval_stage, row.priority, row.creators_assigned,
        row.budget ?? '', row.currency ?? 'GBP', row.deadline ?? '',
        row.owner?.full_name ?? row.owner?.email ?? '', row.updated_at.slice(0, 10),
      ]),
    )
  } else if (entity === 'submissions') {
    const query = parseSubmissionsQuery(params)
    const { rows, error } = await listSubmissions(supabase, ctx.workspaceId, query, { all: true, limit: 5000 })
    if (error) return NextResponse.json({ error }, { status: 500 })
    csv = toCsv(
      ['Submission', 'Creator', 'Brief', 'Asset type', 'Status', 'Rights status', 'Version', 'Views', 'Engagement %', 'Issues', 'Submitted', 'Reviewer'],
      rows.map(row => [
        row.title ?? `Submission ${row.id.slice(0, 8)}`, row.creator?.name ?? '', row.brief?.title ?? '',
        ASSET_TYPE_LABELS[row.asset_type as keyof typeof ASSET_TYPE_LABELS] ?? row.asset_type,
        SUBMISSION_STATUS_LABELS[row.status as keyof typeof SUBMISSION_STATUS_LABELS] ?? row.status,
        row.rights_status, row.version, row.views, row.engagement_rate, row.issue_count,
        row.submitted_at.slice(0, 10), row.reviewer?.full_name ?? row.reviewer?.email ?? '',
      ]),
    )
  } else if (entity === 'rights') {
    const query = parseRightsQuery(params)
    const { rows, error } = await listRights(supabase, ctx.workspaceId, query, { all: true, limit: 5000 })
    if (error) return NextResponse.json({ error }, { status: 500 })
    csv = toCsv(
      ['Asset', 'Creator', 'Usage scope', 'Channels', 'Territories', 'Start date', 'Expiry date', 'Status', 'Owner'],
      rows.map(row => [
        row.asset_label, row.creator?.name ?? '',
        USAGE_SCOPE_LABELS[row.usage_scope as keyof typeof USAGE_SCOPE_LABELS] ?? row.usage_scope,
        row.channels ?? [], row.territories ?? [], row.start_date ?? '', row.expiry_date ?? '',
        RIGHTS_STATUS_LABELS[row.status as keyof typeof RIGHTS_STATUS_LABELS] ?? row.status,
        row.owner?.full_name ?? row.owner?.email ?? '',
      ]),
    )
  } else {
    const query = parsePaymentsQuery(params)
    const { rows, error } = await listPayments(supabase, ctx.workspaceId, query, { all: true, limit: 5000 })
    if (error) return NextResponse.json({ error }, { status: 500 })
    csv = toCsv(
      ['Creator', 'Brief', 'Campaign', 'Amount', 'Currency', 'Method', 'Status', 'Submitted', 'Payout date', 'Approver'],
      rows.map(row => [
        row.creator?.name ?? '', row.brief?.title ?? '', row.campaign?.name ?? '',
        row.amount, row.currency,
        row.payment_method ? PAYMENT_METHOD_LABELS[row.payment_method as keyof typeof PAYMENT_METHOD_LABELS] ?? row.payment_method : '',
        PAYMENT_STATUS_LABELS[row.status as keyof typeof PAYMENT_STATUS_LABELS] ?? row.status,
        row.submitted_date?.slice(0, 10) ?? '', row.payout_date ?? '',
        row.approver?.full_name ?? row.approver?.email ?? '',
      ]),
    )
  }

  const filename = `caption-fox-${entity}-${new Date().toISOString().slice(0, 10)}.csv`

  // Exports are auditable events — they leave the platform boundary.
  await supabase.from('ugc_activity').insert({
    workspace_id: ctx.workspaceId, actor_id: userId, entity_type: 'system',
    action: 'exported', summary: `Exported ${entity} to CSV`, surface: entity,
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
