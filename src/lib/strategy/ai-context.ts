import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { canAccessStrategyModule, type StrategyContext } from './entitlements'
import { STRATEGY_MODULES, type StrategyModule } from './constants'
import type { ContextRecord } from './ai-rules'

const PREFIX: Record<Exclude<StrategyModule, 'overview'>, string> = {
  objectives: 'O', audiences: 'A', research: 'R', positioning: 'P', plans: 'L', forecasts: 'F',
}

const date = (value: string | null | undefined) => (value ? value.slice(0, 10) : 'none')
const num = (value: number | null | undefined) => (value == null ? 'n/a' : new Intl.NumberFormat('en-GB').format(value))

type Loader = (supabase: SupabaseClient, workspaceId: string, limit: number) => Promise<Omit<ContextRecord, 'ref'>[]>

/**
 * One loader per module. Every query runs through the caller's own RLS client,
 * is pinned to the active workspace and excludes archived rows, so the
 * assistant can only ever see what the user could open on screen.
 */
const LOADERS: Record<Exclude<StrategyModule, 'overview'>, Loader> = {
  async objectives(supabase, workspaceId, limit) {
    const { data } = await supabase.from('strategy_objectives')
      .select('id, name, status, progress, confidence, priority, target_summary, next_action, start_date, due_date, owner:profiles!strategy_objectives_owner_id_fkey(full_name)')
      .eq('workspace_id', workspaceId).is('archived_at', null).order('due_date', { ascending: true, nullsFirst: false }).limit(limit)
    return (data ?? []).map(row => ({
      module: 'objectives' as const, id: row.id, label: `Objective: ${row.name}`,
      facts: `status ${row.status}; progress ${row.progress}%; confidence ${row.confidence}%; priority ${row.priority}; target ${row.target_summary ?? 'none'}; due ${date(row.due_date)}; next action ${row.next_action ?? 'none'}; owner ${(row.owner as { full_name?: string } | null)?.full_name ?? 'unassigned'}`,
    }))
  },
  async audiences(supabase, workspaceId, limit) {
    const { data } = await supabase.from('strategy_audiences')
      .select('id, name, status, lifecycle_stage, audience_size, growth_rate, fit_score, data_completeness, channels, source')
      .eq('workspace_id', workspaceId).is('archived_at', null).order('audience_size', { ascending: false }).limit(limit)
    return (data ?? []).map(row => ({
      module: 'audiences' as const, id: row.id, label: `Audience: ${row.name}`,
      facts: `status ${row.status}; stage ${row.lifecycle_stage}; size ${num(row.audience_size)}; growth ${row.growth_rate}%; fit ${row.fit_score}; data completeness ${row.data_completeness}%; channels ${(row.channels ?? []).join(', ') || 'none'}; source ${row.source}`,
    }))
  },
  async research(supabase, workspaceId, limit) {
    const { data } = await supabase.from('strategy_research_items')
      .select('id, title, summary, method, impact, confidence, status, theme, updated_at')
      .eq('workspace_id', workspaceId).neq('status', 'archived').order('updated_at', { ascending: false }).limit(limit)
    return (data ?? []).map(row => ({
      module: 'research' as const, id: row.id, label: `Research: ${row.title}`,
      facts: `status ${row.status}; method ${row.method}; impact ${row.impact}; confidence ${row.confidence}%; theme ${row.theme ?? 'none'}; updated ${date(row.updated_at)}; summary ${(row.summary ?? 'none').slice(0, 300)}`,
    }))
  },
  async positioning(supabase, workspaceId, limit) {
    const { data } = await supabase.from('strategy_positioning_frameworks')
      .select('id, name, status, is_primary, category_promise, positioning_statement, consistency_score')
      .eq('workspace_id', workspaceId).is('archived_at', null).order('is_primary', { ascending: false }).limit(limit)
    return (data ?? []).map(row => ({
      module: 'positioning' as const, id: row.id, label: `Positioning: ${row.name}${row.is_primary ? ' (primary)' : ''}`,
      facts: `status ${row.status}; consistency ${row.consistency_score}; promise ${row.category_promise ?? 'none'}; statement ${(row.positioning_statement ?? 'none').slice(0, 300)}`,
    }))
  },
  async plans(supabase, workspaceId, limit) {
    const { data } = await supabase.from('strategy_plans')
      .select('id, name, status, progress, priority, budget, budget_spent, currency, start_date, end_date, target_summary')
      .eq('workspace_id', workspaceId).is('archived_at', null).order('end_date', { ascending: true, nullsFirst: false }).limit(limit)
    return (data ?? []).map(row => ({
      module: 'plans' as const, id: row.id, label: `Plan: ${row.name}`,
      facts: `status ${row.status}; progress ${row.progress}%; priority ${row.priority}; ${date(row.start_date)} to ${date(row.end_date)}; budget ${row.budget == null ? 'none' : `${num(row.budget)} ${row.currency}`}; spent ${num(row.budget_spent)} ${row.currency}; target ${row.target_summary ?? 'none'}`,
    }))
  },
  async forecasts(supabase, workspaceId, limit) {
    const { data } = await supabase.from('strategy_forecasts')
      .select('id, name, metric, currency, period_start, period_end, target_value, confidence, risk_level, status, last_recalculated_at')
      .eq('workspace_id', workspaceId).is('archived_at', null).order('period_end', { ascending: true }).limit(limit)
    return (data ?? []).map(row => ({
      module: 'forecasts' as const, id: row.id, label: `Forecast: ${row.name}`,
      facts: `metric ${row.metric}; target ${num(row.target_value)} ${row.currency}; period ${date(row.period_start)} to ${date(row.period_end)}; confidence ${row.confidence}; risk ${row.risk_level}; status ${row.status}; recalculated ${date(row.last_recalculated_at)}`,
    }))
  },
}

/** Grounded records for a question asked on `module`, current page first. */
export async function loadStrategyAiContext(supabase: SupabaseClient, ctx: StrategyContext, module: StrategyModule): Promise<ContextRecord[]> {
  const allowed = STRATEGY_MODULES.filter((m): m is Exclude<StrategyModule, 'overview'> => m !== 'overview' && canAccessStrategyModule(ctx, m).allowed)
  const ordered = module !== 'overview' && allowed.includes(module) ? [module, ...allowed.filter(m => m !== module)] : allowed
  const batches = await Promise.all(ordered.map(m => LOADERS[m](supabase, ctx.workspaceId, m === module ? 25 : 8).catch(() => [])))
  return batches.flatMap((rows, index) => rows.map((row, i) => ({ ...row, ref: `${PREFIX[ordered[index]]}${i + 1}` })))
}
