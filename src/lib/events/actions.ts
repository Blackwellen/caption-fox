'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import { logAudit } from '@/lib/audit'
import { canAccessEventsCapability, EVENTS_ROUTE_SURFACES, type EventsCapability } from './entitlements'
import { resolveEventsContext } from './queries'
import type { GalaDockPlacement } from './types'

/**
 * Every mutation in the Events module funnels through this guard, so a hidden
 * or disabled control can never be triggered by a crafted request: the server
 * re-derives workspace, role, plan and feature flags and re-checks the
 * capability regardless of what the client sent.
 */
type GuardResult =
  | { ok: false; error: string }
  | {
      ok: true
      supabase: Awaited<ReturnType<typeof createClient>>
      user: { id: string }
      resolved: NonNullable<Awaited<ReturnType<typeof resolveEventsContext>>>
    }

async function guard(routeSegment: string, capability: EventsCapability): Promise<GuardResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const surface = EVENTS_ROUTE_SURFACES[routeSegment]
  if (!surface) return { ok: false, error: 'Unknown workspace surface' }

  const { active } = await getActiveWorkspace(supabase, user.id)
  if (!active) return { ok: false, error: 'No active workspace' }

  const resolved = await resolveEventsContext(supabase, active.id, user.id, surface)
  if (!resolved) return { ok: false, error: 'No access to this workspace' }

  if (!canAccessEventsCapability(resolved.ctx, capability)) {
    return { ok: false, error: 'You do not have permission to do that' }
  }
  return { ok: true, supabase, user, resolved }
}

export type ActionResult = { ok: true } | { ok: false; error: string }

/* ---------------------------------------------------------------- gala dock */

const PLACEMENTS: GalaDockPlacement[] = [
  'overview-banner', 'events-sidebar', 'webinars-banner', 'podcasts-banner',
  'sponsorships-banner', 'sponsorships-footer', 'follow-up-banner',
]

/** Persisted per user + workspace + placement, so a dismissal survives reloads. */
export async function dismissGalaDockPromotion(
  routeSegment: string, placement: string, pathname: string,
): Promise<ActionResult> {
  if (!PLACEMENTS.includes(placement as GalaDockPlacement)) {
    return { ok: false, error: 'Unknown placement' }
  }
  const g = await guard(routeSegment, 'events.overview')
  if (!g.ok) return { ok: false, error: g.error }

  const { error } = await g.supabase.from('gala_dock_promotion_dismissals').upsert({
    workspace_id: g.resolved.workspace.id,
    user_id: g.user.id,
    placement,
    dismissed_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id,user_id,placement' })

  if (error) return { ok: false, error: error.message }

  await recordGalaDockTelemetry(g.supabase, g.resolved.workspace.id, g.user.id, 'gala_dock_promotion_dismissed', placement)
  revalidatePath(pathname)
  return { ok: true }
}

/** Click-through telemetry. Uses the existing audit + activity systems. */
export async function trackGalaDockPromotionClick(
  routeSegment: string, placement: string, destination: string,
): Promise<ActionResult> {
  const g = await guard(routeSegment, 'events.overview')
  if (!g.ok) return { ok: false, error: g.error }
  await recordGalaDockTelemetry(
    g.supabase, g.resolved.workspace.id, g.user.id,
    'gala_dock_promotion_clicked', placement, { destination },
  )
  return { ok: true }
}

async function recordGalaDockTelemetry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string, userId: string, action: string, placement: string,
  metadata: Record<string, unknown> = {},
) {
  await logAudit(supabase, userId, {
    workspaceId, action, entityType: 'gala_dock_promotion',
    metadata: { placement, ...metadata },
  })
}

/* ------------------------------------------------------------------ events */

export interface CreateEventInput {
  name: string
  eventType: string
  format: string
  startAt?: string | null
  endAt?: string | null
  timezone?: string
  locationCity?: string | null
  locationName?: string | null
  onlinePlatform?: string | null
  capacity?: number | null
  campaignId?: string | null
  summary?: string | null
}

const VALID_TYPES = new Set([
  'conference', 'summit', 'in_person', 'virtual', 'hybrid', 'webinar', 'podcast',
  'workshop', 'roundtable', 'product_launch', 'networking', 'live_stream',
  'customer_event', 'partner_event', 'internal_event',
])
const VALID_FORMATS = new Set(['in_person', 'virtual', 'hybrid'])

export async function createEvent(
  routeSegment: string, input: CreateEventInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const g = await guard(routeSegment, 'events.create')
  if (!g.ok) return { ok: false, error: g.error }

  const name = input.name?.trim()
  if (!name) return { ok: false, error: 'Event name is required' }
  if (name.length > 160) return { ok: false, error: 'Event name is too long' }
  if (!VALID_TYPES.has(input.eventType)) return { ok: false, error: 'Unknown event type' }
  if (!VALID_FORMATS.has(input.format)) return { ok: false, error: 'Unknown event format' }
  if (input.startAt && input.endAt && input.endAt < input.startAt) {
    return { ok: false, error: 'End time must be after the start time' }
  }
  // A virtual event must not be forced to carry a venue, and an in-person one
  // must not be forced to carry a platform — validate only what applies.
  if (input.format === 'virtual' && !input.onlinePlatform) {
    return { ok: false, error: 'Online events need a platform' }
  }
  if (input.format === 'in_person' && !input.locationCity && !input.locationName) {
    return { ok: false, error: 'In-person events need a location' }
  }

  // Duplicate detection: same name and same day in this workspace.
  if (input.startAt) {
    const dayStart = new Date(input.startAt); dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(input.startAt); dayEnd.setHours(23, 59, 59, 999)
    const { data: existing } = await g.supabase
      .from('events').select('id')
      .eq('workspace_id', g.resolved.workspace.id)
      .ilike('name', name)
      .gte('start_at', dayStart.toISOString())
      .lte('start_at', dayEnd.toISOString())
      .maybeSingle()
    if (existing) return { ok: false, error: 'An event with this name already exists on that date' }
  }

  const { data, error } = await g.supabase.from('events').insert({
    workspace_id: g.resolved.workspace.id,
    name,
    summary: input.summary?.trim() || null,
    event_type: input.eventType,
    format: input.format,
    status: input.startAt ? 'scheduled' : 'draft',
    start_at: input.startAt ?? null,
    end_at: input.endAt ?? null,
    timezone: input.timezone ?? g.resolved.workspace.timezone,
    location_city: input.locationCity?.trim() || null,
    location_name: input.locationName?.trim() || null,
    online_platform: input.onlinePlatform?.trim() || null,
    capacity: input.capacity ?? null,
    campaign_id: input.campaignId ?? null,
    owner_id: g.user.id,
    created_by: g.user.id,
    updated_by: g.user.id,
  }).select('id').single()

  if (error || !data) return { ok: false, error: error?.message ?? 'Could not create the event' }

  await Promise.all([
    logAudit(g.supabase, g.user.id, {
      workspaceId: g.resolved.workspace.id, action: 'event.created',
      entityType: 'event', entityId: data.id, metadata: { name, type: input.eventType },
    }),
    g.supabase.from('event_activity').insert({
      workspace_id: g.resolved.workspace.id,
      event_id: data.id,
      entity_type: 'event',
      entity_id: data.id,
      action: 'created',
      summary: `${name} was created`,
      href: `/${routeSegment}/events/events/${data.id}`,
      actor_id: g.user.id,
    }),
  ])

  revalidatePath(`/${routeSegment}/events`)
  revalidatePath(`/${routeSegment}/events/events`)
  return { ok: true, id: data.id }
}

/* ------------------------------------------------------------ registrations */

export async function updateRegistrationStatus(
  routeSegment: string, registrationId: string, status: string,
): Promise<ActionResult> {
  const g = await guard(routeSegment, 'registrations.manage')
  if (!g.ok) return { ok: false, error: g.error }

  const allowed = ['invited', 'registered', 'confirmed', 'waitlisted', 'cancelled', 'attended', 'no_show', 'checked_in']
  if (!allowed.includes(status)) return { ok: false, error: 'Unknown registration status' }

  const patch: Record<string, unknown> = { status }
  if (status === 'attended' || status === 'checked_in') patch.attended = true
  if (status === 'checked_in') patch.checked_in_at = new Date().toISOString()
  if (status === 'no_show') patch.attended = false

  const { error } = await g.supabase
    .from('event_registrations').update(patch)
    .eq('id', registrationId)
    .eq('workspace_id', g.resolved.workspace.id)

  if (error) return { ok: false, error: error.message }

  await logAudit(g.supabase, g.user.id, {
    workspaceId: g.resolved.workspace.id, action: 'event.registration.status_changed',
    entityType: 'event_registration', entityId: registrationId, metadata: { status },
  })
  revalidatePath(`/${routeSegment}/events`)
  return { ok: true }
}

/* --------------------------------------------------------------- follow-up */

const TASK_STATUSES = ['not_started', 'in_progress', 'waiting', 'completed', 'cancelled']

/** Board drag-and-drop and the keyboard status menu both land here. */
export async function moveFollowUpTask(
  routeSegment: string, taskId: string, status: string, position?: number,
): Promise<ActionResult> {
  const g = await guard(routeSegment, 'followUp.manage')
  if (!g.ok) return { ok: false, error: g.error }
  if (!TASK_STATUSES.includes(status)) return { ok: false, error: 'Unknown task status' }

  const patch: Record<string, unknown> = { status }
  if (position !== undefined) patch.position = position
  patch.completed_at = status === 'completed' ? new Date().toISOString() : null

  const { data, error } = await g.supabase
    .from('event_followup_tasks').update(patch)
    .eq('id', taskId)
    .eq('workspace_id', g.resolved.workspace.id)
    .select('id, title, event_id')
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Task not found in this workspace' }

  await Promise.all([
    logAudit(g.supabase, g.user.id, {
      workspaceId: g.resolved.workspace.id, action: 'event.followup_task.status_changed',
      entityType: 'event_followup_task', entityId: taskId, metadata: { status },
    }),
    g.supabase.from('event_activity').insert({
      workspace_id: g.resolved.workspace.id,
      event_id: data.event_id,
      entity_type: 'followup_task',
      entity_id: taskId,
      action: status,
      summary: `${data.title} moved to ${status.replaceAll('_', ' ')}`,
      href: `/${routeSegment}/events/follow-up`,
      actor_id: g.user.id,
    }),
  ])

  revalidatePath(`/${routeSegment}/events/follow-up`)
  return { ok: true }
}

export async function createFollowUpTask(
  routeSegment: string,
  input: { title: string; status: string; eventId?: string | null; dueAt?: string | null; registrationId?: string | null },
): Promise<ActionResult> {
  const g = await guard(routeSegment, 'followUp.manage')
  if (!g.ok) return { ok: false, error: g.error }

  const title = input.title?.trim()
  if (!title) return { ok: false, error: 'A task title is required' }
  if (!TASK_STATUSES.includes(input.status)) return { ok: false, error: 'Unknown task status' }

  const { error } = await g.supabase.from('event_followup_tasks').insert({
    workspace_id: g.resolved.workspace.id,
    title,
    status: input.status,
    event_id: input.eventId ?? null,
    registration_id: input.registrationId ?? null,
    due_at: input.dueAt ?? null,
    owner_id: g.user.id,
    created_by: g.user.id,
  })
  if (error) return { ok: false, error: error.message }

  await logAudit(g.supabase, g.user.id, {
    workspaceId: g.resolved.workspace.id, action: 'event.followup_task.created',
    entityType: 'event_followup_task', metadata: { title },
  })
  revalidatePath(`/${routeSegment}/events/follow-up`)
  return { ok: true }
}

/* ------------------------------------------------------------ sponsorships */

export async function updateSponsorshipStage(
  routeSegment: string, sponsorshipId: string, stage: string,
): Promise<ActionResult> {
  const g = await guard(routeSegment, 'sponsorships.manage')
  if (!g.ok) return { ok: false, error: g.error }

  const stages = ['prospect', 'contacted', 'proposal', 'negotiation', 'verbal', 'contracted', 'active', 'completed', 'renewal', 'lost']
  if (!stages.includes(stage)) return { ok: false, error: 'Unknown sponsorship stage' }

  const patch: Record<string, unknown> = { stage }
  if (stage === 'contracted') patch.contract_signed_at = new Date().toISOString()

  const { error } = await g.supabase
    .from('sponsorships').update(patch)
    .eq('id', sponsorshipId)
    .eq('workspace_id', g.resolved.workspace.id)
  if (error) return { ok: false, error: error.message }

  await logAudit(g.supabase, g.user.id, {
    workspaceId: g.resolved.workspace.id, action: 'sponsorship.stage_changed',
    entityType: 'sponsorship', entityId: sponsorshipId, metadata: { stage },
  })
  revalidatePath(`/${routeSegment}/events/sponsorships`)
  return { ok: true }
}

const TIERS = new Set(['premier', 'platinum', 'gold', 'silver', 'bronze', 'community', 'custom'])
const STAGES = new Set(['prospect', 'contacted', 'proposal', 'negotiation', 'verbal', 'contracted', 'active', 'completed', 'renewal', 'lost'])

export interface CreateSponsorInput {
  name: string
  companyName?: string | null
  industry?: string | null
  websiteUrl?: string | null
}

export async function createSponsor(
  routeSegment: string, input: CreateSponsorInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const g = await guard(routeSegment, 'sponsorships.manage')
  if (!g.ok) return { ok: false, error: g.error }

  const name = input.name?.trim()
  if (!name) return { ok: false, error: 'Sponsor name is required' }
  if (name.length > 160) return { ok: false, error: 'Sponsor name is too long' }

  const { data: existing } = await g.supabase
    .from('sponsors').select('id')
    .eq('workspace_id', g.resolved.workspace.id).ilike('name', name).maybeSingle()
  if (existing) return { ok: false, error: 'A sponsor with this name already exists' }

  const { data, error } = await g.supabase.from('sponsors').insert({
    workspace_id: g.resolved.workspace.id,
    name,
    company_name: input.companyName?.trim() || null,
    industry: input.industry?.trim() || null,
    website_url: input.websiteUrl?.trim() || null,
    owner_id: g.user.id,
  }).select('id').single()
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not create the sponsor' }

  await logAudit(g.supabase, g.user.id, {
    workspaceId: g.resolved.workspace.id, action: 'sponsor.created', entityType: 'sponsor', entityId: data.id, metadata: { name },
  })
  revalidatePath(`/${routeSegment}/events/sponsorships`)
  return { ok: true, id: data.id }
}

export interface CreateSponsorshipInput {
  sponsorId: string
  eventId?: string | null
  tier: string
  value: number
  currency?: string
  stage?: string
}

export async function createSponsorship(
  routeSegment: string, input: CreateSponsorshipInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const g = await guard(routeSegment, 'sponsorships.manage')
  if (!g.ok) return { ok: false, error: g.error }

  if (!input.sponsorId) return { ok: false, error: 'Choose a sponsor' }
  if (!TIERS.has(input.tier)) return { ok: false, error: 'Unknown sponsorship tier' }
  if (!Number.isFinite(input.value) || input.value < 0) return { ok: false, error: 'Value must be a positive number' }
  const stage = input.stage && STAGES.has(input.stage) ? input.stage : 'prospect'

  const { data: sponsor } = await g.supabase
    .from('sponsors').select('id').eq('workspace_id', g.resolved.workspace.id).eq('id', input.sponsorId).maybeSingle()
  if (!sponsor) return { ok: false, error: 'Sponsor not found in this workspace' }

  if (input.eventId) {
    const { data: event } = await g.supabase
      .from('events').select('id').eq('workspace_id', g.resolved.workspace.id).eq('id', input.eventId).maybeSingle()
    if (!event) return { ok: false, error: 'Event not found in this workspace' }
  }

  const { data, error } = await g.supabase.from('sponsorships').insert({
    workspace_id: g.resolved.workspace.id,
    sponsor_id: input.sponsorId,
    event_id: input.eventId || null,
    tier: input.tier,
    value: input.value,
    currency: input.currency ?? 'GBP',
    stage,
    status: 'in_progress',
    owner_id: g.user.id,
  }).select('id').single()
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not create the sponsorship' }

  await Promise.all([
    logAudit(g.supabase, g.user.id, {
      workspaceId: g.resolved.workspace.id, action: 'sponsorship.created', entityType: 'sponsorship', entityId: data.id,
      metadata: { sponsorId: input.sponsorId, tier: input.tier, value: input.value },
    }),
    g.supabase.from('event_activity').insert({
      workspace_id: g.resolved.workspace.id, event_id: input.eventId || null,
      entity_type: 'sponsorship', entity_id: data.id, action: 'created',
      summary: 'New sponsorship added to the pipeline', actor_id: g.user.id,
    }),
  ])

  revalidatePath(`/${routeSegment}/events/sponsorships`)
  return { ok: true, id: data.id }
}

/* -------------------------------------------------------------- podcasts */

const RECORDING_TYPES = new Set(['in_studio', 'remote', 'live', 'field'])

export interface CreatePodcastEpisodeInput {
  title: string
  showName?: string | null
  recordingType: string
  scheduledAt?: string | null
  summary?: string | null
}

export async function createPodcastEpisode(
  routeSegment: string, input: CreatePodcastEpisodeInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const g = await guard(routeSegment, 'podcasts.manage')
  if (!g.ok) return { ok: false, error: g.error }

  const title = input.title?.trim()
  if (!title) return { ok: false, error: 'Episode title is required' }
  if (title.length > 200) return { ok: false, error: 'Episode title is too long' }
  if (!RECORDING_TYPES.has(input.recordingType)) return { ok: false, error: 'Unknown recording type' }

  // Resolve or create the show — episodes always belong to a show so
  // distribution and listener metrics have somewhere to aggregate.
  let showId: string | null = null
  const showName = input.showName?.trim()
  if (showName) {
    const { data: existingShow } = await g.supabase
      .from('podcast_shows').select('id')
      .eq('workspace_id', g.resolved.workspace.id).ilike('name', showName).maybeSingle()
    if (existingShow) showId = existingShow.id as string
    else {
      const { data: newShow, error: showError } = await g.supabase.from('podcast_shows').insert({
        workspace_id: g.resolved.workspace.id, name: showName, owner_id: g.user.id,
      }).select('id').single()
      if (showError) return { ok: false, error: showError.message }
      showId = newShow?.id as string
    }
  }

  const { count } = await g.supabase
    .from('podcast_episodes').select('id', { count: 'exact', head: true })
    .eq('workspace_id', g.resolved.workspace.id).eq('show_id', showId)
  const episodeNumber = (count ?? 0) + 1

  const { data, error } = await g.supabase.from('podcast_episodes').insert({
    workspace_id: g.resolved.workspace.id,
    show_id: showId,
    episode_number: showId ? episodeNumber : null,
    title,
    summary: input.summary?.trim() || null,
    status: input.scheduledAt ? 'scheduled' : 'planned',
    recording_type: input.recordingType,
    scheduled_at: input.scheduledAt ?? null,
    owner_id: g.user.id,
    created_by: g.user.id,
  }).select('id').single()
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not create the episode' }

  await logAudit(g.supabase, g.user.id, {
    workspaceId: g.resolved.workspace.id, action: 'podcast_episode.created',
    entityType: 'podcast_episode', entityId: data.id, metadata: { title },
  })
  revalidatePath(`/${routeSegment}/events/podcasts`)
  return { ok: true, id: data.id }
}

/* ------------------------------------------------------------- sequences */

export interface CreateFollowUpSequenceInput {
  name: string
  eventId?: string | null
  conversionGoal?: string | null
}

export async function createFollowUpSequence(
  routeSegment: string, input: CreateFollowUpSequenceInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const g = await guard(routeSegment, 'followUp.sequences')
  if (!g.ok) return { ok: false, error: g.error }

  const name = input.name?.trim()
  if (!name) return { ok: false, error: 'Sequence name is required' }
  if (name.length > 160) return { ok: false, error: 'Sequence name is too long' }

  const { data, error } = await g.supabase.from('event_followup_sequences').insert({
    workspace_id: g.resolved.workspace.id,
    name,
    event_id: input.eventId || null,
    conversion_goal: input.conversionGoal?.trim() || null,
    status: 'draft',
    owner_id: g.user.id,
    created_by: g.user.id,
  }).select('id').single()
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not create the sequence' }

  // Seed the standard 5-touch cadence so the sequence is immediately usable —
  // editable afterwards from Manage sequences, never a dead empty record.
  const steps = [
    { position: 0, delay_days: 0, step_type: 'email', title: 'Thank You Email', body: 'Send a personalised thank you and share event resources.' },
    { position: 1, delay_days: 2, step_type: 'email', title: 'Value Follow-up', body: 'Share relevant content and insights that align with their interests.' },
    { position: 2, delay_days: 5, step_type: 'email', title: 'Engagement Email', body: 'Invite to connect, share a case study, or offer a helpful resource.' },
    { position: 3, delay_days: 10, step_type: 'task', title: 'Personal Outreach', body: 'Reach out directly to start a conversation or schedule a call.' },
    { position: 4, delay_days: 20, step_type: 'email', title: 'Re-engagement', body: 'Check in, share new updates, and invite to upcoming events.' },
  ]
  await g.supabase.from('event_followup_steps').insert(
    steps.map(step => ({ workspace_id: g.resolved.workspace.id, sequence_id: data.id, ...step })),
  )

  await logAudit(g.supabase, g.user.id, {
    workspaceId: g.resolved.workspace.id, action: 'event_followup_sequence.created',
    entityType: 'sequence', entityId: data.id, metadata: { name },
  })
  revalidatePath(`/${routeSegment}/events/follow-up`)
  return { ok: true, id: data.id }
}
