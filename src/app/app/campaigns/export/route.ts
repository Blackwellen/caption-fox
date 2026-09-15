import { NextResponse, type NextRequest } from 'next/server'
import { getCampaignSession } from '@/lib/campaigns/server'
import { parseCampaignQuery, type RawParams } from '@/lib/campaigns/query'
import {
  listAllCampaigns, listCompetitions, listGiveaways, listTemplates, type SimpleFilters,
} from '@/lib/campaigns/data'
import {
  CAMPAIGN_MODULE_META, HEALTH_LABELS, LIFECYCLE_LABELS, PRIORITY_LABELS,
  TEMPLATE_STATUS_LABELS, type CampaignHealth, type CampaignPriority,
  type LifecycleStage, type TemplateStatus,
} from '@/lib/campaigns/constants'
import { canAccessCampaignModule } from '@/lib/campaigns/entitlements'
import { CAMPAIGN_TYPE_LABELS } from '@/lib/constants'

type Entity = 'campaigns' | 'templates' | 'giveaways' | 'competitions'

const ENTITY_MODULE: Record<Entity, keyof typeof CAMPAIGN_MODULE_META> = {
  campaigns: 'all', templates: 'templates', giveaways: 'giveaways', competitions: 'competitions',
}

/** RFC 4180 escaping — values are user content and may contain commas/quotes. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = Array.isArray(value) ? value.join(' | ') : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(headers: string[], rows: unknown[][]): string {
  // A BOM keeps Excel from mangling non-ASCII campaign names.
  return '﻿' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')
}

/**
 * Exports the current, filtered, permission-scoped view as CSV.
 *
 * The export mirrors exactly what the user can see: same workspace, same
 * filters, same search, same sort. It never widens scope beyond RLS.
 */
export async function GET(request: NextRequest) {
  const session = await getCampaignSession()
  const { supabase, ctx, capabilities, userId } = session

  if (!capabilities.export) {
    return NextResponse.json({ error: 'Your role does not allow exports.' }, { status: 403 })
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries()) as RawParams
  const entity = ((params.entity as string) ?? 'campaigns') as Entity
  if (!(entity in ENTITY_MODULE)) {
    return NextResponse.json({ error: 'Unknown export type.' }, { status: 400 })
  }

  const access = canAccessCampaignModule(ctx, ENTITY_MODULE[entity])
  if (!access.allowed) return NextResponse.json({ error: access.message }, { status: 403 })

  const query = parseCampaignQuery(params, { views: ['cards', 'table'] })
  let filename = `caption-fox-${entity}`
  let csv = ''

  if (entity === 'campaigns') {
    const { rows, error } = await listAllCampaigns(supabase, ctx.workspaceId, query, { limit: 5000 })
    if (error) return NextResponse.json({ error }, { status: 500 })
    csv = toCsv(
      ['Campaign', 'Type', 'Owner', 'Stage', 'Status', 'Priority', 'Progress %', 'Budget', 'Spend', 'Currency', 'Engagements', 'Reach', 'Conversions', 'Channels', 'Start date', 'End date', 'Approval', 'Updated'],
      rows.map(row => [
        row.name,
        CAMPAIGN_TYPE_LABELS[row.campaign_type] ?? row.campaign_type,
        row.owner?.full_name ?? row.owner?.email ?? '',
        LIFECYCLE_LABELS[row.lifecycle_stage as LifecycleStage] ?? row.lifecycle_stage,
        HEALTH_LABELS[row.health as CampaignHealth] ?? row.health,
        PRIORITY_LABELS[row.priority as CampaignPriority] ?? row.priority,
        row.progress, row.budget ?? '', row.actual_spend ?? '', row.currency ?? 'GBP',
        row.engagements, row.reach, row.conversions, row.channels,
        row.start_date ?? '', row.end_date ?? '',
        row.approval_status.replace('_', ' '), row.updated_at.slice(0, 10),
      ]),
    )
  } else if (entity === 'templates') {
    const { rows, error } = await listTemplates(supabase, ctx.workspaceId, {
      q: (params.q as string) ?? '', category: (params.category as string) ?? '',
      owner: (params.owner as string) ?? '', templateType: (params.templateType as string) ?? '',
      status: (params.status as string) ?? '', channel: (params.channel as string) ?? '',
      archived: params.archived === '1', sort: (params.sort as string) ?? 'updated',
      page: 1, size: 5000,
    })
    if (error) return NextResponse.json({ error }, { status: 500 })
    csv = toCsv(
      ['Template', 'Category', 'Type', 'Owner', 'Status', 'Used', 'Linked workflows', 'Channels', 'Default budget', 'Last updated'],
      rows.map(row => [
        row.name, row.category, row.template_type,
        row.owner?.full_name ?? row.owner?.email ?? '',
        TEMPLATE_STATUS_LABELS[row.status as TemplateStatus] ?? row.status,
        row.usage_count, row.linked_workflows, row.channels,
        row.default_budget ?? '', row.updated_at.slice(0, 10),
      ]),
    )
  } else {
    const filters: SimpleFilters = {
      q: (params.q as string) ?? '', status: (params.status as string) ?? '',
      owner: (params.owner as string) ?? '', channel: (params.channel as string) ?? '',
      from: (params.from as string) ?? '', to: (params.to as string) ?? '',
      extra: (params.extra as string) ?? '', sort: (params.sort as string) ?? 'due_soonest',
      page: 1, size: 5000,
    }

    if (entity === 'giveaways') {
      const { rows, error } = await listGiveaways(supabase, ctx.workspaceId, filters)
      if (error) return NextResponse.json({ error }, { status: 500 })
      csv = toCsv(
        ['Giveaway', 'Prize', 'Owner', 'Status', 'Prize fulfilment', 'Entries', 'Unique participants', 'Progress %', 'Start date', 'End date'],
        rows.map(row => [
          row.title, row.prize_title, row.owner?.full_name ?? row.owner?.email ?? '',
          row.status, row.prize_fulfilment, row.total_entries, row.total_unique_participants,
          row.progress, row.start_date ?? '', row.end_date ?? '',
        ]),
      )
    } else {
      const { rows, error } = await listCompetitions(supabase, ctx.workspaceId, filters)
      if (error) return NextResponse.json({ error }, { status: 500 })
      csv = toCsv(
        ['Competition', 'Type', 'Owner', 'Status', 'Judging stage', 'Submissions', 'Votes', 'Engagement rate %', 'Progress %', 'Start date', 'End date'],
        rows.map(row => [
          row.title, row.competition_type, row.owner?.full_name ?? row.owner?.email ?? '',
          row.status, row.judging_stage, row.submission_count, row.vote_count,
          row.engagement_rate, row.progress, row.start_date ?? '', row.end_date ?? '',
        ]),
      )
    }
  }

  filename = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`

  // Exports are auditable events — they leave the platform boundary.
  await supabase.from('campaign_activity').insert({
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
