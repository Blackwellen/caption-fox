// Record shapes shared by the management UI, the server loaders and the
// public renderer. Mappers turn raw Supabase rows into these, applying the
// normalisers so no component ever sees an unvalidated JSON blob.

import { isBlockType, type BlockType } from './blocks'
import { normaliseTokens, type ThemeTokens } from './theme'

export type PageStatus = 'draft' | 'in_review' | 'scheduled' | 'published' | 'unpublished' | 'archived'
export type PageKind = 'link_page' | 'conversion_page'

export type ChildLink = {
  id: string; title: string; url: string | null; icon: string | null; isActive: boolean; sortOrder: number
  reusableLinkId: string | null; checkStatus: string; checkedAt: string | null
  scheduleStart: string | null; scheduleEnd: string | null
}

export type Block = {
  id: string; type: BlockType; title: string | null; description: string | null
  config: Record<string, unknown>; isActive: boolean; sortOrder: number; children: ChildLink[]
}

export type PageRecord = {
  id: string; slug: string; title: string; description: string | null; avatarUrl: string | null
  kind: PageKind; goal: string | null; status: PageStatus; approvalStatus: string
  themeId: string | null; ownerId: string | null; tags: string[]; domainId: string | null; campaignId: string | null
  publishedAt: string | null; publishedVersion: number | null; currentVersion: number
  createdAt: string; updatedAt: string; updatedBy: string | null; archivedAt: string | null
  legal: { privacyUrl?: string | null; termsUrl?: string | null; disclosure?: string | null }
  consent: { banner?: boolean }
  utmTracking: boolean; indexInSearch: boolean; visibility: 'public' | 'private' | 'password'
  seoTitle: string | null; seoDescription: string | null; ogImage: string | null; faviconUrl: string | null
  scheduledPublishAt: string | null; scheduledUnpublishAt: string | null; publishTimezone: string
  showBranding: boolean
}

export type ThemeRecord = {
  id: string; name: string; category: string | null; tags: string[]; ownerId: string | null
  status: 'draft' | 'active' | 'archived'; approvalStatus: string; tokens: ThemeTokens
  description: string | null; audience: string; usageRules: Record<string, boolean>
  brandKitId: string | null; visibility: 'private' | 'team'; publishedVersion: number | null
  notes: string | null; createdAt: string; updatedAt: string; updatedBy: string | null; archivedAt: string | null
}

export type ReusableLinkRecord = {
  id: string; name: string; destinationUrl: string; vanitySlug: string | null; label: string | null; icon: string | null
  utm: Record<string, string>; status: string; redirectType: number; openBehaviour: string
  rules: unknown; fallbackUrl: string | null; timezone: string; cacheSeconds: number; cloaking: boolean
  campaignId: string | null; usableIn: string[]; ownerId: string | null; tags: string[]
  scheduledStart: string | null; scheduledEnd: string | null; lastUsedAt: string | null
  checkStatus: string; checkedAt: string | null; currentVersion: number; clickCount: number
  createdAt: string; updatedAt: string; updatedBy: string | null; archivedAt: string | null
}

type Row = Record<string, unknown>
const s = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {})

export const PAGE_COLUMNS = 'id, slug, title, description, avatar_url, page_kind, goal, status, approval_status, theme_id, owner_id, tags, domain_id, campaign_id, published_at, published_version, current_version, created_at, updated_at, updated_by, archived_at, legal, consent, utm_tracking, index_in_search, visibility, seo_title, seo_description, og_image, favicon_url, scheduled_publish_at, scheduled_unpublish_at, publish_timezone, show_caption_fox_branding'

export function mapPage(row: Row): PageRecord {
  return {
    id: String(row.id), slug: String(row.slug), title: String(row.title ?? ''), description: s(row.description), avatarUrl: s(row.avatar_url),
    kind: row.page_kind === 'conversion_page' ? 'conversion_page' : 'link_page', goal: s(row.goal),
    status: (s(row.status) ?? 'draft') as PageStatus, approvalStatus: s(row.approval_status) ?? 'none',
    themeId: s(row.theme_id), ownerId: s(row.owner_id), tags: arr(row.tags), domainId: s(row.domain_id), campaignId: s(row.campaign_id),
    publishedAt: s(row.published_at), publishedVersion: typeof row.published_version === 'number' ? row.published_version : null,
    currentVersion: Number(row.current_version ?? 1), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    updatedBy: s(row.updated_by), archivedAt: s(row.archived_at),
    legal: obj(row.legal) as PageRecord['legal'], consent: obj(row.consent) as PageRecord['consent'],
    utmTracking: row.utm_tracking !== false, indexInSearch: row.index_in_search !== false,
    visibility: (s(row.visibility) ?? 'public') as PageRecord['visibility'],
    seoTitle: s(row.seo_title), seoDescription: s(row.seo_description), ogImage: s(row.og_image), faviconUrl: s(row.favicon_url),
    scheduledPublishAt: s(row.scheduled_publish_at), scheduledUnpublishAt: s(row.scheduled_unpublish_at),
    publishTimezone: s(row.publish_timezone) ?? 'Europe/London', showBranding: row.show_caption_fox_branding !== false,
  }
}

export const THEME_COLUMNS = 'id, name, category, tags, owner_id, status, approval_status, tokens, description, audience, usage_rules, brand_kit_id, visibility, published_version, notes, created_at, updated_at, updated_by, archived_at'

export function mapTheme(row: Row): ThemeRecord {
  return {
    id: String(row.id), name: String(row.name ?? ''), category: s(row.category), tags: arr(row.tags), ownerId: s(row.owner_id),
    status: (s(row.status) ?? 'draft') as ThemeRecord['status'], approvalStatus: s(row.approval_status) ?? 'none',
    tokens: normaliseTokens(row.tokens), description: s(row.description), audience: s(row.audience) ?? 'all',
    usageRules: obj(row.usage_rules) as Record<string, boolean>, brandKitId: s(row.brand_kit_id),
    visibility: row.visibility === 'private' ? 'private' : 'team',
    publishedVersion: typeof row.published_version === 'number' ? row.published_version : null,
    notes: s(row.notes), createdAt: String(row.created_at), updatedAt: String(row.updated_at), updatedBy: s(row.updated_by), archivedAt: s(row.archived_at),
  }
}

export const LINK_COLUMNS = 'id, name, destination_url, vanity_slug, label, icon, utm, status, redirect_type, open_behaviour, rules, fallback_url, timezone, cache_seconds, cloaking, campaign_id, usable_in, owner_id, tags, scheduled_start, scheduled_end, last_used_at, check_status, checked_at, current_version, click_count, created_at, updated_at, updated_by, archived_at'

export function mapReusableLink(row: Row): ReusableLinkRecord {
  return {
    id: String(row.id), name: String(row.name ?? ''), destinationUrl: String(row.destination_url ?? ''), vanitySlug: s(row.vanity_slug),
    label: s(row.label), icon: s(row.icon), utm: obj(row.utm) as Record<string, string>, status: s(row.status) ?? 'draft',
    redirectType: Number(row.redirect_type ?? 302), openBehaviour: s(row.open_behaviour) ?? 'same_tab', rules: row.rules,
    fallbackUrl: s(row.fallback_url), timezone: s(row.timezone) ?? 'Europe/London', cacheSeconds: Number(row.cache_seconds ?? 300),
    cloaking: row.cloaking === true, campaignId: s(row.campaign_id), usableIn: arr(row.usable_in), ownerId: s(row.owner_id), tags: arr(row.tags),
    scheduledStart: s(row.scheduled_start), scheduledEnd: s(row.scheduled_end), lastUsedAt: s(row.last_used_at),
    checkStatus: s(row.check_status) ?? 'unknown', checkedAt: s(row.checked_at), currentVersion: Number(row.current_version ?? 1),
    clickCount: Number(row.click_count ?? 0), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    updatedBy: s(row.updated_by), archivedAt: s(row.archived_at),
  }
}

export const ITEM_COLUMNS = 'id, page_id, parent_id, item_type, title, description, url, icon, config, is_active, sort_order, reusable_link_id, check_status, checked_at, schedule_start, schedule_end'

/** Builds the ordered block tree from flat link_page_items rows. */
export function buildBlocks(rows: Row[]): Block[] {
  const blocks: Block[] = []
  const children = new Map<string, ChildLink[]>()
  for (const row of rows) {
    if (row.parent_id) {
      const list = children.get(String(row.parent_id)) ?? []
      list.push({
        id: String(row.id), title: String(row.title ?? ''), url: s(row.url), icon: s(row.icon), isActive: row.is_active !== false,
        sortOrder: Number(row.sort_order ?? 0), reusableLinkId: s(row.reusable_link_id),
        checkStatus: s(row.check_status) ?? 'unknown', checkedAt: s(row.checked_at),
        scheduleStart: s(row.schedule_start), scheduleEnd: s(row.schedule_end),
      })
      children.set(String(row.parent_id), list)
    }
  }
  for (const row of rows) {
    if (row.parent_id) continue
    // Legacy core-increment rows (link/header/...) at the top level become a
    // text/link-list block so old pages still render.
    let type: BlockType = isBlockType(row.item_type) ? row.item_type : 'text'
    let blockChildren = children.get(String(row.id)) ?? []
    if (row.item_type === 'link') {
      type = 'links'
      blockChildren = [{ id: String(row.id), title: String(row.title ?? ''), url: s(row.url), icon: s(row.icon), isActive: row.is_active !== false, sortOrder: 0, reusableLinkId: s(row.reusable_link_id), checkStatus: s(row.check_status) ?? 'unknown', checkedAt: s(row.checked_at), scheduleStart: null, scheduleEnd: null }]
    }
    blocks.push({
      id: String(row.id), type, title: s(row.title), description: s(row.description),
      config: row.item_type === 'header' || row.item_type === 'text' ? { body: row.title, ...obj(row.config) } : obj(row.config),
      isActive: row.is_active !== false, sortOrder: Number(row.sort_order ?? 0),
      children: blockChildren.sort((a, b) => a.sortOrder - b.sortOrder),
    })
  }
  return blocks.sort((a, b) => a.sortOrder - b.sortOrder)
}

/** Everything the renderer needs; contains no internal/workspace data. */
export type RenderModel = {
  title: string
  description: string | null
  kind: PageKind
  tokens: ThemeTokens
  blocks: Block[]
  legal: PageRecord['legal']
  showBranding: boolean
}

export function toRenderModel(page: Pick<PageRecord, 'title' | 'description' | 'kind' | 'legal' | 'showBranding'>, blocks: Block[], tokens: ThemeTokens, now = new Date()): RenderModel {
  const live = (start: string | null, end: string | null) =>
    (!start || new Date(start) <= now) && (!end || new Date(end) > now)
  return {
    title: page.title, description: page.description, kind: page.kind, tokens, legal: page.legal, showBranding: page.showBranding,
    blocks: blocks.filter(b => b.isActive).map(b => ({ ...b, children: b.children.filter(c => c.isActive && live(c.scheduleStart, c.scheduleEnd)) })),
  }
}

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', in_review: 'Review', scheduled: 'Scheduled', published: 'Published', unpublished: 'Unpublished', archived: 'Archived',
  active: 'Active', paused: 'Paused', expired: 'Expired',
}
