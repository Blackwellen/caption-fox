import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ActivityRow, AudienceRow, ChannelConfigRow, JourneyRow, MessageRow, MetricPoint, TemplateRow,
} from './types'
import { MESSAGING_CHANNELS, type MessagingChannel } from './constants'

const OWNER_SELECT = 'owner:profiles!messaging_messages_owner_id_fkey(id, full_name, email, avatar_url)'

const MESSAGE_COLUMNS = `
  id, workspace_id, channel, name, message_type, status, sender_id, subject, content,
  audience_id, journey_id, template_id, campaign_id, approval_status, scheduled_at, sent_at,
  sent_count, delivered_count, opened_count, clicked_count, converted_count, opt_out_count,
  failed_count, owner_id, version, archived_at, created_at, updated_at,
  ${OWNER_SELECT},
  audience:messaging_audiences(id, name, contact_count)
`

export interface MessagingListFilters {
  q?: string
  channel?: string
  status?: string
  owner?: string
  journeyStatus?: string
  archived?: boolean
  page?: number
  size?: number
}

export interface MessagePage { rows: MessageRow[]; total: number; error: string | null }

/** Programs table — the top messaging programs shown on Overview and each channel page. */
export async function listMessages(
  supabase: SupabaseClient,
  workspaceId: string,
  filters: MessagingListFilters = {},
  opts: { channels?: MessagingChannel[]; limit?: number } = {},
): Promise<MessagePage> {
  let query = supabase.from('messaging_messages').select(MESSAGE_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)

  query = filters.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null)
  if (opts.channels?.length) query = query.in('channel', opts.channels)
  if (filters.channel) query = query.eq('channel', filters.channel)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.owner) query = query.eq('owner_id', filters.owner)
  if (filters.q) {
    const term = filters.q.replace(/[%,()]/g, ' ').trim()
    if (term) query = query.ilike('name', `%${term}%`)
  }

  query = query.order('updated_at', { ascending: false }).order('id', { ascending: true })
  query = query.limit(opts.limit ?? 12)

  const { data, error, count } = await query
  if (error) return { rows: [], total: 0, error: error.message }
  return { rows: (data ?? []) as unknown as MessageRow[], total: count ?? (data?.length ?? 0), error: null }
}

// ── Aggregates ───────────────────────────────────────────────────────────────

export interface MessagingAggregates {
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalConverted: number
  totalOptOuts: number
  pendingApproval: number
  byChannel: Record<MessagingChannel, number>
  activePrograms: number
  totalPrograms: number
}

/**
 * One pass over the workspace's live messages to derive every KPI the
 * Messaging surfaces show. Selecting only the aggregate columns keeps this
 * cheap even on large workspaces and avoids a KPI-per-query N+1.
 */
export async function messagingAggregates(
  supabase: SupabaseClient,
  workspaceId: string,
  opts: { channels?: MessagingChannel[] } = {},
): Promise<MessagingAggregates> {
  let query = supabase.from('messaging_messages')
    .select('channel, status, approval_status, sent_count, delivered_count, opened_count, clicked_count, converted_count, opt_out_count')
    .eq('workspace_id', workspaceId).is('archived_at', null)
  if (opts.channels?.length) query = query.in('channel', opts.channels)

  const { data } = await query
  const rows = data ?? []

  const byChannel = Object.fromEntries(MESSAGING_CHANNELS.map(c => [c, 0])) as Record<MessagingChannel, number>
  let totalSent = 0, totalDelivered = 0, totalOpened = 0, totalClicked = 0, totalConverted = 0, totalOptOuts = 0
  let pendingApproval = 0, activePrograms = 0

  for (const row of rows) {
    const channel = row.channel as MessagingChannel
    if (channel in byChannel) byChannel[channel] += Number(row.sent_count ?? 0)
    totalSent += Number(row.sent_count ?? 0)
    totalDelivered += Number(row.delivered_count ?? 0)
    totalOpened += Number(row.opened_count ?? 0)
    totalClicked += Number(row.clicked_count ?? 0)
    totalConverted += Number(row.converted_count ?? 0)
    totalOptOuts += Number(row.opt_out_count ?? 0)
    if (row.approval_status === 'pending') pendingApproval += 1
    if (row.status === 'sending' || row.status === 'scheduled') activePrograms += 1
  }

  return {
    totalSent, totalDelivered, totalOpened, totalClicked, totalConverted, totalOptOuts,
    pendingApproval, byChannel, activePrograms, totalPrograms: rows.length,
  }
}

export interface MetricSeriesResult { points: MetricPoint[]; upliftPercent: number }

export async function metricSeries(
  supabase: SupabaseClient,
  workspaceId: string,
  from: string,
  to: string,
  opts: { channels?: MessagingChannel[] } = {},
): Promise<MetricSeriesResult> {
  let query = supabase.from('messaging_metrics_daily')
    .select('metric_date, channel, sent, delivered, opened, clicked, converted, opt_outs')
    .eq('workspace_id', workspaceId).gte('metric_date', from).lte('metric_date', to)
    .order('metric_date', { ascending: true })
  if (opts.channels?.length) query = query.in('channel', opts.channels)

  const { data } = await query
  const rows = (data ?? []) as MetricPoint[]

  const byDate = new Map<string, { sent: number; delivered: number; opened: number; clicked: number }>()
  for (const row of rows) {
    const entry = byDate.get(row.metric_date) ?? { sent: 0, delivered: 0, opened: 0, clicked: 0 }
    entry.sent += row.sent; entry.delivered += row.delivered; entry.opened += row.opened; entry.clicked += row.clicked
    byDate.set(row.metric_date, entry)
  }

  const points = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([metric_date, agg]) => ({
      metric_date, channel: 'email' as MessagingChannel,
      sent: agg.sent, delivered: agg.delivered, opened: agg.opened, clicked: agg.clicked,
      converted: 0, opt_outs: 0,
    }))

  const midpoint = Math.floor(points.length / 2)
  const firstHalf = points.slice(0, midpoint).reduce((sum, p) => sum + p.sent, 0)
  const secondHalf = points.slice(midpoint).reduce((sum, p) => sum + p.sent, 0)
  const upliftPercent = firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : 0

  return { points, upliftPercent }
}

// ── Audiences ────────────────────────────────────────────────────────────────

export async function listAudiences(supabase: SupabaseClient, workspaceId: string): Promise<AudienceRow[]> {
  const { data } = await supabase.from('messaging_audiences')
    .select('id, workspace_id, name, description, segment_type, filter_definition, tags, contact_count, owner_id, archived_at, created_at, updated_at')
    .eq('workspace_id', workspaceId).is('archived_at', null)
    .order('updated_at', { ascending: false })
  return (data ?? []) as unknown as AudienceRow[]
}

// ── Templates ────────────────────────────────────────────────────────────────

export async function listTemplates(
  supabase: SupabaseClient, workspaceId: string, opts: { channels?: MessagingChannel[]; limit?: number } = {},
): Promise<{ rows: TemplateRow[]; total: number }> {
  let query = supabase.from('messaging_templates')
    .select('id, workspace_id, name, channel, category, status, content, variables, tags, usage_count, unique_recipients, avg_reuse_rate, ctr_uplift, provider_template_id, provider_status, owner_id, archived_at, created_at, updated_at, owner:profiles!messaging_templates_owner_id_fkey(id, full_name, email, avatar_url)', { count: 'exact' })
    .eq('workspace_id', workspaceId).is('archived_at', null)
  if (opts.channels?.length) query = query.in('channel', opts.channels)
  query = query.order('updated_at', { ascending: false }).limit(opts.limit ?? 12)

  const { data, count } = await query
  return { rows: (data ?? []) as unknown as TemplateRow[], total: count ?? (data?.length ?? 0) }
}

// ── Journeys ─────────────────────────────────────────────────────────────────

export async function listJourneys(
  supabase: SupabaseClient, workspaceId: string, opts: { limit?: number } = {},
): Promise<{ rows: JourneyRow[]; total: number }> {
  const { data, count } = await supabase.from('messaging_journeys')
    .select('id, workspace_id, name, description, journey_type, status, trigger, canvas, audience_id, contacts_in_flow, total_entered, on_track_rate, conversion_rate, health, version, owner_id, last_launch_at, archived_at, created_at, updated_at, owner:profiles!messaging_journeys_owner_id_fkey(id, full_name, email, avatar_url), audience:messaging_audiences(id, name)', { count: 'exact' })
    .eq('workspace_id', workspaceId).is('archived_at', null)
    .order('updated_at', { ascending: false }).limit(opts.limit ?? 12)

  return { rows: (data ?? []) as unknown as JourneyRow[], total: count ?? (data?.length ?? 0) }
}

export async function getMessage(supabase: SupabaseClient, workspaceId: string, id: string): Promise<MessageRow | null> {
  const { data } = await supabase.from('messaging_messages').select(MESSAGE_COLUMNS)
    .eq('id', id).eq('workspace_id', workspaceId).maybeSingle()
  return (data as unknown as MessageRow) ?? null
}

export interface MessageVersionRow {
  id: string
  version_number: number
  content: Record<string, unknown>
  change_note: string | null
  created_at: string
  created_by: string | null
}

export async function listMessageVersions(supabase: SupabaseClient, messageId: string): Promise<MessageVersionRow[]> {
  const { data } = await supabase.from('messaging_message_versions')
    .select('id, version_number, content, change_note, created_at, created_by')
    .eq('message_id', messageId).order('version_number', { ascending: false })
  return (data ?? []) as unknown as MessageVersionRow[]
}

export interface DeliveryEventRow {
  id: string
  event_type: string
  provider_message_id: string | null
  metadata: Record<string, unknown>
  occurred_at: string
  contact?: { email: string | null; phone: string | null } | null
}

export async function listDeliveryEvents(supabase: SupabaseClient, messageId: string, opts: { limit?: number } = {}): Promise<DeliveryEventRow[]> {
  const { data } = await supabase.from('messaging_delivery_events')
    .select('id, event_type, provider_message_id, metadata, occurred_at, contact:messaging_contacts(email, phone)')
    .eq('message_id', messageId).order('occurred_at', { ascending: false }).limit(opts.limit ?? 100)
  return (data ?? []) as unknown as DeliveryEventRow[]
}

export async function messageActivity(supabase: SupabaseClient, workspaceId: string, messageId: string): Promise<ActivityRow[]> {
  const { data } = await supabase.from('messaging_activity')
    .select('id, workspace_id, actor_id, entity_type, entity_id, action, summary, link, surface, created_at, actor:profiles!messaging_activity_actor_id_fkey(id, full_name, email, avatar_url)')
    .eq('workspace_id', workspaceId).eq('entity_type', 'message').eq('entity_id', messageId)
    .order('created_at', { ascending: false }).limit(20)
  return (data ?? []) as unknown as ActivityRow[]
}

export async function getJourney(supabase: SupabaseClient, workspaceId: string, id: string): Promise<JourneyRow | null> {
  const { data } = await supabase.from('messaging_journeys')
    .select('id, workspace_id, name, description, journey_type, status, trigger, canvas, audience_id, contacts_in_flow, total_entered, on_track_rate, conversion_rate, health, version, owner_id, last_launch_at, archived_at, created_at, updated_at, owner:profiles!messaging_journeys_owner_id_fkey(id, full_name, email, avatar_url), audience:messaging_audiences(id, name)')
    .eq('id', id).eq('workspace_id', workspaceId).maybeSingle()
  return (data as unknown as JourneyRow) ?? null
}

export async function activeJourneyCount(supabase: SupabaseClient, workspaceId: string): Promise<number> {
  const { count } = await supabase.from('messaging_journeys').select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId).eq('status', 'active')
  return count ?? 0
}

export interface JourneyStatusCount { status: string; count: number }

export async function journeyStatusBreakdown(supabase: SupabaseClient, workspaceId: string): Promise<JourneyStatusCount[]> {
  const { data } = await supabase.from('messaging_journeys').select('status').eq('workspace_id', workspaceId).is('archived_at', null)
  const counts = new Map<string, number>()
  for (const row of data ?? []) counts.set(row.status, (counts.get(row.status) ?? 0) + 1)
  return Array.from(counts.entries()).map(([status, count]) => ({ status, count }))
}

export interface MessageTypeShare { type: string; count: number; percent: number }

/** Share of messages by type (promotional/transactional/lifecycle/re-engagement, derived from message name/category heuristics). */
export async function messageTypeBreakdown(supabase: SupabaseClient, workspaceId: string, opts: { channels?: MessagingChannel[] } = {}): Promise<MessageTypeShare[]> {
  let query = supabase.from('messaging_messages').select('message_type').eq('workspace_id', workspaceId).is('archived_at', null)
  if (opts.channels?.length) query = query.in('channel', opts.channels)
  const { data } = await query

  const counts = new Map<string, number>()
  for (const row of data ?? []) counts.set(row.message_type, (counts.get(row.message_type) ?? 0) + 1)
  const total = data?.length ?? 0
  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count, percent: total > 0 ? Math.round((count / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.count - a.count)
}

export interface DeliveryAlert { id: string; label: string; sub: string; value: string; severity: 'red' | 'amber' }

/** Real threshold-based alerts — never fabricated, computed from actual counters on live messages. */
export async function deliveryAlerts(supabase: SupabaseClient, workspaceId: string): Promise<DeliveryAlert[]> {
  const { data } = await supabase.from('messaging_messages')
    .select('id, name, channel, sent_count, failed_count, opt_out_count')
    .eq('workspace_id', workspaceId).is('archived_at', null).gt('sent_count', 0)

  const alerts: DeliveryAlert[] = []
  for (const row of data ?? []) {
    const failRate = row.failed_count / row.sent_count
    const optOutRate = row.opt_out_count / row.sent_count
    if (failRate > 0.05) {
      alerts.push({
        id: `${row.id}-fail`, label: 'High failure rate', sub: row.name,
        value: `${(failRate * 100).toFixed(1)}%`, severity: failRate > 0.15 ? 'red' : 'amber',
      })
    }
    if (optOutRate > 0.02) {
      alerts.push({
        id: `${row.id}-optout`, label: 'Spike in opt-outs', sub: row.name,
        value: `${(optOutRate * 100).toFixed(1)}%`, severity: optOutRate > 0.05 ? 'red' : 'amber',
      })
    }
  }
  return alerts.slice(0, 4)
}

// ── Channel health ───────────────────────────────────────────────────────────

export async function channelHealth(supabase: SupabaseClient, workspaceId: string): Promise<ChannelConfigRow[]> {
  const { data } = await supabase.from('messaging_channel_configs')
    .select('id, workspace_id, channel, status, provider, connected_at, last_checked_at, last_error')
    .eq('workspace_id', workspaceId)

  const byChannel = new Map((data ?? []).map(row => [row.channel, row]))
  const rows = MESSAGING_CHANNELS.map(channel => (byChannel.get(channel) as ChannelConfigRow) ?? {
    id: channel, workspace_id: workspaceId, channel, status: 'not_connected',
    provider: null, connected_at: null, last_checked_at: null, last_error: null,
  })

  // Email and SMS connectivity are computed from whether the server actually
  // has working provider credentials — never a manually-flipped database
  // flag — so this panel can never drift from what `sendMessageNow` will do.
  const { getChannelProvider } = await import('./providers')
  const AUTO_DETECTED: Record<string, string> = { email: 'Resend', sms: 'Twilio' }
  for (const channelId of ['email', 'sms'] as const) {
    const row = rows.find(r => r.channel === channelId)
    if (!row) continue
    const configured = getChannelProvider(channelId).isConfigured()
    row.status = configured ? 'connected' : 'not_connected'
    row.provider = configured ? (row.provider ?? AUTO_DETECTED[channelId]) : row.provider
  }

  return rows
}

// ── Activity ─────────────────────────────────────────────────────────────────

export async function recentActivity(
  supabase: SupabaseClient, workspaceId: string, opts: { limit?: number } = {},
): Promise<ActivityRow[]> {
  const { data } = await supabase.from('messaging_activity')
    .select('id, workspace_id, actor_id, entity_type, entity_id, action, summary, link, surface, created_at, actor:profiles!messaging_activity_actor_id_fkey(id, full_name, email, avatar_url)')
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
