import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MESSAGING_CHANNELS, type MessagingChannel } from './constants'
import { EMPTY_TOTALS, pointChange, ratesOf, relativeChange, sumTotals, type MetricTotals, type PeriodWindow } from './metrics'
import type { PersonLite } from './types'

// Server-side reads for the eight redesigned Messaging pages. Every query is
// scoped by workspace_id (RLS enforces the same boundary again), aggregates
// happen here rather than in the browser, and nothing is fabricated: a missing
// value comes back as null so the page can show an honest dash.

const PERSON = 'id, full_name, email, avatar_url'

// ── Channel KPIs & series ────────────────────────────────────────────────────

export interface DailyPoint { date: string; sent: number; delivered: number; opened: number; clicked: number; converted: number; opt_outs: number }

export interface ChannelPerformance {
  current: MetricTotals
  previous: MetricTotals
  byChannel: Record<MessagingChannel, MetricTotals>
  series: DailyPoint[]
  deltas: { sent: number | null; delivery: number | null; open: number | null; click: number | null; conversion: number | null; optOut: number | null }
}

export async function channelPerformance(
  supabase: SupabaseClient, workspaceId: string, channels: MessagingChannel[], period: PeriodWindow,
): Promise<ChannelPerformance> {
  const { data } = await supabase.from('messaging_metrics_daily')
    .select('metric_date, channel, sent, delivered, opened, clicked, converted, opt_outs')
    .eq('workspace_id', workspaceId).in('channel', channels.length ? channels : ['__none__'])
    .gte('metric_date', period.prevFrom).lte('metric_date', period.to)
    .order('metric_date', { ascending: true })

  const rows = data ?? []
  const currentRows = rows.filter(r => r.metric_date >= period.from)
  const previousRows = rows.filter(r => r.metric_date < period.from)
  const current = sumTotals(currentRows)
  const previous = sumTotals(previousRows)

  const byChannel = Object.fromEntries(MESSAGING_CHANNELS.map(c => [c, sumTotals(currentRows.filter(r => r.channel === c))])) as Record<MessagingChannel, MetricTotals>

  const byDate = new Map<string, DailyPoint>()
  for (const r of currentRows) {
    const p = byDate.get(r.metric_date) ?? { date: r.metric_date, ...EMPTY_TOTALS }
    p.sent += r.sent; p.delivered += r.delivered; p.opened += r.opened; p.clicked += r.clicked; p.converted += r.converted; p.opt_outs += r.opt_outs
    byDate.set(r.metric_date, p)
  }

  const now = ratesOf(current), before = ratesOf(previous)
  return {
    current, previous, byChannel,
    series: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    deltas: {
      sent: relativeChange(current.sent, previous.sent),
      delivery: pointChange(now.delivery, before.delivery),
      open: pointChange(now.open, before.open),
      click: pointChange(now.click, before.click),
      conversion: pointChange(now.conversion, before.conversion),
      optOut: pointChange(now.optOut, before.optOut),
    },
  }
}

// ── Breakdowns (mailbox provider, carrier, device OS …) ──────────────────────

export interface BreakdownRow {
  dim_key: string; dim_label: string
  sent: number; delivered: number; opened: number; clicked: number; replied: number; converted: number; failed: number; opt_outs: number
}

export async function breakdown(
  supabase: SupabaseClient, workspaceId: string, channel: MessagingChannel, dimension: string,
): Promise<BreakdownRow[]> {
  const { data } = await supabase.from('messaging_metrics_breakdown')
    .select('dim_key, dim_label, sent, delivered, opened, clicked, replied, converted, failed, opt_outs, period_end')
    .eq('workspace_id', workspaceId).eq('channel', channel).eq('dimension', dimension)
    .order('period_end', { ascending: false }).order('sent', { ascending: false })
  const rows = (data ?? []) as (BreakdownRow & { period_end: string })[]
  const latest = rows[0]?.period_end
  return rows.filter(r => r.period_end === latest)
}

// ── Programmes (messages) ────────────────────────────────────────────────────

export interface ProgramRow {
  id: string
  channel: MessagingChannel
  name: string
  category: string
  message_type: string
  status: string
  approval_status: string
  sender_id: string | null
  sent_count: number
  delivered_count: number
  opened_count: number
  clicked_count: number
  converted_count: number
  opt_out_count: number
  failed_count: number
  fallback_count: number
  prior_rates: { delivery?: number; open?: number; click?: number; conversion?: number; opt_out?: number }
  channel_mix: MessagingChannel[]
  content: { layout?: string; template_name?: string; noLastSent?: boolean }
  sent_at: string | null
  scheduled_at: string | null
  updated_at: string
  owner: PersonLite | null
  audience: { id: string; name: string; contact_count: number } | null
}

export interface ProgramQuery {
  channels?: MessagingChannel[]
  messageTypes?: string[]
  q?: string
  status?: string
  owner?: string
  category?: string
  audience?: string
  /** Overview lists orchestrated programmes: messages sent across at least this many channels. */
  minChannels?: number
  page: number
  size: number
}

export async function listPrograms(supabase: SupabaseClient, workspaceId: string, query: ProgramQuery) {
  let request = supabase.from('messaging_messages')
    .select(`id, channel, name, category, message_type, status, approval_status, sender_id, sent_count, delivered_count, opened_count, clicked_count,
      converted_count, opt_out_count, failed_count, fallback_count, prior_rates, channel_mix, content, sent_at, scheduled_at, updated_at,
      owner:profiles!messaging_messages_owner_id_fkey(${PERSON}), audience:messaging_audiences(id, name, contact_count)`, { count: 'exact' })
    .eq('workspace_id', workspaceId).is('archived_at', null)
  if (query.channels?.length) request = request.in('channel', query.channels)
  if (query.messageTypes?.length) request = request.in('message_type', query.messageTypes)
  if (query.status) request = request.eq('status', query.status)
  if (query.owner) request = request.eq('owner_id', query.owner)
  if (query.category) request = request.eq('category', query.category)
  if (query.audience) request = request.eq('audience_id', query.audience)
  if (query.minChannels) request = request.gte('channel_count', query.minChannels)
  if (query.q) {
    const term = query.q.replace(/[%,()]/g, ' ').trim()
    if (term) request = request.ilike('name', `%${term}%`)
  }
  const fromIndex = (query.page - 1) * query.size
  const { data, count, error } = await request
    .order('updated_at', { ascending: false }).order('id', { ascending: true })
    .range(fromIndex, fromIndex + query.size - 1)
  return { rows: (data ?? []) as unknown as ProgramRow[], total: count ?? 0, error: error?.message ?? null }
}

/** Top broadcast campaigns ranked by volume (Push "Top push campaigns"). */
export async function topCampaigns(supabase: SupabaseClient, workspaceId: string, channel: MessagingChannel, limit = 5) {
  const { data } = await supabase.from('messaging_messages')
    .select('id, name, sent_count, delivered_count, opened_count, clicked_count, converted_count, prior_rates')
    .eq('workspace_id', workspaceId).eq('channel', channel).eq('message_type', 'broadcast').is('archived_at', null)
    .gt('sent_count', 100_000).order('sent_count', { ascending: false }).limit(limit)
  return (data ?? []) as Pick<ProgramRow, 'id' | 'name' | 'sent_count' | 'delivered_count' | 'opened_count' | 'clicked_count' | 'converted_count' | 'prior_rates'>[]
}

/** Paused/draft broadcasts with no send for 14+ days. */
export async function staleCampaigns(supabase: SupabaseClient, workspaceId: string, channel: MessagingChannel) {
  const cutoff = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const { data } = await supabase.from('messaging_messages')
    .select('id, name, sent_at, status')
    .eq('workspace_id', workspaceId).eq('channel', channel).is('archived_at', null)
    .in('status', ['paused', 'draft']).lt('sent_at', cutoff).order('sent_at', { ascending: false }).limit(3)
  return (data ?? []) as { id: string; name: string; sent_at: string; status: string }[]
}

export interface StatusCounts { pending: number; active: number; paused: number; scheduled: number; total: number }

export async function messageStatusCounts(supabase: SupabaseClient, workspaceId: string, channels: MessagingChannel[]): Promise<StatusCounts> {
  const { data } = await supabase.from('messaging_messages').select('status, approval_status')
    .eq('workspace_id', workspaceId).in('channel', channels).is('archived_at', null)
  const rows = data ?? []
  return {
    pending: rows.filter(r => r.approval_status === 'pending').length,
    active: rows.filter(r => r.status === 'sending').length,
    paused: rows.filter(r => r.status === 'paused').length,
    scheduled: rows.filter(r => r.status === 'scheduled').length,
    total: rows.length,
  }
}

/** Messages by category (Top message types), weighted by volume sent. */
export async function categoryShare(supabase: SupabaseClient, workspaceId: string, channels: MessagingChannel[]) {
  const { data } = await supabase.from('messaging_messages').select('category, sent_count')
    .eq('workspace_id', workspaceId).in('channel', channels).is('archived_at', null)
  const totals = new Map<string, number>()
  let all = 0
  for (const row of data ?? []) { totals.set(row.category, (totals.get(row.category) ?? 0) + row.sent_count); all += row.sent_count }
  return [...totals.entries()].map(([category, sent]) => ({ category, sent, share: all ? (sent / all) * 100 : 0 }))
    .sort((a, b) => b.sent - a.sent)
}

// ── Approval submissions from the audit trail (review deltas) ────────────────

export async function submissionCounts(
  supabase: SupabaseClient, workspaceId: string, surfaces: string[], action: string, period: PeriodWindow,
) {
  const [current, previous] = await Promise.all([
    supabase.from('messaging_activity').select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).in('surface', surfaces).eq('action', action)
      .gte('created_at', `${period.from}T00:00:00Z`).lte('created_at', `${period.to}T23:59:59Z`),
    supabase.from('messaging_activity').select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).in('surface', surfaces).eq('action', action)
      .gte('created_at', `${period.prevFrom}T00:00:00Z`).lte('created_at', `${period.prevTo}T23:59:59Z`),
  ])
  return { current: current.count ?? 0, previous: previous.count ?? 0 }
}

// ── Activity ─────────────────────────────────────────────────────────────────

export interface ActivityItem { id: string; action: string; entity_type: string; summary: string; link: string | null; created_at: string }

export async function activityFeed(supabase: SupabaseClient, workspaceId: string, surfaces: string[] | null, limit: number) {
  let request = supabase.from('messaging_activity').select('id, action, entity_type, summary, link, created_at')
    .eq('workspace_id', workspaceId).not('action', 'in', '(submitted_for_approval,submit_review)')
  if (surfaces) request = request.in('surface', surfaces)
  const { data } = await request.order('created_at', { ascending: false }).limit(limit)
  return (data ?? []) as ActivityItem[]
}

// ── Channel configuration / health ───────────────────────────────────────────

export interface ChannelConfig {
  channel: MessagingChannel
  status: string
  provider: string | null
  last_checked_at: string | null
  last_error: string | null
  config: Record<string, unknown>
}

export async function channelConfigs(supabase: SupabaseClient, workspaceId: string): Promise<Record<MessagingChannel, ChannelConfig>> {
  const { data } = await supabase.from('messaging_channel_configs')
    .select('channel, status, provider, last_checked_at, last_error, config').eq('workspace_id', workspaceId)
  const byChannel = new Map((data ?? []).map(row => [row.channel, row as ChannelConfig]))
  return Object.fromEntries(MESSAGING_CHANNELS.map(channel => [channel, byChannel.get(channel) ?? {
    channel, status: 'not_connected', provider: null, last_checked_at: null, last_error: null, config: {},
  }])) as Record<MessagingChannel, ChannelConfig>
}

// ── Audiences ────────────────────────────────────────────────────────────────

export type ReachCounts = { eligible: number; risky: number; ineligible: number; unknown: number }

export interface AudienceDetail {
  id: string
  name: string
  contact_count: number
  tags: string[]
  exclusions: string[]
  channel_reach: Partial<Record<MessagingChannel, ReachCounts>>
  filter_definition: { regions?: string[]; opt_in_rate?: number; prior_opt_in_rate?: number; opted_in_label?: string }
  updated_at: string
}

export async function audienceDetails(supabase: SupabaseClient, workspaceId: string): Promise<AudienceDetail[]> {
  const { data } = await supabase.from('messaging_audiences')
    .select('id, name, contact_count, tags, exclusions, channel_reach, filter_definition, updated_at')
    .eq('workspace_id', workspaceId).is('archived_at', null).order('updated_at', { ascending: false })
  return (data ?? []) as AudienceDetail[]
}

/** Audiences whose size changed in the last 7 days. */
export function recentlyChangedAudiences(audiences: AudienceDetail[]) {
  const cutoff = Date.now() - 7 * 86_400_000
  return audiences.filter(a => Date.parse(a.updated_at) > cutoff)
}

// ── Journeys ─────────────────────────────────────────────────────────────────

export interface CanvasNode {
  id: string
  type: 'trigger' | 'message' | 'wait' | 'condition' | 'end' | 'action'
  x?: number
  row?: number
  label?: string
  sublabel?: string
  channel?: MessagingChannel
  actionKind?: string
  fallback?: boolean
  waitHours?: number
  conditionType?: string
  content?: { subject?: string; body?: string; headline?: string; from?: string; cta?: string }
  stats?: { count: number; rate?: number; label?: string }
  order?: number
}
export interface CanvasEdge { from: string; to: string; branch?: 'yes' | 'no' }

export interface JourneySummary {
  id: string
  name: string
  description: string | null
  journey_type: string
  status: string
  health: string
  contacts_in_flow: number
  total_entered: number
  on_track_rate: number
  conversion_rate: number
  prior_conversion_rate: number | null
  next_launch_at: string | null
  updated_at: string
  trigger: { label?: string; approval?: string }
  canvas: { nodes: CanvasNode[]; edges: CanvasEdge[] }
  owner: PersonLite | null
  audience: { id: string; name: string } | null
}

export async function listJourneySummaries(supabase: SupabaseClient, workspaceId: string, opts: { q?: string; status?: string; owner?: string; type?: string; health?: string; audience?: string } = {}) {
  let request = supabase.from('messaging_journeys')
    .select(`id, name, description, journey_type, status, health, contacts_in_flow, total_entered, on_track_rate, conversion_rate, prior_conversion_rate,
      next_launch_at, updated_at, trigger, canvas, owner:profiles!messaging_journeys_owner_id_fkey(${PERSON}), audience:messaging_audiences(id, name)`)
    .eq('workspace_id', workspaceId).is('archived_at', null)
  if (opts.status) request = request.eq('status', opts.status)
  if (opts.owner) request = request.eq('owner_id', opts.owner)
  if (opts.type) request = request.eq('journey_type', opts.type)
  if (opts.health) request = request.eq('health', opts.health)
  if (opts.audience) request = request.eq('audience_id', opts.audience)
  if (opts.q) {
    const term = opts.q.replace(/[%,()]/g, ' ').trim()
    if (term) request = request.ilike('name', `%${term}%`)
  }
  const { data } = await request.order('updated_at', { ascending: false })
  return (data ?? []) as unknown as JourneySummary[]
}

function messageChannels(journey: JourneySummary): MessagingChannel[] {
  return [...new Set(journey.canvas?.nodes?.filter(n => n.type === 'message' && n.channel && !n.fallback).map(n => n.channel as MessagingChannel) ?? [])]
}

/**
 * The journey a page's canvas panel shows: the one named in the URL when it
 * belongs to this workspace, otherwise the most recently updated journey whose
 * first message step uses this channel (or, on Overview, the most recent
 * cross-channel journey).
 */
export function pickCanvasJourney(journeys: JourneySummary[], channel: MessagingChannel | null, requestedId?: string) {
  const requested = requestedId ? journeys.find(j => j.id === requestedId) : undefined
  if (requested) return requested
  // Drafts first: the canvas panel is where work in progress gets reviewed.
  const withNodes = journeys.filter(j => j.canvas?.nodes?.length)
  const candidates = [...withNodes.filter(j => j.status === 'draft'), ...withNodes.filter(j => j.status !== 'draft')]
  if (!channel) return candidates.find(j => messageChannels(j).length > 1) ?? candidates[0] ?? null
  return candidates.find(j => messageChannels(j)[0] === channel) ?? candidates.find(j => messageChannels(j).includes(channel)) ?? null
}

// ── Templates ────────────────────────────────────────────────────────────────

export interface TemplateSummary {
  id: string
  name: string
  channel: MessagingChannel
  category: string
  status: string
  usage_count: number
  unique_recipients: number
  avg_reuse_rate: number
  ctr_uplift: number | null
  tags: string[]
  variables: string[]
  preview: { preview?: string; subject?: string; body?: string; headline?: string; cta_label?: string; cta_url?: string; segments?: string[]; conversion_rate?: number }
  preview_image_url: string | null
  provider_template_id: string | null
  provider_status: string | null
  approval_priority: string | null
  approval_expires_at: string | null
  journey_ids: string[]
  last_used_at: string | null
  updated_at: string
  owner: PersonLite | null
}

const TEMPLATE_COLUMNS = `id, name, channel, category, status, usage_count, unique_recipients, avg_reuse_rate, ctr_uplift, tags, variables, preview,
  preview_image_url, provider_template_id, provider_status, approval_priority, approval_expires_at, journey_ids, last_used_at, updated_at,
  owner:profiles!messaging_templates_owner_id_fkey(${PERSON})`

export interface TemplateQuery { channel?: string; status?: string; owner?: string; category?: string; updatedDays?: number; tag?: string; q?: string; page: number; size: number }

export async function listTemplatePage(supabase: SupabaseClient, workspaceId: string, query: TemplateQuery) {
  let request = supabase.from('messaging_templates').select(TEMPLATE_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId).is('archived_at', null)
  if (query.channel) request = request.eq('channel', query.channel)
  if (query.status) request = request.eq('status', query.status)
  if (query.owner) request = request.eq('owner_id', query.owner)
  if (query.category) request = request.eq('category', query.category)
  if (query.tag) request = request.contains('tags', [query.tag])
  if (query.updatedDays) request = request.gte('updated_at', new Date(Date.now() - query.updatedDays * 86_400_000).toISOString())
  if (query.q) {
    const term = query.q.replace(/[%,()]/g, ' ').trim()
    if (term) request = request.ilike('name', `%${term}%`)
  }
  const fromIndex = (query.page - 1) * query.size
  const { data, count } = await request.order('updated_at', { ascending: false }).order('id').range(fromIndex, fromIndex + query.size - 1)
  return { rows: (data ?? []) as unknown as TemplateSummary[], total: count ?? 0 }
}

export async function templatesWhere(supabase: SupabaseClient, workspaceId: string, build: (q: ReturnType<typeof baseTemplates>) => ReturnType<typeof baseTemplates>, limit = 5) {
  const { data } = await build(baseTemplates(supabase, workspaceId)).limit(limit)
  return (data ?? []) as unknown as TemplateSummary[]
}

function baseTemplates(supabase: SupabaseClient, workspaceId: string) {
  return supabase.from('messaging_templates').select(TEMPLATE_COLUMNS).eq('workspace_id', workspaceId).is('archived_at', null)
}

export interface TemplateStats {
  total: number; totalBefore: number
  published: number; publishedBefore: number
  inReview: number
  avgReuse: number | null; priorAvgReuse: number | null
  ctrUplift: number | null; priorCtrUplift: number | null
  recentlyUpdated: number; recentlyUpdatedBefore: number
  missingTags: number; missingPlainText: number
}

/** One pass over the library's aggregate columns for the Templates KPI band. */
export async function templateStats(supabase: SupabaseClient, workspaceId: string, period: PeriodWindow): Promise<TemplateStats> {
  const { data } = await supabase.from('messaging_templates')
    .select('status, created_at, published_at, updated_at, avg_reuse_rate, ctr_uplift, prior_rates, tags, channel, content')
    .eq('workspace_id', workspaceId).is('archived_at', null).range(0, 9999)
  const rows = data ?? []
  const start = Date.parse(`${period.from}T00:00:00Z`)
  const prevStart = Date.parse(`${period.prevFrom}T00:00:00Z`)
  const published = rows.filter(r => r.status === 'published')
  const avg = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  const reuse = avg(published.map(r => Number(r.avg_reuse_rate)))
  const priorReuse = avg(published.map(r => Number((r.prior_rates as { avg_reuse_rate?: number })?.avg_reuse_rate)).filter(Number.isFinite))
  const uplift = avg(published.map(r => r.ctr_uplift).filter((v): v is number => v !== null).map(Number))
  const priorUplift = avg(published.map(r => Number((r.prior_rates as { ctr_uplift?: number })?.ctr_uplift)).filter(Number.isFinite))
  return {
    total: rows.length,
    totalBefore: rows.filter(r => Date.parse(r.created_at) < start).length,
    published: published.length,
    publishedBefore: published.filter(r => r.published_at && Date.parse(r.published_at) < start).length,
    inReview: rows.filter(r => r.status === 'in_review').length,
    avgReuse: reuse, priorAvgReuse: priorReuse, ctrUplift: uplift, priorCtrUplift: priorUplift,
    recentlyUpdated: rows.filter(r => Date.parse(r.updated_at) >= start).length,
    recentlyUpdatedBefore: rows.filter(r => Date.parse(r.updated_at) >= prevStart && Date.parse(r.updated_at) < start).length,
    missingTags: rows.filter(r => !(r.tags as string[])?.length).length,
    missingPlainText: rows.filter(r => r.channel === 'email' && !(r.content as { plain_text?: string })?.plain_text).length,
  }
}

// ── Members ──────────────────────────────────────────────────────────────────

export async function members(supabase: SupabaseClient, workspaceId: string): Promise<PersonLite[]> {
  const { data } = await supabase.from('workspace_members').select(`profiles(${PERSON})`).eq('workspace_id', workspaceId)
  const people: PersonLite[] = []
  for (const row of data ?? []) {
    const p = (row as { profiles?: PersonLite | PersonLite[] }).profiles
    const person = Array.isArray(p) ? p[0] : p
    if (person?.id) people.push(person)
  }
  return people.sort((a, b) => (a.full_name ?? a.email ?? '').localeCompare(b.full_name ?? b.email ?? ''))
}

// ── Composer drafts & media ──────────────────────────────────────────────────

export interface ComposerDraft {
  id: string
  name: string
  channel: MessagingChannel
  sender_id: string | null
  subject: string | null
  audience_id: string | null
  content: Record<string, unknown>
}

/** The newest unsent draft per channel, which each page's composer resumes. */
export async function latestDrafts(supabase: SupabaseClient, workspaceId: string, channels: MessagingChannel[]) {
  const { data } = await supabase.from('messaging_messages')
    .select('id, name, channel, sender_id, subject, audience_id, content, updated_at')
    .eq('workspace_id', workspaceId).in('channel', channels).eq('status', 'draft').eq('sent_count', 0).is('archived_at', null)
    .order('updated_at', { ascending: false }).limit(40)
  const out: Partial<Record<MessagingChannel, ComposerDraft>> = {}
  for (const row of (data ?? []) as ComposerDraft[]) if (!out[row.channel]) out[row.channel] = row
  return out
}

/** Replaces private 2: paths anywhere in a value with short-lived signed URLs. */
export async function signMedia<T>(value: T): Promise<T> {
  const paths = new Set<string>()
  const walk = (v: unknown) => {
    if (typeof v === 'string' && v.startsWith('r2:')) paths.add(v)
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(value)
  if (paths.size === 0) return value
  const { signReadUrls } = await import('@/lib/storage/r2')
  const signed = await signReadUrls([...paths], 3600)
  const replace = (v: unknown): unknown => {
    if (typeof v === 'string' && v.startsWith('r2:')) return signed.get(v) ?? null
    if (Array.isArray(v)) return v.map(replace)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, replace(x)]))
    return v
  }
  return replace(value) as T
}

export async function savedViews(supabase: SupabaseClient, workspaceId: string, userId: string, surface: string) {
  const { data } = await supabase.from('messaging_saved_views').select('id, name, params, shared, user_id')
    .eq('workspace_id', workspaceId).eq('surface', surface).order('created_at', { ascending: true })
  return (data ?? []).map(v => ({ id: v.id, name: v.name, params: v.params as Record<string, string>, shared: v.shared, mine: v.user_id === userId }))
}