// Shared (client + server) onboarding schema for the five account types.
// The server re-runs sanitize/validate on every save, so the client copy is
// UX only — never trusted.

export const ACCOUNT_TYPES = ['brand', 'agency', 'business', 'creator', 'supplier'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export function isAccountType(value: unknown): value is AccountType {
  return typeof value === 'string' && (ACCOUNT_TYPES as readonly string[]).includes(value)
}

export const ACCOUNT_TYPE_META: Record<AccountType, { label: string; descriptor: string; destination: string }> = {
  brand: { label: 'Brand', descriptor: 'Manage your brand', destination: '/app/home' },
  agency: { label: 'Agency', descriptor: 'Work with multiple clients', destination: '/app/home' },
  business: { label: 'Business', descriptor: 'Grow your business', destination: '/app/home' },
  creator: { label: 'Creator', descriptor: 'Create and publish content', destination: '/app/home' },
  supplier: { label: 'Supplier', descriptor: 'Provide products or services', destination: '/supplier' },
}

export interface Option {
  value: string
  label: string
  description?: string
}

const opts = (labels: readonly string[]): Option[] => labels.map(label => ({ value: label, label }))

// ── Option sets ──────────────────────────────────────────────────────────────
export const PLATFORMS: Option[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'threads', label: 'Threads' },
  { value: 'twitch', label: 'Twitch' },
  { value: 'snapchat', label: 'Snapchat' },
]

export const CREATOR_TYPES: Option[] = [
  { value: 'content_creator', label: 'Content Creator', description: 'You create original content and partner with brands.' },
  { value: 'ugc_creator', label: 'UGC Creator', description: 'You make content brands publish on their own channels.' },
  { value: 'influencer', label: 'Influencer', description: 'You grow an audience and promote brands to it.' },
  { value: 'educator', label: 'Educator', description: 'You teach and explain through your content.' },
  { value: 'streamer', label: 'Streamer / Podcaster', description: 'You create live, long-form or audio content.' },
]
export const AUDIENCE_FOCUS = opts(['Gen Z (13–24)', 'Millennials (25–40)', 'Gen X (41–56)', 'Parents & families', 'Professionals / B2B', 'Broad audience'])
export const CONTENT_CATEGORIES = opts(['UGC', 'Short-form video', 'Product content', 'Tutorials', 'Lifestyle'])
export const POSTING_FREQUENCY = opts(['Daily', '3–5 times per week', '1–2 times per week', 'A few times a month'])
export const CONTENT_FORMATS = opts(['Short-form video', 'Long-form video', 'Photos', 'Carousels', 'Stories', 'Livestreams', 'Podcasts'])
export const COLLAB_TYPES = opts(['Paid partnerships', 'Gifted products', 'Affiliate / commission', 'UGC only (no posting)', 'Ambassadorships'])

export const INDUSTRIES = opts([
  'Technology', 'E-commerce & retail', 'Fashion & beauty', 'Food & drink', 'Health & fitness', 'Finance',
  'Education', 'Travel & hospitality', 'Professional services', 'Entertainment & media', 'Non-profit', 'Other',
])
export const TEAM_SIZES = opts(['Just me', '2 - 10 people', '11 - 50 people', '51 - 200 people', '200+ people'])
export const REGIONS = opts(['United Kingdom', 'Europe', 'North America', 'Asia Pacific', 'Middle East & Africa', 'Latin America', 'Global'])
export const BUSINESS_GOALS = opts(['Awareness', 'Leads', 'Sales', 'Retention'])
export const BUSINESS_CHANNELS = opts(['Social', 'Email', 'Web', 'Paid'])
export const CADENCES = opts(['Daily', '4 - 6 times per week', '2 - 3 times per week', 'Once a week', 'A few times a month'])

export const TONES = opts(['Bold', 'Playful', 'Premium', 'Informative', 'Minimal'])
export const BRAND_GOALS = opts(['Brand awareness', 'Product launches', 'Community growth', 'Lead generation', 'Sales & conversions', 'Customer retention'])
export const AUDIENCE_PRIORITIES = opts(['New customers', 'Existing customers', 'Partners & retailers', 'Talent & recruiting'])
export const BRAND_CHANNELS: Option[] = [...PLATFORMS.slice(0, 7), { value: 'email', label: 'Email' }, { value: 'web', label: 'Website / blog' }]

export const CLIENT_COUNTS = opts(['1–4 clients', '5–10 clients', '11–25 clients', '26–50 clients', '50+ clients'])
export const CLIENT_MODELS: Option[] = [
  { value: 'separate', label: 'Separate workspace per client', description: 'Keep content, campaigns and reports fully separated.' },
  { value: 'single', label: 'All clients in one agency workspace', description: 'Clients as brands in one workspace — your whole team sees every client.' },
]
export const SERVICE_LINES = opts(['Campaigns', 'Content', 'Paid Media', 'Reporting', 'UGC'])
export const APPROVAL_WORKFLOWS = opts(['Client approval required', 'Internal approval only', 'No approval needed'])
export const REPORTING_PREFS = opts(['Standard performance reports', 'Detailed analytics reports', 'Executive summaries', 'No client reporting'])
export const TEAM_ROLE_MODELS = opts(['Account managers', 'Project managers', 'Owners only', 'Everyone on the team'])
export const AGENCY_DELIVERABLES = opts(['Content calendars', 'Campaign creative', 'Paid ad creative', 'UGC videos', 'Community management', 'Monthly reports'])
export const PRICING_MODELS = opts(['Monthly retainer', 'Per project', 'Hourly', 'Mixed'])

export const SUPPLIER_TYPES: Option[] = [
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'ugc_creator', label: 'UGC creator' },
  { value: 'ads_manager', label: 'Ads manager' },
  { value: 'agency', label: 'Agency / studio' },
  { value: 'influencer', label: 'Influencer' },
]
export const SERVICE_CATEGORIES = opts(['Production', 'Design', 'Copywriting', 'Influencer support', 'Photography', 'Editing'])
export const DELIVERABLES = opts(['Short-form videos', 'Static images', 'Social media assets', 'Campaign concepts', 'Product photography', 'Ad creative', 'Copy & captions'])
export const TURNAROUND: Option[] = [
  { value: '48', label: '24–48 hours' },
  { value: '120', label: '3–5 days' },
  { value: '336', label: '1–2 weeks' },
  { value: '672', label: '2–4 weeks' },
]
export const LEAD_TIMES: Option[] = [
  { value: '0', label: 'Can start immediately' },
  { value: '3', label: 'Within 3 days' },
  { value: '7', label: 'Within a week' },
  { value: '14', label: 'Within 2 weeks' },
  { value: '30', label: 'Within a month' },
]
export const CAPACITY = opts(['1–2 projects / month', '3–5 projects / month', '6–10 projects / month', '10+ projects / month'])
export const CONTACT_PREFS = opts(['In-app messages', 'Email'])
export const COUNTRIES = opts([
  'United Kingdom', 'Ireland', 'United States', 'Canada', 'Australia', 'Germany', 'France', 'Netherlands', 'Spain', 'India', 'Other',
])

export const INVITE_ROLES: Option[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
]

// ── Value shapes ─────────────────────────────────────────────────────────────
export interface UploadRef {
  path: string
  name: string
  type: string
  size: number
  caption?: string
  service?: string
}

export interface InviteRef {
  email: string
  role: string
}

export type OnboardingData = Record<string, unknown>
export type FieldErrors = Record<string, string>

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const PORTFOLIO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'] as const
const MB = 1024 * 1024

type FieldSpec =
  | { kind: 'text'; label: string; required?: boolean; min?: number; max: number }
  | { kind: 'url'; label: string; required?: boolean }
  | { kind: 'enum'; label: string; required?: boolean; options: Option[] }
  | { kind: 'multi'; label: string; required?: boolean; maxItems: number; options: Option[]; allowCustom?: boolean }
  | { kind: 'bool'; label: string }
  | { kind: 'colors'; label: string; required?: boolean; maxItems: number }
  | { kind: 'uploads'; label: string; maxItems: number; accept: readonly string[]; maxBytes: number }
  | { kind: 'invites'; label: string; maxItems: number }

export interface StepDef {
  key: string
  label: string
  description: string
  fields: string[]
  // Cross-field rule evaluated after per-field validation.
  rule?: (data: OnboardingData) => FieldErrors
}

export interface FlowDef {
  fields: Record<string, FieldSpec>
  steps: [StepDef, StepDef, StepDef, StepDef]
}

const nameField = (label: string): FieldSpec => ({ kind: 'text', label, required: true, min: 2, max: 80 })
const website: FieldSpec = { kind: 'url', label: 'Website' }

export const FLOWS: Record<AccountType, FlowDef> = {
  creator: {
    fields: {
      creator_type: { kind: 'enum', label: 'Creator type', required: true, options: CREATOR_TYPES },
      bio: { kind: 'text', label: 'Short bio', max: 280 },
      location: { kind: 'text', label: 'Location', max: 80 },
      website: { kind: 'url', label: 'Website or portfolio' },
      avatar: { kind: 'uploads', label: 'Profile photo', maxItems: 1, accept: IMAGE_TYPES, maxBytes: 5 * MB },
      display_name: { kind: 'text', label: 'Display name', required: true, min: 2, max: 60 },
      primary_platform: { kind: 'enum', label: 'Primary platform', required: true, options: PLATFORMS },
      other_channels: { kind: 'multi', label: 'Other channels', maxItems: 10, options: PLATFORMS },
      audience_focus: { kind: 'enum', label: 'Audience focus', required: true, options: AUDIENCE_FOCUS },
      content_categories: { kind: 'multi', label: 'Content categories', required: true, maxItems: 12, options: CONTENT_CATEGORIES, allowCustom: true },
      posting_frequency: { kind: 'enum', label: 'Posting frequency', required: true, options: POSTING_FREQUENCY },
      content_formats: { kind: 'multi', label: 'Formats', required: true, maxItems: 7, options: CONTENT_FORMATS },
      collab_types: { kind: 'multi', label: 'Collaboration types', required: true, maxItems: 5, options: COLLAB_TYPES },
      topics: { kind: 'text', label: 'Topics you cover', max: 280 },
      ugc_available: { kind: 'bool', label: 'Available for UGC briefs' },
    },
    steps: [
      { key: 'profile', label: 'Profile', description: 'Tell us about you', fields: ['creator_type', 'bio', 'location', 'website', 'avatar'] },
      { key: 'channels', label: 'Channels', description: 'Connect your platforms', fields: ['display_name', 'primary_platform', 'other_channels', 'audience_focus', 'content_categories', 'posting_frequency'] },
      { key: 'content', label: 'Content', description: 'What you create', fields: ['content_formats', 'collab_types', 'topics', 'ugc_available'] },
      { key: 'review', label: 'Review', description: 'Confirm and go live', fields: [] },
    ],
  },
  business: {
    fields: {
      business_name: nameField('Business name'),
      website,
      industry: { kind: 'enum', label: 'Industry', required: true, options: INDUSTRIES },
      region: { kind: 'enum', label: 'Main region', options: REGIONS },
      description: { kind: 'text', label: 'What your business does', max: 280 },
      goals: { kind: 'multi', label: 'Marketing goals', required: true, maxItems: 4, options: BUSINESS_GOALS },
      primary_channels: { kind: 'multi', label: 'Primary channels', required: true, maxItems: 4, options: BUSINESS_CHANNELS },
      team_size: { kind: 'enum', label: 'Team size', required: true, options: TEAM_SIZES },
      cadence: { kind: 'enum', label: 'Publishing cadence', required: true, options: CADENCES },
      social_channels: { kind: 'multi', label: 'Social channels', required: true, maxItems: 10, options: PLATFORMS },
      invites: { kind: 'invites', label: 'Team invites', maxItems: 10 },
    },
    steps: [
      { key: 'business', label: 'Business', description: 'Tell us about your business', fields: ['business_name', 'website', 'industry', 'region', 'description'] },
      { key: 'goals', label: 'Goals', description: 'Set your marketing goals', fields: ['business_name', 'website', 'industry', 'goals', 'primary_channels', 'team_size', 'cadence'] },
      { key: 'channels', label: 'Channels', description: 'Choose your channels', fields: ['social_channels'] },
      { key: 'team', label: 'Team', description: 'Invite your team', fields: ['invites'] },
    ],
  },
  brand: {
    fields: {
      brand_name: { kind: 'text', label: 'Brand name', required: true, min: 2, max: 80 },
      website,
      industry: { kind: 'enum', label: 'Industry', required: true, options: INDUSTRIES },
      description: { kind: 'text', label: 'Brand description', max: 280 },
      tone: { kind: 'enum', label: 'Tone of voice', required: true, options: TONES },
      key_messaging: { kind: 'text', label: 'Key messaging', max: 500 },
      brand_colors: { kind: 'colors', label: 'Brand colours', required: true, maxItems: 6 },
      logo: { kind: 'uploads', label: 'Logo', maxItems: 1, accept: IMAGE_TYPES, maxBytes: 10 * MB },
      brand_assets: { kind: 'uploads', label: 'Brand assets', maxItems: 6, accept: IMAGE_TYPES, maxBytes: 15 * MB },
      target_audience: { kind: 'text', label: 'Target audience', max: 200 },
      goals: { kind: 'multi', label: 'Marketing goals', required: true, maxItems: 6, options: BRAND_GOALS },
      objectives: { kind: 'text', label: 'Campaign objectives', max: 500 },
      audience_priorities: { kind: 'multi', label: 'Audience priorities', maxItems: 4, options: AUDIENCE_PRIORITIES },
      channels: { kind: 'multi', label: 'Channels', required: true, maxItems: 9, options: BRAND_CHANNELS },
      cadence: { kind: 'enum', label: 'Publishing cadence', required: true, options: CADENCES },
    },
    steps: [
      { key: 'brand', label: 'Brand', description: 'Your brand basics', fields: ['brand_name', 'website', 'industry', 'description'] },
      { key: 'voice', label: 'Voice & Assets', description: 'How you sound and look', fields: ['brand_name', 'website', 'tone', 'key_messaging', 'brand_colors', 'logo', 'brand_assets', 'target_audience'] },
      { key: 'goals', label: 'Goals', description: 'What success looks like', fields: ['goals', 'objectives', 'audience_priorities'] },
      { key: 'channels', label: 'Channels', description: 'Where you publish', fields: ['channels', 'cadence'] },
    ],
  },
  agency: {
    fields: {
      agency_name: nameField('Agency name'),
      website,
      team_size: { kind: 'enum', label: 'Team size', required: true, options: TEAM_SIZES },
      region: { kind: 'enum', label: 'Main region', options: REGIONS },
      description: { kind: 'text', label: 'What your agency does', max: 280 },
      client_count: { kind: 'enum', label: 'Number of clients', required: true, options: CLIENT_COUNTS },
      client_model: { kind: 'enum', label: 'Client workspace setup', required: true, options: CLIENT_MODELS },
      service_lines: { kind: 'multi', label: 'Service lines', required: true, maxItems: 5, options: SERVICE_LINES },
      approval_workflow: { kind: 'enum', label: 'Approval workflow', required: true, options: APPROVAL_WORKFLOWS },
      reporting: { kind: 'enum', label: 'Reporting preferences', required: true, options: REPORTING_PREFS },
      team_roles: { kind: 'enum', label: 'Team roles', required: true, options: TEAM_ROLE_MODELS },
      deliverable_types: { kind: 'multi', label: 'What you deliver', required: true, maxItems: 6, options: AGENCY_DELIVERABLES },
      client_industries: { kind: 'multi', label: 'Client industries', maxItems: 12, options: INDUSTRIES },
      pricing_model: { kind: 'enum', label: 'Pricing model', required: true, options: PRICING_MODELS },
      invites: { kind: 'invites', label: 'Team invites', maxItems: 10 },
    },
    steps: [
      { key: 'agency', label: 'Agency', description: 'Your basics', fields: ['agency_name', 'website', 'team_size', 'region', 'description'] },
      { key: 'clients', label: 'Clients', description: 'Set up client spaces', fields: ['client_count', 'client_model', 'service_lines', 'approval_workflow', 'reporting', 'team_roles'] },
      { key: 'services', label: 'Services', description: 'What you deliver', fields: ['deliverable_types', 'client_industries', 'pricing_model'] },
      { key: 'team', label: 'Team', description: 'Invite your people', fields: ['invites'] },
    ],
  },
  supplier: {
    fields: {
      company_name: nameField('Company name'),
      supplier_type: { kind: 'enum', label: 'Supplier type', required: true, options: SUPPLIER_TYPES },
      website,
      description: { kind: 'text', label: 'Company description', required: true, min: 20, max: 600 },
      location: { kind: 'text', label: 'City / location', max: 120 },
      country: { kind: 'enum', label: 'Country', required: true, options: COUNTRIES },
      service_categories: { kind: 'multi', label: 'Service categories', required: true, maxItems: 6, options: SERVICE_CATEGORIES },
      regions_served: { kind: 'multi', label: 'Regions served', required: true, maxItems: 7, options: REGIONS },
      deliverables: { kind: 'multi', label: 'Typical deliverables', maxItems: 7, options: DELIVERABLES },
      portfolio: { kind: 'uploads', label: 'Portfolio', maxItems: 8, accept: PORTFOLIO_TYPES, maxBytes: 25 * MB },
      turnaround_hours: { kind: 'enum', label: 'Typical turnaround time', required: true, options: TURNAROUND },
      headline: { kind: 'text', label: 'Profile headline', max: 140 },
      portfolio_link: { kind: 'url', label: 'External portfolio link' },
      available_now: { kind: 'bool', label: 'Available for new projects' },
      lead_time_days: { kind: 'enum', label: 'Lead time', required: true, options: LEAD_TIMES },
      capacity: { kind: 'enum', label: 'Capacity', required: true, options: CAPACITY },
      contact_preference: { kind: 'enum', label: 'Contact preference', required: true, options: CONTACT_PREFS },
      publish_profile: { kind: 'bool', label: 'Publish my profile to the marketplace' },
    },
    steps: [
      { key: 'company', label: 'Company', description: 'Basic information', fields: ['company_name', 'supplier_type', 'website', 'description', 'location', 'country'] },
      { key: 'services', label: 'Services', description: 'What you offer', fields: ['company_name', 'website', 'service_categories', 'regions_served', 'deliverables', 'portfolio', 'turnaround_hours'] },
      {
        key: 'portfolio', label: 'Portfolio', description: 'Showcase work', fields: ['portfolio', 'portfolio_link', 'headline'],
        rule: (data): FieldErrors => {
          const items = Array.isArray(data.portfolio) ? data.portfolio : []
          return items.length === 0 && !data.portfolio_link
            ? { portfolio: 'Add at least one portfolio example or a link to your work.' }
            : {}
        },
      },
      { key: 'availability', label: 'Availability', description: 'When you can deliver', fields: ['available_now', 'lead_time_days', 'capacity', 'contact_preference', 'publish_profile'] },
    ],
  },
}

// ── Sanitising (server + client) ─────────────────────────────────────────────
const CONTROL = /[ --]/g
const cleanText = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(CONTROL, '').trim().slice(0, max) : '')

function cleanUrl(v: unknown): string {
  const s = cleanText(v, 300)
  if (!s) return ''
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`
  return withScheme
}

export function isValidUrl(v: string): boolean {
  try {
    const u = new URL(v)
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.') && !/\s/.test(v)
  } catch {
    return false
  }
}

function cleanUploads(v: unknown, spec: Extract<FieldSpec, { kind: 'uploads' }>, userId: string | null): UploadRef[] {
  if (!Array.isArray(v)) return []
  const out: UploadRef[] = []
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const path = cleanText(r.path, 300)
    const type = cleanText(r.type, 60)
    const size = typeof r.size === 'number' && Number.isFinite(r.size) ? Math.round(r.size) : -1
    if (!/^[0-9a-f-]{36}\/[a-z_]+\/[A-Za-z0-9._-]{1,120}$/.test(path)) continue
    if (userId && !path.startsWith(`${userId}/`)) continue
    if (!spec.accept.includes(type) || size <= 0 || size > spec.maxBytes) continue
    out.push({
      path, type, size,
      name: cleanText(r.name, 120) || 'file',
      caption: cleanText(r.caption, 140) || undefined,
      service: cleanText(r.service, 40) || undefined,
    })
    if (out.length >= spec.maxItems) break
  }
  return out
}

function cleanInvites(v: unknown, max: number): InviteRef[] {
  if (!Array.isArray(v)) return []
  const seen = new Set<string>()
  const out: InviteRef[] = []
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const email = cleanText(r.email, 254).toLowerCase()
    const role = INVITE_ROLES.some(o => o.value === r.role) ? String(r.role) : 'member'
    if (!email || seen.has(email)) continue
    seen.add(email)
    out.push({ email, role })
    if (out.length >= max) break
  }
  return out
}

function cleanValue(spec: FieldSpec, v: unknown, userId: string | null): unknown {
  switch (spec.kind) {
    case 'text': return cleanText(v, spec.max)
    case 'url': return cleanUrl(v)
    case 'enum': return typeof v === 'string' && spec.options.some(o => o.value === v) ? v : ''
    case 'bool': return v === true
    case 'multi': {
      if (!Array.isArray(v)) return []
      const seen = new Set<string>()
      const out: string[] = []
      for (const item of v) {
        const s = cleanText(item, 40)
        if (!s || seen.has(s.toLowerCase())) continue
        if (!spec.allowCustom && !spec.options.some(o => o.value === s)) continue
        seen.add(s.toLowerCase())
        out.push(s)
        if (out.length >= spec.maxItems) break
      }
      return out
    }
    case 'colors': {
      if (!Array.isArray(v)) return []
      return Array.from(new Set(v.filter((c): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)).map(c => c.toUpperCase()))).slice(0, spec.maxItems)
    }
    case 'uploads': return cleanUploads(v, spec, userId)
    case 'invites': return cleanInvites(v, spec.maxItems)
  }
}

/** Whitelists and normalises the fields that belong to one step. */
export function sanitizeStep(type: AccountType, step: number, input: unknown, userId: string | null): OnboardingData {
  const flow = FLOWS[type]
  const def = flow.steps[step - 1]
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const out: OnboardingData = {}
  if (!def) return out
  for (const key of def.fields) {
    out[key] = cleanValue(flow.fields[key], source[key], userId)
  }
  return out
}

/** Sanitises an entire stored draft (every field of every step). */
export function sanitizeAll(type: AccountType, input: unknown, userId: string | null): OnboardingData {
  return FLOWS[type].steps.reduce<OnboardingData>((acc, _s, i) => ({ ...acc, ...sanitizeStep(type, i + 1, input, userId) }), {})
}

// ── Validation ───────────────────────────────────────────────────────────────
function validateField(spec: FieldSpec, v: unknown): string | null {
  switch (spec.kind) {
    case 'text': {
      const s = typeof v === 'string' ? v.trim() : ''
      if (!s) return spec.required ? `${spec.label} is required.` : null
      if (spec.min && s.length < spec.min) return `${spec.label} must be at least ${spec.min} characters.`
      if (s.length > spec.max) return `${spec.label} must be ${spec.max} characters or fewer.`
      return null
    }
    case 'url': {
      const s = typeof v === 'string' ? v.trim() : ''
      if (!s) return spec.required ? `${spec.label} is required.` : null
      return isValidUrl(s) ? null : 'Enter a valid web address, e.g. https://example.com'
    }
    case 'enum': return typeof v === 'string' && v ? null : spec.required ? `Choose ${spec.label.toLowerCase()}.` : null
    case 'multi': return Array.isArray(v) && v.length > 0 ? null : spec.required ? `Select at least one ${spec.label.toLowerCase().replace(/s$/, '')}.` : null
    case 'colors': return Array.isArray(v) && v.length > 0 ? null : spec.required ? 'Add at least one brand colour.' : null
    case 'bool':
    case 'uploads':
    case 'invites':
      return null
  }
}

export function validateStep(type: AccountType, step: number, data: OnboardingData): FieldErrors {
  const flow = FLOWS[type]
  const def = flow.steps[step - 1]
  if (!def) return {}
  const errors: FieldErrors = {}
  for (const key of def.fields) {
    const message = validateField(flow.fields[key], data[key])
    if (message) errors[key] = message
  }
  if (def.rule) Object.assign(errors, def.rule(data))
  if (Array.isArray(data.invites)) {
    (data.invites as InviteRef[]).forEach((inv, i) => {
      if (def.fields.includes('invites') && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(inv.email)) errors[`invites.${i}`] = 'Enter a valid email address.'
    })
  }
  return errors
}

/** First step (1–4) whose required data is missing; 4 when 1–3 are valid. */
export function firstIncompleteStep(type: AccountType, data: OnboardingData): number {
  for (let s = 1; s <= 3; s++) {
    if (Object.keys(validateStep(type, s, data)).length > 0) return s
  }
  return 4
}

export function validateAll(type: AccountType, data: OnboardingData): { step: number; errors: FieldErrors } | null {
  for (let s = 1; s <= 4; s++) {
    const errors = validateStep(type, s, data)
    if (Object.keys(errors).length > 0) return { step: s, errors }
  }
  return null
}

export function completionPercent(type: AccountType, data: OnboardingData): number {
  let valid = 0
  for (let s = 1; s <= 4; s++) {
    const def = FLOWS[type].steps[s - 1]
    // A step with no required inputs (review/team) only counts once reached.
    const hasRequired = def.fields.some(f => {
      const spec = FLOWS[type].fields[f]
      return 'required' in spec && spec.required
    }) || !!def.rule
    if (!hasRequired) continue
    if (Object.keys(validateStep(type, s, data)).length === 0) valid++
  }
  const counted = FLOWS[type].steps.filter(def => def.fields.some(f => {
    const spec = FLOWS[type].fields[f]
    return 'required' in spec && spec.required
  }) || !!def.rule).length
  return counted === 0 ? 0 : Math.round((valid / counted) * 100)
}

export function optionLabel(options: Option[], value: unknown): string {
  if (typeof value !== 'string') return ''
  return options.find(o => o.value === value)?.label ?? value
}

export function workspaceNameOf(type: AccountType, data: OnboardingData): string {
  const key = { creator: 'display_name', business: 'business_name', brand: 'brand_name', agency: 'agency_name', supplier: 'company_name' }[type]
  return typeof data[key] === 'string' ? (data[key] as string) : ''
}
