import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ActivityRow, ExperimentRow, FormRow, FunnelRow, FunnelStepRow, MetricPoint, PageRow,
  TrackingDestinationRow, TrackingEventRow, WebExperienceRow,
} from './types'
import {
  QUALIFYING_FORM_TYPES, WEB_MODULE_META,
  PAGE_STATUS_BADGE, PAGE_STATUS_LABELS, PAGE_TYPE_LABELS,
  FORM_STATUS_BADGE, FORM_STATUS_LABELS, FORM_TYPE_LABELS,
  FUNNEL_STATUS_BADGE, FUNNEL_STATUS_LABELS, FUNNEL_TYPE_LABELS,
  EXPERIMENT_STATUS_BADGE, EXPERIMENT_STATUS_LABELS, EXPERIMENT_TYPE_LABELS,
  TRACKING_HEALTH_BADGE, TRACKING_HEALTH_LABELS,
} from './constants'
import type { WebQuery } from './query'

const OWNER_SELECT = 'owner:profiles(id, full_name, email, avatar_url)'

// ── Pages ────────────────────────────────────────────────────────────────────

export interface EntityPage<T> { rows: T[]; total: number; error: string | null }

export async function listPages(
  supabase: SupabaseClient, workspaceId: string, filters: WebQuery = {} as WebQuery, opts: { limit?: number } = {},
): Promise<EntityPage<PageRow>> {
  let query = supabase.from('web_pages')
    .select(`id, workspace_id, name, slug, page_type, status, owner_id, sessions, conversions, content, seo_title, seo_description, version, published_at, archived_at, created_at, updated_at, ${OWNER_SELECT}`, { count: 'exact' })
    .eq('workspace_id', workspaceId)

  query = filters.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.owner) query = query.eq('owner_id', filters.owner)
  if (filters.q) {
    const term = filters.q.replace(/[%,()]/g, ' ').trim()
    if (term) query = query.ilike('name', `%${term}%`)
  }
  query = query.order('updated_at', { ascending: false }).limit(opts.limit ?? 12)

  const { data, error, count } = await query
  if (error) return { rows: [], total: 0, error: error.message }
  return { rows: (data ?? []) as unknown as PageRow[], total: count ?? (data?.length ?? 0), error: null }
}

// ── Forms ────────────────────────────────────────────────────────────────────

export async function listForms(
  supabase: SupabaseClient, workspaceId: string, filters: WebQuery = {} as WebQuery, opts: { limit?: number } = {},
): Promise<EntityPage<FormRow>> {
  let query = supabase.from('web_forms')
    .select(`id, workspace_id, name, form_type, status, owner_id, destination_label, submissions_count, completed_count, avg_completion_seconds, fields, confirmation_message, archived_at, created_at, updated_at, ${OWNER_SELECT}`, { count: 'exact' })
    .eq('workspace_id', workspaceId)

  query = filters.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.owner) query = query.eq('owner_id', filters.owner)
  if (filters.q) {
    const term = filters.q.replace(/[%,()]/g, ' ').trim()
    if (term) query = query.ilike('name', `%${term}%`)
  }
  query = query.order('updated_at', { ascending: false }).limit(opts.limit ?? 12)

  const { data, error, count } = await query
  if (error) return { rows: [], total: 0, error: error.message }
  return { rows: (data ?? []) as unknown as FormRow[], total: count ?? (data?.length ?? 0), error: null }
}

// ── Funnels ──────────────────────────────────────────────────────────────────

export async function listFunnels(
  supabase: SupabaseClient, workspaceId: string, filters: WebQuery = {} as WebQuery, opts: { limit?: number; withSteps?: boolean } = {},
): Promise<EntityPage<FunnelRow>> {
  let query = supabase.from('web_funnels')
    .select(`id, workspace_id, name, funnel_type, status, owner_id, entries, conversions, archived_at, created_at, updated_at, ${OWNER_SELECT}`, { count: 'exact' })
    .eq('workspace_id', workspaceId)

  query = filters.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.owner) query = query.eq('owner_id', filters.owner)
  if (filters.q) {
    const term = filters.q.replace(/[%,()]/g, ' ').trim()
    if (term) query = query.ilike('name', `%${term}%`)
  }
  query = query.order('updated_at', { ascending: false }).limit(opts.limit ?? 12)

  const { data, error, count } = await query
  if (error) return { rows: [], total: 0, error: error.message }
  const rows = (data ?? []) as unknown as FunnelRow[]

  if (opts.withSteps && rows.length > 0) {
    const { data: steps } = await supabase.from('web_funnel_steps')
      .select('id, funnel_id, step_order, name, users_count')
      .in('funnel_id', rows.map(r => r.id)).order('step_order', { ascending: true })
    const byFunnel = new Map<string, FunnelStepRow[]>()
    for (const step of (steps ?? []) as unknown as FunnelStepRow[]) {
      const list = byFunnel.get(step.funnel_id) ?? []
      list.push(step)
      byFunnel.set(step.funnel_id, list)
    }
    for (const row of rows) row.steps = byFunnel.get(row.id) ?? []
  }

  return { rows, total: count ?? (data?.length ?? 0), error: null }
}

// ── Experiments ──────────────────────────────────────────────────────────────

export async function listExperiments(
  supabase: SupabaseClient, workspaceId: string, filters: WebQuery = {} as WebQuery, opts: { limit?: number } = {},
): Promise<EntityPage<ExperimentRow>> {
  let query = supabase.from('web_experiments')
    .select(`id, workspace_id, name, experiment_type, surface_ref, status, owner_id, control_visitors, control_conversions, variant_visitors, variant_conversions, traffic_allocation_percent, starts_at, ends_at, winner, archived_at, created_at, updated_at, ${OWNER_SELECT}`, { count: 'exact' })
    .eq('workspace_id', workspaceId)

  query = filters.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.owner) query = query.eq('owner_id', filters.owner)
  if (filters.q) {
    const term = filters.q.replace(/[%,()]/g, ' ').trim()
    if (term) query = query.ilike('name', `%${term}%`)
  }
  query = query.order('updated_at', { ascending: false }).limit(opts.limit ?? 12)

  const { data, error, count } = await query
  if (error) return { rows: [], total: 0, error: error.message }
  return { rows: (data ?? []) as unknown as ExperimentRow[], total: count ?? (data?.length ?? 0), error: null }
}

// ── Tracking ─────────────────────────────────────────────────────────────────

export async function listTrackingEvents(
  supabase: SupabaseClient, workspaceId: string, filters: WebQuery = {} as WebQuery, opts: { limit?: number } = {},
): Promise<EntityPage<TrackingEventRow>> {
  let query = supabase.from('web_tracking_events')
    .select(`id, workspace_id, event_name, event_category, source, destinations, status, volume, coverage_percent, last_received_at, owner_id, created_at, updated_at, ${OWNER_SELECT}`, { count: 'exact' })
    .eq('workspace_id', workspaceId)

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.owner) query = query.eq('owner_id', filters.owner)
  if (filters.q) {
    const term = filters.q.replace(/[%,()]/g, ' ').trim()
    if (term) query = query.ilike('event_name', `%${term}%`)
  }
  query = query.order('last_received_at', { ascending: false, nullsFirst: false }).limit(opts.limit ?? 12)

  const { data, error, count } = await query
  if (error) return { rows: [], total: 0, error: error.message }
  return { rows: (data ?? []) as unknown as TrackingEventRow[], total: count ?? (data?.length ?? 0), error: null }
}

export async function listTrackingDestinations(supabase: SupabaseClient, workspaceId: string): Promise<TrackingDestinationRow[]> {
  const { data } = await supabase.from('web_tracking_destinations')
    .select('id, workspace_id, provider, name, status, last_success_at')
    .eq('workspace_id', workspaceId).order('name', { ascending: true })
  return (data ?? []) as unknown as TrackingDestinationRow[]
}

// ── Aggregates / KPIs ────────────────────────────────────────────────────────

export interface WebAggregates {
  activePages: number
  totalPages: number
  activeForms: number
  totalForms: number
  qualifiedLeads: number
  funnelEntries: number
  funnelConversions: number
  funnelConversionRate: number
  experimentUpliftPercent: number
  trackingHealthPercent: number
  pagesNeedingAttention: number
}

/**
 * One pass over each entity table to derive every KPI the Web & Conversion
 * surfaces show. All numbers are computed from live rows — nothing here is
 * hardcoded or randomised.
 */
export async function webAggregates(supabase: SupabaseClient, workspaceId: string): Promise<WebAggregates> {
  const [pagesRes, formsRes, funnelsRes, experimentsRes, trackingRes] = await Promise.all([
    supabase.from('web_pages').select('status, sessions, conversions').eq('workspace_id', workspaceId).is('archived_at', null),
    supabase.from('web_forms').select('status, form_type, completed_count').eq('workspace_id', workspaceId).is('archived_at', null),
    supabase.from('web_funnels').select('status, entries, conversions').eq('workspace_id', workspaceId).is('archived_at', null),
    supabase.from('web_experiments').select('status, control_visitors, control_conversions, variant_visitors, variant_conversions').eq('workspace_id', workspaceId).is('archived_at', null),
    supabase.from('web_tracking_events').select('status').eq('workspace_id', workspaceId),
  ])

  const pages = pagesRes.data ?? []
  const forms = formsRes.data ?? []
  const funnels = funnelsRes.data ?? []
  const experiments = experimentsRes.data ?? []
  const tracking = trackingRes.data ?? []

  const activePages = pages.filter(p => p.status === 'published').length
  // Pages needing attention: published but converting below a 2% floor — a
  // concrete, inspectable definition rather than an arbitrary "issues" count.
  const pagesNeedingAttention = pages.filter(p => p.status === 'published' && p.sessions > 100 && (p.conversions / Math.max(1, p.sessions)) < 0.02).length

  const activeForms = forms.filter(f => f.status === 'published').length
  const qualifiedLeads = forms
    .filter(f => f.status === 'published' && (QUALIFYING_FORM_TYPES as string[]).includes(f.form_type))
    .reduce((sum, f) => sum + Number(f.completed_count ?? 0), 0)

  const activeFunnels = funnels.filter(f => f.status === 'active' || f.status === 'at_risk')
  const funnelEntries = activeFunnels.reduce((sum, f) => sum + Number(f.entries ?? 0), 0)
  const funnelConversions = activeFunnels.reduce((sum, f) => sum + Number(f.conversions ?? 0), 0)
  const funnelConversionRate = funnelEntries > 0 ? (funnelConversions / funnelEntries) * 100 : 0

  const liveExperiments = experiments.filter(e => e.status === 'running' || e.status === 'analyzing' || e.status === 'completed')
  const uplifts = liveExperiments
    .map(e => {
      const controlRate = e.control_visitors > 0 ? e.control_conversions / e.control_visitors : 0
      const variantRate = e.variant_visitors > 0 ? e.variant_conversions / e.variant_visitors : 0
      return controlRate > 0 ? ((variantRate - controlRate) / controlRate) * 100 : null
    })
    .filter((v): v is number => v !== null)
  const experimentUpliftPercent = uplifts.length > 0 ? uplifts.reduce((a, b) => a + b, 0) / uplifts.length : 0

  // Tracking health: healthy events count fully, warning events count at half
  // weight, critical events count as zero. Documented in the release notes.
  const healthWeight = tracking.reduce((sum, t) => sum + (t.status === 'healthy' ? 1 : t.status === 'warning' ? 0.5 : 0), 0)
  const trackingHealthPercent = tracking.length > 0 ? (healthWeight / tracking.length) * 100 : 100

  return {
    activePages, totalPages: pages.length, activeForms, totalForms: forms.length, qualifiedLeads,
    funnelEntries, funnelConversions, funnelConversionRate, experimentUpliftPercent, trackingHealthPercent,
    pagesNeedingAttention,
  }
}

// ── Metric series (trend, traffic source mix, device mix) ───────────────────

export interface MetricSeriesResult {
  points: { date: string; sessions: number; conversions: number }[]
  bySource: { source: string; sessions: number }[]
  byDevice: { device: string; sessions: number }[]
}

export async function metricSeries(
  supabase: SupabaseClient, workspaceId: string, from: string, to: string,
): Promise<MetricSeriesResult> {
  const { data } = await supabase.from('web_metrics_daily')
    .select('metric_date, source, device, sessions, conversions')
    .eq('workspace_id', workspaceId).gte('metric_date', from).lte('metric_date', to)
    .order('metric_date', { ascending: true })

  const rows = (data ?? []) as unknown as MetricPoint[]

  const byDate = new Map<string, { sessions: number; conversions: number }>()
  const bySourceMap = new Map<string, number>()
  const byDeviceMap = new Map<string, number>()

  for (const row of rows) {
    const entry = byDate.get(row.metric_date) ?? { sessions: 0, conversions: 0 }
    entry.sessions += row.sessions
    entry.conversions += row.conversions
    byDate.set(row.metric_date, entry)
    bySourceMap.set(row.source, (bySourceMap.get(row.source) ?? 0) + row.sessions)
    byDeviceMap.set(row.device, (byDeviceMap.get(row.device) ?? 0) + row.sessions)
  }

  const points = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, agg]) => ({ date, sessions: agg.sessions, conversions: agg.conversions }))

  return {
    points,
    bySource: Array.from(bySourceMap.entries()).map(([source, sessions]) => ({ source, sessions })).sort((a, b) => b.sessions - a.sessions),
    byDevice: Array.from(byDeviceMap.entries()).map(([device, sessions]) => ({ device, sessions })).sort((a, b) => b.sessions - a.sessions),
  }
}

// ── Activity ─────────────────────────────────────────────────────────────────

export async function recentActivity(
  supabase: SupabaseClient, workspaceId: string, opts: { limit?: number } = {},
): Promise<ActivityRow[]> {
  const { data } = await supabase.from('web_activity')
    .select(`id, workspace_id, actor_id, entity_type, entity_id, action, summary, link, created_at, actor:profiles(id, full_name, email, avatar_url)`)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false }).limit(opts.limit ?? 8)
  return (data ?? []) as unknown as ActivityRow[]
}

export async function workspaceMembers(supabase: SupabaseClient, workspaceId: string) {
  const { data } = await supabase
    .from('workspace_members')
    .select('user_id, profiles(id, full_name, email, avatar_url)')
    .eq('workspace_id', workspaceId)

  const people: { id: string; full_name: string | null; email: string | null; avatar_url: string | null }[] = []
  for (const row of data ?? []) {
    const p = (row as { profiles?: typeof people[number] | typeof people }).profiles
    const person = Array.isArray(p) ? p[0] : p
    if (person?.id) people.push(person)
  }
  return people.sort((a, b) => (a.full_name ?? a.email ?? '').localeCompare(b.full_name ?? b.email ?? ''))
}

// ── Mixed "Web experiences" table ────────────────────────────────────────────

/**
 * Merges pages/forms/funnels/experiments/tracking events into one feed for
 * the Overview table. At workspace scale this in-app merge (bounded fetch per
 * entity, then sort/paginate in memory) is simpler and safer than a
 * cross-table SQL view; if a workspace's combined row count grows past a few
 * thousand this should move to a materialized `web_experiences` view.
 */
export async function listWebExperiences(
  supabase: SupabaseClient, workspaceId: string, filters: WebQuery,
): Promise<{ rows: WebExperienceRow[]; total: number }> {
  const limit = 200
  const [pages, forms, funnels, experiments, tracking] = await Promise.all([
    listPages(supabase, workspaceId, filters, { limit }),
    listForms(supabase, workspaceId, filters, { limit }),
    listFunnels(supabase, workspaceId, filters, { limit }),
    listExperiments(supabase, workspaceId, filters, { limit }),
    listTrackingEvents(supabase, workspaceId, filters, { limit }),
  ])

  const rows: WebExperienceRow[] = [
    ...pages.rows.map((p): WebExperienceRow => ({
      id: p.id, kind: 'page', name: p.name, subLabel: `/${p.slug}`, typeLabel: PAGE_TYPE_LABELS[p.page_type],
      ownerName: p.owner?.full_name ?? p.owner?.email ?? null, status: p.status,
      statusLabel: PAGE_STATUS_LABELS[p.status], statusBadge: PAGE_STATUS_BADGE[p.status],
      traffic: p.sessions, conversions: p.conversions, conversionRate: p.sessions > 0 ? (p.conversions / p.sessions) * 100 : 0,
      updatedAt: p.updated_at, href: `${WEB_MODULE_META.pages.href}`,
    })),
    ...forms.rows.map((f): WebExperienceRow => ({
      id: f.id, kind: 'form', name: f.name, subLabel: `/forms/${f.id.slice(0, 8)}`, typeLabel: FORM_TYPE_LABELS[f.form_type],
      ownerName: f.owner?.full_name ?? f.owner?.email ?? null, status: f.status,
      statusLabel: FORM_STATUS_LABELS[f.status], statusBadge: FORM_STATUS_BADGE[f.status],
      traffic: f.submissions_count, conversions: f.completed_count,
      conversionRate: f.submissions_count > 0 ? (f.completed_count / f.submissions_count) * 100 : 0,
      updatedAt: f.updated_at, href: `${WEB_MODULE_META.forms.href}`,
    })),
    ...funnels.rows.map((fu): WebExperienceRow => ({
      id: fu.id, kind: 'funnel', name: fu.name, subLabel: `/funnels/${fu.id.slice(0, 8)}`, typeLabel: FUNNEL_TYPE_LABELS[fu.funnel_type],
      ownerName: fu.owner?.full_name ?? fu.owner?.email ?? null, status: fu.status,
      statusLabel: FUNNEL_STATUS_LABELS[fu.status], statusBadge: FUNNEL_STATUS_BADGE[fu.status],
      traffic: fu.entries, conversions: fu.conversions, conversionRate: fu.entries > 0 ? (fu.conversions / fu.entries) * 100 : 0,
      updatedAt: fu.updated_at, href: `${WEB_MODULE_META.funnels.href}`,
    })),
    ...experiments.rows.map((e): WebExperienceRow => {
      const totalVisitors = e.control_visitors + e.variant_visitors
      const totalConversions = e.control_conversions + e.variant_conversions
      return {
        id: e.id, kind: 'experiment', name: e.name, subLabel: e.surface_ref ?? '—', typeLabel: EXPERIMENT_TYPE_LABELS[e.experiment_type],
        ownerName: e.owner?.full_name ?? e.owner?.email ?? null, status: e.status,
        statusLabel: EXPERIMENT_STATUS_LABELS[e.status], statusBadge: EXPERIMENT_STATUS_BADGE[e.status],
        traffic: totalVisitors, conversions: totalConversions, conversionRate: totalVisitors > 0 ? (totalConversions / totalVisitors) * 100 : 0,
        updatedAt: e.updated_at, href: `${WEB_MODULE_META.experiments.href}`,
      }
    }),
    ...tracking.rows.map((t): WebExperienceRow => ({
      id: t.id, kind: 'tracking_event', name: t.event_name, subLabel: `/tracking/${t.id.slice(0, 8)}`, typeLabel: 'Tracking',
      ownerName: t.owner?.full_name ?? t.owner?.email ?? null, status: t.status,
      statusLabel: TRACKING_HEALTH_LABELS[t.status], statusBadge: TRACKING_HEALTH_BADGE[t.status],
      traffic: t.volume, conversions: null, conversionRate: null,
      updatedAt: t.updated_at, href: `${WEB_MODULE_META.tracking.href}`,
    })),
  ]

  rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const pageSize = 10
  const start = (filters.page - 1) * pageSize
  return { rows: rows.slice(start, start + pageSize), total: rows.length }
}

// ── Single-record fetchers (detail routes) ───────────────────────────────────

export async function getPage(supabase: SupabaseClient, workspaceId: string, id: string): Promise<PageRow | null> {
  const { data } = await supabase.from('web_pages')
    .select(`id, workspace_id, name, slug, page_type, status, owner_id, sessions, conversions, content, seo_title, seo_description, version, published_at, archived_at, created_at, updated_at, ${OWNER_SELECT}`)
    .eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  return (data as unknown as PageRow) ?? null
}

export async function getForm(supabase: SupabaseClient, workspaceId: string, id: string): Promise<FormRow | null> {
  const { data } = await supabase.from('web_forms')
    .select(`id, workspace_id, name, form_type, status, owner_id, destination_label, submissions_count, completed_count, avg_completion_seconds, fields, confirmation_message, archived_at, created_at, updated_at, ${OWNER_SELECT}`)
    .eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  return (data as unknown as FormRow) ?? null
}

export async function getFunnel(supabase: SupabaseClient, workspaceId: string, id: string): Promise<FunnelRow | null> {
  const { data } = await supabase.from('web_funnels')
    .select(`id, workspace_id, name, funnel_type, status, owner_id, entries, conversions, archived_at, created_at, updated_at, ${OWNER_SELECT}`)
    .eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  if (!data) return null
  const { data: steps } = await supabase.from('web_funnel_steps').select('id, funnel_id, step_order, name, users_count').eq('funnel_id', id).order('step_order', { ascending: true })
  return { ...(data as unknown as FunnelRow), steps: (steps ?? []) as unknown as FunnelStepRow[] }
}

export async function getExperiment(supabase: SupabaseClient, workspaceId: string, id: string): Promise<ExperimentRow | null> {
  const { data } = await supabase.from('web_experiments')
    .select(`id, workspace_id, name, experiment_type, surface_ref, status, owner_id, control_visitors, control_conversions, variant_visitors, variant_conversions, traffic_allocation_percent, starts_at, ends_at, winner, archived_at, created_at, updated_at, ${OWNER_SELECT}`)
    .eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  return (data as unknown as ExperimentRow) ?? null
}

export async function listFormSubmissions(
  supabase: SupabaseClient, workspaceId: string, formId: string, opts: { limit?: number } = {},
): Promise<{ rows: import('./types').FormSubmissionRow[]; total: number }> {
  const { data, count } = await supabase.from('web_form_submissions')
    .select('id, workspace_id, form_id, data, completed, source_url, created_at', { count: 'exact' })
    .eq('workspace_id', workspaceId).eq('form_id', formId)
    .order('created_at', { ascending: false }).limit(opts.limit ?? 50)
  return { rows: (data ?? []) as unknown as import('./types').FormSubmissionRow[], total: count ?? (data?.length ?? 0) }
}

// ── Experiment statistics ────────────────────────────────────────────────────
// Moved to ./stats.ts (pure, no Supabase dependency — safe for client bundles).
export { computeExperimentStats, type ExperimentStats } from './stats'
