import 'server-only'
import { ctr, pctChange, ppChange } from '../format'
import {
  buildBlocks, ITEM_COLUMNS, LINK_COLUMNS, mapPage, mapReusableLink, mapTheme, PAGE_COLUMNS, THEME_COLUMNS,
  type PageRecord, type ReusableLinkRecord, type ThemeRecord,
} from '../records'
import { normaliseTokens, themeAccessibilityChecks, type ThemeTokens } from '../theme'
import { continuousDaily, lastDays, previousWindow, summary, type Summary, type Window } from './analytics'
import { memberById, type LinksSession, type Member } from './context'

export type Params = Record<string, string | string[] | undefined>
export const param = (params: Params, key: string): string => {
  const value = params[key]
  return (Array.isArray(value) ? value[0] : value) ?? ''
}
const intParam = (params: Params, key: string, fallback: number, allowed?: number[]) => {
  const n = Number.parseInt(param(params, key), 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  return allowed && !allowed.includes(n) ? fallback : n
}

export type Kpi = { value: number | null; delta: number | null; deltaUnit: 'pct' | 'pp' | 'abs'; caption: string | null }

export type ActivityItem = {
  id: string; actor: Member | null; action: string; summary: string; entityType: string; entityId: string | null
  entityName: string | null; badge: string | null; createdAt: string; href: string | null
}

export type Thumb = { imageUrl: string | null; eyebrow: string; headline: string; cta: string | null; tokens: ThemeTokens }

// ------------------------------------------------------------------ shared

export async function loadActivity(session: LinksSession, opts: { entityTypes?: string[]; entityId?: string; limit?: number } = {}): Promise<ActivityItem[]> {
  let query = session.supabase.from('link_activity')
    .select('id, actor_id, entity_type, entity_id, entity_name, action, summary, meta, created_at')
    .eq('workspace_id', session.workspace.id)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 5)
  if (opts.entityTypes) query = query.in('entity_type', opts.entityTypes)
  if (opts.entityId) query = query.eq('entity_id', opts.entityId)
  const { data } = await query
  return (data ?? []).map(row => {
    const meta = (row.meta ?? {}) as Record<string, unknown>
    const entityId = row.entity_id as string | null
    const href = !entityId ? null
      : row.entity_type === 'page' || row.entity_type === 'pixel' ? `${session.basePath}/pages/${entityId}/design`
        : row.entity_type === 'reusable_link' ? `${session.basePath}/reusable-links/${entityId}`
          : row.entity_type === 'theme' ? `${session.basePath}/themes/${entityId}/editor` : null
    return {
      id: String(row.id), actor: memberById(session, row.actor_id as string | null), action: String(row.action), summary: String(row.summary),
      entityType: String(row.entity_type), entityId, entityName: row.entity_name as string | null,
      badge: typeof meta.badge === 'string' ? meta.badge : null, createdAt: String(row.created_at), href,
    }
  })
}

async function loadAllPages(session: LinksSession, includeArchived = false): Promise<PageRecord[]> {
  let query = session.supabase.from('link_pages').select(PAGE_COLUMNS).eq('workspace_id', session.workspace.id)
  if (!includeArchived) query = query.is('archived_at', null)
  const { data } = await query
  return (data ?? []).map(row => mapPage(row as Record<string, unknown>))
}

async function loadAllThemes(session: LinksSession): Promise<ThemeRecord[]> {
  const { data } = await session.supabase.from('link_themes').select(THEME_COLUMNS).eq('workspace_id', session.workspace.id)
  return (data ?? []).map(row => mapTheme(row as Record<string, unknown>))
}

/** Hero-derived card thumbnail for each page, from its real first hero block. */
async function loadThumbs(session: LinksSession, pages: PageRecord[], themes: Map<string, ThemeRecord>): Promise<Map<string, Thumb>> {
  const ids = pages.map(p => p.id)
  const thumbs = new Map<string, Thumb>()
  if (!ids.length) return thumbs
  const { data } = await session.supabase.from('link_page_items')
    .select('page_id, parent_id, item_type, title, config, sort_order, is_active')
    .in('page_id', ids).in('item_type', ['hero', 'link', 'button_stack']).order('sort_order')
  const heroes = new Map<string, Record<string, unknown>>()
  const firstLink = new Map<string, string>()
  for (const row of data ?? []) {
    if (row.item_type === 'hero' && !heroes.has(row.page_id as string)) heroes.set(row.page_id as string, (row.config ?? {}) as Record<string, unknown>)
    if (row.item_type === 'link' && row.parent_id && !firstLink.has(row.page_id as string)) firstLink.set(row.page_id as string, String(row.title ?? ''))
  }
  for (const page of pages) {
    const hero = heroes.get(page.id) ?? {}
    const theme = page.themeId ? themes.get(page.themeId) : undefined
    thumbs.set(page.id, {
      imageUrl: typeof hero.imageUrl === 'string' ? hero.imageUrl : page.ogImage,
      eyebrow: typeof hero.eyebrow === 'string' ? hero.eyebrow : '',
      headline: typeof hero.headline === 'string' && hero.headline ? hero.headline : page.title,
      cta: firstLink.get(page.id) ?? null,
      tokens: theme?.tokens ?? normaliseTokens(null),
    })
  }
  return thumbs
}

function updatedWithin(value: string, filter: string): boolean {
  const days = filter === '24h' ? 1 : filter === '7d' ? 7 : filter === '30d' ? 30 : filter === '90d' ? 90 : 0
  return !days || Date.now() - new Date(value).getTime() <= days * 86400000
}

function matchesQuery(q: string, ...fields: (string | null | undefined | string[])[]): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  return fields.some(field => Array.isArray(field) ? field.some(f => f.toLowerCase().includes(needle)) : (field ?? '').toLowerCase().includes(needle))
}

// ----------------------------------------------------------------- library

export type LibraryRow = {
  id: string; recordType: 'link_page' | 'conversion_page' | 'reusable_link'; title: string; href: string; publicUrl: string | null
  status: string; owner: Member | null; tags: string[]; clicks: number | null; ctr: number | null
  updatedAt: string; themeName: string | null; themeId: string | null; thumb: Thumb | null
}

export type GovernanceAlert = { id: string; tone: 'danger' | 'warning' | 'info'; icon: 'review' | 'broken' | 'utm' | 'domain'; title: string; detail: string; href: string }

export type LibraryData = {
  kpis: { total: Kpi; published: Kpi; conversion: Kpi; avgCtr: Kpi; clicks: Kpi; review: Kpi }
  rows: LibraryRow[]; total: number; page: number; pageSize: number
  owners: Member[]; themes: { id: string; name: string }[]
  activity: ActivityItem[]; alerts: GovernanceAlert[]
  activeFilters: number; error: string | null
}

export async function loadLibrary(session: LinksSession, params: Params): Promise<LibraryData> {
  const window = lastDays(30)
  const [allPages, themes, linksRes, current, previous, activity, domains, brokenItems] = await Promise.all([
    loadAllPages(session, true),
    loadAllThemes(session),
    session.supabase.from('reusable_links').select(LINK_COLUMNS).eq('workspace_id', session.workspace.id),
    summary(session, window),
    summary(session, previousWindow(window)),
    loadActivity(session, { entityTypes: ['page', 'reusable_link'], limit: 5 }),
    session.supabase.from('link_domains').select('id, status').eq('workspace_id', session.workspace.id),
    session.supabase.from('link_page_items').select('page_id').eq('workspace_id', session.workspace.id).in('check_status', ['broken', 'timeout', 'blocked']),
  ])
  const themeMap = new Map(themes.map(t => [t.id, t]))
  const links = (linksRes.data ?? []).map(row => mapReusableLink(row as Record<string, unknown>))
  const pages = allPages.filter(p => !p.archivedAt)
  const pageStats = new Map(current.data.pages.map(p => [p.page_id, p]))
  const linkStats = new Map(current.data.links.map(l => [l.link_id, l]))

  // KPIs
  const olderThan30 = pages.filter(p => new Date(p.createdAt).getTime() < window.from.getTime()).length
  const published = pages.filter(p => p.status === 'published' || p.status === 'scheduled').length
  const conversion = pages.filter(p => p.kind === 'conversion_page').length
  const avgCtr = ctr(current.data.totals.clicks, current.data.totals.views)
  const prevCtr = ctr(previous.data.totals.clicks, previous.data.totals.views)
  const brokenPageIds = new Set((brokenItems.data ?? []).map(r => r.page_id as string))
  const inReview = pages.filter(p => p.status === 'in_review')
  const needsReview = new Set([...inReview.map(p => p.id), ...brokenPageIds]).size
  const reviewEntered30 = activity.length >= 0
    ? (await session.supabase.from('link_activity').select('id', { count: 'exact', head: true })
      .eq('workspace_id', session.workspace.id).eq('action', 'status_changed').gte('created_at', window.from.toISOString())).count ?? 0
    : 0
  const pct = (part: number) => (pages.length ? Math.round((part / pages.length) * 100) : null)

  const kpis: LibraryData['kpis'] = {
    total: { value: pages.length, delta: olderThan30 ? pctChange(pages.length, olderThan30) : null, deltaUnit: 'pct', caption: 'vs last 30 days' },
    published: { value: published, delta: null, deltaUnit: 'pct', caption: pct(published) === null ? null : `${pct(published)}% of total` },
    conversion: { value: conversion, delta: null, deltaUnit: 'pct', caption: pct(conversion) === null ? null : `${pct(conversion)}% of total` },
    avgCtr: { value: avgCtr, delta: ppChange(avgCtr, prevCtr), deltaUnit: 'pp', caption: 'vs last 30 days' },
    clicks: { value: current.data.totals.clicks, delta: pctChange(current.data.totals.clicks, previous.data.totals.clicks), deltaUnit: 'pct', caption: 'vs last 30 days' },
    review: { value: needsReview, delta: reviewEntered30, deltaUnit: 'abs', caption: 'vs last 30 days' },
  }

  // Filters
  const q = param(params, 'q').trim()
  const type = param(params, 'type')
  const owner = param(params, 'owner')
  const status = param(params, 'status')
  const theme = param(params, 'theme')
  const updated = param(params, 'updated')
  const sort = param(params, 'sort') || 'updated'
  const pageSize = intParam(params, 'pageSize', 6, [6, 12, 24, 48])

  const rows: LibraryRow[] = []
  if (type !== 'reusable_link') {
    for (const p of allPages) {
      if (status === 'archived' ? !p.archivedAt : p.archivedAt) continue
      if (type && p.kind !== type) continue
      if (owner && p.ownerId !== owner) continue
      if (status && status !== 'archived' && p.status !== status) continue
      if (theme && p.themeId !== theme) continue
      if (updated && !updatedWithin(p.updatedAt, updated)) continue
      const t = p.themeId ? themeMap.get(p.themeId) : undefined
      if (!matchesQuery(q, p.title, p.slug, p.tags, t?.name)) continue
      const stats = pageStats.get(p.id)
      rows.push({
        id: p.id, recordType: p.kind, title: p.title, href: `${session.basePath}/pages/${p.id}/design`, publicUrl: `/l/${p.slug}`,
        status: p.status, owner: memberById(session, p.ownerId), tags: p.tags, clicks: stats?.clicks ?? 0,
        ctr: stats ? ctr(stats.clicks, stats.views) : null, updatedAt: p.updatedAt, themeName: t?.name ?? null, themeId: p.themeId, thumb: null,
      })
    }
  }
  if (!type || type === 'reusable_link') {
    for (const l of links) {
      if (status === 'archived' ? !l.archivedAt : l.archivedAt) continue
      if (!type) continue // Reusable links are listed when the Type filter selects them.
      if (owner && l.ownerId !== owner) continue
      if (status && status !== 'archived' && l.status !== status) continue
      if (theme) continue
      if (updated && !updatedWithin(l.updatedAt, updated)) continue
      if (!matchesQuery(q, l.name, l.vanitySlug, l.tags, l.destinationUrl)) continue
      rows.push({
        id: l.id, recordType: 'reusable_link', title: l.name, href: `${session.basePath}/reusable-links/${l.id}`, publicUrl: l.vanitySlug ? `/r/${l.vanitySlug}` : null,
        status: l.status, owner: memberById(session, l.ownerId), tags: l.tags, clicks: linkStats.get(l.id)?.clicks ?? 0, ctr: null,
        updatedAt: l.updatedAt, themeName: null, themeId: null, thumb: null,
      })
    }
  }

  const collator = new Intl.Collator('en-GB')
  rows.sort((a, b) => {
    switch (sort) {
      case 'clicks': return (b.clicks ?? -1) - (a.clicks ?? -1) || collator.compare(a.title, b.title)
      case 'ctr': return (b.ctr ?? -1) - (a.ctr ?? -1) || collator.compare(a.title, b.title)
      case 'name': return collator.compare(a.title, b.title)
      default: return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() || a.id.localeCompare(b.id)
    }
  })

  const total = rows.length
  const pages_ = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(intParam(params, 'page', 1), pages_)
  const slice = rows.slice((page - 1) * pageSize, page * pageSize)
  const thumbs = await loadThumbs(session, allPages.filter(p => slice.some(r => r.id === p.id)), themeMap)
  for (const row of slice) row.thumb = thumbs.get(row.id) ?? null

  const brokenReusable = links.filter(l => !l.archivedAt && ['broken', 'timeout', 'blocked'].includes(l.checkStatus)).length
  const brokenTotal = (brokenItems.data ?? []).length + brokenReusable
  const missingUtm = pages.filter(p => !p.utmTracking).length
  const badDomains = (domains.data ?? []).filter(d => d.status !== 'verified').length
  const alerts: GovernanceAlert[] = []
  if (inReview.length) alerts.push({ id: 'review', tone: 'danger', icon: 'review', title: `${inReview.length} ${inReview.length === 1 ? 'page needs' : 'pages need'} review`, detail: 'Review content or links', href: `${session.basePath}/library?status=in_review` })
  if (brokenTotal) alerts.push({ id: 'broken', tone: 'warning', icon: 'broken', title: `${brokenTotal} broken ${brokenTotal === 1 ? 'link' : 'links'} detected`, detail: 'Update or fix broken URLs', href: `${session.basePath}/library?governance=broken` })
  if (missingUtm) alerts.push({ id: 'utm', tone: 'warning', icon: 'utm', title: `${missingUtm} ${missingUtm === 1 ? 'page' : 'pages'} missing UTM`, detail: 'Add tracking parameters', href: `${session.basePath}/library?governance=utm` })
  if (badDomains) alerts.push({ id: 'domain', tone: 'danger', icon: 'domain', title: `${badDomains} unverified ${badDomains === 1 ? 'domain' : 'domains'}`, detail: 'Verify or update domain', href: `${session.basePath}/library` })

  // governance query filters narrow the row set after the fact
  const governance = param(params, 'governance')
  let finalRows = slice, finalTotal = total
  if (governance === 'broken' || governance === 'utm') {
    const keep = rows.filter(r => governance === 'broken' ? brokenPageIds.has(r.id) : allPages.find(p => p.id === r.id)?.utmTracking === false)
    finalTotal = keep.length
    finalRows = keep.slice(0, pageSize)
    const extra = await loadThumbs(session, allPages.filter(p => finalRows.some(r => r.id === p.id)), themeMap)
    for (const row of finalRows) row.thumb = extra.get(row.id) ?? null
  }

  const ownerIds = new Set([...allPages.map(p => p.ownerId), ...links.map(l => l.ownerId)])
  return {
    kpis, rows: finalRows, total: finalTotal, page, pageSize,
    owners: session.members.filter(m => ownerIds.has(m.id)),
    themes: themes.filter(t => !t.archivedAt).map(t => ({ id: t.id, name: t.name })).sort((a, b) => a.name.localeCompare(b.name)),
    activity, alerts,
    activeFilters: [q, type, owner, status, theme, updated, governance].filter(Boolean).length,
    error: current.error,
  }
}

// ------------------------------------------------------------------ themes

export type ThemeRow = ThemeRecord & { owner: Member | null; pages: number; uplift: number | null }

export type ThemesData = {
  kpis: { total: Kpi; active: Kpi; pagesUsing: Kpi; uplift: Kpi; review: Kpi; updatedWeek: Kpi }
  rows: ThemeRow[]; total: number; page: number; pageSize: number
  owners: Member[]; categories: string[]
  approvalQueue: ThemeRow[]; activity: ActivityItem[]; swatches: Record<string, ThemeTokens>
  recommendations: { id: string; tone: 'danger' | 'info' | 'success' | 'purple'; title: string; detail: string; href: string }[]
  activeFilters: number
}

export async function loadThemes(session: LinksSession, params: Params): Promise<ThemesData> {
  const window = lastDays(30)
  const [themes, pages, current, previous, activity] = await Promise.all([
    loadAllThemes(session), loadAllPages(session), summary(session, window), summary(session, previousWindow(window)),
    loadActivity(session, { entityTypes: ['theme'], limit: 5 }),
  ])

  const stats = new Map(current.data.pages.map(p => [p.page_id, p]))
  const prevStats = new Map(previous.data.pages.map(p => [p.page_id, p]))
  const workspaceCtr = ctr(current.data.totals.clicks, current.data.totals.views)
  const prevWorkspaceCtr = ctr(previous.data.totals.clicks, previous.data.totals.views)

  const upliftFor = (themeId: string, source: typeof stats, baseline: number | null) => {
    let clicks = 0, views = 0
    for (const p of pages.filter(p => p.themeId === themeId)) { clicks += source.get(p.id)?.clicks ?? 0; views += source.get(p.id)?.views ?? 0 }
    const themeCtr = ctr(clicks, views)
    return themeCtr === null || !baseline ? null : ((themeCtr - baseline) / baseline) * 100
  }

  const all: ThemeRow[] = themes.map(t => ({
    ...t, owner: memberById(session, t.ownerId),
    pages: pages.filter(p => p.themeId === t.id).length,
    uplift: upliftFor(t.id, stats, workspaceCtr),
  }))
  const live = all.filter(t => !t.archivedAt)
  const active = live.filter(t => t.status === 'active')
  const upliftValues = active.map(t => t.uplift).filter((v): v is number => v !== null)
  const prevUpliftValues = active.map(t => upliftFor(t.id, prevStats, prevWorkspaceCtr)).filter((v): v is number => v !== null)
  const avg = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  const pending = live.filter(t => t.approvalStatus === 'pending')
  const weekAgo = Date.now() - 7 * 86400000
  const updatedWeek = live.filter(t => new Date(t.updatedAt).getTime() >= weekAgo).length
  const updatedPrevWeek = live.filter(t => { const u = new Date(t.updatedAt).getTime(); return u < weekAgo && u >= weekAgo - 7 * 86400000 }).length
  const olderThan30 = live.filter(t => new Date(t.createdAt).getTime() < window.from.getTime()).length
  const pagesUsing = pages.filter(p => p.themeId).length
  const pagesUsingOlder = pages.filter(p => p.themeId && new Date(p.createdAt).getTime() < window.from.getTime()).length

  const kpis: ThemesData['kpis'] = {
    total: { value: live.length, delta: olderThan30 ? pctChange(live.length, olderThan30) : null, deltaUnit: 'pct', caption: 'vs last 30 days' },
    active: { value: active.length, delta: null, deltaUnit: 'pct', caption: live.length ? `${Math.round((active.length / live.length) * 100)}% of total` : null },
    pagesUsing: { value: pagesUsing, delta: pagesUsingOlder ? pctChange(pagesUsing, pagesUsingOlder) : null, deltaUnit: 'pct', caption: 'vs last 30 days' },
    uplift: { value: avg(upliftValues), delta: ppChange(avg(upliftValues), avg(prevUpliftValues)), deltaUnit: 'pp', caption: 'vs last 30 days' },
    review: { value: pending.length, delta: pending.filter(t => new Date(t.updatedAt).getTime() >= window.from.getTime()).length, deltaUnit: 'abs', caption: 'vs last 30 days' },
    updatedWeek: { value: updatedWeek, delta: updatedWeek - updatedPrevWeek, deltaUnit: 'abs', caption: 'vs last week' },
  }

  const q = param(params, 'q').trim()
  const category = param(params, 'category')
  const owner = param(params, 'owner')
  const status = param(params, 'status')
  const usage = param(params, 'usage')
  const updated = param(params, 'updated')
  const sort = param(params, 'sort') || 'updated'
  const pageSize = intParam(params, 'pageSize', 6, [6, 12, 24, 48])

  const filtered = all.filter(t => {
    if (status === 'archived' ? !t.archivedAt : t.archivedAt) return false
    if (status === 'review' ? t.approvalStatus !== 'pending' : status && status !== 'archived' && t.status !== status) return false
    if (category && t.category !== category) return false
    if (owner && t.ownerId !== owner) return false
    if (usage === 'used' && t.pages === 0) return false
    if (usage === 'unused' && t.pages > 0) return false
    if (updated && !updatedWithin(t.updatedAt, updated)) return false
    return matchesQuery(q, t.name, t.category, t.tags, t.description)
  })
  const collator = new Intl.Collator('en-GB')
  filtered.sort((a, b) => {
    switch (sort) {
      case 'usage': return b.pages - a.pages || collator.compare(a.name, b.name)
      case 'uplift': return (b.uplift ?? -Infinity) - (a.uplift ?? -Infinity) || collator.compare(a.name, b.name)
      case 'name': return collator.compare(a.name, b.name)
      default: return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() || a.id.localeCompare(b.id)
    }
  })
  const total = filtered.length
  const page = Math.min(intParam(params, 'page', 1), Math.max(1, Math.ceil(total / pageSize)))

  const lowUsage = active.filter(t => t.pages <= 1)
  const inactive = live.filter(t => t.status === 'draft' && t.approvalStatus !== 'pending' && t.pages === 0 && Date.now() - new Date(t.updatedAt).getTime() > 7 * 86400000)
  const failingA11y = live.filter(t => themeAccessibilityChecks(t.tokens).score < 100)
  const recommendations: ThemesData['recommendations'] = []
  if (pending.length) recommendations.push({ id: 'review', tone: 'danger', title: `${pending.length} ${pending.length === 1 ? 'theme needs' : 'themes need'} review`, detail: 'Approve to make active', href: `${session.basePath}/themes?status=review` })
  if (lowUsage.length) recommendations.push({ id: 'low', tone: 'info', title: `${lowUsage.length} ${lowUsage.length === 1 ? 'theme has' : 'themes have'} low usage`, detail: 'Optimize or promote', href: `${session.basePath}/themes?sort=usage` })
  if (inactive.length) recommendations.push({ id: 'inactive', tone: 'success', title: `${inactive.length} inactive ${inactive.length === 1 ? 'theme' : 'themes'}`, detail: 'Consider archiving', href: `${session.basePath}/themes?status=draft&usage=unused` })
  if (failingA11y.length) recommendations.push({ id: 'a11y', tone: 'purple', title: `${failingA11y.length} ${failingA11y.length === 1 ? 'theme fails' : 'themes fail'} contrast checks`, detail: 'Fix colors for accessibility', href: `${session.basePath}/themes/${failingA11y[0].id}/editor` })

  return {
    kpis, rows: filtered.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize,
    owners: session.members.filter(m => all.some(t => t.ownerId === m.id)),
    categories: [...new Set(all.map(t => t.category).filter((c): c is string => !!c))].sort(),
    approvalQueue: pending.slice(0, 4), activity, recommendations,
    swatches: Object.fromEntries(all.filter(t => activity.some(a => a.entityId === t.id)).map(t => [t.id, t.tokens])),
    activeFilters: [q, category, owner, status, usage, updated].filter(Boolean).length,
  }
}

// --------------------------------------------------------------- analytics

export const RANGE_OPTIONS = [
  { value: 'last_7', label: 'Last 7 days', days: 7 },
  { value: 'last_28', label: 'Last 28 days', days: 28 },
  { value: 'last_90', label: 'Last 90 days', days: 90 },
] as const

export type AnalyticsRow = {
  id: string; rank: number; title: string; url: string; kind: 'link_page' | 'conversion_page'; themeName: string | null
  thumb: Thumb | null; clicks: number; ctr: number | null; conversions: number; convRate: number | null; revenuePence: number
  status: 'performing' | 'stable' | 'attention'; href: string
}

export type AnalyticsData = {
  window: Window; previous: Window; rangeLabel: string; compareLabel: string
  kpis: { clicks: Kpi; uniques: Kpi; ctr: Kpi; conversions: Kpi; revenue: Kpi; dropoff: Kpi }
  revenueAllowed: boolean
  daily: Summary['daily']
  topPages: { id: string; title: string; clicks: number }[]
  devices: Summary['devices']; sources: Summary['sources']; referrers: Summary['referrers']
  funnel: { views: number; clicks: number; conversions: number; revenuePence: number }
  rows: AnalyticsRow[]; total: number; page: number; pageSize: number
  owners: Member[]; themes: { id: string; name: string }[]
  insights: { id: string; tone: 'success' | 'purple' | 'warning'; title: string; detail: string; href: string; hrefLabel: string }[]
  anomalies: { id: string; tone: 'danger' | 'warning' | 'success'; title: string; detail: string; at: string }[]
  dropoffLinks: number
  error: string | null
}

export async function loadAnalytics(session: LinksSession, params: Params): Promise<AnalyticsData> {
  const rangeKey = RANGE_OPTIONS.find(r => r.value === param(params, 'range'))?.value ?? 'last_28'
  const days = RANGE_OPTIONS.find(r => r.value === rangeKey)!.days
  const window = lastDays(days)
  const prev = previousWindow(window)
  const [pages, themes] = await Promise.all([loadAllPages(session), loadAllThemes(session)])
  const themeMap = new Map(themes.map(t => [t.id, t]))

  const owner = param(params, 'owner'), kind = param(params, 'kind'), theme = param(params, 'theme')
  const source = ['social', 'direct', 'search', 'email', 'referral'].includes(param(params, 'source')) ? param(params, 'source') : ''
  const scoped = pages.filter(p => (!owner || p.ownerId === owner) && (!kind || p.kind === kind) && (!theme || p.themeId === theme))
  const pageIds = owner || kind || theme ? scoped.map(p => p.id) : null

  const [current, previous] = await Promise.all([
    summary(session, window, { pageIds, source: source || null }),
    summary(session, prev, { pageIds, source: source || null }),
  ])
  const cur = current.data.totals, old = previous.data.totals
  const curCtr = ctr(cur.clicks, cur.views), oldCtr = ctr(old.clicks, old.views)

  // Drop-off: child links whose clicks fell by more than half vs the previous window.
  const oldItems = new Map(previous.data.items.map(i => [i.item_id, i.clicks]))
  const curItems = new Map(current.data.items.map(i => [i.item_id, i.clicks]))
  const dropoffIds = [...oldItems].filter(([id, clicks]) => clicks >= 20 && (curItems.get(id) ?? 0) < clicks * 0.5).map(([id]) => id)

  const fmtRange = (w: Window) => {
    const f = (d: Date, year: boolean) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}), timeZone: 'Europe/London' }).format(d)
    const end = new Date(w.to.getTime() - 1)
    return `${f(w.from, false)} – ${f(end, true)}`
  }
  const revenueAllowed = session.capabilities['analytics.revenue']

  const statsById = new Map(current.data.pages.map(p => [p.page_id, p]))
  const ranked = scoped
    .map(p => ({ page: p, stats: statsById.get(p.id) }))
    .filter(entry => entry.stats && entry.stats.clicks > 0)
    .sort((a, b) => (b.stats!.clicks - a.stats!.clicks) || a.page.title.localeCompare(b.page.title))

  const pageSize = intParam(params, 'pageSize', 5, [5, 10, 25])
  const total = ranked.length
  const page = Math.min(intParam(params, 'page', 1), Math.max(1, Math.ceil(total / pageSize)))
  const sliceEntries = ranked.slice((page - 1) * pageSize, page * pageSize)
  const thumbs = await loadThumbs(session, sliceEntries.map(e => e.page), themeMap)
  const rows: AnalyticsRow[] = sliceEntries.map((entry, i) => {
    const s = entry.stats!
    const rowCtr = ctr(s.clicks, s.views)
    const status: AnalyticsRow['status'] = rowCtr === null || curCtr === null ? 'stable'
      : rowCtr >= curCtr * 1.2 ? 'performing' : rowCtr < curCtr * 0.7 ? 'attention' : 'stable'
    return {
      id: entry.page.id, rank: (page - 1) * pageSize + i + 1, title: entry.page.title, url: `/l/${entry.page.slug}`, kind: entry.page.kind,
      themeName: entry.page.themeId ? themeMap.get(entry.page.themeId)?.name ?? null : null, thumb: thumbs.get(entry.page.id) ?? null,
      clicks: s.clicks, ctr: rowCtr, conversions: s.conversions, convRate: s.clicks ? (s.conversions / s.clicks) * 100 : null,
      revenuePence: s.revenue_pence, status, href: `${session.basePath}/pages/${entry.page.id}/analytics`,
    }
  })

  const insights: AnalyticsData['insights'] = []
  const clickDelta = pctChange(cur.clicks, old.clicks)
  if (clickDelta !== null) insights.push({ id: 'clicks', tone: 'success', title: `Clicks are ${clickDelta >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(clickDelta))}%`, detail: `Total clicks ${clickDelta >= 0 ? 'increased' : 'decreased'} by ${Math.abs(Math.round(clickDelta))}% compared to ${fmtRange(prev)}.`, href: '#clicks-chart', hrefLabel: 'View trend' })
  if (ranked[0]) {
    const s = ranked[0].stats!
    insights.push({ id: 'top', tone: 'purple', title: `${ranked[0].page.title} drives results`, detail: `It's your top page by clicks and conversions with a CTR of ${(ctr(s.clicks, s.views) ?? 0).toFixed(2)}%.`, href: `${session.basePath}/pages/${ranked[0].page.id}/analytics`, hrefLabel: 'View page' })
  }
  if (dropoffIds.length) insights.push({ id: 'dropoff', tone: 'warning', title: 'Drop-off detected', detail: `${dropoffIds.length} ${dropoffIds.length === 1 ? 'link has' : 'links have'} lost more than half their clicks since the previous period.`, href: `${session.basePath}/library?governance=broken`, hrefLabel: 'View affected links' })

  const prevStats = new Map(previous.data.pages.map(p => [p.page_id, p]))
  const anomalies: AnalyticsData['anomalies'] = []
  for (const { page: p, stats: s } of ranked) {
    const before = prevStats.get(p.id)
    if (!before || !s) continue
    const nowCtr = ctr(s.clicks, s.views), thenCtr = ctr(before.clicks, before.views)
    if (nowCtr !== null && thenCtr && nowCtr < thenCtr * 0.75) anomalies.push({ id: `ctr-${p.id}`, tone: 'danger', title: `CTR dropped on ${p.title}`, detail: `CTR down ${Math.round((1 - nowCtr / thenCtr) * 100)}% vs previous period`, at: p.updatedAt })
    const clickChange = pctChange(s.clicks, before.clicks)
    if (clickChange !== null && clickChange > 40) anomalies.push({ id: `spike-${p.id}`, tone: 'warning', title: `Spike in clicks on ${p.title}`, detail: `Clicks up ${Math.round(clickChange)}% vs previous period`, at: p.updatedAt })
  }
  const revenueChange = pctChange(cur.revenue_pence, old.revenue_pence)
  if (revenueAllowed && revenueChange !== null && Math.abs(revenueChange) >= 5) anomalies.push({ id: 'revenue', tone: revenueChange > 0 ? 'success' : 'danger', title: `Revenue influenced ${revenueChange > 0 ? 'up' : 'down'} ${Math.abs(Math.round(revenueChange))}%`, detail: `Compared to ${fmtRange(prev)}`, at: new Date().toISOString() })

  return {
    window, previous: prev, rangeLabel: fmtRange(window), compareLabel: fmtRange(prev),
    kpis: {
      clicks: { value: cur.clicks, delta: pctChange(cur.clicks, old.clicks), deltaUnit: 'pct', caption: `vs ${fmtRange(prev)}` },
      uniques: { value: cur.uniques, delta: pctChange(cur.uniques, old.uniques), deltaUnit: 'pct', caption: `vs ${fmtRange(prev)}` },
      ctr: { value: curCtr, delta: ppChange(curCtr, oldCtr), deltaUnit: 'pp', caption: `vs ${fmtRange(prev)}` },
      conversions: { value: cur.conversions, delta: pctChange(cur.conversions, old.conversions), deltaUnit: 'pct', caption: `vs ${fmtRange(prev)}` },
      revenue: { value: revenueAllowed ? cur.revenue_pence : null, delta: revenueAllowed ? pctChange(cur.revenue_pence, old.revenue_pence) : null, deltaUnit: 'pct', caption: `vs ${fmtRange(prev)}` },
      dropoff: { value: dropoffIds.length, delta: null, deltaUnit: 'abs', caption: `vs ${fmtRange(prev)}` },
    },
    revenueAllowed,
    daily: continuousDaily(current.data.daily, window),
    topPages: ranked.slice(0, 5).map(e => ({ id: e.page.id, title: e.page.title, clicks: e.stats!.clicks })),
    devices: current.data.devices, sources: current.data.sources, referrers: current.data.referrers.slice(0, 5),
    funnel: { views: cur.views, clicks: cur.clicks, conversions: cur.conversions, revenuePence: cur.revenue_pence },
    rows, total, page, pageSize,
    owners: session.members.filter(m => pages.some(p => p.ownerId === m.id)),
    themes: themes.filter(t => !t.archivedAt).map(t => ({ id: t.id, name: t.name })).sort((a, b) => a.name.localeCompare(b.name)),
    insights, anomalies: anomalies.slice(0, 3), dropoffLinks: dropoffIds.length,
    error: current.error,
  }
}

export { buildBlocks, ITEM_COLUMNS, type ReusableLinkRecord }
