// Row shapes for the Studio surfaces. Each interface mirrors only the columns
// the corresponding `select` actually asks for, so a schema change that breaks
// a page fails at compile time rather than rendering `undefined`.

export interface PersonLite {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
}

export interface KpiValue {
  id: string
  label: string
  value: string
  hint?: string
  trend?: 'up' | 'down' | 'flat'
  tone: 'blue' | 'green' | 'amber' | 'violet' | 'red' | 'slate'
  icon: string
  href?: string
}

// ── Content ──────────────────────────────────────────────────────────────────

export interface ContentRow {
  id: string
  workspace_id: string
  title: string | null
  internal_title: string | null
  caption: string | null
  hashtags: string[] | null
  platforms: string[] | null
  post_type: string | null
  status: string
  scheduled_at: string | null
  published_at: string | null
  thumbnail_url: string | null
  media_urls: string[] | null
  tags: string[] | null
  tone: string | null
  cta_label: string | null
  cta_url: string | null
  utm_enabled: boolean | null
  utm_params: Record<string, unknown> | null
  quality_score: number | null
  quality_checks: Record<string, unknown> | null
  source: string | null
  template_id: string | null
  idea_id: string | null
  repurposed_from: string | null
  campaign_id: string | null
  brand_id: string | null
  engagement: Record<string, number> | null
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  campaign?: { id: string; name: string } | null
}

export interface ContentPage {
  rows: ContentRow[]
  total: number
  error: string | null
}

export interface ContentCounts {
  total: number
  draft: number
  pending_approval: number
  approved: number
  scheduled: number
  published: number
  failed: number
  archived: number
  scheduledThisWeek: number
  linkedAssets: number
  error: string | null
}

export interface ContentVersionRow {
  id: string
  version_number: number
  caption: string | null
  hashtags: string[] | null
  platforms: string[] | null
  status: string | null
  change_note: string | null
  created_at: string
  author?: PersonLite | null
}

export interface ContentCommentRow {
  id: string
  body: string
  parent_id: string | null
  created_at: string
  author?: PersonLite | null
}

// ── Ideas ────────────────────────────────────────────────────────────────────

export interface IdeaRow {
  id: string
  title: string
  description: string | null
  platforms: string[] | null
  status: string
  stage: string
  score: number | null
  source: string | null
  tags: string[] | null
  why_it_works: string[] | null
  next_step: string | null
  featured: boolean | null
  ai_generated: boolean | null
  collection_id: string | null
  converted_to_post_id: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  collection?: { id: string; name: string; colour: string } | null
}

export interface IdeaPage {
  rows: IdeaRow[]
  total: number
  error: string | null
}

export interface IdeaCollectionRow {
  id: string
  name: string
  description: string | null
  colour: string
  idea_count?: number
}

export interface IdeaCounts {
  total: number
  byStage: Record<string, number>
  newLast7: number
  savedInspirations: number
  converted: number
  error: string | null
}

// ── Templates ────────────────────────────────────────────────────────────────

export interface TemplateRow {
  id: string
  name: string
  description: string | null
  caption_template: string | null
  platforms: string[] | null
  channel: string | null
  category: string | null
  post_type: string | null
  hashtags: string[] | null
  tags: string[] | null
  variables: unknown
  status: string
  cover_url: string | null
  usage_count: number
  brand_approved: boolean
  is_global: boolean
  approved_at: string | null
  review_note: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  favourite?: boolean
}

export interface TemplatePage {
  rows: TemplateRow[]
  total: number
  error: string | null
}

export interface TemplateCounts {
  total: number
  published: number
  brandApproved: number
  needsReview: number
  savedThisMonth: number
  mostUsed: { id: string; name: string; usage_count: number } | null
  error: string | null
}

export interface TemplateUsagePoint {
  date: string
  uses: number
}

// ── Hashtags & keywords ──────────────────────────────────────────────────────

export interface KeywordSetRow {
  id: string
  name: string
  description: string | null
  kind: string
  status: string
  platform: string | null
  topic: string | null
  language: string
  region: string | null
  icon: string | null
  hashtags: string[]
  relevance_score: number | null
  avg_volume: number | null
  competition: number | null
  growth_30d: number | null
  favourite: boolean
  avg_reach: number | null
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  term_count?: number
}

export interface KeywordSetPage {
  rows: KeywordSetRow[]
  total: number
  error: string | null
}

export interface KeywordTermRow {
  id: string
  set_id: string
  term: string
  kind: string
  avg_volume: number | null
  competition: number | null
  growth_30d: number | null
  relevance: number | null
  source: string
}

export interface BlockedTermRow {
  id: string
  term: string
  reason: string | null
  created_at: string
}

export interface KeywordCounts {
  activeClusters: number
  hashtagSets: number
  recommendedHashtags: number
  trendingTerms: number
  savedGroups: number
  blockedTerms: number
  avgGrowth: number | null
  error: string | null
}

// ── Media ────────────────────────────────────────────────────────────────────

export interface MediaRow {
  id: string
  file_name: string
  file_path: string
  file_url: string
  file_type: string
  mime_type: string | null
  file_size: number | null
  width: number | null
  height: number | null
  duration_seconds: number | null
  tags: string[] | null
  alt_text: string | null
  description: string | null
  status: string
  colour_profile: string | null
  usage_count: number
  version: number
  collection_id: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  collection?: { id: string; name: string } | null
}

export interface MediaPage {
  rows: MediaRow[]
  total: number
  error: string | null
}

export interface MediaCollectionRow {
  id: string
  name: string
  description: string | null
  kind: string
  asset_count: number
}

export interface MediaCounts {
  total: number
  newUploads: number
  ready: number
  needsReview: number
  storageBytes: number
  linked: number
  error: string | null
}

export interface AssetVersionRow {
  id: string
  version: number
  file_url: string
  file_size: number | null
  note: string | null
  created_at: string
  author?: PersonLite | null
}

// ── AI Generate ──────────────────────────────────────────────────────────────

export interface AiOutputRow {
  id: string
  type: string
  prompt: string | null
  output: string | null
  channel: string | null
  platform: string | null
  tone: string | null
  objective: string | null
  audience: string | null
  model: string | null
  topic: string | null
  word_count: number | null
  match_score: number | null
  bookmarked: boolean
  status: string
  used_content_id: string | null
  batch_id: string | null
  prompt_tokens: number | null
  completion_tokens: number | null
  created_at: string
  author?: PersonLite | null
}

export interface AiOutputPage {
  rows: AiOutputRow[]
  total: number
  error: string | null
}

export interface PromptRow {
  id: string
  name: string
  prompt: string
  channel: string | null
  tone: string | null
  objective: string | null
  audience: string | null
  usage_count: number
  created_at: string
  updated_at: string
}

export interface AiCounts {
  generationsToday: number
  generationsYesterday: number
  savedOutputs: number
  regenerationRate: number
  promptTemplates: number
  accepted: number
  acceptedRate: number
  creditsUsed: number
  creditsLimit: number
  error: string | null
}

// ── Activity ─────────────────────────────────────────────────────────────────

export interface ActivityRow {
  id: string
  entity_type: string
  entity_id: string | null
  action: string
  summary: string
  link: string | null
  created_at: string
  actor?: PersonLite | null
}
