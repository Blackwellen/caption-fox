import type { SupabaseClient } from '@supabase/supabase-js'
import { average, confidenceLabelFromScore, CONFIDENCE_SCORE, pct, strategyHealthScore, variancePct } from './metrics'
import { compare, loadSnapshots, refreshSnapshot } from './kpis'
import { PRIORITY_RANK, type StrategyPriority } from './constants'
import type { ActivityRow, NextActionRow, PlanRow, ResearchRow } from './types'

export interface OverviewFilters {
  strategy: string
  owner: string
  from: string
  to: string
  status: string
  priority: string
  sort: 'priority' | 'progress' | 'due' | 'name'
  activity: string
  page: number
  size: number
}

const PLAN_SELECT = `
  id, workspace_id, strategy_id, name, description, status, progress, budget, budget_spent, currency,
  priority, target_summary, owner_id, start_date, end_date, archived_at, created_at, updated_at,
  owner:profiles!strategy_plans_owner_id_fkey(id, full_name, email, avatar_url),
  strategy:strategy_records!strategy_plans_strategy_id_fkey(id, name)
`

/** Health band for an initiative: progress against elapsed time. */
export function initiativeHealth(plan: Pick<PlanRow, 'progress' | 'start_date' | 'end_date' | 'status'>, now: Date = new Date()): 'good' | 'fair' | 'poor' | 'none' {
  if (plan.status === 'not_started') return 'none'
  if (plan.status === 'off_track') return 'poor'
  if (!plan.start_date || !plan.end_date) return plan.status === 'at_risk' ? 'fair' : 'good'
  const start = new Date(`${plan.start_date}T00:00:00`).getTime()
  const end = new Date(`${plan.end_date}T00:00:00`).getTime()
  const elapsed = end > start ? Math.max(0, Math.min(1, (now.getTime() - start) / (end - start))) : 1
  const gap = plan.progress / 100 - elapsed
  if (plan.status === 'at_risk' || gap < -0.15) return gap < -0.35 ? 'poor' : 'fair'
  return 'good'
}

export async function getOverviewData(supabase: SupabaseClient, workspaceId: string, filters: OverviewFilters, now: Date = new Date()) {
  let objectivesQuery = supabase.from('strategy_objectives')
    .select('id, status, progress, confidence, owner_id, strategy_id, start_date, due_date')
    .eq('workspace_id', workspaceId).is('archived_at', null)
  if (filters.strategy) objectivesQuery = objectivesQuery.eq('strategy_id', filters.strategy)
  if (filters.owner) objectivesQuery = objectivesQuery.eq('owner_id', filters.owner)
  if (filters.from) objectivesQuery = objectivesQuery.or(`due_date.is.null,due_date.gte.${filters.from}`)
  if (filters.to) objectivesQuery = objectivesQuery.or(`start_date.is.null,start_date.lte.${filters.to}`)

  let plansQuery = supabase.from('strategy_plans').select(PLAN_SELECT, { count: 'exact' })
    .eq('workspace_id', workspaceId).is('archived_at', null)
  if (filters.strategy) plansQuery = plansQuery.eq('strategy_id', filters.strategy)
  if (filters.owner) plansQuery = plansQuery.eq('owner_id', filters.owner)
  if (filters.status) plansQuery = plansQuery.eq('status', filters.status)
  if (filters.priority) plansQuery = plansQuery.eq('priority', filters.priority)
  if (filters.from) plansQuery = plansQuery.or(`end_date.is.null,end_date.gte.${filters.from}`)
  if (filters.to) plansQuery = plansQuery.or(`start_date.is.null,start_date.lte.${filters.to}`)

  let actionsQuery = supabase.from('strategy_actions')
    .select('id, title, module, priority, status, entity_type, entity_id, owner_id, due_date, completed_at, owner:profiles!strategy_actions_owner_id_fkey(id, full_name, email, avatar_url)')
    .eq('workspace_id', workspaceId).eq('status', 'open')
  if (filters.owner) actionsQuery = actionsQuery.eq('owner_id', filters.owner)

  let activityQuery = supabase.from('strategy_activity')
    .select('id, workspace_id, actor_id, entity_type, entity_id, action, summary, link, surface, created_at, actor:profiles!strategy_activity_actor_id_fkey(id, full_name, email, avatar_url)')
    .eq('workspace_id', workspaceId)
  if (filters.activity) activityQuery = activityQuery.eq('surface', filters.activity)

  const [
    objectives, plans, actions, activity, research, strategies, audiences, links,
    researchAll, frameworks, proofs, forecasts, snapshots, health,
  ] = await Promise.all([
    objectivesQuery,
    plansQuery,
    actionsQuery.order('due_date', { ascending: true, nullsFirst: false }).limit(20),
    activityQuery.order('created_at', { ascending: false }).limit(4),
    supabase.from('strategy_research_items')
      .select('id, title, source_type, method, impact, status, confidence, file_type, created_at, updated_at')
      .eq('workspace_id', workspaceId).is('archived_at', null)
      .order('updated_at', { ascending: false }).limit(4),
    supabase.from('strategy_records').select('id, name, status').eq('workspace_id', workspaceId).is('archived_at', null).order('name'),
    supabase.from('strategy_audiences').select('id, status').eq('workspace_id', workspaceId).is('archived_at', null),
    supabase.from('strategy_links').select('source_type, source_id, target_type, target_id')
      .eq('workspace_id', workspaceId).or('and(source_type.eq.objective,target_type.eq.audience),and(source_type.eq.audience,target_type.eq.objective)'),
    supabase.from('strategy_research_items').select('status').eq('workspace_id', workspaceId).is('archived_at', null),
    supabase.from('strategy_positioning_frameworks').select('consistency_score, status').eq('workspace_id', workspaceId).is('archived_at', null),
    supabase.from('strategy_proof_points').select('verification').eq('workspace_id', workspaceId),
    supabase.from('strategy_forecasts').select('id, name, metric, currency, confidence, target_value, period_start, period_end')
      .eq('workspace_id', workspaceId).is('archived_at', null).eq('status', 'active').order('created_at'),
    loadSnapshots(supabase, workspaceId, now),
    supabase.from('strategy_health_snapshots').select('snapshot_date, health_score, benchmark_score')
      .eq('workspace_id', workspaceId).order('snapshot_date', { ascending: false }).limit(12),
  ])

  const errors = [objectives.error, plans.error, actions.error, research.error].filter(Boolean)

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const objectiveRows = (objectives.data ?? []) as { status: string; progress: number; confidence: number }[]
  const objectiveCounts: Record<string, number> = {}
  for (const row of objectiveRows) objectiveCounts[row.status] = (objectiveCounts[row.status] ?? 0) + 1
  const objectivesTotal = objectiveRows.length
  const onTrack = objectiveCounts.on_track ?? 0

  const activeStrategies = ((strategies.data ?? []) as { status: string }[]).filter(row => row.status === 'active').length

  const activeAudiences = ((audiences.data ?? []) as { id: string; status: string }[]).filter(row => row.status === 'active')
  const linkedAudienceIds = new Set<string>()
  for (const link of (links.data ?? []) as { source_type: string; source_id: string; target_id: string }[]) {
    linkedAudienceIds.add(link.source_type === 'audience' ? link.source_id : link.target_id)
  }
  const audienceCoverage = pct(activeAudiences.filter(row => linkedAudienceIds.has(row.id)).length, activeAudiences.length)

  const researchRows = (researchAll.data ?? []) as { status: string }[]
  const researchHealth = pct(researchRows.filter(row => row.status === 'approved').length, researchRows.length)

  const frameworkRows = (frameworks.data ?? []) as { consistency_score: number }[]
  const proofRows = (proofs.data ?? []) as { verification: string }[]
  const proofCoverage = pct(proofRows.filter(row => row.verification === 'verified').length, proofRows.length)
  const positioningHealth = frameworkRows.length
    ? Math.round((average(frameworkRows.map(row => row.consistency_score)) + proofCoverage) / 2) : 0

  const forecastRows = (forecasts.data ?? []) as { id: string; name: string; metric: string; currency: string; confidence: string; target_value: number; period_start: string; period_end: string }[]
  const forecastConfidenceScore = forecastRows.length ? Math.round(average(forecastRows.map(row => CONFIDENCE_SCORE[row.confidence] ?? 65))) : 0

  const planRowsAll = (plans.data ?? []) as unknown as PlanRow[]
  const planCompletion = planRowsAll.length ? Math.round(average(planRowsAll.map(row => row.progress))) : 0
  const objectiveScore = objectivesTotal ? Math.round(average(objectiveRows.map(row => row.progress * 0.6 + row.confidence * 0.4))) : 0
  const healthScore = strategyHealthScore({
    objectives: objectivesTotal ? objectiveScore : null,
    research: researchRows.length ? researchHealth : null,
    positioning: frameworkRows.length ? positioningHealth : null,
    plans: planRowsAll.length ? planCompletion : null,
  })

  const unfiltered = !filters.strategy && !filters.owner && !filters.from && !filters.to && !filters.status && !filters.priority
  const live = {
    active_strategies: activeStrategies,
    objectives_total: objectivesTotal,
    objectives_on_track: onTrack,
    audience_coverage: audienceCoverage,
    research_health: researchHealth,
    positioning_health: positioningHealth,
    forecast_confidence_score: forecastConfidenceScore,
    health_score: healthScore,
  }
  // Snapshots record the whole workspace, never a filtered slice.
  if (unfiltered) {
    await refreshSnapshot(supabase, workspaceId, snapshots.current, live, now)
    await supabase.from('strategy_health_snapshots').upsert({
      workspace_id: workspaceId,
      snapshot_date: new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA'),
      health_score: healthScore,
      benchmark_score: ((health.data ?? []) as { benchmark_score: number }[])[1]?.benchmark_score ?? 60,
      objectives_on_track: onTrack,
      objectives_total: objectivesTotal,
    }, { onConflict: 'workspace_id,snapshot_date' }).then(() => undefined, () => undefined)
  }

  const prev = snapshots.lastMonth
  const kpis = {
    activeStrategies: { value: activeStrategies, delta: compare(activeStrategies, prev, 'active_strategies') },
    objectives: { onTrack, total: objectivesTotal, pct: pct(onTrack, objectivesTotal) },
    audienceCoverage: { value: audienceCoverage, delta: compare(audienceCoverage, prev, 'audience_coverage') },
    researchHealth: { value: researchHealth, delta: compare(researchHealth, prev, 'research_health') },
    positioningHealth: { value: positioningHealth, delta: compare(positioningHealth, prev, 'positioning_health') },
    forecastConfidence: {
      label: forecastRows.length ? confidenceLabelFromScore(forecastConfidenceScore) : '—',
      delta: forecastRows.length ? compare(forecastConfidenceScore, prev, 'forecast_confidence_score') : null,
    },
  }

  // ── Trend ───────────────────────────────────────────────────────────────────
  const healthRows = ((health.data ?? []) as { snapshot_date: string; health_score: number; benchmark_score: number }[]).reverse()
  const trendRows = healthRows.slice(-6).map(row => ({
    date: row.snapshot_date,
    label: new Date(`${row.snapshot_date}T00:00:00`).toLocaleDateString('en-GB', { month: 'short' }),
    health: row.snapshot_date === healthRows.at(-1)?.snapshot_date && unfiltered ? healthScore : row.health_score,
    benchmark: row.benchmark_score,
  }))

  // ── Forecast vs target (current quarter months, primary revenue forecast) ───
  const revenue = forecastRows.find(row => row.metric === 'revenue') ?? forecastRows[0] ?? null
  let forecastBars: { label: string; forecast: number; target: number }[] = []
  let forecastVariance: number | null = null
  if (revenue) {
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0)
    const { data: periods } = await supabase.from('strategy_forecast_periods')
      .select('period_date, target_value, forecast_value, strategy_forecast_scenarios!inner(is_expected)')
      .eq('workspace_id', workspaceId).eq('forecast_id', revenue.id)
      .eq('strategy_forecast_scenarios.is_expected', true)
      .gte('period_date', quarterStart.toLocaleDateString('en-CA'))
      .lte('period_date', quarterEnd.toLocaleDateString('en-CA'))
      .order('period_date')
    forecastBars = ((periods ?? []) as unknown as { period_date: string; target_value: number; forecast_value: number }[]).map(row => ({
      label: new Date(`${row.period_date}T00:00:00`).toLocaleDateString('en-GB', { month: 'short' }),
      forecast: Number(row.forecast_value), target: Number(row.target_value),
    }))
    const totals = forecastBars.reduce((sum, row) => ({ f: sum.f + row.forecast, t: sum.t + row.target }), { f: 0, t: 0 })
    forecastVariance = forecastBars.length ? variancePct(totals.f, totals.t) : null
  }

  // ── Initiatives (plans) ─────────────────────────────────────────────────────
  const sorted = [...planRowsAll].sort((a, b) => {
    switch (filters.sort) {
      case 'progress': return b.progress - a.progress || a.name.localeCompare(b.name)
      case 'due': return (a.end_date ?? '9999').localeCompare(b.end_date ?? '9999') || a.name.localeCompare(b.name)
      case 'name': return a.name.localeCompare(b.name)
      default:
        return (PRIORITY_RANK[a.priority as StrategyPriority] ?? 9) - (PRIORITY_RANK[b.priority as StrategyPriority] ?? 9)
          || (a.end_date ?? '9999').localeCompare(b.end_date ?? '9999') || a.name.localeCompare(b.name)
    }
  })
  const start = (filters.page - 1) * filters.size

  const actionRows = ((actions.data ?? []) as unknown as NextActionRow[]).sort((a, b) =>
    (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
    || (PRIORITY_RANK[a.priority as StrategyPriority] ?? 9) - (PRIORITY_RANK[b.priority as StrategyPriority] ?? 9))

  return {
    errors: errors.map(error => error?.message ?? ''),
    kpis,
    objectiveCounts,
    objectivesTotal,
    trend: trendRows,
    forecast: revenue ? { id: revenue.id, name: revenue.name, currency: revenue.currency, bars: forecastBars, variance: forecastVariance } : null,
    actions: actionRows.slice(0, 4),
    actionsTotal: actionRows.length,
    research: (research.data ?? []) as unknown as ResearchRow[],
    activity: (activity.data ?? []) as unknown as ActivityRow[],
    initiatives: sorted.slice(start, start + filters.size),
    initiativesTotal: sorted.length,
    strategies: ((strategies.data ?? []) as { id: string; name: string }[]),
  }
}
