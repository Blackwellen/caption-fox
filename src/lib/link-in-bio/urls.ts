// URL, slug and UTM rules shared by the editor (client-side hints), server
// actions (authoritative validation), the /r redirect resolver and the
// background link checker. Pure functions only: safe on client and server.

export type UrlCheck = { ok: true; url: string } | { ok: false; error: string }

const MAX_URL_LENGTH = 2048

/**
 * Destination URLs must be absolute http(s). javascript:, data:, file: and any
 * other scheme are rejected, as are credentials embedded in the URL.
 */
export function validateDestinationUrl(input: string | null | undefined, opts: { requireHttps?: boolean } = {}): UrlCheck {
  const raw = (input ?? '').trim()
  if (!raw) return { ok: false, error: 'Enter a destination URL.' }
  if (raw.length > MAX_URL_LENGTH) return { ok: false, error: 'URLs must be 2,048 characters or fewer.' }
  if ([...raw].some(ch => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 || /\s/.test(ch))) return { ok: false, error: 'URLs cannot contain spaces or control characters.' }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, error: 'Enter a full URL, including https://' }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, error: 'Only http:// and https:// links are allowed.' }
  }
  if (opts.requireHttps && url.protocol !== 'https:') {
    return { ok: false, error: 'This link must use https://' }
  }
  if (url.username || url.password) return { ok: false, error: 'URLs cannot include a username or password.' }
  if (!url.hostname || !url.hostname.includes('.')) return { ok: false, error: 'Enter a URL with a valid domain.' }
  return { ok: true, url: url.toString() }
}

/** Hosts the link checker must never fetch (SSRF guard). */
export function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true
  if (host === 'metadata.google.internal') return true
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  if (host.includes(':')) {
    return host === '::1' || host === '::' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')
      || host.startsWith('::ffff:')
  }
  return false
}

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/

const RESERVED_SLUGS = new Set(['admin', 'api', 'app', 'login', 'new', 'edit', 'settings', 'preview', 'caption-fox'])

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '')
}

export function validateSlug(slug: string): { ok: true } | { ok: false; error: string } {
  if (!slug) return { ok: false, error: 'Enter a slug.' }
  if (!SLUG_PATTERN.test(slug)) {
    return { ok: false, error: 'Use 1–50 lowercase letters, numbers and single hyphens.' }
  }
  if (RESERVED_SLUGS.has(slug)) return { ok: false, error: 'That slug is reserved. Choose another.' }
  return { ok: true }
}

export type Utm = { source?: string; medium?: string; campaign?: string; content?: string; term?: string }
export const UTM_KEYS = ['source', 'medium', 'campaign', 'content', 'term'] as const

export function normaliseUtm(input: unknown): Utm {
  const out: Utm = {}
  if (!input || typeof input !== 'object') return out
  for (const key of UTM_KEYS) {
    const value = (input as Record<string, unknown>)[key]
    if (typeof value === 'string' && value.trim()) out[key] = value.trim().slice(0, 100)
  }
  return out
}

/**
 * Appends UTM parameters. Parameters already on the destination win: an
 * explicit utm_source in the pasted URL is the author's intent.
 */
export function applyUtm(destination: string, utm: Utm): string {
  let url: URL
  try { url = new URL(destination) } catch { return destination }
  for (const key of UTM_KEYS) {
    const value = utm[key]
    if (value && !url.searchParams.has(`utm_${key}`)) url.searchParams.set(`utm_${key}`, value)
  }
  return url.toString()
}

export function utmQueryString(utm: Utm): string {
  return UTM_KEYS.filter(key => utm[key]).map(key => `utm_${key}=${encodeURIComponent(utm[key] as string)}`).join('&')
}

/** True when a destination would redirect back into our own short-link path. */
export function isRedirectLoop(destination: string, ownHosts: string[], slug: string | null): boolean {
  try {
    const url = new URL(destination)
    const own = ownHosts.map(host => host.toLowerCase()).includes(url.hostname.toLowerCase())
    if (!own) return false
    return url.pathname.startsWith('/r/') && (!slug || url.pathname.replace(/\/+$/, '') === `/r/${slug}`)
  } catch {
    return false
  }
}

// ------------------------------------------------------------------ routing

export type DeviceClass = 'mobile' | 'tablet' | 'desktop' | 'other'
export type TrafficSource = 'social' | 'direct' | 'search' | 'email' | 'referral'

export type RoutingRule =
  | { id: string; type: 'device'; devices: DeviceClass[]; destination: string }
  | { id: string; type: 'country'; countries: string[]; destination: string }
  | { id: string; type: 'campaign'; sources: string[]; destination: string }

export type RoutingContext = { device: DeviceClass; country: string | null; source: TrafficSource | null; utmSource: string | null; referrerHost: string | null }

const RULE_ORDER: Record<RoutingRule['type'], number> = { device: 0, country: 1, campaign: 2 }

export function normaliseRules(input: unknown): RoutingRule[] {
  if (!Array.isArray(input)) return []
  const rules: RoutingRule[] = []
  for (const entry of input) {
    if (!entry || typeof entry !== 'object') continue
    const rule = entry as Record<string, unknown>
    const destination = validateDestinationUrl(typeof rule.destination === 'string' ? rule.destination : '')
    if (!destination.ok) continue
    const id = typeof rule.id === 'string' ? rule.id : `${rule.type}-${rules.length}`
    const list = (value: unknown) => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.length > 0).slice(0, 50) : []
    if (rule.type === 'device') {
      const devices = list(rule.devices).filter((d): d is DeviceClass => ['mobile', 'tablet', 'desktop', 'other'].includes(d))
      if (devices.length) rules.push({ id, type: 'device', devices, destination: destination.url })
    } else if (rule.type === 'country') {
      const countries = list(rule.countries).map(c => c.toUpperCase()).filter(c => /^[A-Z]{2}$/.test(c))
      if (countries.length) rules.push({ id, type: 'country', countries, destination: destination.url })
    } else if (rule.type === 'campaign') {
      const sources = list(rule.sources).map(s => s.toLowerCase())
      if (sources.length) rules.push({ id, type: 'campaign', sources, destination: destination.url })
    }
  }
  return rules
}

/**
 * Deterministic resolution: device rules, then country, then campaign/referrer,
 * each in saved order; the first match wins, otherwise the default destination.
 */
export function resolveDestination(defaultUrl: string, rules: RoutingRule[], ctx: RoutingContext): { url: string; ruleId: string | null } {
  const ordered = [...rules].map((rule, index) => ({ rule, index }))
    .sort((a, b) => RULE_ORDER[a.rule.type] - RULE_ORDER[b.rule.type] || a.index - b.index)
  for (const { rule } of ordered) {
    if (rule.type === 'device' && rule.devices.includes(ctx.device)) return { url: rule.destination, ruleId: rule.id }
    if (rule.type === 'country' && ctx.country && rule.countries.includes(ctx.country.toUpperCase())) return { url: rule.destination, ruleId: rule.id }
    if (rule.type === 'campaign') {
      const candidates = [ctx.utmSource, ctx.source, ctx.referrerHost].filter(Boolean).map(v => (v as string).toLowerCase())
      if (rule.sources.some(source => candidates.some(candidate => candidate === source || candidate.endsWith(`.${source}`) || candidate.startsWith(`${source}.`)))) {
        return { url: rule.destination, ruleId: rule.id }
      }
    }
  }
  return { url: defaultUrl, ruleId: null }
}

/** Rules of the same type that match the same audience but disagree on the destination. */
export function findRuleConflicts(rules: RoutingRule[]): string[] {
  const conflicts: string[] = []
  const seen = new Map<string, string>()
  for (const rule of rules) {
    const keys = rule.type === 'device' ? rule.devices : rule.type === 'country' ? rule.countries : rule.sources
    for (const key of keys) {
      const token = `${rule.type}:${key}`
      const previous = seen.get(token)
      if (previous && previous !== rule.destination) conflicts.push(`Two ${rule.type} rules target “${key}” with different destinations.`)
      else seen.set(token, rule.destination)
    }
  }
  return [...new Set(conflicts)]
}

// ------------------------------------------------------------- classification

export function classifyDevice(userAgent: string | null | undefined): DeviceClass {
  if (!userAgent) return 'other'
  const ua = userAgent.toLowerCase()
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(ua)) return 'tablet'
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/.test(ua)) return 'mobile'
  if (/bot|crawl|spider|preview/.test(ua)) return 'other'
  if (/windows|macintosh|linux|cros/.test(ua)) return 'desktop'
  return 'other'
}

const SOCIAL_HOSTS = ['instagram.com', 'facebook.com', 't.co', 'twitter.com', 'x.com', 'tiktok.com', 'youtube.com', 'linkedin.com', 'pinterest.com', 'snapchat.com', 'reddit.com', 'threads.net', 'linktr.ee', 'lnkd.in', 'l.instagram.com', 'lm.facebook.com']
const SEARCH_HOSTS = ['google.', 'bing.com', 'duckduckgo.com', 'yahoo.', 'ecosia.org', 'baidu.com']
const EMAIL_HOSTS = ['mail.google.com', 'outlook.live.com', 'mail.yahoo.com', 'outlook.office.com']

export function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null
  try { return new URL(referrer).hostname.replace(/^www\./, '').toLowerCase() } catch { return null }
}

export function classifySource(referrer: string | null | undefined, utmMedium?: string | null): TrafficSource {
  const medium = (utmMedium ?? '').toLowerCase()
  if (medium === 'email' || medium === 'newsletter') return 'email'
  if (['social', 'bio', 'linkinbio', 'social-paid', 'paid_social'].includes(medium)) return 'social'
  const host = referrerHost(referrer)
  if (!host) return 'direct'
  if (EMAIL_HOSTS.some(h => host === h)) return 'email'
  if (SOCIAL_HOSTS.some(h => host === h || host.endsWith(`.${h}`))) return 'social'
  if (SEARCH_HOSTS.some(h => host.includes(h))) return 'search'
  return 'referral'
}
