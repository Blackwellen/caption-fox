// Canonical Campaign Manager → Studio vocabulary.
// Every label, badge tone, ordering and route used by the eight Studio surfaces
// resolves from here so the pages stay visually and semantically consistent.

import type { BadgeVariant } from '@/components/ui/Badge'

export const STUDIO_MODULES = [
  'overview', 'compose', 'ai-generate', 'ideas', 'templates', 'hashtags', 'media', 'content',
] as const
export type StudioModule = typeof STUDIO_MODULES[number]

export const STUDIO_MODULE_META: Record<StudioModule, {
  label: string
  title: string
  description: string
  breadcrumb: string
}> = {
  overview: {
    label: 'Overview', title: 'Studio', breadcrumb: 'Overview',
    description: 'Create, customise and prepare content that performs across every channel.',
  },
  compose: {
    label: 'Compose', title: 'Compose', breadcrumb: 'Compose',
    description: 'Write, refine, preview and schedule channel-ready content in one place.',
  },
  'ai-generate': {
    label: 'AI Generate', title: 'AI Generate', breadcrumb: 'AI Generate',
    description: 'Generate high-quality, on-brand content in seconds, then refine it into a draft.',
  },
  ideas: {
    label: 'Ideas', title: 'Ideas', breadcrumb: 'Ideas',
    description: 'Capture, evaluate and prioritise the ideas that drive meaningful content.',
  },
  templates: {
    label: 'Templates', title: 'Templates', breadcrumb: 'Templates',
    description: 'Build faster with reusable, brand-approved templates for every channel and campaign.',
  },
  hashtags: {
    label: 'Hashtags & Keywords', title: 'Hashtags & Keywords', breadcrumb: 'Hashtags & Keywords',
    description: 'Discover, analyse and curate high-performing hashtags and keywords to grow your reach.',
  },
  media: {
    label: 'Media', title: 'Media', breadcrumb: 'Media',
    description: 'A central hub for every image, video, document and creative asset in this workspace.',
  },
  content: {
    label: 'Content Library', title: 'Content Library', breadcrumb: 'Content Library',
    description: 'Manage, organise and repurpose your approved content across all channels.',
  },
}

// ── Content status ───────────────────────────────────────────────────────────
export const CONTENT_STATUSES = [
  'draft', 'pending_approval', 'approved', 'scheduled', 'published', 'failed', 'archived',
] as const
export type ContentStatus = typeof CONTENT_STATUSES[number]

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  draft: 'Draft', pending_approval: 'In review', approved: 'Approved',
  scheduled: 'Scheduled', published: 'Published', failed: 'Failed', archived: 'Archived',
}

export const CONTENT_STATUS_BADGE: Record<ContentStatus, BadgeVariant> = {
  draft: 'slate', pending_approval: 'amber', approved: 'green',
  scheduled: 'blue', published: 'green', failed: 'red', archived: 'slate',
}

/**
 * Status transitions the Studio surfaces allow. Enforced by the server actions,
 * not only by which buttons a page renders — a hidden button is not security.
 */
export const ALLOWED_CONTENT_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  draft: ['draft', 'pending_approval', 'approved', 'scheduled', 'archived'],
  pending_approval: ['pending_approval', 'draft', 'approved', 'archived'],
  approved: ['approved', 'draft', 'scheduled', 'published', 'archived'],
  scheduled: ['scheduled', 'approved', 'draft', 'published', 'failed', 'archived'],
  published: ['published', 'archived'],
  failed: ['failed', 'draft', 'scheduled', 'archived'],
  archived: ['archived', 'draft'],
}

export function canTransitionContent(from: ContentStatus, to: ContentStatus): boolean {
  return (ALLOWED_CONTENT_TRANSITIONS[from] ?? []).includes(to)
}

/** The Content Pipeline strip on the Studio overview, in delivery order. */
export const PIPELINE_STAGES = [
  { id: 'ideation', label: 'Ideation', hint: 'Ideas', icon: 'lightbulb', tone: 'violet' },
  { id: 'draft', label: 'Drafting', hint: 'In progress', icon: 'file', tone: 'blue' },
  { id: 'pending_approval', label: 'Review', hint: 'Ready', icon: 'eye', tone: 'amber' },
  { id: 'approved', label: 'Approval', hint: 'Pending', icon: 'check', tone: 'violet' },
  { id: 'scheduled', label: 'Scheduled', hint: 'This week', icon: 'calendar', tone: 'green' },
  { id: 'published', label: 'Published', hint: 'This month', icon: 'send', tone: 'blue' },
] as const

// ── Channels ─────────────────────────────────────────────────────────────────
export const STUDIO_CHANNELS = [
  'instagram', 'linkedin', 'tiktok', 'facebook', 'x', 'youtube', 'pinterest', 'threads',
] as const
export type StudioChannel = typeof STUDIO_CHANNELS[number]

export const CHANNEL_LABELS: Record<string, string> = {
  instagram: 'Instagram', linkedin: 'LinkedIn', tiktok: 'TikTok', facebook: 'Facebook',
  x: 'X / Twitter', youtube: 'YouTube', pinterest: 'Pinterest', threads: 'Threads',
}

export const CHANNEL_TINT: Record<string, string> = {
  instagram: 'bg-pink-50 text-pink-600 ring-pink-100',
  linkedin: 'bg-sky-50 text-sky-700 ring-sky-100',
  tiktok: 'bg-slate-900/5 text-slate-800 ring-slate-200',
  facebook: 'bg-blue-50 text-blue-600 ring-blue-100',
  x: 'bg-slate-900/5 text-slate-800 ring-slate-200',
  youtube: 'bg-red-50 text-red-600 ring-red-100',
  pinterest: 'bg-rose-50 text-rose-600 ring-rose-100',
  threads: 'bg-slate-900/5 text-slate-800 ring-slate-200',
}

/**
 * Hard caption limits per channel. Used by the composer counter, the preview
 * truncation and the server-side validator, so a client edit cannot smuggle an
 * over-length caption past the API.
 */
export const CHANNEL_LIMITS: Record<string, number> = {
  instagram: 2200, linkedin: 3000, tiktok: 2200, facebook: 63206,
  x: 280, youtube: 5000, pinterest: 500, threads: 500,
}

export function captionLimitFor(channels: string[] | null | undefined): number {
  const list = (channels ?? []).filter(c => c in CHANNEL_LIMITS)
  if (list.length === 0) return 2200
  return Math.min(...list.map(c => CHANNEL_LIMITS[c]))
}

export const POST_TYPES = ['post', 'reel', 'story', 'carousel', 'short', 'thread', 'pin'] as const

// ── Ideas ────────────────────────────────────────────────────────────────────
export const IDEA_STAGES = [
  'backlog', 'in_research', 'prioritised', 'ready_to_draft', 'approved', 'converted', 'archived',
] as const
export type IdeaStage = typeof IDEA_STAGES[number]

export const IDEA_STAGE_LABELS: Record<IdeaStage, string> = {
  backlog: 'Backlog', in_research: 'In research', prioritised: 'Prioritised',
  ready_to_draft: 'Ready to draft', approved: 'Approved', converted: 'Converted', archived: 'Archived',
}

export const IDEA_STAGE_BADGE: Record<IdeaStage, BadgeVariant> = {
  backlog: 'slate', in_research: 'violet', prioritised: 'amber',
  ready_to_draft: 'blue', approved: 'green', converted: 'green', archived: 'slate',
}

/** Columns rendered by the Ideas board, in workflow order. */
export const IDEA_BOARD_STAGES: IdeaStage[] = [
  'backlog', 'in_research', 'prioritised', 'ready_to_draft', 'approved', 'converted',
]

export const ALLOWED_IDEA_TRANSITIONS: Record<IdeaStage, IdeaStage[]> = {
  backlog: ['backlog', 'in_research', 'prioritised', 'archived'],
  in_research: ['in_research', 'backlog', 'prioritised', 'archived'],
  prioritised: ['prioritised', 'in_research', 'ready_to_draft', 'backlog', 'archived'],
  ready_to_draft: ['ready_to_draft', 'prioritised', 'approved', 'converted', 'archived'],
  approved: ['approved', 'ready_to_draft', 'converted', 'archived'],
  converted: ['converted', 'archived'],
  archived: ['archived', 'backlog'],
}

export function canTransitionIdea(from: IdeaStage, to: IdeaStage): boolean {
  return (ALLOWED_IDEA_TRANSITIONS[from] ?? []).includes(to)
}

export const IDEA_SOURCES = [
  'manual', 'ai', 'trend', 'research', 'competitor', 'community', 'import',
] as const

// ── Templates ────────────────────────────────────────────────────────────────
export const TEMPLATE_STATUSES = [
  'draft', 'in_review', 'changes_requested', 'approved', 'published', 'archived',
] as const
export type TemplateStatus = typeof TEMPLATE_STATUSES[number]

export const TEMPLATE_STATUS_LABELS: Record<TemplateStatus, string> = {
  draft: 'Draft', in_review: 'Needs review', changes_requested: 'Changes requested',
  approved: 'Approved', published: 'Published', archived: 'Archived',
}

export const TEMPLATE_STATUS_BADGE: Record<TemplateStatus, BadgeVariant> = {
  draft: 'slate', in_review: 'amber', changes_requested: 'red',
  approved: 'green', published: 'green', archived: 'slate',
}

export const TEMPLATE_CATEGORIES = [
  'announcement', 'education', 'testimonial', 'campaign', 'event', 'product', 'social', 'other',
] as const

// ── Hashtags & keywords ──────────────────────────────────────────────────────
export const KEYWORD_KINDS = ['cluster', 'set'] as const
export type KeywordKind = typeof KEYWORD_KINDS[number]

export const KEYWORD_KIND_LABELS: Record<KeywordKind, string> = { cluster: 'Cluster', set: 'Hashtag set' }

type BandVariant = 'green' | 'amber' | 'red' | 'slate'

/** Competition is a 0–1 score; these are the display bands. */
export function competitionBand(value: number | null | undefined): { label: string; variant: BandVariant } {
  if (value === null || value === undefined) return { label: '—', variant: 'slate' }
  if (value < 0.35) return { label: 'Low', variant: 'green' }
  if (value < 0.65) return { label: 'Medium', variant: 'amber' }
  return { label: 'High', variant: 'red' }
}

export function relevanceBand(value: number | null | undefined): { label: string; variant: BandVariant } {
  if (value === null || value === undefined) return { label: '—', variant: 'slate' }
  if (value >= 80) return { label: 'High', variant: 'green' }
  if (value >= 55) return { label: 'Medium', variant: 'amber' }
  return { label: 'Low', variant: 'slate' }
}

// ── Media ────────────────────────────────────────────────────────────────────
export const MEDIA_STATUSES = ['uploaded', 'needs_review', 'ready', 'changes_requested', 'archived'] as const
export type MediaStatus = typeof MEDIA_STATUSES[number]

export const MEDIA_STATUS_LABELS: Record<MediaStatus, string> = {
  uploaded: 'Uploaded', needs_review: 'Needs review', ready: 'Ready to use',
  changes_requested: 'Changes requested', archived: 'Archived',
}

export const MEDIA_STATUS_BADGE: Record<MediaStatus, BadgeVariant> = {
  uploaded: 'blue', needs_review: 'amber', ready: 'green', changes_requested: 'red', archived: 'slate',
}

export const MEDIA_TYPES = ['image', 'video', 'audio', 'document', 'other'] as const
export type MediaType = typeof MEDIA_TYPES[number]

export const MEDIA_COLLECTION_KINDS = ['campaign', 'brand', 'social', 'team', 'custom'] as const

/** Upload guard rails. Enforced again in the server action, not only in the UI. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024 // 5 GB, matches the design copy
export const ALLOWED_UPLOAD_MIME = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif',
  'video/mp4', 'video/quicktime', 'video/webm',
  'audio/mpeg', 'audio/wav', 'audio/mp4',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv', 'text/plain',
]

export function mediaTypeFor(mime: string | null | undefined, fileType?: string | null): MediaType {
  const m = (mime ?? '').toLowerCase()
  if (m.startsWith('image/')) return 'image'
  if (m.startsWith('video/')) return 'video'
  if (m.startsWith('audio/')) return 'audio'
  if (m === 'application/pdf' || m.includes('officedocument') || m.startsWith('text/')) return 'document'
  const t = (fileType ?? '').toLowerCase()
  if ((MEDIA_TYPES as readonly string[]).includes(t)) return t as MediaType
  return 'other'
}

// ── AI Generate ──────────────────────────────────────────────────────────────
export const AI_TONES = [
  'professional', 'friendly', 'confident', 'playful', 'inspirational', 'informative', 'urgent',
] as const
export const AI_OBJECTIVES = [
  'awareness', 'engagement', 'product_launch', 'lead_generation', 'education', 'conversion', 'retention',
] as const
export const AI_LENGTHS = ['short', 'medium', 'long'] as const
export const AI_FORMATS = ['paragraph', 'bullets', 'listicle', 'thread', 'script', 'caption'] as const
export const AI_RESULT_COUNTS = [1, 2, 3, 4] as const
export const AI_MAX_PROMPT = 3000

export const AI_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', used: 'Accepted', discarded: 'Discarded',
}
export const AI_STATUS_BADGE: Record<string, BadgeVariant> = {
  draft: 'slate', used: 'green', discarded: 'red',
}

// ── Sorting & paging ─────────────────────────────────────────────────────────
export const STUDIO_SORTS = [
  { id: 'updated_desc', label: 'Updated (newest)' },
  { id: 'updated_asc', label: 'Updated (oldest)' },
  { id: 'created_desc', label: 'Created (newest)' },
  { id: 'created_asc', label: 'Created (oldest)' },
  { id: 'scheduled_asc', label: 'Scheduled (soonest)' },
  { id: 'title_asc', label: 'Title (A–Z)' },
  { id: 'title_desc', label: 'Title (Z–A)' },
  { id: 'score_desc', label: 'Score (highest)' },
  { id: 'usage_desc', label: 'Most used' },
  { id: 'size_desc', label: 'Largest' },
] as const
export type StudioSort = typeof STUDIO_SORTS[number]['id']

export const PAGE_SIZES = [10, 12, 24, 48, 96] as const
export const DEFAULT_PAGE_SIZE = 12

/** Studio never trusts a client-supplied error string in front of users. */
export const SUPPORT_REFERENCE = 'CF-STUDIO'
