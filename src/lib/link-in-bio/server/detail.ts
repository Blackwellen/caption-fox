import 'server-only'
import { cache } from 'react'
import { ctr, pctChange, ppChange } from '../format'
import { evaluateGovernance, type GovernanceCheck } from '../governance'
import {
  buildBlocks, ITEM_COLUMNS, LINK_COLUMNS, mapPage, mapReusableLink, mapTheme, PAGE_COLUMNS, THEME_COLUMNS,
  type Block, type PageRecord, type ReusableLinkRecord, type ThemeRecord,
} from '../records'
import { normaliseTokens, themeAccessibilityChecks, type ThemeCheck } from '../theme'
import { continuousDaily, lastDays, previousWindow, summary, type Summary } from './analytics'
import { loadActivity, type ActivityItem } from './collections'
import { memberById, type LinksSession, type Member } from './context'

export type VersionRow = { version: number; label: string; createdAt: string; by: Member | null; changes: string; status: string; published: boolean }

export type RelatedRecord = { id: string; name: string; kind: string; status: string; href: string; imageUrl: string | null }

export type PageDetail = {
  page: PageRecord
  owner: Member | null
  updatedBy: Member | null
  blocks: Block[]
  theme: ThemeRecord | null
  themes: { id: string; name: string; status: string }[]
  domain: { id: string; hostname: string; status: string; token: string; lastError: string | null } | null
  domains: { id: string; hostname: string; status: string }[]
  pixels: { provider: string; pixelId: string; consentCategory: string; enabled: boolean; approvalStatus: string; lastEventAt: string | null }[]
  versions: VersionRow[]
  activity: ActivityItem[]
  governance: { checks: GovernanceCheck[]; passed: boolean; failing: number }
  stats: { clicks: number; clicksDelta: number | null; ctr: number | null; ctrDelta: number | null; views: number; conversions: number; uniques: number; revenuePence: number }
  analytics: Summary & { dailyFilled: Summary['daily'] }
  prevAnalytics: Summary
  related: RelatedRecord[]
  products: { id: string; name: string; status: string }[]
  forms: { id: string; name: string; status: string; submissions: number }[]
  campaigns: { id: string; name: string }[]
  reusableLinks: { id: string; name: string; slug: string | null; destination: string }[]
  publicPath: string
  publicHost: string | null
  recommendation: { title: string; detail: string; href: string; cta: string } | null
}

export const loadPageDetail = cache(async (session: LinksSession, pageId: string): Promise<PageDetail | null> => {
  const { supabase } = session
  const { data: row } = await supabase.from('link_pages').select(PAGE_COLUMNS).eq('id', pageId).eq('workspace_id', session.workspace.id).maybeSingle()
  if (!row) return null
  const page = mapPage(row as Record<string, unknown>)
  const window = lastDays(30)

  const [items, themeRows, domainRows, pixelRows, versionRows, activity, current, previous, products, formRows, campaigns, links] = await Promise.all([
    supabase.from('link_page_items').select(ITEM_COLUMNS).eq('page_id', page.id),
    supabase.from('link_themes').select(THEME_COLUMNS).eq('workspace_id', session.workspace.id).is('archived_at', null),
    supabase.from('link_domains').select('id, hostname, status, verification_token, last_error').eq('workspace_id', session.workspace.id),
    supabase.from('link_page_pixels').select('provider, pixel_id, consent_category, enabled, approval_status, last_event_at').eq('page_id', page.id),
    supabase.from('link_page_versions').select('version, created_at, created_by, change_summary, status, published').eq('page_id', page.id).order('version', { ascending: false }).limit(50),
    loadActivity(session, { entityId: page.id, limit: 20 }),
    summary(session, window, { pageIds: [page.id] }),
    summary(session, previousWindow(window), { pageIds: [page.id] }),
    supabase.from('products').select('id, name, status').eq('workspace_id', session.workspace.id).is('archived_at', null).order('name').limit(200),
    supabase.from('web_forms').select('id, name, status, submissions_count').eq('workspace_id', session.workspace.id).is('archived_at', null).order('name').limit(200),
    supabase.from('campaigns').select('id, name').eq('workspace_id', session.workspace.id).is('archived_at', null).order('updated_at', { ascending: false }).limit(100),
    supabase.from('reusable_links').select('id, name, vanity_slug, destination_url').eq('workspace_id', session.workspace.id).is('archived_at', null).order('name').limit(500),
  ])

  const blocks = buildBlocks((items.data ?? []) as Record<string, unknown>[])
  const themes = (themeRows.data ?? []).map(t => mapTheme(t as Record<string, unknown>))
  const theme = page.themeId ? themes.find(t => t.id === page.themeId) ?? null : null
  const domainRow = page.domainId ? (domainRows.data ?? []).find(d => d.id === page.domainId) : undefined
  const pixels = (pixelRows.data ?? []).map(p => ({ provider: String(p.provider), pixelId: String(p.pixel_id), consentCategory: String(p.consent_category), enabled: !!p.enabled, approvalStatus: String(p.approval_status), lastEventAt: p.last_event_at as string | null }))
  const forms = (formRows.data ?? []).map(f => ({ id: String(f.id), name: String(f.name), status: String(f.status), submissions: Number(f.submissions_count ?? 0) }))
  const formBlocks = blocks.filter(b => b.type === 'form' && b.isActive)

  const governance = evaluateGovernance({
    status: page.status, approvalStatus: page.approvalStatus,
    theme: theme ? { status: theme.status, tokens: theme.tokens } : null,
    legal: page.legal, consent: page.consent,
    domain: domainRow ? { status: domainRow.status as 'pending' | 'verified' | 'failed' } : null,
    pixels: pixels.map(p => ({ approvalStatus: p.approvalStatus, enabled: p.enabled })),
    links: blocks.flatMap(b => b.isActive ? b.children.map(c => ({ url: c.url, checkStatus: c.checkStatus, isActive: c.isActive })) : []),
    hasForm: formBlocks.length > 0,
    formConsentText: formBlocks.every(f => typeof f.config.consentText === 'string' && (f.config.consentText as string).trim().length > 0),
    utmTracking: page.utmTracking, hasTitle: !!page.title.trim(),
  })

  const cur = current.data.totals, old = previous.data.totals
  const curCtr = ctr(cur.clicks, cur.views), oldCtr = ctr(old.clicks, old.views)

  const related: RelatedRecord[] = []
  const campaign = page.campaignId ? (campaigns.data ?? []).find(c => c.id === page.campaignId) : undefined
  if (page.campaignId) {
    const { data: c } = await supabase.from('campaigns').select('id, name, status, thumbnail_url').eq('id', page.campaignId).maybeSingle()
    if (c) related.push({ id: String(c.id), name: String(c.name), kind: 'Campaign', status: String(c.status ?? 'active'), href: `/${session.workspaceType}/campaigns/${c.id}`, imageUrl: (c.thumbnail_url as string | null) ?? null })
  }
  for (const block of blocks) {
    const productId = typeof block.config.productId === 'string' ? block.config.productId : null
    const product = productId ? (products.data ?? []).find(p => p.id === productId) : undefined
    if (product && !related.some(r => r.id === product.id)) related.push({ id: String(product.id), name: String(product.name), kind: 'Product', status: String(product.status ?? 'active'), href: `/${session.workspaceType}/brand/products/${product.id}`, imageUrl: typeof block.config.imageUrl === 'string' ? block.config.imageUrl : null })
    const formId = typeof block.config.formId === 'string' ? block.config.formId : null
    const form = formId ? forms.find(f => f.id === formId) : undefined
    if (form && !related.some(r => r.id === form.id)) related.push({ id: form.id, name: form.name, kind: 'Form', status: form.status, href: `/app/web/forms/${form.id}`, imageUrl: null })
  }
  void campaign

  const versions: VersionRow[] = (versionRows.data ?? []).map(v => ({
    version: Number(v.version), label: `v${v.version}`, createdAt: String(v.created_at), by: memberById(session, v.created_by as string | null),
    changes: String(v.change_summary ?? ''), status: v.published ? 'published' : String(v.status), published: !!v.published,
  }))

  const brokenLinks = blocks.flatMap(b => b.children).filter(c => ['broken', 'timeout', 'blocked'].includes(c.checkStatus)).length
  let recommendation: PageDetail['recommendation'] = null
  const base = `${session.basePath}/pages/${page.id}`
  const failing = governance.checks.find(c => c.status === 'failed')
  if (brokenLinks) recommendation = { title: `Fix ${brokenLinks} broken ${brokenLinks === 1 ? 'link' : 'links'}`, detail: 'Broken links lower trust and CTR', href: `${base}/links?filter=broken`, cta: 'Fix links' }
  else if (failing && failing.action) recommendation = { title: failing.action.label, detail: failing.detail, href: `${base}/${failing.action.tab}`, cta: 'Resolve' }
  else if (pixels.length === 0 && session.capabilities['pixels.manage']) recommendation = { title: 'Add a tracking pixel', detail: 'Measure conversions from paid social', href: `${base}/pixels`, cta: 'Add pixel' }
  else if (curCtr !== null && oldCtr !== null && curCtr < oldCtr) recommendation = { title: 'Review link order', detail: `CTR is down ${(oldCtr - curCtr).toFixed(2)}pp vs last 30 days`, href: `${base}/analytics`, cta: 'View analytics' }
  else if (page.status === 'draft') recommendation = { title: 'Publish this page', detail: 'Visitors cannot see drafts', href: `${base}/versions`, cta: 'Review' }

  return {
    page, owner: memberById(session, page.ownerId), updatedBy: memberById(session, page.updatedBy),
    blocks, theme, themes: themes.map(t => ({ id: t.id, name: t.name, status: t.status })),
    domain: domainRow ? { id: String(domainRow.id), hostname: String(domainRow.hostname), status: String(domainRow.status), token: String(domainRow.verification_token), lastError: domainRow.last_error as string | null } : null,
    domains: (domainRows.data ?? []).map(d => ({ id: String(d.id), hostname: String(d.hostname), status: String(d.status) })),
    pixels, versions, activity, governance,
    stats: { clicks: cur.clicks, clicksDelta: pctChange(cur.clicks, old.clicks), ctr: curCtr, ctrDelta: ppChange(curCtr, oldCtr), views: cur.views, conversions: cur.conversions, uniques: cur.uniques, revenuePence: cur.revenue_pence },
    analytics: { ...current.data, dailyFilled: continuousDaily(current.data.daily, window) }, prevAnalytics: previous.data,
    related,
    products: (products.data ?? []).map(p => ({ id: String(p.id), name: String(p.name), status: String(p.status ?? '') })),
    forms, campaigns: (campaigns.data ?? []).map(c => ({ id: String(c.id), name: String(c.name) })),
    reusableLinks: (links.data ?? []).map(l => ({ id: String(l.id), name: String(l.name), slug: l.vanity_slug as string | null, destination: String(l.destination_url) })),
    publicPath: `/l/${page.slug}`,
    publicHost: domainRow && domainRow.status === 'verified' ? String(domainRow.hostname) : null,
    recommendation,
  }
})

// ---------------------------------------------------------- reusable links

export type ReusableLinkDetail = {
  link: ReusableLinkRecord; owner: Member | null; updatedBy: Member | null
  stats: { clicks: number; clicksDelta: number | null; uniques: number; uniquesDelta: number | null; ctr: number | null; ctrDelta: number | null }
  daily: Summary['daily']; referrers: Summary['referrers']; sources: Summary['sources']; devices: Summary['devices']
  usage: { id: string; title: string; kind: 'link_page' | 'conversion_page'; owner: Member | null; status: string; updatedAt: string; clicks: number; ctr: number | null; href: string; imageUrl: string | null }[]
  versions: VersionRow[]; activity: ActivityItem[]
  related: RelatedRecord[]
  campaigns: { id: string; name: string }[]
  shortPath: string | null; shortHost: string | null
  governance: { label: string; passed: boolean; detail: string }[]
  preview: { imageUrl: string | null; headline: string; subheadline: string; tokens: ReturnType<typeof normaliseTokens>; pageId: string | null }
}

export const loadReusableLinkDetail = cache(async (session: LinksSession, linkId: string): Promise<ReusableLinkDetail | null> => {
  const { supabase } = session
  const { data: row } = await supabase.from('reusable_links').select(LINK_COLUMNS).eq('id', linkId).eq('workspace_id', session.workspace.id).maybeSingle()
  if (!row) return null
  const link = mapReusableLink(row as Record<string, unknown>)
  const window = lastDays(30)
  const [current, previous, usageItems, versions, activity, campaigns, domains] = await Promise.all([
    summary(session, window, { linkId: link.id }),
    summary(session, previousWindow(window), { linkId: link.id }),
    supabase.from('link_page_items').select('page_id').eq('reusable_link_id', link.id),
    supabase.from('reusable_link_versions').select('version, created_at, created_by, change_summary, status').eq('link_id', link.id).order('version', { ascending: false }).limit(50),
    loadActivity(session, { entityId: link.id, limit: 20 }),
    supabase.from('campaigns').select('id, name').eq('workspace_id', session.workspace.id).is('archived_at', null).order('updated_at', { ascending: false }).limit(100),
    supabase.from('link_domains').select('hostname, status').eq('workspace_id', session.workspace.id).eq('status', 'verified').limit(1),
  ])
  const pageIds = [...new Set((usageItems.data ?? []).map(r => r.page_id as string))]
  const pagesRes = pageIds.length ? await supabase.from('link_pages').select(PAGE_COLUMNS).in('id', pageIds).eq('workspace_id', session.workspace.id) : { data: [] }
  const pages = (pagesRes.data ?? []).map(p => mapPage(p as Record<string, unknown>))
  const pageStats = pageIds.length ? await summary(session, window, { pageIds }) : null
  const statsById = new Map((pageStats?.data.pages ?? []).map(p => [p.page_id, p]))
  const heroes = pageIds.length ? await supabase.from('link_page_items').select('page_id, config').in('page_id', pageIds).eq('item_type', 'hero') : { data: [] }
  const heroImage = new Map((heroes.data ?? []).map(h => [h.page_id as string, ((h.config ?? {}) as Record<string, unknown>).imageUrl as string | null]))

  const cur = current.data.totals, old = previous.data.totals
  const usage = pages.map(p => {
    const s = statsById.get(p.id)
    return { id: p.id, title: p.title, kind: p.kind, owner: memberById(session, p.ownerId), status: p.status, updatedAt: p.updatedAt, clicks: s?.clicks ?? 0, ctr: s ? ctr(s.clicks, s.views) : null, href: `${session.basePath}/pages/${p.id}/design`, imageUrl: heroImage.get(p.id) ?? null }
  }).sort((a, b) => b.clicks - a.clicks)
  const usageViews = [...statsById.values()].reduce((sum, s) => sum + s.views, 0)
  const usageViewsPrev = 0
  void usageViewsPrev

  const related: RelatedRecord[] = []
  if (link.campaignId) {
    const c = (campaigns.data ?? []).find(x => x.id === link.campaignId)
    if (c) related.push({ id: String(c.id), name: String(c.name), kind: 'Campaign', status: 'Active', href: `/${session.workspaceType}/campaigns/${c.id}`, imageUrl: null })
  }
  for (const u of usage.slice(0, 2)) related.push({ id: u.id, name: u.title, kind: u.kind === 'conversion_page' ? 'Conversion Page' : 'Link Page', status: u.status, href: u.href, imageUrl: u.imageUrl })

  const firstPage = pages[0]
  let previewTokens = normaliseTokens(null), previewHero: Record<string, unknown> = {}
  if (firstPage) {
    const [{ data: t }, { data: h }] = await Promise.all([
      firstPage.themeId ? supabase.from('link_themes').select('tokens').eq('id', firstPage.themeId).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('link_page_items').select('config').eq('page_id', firstPage.id).eq('item_type', 'hero').limit(1).maybeSingle(),
    ])
    previewTokens = normaliseTokens(t?.tokens)
    previewHero = (h?.config ?? {}) as Record<string, unknown>
  }

  const scheduleOk = !link.scheduledEnd || new Date(link.scheduledEnd) > new Date()
  const governance = [
    { label: 'Destination valid', passed: link.checkStatus !== 'broken' && link.checkStatus !== 'blocked', detail: link.checkStatus === 'unknown' ? 'Not checked yet' : `Last check: ${link.checkStatus}` },
    { label: 'HTTPS enabled', passed: link.destinationUrl.startsWith('https://'), detail: 'Secure connection enforced' },
    { label: 'Link label set', passed: !!link.label, detail: 'Label improves user clarity' },
    { label: 'Expiry or schedule set', passed: scheduleOk, detail: scheduleOk ? 'Link will be active as intended' : 'This link has expired' },
    { label: 'Owner assigned', passed: !!link.ownerId, detail: 'Accountable owner set' },
  ]

  return {
    link, owner: memberById(session, link.ownerId), updatedBy: memberById(session, link.updatedBy),
    stats: {
      clicks: cur.clicks, clicksDelta: pctChange(cur.clicks, old.clicks), uniques: cur.uniques, uniquesDelta: pctChange(cur.uniques, old.uniques),
      ctr: usageViews ? (cur.clicks / usageViews) * 100 : null, ctrDelta: null,
    },
    daily: continuousDaily(current.data.daily, window), referrers: current.data.referrers, sources: current.data.sources, devices: current.data.devices,
    usage,
    versions: (versions.data ?? []).map(v => ({ version: Number(v.version), label: `v1.${Number(v.version) - 1}`, createdAt: String(v.created_at), by: memberById(session, v.created_by as string | null), changes: String(v.change_summary ?? ''), status: String(v.status), published: v.status === 'published' })),
    activity, related,
    campaigns: (campaigns.data ?? []).map(c => ({ id: String(c.id), name: String(c.name) })),
    shortPath: link.vanitySlug ? `/r/${link.vanitySlug}` : null,
    shortHost: (domains.data ?? [])[0]?.hostname as string | undefined ?? null,
    governance,
    preview: { imageUrl: typeof previewHero.imageUrl === 'string' ? previewHero.imageUrl : null, headline: typeof previewHero.headline === 'string' ? previewHero.headline : link.name, subheadline: typeof previewHero.subheadline === 'string' ? previewHero.subheadline : '', tokens: previewTokens, pageId: firstPage?.id ?? null },
  }
})

// ------------------------------------------------------------------- themes

export type ThemeDetail = {
  theme: ThemeRecord; owner: Member | null; updatedBy: Member | null
  pages: { id: string; title: string; kind: 'link_page' | 'conversion_page'; status: string; clicks: number; ctr: number | null; href: string; imageUrl: string | null }[]
  totalClicks: number; uplift: number | null
  versions: (VersionRow & { tokens: unknown })[]; activity: ActivityItem[]
  accessibility: { checks: ThemeCheck[]; score: number }
  publishedBy: Member | null; publishedAt: string | null
  brandKits: { id: string; name: string }[]
}

export const loadThemeDetail = cache(async (session: LinksSession, themeId: string): Promise<ThemeDetail | null> => {
  const { supabase } = session
  const { data: row } = await supabase.from('link_themes').select(THEME_COLUMNS).eq('id', themeId).eq('workspace_id', session.workspace.id).maybeSingle()
  if (!row) return null
  const theme = mapTheme(row as Record<string, unknown>)
  const window = lastDays(30)
  const [pagesRes, versions, activity, all, kits] = await Promise.all([
    supabase.from('link_pages').select(PAGE_COLUMNS).eq('workspace_id', session.workspace.id).eq('theme_id', theme.id).is('archived_at', null),
    supabase.from('link_theme_versions').select('version, created_at, created_by, change_summary, status, published, tokens').eq('theme_id', theme.id).order('version', { ascending: false }).limit(50),
    loadActivity(session, { entityId: theme.id, limit: 20 }),
    summary(session, window),
    supabase.from('brand_kits').select('id, name').eq('workspace_id', session.workspace.id).is('archived_at', null).order('name'),
  ])
  const pages = (pagesRes.data ?? []).map(p => mapPage(p as Record<string, unknown>))
  const ids = pages.map(p => p.id)
  const themeStats = ids.length ? await summary(session, window, { pageIds: ids }) : null
  const statsById = new Map((themeStats?.data.pages ?? []).map(p => [p.page_id, p]))
  const heroes = ids.length ? await supabase.from('link_page_items').select('page_id, config').in('page_id', ids).eq('item_type', 'hero') : { data: [] }
  const heroImage = new Map((heroes.data ?? []).map(h => [h.page_id as string, ((h.config ?? {}) as Record<string, unknown>).imageUrl as string | null]))
  const workspaceCtr = ctr(all.data.totals.clicks, all.data.totals.views)
  const themeCtr = themeStats ? ctr(themeStats.data.totals.clicks, themeStats.data.totals.views) : null
  const versionRows = (versions.data ?? []).map(v => ({ version: Number(v.version), label: `v1.${Number(v.version) - 1}`, createdAt: String(v.created_at), by: memberById(session, v.created_by as string | null), changes: String(v.change_summary ?? ''), status: v.published ? 'published' : String(v.status), published: !!v.published, tokens: v.tokens }))
  const published = versionRows.find(v => v.published)
  return {
    theme, owner: memberById(session, theme.ownerId), updatedBy: memberById(session, theme.updatedBy),
    pages: pages.map(p => { const s = statsById.get(p.id); return { id: p.id, title: p.title, kind: p.kind, status: p.status, clicks: s?.clicks ?? 0, ctr: s ? ctr(s.clicks, s.views) : null, href: `${session.basePath}/pages/${p.id}/design`, imageUrl: heroImage.get(p.id) ?? null } }).sort((a, b) => b.clicks - a.clicks),
    totalClicks: themeStats?.data.totals.clicks ?? 0,
    uplift: themeCtr !== null && workspaceCtr ? ((themeCtr - workspaceCtr) / workspaceCtr) * 100 : null,
    versions: versionRows, activity, accessibility: themeAccessibilityChecks(theme.tokens),
    publishedBy: published?.by ?? null, publishedAt: published?.createdAt ?? null,
    brandKits: (kits.data ?? []).map(k => ({ id: String(k.id), name: String(k.name) })),
  }
})
