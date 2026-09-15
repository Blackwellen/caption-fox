// Shared layout + surface tokens for the Brand & Assets module.
//
// Systemic visual differences are corrected here, once, rather than by patching
// individual routes. Every page composes from these so the five surfaces align
// to the same shell width, gutter, card radius and border colour.

export const layout = {
  sidebarWidth: 'w-56',              // 224px, matches the reference sidebar
  sidebarWidthPx: 224,
  topBarHeight: 'h-16',              // 64px
  contentGutter: 'px-6',
  contentMaxWidth: 'max-w-[1600px]',
  sectionGap: 'gap-4',
  rightRail: 'w-[264px]',
  /** Main + right-rail grid shared by every Brand & Assets page (reference: ~230px rail, 14px gap). */
  railGrid: 'grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_232px]',
} as const

export const surface = {
  page: 'bg-slate-100',
  panel: 'bg-white border border-slate-200 rounded-xl',
  panelFlat: 'bg-white border border-slate-200 rounded-lg',
  card: 'bg-white border border-slate-200 rounded-xl',
  hairline: 'border-slate-200',
  muted: 'text-slate-500',
  heading: 'text-slate-900',
} as const

export const control = {
  height: 'h-9',
  base: 'rounded-lg border border-slate-200 bg-white text-sm text-slate-700',
  focus: 'focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500',
  button: 'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
} as const

/** KPI accent tones — background wash + icon colour, keyed to the reference strip. */
export const kpiTone: Record<string, { wash: string; icon: string; ring: string }> = {
  blue:    { wash: 'bg-blue-50',    icon: 'text-blue-600',    ring: 'stroke-blue-500' },
  green:   { wash: 'bg-emerald-50', icon: 'text-emerald-600', ring: 'stroke-emerald-500' },
  amber:   { wash: 'bg-amber-50',   icon: 'text-amber-600',   ring: 'stroke-amber-500' },
  purple:  { wash: 'bg-purple-50',  icon: 'text-purple-600',  ring: 'stroke-purple-500' },
  indigo:  { wash: 'bg-indigo-50',  icon: 'text-indigo-600',  ring: 'stroke-indigo-500' },
  emerald: { wash: 'bg-emerald-50', icon: 'text-emerald-600', ring: 'stroke-emerald-500' },
  red:     { wash: 'bg-rose-50',    icon: 'text-rose-600',    ring: 'stroke-rose-500' },
}

/**
 * Semantic status colours. Every badge pairs colour with a text label so state is
 * never communicated by colour alone.
 */
export const statusTone: Record<string, string> = {
  // positive
  active:              'bg-emerald-50 text-emerald-700 border-emerald-200',
  approved:            'bg-emerald-50 text-emerald-700 border-emerald-200',
  ready:               'bg-emerald-50 text-emerald-700 border-emerald-200',
  clean:               'bg-emerald-50 text-emerald-700 border-emerald-200',
  published:           'bg-emerald-50 text-emerald-700 border-emerald-200',
  // informational
  licensed:            'bg-blue-50 text-blue-700 border-blue-200',
  all_media:           'bg-blue-50 text-blue-700 border-blue-200',
  public_use:          'bg-blue-50 text-blue-700 border-blue-200',
  in_progress:         'bg-blue-50 text-blue-700 border-blue-200',
  // secondary workflow
  pending:             'bg-purple-50 text-purple-700 border-purple-200',
  renewal_pending:     'bg-purple-50 text-purple-700 border-purple-200',
  under_review:        'bg-purple-50 text-purple-700 border-purple-200',
  submitted:           'bg-purple-50 text-purple-700 border-purple-200',
  // warning
  review:              'bg-amber-50 text-amber-700 border-amber-200',
  in_review:           'bg-amber-50 text-amber-700 border-amber-200',
  expiring_soon:       'bg-amber-50 text-amber-700 border-amber-200',
  changes_requested:   'bg-amber-50 text-amber-700 border-amber-200',
  partially_approved:  'bg-amber-50 text-amber-700 border-amber-200',
  medium:              'bg-amber-50 text-amber-700 border-amber-200',
  // danger
  expired:             'bg-rose-50 text-rose-700 border-rose-200',
  restricted:          'bg-rose-50 text-rose-700 border-rose-200',
  rejected:            'bg-rose-50 text-rose-700 border-rose-200',
  not_ready:           'bg-rose-50 text-rose-700 border-rose-200',
  failed:              'bg-rose-50 text-rose-700 border-rose-200',
  flagged:             'bg-rose-50 text-rose-700 border-rose-200',
  high:                'bg-rose-50 text-rose-700 border-rose-200',
  suspended:           'bg-rose-50 text-rose-700 border-rose-200',
  // neutral
  draft:               'bg-slate-100 text-slate-600 border-slate-200',
  archived:            'bg-slate-100 text-slate-600 border-slate-200',
  inactive:            'bg-slate-100 text-slate-600 border-slate-200',
  discontinued:        'bg-slate-100 text-slate-600 border-slate-200',
  cancelled:           'bg-slate-100 text-slate-600 border-slate-200',
  unspecified:         'bg-slate-100 text-slate-600 border-slate-200',
  internal_use:        'bg-slate-100 text-slate-600 border-slate-200',
  none:                'bg-slate-100 text-slate-600 border-slate-200',
  low:                 'bg-slate-100 text-slate-600 border-slate-200',
}

export function toneFor(status: string | null | undefined): string {
  if (!status) return statusTone.none
  return statusTone[status] ?? statusTone.none
}

/** Human labels for the enum values the database stores in snake_case. */
export function humanise(value: string | null | undefined): string {
  if (!value) return '—'
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

/** File-type chip colour, matching the reference asset cards. */
export const assetKindChip: Record<string, string> = {
  image: 'bg-slate-900/80 text-white',
  video: 'bg-slate-900/80 text-white',
  audio: 'bg-slate-900/80 text-white',
  pdf: 'bg-rose-600 text-white',
  presentation: 'bg-amber-600 text-white',
  document: 'bg-blue-600 text-white',
  design: 'bg-indigo-600 text-white',
  social: 'bg-pink-600 text-white',
  packaging: 'bg-teal-600 text-white',
  template: 'bg-violet-600 text-white',
  archive: 'bg-slate-600 text-white',
  other: 'bg-slate-600 text-white',
}

export const assetKindLabel: Record<string, string> = {
  image: 'IMG', video: 'VID', audio: 'AUD', pdf: 'PDF',
  presentation: 'PPT', document: 'DOC', design: 'PSD',
  social: 'SOCIAL', packaging: 'PACK', template: 'TEMPLATE',
  archive: 'ZIP', other: 'FILE',
}

// ---------------------------------------------------------------------------
// Formatting — UK conventions throughout
// ---------------------------------------------------------------------------

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[i]}`
}

export function formatCount(n: number | null | undefined): string {
  return new Intl.NumberFormat('en-GB').format(n ?? 0)
}

export function formatUkDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London',
  }).format(d)
}

export function formatRelativeShort(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
  return formatUkDate(d)
}

/** "12 days left" / "30 days ago" — used across rights surfaces. */
export function formatDaysLeft(days: number | null): { label: string; tone: string } {
  if (days === null) return { label: 'No expiry', tone: 'text-slate-500' }
  if (days < 0) return { label: `${Math.abs(days)} days ago`, tone: 'text-rose-600' }
  if (days === 0) return { label: 'Expires today', tone: 'text-rose-600' }
  if (days <= 30) return { label: `${days} days left`, tone: 'text-rose-600' }
  if (days <= 90) return { label: `${days} days left`, tone: 'text-amber-600' }
  return { label: `${days} days left`, tone: 'text-emerald-600' }
}
