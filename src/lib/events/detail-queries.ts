import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  EventRegistrationRecord, EventSessionRecord, EventSpeakerRecord, EventWithStats,
  PodcastEpisodeWithGuests, SponsorshipWithRelations, WebinarWithStats,
} from './types'

// Detail-route data access. Every function here scopes by BOTH id and
// workspace_id so a crafted id from another workspace can never resolve —
// RLS already enforces this, but the explicit filter keeps intent obvious
// and gives a fast, correct 404 instead of relying on RLS alone.

const EVENT_COLUMNS =
  'id, workspace_id, name, slug, summary, description, event_type, format, status, start_at, end_at, timezone, ' +
  'location_name, location_city, location_country, online_platform, online_url, cover_image_url, ' +
  'capacity, registration_url, campaign_id, owner_id, tags, is_demo, created_at, updated_at'

export async function getEventDetail(
  supabase: SupabaseClient, workspaceId: string, eventId: string,
): Promise<EventWithStats | null> {
  const { data: rawData } = await supabase
    .from('events').select(EVENT_COLUMNS)
    .eq('workspace_id', workspaceId).eq('id', eventId).maybeSingle()
  if (!rawData) return null
  const data = rawData as unknown as EventWithStats

  const [{ data: stats }, { data: sponsorStats }, { data: owner }, { data: galaLink }] = await Promise.all([
    supabase.from('event_registration_stats')
      .select('registrations, eligible_registrations, attended')
      .eq('workspace_id', workspaceId).eq('event_id', eventId).maybeSingle(),
    supabase.from('event_sponsor_stats')
      .select('confirmed_sponsors').eq('workspace_id', workspaceId).eq('event_id', eventId).maybeSingle(),
    data.owner_id
      ? supabase.from('profiles').select('full_name, avatar_url').eq('id', data.owner_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('gala_dock_event_links').select('connection_status')
      .eq('workspace_id', workspaceId).eq('event_id', eventId).maybeSingle(),
  ])

  const eligible = Number(stats?.eligible_registrations ?? 0)
  const attended = Number(stats?.attended ?? 0)

  return {
    ...data,
    registrations: Number(stats?.registrations ?? 0),
    attended,
    attendanceRate: eligible ? attended / eligible : null,
    sponsorCount: Number(sponsorStats?.confirmed_sponsors ?? 0),
    ownerName: (owner?.full_name as string) ?? null,
    ownerAvatarUrl: (owner?.avatar_url as string) ?? null,
    galaDockLinked: galaLink?.connection_status === 'connected',
  }
}

export async function getEventSessions(
  supabase: SupabaseClient, workspaceId: string, eventId: string,
): Promise<EventSessionRecord[]> {
  const { data } = await supabase
    .from('event_sessions')
    .select('id, event_id, title, description, session_type, start_at, end_at, offset_seconds, position, room, status')
    .eq('workspace_id', workspaceId).eq('event_id', eventId)
    .order('position', { ascending: true }).order('start_at', { ascending: true })
  return (data ?? []) as unknown as EventSessionRecord[]
}

export async function getEventSpeakers(
  supabase: SupabaseClient, workspaceId: string, eventId: string,
): Promise<EventSpeakerRecord[]> {
  const { data } = await supabase
    .from('event_speakers')
    .select('id, event_id, full_name, job_title, company, avatar_url, speaker_role, confirmation_status, position')
    .eq('workspace_id', workspaceId).eq('event_id', eventId)
    .order('position', { ascending: true })
  return (data ?? []) as unknown as EventSpeakerRecord[]
}

export interface EventRegistrationListResult {
  registrations: EventRegistrationRecord[]
  total: number
  page: number
  pageSize: number
}

export async function getEventRegistrations(
  supabase: SupabaseClient, workspaceId: string, eventId: string,
  filters: { q?: string; status?: string; page?: number; pageSize?: number } = {},
): Promise<EventRegistrationListResult> {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25))

  let query = supabase
    .from('event_registrations')
    .select('id, event_id, full_name, email, company, avatar_url, status, registered_at, attended, watch_seconds, follow_up_status, owner_id', { count: 'exact' })
    .eq('workspace_id', workspaceId).eq('event_id', eventId)

  if (filters.q) {
    const term = filters.q.replaceAll(',', ' ').replaceAll('%', '')
    query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%`)
  }
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)

  const { data, count } = await query
    .order('registered_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  return {
    registrations: (data ?? []) as unknown as EventRegistrationRecord[],
    total: count ?? 0, page, pageSize,
  }
}

export async function getEventSponsorships(
  supabase: SupabaseClient, workspaceId: string, eventId: string,
): Promise<SponsorshipWithRelations[]> {
  const { data } = await supabase
    .from('sponsorships')
    .select('id, sponsor_id, event_id, package_id, tier, value, currency, stage, status, proposal_sent_at, contract_signed_at, activation_start_at, renewal_due_at, payment_status, owner_id')
    .eq('workspace_id', workspaceId).eq('event_id', eventId)
    .order('value', { ascending: false })

  const rows = data ?? []
  const sponsorIds = [...new Set(rows.map(r => r.sponsor_id as string))]
  const { data: sponsors } = sponsorIds.length
    ? await supabase.from('sponsors').select('id, name, company_name, logo_url, industry').eq('workspace_id', workspaceId).in('id', sponsorIds)
    : { data: [] as Record<string, unknown>[] }
  const sponsorMap = new Map((sponsors ?? []).map(s => [s.id as string, s]))

  return rows.map(row => ({
    ...(row as unknown as SponsorshipWithRelations),
    value: Number(row.value ?? 0),
    sponsor: (sponsorMap.get(row.sponsor_id as string) ?? null) as SponsorshipWithRelations['sponsor'],
    eventName: null, packageName: null, deliverablesTotal: 0, deliverablesCompleted: 0,
    ownerName: null, ownerAvatarUrl: null,
  }))
}

export async function getWebinarDetail(
  supabase: SupabaseClient, workspaceId: string, eventId: string,
): Promise<WebinarWithStats | null> {
  const event = await getEventDetail(supabase, workspaceId, eventId)
  if (!event || event.event_type !== 'webinar') return null

  const [{ data: webinar }, speakers] = await Promise.all([
    supabase.from('webinar_details')
      .select('event_id, provider, provider_status, topic, join_url, will_record, recording_state, avg_watch_seconds, questions_count, polls_count, last_synced_at')
      .eq('workspace_id', workspaceId).eq('event_id', eventId).maybeSingle(),
    getEventSpeakers(supabase, workspaceId, eventId),
  ])
  const host = speakers.find(s => s.speaker_role === 'host')

  return {
    ...event,
    webinar: (webinar ?? null) as WebinarWithStats['webinar'],
    hostName: host?.full_name ?? null,
    hostRole: host?.job_title ?? null,
    hostAvatarUrl: host?.avatar_url ?? null,
  }
}

export async function getPodcastEpisodeDetail(
  supabase: SupabaseClient, workspaceId: string, episodeId: string,
): Promise<PodcastEpisodeWithGuests | null> {
  const { data } = await supabase
    .from('podcast_episodes')
    .select('id, show_id, event_id, episode_number, title, summary, show_notes, cover_image_url, status, recording_type, studio_location, recording_platform, scheduled_at, recorded_at, published_at, distribution_state, distribution_url, listens, unique_listeners, completion_rate, owner_id')
    .eq('workspace_id', workspaceId).eq('id', episodeId).maybeSingle()
  if (!data) return null

  const [{ data: guests }, { data: show }] = await Promise.all([
    supabase.from('podcast_episode_guests')
      .select('id, full_name, job_title, company, avatar_url, confirmation_status')
      .eq('workspace_id', workspaceId).eq('episode_id', episodeId),
    data.show_id
      ? supabase.from('podcast_shows').select('name').eq('id', data.show_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return {
    ...(data as unknown as PodcastEpisodeWithGuests),
    guests: (guests ?? []).map(g => ({
      id: g.id as string, full_name: g.full_name as string,
      job_title: g.job_title as string | null, company: g.company as string | null,
      avatar_url: g.avatar_url as string | null,
    })),
    showName: (show?.name as string) ?? null,
  }
}

export async function getSponsorshipDetail(
  supabase: SupabaseClient, workspaceId: string, sponsorshipId: string,
): Promise<SponsorshipWithRelations | null> {
  const { data } = await supabase
    .from('sponsorships')
    .select('id, sponsor_id, event_id, package_id, tier, value, currency, stage, status, proposal_sent_at, contract_signed_at, activation_start_at, activation_end_at, renewal_due_at, payment_terms, payment_status, paid_at, owner_id, notes')
    .eq('workspace_id', workspaceId).eq('id', sponsorshipId).maybeSingle()
  if (!data) return null

  const [{ data: sponsor }, { data: event }, { data: pkg }, { data: owner }, { data: deliverables }] = await Promise.all([
    supabase.from('sponsors').select('id, name, company_name, logo_url, industry, website_url, primary_contact_name, primary_contact_email')
      .eq('id', data.sponsor_id).maybeSingle(),
    data.event_id ? supabase.from('events').select('id, name').eq('id', data.event_id).maybeSingle() : Promise.resolve({ data: null }),
    data.package_id ? supabase.from('sponsorship_packages').select('name').eq('id', data.package_id).maybeSingle() : Promise.resolve({ data: null }),
    data.owner_id ? supabase.from('profiles').select('full_name, avatar_url').eq('id', data.owner_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('sponsorship_deliverables')
      .select('id, sponsorship_id, title, deliverable_type, status, due_at, completed_at, owner_id, notes')
      .eq('workspace_id', workspaceId).eq('sponsorship_id', sponsorshipId).order('due_at', { ascending: true }),
  ])

  return {
    ...(data as unknown as SponsorshipWithRelations),
    value: Number(data.value ?? 0),
    sponsor: (sponsor ?? null) as SponsorshipWithRelations['sponsor'],
    eventName: (event?.name as string) ?? null,
    packageName: (pkg?.name as string) ?? null,
    deliverablesTotal: (deliverables ?? []).length,
    deliverablesCompleted: (deliverables ?? []).filter(d => ['completed', 'approved'].includes(d.status as string)).length,
    ownerName: (owner?.full_name as string) ?? null,
    ownerAvatarUrl: (owner?.avatar_url as string) ?? null,
    // deliverables attached separately by the caller via getSponsorshipDeliverables
  }
}

export async function getSponsorshipDeliverables(
  supabase: SupabaseClient, workspaceId: string, sponsorshipId: string,
) {
  const { data } = await supabase
    .from('sponsorship_deliverables')
    .select('id, sponsorship_id, title, deliverable_type, status, due_at, completed_at, owner_id, notes')
    .eq('workspace_id', workspaceId).eq('sponsorship_id', sponsorshipId)
    .order('due_at', { ascending: true })
  return data ?? []
}

export async function getEventFollowUpTasksFor(
  supabase: SupabaseClient, workspaceId: string, eventId: string,
) {
  const { data } = await supabase
    .from('event_followup_tasks')
    .select('id, title, status, priority, due_at, completed_at, owner_id, outcome')
    .eq('workspace_id', workspaceId).eq('event_id', eventId)
    .order('due_at', { ascending: true })
  return data ?? []
}
