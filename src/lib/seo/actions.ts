'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { assertSeoCapability, getSeoSession } from './server'
import { logAudit } from '@/lib/audit'
import type { SeoTabId } from './types'

export interface ActionResult {
  ok: boolean
  error?: string
  id?: string
  message?: string
}

function fail(error: string): ActionResult {
  return { ok: false, error }
}

const SEO_PATHS: Record<SeoTabId, string> = {
  overview: '/app/seo',
  keywords: '/app/seo/keywords',
  briefs: '/app/seo/briefs',
  rankings: '/app/seo/rankings',
  local: '/app/seo/local',
  'ai-search': '/app/seo/ai-search',
  backlinks: '/app/seo/backlinks',
}

function revalidateSeo(...tabs: SeoTabId[]) {
  for (const tab of tabs) revalidatePath(SEO_PATHS[tab])
}

async function logActivity(
  supabase: SupabaseClient,
  params: {
    workspaceId: string
    siteId: string
    actorId: string
    entityType: string
    entityId?: string | null
    action: string
    summary: string
    detail?: string | null
    link?: string | null
    severity?: 'info' | 'success' | 'warning' | 'critical'
    surface: SeoTabId
  },
) {
  const { error } = await supabase.from('seo_activity').insert({
    workspace_id: params.workspaceId,
    site_id: params.siteId,
    actor_id: params.actorId,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    action: params.action,
    summary: params.summary,
    detail: params.detail ?? null,
    link: params.link ?? null,
    severity: params.severity ?? 'info',
    surface: params.surface,
  })
  if (error) console.error('[seo] activity log failed', error.message)
}

// ── Keywords ────────────────────────────────────────────────────────────────

export interface AddKeywordsInput {
  keywords: string
  intent: string
  clusterId?: string
  newClusterName?: string
  country: string
  device: string
  searchEngine: string
  landingPage?: string
}

/** Parses one keyword per line, trims, drops blanks and duplicate lines. */
function parseKeywordLines(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of raw.split(/\r?\n|,/)) {
    const trimmed = line.trim().toLowerCase().slice(0, 200)
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out.slice(0, 200)
}

export async function addKeywords(input: AddKeywordsInput): Promise<ActionResult> {
  const session = await getSeoSession()
  const { ctx, site, supabase, userId } = session
  if (!site) return fail('Connect an SEO site before tracking keywords.')
  try {
    assertSeoCapability(ctx, 'keywords.create')
  } catch {
    return fail('You do not have permission to add keywords.')
  }

  const keywords = parseKeywordLines(input.keywords)
  if (keywords.length === 0) return fail('Enter at least one keyword.')
  if (!['informational', 'transactional', 'commercial', 'navigational', 'other'].includes(input.intent)) {
    return fail('Choose a valid search intent.')
  }

  let clusterId = input.clusterId || null
  if (!clusterId && input.newClusterName?.trim()) {
    const name = input.newClusterName.trim().slice(0, 80)
    const { data: cluster, error: clusterError } = await supabase
      .from('seo_keyword_clusters')
      .upsert(
        { workspace_id: ctx.workspaceId, site_id: site.id, name, created_by: userId },
        { onConflict: 'site_id,name', ignoreDuplicates: false },
      )
      .select('id')
      .single()
    if (clusterError) return fail('Could not create the cluster: ' + clusterError.message)
    clusterId = cluster.id
  }

  const rows = keywords.map(keyword => ({
    workspace_id: ctx.workspaceId,
    site_id: site.id,
    cluster_id: clusterId,
    keyword,
    intent: input.intent,
    country: input.country || 'gb',
    device: input.device || 'desktop',
    search_engine: input.searchEngine || 'google',
    landing_page: input.landingPage?.trim() || null,
    status: 'not_ranking' as const,
    source: 'manual',
    created_by: userId,
  }))

  const { data: inserted, error } = await supabase
    .from('seo_keywords')
    .upsert(rows, { onConflict: 'site_id,keyword,country,device,search_engine', ignoreDuplicates: true })
    .select('id')

  if (error) return fail('Could not add keywords: ' + error.message)

  const createdCount = inserted?.length ?? 0
  const skipped = keywords.length - createdCount

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, siteId: site.id, actorId: userId,
    entityType: 'keyword', action: 'created', surface: 'keywords',
    summary: createdCount === 1 ? `Keyword added: "${keywords[0]}"` : `${createdCount} keywords added`,
    detail: skipped > 0 ? `${skipped} already tracked and skipped` : null,
    link: '/app/seo/keywords',
  })
  await logAudit(supabase, userId, {
    workspaceId: ctx.workspaceId, action: 'seo.keyword.created', entityType: 'seo_keyword',
    metadata: { count: createdCount, siteId: site.id },
  })

  revalidateSeo('keywords', 'overview', 'rankings')
  return {
    ok: true,
    message: skipped > 0
      ? `${createdCount} keyword${createdCount === 1 ? '' : 's'} added, ${skipped} already tracked.`
      : `${createdCount} keyword${createdCount === 1 ? '' : 's'} added.`,
  }
}

// ── Briefs ──────────────────────────────────────────────────────────────────

export interface CreateBriefInput {
  title: string
  targetKeyword: string
  contentType: string
  intent: string
  priority: string
  dueDate?: string
}

export async function createBrief(input: CreateBriefInput): Promise<ActionResult> {
  const session = await getSeoSession()
  const { ctx, site, supabase, userId } = session
  if (!site) return fail('Connect an SEO site before creating briefs.')
  try {
    assertSeoCapability(ctx, 'briefs.create')
  } catch {
    return fail('You do not have permission to create briefs.')
  }

  const title = input.title.trim().slice(0, 200)
  const targetKeyword = input.targetKeyword.trim().slice(0, 200)
  if (!title) return fail('Give the brief a title.')
  if (!targetKeyword) return fail('Enter the target keyword.')

  const { data: keyword } = await supabase
    .from('seo_keywords')
    .select('id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('site_id', site.id)
    .ilike('keyword', targetKeyword)
    .maybeSingle()

  const { data: brief, error } = await supabase
    .from('seo_content_briefs')
    .insert({
      workspace_id: ctx.workspaceId,
      site_id: site.id,
      title,
      target_keyword: targetKeyword,
      keyword_id: keyword?.id ?? null,
      content_type: input.contentType || 'guide',
      intent: input.intent || 'informational',
      priority: input.priority || 'medium',
      status: 'draft',
      due_date: input.dueDate || null,
      owner_id: userId,
      created_by: userId,
    })
    .select('id')
    .single()

  if (error) return fail('Could not create the brief: ' + error.message)

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, siteId: site.id, actorId: userId,
    entityType: 'brief', entityId: brief.id, action: 'created', surface: 'briefs',
    summary: `Brief created: "${title}"`, link: `/app/seo/briefs/${brief.id}`,
  })
  await logAudit(supabase, userId, {
    workspaceId: ctx.workspaceId, action: 'seo.brief.created', entityType: 'seo_content_brief', entityId: brief.id,
  })

  revalidateSeo('briefs', 'overview')
  return { ok: true, id: brief.id, message: 'Brief created.' }
}

// ── Local ───────────────────────────────────────────────────────────────────

export interface AddLocationInput {
  name: string
  addressLine?: string
  city?: string
  region?: string
  postcode?: string
  country: string
  phone?: string
  website?: string
  primaryCategory?: string
}

export async function addLocation(input: AddLocationInput): Promise<ActionResult> {
  const session = await getSeoSession()
  const { ctx, site, supabase, userId } = session
  if (!site) return fail('Connect an SEO site before adding locations.')
  try {
    assertSeoCapability(ctx, 'local.create')
  } catch {
    return fail('You do not have permission to add locations.')
  }

  const name = input.name.trim().slice(0, 160)
  if (!name) return fail('Give the location a name.')
  if (!input.addressLine?.trim()) return fail('Enter an address for this location.')

  const { data: existing } = await supabase
    .from('seo_locations')
    .select('id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('site_id', site.id)
    .ilike('name', name)
    .ilike('address_line', input.addressLine.trim())
    .is('archived_at', null)
    .maybeSingle()
  if (existing) return fail('A location with this name and address already exists.')

  const { data: location, error } = await supabase
    .from('seo_locations')
    .insert({
      workspace_id: ctx.workspaceId,
      site_id: site.id,
      name,
      address_line: input.addressLine?.trim() || null,
      city: input.city?.trim() || null,
      region: input.region?.trim() || null,
      postcode: input.postcode?.trim() || null,
      country: input.country || 'gb',
      phone: input.phone?.trim() || null,
      website: input.website?.trim() || null,
      primary_category: input.primaryCategory?.trim() || null,
      status: 'pending',
      created_by: userId,
    })
    .select('id')
    .single()

  if (error) return fail('Could not add the location: ' + error.message)

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, siteId: site.id, actorId: userId,
    entityType: 'location', entityId: location.id, action: 'created', surface: 'local',
    summary: `Location added: "${name}"`, link: '/app/seo/local',
  })
  await logAudit(supabase, userId, {
    workspaceId: ctx.workspaceId, action: 'seo.location.created', entityType: 'seo_location', entityId: location.id,
  })

  revalidateSeo('local', 'overview')
  return { ok: true, id: location.id, message: 'Location added.' }
}

// ── AI Search ───────────────────────────────────────────────────────────────

export interface TrackPromptInput {
  prompt: string
  engine: string
  region: string
  frequency: string
  linkedPage?: string
}

export async function trackPrompt(input: TrackPromptInput): Promise<ActionResult> {
  const session = await getSeoSession()
  const { ctx, site, supabase, userId } = session
  if (!site) return fail('Connect an SEO site before tracking prompts.')
  try {
    assertSeoCapability(ctx, 'aiSearch.track')
  } catch {
    return fail('You do not have permission to track prompts.')
  }

  const prompt = input.prompt.trim().slice(0, 300)
  if (!prompt) return fail('Enter a prompt to track.')
  const engines = ['chatgpt', 'perplexity', 'google_sge', 'gemini', 'claude', 'bing_copilot']
  if (!engines.includes(input.engine)) return fail('Choose a valid answer engine.')

  const { data: existing } = await supabase
    .from('seo_ai_prompts')
    .select('id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('site_id', site.id)
    .eq('engine', input.engine)
    .eq('region', input.region || 'gb')
    .ilike('prompt', prompt)
    .is('archived_at', null)
    .maybeSingle()
  if (existing) return fail('This prompt is already tracked for that engine and region.')

  const { data: created, error } = await supabase
    .from('seo_ai_prompts')
    .insert({
      workspace_id: ctx.workspaceId,
      site_id: site.id,
      prompt,
      engine: input.engine,
      region: input.region || 'gb',
      language: 'en',
      frequency: input.frequency || 'weekly',
      linked_page: input.linkedPage?.trim() || null,
      citation_status: 'unknown',
      method: 'manual_check',
      status: 'active',
      created_by: userId,
    })
    .select('id')
    .single()

  if (error) return fail('Could not track the prompt: ' + error.message)

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, siteId: site.id, actorId: userId,
    entityType: 'ai_prompt', entityId: created.id, action: 'created', surface: 'ai-search',
    summary: `New prompt tracked: "${prompt}"`, link: '/app/seo/ai-search',
  })
  await logAudit(supabase, userId, {
    workspaceId: ctx.workspaceId, action: 'seo.ai_prompt.created', entityType: 'seo_ai_prompt', entityId: created.id,
  })

  revalidateSeo('ai-search', 'overview')
  return { ok: true, id: created.id, message: 'Prompt tracked. The first check will run on the next collection cycle.' }
}

// ── Backlinks ───────────────────────────────────────────────────────────────

export interface CreateOutreachListInput {
  name: string
  description?: string
}

export async function createOutreachList(input: CreateOutreachListInput): Promise<ActionResult> {
  const session = await getSeoSession()
  const { ctx, site, supabase, userId } = session
  if (!site) return fail('Connect an SEO site before creating outreach lists.')
  try {
    assertSeoCapability(ctx, 'backlinks.createOutreach')
  } catch {
    return fail('You do not have permission to create outreach lists.')
  }

  const name = input.name.trim().slice(0, 120)
  if (!name) return fail('Give the outreach list a name.')

  const { data: existing } = await supabase
    .from('seo_outreach_lists')
    .select('id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('site_id', site.id)
    .ilike('name', name)
    .is('archived_at', null)
    .maybeSingle()
  if (existing) return fail('An outreach list with this name already exists.')

  const { data: list, error } = await supabase
    .from('seo_outreach_lists')
    .insert({
      workspace_id: ctx.workspaceId,
      site_id: site.id,
      name,
      description: input.description?.trim() || null,
      owner_id: userId,
      status: 'active',
      created_by: userId,
    })
    .select('id')
    .single()

  if (error) return fail('Could not create the outreach list: ' + error.message)

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, siteId: site.id, actorId: userId,
    entityType: 'outreach_list', entityId: list.id, action: 'created', surface: 'backlinks',
    summary: `Outreach list created: "${name}"`, link: '/app/seo/backlinks?view=opportunities',
  })
  await logAudit(supabase, userId, {
    workspaceId: ctx.workspaceId, action: 'seo.outreach_list.created', entityType: 'seo_outreach_list', entityId: list.id,
  })

  revalidateSeo('backlinks')
  return { ok: true, id: list.id, message: 'Outreach list created.' }
}

export async function addOpportunityToList(listId: string, opportunityId: string): Promise<ActionResult> {
  const session = await getSeoSession()
  const { ctx, site, supabase, userId } = session
  if (!site) return fail('No active SEO site.')
  try {
    assertSeoCapability(ctx, 'backlinks.createOutreach')
  } catch {
    return fail('You do not have permission to manage outreach lists.')
  }

  const { data: opportunity } = await supabase
    .from('seo_link_opportunities')
    .select('id, domain')
    .eq('workspace_id', ctx.workspaceId)
    .eq('site_id', site.id)
    .eq('id', opportunityId)
    .maybeSingle()
  if (!opportunity) return fail('Opportunity not found.')

  const { error } = await supabase
    .from('seo_outreach_list_items')
    .upsert(
      { workspace_id: ctx.workspaceId, list_id: listId, opportunity_id: opportunity.id, domain: opportunity.domain, assigned_to: userId },
      { onConflict: 'list_id,domain', ignoreDuplicates: true },
    )
  if (error) return fail('Could not add to the list: ' + error.message)

  revalidateSeo('backlinks')
  return { ok: true, message: `${opportunity.domain} added to the list.` }
}

// ── Brief detail page: status, outline, comments ────────────────────────────

const BRIEF_STATUSES = ['draft', 'in_progress', 'awaiting_review', 'changes_requested', 'approved', 'published', 'archived'] as const
type BriefStatus = typeof BRIEF_STATUSES[number]

function revalidateBrief(id: string) {
  revalidateSeo('briefs', 'overview')
  revalidatePath(`/app/seo/briefs/${id}`)
}

export async function updateBriefStatus(briefId: string, status: string): Promise<ActionResult> {
  const session = await getSeoSession()
  const { ctx, site, supabase, userId } = session
  if (!site) return fail('No active SEO site.')
  if (!BRIEF_STATUSES.includes(status as BriefStatus)) return fail('Not a valid status.')

  try {
    assertSeoCapability(ctx, status === 'published' ? 'briefs.publish' : 'briefs.edit')
  } catch {
    return fail(status === 'published'
      ? 'You do not have permission to publish briefs.'
      : 'You do not have permission to change this brief\'s status.')
  }

  const { data: brief } = await supabase
    .from('seo_content_briefs')
    .select('id, title, status')
    .eq('workspace_id', ctx.workspaceId)
    .eq('site_id', site.id)
    .eq('id', briefId)
    .maybeSingle()
  if (!brief) return fail('Brief not found.')
  if (brief.status === status) return { ok: true, message: 'Status unchanged.' }

  const patch: Record<string, unknown> = { status, updated_by: userId }
  if (status === 'published') patch.published_at = new Date().toISOString()

  const { error } = await supabase
    .from('seo_content_briefs')
    .update(patch)
    .eq('workspace_id', ctx.workspaceId)
    .eq('id', briefId)
  if (error) return fail('Could not update status: ' + error.message)

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, siteId: site.id, actorId: userId,
    entityType: 'brief', entityId: briefId, action: 'status_changed', surface: 'briefs',
    summary: `"${brief.title}" moved from ${brief.status.replace(/_/g, ' ')} to ${status.replace(/_/g, ' ')}`,
    link: `/app/seo/briefs/${briefId}`, severity: status === 'published' ? 'success' : 'info',
  })
  await logAudit(supabase, userId, {
    workspaceId: ctx.workspaceId, action: 'seo.brief.status_changed', entityType: 'seo_content_brief', entityId: briefId,
    metadata: { from: brief.status, to: status },
  })

  revalidateBrief(briefId)
  return { ok: true, message: `Status changed to ${status.replace(/_/g, ' ')}.` }
}

export async function addBriefComment(briefId: string, body: string, parentId?: string): Promise<ActionResult> {
  const session = await getSeoSession()
  const { ctx, site, supabase, userId } = session
  if (!site) return fail('No active SEO site.')
  try {
    assertSeoCapability(ctx, 'briefs.comment')
  } catch {
    return fail('You do not have permission to comment on briefs.')
  }

  const text = body.trim().slice(0, 2000)
  if (!text) return fail('Write a comment before posting.')

  const { data: brief } = await supabase
    .from('seo_content_briefs')
    .select('id, title')
    .eq('workspace_id', ctx.workspaceId)
    .eq('site_id', site.id)
    .eq('id', briefId)
    .maybeSingle()
  if (!brief) return fail('Brief not found.')

  const { error } = await supabase
    .from('seo_brief_comments')
    .insert({ workspace_id: ctx.workspaceId, brief_id: briefId, parent_id: parentId ?? null, author_id: userId, body: text })
  if (error) return fail('Could not post the comment: ' + error.message)

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, siteId: site.id, actorId: userId,
    entityType: 'brief', entityId: briefId, action: 'commented', surface: 'briefs',
    summary: `New comment on "${brief.title}"`, link: `/app/seo/briefs/${briefId}`,
  })

  revalidateBrief(briefId)
  return { ok: true, message: 'Comment posted.' }
}

export interface AddBriefSectionInput {
  briefId: string
  level: 'h1' | 'h2' | 'h3'
  title: string
}

export async function addBriefSection(input: AddBriefSectionInput): Promise<ActionResult> {
  const session = await getSeoSession()
  const { ctx, site, supabase, userId } = session
  if (!site) return fail('No active SEO site.')
  try {
    assertSeoCapability(ctx, 'briefs.edit')
  } catch {
    return fail('You do not have permission to edit this brief\'s outline.')
  }

  const title = input.title.trim().slice(0, 200)
  if (!title) return fail('Enter a section title.')

  const { data: brief } = await supabase
    .from('seo_content_briefs')
    .select('id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('site_id', site.id)
    .eq('id', input.briefId)
    .maybeSingle()
  if (!brief) return fail('Brief not found.')

  const { count } = await supabase
    .from('seo_brief_sections')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', ctx.workspaceId)
    .eq('brief_id', input.briefId)

  const { error } = await supabase
    .from('seo_brief_sections')
    .insert({ workspace_id: ctx.workspaceId, brief_id: input.briefId, level: input.level, title, position: (count ?? 0) + 1 })
  if (error) return fail('Could not add the section: ' + error.message)

  revalidateBrief(input.briefId)
  return { ok: true, message: 'Section added.' }
}

export async function toggleBriefSection(briefId: string, sectionId: string): Promise<ActionResult> {
  const session = await getSeoSession()
  const { ctx, site, supabase, userId } = session
  if (!site) return fail('No active SEO site.')
  try {
    assertSeoCapability(ctx, 'briefs.edit')
  } catch {
    return fail('You do not have permission to edit this brief\'s outline.')
  }

  const { data: section } = await supabase
    .from('seo_brief_sections')
    .select('id, completed')
    .eq('workspace_id', ctx.workspaceId)
    .eq('brief_id', briefId)
    .eq('id', sectionId)
    .maybeSingle()
  if (!section) return fail('Section not found.')

  const { error } = await supabase
    .from('seo_brief_sections')
    .update({ completed: !section.completed })
    .eq('workspace_id', ctx.workspaceId)
    .eq('id', sectionId)
  if (error) return fail('Could not update the section: ' + error.message)

  await recalculateBriefCompletion(supabase, ctx.workspaceId, briefId)
  revalidateBrief(briefId)
  return { ok: true }
}

export async function removeBriefSection(briefId: string, sectionId: string): Promise<ActionResult> {
  const session = await getSeoSession()
  const { ctx, site, supabase } = session
  if (!site) return fail('No active SEO site.')
  try {
    assertSeoCapability(ctx, 'briefs.edit')
  } catch {
    return fail('You do not have permission to edit this brief\'s outline.')
  }

  const { error } = await supabase
    .from('seo_brief_sections')
    .delete()
    .eq('workspace_id', ctx.workspaceId)
    .eq('brief_id', briefId)
    .eq('id', sectionId)
  if (error) return fail('Could not remove the section: ' + error.message)

  await recalculateBriefCompletion(supabase, ctx.workspaceId, briefId)
  revalidateBrief(briefId)
  return { ok: true, message: 'Section removed.' }
}

export async function moveBriefSection(briefId: string, sectionId: string, direction: 'up' | 'down'): Promise<ActionResult> {
  const session = await getSeoSession()
  const { ctx, site, supabase } = session
  if (!site) return fail('No active SEO site.')
  try {
    assertSeoCapability(ctx, 'briefs.edit')
  } catch {
    return fail('You do not have permission to edit this brief\'s outline.')
  }

  const { data: sections } = await supabase
    .from('seo_brief_sections')
    .select('id, position')
    .eq('workspace_id', ctx.workspaceId)
    .eq('brief_id', briefId)
    .order('position')
  if (!sections) return fail('Could not load the outline.')

  const index = sections.findIndex(s => s.id === sectionId)
  const swapIndex = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || swapIndex < 0 || swapIndex >= sections.length) return { ok: true }

  const a = sections[index]
  const b = sections[swapIndex]
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from('seo_brief_sections').update({ position: b.position }).eq('workspace_id', ctx.workspaceId).eq('id', a.id),
    supabase.from('seo_brief_sections').update({ position: a.position }).eq('workspace_id', ctx.workspaceId).eq('id', b.id),
  ])
  if (e1 || e2) return fail('Could not reorder the outline.')

  revalidateBrief(briefId)
  return { ok: true }
}

async function recalculateBriefCompletion(supabase: SupabaseClient, workspaceId: string, briefId: string) {
  const { data: sections } = await supabase
    .from('seo_brief_sections')
    .select('completed')
    .eq('workspace_id', workspaceId)
    .eq('brief_id', briefId)
  if (!sections || sections.length === 0) return
  const completion = Math.round((sections.filter(s => s.completed).length / sections.length) * 100)
  await supabase.from('seo_content_briefs').update({ completion }).eq('workspace_id', workspaceId).eq('id', briefId)
}
