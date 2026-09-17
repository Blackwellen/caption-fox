'use server'

import { randomBytes } from 'node:crypto'
import { resolveTxt } from 'node:dns/promises'
import { revalidatePath } from 'next/cache'
import { BLOCKS, isBlockType, type BlockType, type StarterBlock } from './blocks'
import { canAccessLinkCapability, checkLinkLimit, type LinkCapability } from './entitlements'
import { evaluateGovernance } from './governance'
import { buildBlocks, ITEM_COLUMNS, mapPage, mapTheme, PAGE_COLUMNS, THEME_COLUMNS } from './records'
import { describeTokenChanges, normaliseTokens } from './theme'
import { templateByKey } from './templates'
import {
  findRuleConflicts, isRedirectLoop, normaliseRules, normaliseUtm, slugify, validateDestinationUrl, validateSlug,
} from './urls'
import { requireLinkCapability, type LinksSession } from './server/context'

// Every mutation resolves the Link in Bio gate and asserts its capability on
// the server, scopes every query by workspace_id, validates input, writes an
// activity row and revalidates the module. Client-side disabled states are a
// convenience only.

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

type Ctx = { workspaceType: string }

const ok = <T,>(data: T): ActionResult<T> => ({ ok: true, data })
const fail = (error: string): ActionResult<never> => ({ ok: false, error })

async function gate(ctx: Ctx, capability: LinkCapability) {
  if (!ctx || typeof ctx.workspaceType !== 'string') return { ok: false as const, error: 'Missing workspace.' }
  return requireLinkCapability(ctx.workspaceType, capability)
}

async function log(session: LinksSession, entry: { entityType: string; entityId: string | null; entityName?: string | null; action: string; summary: string; meta?: Record<string, unknown> }) {
  await session.supabase.from('link_activity').insert({
    workspace_id: session.workspace.id, actor_id: session.userId, entity_type: entry.entityType, entity_id: entry.entityId,
    entity_name: entry.entityName ?? null, action: entry.action, summary: entry.summary, meta: entry.meta ?? {},
  })
}

function refresh(session: LinksSession) {
  revalidatePath(session.basePath, 'layout')
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)

function ownHosts(): string[] {
  const hosts = ['localhost']
  for (const url of [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_SITE_URL]) {
    try { if (url) hosts.push(new URL(url).hostname) } catch { /* ignore */ }
  }
  return hosts
}

async function loadOwnedPage(session: LinksSession, pageId: string) {
  if (!isUuid(pageId)) return null
  const { data } = await session.supabase.from('link_pages').select(PAGE_COLUMNS).eq('id', pageId).eq('workspace_id', session.workspace.id).maybeSingle()
  return data ? mapPage(data as Record<string, unknown>) : null
}

async function assertMember(session: LinksSession, userId: unknown): Promise<string | null> {
  if (!isUuid(userId)) return null
  return session.members.some(member => member.id === userId) ? userId : null
}

// ------------------------------------------------------------- saved views

export async function saveView(input: Ctx & { scope: 'library' | 'themes' | 'analytics'; name: string; params: Record<string, string> }): Promise<ActionResult<{ id: string }>> {
  const g = await gate(input, 'view')
  if (!g.ok) return fail(g.error)
  const name = text(input.name, 60)
  if (!name) return fail('Give the view a name.')
  if (!['library', 'themes', 'analytics'].includes(input.scope)) return fail('Unknown view scope.')
  const allowedKeys = ['q', 'type', 'owner', 'status', 'theme', 'updated', 'sort', 'view', 'pageSize', 'category', 'usage', 'range', 'kind', 'source', 'governance']
  const params = Object.fromEntries(Object.entries(input.params ?? {}).filter(([k, v]) => allowedKeys.includes(k) && typeof v === 'string').map(([k, v]) => [k, v.slice(0, 120)]))
  const { data, error } = await g.session.supabase.from('link_saved_views')
    .insert({ workspace_id: g.session.workspace.id, user_id: g.session.userId, scope: input.scope, name, params })
    .select('id').single()
  if (error || !data) return fail('Could not save this view.')
  refresh(g.session)
  return ok({ id: data.id as string })
}

export async function deleteSavedView(input: Ctx & { id: string }): Promise<ActionResult> {
  const g = await gate(input, 'view')
  if (!g.ok) return fail(g.error)
  if (!isUuid(input.id)) return fail('Unknown view.')
  const { error } = await g.session.supabase.from('link_saved_views').delete().eq('id', input.id).eq('user_id', g.session.userId)
  if (error) return fail('Could not delete this view.')
  refresh(g.session)
  return ok(undefined)
}

// ------------------------------------------------------------------ pages

export type CreatePageInput = Ctx & {
  kind: 'link_page' | 'conversion_page'
  title: string; slug: string; ownerId: string; goal: string; campaignId?: string | null
  templateKey?: string | null; themeId?: string | null; domainId?: string | null
  blocks?: { type: string; config?: Record<string, unknown>; isActive?: boolean; children?: { title: string; url: string }[] }[]
  visibility?: 'public' | 'private'; indexInSearch?: boolean
  publishAt?: string | null; unpublishAt?: string | null; utmTracking?: boolean
  submit: 'draft' | 'create' | 'publish'
}

export async function createPage(input: CreatePageInput): Promise<ActionResult<{ id: string; published: boolean }>> {
  const g = await gate(input, input.kind === 'conversion_page' ? 'conversion.create' : 'pages.create')
  if (!g.ok) return fail(g.error)
  const { session } = g

  const title = text(input.title, 80)
  if (!title) return fail('Enter a page title.')
  const slug = slugify(input.slug || title)
  const slugCheck = validateSlug(slug)
  if (!slugCheck.ok) return fail(slugCheck.error)
  const owner = await assertMember(session, input.ownerId)
  if (!owner) return fail('Choose a page owner from this workspace.')
  const goals = ['clicks', 'sales', 'leads', 'registrations', 'waitlist', 'downloads', 'rsvp']
  if (!goals.includes(input.goal)) return fail('Choose a goal for this page.')

  const { count } = await session.supabase.from('link_pages').select('id', { count: 'exact', head: true }).eq('workspace_id', session.workspace.id).is('archived_at', null)
  const limit = checkLinkLimit(session.context, 'pages', count ?? 0)
  if (!limit.allowed) return fail(limit.message)

  const { data: clash } = await session.supabase.rpc('link_slug_taken', { p_slug: slug })
  if (clash === true) return fail(`The slug “${slug}” is already in use. Choose another.`)

  let themeId: string | null = null
  if (input.themeId) {
    const { data: theme } = await session.supabase.from('link_themes').select('id').eq('id', input.themeId).eq('workspace_id', session.workspace.id).maybeSingle()
    if (!theme) return fail('That theme is not available in this workspace.')
    themeId = theme.id as string
  } else {
    const template = templateByKey(input.templateKey)
    if (template.themeName) {
      const { data: theme } = await session.supabase.from('link_themes').select('id').eq('workspace_id', session.workspace.id).eq('name', template.themeName).is('archived_at', null).maybeSingle()
      themeId = (theme?.id as string | undefined) ?? null
    }
  }
  let campaignId: string | null = null
  if (input.campaignId) {
    const { data: campaign } = await session.supabase.from('campaigns').select('id').eq('id', input.campaignId).eq('workspace_id', session.workspace.id).maybeSingle()
    if (!campaign) return fail('That campaign is not in this workspace.')
    campaignId = campaign.id as string
  }
  let domainId: string | null = null
  if (input.domainId) {
    if (!canAccessLinkCapability(session.context, 'domains.manage').allowed) return fail('Custom domains are not included in your plan.')
    const { data: domain } = await session.supabase.from('link_domains').select('id').eq('id', input.domainId).eq('workspace_id', session.workspace.id).maybeSingle()
    if (!domain) return fail('That domain is not connected to this workspace.')
    domainId = domain.id as string
  }
  const publishAt = input.publishAt ? new Date(input.publishAt) : null
  const unpublishAt = input.unpublishAt ? new Date(input.unpublishAt) : null
  if (publishAt && Number.isNaN(publishAt.getTime())) return fail('Enter a valid publish date.')
  if (unpublishAt && Number.isNaN(unpublishAt.getTime())) return fail('Enter a valid unpublish date.')
  if (publishAt && unpublishAt && unpublishAt <= publishAt) return fail('The unpublish date must be after the publish date.')

  // Validate blocks before writing anything.
  const starter: StarterBlock[] = input.blocks?.length
    ? input.blocks.filter(b => isBlockType(b.type)).map(b => ({ type: b.type as BlockType, config: b.config, is_active: b.isActive, children: b.children }))
    : templateByKey(input.templateKey).blocks
  for (const block of starter) {
    const needs = BLOCKS[block.type].requires
    if (needs && !canAccessLinkCapability(session.context, needs).allowed && block.is_active !== false) {
      block.is_active = false // gated blocks are kept but switched off
    }
    for (const child of block.children ?? []) {
      if (!validateDestinationUrl(child.url).ok) return fail(`“${child.title}” needs a valid https:// link.`)
    }
  }

  const { data: page, error } = await session.supabase.from('link_pages').insert({
    workspace_id: session.workspace.id, slug, title, page_kind: input.kind, goal: input.goal, owner_id: owner,
    created_by: session.userId, updated_by: session.userId, theme_id: themeId, campaign_id: campaignId, domain_id: domainId,
    status: publishAt && input.submit === 'publish' ? 'scheduled' : 'draft', visibility: input.visibility === 'private' ? 'private' : 'public',
    index_in_search: input.indexInSearch !== false, utm_tracking: input.utmTracking !== false,
    scheduled_publish_at: publishAt?.toISOString() ?? null, scheduled_unpublish_at: unpublishAt?.toISOString() ?? null,
    is_active: true, current_version: 1, consent: { banner: true },
  }).select('id').single()
  if (error || !page) return fail(error?.code === '23505' ? `The slug “${slug}” is already in use.` : 'Could not create the page. Please try again.')

  const inserted = await insertBlocks(session, page.id as string, starter, 0)
  if (!inserted.ok) {
    await session.supabase.from('link_pages').delete().eq('id', page.id)
    return fail(inserted.error)
  }
  await session.supabase.from('link_page_versions').insert({
    page_id: page.id, workspace_id: session.workspace.id, version: 1, published: false, status: 'draft',
    change_summary: 'Page created', snapshot: {}, created_by: session.userId,
  })
  await log(session, { entityType: 'page', entityId: page.id as string, entityName: title, action: 'created', summary: 'created' })

  let published = false
  if (input.submit === 'publish' && !publishAt) {
    const result = await publishPage({ workspaceType: input.workspaceType, pageId: page.id as string })
    published = result.ok
    if (!result.ok) return ok({ id: page.id as string, published: false })
  }
  refresh(session)
  return ok({ id: page.id as string, published })
}

async function insertBlocks(session: LinksSession, pageId: string, blocks: StarterBlock[], offset: number): Promise<ActionResult> {
  for (const [index, block] of blocks.entries()) {
    const def = BLOCKS[block.type]
    const { data: row, error } = await session.supabase.from('link_page_items').insert({
      page_id: pageId, workspace_id: session.workspace.id, item_type: block.type, title: block.title ?? null,
      config: { ...def.defaultConfig, ...(block.config ?? {}) }, sort_order: offset + index, is_active: block.is_active ?? true,
    }).select('id').single()
    if (error || !row) return fail('Could not add a block.')
    if (block.children?.length) {
      const { error: childError } = await session.supabase.from('link_page_items').insert(block.children.map((child, childIndex) => ({
        page_id: pageId, workspace_id: session.workspace.id, parent_id: row.id, item_type: 'link',
        title: text(child.title, 80) || 'Untitled link', url: validateDestinationUrl(child.url).ok ? child.url : null,
        sort_order: childIndex, is_active: true, config: {},
      })))
      if (childError) return fail('Could not add links.')
    }
  }
  return ok(undefined)
}

async function touchPage(session: LinksSession, pageId: string) {
  await session.supabase.from('link_pages').update({ updated_by: session.userId }).eq('id', pageId).eq('workspace_id', session.workspace.id)
}

async function editablePage(input: Ctx & { pageId: string }) {
  const g = await gate(input, 'pages.edit')
  if (!g.ok) return { ok: false as const, error: g.error }
  const page = await loadOwnedPage(g.session, input.pageId)
  if (!page) return { ok: false as const, error: 'Page not found.' }
  if (page.archivedAt) return { ok: false as const, error: 'Archived pages are read-only. Restore the page to edit it.' }
  return { ok: true as const, session: g.session, page }
}

export async function addBlock(input: Ctx & { pageId: string; type: string; config?: Record<string, unknown> }): Promise<ActionResult<{ id: string }>> {
  const e = await editablePage(input)
  if (!e.ok) return fail(e.error)
  if (!isBlockType(input.type)) return fail('Unknown block type.')
  const needs = BLOCKS[input.type].requires
  if (needs) {
    const check = canAccessLinkCapability(e.session.context, needs)
    if (!check.allowed) return fail(check.message)
  }
  const { data: last } = await e.session.supabase.from('link_page_items').select('sort_order').eq('page_id', e.page.id).is('parent_id', null).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const config = { ...BLOCKS[input.type].defaultConfig, ...(input.config && typeof input.config === 'object' ? input.config : {}) }
  const { data, error } = await e.session.supabase.from('link_page_items').insert({
    page_id: e.page.id, workspace_id: e.session.workspace.id, item_type: input.type, config,
    sort_order: Number(last?.sort_order ?? -1) + 1, is_active: true,
  }).select('id').single()
  if (error || !data) return fail('Could not add the block.')
  if (BLOCKS[input.type].hasChildren) {
    await e.session.supabase.from('link_page_items').insert({ page_id: e.page.id, workspace_id: e.session.workspace.id, parent_id: data.id, item_type: 'link', title: 'New link', url: null, sort_order: 0, is_active: true, config: {} })
  }
  await touchPage(e.session, e.page.id)
  await log(e.session, { entityType: 'page', entityId: e.page.id, entityName: e.page.title, action: 'block_added', summary: `added a ${BLOCKS[input.type].label} block`, meta: { badge: 'Edited' } })
  refresh(e.session)
  return ok({ id: data.id as string })
}

export async function updateBlock(input: Ctx & { pageId: string; blockId: string; config?: Record<string, unknown>; isActive?: boolean }): Promise<ActionResult> {
  const e = await editablePage(input)
  if (!e.ok) return fail(e.error)
  if (!isUuid(input.blockId)) return fail('Unknown block.')
  const { data: block } = await e.session.supabase.from('link_page_items').select('id, item_type, config').eq('id', input.blockId).eq('page_id', e.page.id).is('parent_id', null).maybeSingle()
  if (!block) return fail('Block not found.')
  const patch: Record<string, unknown> = {}
  if (typeof input.isActive === 'boolean') patch.is_active = input.isActive
  if (input.config && typeof input.config === 'object') {
    const merged = { ...(block.config as Record<string, unknown>), ...input.config }
    for (const key of ['url', 'imageUrl']) {
      const value = merged[key]
      if (typeof value === 'string' && value && !value.startsWith('/') && !validateDestinationUrl(value).ok) return fail('Links in blocks must be valid https:// URLs.')
    }
    if (JSON.stringify(merged).length > 20000) return fail('This block has too much content.')
    patch.config = merged
  }
  const { error } = await e.session.supabase.from('link_page_items').update(patch).eq('id', block.id)
  if (error) return fail('Could not save the block.')
  await touchPage(e.session, e.page.id)
  if (typeof input.isActive === 'boolean') {
    await log(e.session, { entityType: 'page', entityId: e.page.id, entityName: e.page.title, action: 'block_toggled', summary: `${input.isActive ? 'showed' : 'hid'} the ${BLOCKS[block.item_type as BlockType]?.label ?? 'block'} block`, meta: { badge: 'Edited' } })
  }
  refresh(e.session)
  return ok(undefined)
}

export async function duplicateBlock(input: Ctx & { pageId: string; blockId: string }): Promise<ActionResult<{ id: string }>> {
  const e = await editablePage(input)
  if (!e.ok) return fail(e.error)
  const { data: rows } = await e.session.supabase.from('link_page_items').select(ITEM_COLUMNS).eq('page_id', e.page.id)
  const all = (rows ?? []) as Record<string, unknown>[]
  const source = all.find(r => r.id === input.blockId && !r.parent_id)
  if (!source) return fail('Block not found.')
  const order = Number(source.sort_order)
  const later = all.filter(r => !r.parent_id && Number(r.sort_order) > order)
  for (const row of later) await e.session.supabase.from('link_page_items').update({ sort_order: Number(row.sort_order) + 1 }).eq('id', row.id as string)
  const { data: copy, error } = await e.session.supabase.from('link_page_items').insert({
    page_id: e.page.id, workspace_id: e.session.workspace.id, item_type: source.item_type, title: source.title, description: source.description,
    config: source.config, is_active: source.is_active, sort_order: order + 1,
  }).select('id').single()
  if (error || !copy) return fail('Could not duplicate the block.')
  const children = all.filter(r => r.parent_id === source.id)
  if (children.length) {
    await e.session.supabase.from('link_page_items').insert(children.map(child => ({
      page_id: e.page.id, workspace_id: e.session.workspace.id, parent_id: copy.id, item_type: 'link', title: child.title, url: child.url, icon: child.icon,
      sort_order: child.sort_order, is_active: child.is_active, reusable_link_id: child.reusable_link_id, config: {},
    })))
  }
  await touchPage(e.session, e.page.id)
  await log(e.session, { entityType: 'page', entityId: e.page.id, entityName: e.page.title, action: 'block_duplicated', summary: 'duplicated a block', meta: { badge: 'Edited' } })
  refresh(e.session)
  return ok({ id: copy.id as string })
}

export async function deleteBlock(input: Ctx & { pageId: string; blockId: string }): Promise<ActionResult> {
  const e = await editablePage(input)
  if (!e.ok) return fail(e.error)
  if (!isUuid(input.blockId)) return fail('Unknown block.')
  const { data: block } = await e.session.supabase.from('link_page_items').select('id, item_type').eq('id', input.blockId).eq('page_id', e.page.id).is('parent_id', null).maybeSingle()
  if (!block) return fail('Block not found.')
  const { error } = await e.session.supabase.from('link_page_items').delete().eq('id', block.id)
  if (error) return fail('Could not delete the block.')
  await touchPage(e.session, e.page.id)
  await log(e.session, { entityType: 'page', entityId: e.page.id, entityName: e.page.title, action: 'block_removed', summary: `removed the ${BLOCKS[block.item_type as BlockType]?.label ?? 'block'} block`, meta: { badge: 'Edited' } })
  refresh(e.session)
  return ok(undefined)
}

export async function reorderBlocks(input: Ctx & { pageId: string; orderedIds: string[]; parentId?: string | null }): Promise<ActionResult> {
  const e = await editablePage(input)
  if (!e.ok) return fail(e.error)
  if (!Array.isArray(input.orderedIds) || input.orderedIds.length > 500 || !input.orderedIds.every(isUuid)) return fail('Invalid order.')
  let query = e.session.supabase.from('link_page_items').select('id').eq('page_id', e.page.id)
  query = input.parentId ? query.eq('parent_id', input.parentId) : query.is('parent_id', null)
  const { data: existing } = await query
  const ids = new Set((existing ?? []).map(r => r.id as string))
  if (ids.size !== input.orderedIds.length || !input.orderedIds.every(id => ids.has(id))) return fail('The page changed while you were reordering. Refresh and try again.')
  for (const [index, id] of input.orderedIds.entries()) {
    const { error } = await e.session.supabase.from('link_page_items').update({ sort_order: index }).eq('id', id).eq('page_id', e.page.id)
    if (error) return fail('Could not save the new order.')
  }
  await touchPage(e.session, e.page.id)
  await log(e.session, { entityType: 'page', entityId: e.page.id, entityName: e.page.title, action: 'reordered', summary: input.parentId ? 'reordered links' : 'reordered blocks', meta: { badge: 'Edited' } })
  refresh(e.session)
  return ok(undefined)
}

export async function upsertChildLink(input: Ctx & { pageId: string; blockId: string; linkId?: string | null; title: string; url: string; reusableLinkId?: string | null; isActive?: boolean; scheduleStart?: string | null; scheduleEnd?: string | null }): Promise<ActionResult<{ id: string }>> {
  const e = await editablePage(input)
  if (!e.ok) return fail(e.error)
  const title = text(input.title, 80)
  if (!title) return fail('Enter a label for the link.')
  let url: string | null = null
  let reusableLinkId: string | null = null
  if (input.reusableLinkId) {
    const { data: link } = await e.session.supabase.from('reusable_links').select('id, vanity_slug, destination_url').eq('id', input.reusableLinkId).eq('workspace_id', e.session.workspace.id).is('archived_at', null).maybeSingle()
    if (!link) return fail('That reusable link is not in this workspace.')
    reusableLinkId = link.id as string
    url = link.destination_url as string
  } else {
    const check = validateDestinationUrl(input.url)
    if (!check.ok) return fail(check.error)
    url = check.url
  }
  const start = input.scheduleStart ? new Date(input.scheduleStart) : null
  const end = input.scheduleEnd ? new Date(input.scheduleEnd) : null
  if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) return fail('Enter valid schedule dates.')
  if (start && end && end <= start) return fail('The link must end after it starts.')
  const { data: block } = await e.session.supabase.from('link_page_items').select('id, item_type').eq('id', input.blockId).eq('page_id', e.page.id).is('parent_id', null).maybeSingle()
  if (!block || !BLOCKS[block.item_type as BlockType]?.hasChildren) return fail('Links can only be added to a link list or button stack.')
  const fields = {
    title, url, reusable_link_id: reusableLinkId, is_active: input.isActive ?? true,
    schedule_start: start?.toISOString() ?? null, schedule_end: end?.toISOString() ?? null, check_status: 'unknown', checked_at: null,
  }
  if (input.linkId) {
    const { error } = await e.session.supabase.from('link_page_items').update(fields).eq('id', input.linkId).eq('parent_id', block.id)
    if (error) return fail('Could not update the link.')
    await touchPage(e.session, e.page.id)
    await log(e.session, { entityType: 'page', entityId: e.page.id, entityName: e.page.title, action: 'link_changed', summary: `updated the “${title}” link`, meta: { badge: 'Edited' } })
    refresh(e.session)
    return ok({ id: input.linkId })
  }
  const { data: last } = await e.session.supabase.from('link_page_items').select('sort_order').eq('parent_id', block.id).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const { data, error } = await e.session.supabase.from('link_page_items').insert({
    ...fields, page_id: e.page.id, workspace_id: e.session.workspace.id, parent_id: block.id, item_type: 'link', sort_order: Number(last?.sort_order ?? -1) + 1, config: {},
  }).select('id').single()
  if (error || !data) return fail('Could not add the link.')
  await touchPage(e.session, e.page.id)
  await log(e.session, { entityType: 'page', entityId: e.page.id, entityName: e.page.title, action: 'link_added', summary: `added the “${title}” link`, meta: { badge: 'Edited' } })
  refresh(e.session)
  return ok({ id: data.id as string })
}

export async function removeChildLink(input: Ctx & { pageId: string; linkId: string }): Promise<ActionResult> {
  const e = await editablePage(input)
  if (!e.ok) return fail(e.error)
  if (!isUuid(input.linkId)) return fail('Unknown link.')
  // Removing from a page never deletes the underlying reusable link.
  const { error } = await e.session.supabase.from('link_page_items').delete().eq('id', input.linkId).eq('page_id', e.page.id).not('parent_id', 'is', null)
  if (error) return fail('Could not remove the link.')
  await touchPage(e.session, e.page.id)
  await log(e.session, { entityType: 'page', entityId: e.page.id, entityName: e.page.title, action: 'link_removed', summary: 'removed a link', meta: { badge: 'Edited' } })
  refresh(e.session)
  return ok(undefined)
}

export type PageSettingsPatch = {
  title?: string; slug?: string; description?: string | null; ownerId?: string; goal?: string; campaignId?: string | null; themeId?: string | null
  tags?: string[]; domainId?: string | null; visibility?: 'public' | 'private'; indexInSearch?: boolean; utmTracking?: boolean
  seoTitle?: string | null; seoDescription?: string | null; ogImage?: string | null
  privacyUrl?: string | null; termsUrl?: string | null; disclosure?: string | null; consentBanner?: boolean
  scheduledPublishAt?: string | null; scheduledUnpublishAt?: string | null
}

export async function updatePageSettings(input: Ctx & { pageId: string; patch: PageSettingsPatch }): Promise<ActionResult> {
  const e = await editablePage(input)
  if (!e.ok) return fail(e.error)
  const p = input.patch ?? {}
  const update: Record<string, unknown> = { updated_by: e.session.userId }
  if (p.title !== undefined) { const title = text(p.title, 80); if (!title) return fail('A page title is required.'); update.title = title }
  if (p.slug !== undefined) {
    const slug = slugify(p.slug)
    const check = validateSlug(slug)
    if (!check.ok) return fail(check.error)
    if (slug !== e.page.slug) {
      const { data: taken } = await e.session.supabase.rpc('link_slug_taken', { p_slug: slug })
      if (taken === true) return fail(`The slug “${slug}” is already in use.`)
      update.slug = slug
    }
  }
  if (p.description !== undefined) update.description = text(p.description, 300) || null
  if (p.ownerId !== undefined) { const owner = await assertMember(e.session, p.ownerId); if (!owner) return fail('Choose an owner from this workspace.'); update.owner_id = owner }
  if (p.goal !== undefined) { if (!['clicks', 'sales', 'leads', 'registrations', 'waitlist', 'downloads', 'rsvp'].includes(p.goal)) return fail('Unknown goal.'); update.goal = p.goal }
  if (p.campaignId !== undefined) {
    if (p.campaignId) { const { data } = await e.session.supabase.from('campaigns').select('id').eq('id', p.campaignId).eq('workspace_id', e.session.workspace.id).maybeSingle(); if (!data) return fail('That campaign is not in this workspace.') }
    update.campaign_id = p.campaignId || null
  }
  if (p.themeId !== undefined) {
    if (p.themeId) { const { data } = await e.session.supabase.from('link_themes').select('id').eq('id', p.themeId).eq('workspace_id', e.session.workspace.id).is('archived_at', null).maybeSingle(); if (!data) return fail('That theme is not available.') }
    update.theme_id = p.themeId || null
  }
  if (p.domainId !== undefined) {
    if (p.domainId) {
      const check = canAccessLinkCapability(e.session.context, 'domains.manage')
      if (!check.allowed) return fail(check.message)
      const { data } = await e.session.supabase.from('link_domains').select('id').eq('id', p.domainId).eq('workspace_id', e.session.workspace.id).maybeSingle()
      if (!data) return fail('That domain is not connected to this workspace.')
    }
    update.domain_id = p.domainId || null
  }
  if (p.tags !== undefined) update.tags = (Array.isArray(p.tags) ? p.tags : []).map(tag => text(tag, 30)).filter(Boolean).slice(0, 10)
  if (p.visibility !== undefined) update.visibility = p.visibility === 'private' ? 'private' : 'public'
  if (p.indexInSearch !== undefined) update.index_in_search = !!p.indexInSearch
  if (p.utmTracking !== undefined) update.utm_tracking = !!p.utmTracking
  if (p.seoTitle !== undefined) update.seo_title = text(p.seoTitle, 70) || null
  if (p.seoDescription !== undefined) update.seo_description = text(p.seoDescription, 160) || null
  if (p.ogImage !== undefined) {
    const value = text(p.ogImage, 500)
    if (value && !value.startsWith('/') && !validateDestinationUrl(value, { requireHttps: true }).ok) return fail('The social image must be an https:// URL.')
    update.og_image = value || null
  }
  if (p.privacyUrl !== undefined || p.termsUrl !== undefined || p.disclosure !== undefined) {
    const legal = { ...e.page.legal }
    for (const [key, value] of [['privacyUrl', p.privacyUrl], ['termsUrl', p.termsUrl]] as const) {
      if (value === undefined) continue
      if (value && !validateDestinationUrl(value).ok) return fail('Legal links must be valid URLs.')
      legal[key] = value || null
    }
    if (p.disclosure !== undefined) legal.disclosure = text(p.disclosure, 300) || null
    update.legal = legal
  }
  if (p.consentBanner !== undefined) update.consent = { ...e.page.consent, banner: !!p.consentBanner }
  if (p.scheduledPublishAt !== undefined || p.scheduledUnpublishAt !== undefined) {
    const publishAt = p.scheduledPublishAt === undefined ? e.page.scheduledPublishAt : p.scheduledPublishAt
    const unpublishAt = p.scheduledUnpublishAt === undefined ? e.page.scheduledUnpublishAt : p.scheduledUnpublishAt
    const a = publishAt ? new Date(publishAt) : null, b = unpublishAt ? new Date(unpublishAt) : null
    if ((a && Number.isNaN(a.getTime())) || (b && Number.isNaN(b.getTime()))) return fail('Enter valid dates.')
    if (a && b && b <= a) return fail('The unpublish date must be after the publish date.')
    if (p.scheduledPublishAt !== undefined) {
      const check = canAccessLinkCapability(e.session.context, 'pages.publish')
      if (!check.allowed && a) return fail(check.message)
      update.scheduled_publish_at = a?.toISOString() ?? null
      if (a && e.page.status !== 'published') update.status = 'scheduled'
      if (!a && e.page.status === 'scheduled') update.status = 'draft'
    }
    if (p.scheduledUnpublishAt !== undefined) update.scheduled_unpublish_at = b?.toISOString() ?? null
  }
  const { error } = await e.session.supabase.from('link_pages').update(update).eq('id', e.page.id).eq('workspace_id', e.session.workspace.id)
  if (error) return fail(error.code === '23505' ? 'That slug is already in use.' : 'Could not save settings.')
  await log(e.session, { entityType: 'page', entityId: e.page.id, entityName: (update.title as string) ?? e.page.title, action: 'settings_updated', summary: 'updated page settings', meta: { badge: 'Edited', fields: Object.keys(update).filter(k => k !== 'updated_by') } })
  refresh(e.session)
  return ok(undefined)
}

async function governanceFor(session: LinksSession, pageId: string) {
  const page = await loadOwnedPage(session, pageId)
  if (!page) return null
  const [{ data: items }, { data: theme }, { data: domain }, { data: pixels }] = await Promise.all([
    session.supabase.from('link_page_items').select(ITEM_COLUMNS).eq('page_id', pageId),
    page.themeId ? session.supabase.from('link_themes').select(THEME_COLUMNS).eq('id', page.themeId).maybeSingle() : Promise.resolve({ data: null }),
    page.domainId ? session.supabase.from('link_domains').select('status').eq('id', page.domainId).maybeSingle() : Promise.resolve({ data: null }),
    session.supabase.from('link_page_pixels').select('approval_status, enabled').eq('page_id', pageId),
  ])
  const blocks = buildBlocks((items ?? []) as Record<string, unknown>[])
  const forms = blocks.filter(b => b.type === 'form' && b.isActive)
  const themeRecord = theme ? mapTheme(theme as Record<string, unknown>) : null
  return {
    page, blocks,
    governance: evaluateGovernance({
      status: page.status, approvalStatus: page.approvalStatus,
      theme: themeRecord ? { status: themeRecord.status, tokens: themeRecord.tokens } : null,
      legal: page.legal, consent: page.consent,
      domain: domain ? { status: domain.status as 'pending' | 'verified' | 'failed' } : null,
      pixels: (pixels ?? []).map(p => ({ approvalStatus: p.approval_status as string, enabled: p.enabled as boolean })),
      links: blocks.flatMap(b => b.isActive ? b.children.map(c => ({ url: c.url, checkStatus: c.checkStatus, isActive: c.isActive })) : []),
      hasForm: forms.length > 0,
      formConsentText: forms.every(f => typeof f.config.consentText === 'string' && (f.config.consentText as string).trim().length > 0),
      utmTracking: page.utmTracking, hasTitle: !!page.title.trim(),
    }),
  }
}

export async function publishPage(input: Ctx & { pageId: string; note?: string }): Promise<ActionResult<{ version: number }>> {
  const g = await gate(input, 'pages.publish')
  if (!g.ok) return fail(g.error)
  const { session } = g
  const state = await governanceFor(session, input.pageId)
  if (!state) return fail('Page not found.')
  if (state.page.archivedAt) return fail('Restore this page before publishing it.')
  if (!state.governance.passed) {
    const blocking = state.governance.checks.filter(c => c.status === 'failed' && c.id !== 'content_review').map(c => `${c.label}: ${c.detail}`)
    return fail(`Fix these before publishing — ${blocking.join('; ')}.`)
  }
  const { data: snapshot, error: snapError } = await session.supabase.rpc('link_page_build_snapshot', { p_page_id: state.page.id })
  if (snapError || !snapshot) return fail('Could not prepare the published version.')
  const { data: latest } = await session.supabase.from('link_page_versions').select('version').eq('page_id', state.page.id).order('version', { ascending: false }).limit(1).maybeSingle()
  const version = Number(latest?.version ?? 0) + 1
  const now = new Date().toISOString()
  await session.supabase.from('link_page_versions').update({ published: false, status: 'superseded' }).eq('page_id', state.page.id).eq('published', true)
  const { error } = await session.supabase.from('link_page_versions').insert({
    page_id: state.page.id, workspace_id: session.workspace.id, version, snapshot, published: true, status: 'published',
    change_summary: text(input.note, 120) || 'Published changes', created_by: session.userId, approved_by: session.userId, published_at: now,
  })
  if (error) return fail('Could not publish. Someone may have published at the same moment — refresh and try again.')
  const scheduled = state.page.scheduledPublishAt && new Date(state.page.scheduledPublishAt) > new Date()
  await session.supabase.from('link_pages').update({
    status: scheduled ? 'scheduled' : 'published', published_at: scheduled ? state.page.publishedAt : now, published_version: version,
    current_version: version, approval_status: 'approved', updated_by: session.userId,
  }).eq('id', state.page.id)
  await log(session, { entityType: 'page', entityId: state.page.id, entityName: state.page.title, action: 'published', summary: `published version ${version}`, meta: { badge: 'Published', version } })
  refresh(session)
  return ok({ version })
}

export async function submitPageForReview(input: Ctx & { pageId: string }): Promise<ActionResult> {
  const e = await editablePage(input)
  if (!e.ok) return fail(e.error)
  await e.session.supabase.from('link_pages').update({ status: e.page.status === 'published' ? 'published' : 'in_review', approval_status: 'pending', updated_by: e.session.userId }).eq('id', e.page.id)
  await log(e.session, { entityType: 'page', entityId: e.page.id, entityName: e.page.title, action: 'status_changed', summary: 'submitted for review', meta: { badge: 'Review' } })
  refresh(e.session)
  return ok(undefined)
}

export async function reviewPage(input: Ctx & { pageId: string; decision: 'approved' | 'changes_requested' }): Promise<ActionResult> {
  const g = await gate(input, 'pages.approve')
  if (!g.ok) return fail(g.error)
  const page = await loadOwnedPage(g.session, input.pageId)
  if (!page) return fail('Page not found.')
  if (!['approved', 'changes_requested'].includes(input.decision)) return fail('Unknown decision.')
  await g.session.supabase.from('link_pages').update({ approval_status: input.decision, status: page.status === 'in_review' ? 'draft' : page.status }).eq('id', page.id)
  await log(g.session, { entityType: 'page', entityId: page.id, entityName: page.title, action: input.decision, summary: input.decision === 'approved' ? 'approved' : 'requested changes on', meta: { badge: input.decision === 'approved' ? 'Approved' : 'Review' } })
  refresh(g.session)
  return ok(undefined)
}

export async function setPageLifecycle(input: Ctx & { pageId: string; action: 'unpublish' | 'archive' | 'restore' }): Promise<ActionResult> {
  const capability: LinkCapability = input.action === 'unpublish' ? 'pages.publish' : 'pages.archive'
  const g = await gate(input, capability)
  if (!g.ok) return fail(g.error)
  const page = await loadOwnedPage(g.session, input.pageId)
  if (!page) return fail('Page not found.')
  const update = input.action === 'unpublish' ? { status: 'unpublished' }
    : input.action === 'archive' ? { status: 'archived', archived_at: new Date().toISOString() }
      : { status: page.publishedVersion ? 'unpublished' : 'draft', archived_at: null }
  const { error } = await g.session.supabase.from('link_pages').update({ ...update, updated_by: g.session.userId }).eq('id', page.id)
  if (error) return fail('Could not update the page.')
  if (input.action !== 'restore') await g.session.supabase.from('link_page_versions').update({ published: false }).eq('page_id', page.id).eq('published', true)
  await log(g.session, { entityType: 'page', entityId: page.id, entityName: page.title, action: input.action, summary: `${input.action === 'unpublish' ? 'unpublished' : input.action === 'archive' ? 'archived' : 'restored'}` })
  refresh(g.session)
  return ok(undefined)
}

export async function duplicatePage(input: Ctx & { pageId: string }): Promise<ActionResult<{ id: string }>> {
  const g = await gate(input, 'pages.create')
  if (!g.ok) return fail(g.error)
  const { session } = g
  const page = await loadOwnedPage(session, input.pageId)
  if (!page) return fail('Page not found.')
  if (page.kind === 'conversion_page' && !canAccessLinkCapability(session.context, 'conversion.create').allowed) return fail('Conversion pages are not included in your plan.')
  const { count } = await session.supabase.from('link_pages').select('id', { count: 'exact', head: true }).eq('workspace_id', session.workspace.id).is('archived_at', null)
  const limit = checkLinkLimit(session.context, 'pages', count ?? 0)
  if (!limit.allowed) return fail(limit.message)
  let slug = `${page.slug}-copy`.slice(0, 50)
  for (let i = 2; i < 50; i++) {
    const { data: taken } = await session.supabase.rpc('link_slug_taken', { p_slug: slug })
    if (taken !== true) break
    slug = `${page.slug.slice(0, 44)}-copy-${i}`
  }
  const { data: source } = await session.supabase.from('link_pages').select('*').eq('id', page.id).single()
  const { id: _id, created_at: _c, updated_at: _u, published_at: _p, published_version: _pv, total_views: _tv, total_clicks: _tc, is_demo: _d, ...rest } = source as Record<string, unknown>
  void _id; void _c; void _u; void _p; void _pv; void _tv; void _tc; void _d
  const { data: copy, error } = await session.supabase.from('link_pages').insert({
    ...rest, slug, title: `${page.title} (copy)`.slice(0, 80), status: 'draft', approval_status: 'none', archived_at: null,
    current_version: 1, owner_id: session.userId, created_by: session.userId, updated_by: session.userId, scheduled_publish_at: null,
  }).select('id').single()
  if (error || !copy) return fail('Could not duplicate the page.')
  const { data: items } = await session.supabase.from('link_page_items').select(ITEM_COLUMNS).eq('page_id', page.id)
  const blocks = buildBlocks((items ?? []) as Record<string, unknown>[])
  await insertBlocks(session, copy.id as string, blocks.map(b => ({ type: b.type, config: b.config, is_active: b.isActive, children: b.children.map(c => ({ title: c.title, url: c.url ?? '' })) })), 0)
  await session.supabase.from('link_page_versions').insert({ page_id: copy.id, workspace_id: session.workspace.id, version: 1, status: 'draft', change_summary: `Duplicated from ${page.title}`, snapshot: {}, created_by: session.userId })
  await log(session, { entityType: 'page', entityId: copy.id as string, entityName: `${page.title} (copy)`, action: 'created', summary: 'duplicated', meta: { from: page.id } })
  refresh(session)
  return ok({ id: copy.id as string })
}

export async function restorePageVersion(input: Ctx & { pageId: string; version: number }): Promise<ActionResult<{ version: number }>> {
  const g = await gate(input, 'versions.restore')
  if (!g.ok) return fail(g.error)
  const { session } = g
  const page = await loadOwnedPage(session, input.pageId)
  if (!page) return fail('Page not found.')
  if (page.archivedAt) return fail('Restore the page before restoring a version.')
  const { data: target } = await session.supabase.from('link_page_versions').select('version, snapshot').eq('page_id', page.id).eq('version', Number(input.version)).maybeSingle()
  const snapshot = (target?.snapshot ?? {}) as { items?: Record<string, unknown>[]; theme_id?: string | null; page?: Record<string, unknown> }
  if (!target || !Array.isArray(snapshot.items)) return fail('That version has no restorable content.')
  // Replace the working rows with the snapshot, preserving history: nothing is
  // overwritten in link_page_versions; a new "restored" version is recorded.
  await session.supabase.from('link_page_items').delete().eq('page_id', page.id)
  const idMap = new Map<string, string>()
  for (const item of snapshot.items.filter(i => !i.parent_id)) {
    const { data } = await session.supabase.from('link_page_items').insert({
      page_id: page.id, workspace_id: session.workspace.id, item_type: item.item_type, title: item.title, description: item.description,
      url: item.url, icon: item.icon, config: item.config ?? {}, is_active: item.is_active, sort_order: item.sort_order,
      schedule_start: item.schedule_start, schedule_end: item.schedule_end,
    }).select('id').single()
    if (data) idMap.set(String(item.id), data.id as string)
  }
  const children = snapshot.items.filter(i => i.parent_id && idMap.has(String(i.parent_id)))
  if (children.length) {
    await session.supabase.from('link_page_items').insert(children.map(item => ({
      page_id: page.id, workspace_id: session.workspace.id, parent_id: idMap.get(String(item.parent_id)), item_type: 'link', title: item.title,
      url: item.url, icon: item.icon, config: {}, is_active: item.is_active, sort_order: item.sort_order, reusable_link_id: item.reusable_link_id,
      schedule_start: item.schedule_start, schedule_end: item.schedule_end,
    })))
  }
  const { data: latest } = await session.supabase.from('link_page_versions').select('version').eq('page_id', page.id).order('version', { ascending: false }).limit(1).maybeSingle()
  const version = Number(latest?.version ?? 0) + 1
  await session.supabase.from('link_page_versions').insert({
    page_id: page.id, workspace_id: session.workspace.id, version, published: false, status: 'restored',
    change_summary: `Restored v${target.version}`, snapshot: target.snapshot, created_by: session.userId,
  })
  await session.supabase.from('link_pages').update({ current_version: version, updated_by: session.userId, ...(snapshot.theme_id !== undefined ? { theme_id: snapshot.theme_id } : {}) }).eq('id', page.id)
  await log(session, { entityType: 'page', entityId: page.id, entityName: page.title, action: 'version_restored', summary: `restored version ${target.version}`, meta: { badge: 'Restored', version: target.version } })
  refresh(session)
  return ok({ version })
}

// ----------------------------------------------------------------- pixels

const PIXEL_PATTERNS: Record<string, RegExp> = {
  meta: /^\d{10,20}$/, google_analytics: /^G-[A-Z0-9]{4,20}$/, google_ads: /^AW-\d{6,15}$/, tiktok: /^[A-Z0-9]{10,30}$/, linkedin: /^\d{4,12}$/,
}

export async function upsertPixel(input: Ctx & { pageId: string; provider: string; pixelId: string; consentCategory: 'analytics' | 'marketing' }): Promise<ActionResult> {
  const g = await gate(input, 'pixels.manage')
  if (!g.ok) return fail(g.error)
  const page = await loadOwnedPage(g.session, input.pageId)
  if (!page) return fail('Page not found.')
  const pattern = PIXEL_PATTERNS[input.provider]
  if (!pattern) return fail('Unsupported pixel provider.')
  const pixelId = text(input.pixelId, 40).toUpperCase().replace(/^G-/, 'G-')
  const value = input.provider === 'meta' || input.provider === 'linkedin' ? text(input.pixelId, 40) : pixelId
  if (!pattern.test(value)) return fail('That ID does not match the provider’s format.')
  const canApprove = canAccessLinkCapability(g.session.context, 'pages.approve').allowed
  const { error } = await g.session.supabase.from('link_page_pixels').upsert({
    workspace_id: g.session.workspace.id, page_id: page.id, provider: input.provider, pixel_id: value,
    consent_category: input.consentCategory === 'analytics' ? 'analytics' : 'marketing', enabled: true,
    approval_status: canApprove ? 'approved' : 'pending', created_by: g.session.userId,
  }, { onConflict: 'page_id,provider' })
  if (error) return fail('Could not save the pixel.')
  await log(g.session, { entityType: 'pixel', entityId: page.id, entityName: page.title, action: 'pixel_updated', summary: `updated ${input.provider.replace('_', ' ')} pixel`, meta: { badge: 'Pixel updated' } })
  refresh(g.session)
  return ok(undefined)
}

export async function setPixelState(input: Ctx & { pageId: string; provider: string; action: 'enable' | 'disable' | 'remove' | 'approve' }): Promise<ActionResult> {
  const g = await gate(input, input.action === 'approve' ? 'pages.approve' : 'pixels.manage')
  if (!g.ok) return fail(g.error)
  const page = await loadOwnedPage(g.session, input.pageId)
  if (!page) return fail('Page not found.')
  const query = g.session.supabase.from('link_page_pixels')
  const scope = <T extends { eq: (column: string, value: string) => T }>(q: T) => q.eq('page_id', page.id).eq('provider', input.provider)
  const { error } = input.action === 'remove' ? await scope(query.delete())
    : await scope(query.update(input.action === 'approve' ? { approval_status: 'approved' } : { enabled: input.action === 'enable' }))
  if (error) return fail('Could not update the pixel.')
  await log(g.session, { entityType: 'pixel', entityId: page.id, entityName: page.title, action: `pixel_${input.action}`, summary: `${input.action === 'remove' ? 'removed' : input.action + 'd'} the ${input.provider.replace('_', ' ')} pixel`, meta: { badge: 'Pixel updated' } })
  refresh(g.session)
  return ok(undefined)
}

// ----------------------------------------------------------------- domains

export async function connectDomain(input: Ctx & { hostname: string }): Promise<ActionResult<{ id: string; token: string }>> {
  const g = await gate(input, 'domains.manage')
  if (!g.ok) return fail(g.error)
  const hostname = text(input.hostname, 253).toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(hostname)) return fail('Enter a domain like link.yourbrand.com')
  const token = randomBytes(16).toString('hex')
  const { data, error } = await g.session.supabase.from('link_domains').insert({ workspace_id: g.session.workspace.id, hostname, verification_token: token, created_by: g.session.userId }).select('id').single()
  if (error || !data) return fail(error?.code === '23505' ? 'That domain is already connected to a workspace.' : 'Could not connect the domain.')
  await log(g.session, { entityType: 'domain', entityId: data.id as string, entityName: hostname, action: 'domain_connected', summary: `connected ${hostname}` })
  refresh(g.session)
  return ok({ id: data.id as string, token })
}

export async function verifyDomain(input: Ctx & { domainId: string }): Promise<ActionResult<{ status: 'verified' | 'failed' }>> {
  const g = await gate(input, 'domains.manage')
  if (!g.ok) return fail(g.error)
  if (!isUuid(input.domainId)) return fail('Unknown domain.')
  const { data: domain } = await g.session.supabase.from('link_domains').select('id, hostname, verification_token').eq('id', input.domainId).eq('workspace_id', g.session.workspace.id).maybeSingle()
  if (!domain) return fail('Domain not found.')
  let verified = false, lastError: string | null = null
  try {
    const records = await Promise.race([
      resolveTxt(`_captionfox.${domain.hostname}`),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS lookup timed out')), 5000)),
    ])
    verified = records.some(parts => parts.join('') === `captionfox-verify=${domain.verification_token}`)
    if (!verified) lastError = 'The TXT record was found but the value does not match.'
  } catch {
    lastError = 'No TXT record found yet. DNS changes can take up to 48 hours.'
  }
  const status = verified ? 'verified' : 'failed'
  await g.session.supabase.from('link_domains').update({ status, last_checked_at: new Date().toISOString(), last_error: lastError, ...(verified ? { verified_at: new Date().toISOString() } : {}) }).eq('id', domain.id)
  await log(g.session, { entityType: 'domain', entityId: domain.id as string, entityName: domain.hostname as string, action: verified ? 'domain_verified' : 'domain_failed', summary: verified ? `verified ${domain.hostname}` : `could not verify ${domain.hostname}` })
  refresh(g.session)
  return verified ? ok({ status: 'verified' }) : fail(lastError ?? 'Verification failed.')
}

// --------------------------------------------------------- reusable links

export type ReusableLinkInput = {
  name: string; destinationUrl: string; vanitySlug: string; label?: string | null; icon?: string | null
  utm?: Record<string, string>; openBehaviour?: string; redirectType?: number
  scheduleMode?: 'always' | 'expiry' | 'window'; scheduledStart?: string | null; scheduledEnd?: string | null; timezone?: string
  ownerId: string; tags?: string[]; rules?: unknown; fallbackUrl?: string | null; campaignId?: string | null; usableIn?: string[]
}

function validateReusable(input: ReusableLinkInput) {
  const name = text(input.name, 100)
  if (!name) return { ok: false as const, error: 'Enter a link name.' }
  const destination = validateDestinationUrl(input.destinationUrl)
  if (!destination.ok) return { ok: false as const, error: destination.error }
  const slug = slugify(input.vanitySlug || name)
  const slugCheck = validateSlug(slug)
  if (!slugCheck.ok) return { ok: false as const, error: slugCheck.error }
  if (isRedirectLoop(destination.url, ownHosts(), slug)) return { ok: false as const, error: 'The destination points back to this short link, which would loop forever.' }
  const rules = normaliseRules(input.rules)
  for (const rule of rules) if (isRedirectLoop(rule.destination, ownHosts(), slug)) return { ok: false as const, error: 'A routing rule points back to this short link.' }
  const conflicts = findRuleConflicts(rules)
  if (conflicts.length) return { ok: false as const, error: conflicts[0] }
  let fallback: string | null = null
  if (input.fallbackUrl) { const f = validateDestinationUrl(input.fallbackUrl); if (!f.ok) return { ok: false as const, error: `Fallback: ${f.error}` }; fallback = f.url }
  const mode = input.scheduleMode ?? 'always'
  const start = mode === 'window' && input.scheduledStart ? new Date(input.scheduledStart) : null
  const end = mode !== 'always' && input.scheduledEnd ? new Date(input.scheduledEnd) : null
  if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) return { ok: false as const, error: 'Enter valid schedule dates.' }
  if (mode === 'expiry' && !end) return { ok: false as const, error: 'Choose an expiry date.' }
  if (mode === 'window' && (!start || !end)) return { ok: false as const, error: 'Choose a start and end date.' }
  if (start && end && end <= start) return { ok: false as const, error: 'The end date must be after the start date.' }
  const tags = (Array.isArray(input.tags) ? input.tags : []).map(t => slugify(t).slice(0, 30)).filter(Boolean).slice(0, 10)
  return {
    ok: true as const,
    row: {
      name, destination_url: destination.url, vanity_slug: slug, label: text(input.label, 60) || null, icon: text(input.icon, 40) || null,
      utm: normaliseUtm(input.utm), open_behaviour: ['same_tab', 'new_tab', 'in_app'].includes(input.openBehaviour ?? '') ? input.openBehaviour : 'same_tab',
      redirect_type: [301, 302, 307].includes(Number(input.redirectType)) ? Number(input.redirectType) : 302,
      scheduled_start: start?.toISOString() ?? null, scheduled_end: end?.toISOString() ?? null, timezone: text(input.timezone, 60) || 'Europe/London',
      tags, rules, fallback_url: fallback,
      usable_in: (Array.isArray(input.usableIn) ? input.usableIn : []).filter(v => ['link_pages', 'content', 'email', 'ads', 'social', 'qr'].includes(v)),
    },
  }
}

export async function createReusableLink(input: Ctx & ReusableLinkInput & { submit: 'draft' | 'create' }): Promise<ActionResult<{ id: string }>> {
  const g = await gate(input, 'reusable.manage')
  if (!g.ok) return fail(g.error)
  const { session } = g
  const v = validateReusable(input)
  if (!v.ok) return fail(v.error)
  const owner = await assertMember(session, input.ownerId)
  if (!owner) return fail('Choose an owner from this workspace.')
  const { count } = await session.supabase.from('reusable_links').select('id', { count: 'exact', head: true }).eq('workspace_id', session.workspace.id).is('archived_at', null)
  const limit = checkLinkLimit(session.context, 'reusableLinks', count ?? 0)
  if (!limit.allowed) return fail(limit.message)
  const { data: taken } = await session.supabase.rpc('link_short_slug_taken', { p_slug: v.row.vanity_slug })
  if (taken === true) return fail(`The slug “${v.row.vanity_slug}” is already in use.`)
  let campaignId: string | null = null
  if (input.campaignId) {
    const { data } = await session.supabase.from('campaigns').select('id').eq('id', input.campaignId).eq('workspace_id', session.workspace.id).maybeSingle()
    campaignId = (data?.id as string | undefined) ?? null
  }
  const status = input.submit === 'draft' ? 'draft' : v.row.scheduled_start && new Date(v.row.scheduled_start) > new Date() ? 'scheduled' : 'active'
  const { data, error } = await session.supabase.from('reusable_links').insert({
    ...v.row, workspace_id: session.workspace.id, owner_id: owner, status, campaign_id: campaignId,
    created_by: session.userId, updated_by: session.userId, current_version: 1,
  }).select('id').single()
  if (error || !data) return fail(error?.code === '23505' ? 'That slug is already in use.' : 'Could not create the link.')
  await session.supabase.from('reusable_link_versions').insert({ link_id: data.id, workspace_id: session.workspace.id, version: 1, snapshot: v.row, change_summary: 'Re-usable link created', status: 'published', created_by: session.userId })
  await log(session, { entityType: 'reusable_link', entityId: data.id as string, entityName: v.row.name, action: 'created', summary: 'created reusable link' })
  refresh(session)
  return ok({ id: data.id as string })
}

export async function updateReusableLink(input: Ctx & { linkId: string; patch: Partial<ReusableLinkInput> }): Promise<ActionResult> {
  const g = await gate(input, 'reusable.manage')
  if (!g.ok) return fail(g.error)
  const { session } = g
  if (!isUuid(input.linkId)) return fail('Unknown link.')
  const { data: existing } = await session.supabase.from('reusable_links').select('*').eq('id', input.linkId).eq('workspace_id', session.workspace.id).maybeSingle()
  if (!existing) return fail('Link not found.')
  if (existing.archived_at) return fail('Archived links are read-only.')
  const merged: ReusableLinkInput = {
    name: existing.name, destinationUrl: existing.destination_url, vanitySlug: existing.vanity_slug ?? '', label: existing.label, icon: existing.icon,
    utm: existing.utm, openBehaviour: existing.open_behaviour, redirectType: existing.redirect_type,
    scheduleMode: existing.scheduled_start ? 'window' : existing.scheduled_end ? 'expiry' : 'always',
    scheduledStart: existing.scheduled_start, scheduledEnd: existing.scheduled_end, timezone: existing.timezone, ownerId: existing.owner_id,
    tags: existing.tags, rules: existing.rules, fallbackUrl: existing.fallback_url, usableIn: existing.usable_in,
    ...input.patch,
  }
  const v = validateReusable(merged)
  if (!v.ok) return fail(v.error)
  if (input.patch.ownerId !== undefined && !(await assertMember(session, input.patch.ownerId))) return fail('Choose an owner from this workspace.')
  if (v.row.vanity_slug !== existing.vanity_slug) {
    const { data: taken } = await session.supabase.rpc('link_short_slug_taken', { p_slug: v.row.vanity_slug })
    if (taken === true) return fail(`The slug “${v.row.vanity_slug}” is already in use.`)
  }
  const version = Number(existing.current_version ?? 1) + 1
  const changes: string[] = []
  if (v.row.destination_url !== existing.destination_url) changes.push('Destination URL update')
  if (JSON.stringify(v.row.utm) !== JSON.stringify(existing.utm)) changes.push('UTM update')
  if (JSON.stringify(v.row.rules) !== JSON.stringify(existing.rules ?? [])) changes.push('Rules update')
  if (v.row.redirect_type !== existing.redirect_type) changes.push('Redirect behaviour')
  if (v.row.vanity_slug !== existing.vanity_slug) changes.push('Vanity slug update')
  const { error } = await session.supabase.from('reusable_links').update({
    ...v.row, ...(input.patch.ownerId ? { owner_id: input.patch.ownerId } : {}), updated_by: session.userId, current_version: version,
    check_status: v.row.destination_url !== existing.destination_url ? 'unknown' : existing.check_status,
  }).eq('id', existing.id)
  if (error) return fail(error.code === '23505' ? 'That slug is already in use.' : 'Could not save the link.')
  await session.supabase.from('reusable_link_versions').update({ status: 'superseded' }).eq('link_id', existing.id).eq('status', 'published')
  await session.supabase.from('reusable_link_versions').insert({ link_id: existing.id, workspace_id: session.workspace.id, version, snapshot: v.row, change_summary: changes.join(' + ') || 'Settings update', status: 'published', created_by: session.userId })
  await log(session, { entityType: 'reusable_link', entityId: existing.id as string, entityName: v.row.name, action: 'updated', summary: changes.length ? `updated ${changes.map(c => c.toLowerCase().replace(' update', '')).join(', ')}` : 'updated settings' })
  refresh(session)
  return ok(undefined)
}

export async function setReusableLinkStatus(input: Ctx & { linkId: string; status: 'active' | 'paused' | 'archived' | 'restore' }): Promise<ActionResult> {
  const g = await gate(input, 'reusable.manage')
  if (!g.ok) return fail(g.error)
  if (!isUuid(input.linkId)) return fail('Unknown link.')
  const update = input.status === 'archived' ? { status: 'archived', archived_at: new Date().toISOString() }
    : input.status === 'restore' ? { status: 'paused', archived_at: null }
      : input.status === 'active' || input.status === 'paused' ? { status: input.status } : null
  if (!update) return fail('Unknown status.')
  const { data, error } = await g.session.supabase.from('reusable_links').update({ ...update, updated_by: g.session.userId }).eq('id', input.linkId).eq('workspace_id', g.session.workspace.id).select('name').maybeSingle()
  if (error || !data) return fail('Could not update the link.')
  await log(g.session, { entityType: 'reusable_link', entityId: input.linkId, entityName: data.name as string, action: `status_${input.status}`, summary: input.status === 'active' ? 'enabled link' : input.status === 'paused' ? 'disabled link' : input.status === 'archived' ? 'archived link' : 'restored link' })
  refresh(g.session)
  return ok(undefined)
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (quoted) {
      if (ch === '"' && content[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && content[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim()))
}

export async function importReusableLinks(input: Ctx & { csv: string }): Promise<ActionResult<{ created: number; errors: string[] }>> {
  const g = await gate(input, 'reusable.manage')
  if (!g.ok) return fail(g.error)
  const { session } = g
  if (typeof input.csv !== 'string' || input.csv.length > 512_000) return fail('CSV files must be 500 KB or smaller.')
  const rows = parseCsv(input.csv)
  if (rows.length < 2) return fail('The CSV needs a header row and at least one link.')
  const header = rows[0].map(h => h.trim().toLowerCase())
  const col = (name: string) => header.indexOf(name)
  if (col('name') < 0 || col('destination_url') < 0) return fail('The CSV needs name and destination_url columns.')
  if (rows.length > 501) return fail('Import up to 500 links at a time.')
  const { count } = await session.supabase.from('reusable_links').select('id', { count: 'exact', head: true }).eq('workspace_id', session.workspace.id).is('archived_at', null)
  let available = count ?? 0
  const errors: string[] = []
  const seen = new Set<string>()
  let created = 0
  for (const [index, cells] of rows.slice(1).entries()) {
    const line = index + 2
    const get = (name: string) => (col(name) >= 0 ? cells[col(name)] ?? '' : '')
    const limit = checkLinkLimit(session.context, 'reusableLinks', available)
    if (!limit.allowed) { errors.push(`Row ${line}: plan limit reached.`); break }
    const v = validateReusable({ name: get('name'), destinationUrl: get('destination_url'), vanitySlug: get('vanity_slug'), label: get('label'), tags: get('tags').split(/[;|]/), ownerId: session.userId })
    if (!v.ok) { errors.push(`Row ${line}: ${v.error}`); continue }
    if (seen.has(v.row.vanity_slug)) { errors.push(`Row ${line}: duplicate slug in file.`); continue }
    seen.add(v.row.vanity_slug)
    const { data: taken } = await session.supabase.rpc('link_short_slug_taken', { p_slug: v.row.vanity_slug })
    if (taken === true) { errors.push(`Row ${line}: slug “${v.row.vanity_slug}” is taken.`); continue }
    const { data, error } = await session.supabase.from('reusable_links').insert({ ...v.row, workspace_id: session.workspace.id, owner_id: session.userId, status: 'active', created_by: session.userId, updated_by: session.userId }).select('id').single()
    if (error || !data) { errors.push(`Row ${line}: could not be saved.`); continue }
    await session.supabase.from('reusable_link_versions').insert({ link_id: data.id, workspace_id: session.workspace.id, version: 1, snapshot: v.row, change_summary: 'Imported from CSV', created_by: session.userId })
    created++; available++
  }
  if (created) await log(session, { entityType: 'reusable_link', entityId: null, entityName: 'CSV import', action: 'imported', summary: `imported ${created} reusable links` })
  refresh(session)
  return ok({ created, errors })
}

// ----------------------------------------------------------------- themes

export type ThemeInput = {
  name: string; category?: string | null; ownerId: string; brandKitId?: string | null; description?: string | null
  tags?: string[]; audience?: string; usageRules?: Record<string, boolean>; visibility?: 'private' | 'team'; notes?: string | null
  tokens: unknown; sourceThemeId?: string | null
}

export async function createTheme(input: Ctx & ThemeInput & { submit: 'draft' | 'create' }): Promise<ActionResult<{ id: string }>> {
  const g = await gate(input, 'themes.manage')
  if (!g.ok) return fail(g.error)
  const { session } = g
  const name = text(input.name, 60)
  if (!name) return fail('Enter a theme name.')
  const owner = await assertMember(session, input.ownerId)
  if (!owner) return fail('Choose an owner from this workspace.')
  const { count } = await session.supabase.from('link_themes').select('id', { count: 'exact', head: true }).eq('workspace_id', session.workspace.id).is('archived_at', null)
  const limit = checkLinkLimit(session.context, 'themes', count ?? 0)
  if (!limit.allowed) return fail(limit.message)
  let brandKitId: string | null = null
  if (input.brandKitId) {
    const { data } = await session.supabase.from('brand_kits').select('id').eq('id', input.brandKitId).eq('workspace_id', session.workspace.id).maybeSingle()
    if (!data) return fail('That brand kit is not in this workspace.')
    brandKitId = data.id as string
  }
  const tokens = normaliseTokens(input.tokens)
  const rules = input.usageRules ?? {}
  const canPublish = canAccessLinkCapability(session.context, 'themes.publish').allowed
  const { data, error } = await session.supabase.from('link_themes').insert({
    workspace_id: session.workspace.id, name, category: text(input.category, 40) || null, owner_id: owner, brand_kit_id: brandKitId,
    description: text(input.description, 200) || null, tags: (input.tags ?? []).map(t => text(t, 30)).filter(Boolean).slice(0, 10),
    audience: text(input.audience, 40) || 'all', visibility: input.visibility === 'private' ? 'private' : 'team', notes: text(input.notes, 200) || null,
    usage_rules: { link_pages: !!rules.link_pages, conversion_pages: !!rules.conversion_pages, popups: !!rules.popups, embeds: !!rules.embeds },
    tokens, status: input.submit === 'create' && canPublish ? 'active' : 'draft',
    approval_status: input.submit === 'create' ? (canPublish ? 'approved' : 'pending') : 'none',
    published_version: input.submit === 'create' && canPublish ? 1 : null, created_by: session.userId, updated_by: session.userId,
  }).select('id').single()
  if (error || !data) return fail('Could not create the theme.')
  await session.supabase.from('link_theme_versions').insert({ theme_id: data.id, workspace_id: session.workspace.id, version: 1, tokens, published: input.submit === 'create' && canPublish, status: input.submit === 'create' && canPublish ? 'published' : 'draft', change_summary: 'Initial theme release', created_by: session.userId })
  await log(session, { entityType: 'theme', entityId: data.id as string, entityName: name, action: 'created', summary: input.sourceThemeId ? 'cloned theme' : 'created theme' })
  refresh(session)
  return ok({ id: data.id as string })
}

export async function saveThemeDraft(input: Ctx & { themeId: string; tokens: unknown; name?: string }): Promise<ActionResult<{ savedAt: string }>> {
  const g = await gate(input, 'themes.manage')
  if (!g.ok) return fail(g.error)
  if (!isUuid(input.themeId)) return fail('Unknown theme.')
  const { data: theme } = await g.session.supabase.from('link_themes').select('id, archived_at').eq('id', input.themeId).eq('workspace_id', g.session.workspace.id).maybeSingle()
  if (!theme) return fail('Theme not found.')
  if (theme.archived_at) return fail('Archived themes are read-only.')
  const update: Record<string, unknown> = { tokens: normaliseTokens(input.tokens), updated_by: g.session.userId }
  if (input.name !== undefined) { const name = text(input.name, 60); if (!name) return fail('Enter a theme name.'); update.name = name }
  const { error } = await g.session.supabase.from('link_themes').update(update).eq('id', theme.id)
  if (error) return fail('Could not save the theme.')
  revalidatePath(`${g.session.basePath}/themes`, 'layout')
  return ok({ savedAt: new Date().toISOString() })
}

export async function publishTheme(input: Ctx & { themeId: string }): Promise<ActionResult<{ version: number; affectedPages: number }>> {
  const g = await gate(input, 'themes.publish')
  if (!g.ok) return fail(g.error)
  const { session } = g
  if (!isUuid(input.themeId)) return fail('Unknown theme.')
  const { data: row } = await session.supabase.from('link_themes').select(THEME_COLUMNS).eq('id', input.themeId).eq('workspace_id', session.workspace.id).maybeSingle()
  if (!row) return fail('Theme not found.')
  const theme = mapTheme(row as Record<string, unknown>)
  if (theme.archivedAt) return fail('Restore the theme before publishing.')
  const { data: latest } = await session.supabase.from('link_theme_versions').select('version, tokens').eq('theme_id', theme.id).order('version', { ascending: false }).limit(1).maybeSingle()
  const version = Number(latest?.version ?? 0) + 1
  const summary = latest ? describeTokenChanges(normaliseTokens(latest.tokens), theme.tokens) : 'Initial theme release'
  await session.supabase.from('link_theme_versions').update({ published: false, status: 'superseded' }).eq('theme_id', theme.id).eq('published', true)
  const { error } = await session.supabase.from('link_theme_versions').insert({ theme_id: theme.id, workspace_id: session.workspace.id, version, tokens: theme.tokens, published: true, status: 'published', change_summary: summary, created_by: session.userId })
  if (error) return fail('Could not publish the theme.')
  await session.supabase.from('link_themes').update({ status: 'active', approval_status: 'approved', published_version: version, updated_by: session.userId }).eq('id', theme.id)
  const { count } = await session.supabase.from('link_pages').select('id', { count: 'exact', head: true }).eq('theme_id', theme.id).is('archived_at', null)
  await log(session, { entityType: 'theme', entityId: theme.id, entityName: theme.name, action: 'published', summary: `published version ${version}`, meta: { version, affectedPages: count ?? 0 } })
  refresh(session)
  return ok({ version, affectedPages: count ?? 0 })
}

export async function setThemeLifecycle(input: Ctx & { themeId: string; action: 'submit' | 'approve' | 'request_changes' | 'archive' | 'restore' }): Promise<ActionResult> {
  const capability: LinkCapability = input.action === 'approve' || input.action === 'request_changes' ? 'themes.publish' : 'themes.manage'
  const g = await gate(input, capability)
  if (!g.ok) return fail(g.error)
  if (!isUuid(input.themeId)) return fail('Unknown theme.')
  const update = {
    submit: { approval_status: 'pending' },
    approve: { approval_status: 'approved', status: 'active' },
    request_changes: { approval_status: 'changes_requested' },
    archive: { status: 'archived', archived_at: new Date().toISOString() },
    restore: { status: 'draft', archived_at: null },
  }[input.action]
  if (!update) return fail('Unknown action.')
  const { data, error } = await g.session.supabase.from('link_themes').update({ ...update, updated_by: g.session.userId }).eq('id', input.themeId).eq('workspace_id', g.session.workspace.id).select('name').maybeSingle()
  if (error || !data) return fail('Could not update the theme.')
  const verb = { submit: 'submitted for review', approve: 'approved', request_changes: 'requested changes on', archive: 'archived', restore: 'restored' }[input.action]
  await log(g.session, { entityType: 'theme', entityId: input.themeId, entityName: data.name as string, action: input.action, summary: verb })
  refresh(g.session)
  return ok(undefined)
}

export async function duplicateTheme(input: Ctx & { themeId: string }): Promise<ActionResult<{ id: string }>> {
  const g = await gate(input, 'themes.manage')
  if (!g.ok) return fail(g.error)
  const { data: row } = await g.session.supabase.from('link_themes').select(THEME_COLUMNS).eq('id', input.themeId).eq('workspace_id', g.session.workspace.id).maybeSingle()
  if (!row) return fail('Theme not found.')
  const theme = mapTheme(row as Record<string, unknown>)
  return createTheme({
    workspaceType: input.workspaceType, submit: 'draft', name: `${theme.name} (copy)`.slice(0, 60), category: theme.category, ownerId: g.session.userId,
    description: theme.description, tags: theme.tags, audience: theme.audience, usageRules: theme.usageRules, visibility: theme.visibility,
    tokens: theme.tokens, sourceThemeId: theme.id, brandKitId: theme.brandKitId,
  })
}

export async function restoreThemeVersion(input: Ctx & { themeId: string; version: number }): Promise<ActionResult> {
  const g = await gate(input, 'versions.restore')
  if (!g.ok) return fail(g.error)
  const { data: target } = await g.session.supabase.from('link_theme_versions').select('version, tokens').eq('theme_id', input.themeId).eq('workspace_id', g.session.workspace.id).eq('version', Number(input.version)).maybeSingle()
  if (!target) return fail('Version not found.')
  const { error } = await g.session.supabase.from('link_themes').update({ tokens: target.tokens, updated_by: g.session.userId }).eq('id', input.themeId).eq('workspace_id', g.session.workspace.id)
  if (error) return fail('Could not restore the version.')
  await log(g.session, { entityType: 'theme', entityId: input.themeId, action: 'version_restored', summary: `restored version ${target.version} as a draft` })
  refresh(g.session)
  return ok(undefined)
}

// ----------------------------------------------------------------- exports

function csv(rows: (string | number | null)[][]): string {
  return rows.map(row => row.map(cell => {
    const value = cell === null ? '' : String(cell)
    // Neutralise spreadsheet formula injection.
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }).join(',')).join('\n')
}

export async function exportLinkData(input: Ctx & { kind: 'library' | 'themes' | 'analytics'; params: Record<string, string> }): Promise<ActionResult<{ filename: string; content: string }>> {
  const g = await gate(input, 'export')
  if (!g.ok) return fail(g.error)
  const { session } = g
  const params = Object.fromEntries(Object.entries(input.params ?? {}).filter(([, v]) => typeof v === 'string'))
  const { loadLibrary, loadThemes, loadAnalytics } = await import('./server/collections')
  const stamp = new Date().toISOString().slice(0, 10)
  let content = ''
  if (input.kind === 'library') {
    const data = await loadLibrary(session, { ...params, page: '1', pageSize: '48' })
    const all = data.total > data.rows.length ? await loadLibrary(session, { ...params, pageSize: String(Math.max(48, data.total)) }) : data
    content = csv([['Name', 'Type', 'Status', 'Owner', 'Tags', 'Clicks (30d)', 'CTR (30d) %', 'Theme', 'Updated', 'Public URL'],
      ...all.rows.map(r => [r.title, r.recordType, r.status, r.owner?.name ?? '', r.tags.join(' '), r.clicks, r.ctr === null ? null : r.ctr.toFixed(2), r.themeName, r.updatedAt.slice(0, 10), r.publicUrl])])
  } else if (input.kind === 'themes') {
    const data = await loadThemes(session, { ...params, pageSize: '48' })
    content = csv([['Theme', 'Category', 'Status', 'Owner', 'Pages', 'CTR uplift %', 'Updated'], ...data.rows.map(t => [t.name, t.category, t.status, t.owner?.name ?? '', t.pages, t.uplift === null ? null : t.uplift.toFixed(1), t.updatedAt.slice(0, 10)])])
  } else {
    const data = await loadAnalytics(session, { ...params, pageSize: '25' })
    content = csv([['Rank', 'Page', 'Type', 'Theme', 'Clicks', 'CTR %', 'Conversions', 'Conversion rate %', ...(data.revenueAllowed ? ['Revenue influenced (GBP)'] : []), 'Status'],
      ...data.rows.map(r => [r.rank, r.title, r.kind, r.themeName, r.clicks, r.ctr?.toFixed(2) ?? null, r.conversions, r.convRate?.toFixed(2) ?? null, ...(data.revenueAllowed ? [(r.revenuePence / 100).toFixed(2)] : []), r.status])])
  }
  await log(session, { entityType: 'export', entityId: null, entityName: input.kind, action: 'exported', summary: `exported ${input.kind}` })
  return ok({ filename: `link-in-bio-${input.kind}-${stamp}.csv`, content })
}
