import { NextResponse, type NextRequest } from 'next/server'
import { getStrategyActionSession, rateLimited, record } from '@/lib/strategy/server'
import { canAccessStrategyModule } from '@/lib/strategy/entitlements'
import { STRATEGY_MODULES, type StrategyModule } from '@/lib/strategy/constants'
import { parseStrategyQuery } from '@/lib/strategy/query'
import { listAudiences, listForecasts, listFrameworks, listObjectives, listPlans, listResearch } from '@/lib/strategy/data'
import { resolveRange } from '@/lib/strategy/metrics'
import { toCsv } from '@/lib/strategy/validation'

/**
 * Strategy export. Same filters as the page the user is on, scoped to the
 * active workspace by the query and by RLS, gated by the export permission
 * and module entitlement, rate limited, and recorded in the audit log.
 * Audience exports are aggregated segments only — never individual people.
 */
export async function GET(request: NextRequest) {
  const session = await getStrategyActionSession()
  if (!session) return NextResponse.json({ error: 'Sign in to export.' }, { status: 401 })

  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const area = (STRATEGY_MODULES as readonly string[]).includes(params.module) ? params.module as StrategyModule : null
  if (!area) return NextResponse.json({ error: 'Unknown module.' }, { status: 400 })
  const format = params.format === 'json' ? 'json' : 'csv'
  if (!canAccessStrategyModule(session.ctx, area).allowed) return NextResponse.json({ error: 'This area is not available for your workspace.' }, { status: 404 })
  if (!session.capabilities.export) return NextResponse.json({ error: 'Your role cannot export strategy data.' }, { status: 403 })

  const { supabase, ctx, userId } = session
  if (await rateLimited(supabase, ctx.workspaceId, userId, 'exported', 30, 60)) {
    return NextResponse.json({ error: 'Export limit reached. Try again in an hour.' }, { status: 429 })
  }

  const q = parseStrategyQuery(params, { views: ['cards', 'table', 'dashboard', 'library', 'board', 'gantt', 'framework', 'charts', 'map', 'compare', 'kanban', 'timeline', 'matrix', 'calendar', 'scenarios'] })
  if (area === 'overview' || area === 'objectives' || area === 'plans') {
    const range = resolveRange({ range: params.range, from: params.from, to: params.to }, 'this_quarter')
    q.from = range.from
    q.to = range.to
  }
  const LIMIT = 5000
  let headers: string[] = []
  let rows: unknown[][] = []

  switch (area) {
    case 'objectives': {
      const { rows: data, error } = await listObjectives(supabase, ctx.workspaceId, q, { limit: LIMIT })
      if (error) return failed()
      headers = ['Reference', 'Objective', 'Type', 'Status', 'Priority', 'Progress %', 'Confidence %', 'Owner', 'Strategy', 'Start', 'Due', 'Target', 'Next action', 'Tags', 'Updated']
      rows = data.map(row => [row.ref_number ? `OBJ-${String(row.ref_number).padStart(2, '0')}` : '', row.name, row.objective_type, row.status, row.priority, row.progress, row.confidence, row.owner?.full_name ?? '', row.strategy?.name ?? '', row.start_date, row.due_date, row.target_summary, row.next_action, row.tags, row.updated_at])
      break
    }
    case 'audiences': {
      const { rows: data, error } = await listAudiences(supabase, ctx.workspaceId, q, { limit: LIMIT })
      if (error) return failed()
      headers = ['Audience', 'Description', 'Status', 'Lifecycle', 'Audience size', 'Growth %', 'Fit score', 'Data completeness %', 'Channels', 'Source', 'Owner', 'Updated']
      rows = data.map(row => [row.name, row.description, row.status, row.lifecycle_stage, row.audience_size, row.growth_rate, row.fit_score, row.data_completeness, row.channels, row.source, row.owner?.full_name ?? '', row.updated_at])
      break
    }
    case 'research': {
      const { rows: data, error } = await listResearch(supabase, ctx.workspaceId, q, { limit: LIMIT })
      if (error) return failed()
      headers = ['Title', 'Source type', 'Method', 'Impact', 'Confidence %', 'Status', 'Theme', 'Collection', 'Owner', 'Has file', 'Tags', 'Updated']
      rows = data.map(row => [row.title, row.source_type, row.method, row.impact, row.confidence, row.status, row.theme, row.collection?.name ?? '', row.owner?.full_name ?? '', row.file_path ? 'Yes' : 'No', row.tags, row.updated_at])
      break
    }
    case 'positioning': {
      const { rows: data, error } = await listFrameworks(supabase, ctx.workspaceId, q)
      if (error) return failed()
      const ids = data.map(row => row.id)
      const [{ data: proofs }, { data: claims }] = await Promise.all([
        supabase.from('strategy_proof_points').select('framework_id, label, category, impact, verification').eq('workspace_id', ctx.workspaceId).in('framework_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
        supabase.from('strategy_claims').select('framework_id, claim, risk_level').eq('workspace_id', ctx.workspaceId).in('framework_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
      ])
      const names = new Map(data.map(row => [row.id, row.name]))
      headers = ['Record', 'Framework', 'Detail', 'Category / status', 'Impact / risk', 'Verification / version']
      rows = [
        ...data.map(row => ['Framework', row.name, row.positioning_statement, row.status, row.consistency_score, `v${row.version}`]),
        ...((proofs ?? []) as { framework_id: string; label: string; category: string; impact: string; verification: string }[]).map(row => ['Proof point', names.get(row.framework_id), row.label, row.category, row.impact, row.verification]),
        ...((claims ?? []) as { framework_id: string; claim: string; risk_level: string }[]).map(row => ['Claim', names.get(row.framework_id), row.claim, '', row.risk_level, '']),
      ]
      break
    }
    case 'plans':
    case 'overview': {
      const { rows: data, error } = await listPlans(supabase, ctx.workspaceId, q, { limit: LIMIT })
      if (error) return failed()
      headers = ['Plan', 'Strategy', 'Status', 'Priority', 'Progress %', 'Budget', 'Spent', 'Currency', 'Owner', 'Start', 'End', 'Target']
      rows = data.map(row => [row.name, row.strategy?.name ?? '', row.status, row.priority, row.progress, row.budget, row.budget_spent, row.currency, row.owner?.full_name ?? '', row.start_date, row.end_date, row.target_summary])
      break
    }
    case 'forecasts': {
      const { rows: forecasts, error } = await listForecasts(supabase, ctx.workspaceId, q)
      if (error) return failed()
      const ids = forecasts.map(row => row.id)
      const [{ data: scenarios }, { data: periods }] = await Promise.all([
        supabase.from('strategy_forecast_scenarios').select('id, name').eq('workspace_id', ctx.workspaceId).in('forecast_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
        supabase.from('strategy_forecast_periods').select('forecast_id, scenario_id, period_date, target_value, forecast_value, actual_value').eq('workspace_id', ctx.workspaceId)
          .in('forecast_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']).order('period_date').limit(LIMIT),
      ])
      const forecastName = new Map(forecasts.map(row => [row.id, row]))
      const scenarioName = new Map(((scenarios ?? []) as { id: string; name: string }[]).map(row => [row.id, row.name]))
      headers = ['Forecast', 'Scenario', 'Period', 'Target', 'Forecast', 'Actual', 'Currency']
      rows = ((periods ?? []) as { forecast_id: string; scenario_id: string; period_date: string; target_value: number; forecast_value: number; actual_value: number | null }[])
        .map(row => [forecastName.get(row.forecast_id)?.name, scenarioName.get(row.scenario_id), row.period_date, row.target_value, row.forecast_value, row.actual_value, forecastName.get(row.forecast_id)?.currency])
      break
    }
  }

  await record(session, { entityType: 'system', action: 'exported', summary: `${rows.length} ${area} rows as ${format.toUpperCase()}`, surface: area, audit: `strategy.${area}.exported`, metadata: { rows: rows.length, format } })

  const stamp = new Date().toISOString().slice(0, 10)
  const filename = `caption-fox-strategy-${area}-${stamp}.${format}`
  const body = format === 'json'
    ? JSON.stringify(rows.map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null]))), null, 2)
    : String.fromCharCode(0xfeff) + toCsv(headers, rows)
  return new NextResponse(body, {
    headers: {
      'Content-Type': format === 'json' ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })

  function failed() {
    return NextResponse.json({ error: 'The export could not be generated. Try again.' }, { status: 500 })
  }
}
