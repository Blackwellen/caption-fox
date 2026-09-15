import { NextResponse, type NextRequest } from 'next/server'
import { getAdvertisingGate } from '@/lib/advertising/queries/context'
import { loadMetrics, resolveRange, totalsByEntity } from '@/lib/advertising/queries/shared'
import { recordActivity } from '@/lib/advertising/activity'
import { AD_PROVIDERS, type AdProvider } from '@/lib/advertising/providers'
import type { AdvertisingCapability } from '@/lib/advertising/entitlements'

// CSV export for the Advertising pages: GET /api/advertising/export
//   ?workspaceType=brand&dataset=campaigns|accounts|creatives|audiences&range=last_30&platform=meta
//
// Auth, workspace and the dataset's export capability are resolved server-side
// through the same gate as the pages. Rows come from the member's RLS-scoped
// client with an explicit workspace filter. No credential or token column is
// ever selected, and cells are neutralised against spreadsheet formula injection.

const DATASETS: Record<string, { capability: AdvertisingCapability; entityType: 'campaign' | 'account' | 'creative' | 'audience' }> = {
  campaigns: { capability: 'campaigns.export', entityType: 'campaign' },
  accounts: { capability: 'accounts.view', entityType: 'account' },
  creatives: { capability: 'creatives.export', entityType: 'creative' },
  audiences: { capability: 'audiences.export', entityType: 'audience' },
}

const TABLE: Record<string, { table: string; columns: string }> = {
  campaigns: { table: 'ad_campaigns', columns: 'id, name, provider, objective, status, budget_amount, currency' },
  accounts: { table: 'ad_accounts', columns: 'id, name, provider, external_id, currency, timezone, sync_status, mapping_label' },
  creatives: { table: 'ad_creatives', columns: 'id, name, provider, format, status, review_status' },
  audiences: { table: 'ad_audiences', columns: 'id, name, provider, audience_type, size_estimate, match_rate, status' },
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let text = String(value)
  // Formula-injection guard: a leading =, +, -, @, tab or CR would execute in Excel/Sheets.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const workspaceType = params.get('workspaceType') ?? ''
  const dataset = params.get('dataset') ?? 'campaigns'
  const config = DATASETS[dataset]
  if (!config) return NextResponse.json({ error: 'Unknown export dataset.' }, { status: 400 })

  const gate = await getAdvertisingGate(workspaceType)
  if (!gate.ok) return NextResponse.json({ error: gate.denial.message }, { status: 403 })
  const { session } = gate
  if (!session.capabilities[config.capability]) {
    return NextResponse.json({ error: 'Your role cannot export this data.' }, { status: 403 })
  }

  const range = resolveRange({ preset: params.get('range') })
  const platform = params.get('platform')
  const source = TABLE[dataset]

  let query = session.supabase.from(source.table).select(source.columns).eq('workspace_id', session.workspace.id).order('name').limit(5000)
  if (platform) query = query.eq('provider', platform)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Could not build the export.' }, { status: 500 })
  const records = (data ?? []) as unknown as Record<string, unknown>[]

  const metrics = await loadMetrics(session.supabase, {
    workspaceId: session.workspace.id, entityType: config.entityType, range,
    entityIds: records.map(record => record.id as string),
  })
  const byEntity = totalsByEntity(metrics)

  const recordColumns = source.columns.split(',').map(column => column.trim()).filter(column => column !== 'id')
  const header = [...recordColumns, 'spend', 'impressions', 'clicks', 'ctr_pct', 'conversions', 'cpa', 'revenue', 'roas']
  const lines = [header.join(',')]
  for (const record of records) {
    const metric = byEntity.get(record.id as string)
    const row = recordColumns.map(column => column === 'provider' ? AD_PROVIDERS[record[column] as AdProvider]?.name ?? record[column] : record[column])
    row.push(
      metric?.spend.toFixed(2) ?? '0.00', metric?.impressions ?? 0, metric?.clicks ?? 0,
      metric?.ctr?.toFixed(2) ?? '', metric?.conversions ?? 0, metric?.cpa?.toFixed(2) ?? '',
      metric?.revenue.toFixed(2) ?? '0.00', metric?.roas?.toFixed(2) ?? '',
    )
    lines.push(row.map(csvCell).join(','))
  }

  // Record the export so it appears under Reports → Recent Exports and can be
  // re-run with the same filters. The CSV is regenerated on demand rather than
  // stored, so no file with customer data sits in storage.
  const reportName = (params.get('name') ?? '').trim().slice(0, 120) || `${dataset[0].toUpperCase()}${dataset.slice(1)} export – ${range.label}`
  await session.supabase.from('ad_report_exports').insert({
    workspace_id: session.workspace.id, name: reportName, format: 'csv', status: 'ready', row_count: records.length,
    filters: { dataset, range: params.get('range') ?? 'last_30', platform: platform ?? null },
    requested_by: session.userId, completed_at: new Date().toISOString(),
  })

  await recordActivity({
    workspaceId: session.workspace.id, actorId: session.userId, eventType: 'report.exported',
    summary: `${dataset[0].toUpperCase()}${dataset.slice(1)} exported to CSV (${records.length} rows, ${range.label})`,
    sourceRoute: `advertising/${dataset}`,
  })

  const filename = `caption-fox-${dataset}-${range.since}-to-${range.until}.csv`
  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
