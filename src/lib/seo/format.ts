// UK-locale formatting for every SEO surface. Client-safe (no server imports).

const UK = 'en-GB'

export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat(UK).format(Math.round(value))
}

export function formatCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  if (Math.abs(value) < 1000) return new Intl.NumberFormat(UK).format(Math.round(value))
  return new Intl.NumberFormat(UK, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function formatDecimal(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat(UK, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${formatDecimal(value, digits)}%`
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat(UK, { style: 'currency', currency: 'GBP' }).format(value)
}

/** Rank display. NULL means not ranking — never rendered as 0. */
export function formatRank(value: number | null | undefined): string {
  if (value == null) return 'Not ranking'
  return `#${new Intl.NumberFormat(UK).format(value)}`
}

export function formatRankValue(value: number | null | undefined): string {
  if (value == null) return '—'
  return formatDecimal(value, 1)
}

export function formatKpi(value: number | null | undefined, format: string): string {
  switch (format) {
    case 'compact': return formatCompact(value)
    case 'percent': return formatPercent(value)
    case 'decimal': return formatDecimal(value)
    case 'score': return formatDecimal(value)
    case 'rank': return formatDecimal(value)
    case 'currency': return formatCurrency(value)
    default: return formatNumber(value)
  }
}

const DATE_FMT = new Intl.DateTimeFormat(UK, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' })
const DATE_SHORT = new Intl.DateTimeFormat(UK, { day: 'numeric', month: 'short', timeZone: 'Europe/London' })
const DATE_TIME = new Intl.DateTimeFormat(UK, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return DATE_FMT.format(date)
}

export function formatDateShort(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return DATE_SHORT.format(date)
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return DATE_TIME.format(date)
}

export function formatRangeLabel(from: string, to: string): string {
  const start = new Date(from)
  const end = new Date(to)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—'
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear()
  const startText = sameYear ? DATE_SHORT.format(start) : DATE_FMT.format(start)
  return `${startText} – ${DATE_FMT.format(end)}`
}

export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.round(months / 12)}y ago`
}

/** Days until a due date, phrased for the briefs surface. */
export function dueLabel(due: string | null | undefined): { text: string; overdue: boolean } {
  if (!due) return { text: 'No due date', overdue: false }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(due)
  date.setHours(0, 0, 0, 0)
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000)
  if (days < 0) return { text: 'Overdue', overdue: true }
  if (days === 0) return { text: 'Due today', overdue: false }
  if (days === 1) return { text: '1 day left', overdue: false }
  return { text: `${days} days left`, overdue: false }
}

export function percentChange(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
}

export function absoluteChange(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null
  return Math.round((current - previous) * 10) / 10
}

const TITLE_OVERRIDES: Record<string, string> = {
  google_search_console: 'Google Search Console',
  google_analytics: 'Google Analytics',
  google_business_profile: 'Google Business Profile',
  bing_webmaster: 'Bing Webmaster Tools',
  bing_places: 'Bing Places',
  apple_maps: 'Apple Maps',
  semrush: 'Semrush',
  ahrefs: 'Ahrefs',
  dataforseo: 'DataForSEO',
  moz: 'Moz',
  majestic: 'Majestic',
  brightlocal: 'BrightLocal',
  internal_tracker: 'Caption Fox tracker',
  manual: 'Manual entry',
  facebook: 'Facebook',
  yelp: 'Yelp',
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  google_sge: 'Google AI Overviews',
  gemini: 'Gemini',
  claude: 'Claude',
  bing_copilot: 'Bing Copilot',
  how_to: 'How-to',
  landing_page: 'Landing page',
  case_study: 'Case study',
  faq: 'FAQ',
  in_progress: 'In Progress',
  awaiting_review: 'Awaiting Review',
  changes_requested: 'Changes Requested',
  not_ranking: 'Not ranking',
  suspected_toxic: 'Suspected toxic',
  not_cited: 'Not Cited',
  dofollow: 'DoFollow',
  nofollow: 'NoFollow',
  ugc: 'UGC',
}

export function humanise(value: string | null | undefined): string {
  if (!value) return '—'
  if (TITLE_OVERRIDES[value]) return TITLE_OVERRIDES[value]
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '🌐'
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1f1a5 + c.charCodeAt(0)))
}
