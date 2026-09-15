// Workspace-scoped reads for the Automations surfaces. Mirrors
// src/lib/community/data.ts. Every function filters on an explicit
// workspaceId, enforced twice: here, and again by the RLS policies in
// supabase/migrations/20260901200000_automations_module.sql.

import type { SupabaseClient } from '@supabase/supabase-js'
import { TREND_WINDOW_DAYS } from './constants'
import { likeTerm, type AutomationsQuery, type RunLogsQuery } from './query'
import type {
  ActionCatalogRow, AutomationNotificationRow, AutomationRow, AutomationRunRow,
  AutomationTemplateRow, MetricPoint, PersonLite, TriggerCatalogRow,
} from './types'

const PERSON = 'id, full_name, email, avatar_url'

const AUTOMATION_COLUMNS = `
  id, workspace_id, name, description, status, trigger_key, trigger_config, conditions, actions,
  source_template_key, is_demo, created_by, run_count, success_count, failure_count,
  last_run_at, last_run_status, created_at, updated_at,
  creator:profiles!automations_created_by_fkey(${PERSON})
`

export interface Page<T> { rows: T[]; total: number; error: string | null }
function emptyPage<T>(error: string | null = null): Page<T> { return { rows: [], total: 0, error } }

function dayKey(value: string | Date): string { return new Date(value).toISOString().slice(0, 10) }

export function delta(current: number, previous: number): { pct: number; trend: 'up' | 'down' | 'flat' } {
  if (previous === 0) return { pct: current === 0 ? 0 : 100, trend: current === 0 ? 'flat' : 'up' }
  const pct = ((current - previous) / previous) * 100
  return { pct, trend: pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'flat' }
}

export function dailyPoints(timestamps: (string | null | undefined)[], key: string, days = TREND_WINDOW_DAYS): MetricPoint[] {
  const buckets = new Map<string, number>()
  for (let i = days - 1; i >= 0; i -= 1) buckets.set(dayKey(new Date(Date.now() - i * 86_400_000)), 0)
  for (const stamp of timestamps) {
    if (!stamp) continue
    const k = dayKey(stamp)
    if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1)
  }
  return [...buckets.entries()].map(([date, value]) => ({ date, [key]: value }))
}

// ============================================================================
// Automations
// ============================================================================

function applyAutomationFilters<T>(query: T, q: AutomationsQuery): T {
  type Ops = { eq(c: string, v: unknown): Ops; or(f: string): Ops }
  let builder = query as unknown as Ops
  if (q.q) {
    const term = likeTerm(q.q)
    builder = builder.or(`name.ilike.%${term}%,description.ilike.%${term}%`)
  }
  if (q.status) builder = builder.eq('status', q.status)
  return builder as unknown as T
}

export async function listAutomations(
  supabase: SupabaseClient, workspaceId: string, q: AutomationsQuery,
  opts: { all?: boolean; limit?: number } = {},
): Promise<Page<AutomationRow>> {
  const sortColumn = q.sort === 'name_asc' ? 'name' : q.sort === 'runs_desc' ? 'run_count' : 'updated_at'
  const ascending = q.sort === 'name_asc'
  let builder = supabase
    .from('automations').select(AUTOMATION_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)
  builder = applyAutomationFilters(builder, q)
  builder = builder.order(sortColumn, { ascending }).order('id', { ascending: true })

  if (opts.all) { if (opts.limit) builder = builder.limit(opts.limit) }
  else { const offset = (q.page - 1) * q.size; builder = builder.range(offset, offset + q.size - 1) }

  const { data, count, error } = await builder
  if (error) return emptyPage<AutomationRow>(error.message)
  return { rows: (data ?? []) as unknown as AutomationRow[], total: count ?? 0, error: null }
}

export async function getAutomation(supabase: SupabaseClient, workspaceId: string, id: string): Promise<AutomationRow | null> {
  const { data } = await supabase.from('automations').select(AUTOMATION_COLUMNS)
    .eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  return (data as unknown as AutomationRow) ?? null
}

export interface AutomationAggregates {
  total: number
  active: number
  runsToday: number
  successRate: number
  failedRuns: number
  pendingNotifications: number
  previousActive: number
  previousRunsToday: number
  previousSuccessRate: number
  runsSeries: number[]
  byStatus: { key: string; label: string; value: number; colour: string }[]
}

export async function automationAggregates(supabase: SupabaseClient, workspaceId: string): Promise<AutomationAggregates> {
  const { data: automations } = await supabase
    .from('automations').select('id, status, created_at').eq('workspace_id', workspaceId)
  const rows = automations ?? []

  const { data: runs } = await supabase
    .from('automation_runs').select('id, status, started_at').eq('workspace_id', workspaceId)
  const runRows = runs ?? []

  const cutoff = Date.now() - TREND_WINDOW_DAYS * 86_400_000
  const beforeRuns = runRows.filter(r => new Date(r.started_at as string).getTime() < cutoff)
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1)

  const runsToday = runRows.filter(r => new Date(r.started_at as string) >= todayStart).length
  const runsYesterday = runRows.filter(r => new Date(r.started_at as string) >= yesterdayStart && new Date(r.started_at as string) < todayStart).length
  const success = runRows.filter(r => r.status === 'success').length
  const successBefore = beforeRuns.filter(r => r.status === 'success').length

  const { count: pendingNotifications } = await supabase
    .from('automation_notifications').select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId).eq('read', false)

  const { AUTOMATION_STATUS_LABELS } = await import('./constants')
  const statusColours: Record<string, string> = { draft: '#94a3b8', active: '#10b981', paused: '#f59e0b', archived: '#64748b' }
  const byStatus = new Map<string, number>()
  for (const row of rows) byStatus.set(row.status as string, (byStatus.get(row.status as string) ?? 0) + 1)

  return {
    total: rows.length,
    active: rows.filter(r => r.status === 'active').length,
    runsToday,
    successRate: runRows.length ? (success / runRows.length) * 100 : 0,
    failedRuns: runRows.filter(r => r.status === 'failed').length,
    pendingNotifications: pendingNotifications ?? 0,
    previousActive: rows.filter(r => r.status === 'active' && new Date(r.created_at as string).getTime() < cutoff).length,
    previousRunsToday: runsYesterday,
    previousSuccessRate: beforeRuns.length ? (successBefore / beforeRuns.length) * 100 : 0,
    runsSeries: (() => {
      const buckets = new Map<string, number>()
      for (let i = TREND_WINDOW_DAYS - 1; i >= 0; i -= 1) buckets.set(dayKey(new Date(Date.now() - i * 86_400_000)), 0)
      for (const r of runRows) {
        const k = dayKey(r.started_at as string)
        if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1)
      }
      return [...buckets.values()]
    })(),
    byStatus: [...byStatus.entries()].map(([key, value]) => ({
      key, value, colour: statusColours[key] ?? '#94a3b8',
      label: AUTOMATION_STATUS_LABELS[key as keyof typeof AUTOMATION_STATUS_LABELS] ?? key,
    })),
  }
}

// ============================================================================
// Templates / catalogs (global reference data — no workspace filter)
// ============================================================================

export async function listTemplates(supabase: SupabaseClient): Promise<AutomationTemplateRow[]> {
  const { data } = await supabase.from('automation_templates').select('*').order('category', { ascending: true })
  return (data ?? []) as unknown as AutomationTemplateRow[]
}

export async function listTriggerCatalog(supabase: SupabaseClient): Promise<TriggerCatalogRow[]> {
  const { data } = await supabase.from('automation_trigger_catalog').select('*').order('label', { ascending: true })
  return (data ?? []) as unknown as TriggerCatalogRow[]
}

export async function listActionCatalog(supabase: SupabaseClient): Promise<ActionCatalogRow[]> {
  const { data } = await supabase.from('automation_action_catalog').select('*').order('label', { ascending: true })
  return (data ?? []) as unknown as ActionCatalogRow[]
}

// ============================================================================
// Runs / logs
// ============================================================================

function applyRunFilters<T>(query: T, q: RunLogsQuery): T {
  type Ops = { eq(c: string, v: unknown): Ops }
  let builder = query as unknown as Ops
  if (q.status) builder = builder.eq('status', q.status)
  if (q.source) builder = builder.eq('trigger_source', q.source)
  if (q.automation) builder = builder.eq('automation_id', q.automation)
  return builder as unknown as T
}

export async function listRuns(
  supabase: SupabaseClient, workspaceId: string, q: RunLogsQuery,
  opts: { all?: boolean; limit?: number } = {},
): Promise<Page<AutomationRunRow>> {
  let builder = supabase
    .from('automation_runs')
    .select(`id, workspace_id, automation_id, trigger_source, status, context, error, started_at, finished_at,
      automation:automations!automation_runs_automation_id_fkey(id, name, trigger_key)`, { count: 'exact' })
    .eq('workspace_id', workspaceId)
  builder = applyRunFilters(builder, q)
  builder = builder.order('started_at', { ascending: false }).order('id', { ascending: true })

  if (opts.all) { if (opts.limit) builder = builder.limit(opts.limit) }
  else { const offset = (q.page - 1) * q.size; builder = builder.range(offset, offset + q.size - 1) }

  const { data, count, error } = await builder
  if (error) return emptyPage<AutomationRunRow>(error.message)
  return { rows: (data ?? []) as unknown as AutomationRunRow[], total: count ?? 0, error: null }
}

export async function runActionLogs(supabase: SupabaseClient, workspaceId: string, runId: string) {
  const { data } = await supabase
    .from('automation_action_logs')
    .select('id, workspace_id, run_id, action_key, status, message, affected_entity_type, affected_entity_id, created_at')
    .eq('workspace_id', workspaceId).eq('run_id', runId)
    .order('created_at', { ascending: true })
  return data ?? []
}

export async function recentRuns(supabase: SupabaseClient, workspaceId: string, limit = 8): Promise<AutomationRunRow[]> {
  const { data } = await supabase
    .from('automation_runs')
    .select(`id, workspace_id, automation_id, trigger_source, status, context, error, started_at, finished_at,
      automation:automations!automation_runs_automation_id_fkey(id, name, trigger_key)`)
    .eq('workspace_id', workspaceId)
    .order('started_at', { ascending: false }).limit(limit)
  return (data ?? []) as unknown as AutomationRunRow[]
}

// ============================================================================
// Notifications
// ============================================================================

export async function listNotifications(supabase: SupabaseClient, workspaceId: string, limit = 8): Promise<AutomationNotificationRow[]> {
  const { data } = await supabase
    .from('automation_notifications')
    .select(`id, workspace_id, automation_id, run_id, title, message, link, read, created_at,
      automation:automations!automation_notifications_automation_id_fkey(id, name)`)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false }).limit(limit)
  return (data ?? []) as unknown as AutomationNotificationRow[]
}

// ============================================================================
// Lookups
// ============================================================================

export async function workspaceMembers(supabase: SupabaseClient, workspaceId: string): Promise<PersonLite[]> {
  const { data: members } = await supabase.from('workspace_members').select('user_id').eq('workspace_id', workspaceId)
  const ids = (members ?? []).map(m => m.user_id as string)
  if (ids.length === 0) return []
  const { data } = await supabase.from('profiles').select(PERSON).in('id', ids)
  return (data ?? []) as PersonLite[]
}

export async function automationPickerList(supabase: SupabaseClient, workspaceId: string): Promise<Pick<AutomationRow, 'id' | 'name'>[]> {
  const { data } = await supabase.from('automations').select('id, name').eq('workspace_id', workspaceId).order('name', { ascending: true })
  return (data ?? []) as Pick<AutomationRow, 'id' | 'name'>[]
}
