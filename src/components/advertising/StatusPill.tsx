import { cn } from '@/lib/utils'

// Status vocabulary for the Advertising module.
//
// Colour alone never carries the meaning: every pill also shows its label, and
// the dot is decorative. Tones are shared with the rest of Caption Fox
// (green = healthy/live, amber = attention, red = failed, slate = inert).

export type StatusTone = 'green' | 'blue' | 'amber' | 'red' | 'slate' | 'violet'

const TONES: Record<StatusTone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/15',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/15',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/10',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/15',
}

const DOTS: Record<StatusTone, string> = {
  green: 'bg-emerald-500', blue: 'bg-blue-500', amber: 'bg-amber-500',
  red: 'bg-red-500', slate: 'bg-slate-400', violet: 'bg-violet-500',
}

/** Campaign and ad-set lifecycle. */
export const CAMPAIGN_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: 'Draft', tone: 'slate' },
  active: { label: 'Active', tone: 'green' },
  learning: { label: 'Learning', tone: 'amber' },
  paused: { label: 'Paused', tone: 'slate' },
  completed: { label: 'Completed', tone: 'blue' },
  archived: { label: 'Archived', tone: 'slate' },
}

/** Connection and account health. */
export const HEALTH_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  connected: { label: 'Healthy', tone: 'green' },
  synced: { label: 'Healthy', tone: 'green' },
  pending: { label: 'Pending', tone: 'slate' },
  queued: { label: 'Queued', tone: 'blue' },
  syncing: { label: 'Syncing', tone: 'blue' },
  partial: { label: 'Partial', tone: 'amber' },
  attention: { label: 'Attention', tone: 'amber' },
  warning: { label: 'Attention', tone: 'amber' },
  expired: { label: 'Expired', tone: 'red' },
  failed: { label: 'Error', tone: 'red' },
  error: { label: 'Error', tone: 'red' },
  disconnected: { label: 'Disconnected', tone: 'slate' },
}

/** Creative review state, provider or internal. */
export const REVIEW_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  not_submitted: { label: 'Not submitted', tone: 'slate' },
  under_review: { label: 'Under Review', tone: 'amber' },
  approved: { label: 'Approved', tone: 'green' },
  changes_requested: { label: 'Changes Requested', tone: 'violet' },
  disapproved: { label: 'Disapproved', tone: 'red' },
}

/** Audience readiness. */
export const AUDIENCE_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  ready: { label: 'Ready', tone: 'green' },
  refreshing: { label: 'Refreshing', tone: 'blue' },
  review: { label: 'Review', tone: 'amber' },
  stale: { label: 'Stale', tone: 'amber' },
  paused: { label: 'Paused', tone: 'slate' },
  failed: { label: 'Failed', tone: 'red' },
  archived: { label: 'Archived', tone: 'slate' },
  pending: { label: 'Pending', tone: 'slate' },
}

export const ISSUE_SEVERITY: Record<string, { label: string; tone: StatusTone }> = {
  critical: { label: 'Critical', tone: 'red' },
  warning: { label: 'Warning', tone: 'amber' },
  info: { label: 'Info', tone: 'blue' },
}

type Props = {
  status: string
  /** Which vocabulary to read the status from. */
  map?: Record<string, { label: string; tone: StatusTone }>
  dot?: boolean
  className?: string
  /** Overrides the looked-up label, e.g. to add a count. */
  label?: string
}

export default function StatusPill({ status, map = CAMPAIGN_STATUS, dot = true, className, label }: Props) {
  const entry = map[status] ?? { label: label ?? humanise(status), tone: 'slate' as StatusTone }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium ring-1 ring-inset',
        TONES[entry.tone],
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOTS[entry.tone])} aria-hidden />}
      {label ?? entry.label}
    </span>
  )
}

/** An unknown status still reads as words rather than a raw enum. */
function humanise(value: string): string {
  return value.replace(/_/g, ' ').replace(/^\w/, character => character.toUpperCase())
}

/** Neutral chip used for objectives, formats, audience types and labels. */
export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600', className)}>
      {children}
    </span>
  )
}

export const OBJECTIVE_LABELS: Record<string, string> = {
  awareness: 'Brand awareness', traffic: 'Traffic', engagement: 'Engagement',
  leads: 'Lead generation', app_installs: 'App installs', video_views: 'Video views',
  sales: 'Sales', conversions: 'Conversions',
}

export const FORMAT_LABELS: Record<string, string> = {
  image: 'Image', video: 'Video', carousel: 'Carousel', story: 'Story',
  reel: 'Reel', display: 'Display', text: 'Text',
}

export const AUDIENCE_TYPE_LABELS: Record<string, string> = {
  custom: 'Custom Audience', lookalike: 'Lookalike', website_visitors: 'Website Visitors',
  engagers: 'Engagers', crm_list: 'CRM List', interest: 'Interest Based',
  video_viewers: 'Video Viewers', customer_list: 'Customer List', app_users: 'App Users',
}
