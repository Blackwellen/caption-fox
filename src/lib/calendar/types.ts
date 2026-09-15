// Canonical Calendar module types. One implementation shared by every eligible
// workspace surface (creator / business / brand / agency) — workspace context,
// permissions and entitlements decide what is visible, never a duplicated page.

export type CalendarSurface = 'creator' | 'business' | 'brand' | 'agency'

export type CalendarTabId = 'calendar' | 'publishing-queue' | 'agenda' | 'conflicts'

export type CalendarView = 'month' | 'week' | 'day' | 'agenda'
export type QueueView = 'queue' | 'table' | 'calendar'
export type ConflictView = 'cards' | 'table' | 'calendar'

export type Priority = 'low' | 'medium' | 'high' | 'urgent'

/** Every record kind the schedule can aggregate. */
export type ScheduleKind =
  | 'content'      // content_posts
  | 'publishing'   // publishing_queue
  | 'campaign'     // campaigns (launch / end milestones)
  | 'task'         // campaign_tasks
  | 'approval'     // approvals
  | 'meeting'      // calendar_items(item_type=meeting)
  | 'reminder'     // calendar_items(item_type=reminder)
  | 'milestone'    // calendar_items(item_type=milestone|launch)
  | 'event'        // calendar_items(other)

export type ScheduleStatus =
  | 'draft'
  | 'in_review'
  | 'pending'
  | 'approved'
  | 'scheduled'
  | 'in_progress'
  | 'published'
  | 'completed'
  | 'failed'
  | 'cancelled'

/**
 * A single unified schedule entry. Derived — it references the canonical record
 * rather than copying it, so `id` is always `${kind}:${recordId}`.
 */
export interface ScheduleEntry {
  id: string
  kind: ScheduleKind
  recordId: string
  title: string
  subtitle?: string | null
  startAt: string           // ISO 8601, UTC
  endAt?: string | null
  allDay: boolean
  timezone: string
  status: ScheduleStatus
  priority: Priority
  channel?: string | null
  campaignId?: string | null
  campaignName?: string | null
  ownerId?: string | null
  ownerName?: string | null
  team?: string | null
  /** Route to open the canonical record. */
  href?: string | null
  conflictIds: string[]
  editable: boolean
}

export interface CalendarKpis {
  scheduledThisWeek: number
  scheduledThisWeekDelta: number | null
  publishingDueToday: number
  publishingDueTodayDelta: number | null
  conflictAlerts: number
  conflictAlertsDelta: number | null
  onTimeRate: number | null
  onTimeRateDelta: number | null
  capacityUtilisation: number | null
  capacityUtilisationDelta: number | null
  upcomingLaunches: number
  nextLaunchLabel: string | null
}

// ── Publishing queue ────────────────────────────────────────────────────────

export type ApprovalState =
  | 'not_required'
  | 'awaiting_approval'
  | 'approved'
  | 'changes_requested'
  | 'rejected'

export type DeliveryState =
  | 'draft'
  | 'queued'
  | 'ready'
  | 'scheduled'
  | 'processing'
  | 'sent'
  | 'published'
  | 'failed'
  | 'cancelled'

/** Lane order shown above the queue table — matches the approved design. */
export const QUEUE_LANES = [
  { id: 'draft', label: 'Draft' },
  { id: 'awaiting_approval', label: 'Awaiting Approval' },
  { id: 'approved', label: 'Approved' },
  { id: 'ready', label: 'Ready' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'failed', label: 'Failed' },
] as const

export type QueueLaneId = (typeof QUEUE_LANES)[number]['id']

export interface QueueItem {
  id: string
  postId: string | null
  title: string
  subtitle: string | null
  thumbnailUrl: string | null
  channel: string | null
  provider: string | null
  providerAccountId: string | null
  providerAccountName: string | null
  providerConnected: boolean
  campaignId: string | null
  campaignName: string | null
  ownerId: string | null
  ownerName: string | null
  scheduledAt: string | null
  publishedAt: string | null
  approvalStatus: ApprovalState
  deliveryStatus: DeliveryState
  priority: Priority
  attemptCount: number
  lastAttemptAt: string | null
  nextRetryAt: string | null
  slaDueAt: string | null
  failureCode: string | null
  failureMessage: string | null
  lane: QueueLaneId
}

export interface QueueKpis {
  queued: number
  queuedDelta: number | null
  awaitingApproval: number
  awaitingApprovalDelta: number | null
  readyToPublish: number
  readyToPublishDelta: number | null
  failed: number
  failedDelta: number | null
  scheduledToday: number
  scheduledTodayDelta: number | null
  slaRisk: number
  slaRiskDelta: number | null
}

export type QueueAlertKind =
  | 'sla_breach'
  | 'failed_publish'
  | 'approval_bottleneck'
  | 'provider_auth'
  | 'rate_limit'
  | 'missing_asset'
  | 'duplicate_slot'

export interface QueueAlert {
  kind: QueueAlertKind
  severity: 'high' | 'medium' | 'low'
  title: string
  detail: string
  count: number
  /** Query string that filters the queue down to the affected records. */
  filterQuery: string
}

export interface ThroughputPoint {
  date: string          // yyyy-mm-dd
  published: number
  scheduled: number
  failed: number
}

// ── Agenda ──────────────────────────────────────────────────────────────────

export interface AgendaDay {
  date: string           // yyyy-mm-dd in the display timezone
  label: string          // "Monday, May 20, 2024"
  isToday: boolean
  allDay: ScheduleEntry[]
  timed: ScheduleEntry[]
  count: number
}

export interface AgendaKpis {
  todayItems: number
  todayItemsDelta: number | null
  thisWeek: number
  thisWeekDelta: number | null
  pendingApprovals: number
  highPriorityApprovals: number
  overdueTasks: number
  overdueTasksDelta: number | null
  openConflicts: number
  conflictsNeedingAttention: number
  teamLoad: number | null
  teamLoadLabel: string
}

// ── Conflicts ───────────────────────────────────────────────────────────────

export type ConflictType =
  | 'overlap_collision'
  | 'capacity_clash'
  | 'approval_delay'
  | 'duplicate_slot'
  | 'blocked_dependency'
  | 'launch_collision'
  | 'channel_saturation'
  | 'resource_unavailable'
  | 'date_invalid'

export type ConflictSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type ConflictStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed' | 'reopened'

export interface ConflictRecommendation {
  id: string
  label: string
  /** A resolution action the panel can actually perform, when one exists. */
  action?: 'reschedule' | 'reassign' | 'extend_deadline' | 'cancel_duplicate' | 'space_posts' | null
  /** True when the text is a heuristic suggestion rather than an enforced rule. */
  advisory: boolean
}

export interface ConflictLinkedRecord {
  kind: 'campaign' | 'content_post' | 'calendar_item' | 'publishing_job' | 'task' | 'approval' | 'profile'
  id: string
  label: string
  href: string | null
}

export interface CalendarConflict {
  id: string
  reference: string
  type: ConflictType
  severity: ConflictSeverity
  impact: 'high' | 'medium' | 'low'
  title: string
  description: string | null
  status: ConflictStatus
  channels: string[]
  campaignId: string | null
  campaignName: string | null
  detectedAt: string
  startAt: string | null
  endAt: string | null
  dueAt: string | null
  ownerId: string | null
  ownerName: string | null
  assigneeId: string | null
  assigneeName: string | null
  recommendations: ConflictRecommendation[]
  resolutionNotes: string | null
  resolvedAt: string | null
  resolvedByName: string | null
  linkedRecords: ConflictLinkedRecord[]
}

export interface ConflictKpis {
  open: number
  openDelta: number | null
  highSeverity: number
  highSeverityDelta: number | null
  capacityClashes: number
  capacityClashesDelta: number | null
  approvalBlockers: number
  approvalBlockersDelta: number | null
  overlappingLaunches: number
  overlappingLaunchesDelta: number | null
  resolvedThisWeek: number
  resolvedThisWeekDelta: number | null
}

export interface ConflictTypeBreakdown {
  type: ConflictType
  label: string
  count: number
  share: number
}

export interface ConflictHeatmapCell {
  channel: string
  bucket: string           // "1-7", "8-14", …
  count: number
  weight: 'none' | 'low' | 'medium' | 'high'
}

// ── Activity ────────────────────────────────────────────────────────────────

export interface CalendarActivity {
  id: string
  action: string
  summary: string
  detail: string | null
  actorName: string | null
  createdAt: string
  href: string | null
  tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral'
}

// ── Shared page context ─────────────────────────────────────────────────────

export interface CalendarFilters {
  view?: string
  start?: string
  end?: string
  date?: string
  owner?: string
  team?: string
  channel?: string
  status?: string
  priority?: string
  type?: string
  campaign?: string
  approval?: string
  conflict?: string
  search?: string
  page?: string
  pageSize?: string
  sort?: string
  lane?: string
  severity?: string
  assignee?: string
  selected?: string
}

export interface OptionItem {
  value: string
  label: string
}

export interface CalendarLookups {
  owners: OptionItem[]
  teams: OptionItem[]
  channels: OptionItem[]
  campaigns: OptionItem[]
}
