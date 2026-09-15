// Events module domain types — mirror the SQL contract in
// supabase/migrations/20260830000000_events_module.sql exactly.

export type EventsSurface = 'creator' | 'business' | 'brand' | 'agency'

export type EventsTabId =
  | 'overview'
  | 'events'
  | 'webinars'
  | 'podcasts'
  | 'sponsorships'
  | 'follow-up'

export type EventViewMode = 'cards' | 'table' | 'calendar' | 'timeline' | 'board' | 'pipeline'

export type EventType =
  | 'conference' | 'summit' | 'in_person' | 'virtual' | 'hybrid' | 'webinar' | 'podcast'
  | 'workshop' | 'roundtable' | 'product_launch' | 'networking' | 'live_stream'
  | 'customer_event' | 'partner_event' | 'internal_event'

export type EventFormat = 'in_person' | 'virtual' | 'hybrid'

export type EventStatus =
  | 'draft' | 'scheduled' | 'upcoming' | 'live' | 'completed' | 'cancelled' | 'archived'

export type SessionStatus =
  | 'draft' | 'planned' | 'upcoming' | 'live' | 'completed' | 'delayed' | 'cancelled'

export type RegistrationStatus =
  | 'invited' | 'registered' | 'confirmed' | 'waitlisted' | 'cancelled'
  | 'attended' | 'no_show' | 'checked_in'

export type FollowUpContactStatus =
  | 'not_contacted' | 'in_progress' | 'waiting' | 'completed' | 'converted' | 'excluded'

export type FollowUpTaskStatus = 'not_started' | 'in_progress' | 'waiting' | 'completed' | 'cancelled'

export type SponsorshipStage =
  | 'prospect' | 'contacted' | 'proposal' | 'negotiation' | 'verbal'
  | 'contracted' | 'active' | 'completed' | 'renewal' | 'lost'

export type SponsorshipTier =
  | 'premier' | 'platinum' | 'gold' | 'silver' | 'bronze' | 'community' | 'custom'

export type DeliverableStatus =
  | 'planned' | 'in_progress' | 'submitted' | 'approved' | 'completed' | 'blocked' | 'cancelled'

export type DeliverableType =
  | 'logo_placement' | 'speaking_slot' | 'email_mention' | 'social_post' | 'booth'
  | 'sponsored_session' | 'podcast_read' | 'hospitality' | 'content_placement' | 'other'

export type WebinarProvider =
  | 'zoom' | 'teams' | 'google_meet' | 'webinarjam' | 'demio' | 'livestorm' | 'youtube_live' | 'other'

export type ProviderStatus = 'not_connected' | 'connected' | 'error' | 'expired'

export type RecordingState = 'none' | 'scheduled' | 'recording' | 'processing' | 'available' | 'failed'

export type PodcastEpisodeStatus =
  | 'draft' | 'planned' | 'scheduled' | 'recording' | 'recorded' | 'editing' | 'published' | 'archived'

export type PodcastRecordingType = 'in_studio' | 'remote' | 'live' | 'field'

export type DistributionState = 'not_distributed' | 'queued' | 'published' | 'failed'

export type GalaDockConnectionState =
  | 'not-connected' | 'workspace-connected' | 'event-linked' | 'error'

export type GalaDockPlacement =
  | 'overview-banner'
  | 'events-sidebar'
  | 'webinars-banner'
  | 'podcasts-banner'
  | 'sponsorships-banner'
  | 'sponsorships-footer'
  | 'follow-up-banner'

// ---------------------------------------------------------------- records

export interface EventRecord {
  id: string
  workspace_id: string
  name: string
  slug: string | null
  summary: string | null
  event_type: EventType
  format: EventFormat
  status: EventStatus
  start_at: string | null
  end_at: string | null
  timezone: string
  location_name: string | null
  location_city: string | null
  location_country: string | null
  online_platform: string | null
  online_url: string | null
  cover_image_url: string | null
  capacity: number | null
  campaign_id: string | null
  owner_id: string | null
  tags: string[] | null
  is_demo: boolean
  created_at: string
  updated_at: string
  /** Present only on detail-query reads; list reads omit these to keep the row light. */
  description?: string | null
  registration_url?: string | null
}

/** An event plus the aggregates every list surface needs, computed server-side. */
export interface EventWithStats extends EventRecord {
  registrations: number
  attended: number
  attendanceRate: number | null
  sponsorCount: number
  ownerName: string | null
  ownerAvatarUrl: string | null
  galaDockLinked: boolean
}

export interface EventSessionRecord {
  id: string
  event_id: string
  title: string
  description: string | null
  session_type: string
  start_at: string | null
  end_at: string | null
  offset_seconds: number | null
  position: number
  room: string | null
  status: SessionStatus
}

export interface EventSpeakerRecord {
  id: string
  event_id: string | null
  full_name: string
  job_title: string | null
  company: string | null
  avatar_url: string | null
  speaker_role: string
  confirmation_status: string
  position: number
}

export interface EventRegistrationRecord {
  id: string
  event_id: string
  full_name: string
  email: string
  company: string | null
  avatar_url: string | null
  status: RegistrationStatus
  registered_at: string
  attended: boolean
  watch_seconds: number | null
  follow_up_status: FollowUpContactStatus
  owner_id: string | null
}

export interface WebinarDetailRecord {
  event_id: string
  provider: WebinarProvider
  provider_status: ProviderStatus
  topic: string | null
  join_url: string | null
  will_record: boolean
  recording_state: RecordingState
  avg_watch_seconds: number | null
  questions_count: number
  polls_count: number
  last_synced_at: string | null
}

export interface WebinarWithStats extends EventWithStats {
  webinar: WebinarDetailRecord | null
  hostName: string | null
  hostRole: string | null
  hostAvatarUrl: string | null
}

export interface PodcastShowRecord {
  id: string
  name: string
  cover_image_url: string | null
  distribution_provider: string | null
  provider_status: ProviderStatus
}

export interface PodcastEpisodeRecord {
  id: string
  show_id: string | null
  event_id: string | null
  episode_number: number | null
  title: string
  summary: string | null
  cover_image_url: string | null
  status: PodcastEpisodeStatus
  recording_type: PodcastRecordingType
  studio_location: string | null
  scheduled_at: string | null
  recorded_at: string | null
  published_at: string | null
  distribution_state: DistributionState
  listens: number
  unique_listeners: number
  completion_rate: number | null
  /** Present only on detail-query reads. */
  show_notes?: string | null
  distribution_url?: string | null
  recording_platform?: string | null
  owner_id?: string | null
}

export interface PodcastEpisodeWithGuests extends PodcastEpisodeRecord {
  guests: { id: string; full_name: string; job_title: string | null; company: string | null; avatar_url: string | null }[]
  showName: string | null
}

export interface SponsorRecord {
  id: string
  name: string
  company_name: string | null
  logo_url: string | null
  industry: string | null
}

export interface SponsorshipRecord {
  id: string
  sponsor_id: string
  event_id: string | null
  package_id: string | null
  tier: SponsorshipTier
  value: number
  currency: string
  stage: SponsorshipStage
  status: string
  proposal_sent_at: string | null
  contract_signed_at: string | null
  activation_start_at: string | null
  renewal_due_at: string | null
  payment_status: string
  owner_id: string | null
  /** Present only on detail-query reads. */
  activation_end_at?: string | null
  payment_terms?: string | null
  paid_at?: string | null
  notes?: string | null
}

export interface SponsorshipWithRelations extends SponsorshipRecord {
  sponsor: SponsorRecord | null
  eventName: string | null
  packageName: string | null
  deliverablesTotal: number
  deliverablesCompleted: number
  ownerName: string | null
  ownerAvatarUrl: string | null
}

export interface SponsorshipDeliverableRecord {
  id: string
  sponsorship_id: string
  title: string
  deliverable_type: DeliverableType
  status: DeliverableStatus
  due_at: string | null
  completed_at: string | null
}

export interface FollowUpSequenceRecord {
  id: string
  event_id: string | null
  name: string
  description: string | null
  status: 'draft' | 'active' | 'paused' | 'archived'
  conversion_goal: string | null
}

export interface FollowUpStepRecord {
  id: string
  sequence_id: string
  position: number
  delay_days: number
  step_type: string
  title: string
  body: string | null
}

export interface FollowUpTaskRecord {
  id: string
  event_id: string | null
  sequence_id: string | null
  registration_id: string | null
  title: string
  description: string | null
  status: FollowUpTaskStatus
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_at: string | null
  completed_at: string | null
  owner_id: string | null
  position: number
  outcome: string | null
}

export interface FollowUpTaskWithRelations extends FollowUpTaskRecord {
  eventName: string | null
  contactName: string | null
  contactAvatarUrl: string | null
  ownerName: string | null
  ownerAvatarUrl: string | null
  sequenceName: string | null
}

export interface EventActivityRecord {
  id: string
  event_id: string | null
  entity_type: string
  entity_id: string | null
  action: string
  summary: string
  href: string | null
  actor_name: string | null
  actor_avatar_url: string | null
  created_at: string
}

export interface GalaDockLinkState {
  connectionState: GalaDockConnectionState
  workspaceUrl: string | null
  eventUrl: string | null
  lastSyncedAt: string | null
  syncError: string | null
  dismissedPlacements: GalaDockPlacement[]
}

// ---------------------------------------------------------------- charts + KPIs

export interface TrendPoint {
  day: string
  [series: string]: string | number
}

export interface KpiValue {
  /** Raw numeric value; `null` means "not measurable from current data". */
  value: number | null
  /** Percentage change against the comparison window, or null when unavailable. */
  changePct: number | null
  /** Absolute change, used where a percentage would mislead (e.g. task counts). */
  changeAbs?: number | null
}

export interface EventsFilters {
  q?: string
  type?: string
  status?: string
  dateFrom?: string
  dateTo?: string
  owner?: string
  view?: EventViewMode
  sort?: string
  page?: number
  pageSize?: number
  topic?: string
  speaker?: string
  platform?: string
  sponsor?: string
  tier?: string
  sequence?: string
  event?: string
  recording?: string
  distribution?: string
}
