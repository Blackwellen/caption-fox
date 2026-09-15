'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getStrategySession } from '@/lib/strategy/server'
import { logActivity } from '@/lib/strategy/data'
import { canTransitionObjective, canTransitionResearch } from '@/lib/strategy/constants'
import type { StrategyCapabilities } from '@/lib/strategy/entitlements'

export interface ActionResult {
  ok: boolean
  error?: string
  id?: string
  message?: string
}

const STRATEGY_PATHS = [
  '/app/strategy', '/app/strategy/objectives', '/app/strategy/audiences',
  '/app/strategy/research', '/app/strategy/positioning', '/app/strategy/plans',
  '/app/strategy/forecasts',
]

function revalidateStrategy() {
  for (const path of STRATEGY_PATHS) revalidatePath(path)
}

function fail(error: string): ActionResult {
  return { ok: false, error }
}

/** Resolves the session and asserts one capability in a single step. */
async function authorise(capability: keyof StrategyCapabilities) {
  const session = await getStrategySession()
  if (!session.capabilities[capability]) {
    return { session: null, error: 'Your role does not allow this action.' } as const
  }
  return { session, error: null } as const
}

/** Confirms a record belongs to the active workspace before mutating it. */
async function ownsRecord(
  supabase: SupabaseClient, table: string, id: string, workspaceId: string,
): Promise<boolean> {
  const { data } = await supabase.from(table).select('id').eq('id', id).eq('workspace_id', workspaceId).maybeSingle()
  return Boolean(data)
}

// ============================================================================
// Objectives
// ============================================================================

export interface ObjectiveInput {
  name: string
  description?: string
  objective_type?: string
  priority?: string
  owner_id?: string
  due_date?: string
  start_date?: string
  target_summary?: string
  next_action?: string
  tags?: string[]
}

function validateObjective(input: ObjectiveInput): string | null {
  const name = input.name?.trim()
  if (!name) return 'Objective name is required.'
  if (name.length > 140) return 'Objective name must be 140 characters or fewer.'
  if (input.start_date && input.due_date && input.due_date < input.start_date) {
    return 'Due date cannot be before the start date.'
  }
  return null
}

export async function createObjective(input: ObjectiveInput): Promise<ActionResult> {
  const { session, error } = await authorise('createObjective')
  if (!session) return fail(error)

  const invalid = validateObjective(input)
  if (invalid) return fail(invalid)

  const { supabase, ctx, userId } = session
  const name = input.name.trim()

  const { data: existing } = await supabase.from('strategy_objectives')
    .select('id').eq('workspace_id', ctx.workspaceId).eq('name', name).is('archived_at', null).maybeSingle()
  if (existing) return fail('An objective with this name already exists.')

  const { data, error: insertError } = await supabase.from('strategy_objectives').insert({
    workspace_id: ctx.workspaceId,
    name,
    description: input.description?.trim() || null,
    objective_type: input.objective_type || 'growth',
    priority: input.priority || 'medium',
    owner_id: input.owner_id || userId,
    start_date: input.start_date || null,
    due_date: input.due_date || null,
    target_summary: input.target_summary?.trim() || null,
    next_action: input.next_action?.trim() || null,
    tags: input.tags ?? [],
    status: 'not_started',
    created_by: userId,
  }).select('id').single()

  if (insertError) return fail('Could not create the objective. Please try again.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'objective', entityId: data.id,
    action: 'created objective', summary: `Created objective "${name}"`,
    link: '/app/strategy/objectives', surface: 'objectives',
  })

  revalidateStrategy()
  return { ok: true, id: data.id, message: 'Objective created.' }
}

export async function updateObjectiveStatus(id: string, status: string): Promise<ActionResult> {
  const { session, error } = await authorise('editObjective')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: current } = await supabase.from('strategy_objectives')
    .select('id, name, status').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Objective not found.')
  if (!canTransitionObjective(current.status, status)) return fail('That status change is not allowed.')

  const { error: updateError } = await supabase.from('strategy_objectives')
    .update({ status, archived_at: status === 'archived' ? new Date().toISOString() : null })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail('Could not update status.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'objective', entityId: id,
    action: 'updated objective', summary: `"${current.name}" status changed to ${status.replace('_', ' ')}`,
    link: '/app/strategy/objectives', surface: 'objectives',
  })

  revalidateStrategy()
  return { ok: true, message: 'Status updated.' }
}

export async function updateObjectiveProgress(id: string, progress: number): Promise<ActionResult> {
  const { session, error } = await authorise('editObjective')
  if (!session) return fail(error)
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) return fail('Progress must be between 0 and 100.')

  const { supabase, ctx, userId } = session
  const owns = await ownsRecord(supabase, 'strategy_objectives', id, ctx.workspaceId)
  if (!owns) return fail('Objective not found.')

  const { error: updateError } = await supabase.from('strategy_objectives')
    .update({ progress }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail('Could not update progress.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'objective', entityId: id,
    action: 'updated objective', summary: `Progress updated to ${Math.round(progress)}%`,
    link: '/app/strategy/objectives', surface: 'objectives',
  })

  revalidateStrategy()
  return { ok: true }
}

export async function assignObjectiveOwner(id: string, ownerId: string): Promise<ActionResult> {
  const { session, error } = await authorise('editObjective')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const owns = await ownsRecord(supabase, 'strategy_objectives', id, ctx.workspaceId)
  if (!owns) return fail('Objective not found.')

  const { error: updateError } = await supabase.from('strategy_objectives')
    .update({ owner_id: ownerId }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail('Could not assign owner.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'objective', entityId: id,
    action: 'reassigned objective', summary: 'Owner reassigned',
    link: '/app/strategy/objectives', surface: 'objectives',
  })

  revalidateStrategy()
  return { ok: true }
}

export async function linkObjectiveAudience(objectiveId: string, audienceId: string): Promise<ActionResult> {
  const { session, error } = await authorise('editObjective')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const [ownsObjective, ownsAudience] = await Promise.all([
    ownsRecord(supabase, 'strategy_objectives', objectiveId, ctx.workspaceId),
    ownsRecord(supabase, 'strategy_audiences', audienceId, ctx.workspaceId),
  ])
  if (!ownsObjective || !ownsAudience) return fail('Record not found.')

  const { error: insertError } = await supabase.from('strategy_links').upsert({
    workspace_id: ctx.workspaceId, source_type: 'objective', source_id: objectiveId,
    target_type: 'audience', target_id: audienceId, created_by: userId,
  }, { onConflict: 'source_type,source_id,target_type,target_id', ignoreDuplicates: true })
  if (insertError) return fail('Could not link audience.')

  revalidateStrategy()
  return { ok: true, message: 'Audience linked.' }
}

export async function archiveObjective(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('deleteObjective')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: current } = await supabase.from('strategy_objectives')
    .select('id, name').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Objective not found.')

  const { error: updateError } = await supabase.from('strategy_objectives')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail('Could not archive objective.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'objective', entityId: id,
    action: 'archived objective', summary: `Archived "${current.name}"`,
    link: '/app/strategy/objectives', surface: 'objectives',
  })

  revalidateStrategy()
  return { ok: true, message: 'Objective archived.' }
}

export async function restoreObjective(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('editObjective')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const owns = await ownsRecord(supabase, 'strategy_objectives', id, ctx.workspaceId)
  if (!owns) return fail('Objective not found.')

  const { error: updateError } = await supabase.from('strategy_objectives')
    .update({ status: 'not_started', archived_at: null }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail('Could not restore objective.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'objective', entityId: id,
    action: 'restored objective', summary: 'Objective restored from archive',
    link: '/app/strategy/objectives', surface: 'objectives',
  })

  revalidateStrategy()
  return { ok: true, message: 'Objective restored.' }
}

// ============================================================================
// Audiences
// ============================================================================

export interface AudienceInput {
  name: string
  description?: string
  lifecycle_stage?: string
  audience_size?: string
  owner_id?: string
  channels?: string[]
  tags?: string[]
}

export async function createAudience(input: AudienceInput): Promise<ActionResult> {
  const { session, error } = await authorise('createAudience')
  if (!session) return fail(error)

  const name = input.name?.trim()
  if (!name) return fail('Audience name is required.')
  if (name.length > 140) return fail('Audience name must be 140 characters or fewer.')

  const { supabase, ctx, userId } = session
  const { data: existing } = await supabase.from('strategy_audiences')
    .select('id').eq('workspace_id', ctx.workspaceId).eq('name', name).is('archived_at', null).maybeSingle()
  if (existing) return fail('An audience with this name already exists.')

  const size = input.audience_size ? Number(input.audience_size) : 0
  if (input.audience_size && (!Number.isFinite(size) || size < 0)) return fail('Audience size must be a positive number.')

  const { data, error: insertError } = await supabase.from('strategy_audiences').insert({
    workspace_id: ctx.workspaceId,
    name,
    description: input.description?.trim() || null,
    lifecycle_stage: input.lifecycle_stage || 'awareness',
    audience_size: size,
    owner_id: input.owner_id || userId,
    channels: input.channels ?? [],
    tags: input.tags ?? [],
    status: 'active',
    source: 'manual',
    created_by: userId,
  }).select('id').single()

  if (insertError) return fail('Could not create the audience. Please try again.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'audience', entityId: data.id,
    action: 'created audience', summary: `Created audience "${name}"`,
    link: '/app/strategy/audiences', surface: 'audiences',
  })

  revalidateStrategy()
  return { ok: true, id: data.id, message: 'Audience created.' }
}

export interface ImportAudiencesInput {
  rows: { name: string; audience_size?: number; lifecycle_stage?: string }[]
}

/** Bulk-imports audience segments from a parsed CSV. Row-level, not all-or-nothing. */
export async function importAudiences(input: ImportAudiencesInput): Promise<ActionResult> {
  const { session, error } = await authorise('importAudiences')
  if (!session) return fail(error)
  if (!input.rows?.length) return fail('No rows to import.')
  if (input.rows.length > 500) return fail('Import is limited to 500 rows at a time.')

  const { supabase, ctx, userId } = session
  const valid = input.rows.filter(row => row.name?.trim()).slice(0, 500)
  if (valid.length === 0) return fail('No valid rows found — each row needs a name.')

  const { error: insertError, count } = await supabase.from('strategy_audiences').insert(
    valid.map(row => ({
      workspace_id: ctx.workspaceId,
      name: row.name.trim().slice(0, 140),
      audience_size: Number.isFinite(row.audience_size) ? Math.max(0, Number(row.audience_size)) : 0,
      lifecycle_stage: row.lifecycle_stage || 'awareness',
      owner_id: userId, status: 'active', source: 'import', created_by: userId,
    })),
    { count: 'exact' },
  )
  if (insertError) return fail('Import failed. Please check the file and try again.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'audience',
    action: 'imported audiences', summary: `Imported ${count ?? valid.length} audience segments`,
    link: '/app/strategy/audiences', surface: 'audiences',
  })

  revalidateStrategy()
  return { ok: true, message: `Imported ${count ?? valid.length} audiences.` }
}

/** Manual CRM sync trigger — records the sync in activity; a real provider call is workspace-configured elsewhere. */
export async function syncAudiencesFromCrm(): Promise<ActionResult> {
  const { session, error } = await authorise('syncCrm')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'audience',
    action: 'synced audiences', summary: 'Requested a CRM audience sync',
    link: '/app/strategy/audiences', surface: 'audiences',
  })

  revalidateStrategy()
  return { ok: true, message: 'Sync requested. New and updated segments will appear shortly.' }
}

export async function archiveAudience(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('editAudience')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: current } = await supabase.from('strategy_audiences')
    .select('id, name').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Audience not found.')

  const { error: updateError } = await supabase.from('strategy_audiences')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail('Could not archive audience.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'audience', entityId: id,
    action: 'archived audience', summary: `Archived "${current.name}"`,
    link: '/app/strategy/audiences', surface: 'audiences',
  })

  revalidateStrategy()
  return { ok: true, message: 'Audience archived.' }
}

// ============================================================================
// Research
// ============================================================================

export interface ResearchInput {
  title: string
  summary?: string
  source_type?: string
  impact?: string
  theme?: string
  collection_id?: string
  owner_id?: string
  tags?: string[]
}

export async function createResearch(input: ResearchInput): Promise<ActionResult> {
  const { session, error } = await authorise('createResearch')
  if (!session) return fail(error)

  const title = input.title?.trim()
  if (!title) return fail('Research title is required.')
  if (title.length > 160) return fail('Title must be 160 characters or fewer.')

  const { supabase, ctx, userId } = session
  const { data, error: insertError } = await supabase.from('strategy_research_items').insert({
    workspace_id: ctx.workspaceId,
    title,
    summary: input.summary?.trim() || null,
    source_type: input.source_type || 'market_research',
    impact: input.impact || 'medium',
    theme: input.theme?.trim() || null,
    collection_id: input.collection_id || null,
    owner_id: input.owner_id || userId,
    tags: input.tags ?? [],
    status: 'draft',
    created_by: userId,
  }).select('id').single()

  if (insertError) return fail('Could not create the research item. Please try again.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'research', entityId: data.id,
    action: 'added research', summary: `Added research "${title}"`,
    link: '/app/strategy/research', surface: 'research',
  })

  revalidateStrategy()
  return { ok: true, id: data.id, message: 'Research item created.' }
}

export interface UploadResearchFileInput {
  title: string
  file_path: string
  file_name: string
  file_type: string
  file_size: number
  source_type?: string
}

/** Attaches a storage-backed upload (path only — never a pasted external URL). */
export async function uploadResearchFile(input: UploadResearchFileInput): Promise<ActionResult> {
  const { session, error } = await authorise('uploadResearch')
  if (!session) return fail(error)

  const title = input.title?.trim()
  if (!title) return fail('Title is required.')
  if (!input.file_path) return fail('File upload failed — no storage path returned.')

  const { supabase, ctx, userId } = session
  const { data, error: insertError } = await supabase.from('strategy_research_items').insert({
    workspace_id: ctx.workspaceId,
    title,
    source_type: input.source_type || 'market_research',
    impact: 'medium',
    file_path: input.file_path,
    file_name: input.file_name,
    file_type: input.file_type,
    file_size: input.file_size,
    owner_id: userId,
    status: 'draft',
    created_by: userId,
  }).select('id').single()

  if (insertError) return fail('Could not save the uploaded research file.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'research', entityId: data.id,
    action: 'uploaded research', summary: `Uploaded "${input.file_name}"`,
    link: '/app/strategy/research', surface: 'research',
  })

  revalidateStrategy()
  return { ok: true, id: data.id, message: 'File uploaded.' }
}

export async function toggleResearchFavourite(id: string, favourite: boolean): Promise<ActionResult> {
  const { session, error } = await authorise('view')
  if (!session) return fail(error)
  const { supabase, ctx } = session

  const owns = await ownsRecord(supabase, 'strategy_research_items', id, ctx.workspaceId)
  if (!owns) return fail('Research item not found.')

  const { error: updateError } = await supabase.from('strategy_research_items')
    .update({ is_favourite: favourite }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail('Could not update favourite.')

  revalidateStrategy()
  return { ok: true }
}

export async function updateResearchStatus(id: string, status: string): Promise<ActionResult> {
  const { session, error } = await authorise('approveResearch')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: current } = await supabase.from('strategy_research_items')
    .select('id, title, status').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Research item not found.')
  if (!canTransitionResearch(current.status, status)) return fail('That status change is not allowed.')

  const { error: updateError } = await supabase.from('strategy_research_items').update({
    status,
    reviewed_by: status === 'approved' || status === 'needs_revision' ? userId : undefined,
    reviewed_at: status === 'approved' || status === 'needs_revision' ? new Date().toISOString() : undefined,
    archived_at: status === 'archived' ? new Date().toISOString() : null,
  }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail('Could not update status.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'research', entityId: id,
    action: status === 'approved' ? 'approved research' : 'updated research',
    summary: `"${current.title}" status changed to ${status.replace('_', ' ')}`,
    link: '/app/strategy/research', surface: 'research',
  })

  revalidateStrategy()
  return { ok: true, message: 'Status updated.' }
}

export async function moveResearchToCollection(id: string, collectionId: string | null): Promise<ActionResult> {
  const { session, error } = await authorise('view')
  if (!session) return fail(error)
  const { supabase, ctx } = session

  const owns = await ownsRecord(supabase, 'strategy_research_items', id, ctx.workspaceId)
  if (!owns) return fail('Research item not found.')
  if (collectionId) {
    const ownsCollection = await ownsRecord(supabase, 'strategy_research_collections', collectionId, ctx.workspaceId)
    if (!ownsCollection) return fail('Collection not found.')
  }

  const { error: updateError } = await supabase.from('strategy_research_items')
    .update({ collection_id: collectionId }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail('Could not move item.')

  revalidateStrategy()
  return { ok: true, message: 'Moved to collection.' }
}

export async function createCollection(name: string): Promise<ActionResult> {
  const { session, error } = await authorise('createResearch')
  if (!session) return fail(error)
  const trimmed = name?.trim()
  if (!trimmed) return fail('Collection name is required.')

  const { supabase, ctx } = session
  const { data, error: insertError } = await supabase.from('strategy_research_collections')
    .insert({ workspace_id: ctx.workspaceId, name: trimmed })
    .select('id').single()
  if (insertError) return fail('A collection with this name may already exist.')

  revalidateStrategy()
  return { ok: true, id: data.id, message: 'Collection created.' }
}

export async function archiveResearch(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('deleteResearch')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: current } = await supabase.from('strategy_research_items')
    .select('id, title').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Research item not found.')

  const { error: updateError } = await supabase.from('strategy_research_items')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail('Could not archive research item.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'research', entityId: id,
    action: 'archived research', summary: `Archived "${current.title}"`,
    link: '/app/strategy/research', surface: 'research',
  })

  revalidateStrategy()
  return { ok: true, message: 'Research item archived.' }
}

// ============================================================================
// Positioning
// ============================================================================

export interface FrameworkInput {
  name: string
  category_promise?: string
  positioning_statement?: string
  target_audience_id?: string
}

export async function createFramework(input: FrameworkInput): Promise<ActionResult> {
  const { session, error } = await authorise('createFramework')
  if (!session) return fail(error)

  const name = input.name?.trim()
  if (!name) return fail('Framework name is required.')

  const { supabase, ctx, userId } = session
  const { data, error: insertError } = await supabase.from('strategy_positioning_frameworks').insert({
    workspace_id: ctx.workspaceId,
    name,
    category_promise: input.category_promise?.trim() || null,
    positioning_statement: input.positioning_statement?.trim() || null,
    target_audience_id: input.target_audience_id || null,
    status: 'draft',
    owner_id: userId,
    created_by: userId,
  }).select('id').single()

  if (insertError) return fail('Could not create the framework. Please try again.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'framework', entityId: data.id,
    action: 'created framework', summary: `Created positioning framework "${name}"`,
    link: '/app/strategy/positioning', surface: 'positioning',
  })

  revalidateStrategy()
  return { ok: true, id: data.id, message: 'Framework created.' }
}

export async function addProofPoint(frameworkId: string, label: string, category: string): Promise<ActionResult> {
  const { session, error } = await authorise('editFramework')
  if (!session) return fail(error)
  const trimmed = label?.trim()
  if (!trimmed) return fail('Proof point is required.')

  const { supabase, ctx, userId } = session
  const owns = await ownsRecord(supabase, 'strategy_positioning_frameworks', frameworkId, ctx.workspaceId)
  if (!owns) return fail('Framework not found.')

  const { error: insertError } = await supabase.from('strategy_proof_points').insert({
    workspace_id: ctx.workspaceId, framework_id: frameworkId, label: trimmed,
    category: category || 'trust', impact: 'medium', verification: 'unverified', created_by: userId,
  })
  if (insertError) return fail('Could not add proof point.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'proof_point',
    action: 'added proof point', summary: `Added proof point "${trimmed}"`,
    link: '/app/strategy/positioning', surface: 'positioning',
  })

  revalidateStrategy()
  return { ok: true, message: 'Proof point added.' }
}

export async function updateMatrixScore(competitorId: string, attributeId: string, score: string): Promise<ActionResult> {
  const { session, error } = await authorise('editFramework')
  if (!session) return fail(error)
  const { supabase, ctx } = session

  const [ownsCompetitor, ownsAttribute] = await Promise.all([
    ownsRecord(supabase, 'strategy_competitors', competitorId, ctx.workspaceId),
    ownsRecord(supabase, 'strategy_competitor_attributes', attributeId, ctx.workspaceId),
  ])
  if (!ownsCompetitor || !ownsAttribute) return fail('Record not found.')

  const { error: upsertError } = await supabase.from('strategy_competitor_scores').upsert({
    workspace_id: ctx.workspaceId, competitor_id: competitorId, attribute_id: attributeId,
    score, updated_at: new Date().toISOString(),
  }, { onConflict: 'competitor_id,attribute_id' })
  if (upsertError) return fail('Could not update score.')

  revalidateStrategy()
  return { ok: true }
}

export async function submitFrameworkForApproval(frameworkId: string): Promise<ActionResult> {
  const { session, error } = await authorise('editFramework')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: current } = await supabase.from('strategy_positioning_frameworks')
    .select('id, name').eq('id', frameworkId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Framework not found.')

  const { error: updateError } = await supabase.from('strategy_positioning_frameworks')
    .update({ status: 'in_review' }).eq('id', frameworkId).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail('Could not submit for approval.')

  const { error: approvalError } = await supabase.from('strategy_approvals').insert({
    workspace_id: ctx.workspaceId, entity_type: 'framework', entity_id: frameworkId,
    stage: 'review', status: 'pending', requested_by: userId, requested_at: new Date().toISOString(),
  })
  if (approvalError) console.error('[strategy] approval record failed', approvalError.message)

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'framework', entityId: frameworkId,
    action: 'submitted framework', summary: `Submitted "${current.name}" for legal review`,
    link: '/app/strategy/positioning', surface: 'positioning',
  })

  revalidateStrategy()
  return { ok: true, message: 'Submitted for approval.' }
}

export async function decideApproval(approvalId: string, status: 'approved' | 'changes_requested' | 'rejected', comment?: string): Promise<ActionResult> {
  const { session, error } = await authorise('approveFramework')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: approval } = await supabase.from('strategy_approvals')
    .select('id, entity_type, entity_id').eq('id', approvalId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!approval) return fail('Approval not found.')

  const { error: updateError } = await supabase.from('strategy_approvals').update({
    status, approver_id: userId, comment: comment?.trim() || null, decided_at: new Date().toISOString(),
  }).eq('id', approvalId).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail('Could not record decision.')

  if (approval.entity_type === 'framework' && status === 'approved') {
    await supabase.from('strategy_positioning_frameworks')
      .update({ status: 'approved' }).eq('id', approval.entity_id).eq('workspace_id', ctx.workspaceId)
  } else if (approval.entity_type === 'framework' && status === 'changes_requested') {
    await supabase.from('strategy_positioning_frameworks')
      .update({ status: 'changes_requested' }).eq('id', approval.entity_id).eq('workspace_id', ctx.workspaceId)
  }

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'approval', entityId: approvalId,
    action: status === 'approved' ? 'approved' : 'reviewed',
    summary: status === 'approved' ? 'Approved for use' : `Requested changes${comment ? `: ${comment}` : ''}`,
    link: '/app/strategy/positioning', surface: 'positioning',
  })

  revalidateStrategy()
  return { ok: true, message: 'Decision recorded.' }
}

// ============================================================================
// Plans
// ============================================================================

export interface PlanInput {
  name: string
  description?: string
  owner_id?: string
  start_date?: string
  end_date?: string
  budget?: string
}

export async function createPlan(input: PlanInput): Promise<ActionResult> {
  const { session, error } = await authorise('createPlan')
  if (!session) return fail(error)

  const name = input.name?.trim()
  if (!name) return fail('Plan name is required.')
  if (input.start_date && input.end_date && input.end_date < input.start_date) {
    return fail('End date cannot be before the start date.')
  }

  const { supabase, ctx, userId } = session
  const { data, error: insertError } = await supabase.from('strategy_plans').insert({
    workspace_id: ctx.workspaceId,
    name,
    description: input.description?.trim() || null,
    owner_id: input.owner_id || userId,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    budget: input.budget ? Number(input.budget) : null,
    status: 'not_started',
    created_by: userId,
  }).select('id').single()

  if (insertError) return fail('Could not create the plan. Please try again.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'plan', entityId: data.id,
    action: 'created plan', summary: `Created plan "${name}"`,
    link: '/app/strategy/plans', surface: 'plans',
  })

  revalidateStrategy()
  return { ok: true, id: data.id, message: 'Plan created.' }
}

export interface MilestoneInput {
  plan_id: string
  title: string
  due_date: string
  owner_id?: string
}

export async function addMilestone(input: MilestoneInput): Promise<ActionResult> {
  const { session, error } = await authorise('editPlan')
  if (!session) return fail(error)

  const title = input.title?.trim()
  if (!title) return fail('Milestone title is required.')
  if (!input.due_date) return fail('Due date is required.')

  const { supabase, ctx, userId } = session
  const owns = await ownsRecord(supabase, 'strategy_plans', input.plan_id, ctx.workspaceId)
  if (!owns) return fail('Plan not found.')

  const { error: insertError } = await supabase.from('strategy_plan_items').insert({
    workspace_id: ctx.workspaceId, plan_id: input.plan_id, title, item_type: 'milestone',
    status: 'not_started', due_date: input.due_date, owner_id: input.owner_id || userId, created_by: userId,
  })
  if (insertError) return fail('Could not add milestone.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'plan_item',
    action: 'added milestone', summary: `Added milestone "${title}"`,
    link: '/app/strategy/plans', surface: 'plans',
  })

  revalidateStrategy()
  return { ok: true, message: 'Milestone added.' }
}

export async function updatePlanItemStatus(id: string, status: string): Promise<ActionResult> {
  const { session, error } = await authorise('editPlan')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: current } = await supabase.from('strategy_plan_items')
    .select('id, title').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Item not found.')

  const { error: updateError } = await supabase.from('strategy_plan_items').update({
    status, completed_at: status === 'completed' ? new Date().toISOString() : null,
  }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail('Could not update status.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'plan_item', entityId: id,
    action: status === 'completed' ? 'completed task' : 'updated status',
    summary: `"${current.title}" status changed to ${status.replace('_', ' ')}`,
    link: '/app/strategy/plans', surface: 'plans',
  })

  revalidateStrategy()
  return { ok: true, message: 'Status updated.' }
}

/** Drag-to-reschedule on the Gantt. Both dates move together, preserving duration. */
export async function reschedulePlanItem(id: string, startDate: string, dueDate: string): Promise<ActionResult> {
  const { session, error } = await authorise('editPlan')
  if (!session) return fail(error)
  if (dueDate < startDate) return fail('Due date cannot be before the start date.')

  const { supabase, ctx, userId } = session
  const owns = await ownsRecord(supabase, 'strategy_plan_items', id, ctx.workspaceId)
  if (!owns) return fail('Item not found.')

  const { error: updateError } = await supabase.from('strategy_plan_items')
    .update({ start_date: startDate, due_date: dueDate }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail('Could not reschedule.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'plan_item', entityId: id,
    action: 'rescheduled item', summary: 'Dates updated on the timeline',
    link: '/app/strategy/plans', surface: 'plans',
  })

  revalidateStrategy()
  return { ok: true }
}

export async function assignPlanOwner(id: string, ownerId: string): Promise<ActionResult> {
  const { session, error } = await authorise('editPlan')
  if (!session) return fail(error)
  const { supabase, ctx } = session

  const owns = await ownsRecord(supabase, 'strategy_plans', id, ctx.workspaceId)
  if (!owns) return fail('Plan not found.')

  const { error: updateError } = await supabase.from('strategy_plans')
    .update({ owner_id: ownerId }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail('Could not assign owner.')

  revalidateStrategy()
  return { ok: true, message: 'Owner assigned.' }
}

export async function addPlanDependency(planId: string, dependsOnPlanId: string, label?: string): Promise<ActionResult> {
  const { session, error } = await authorise('manageDependencies')
  if (!session) return fail(error)
  if (planId === dependsOnPlanId) return fail('A plan cannot depend on itself.')

  const { supabase, ctx, userId } = session
  const [ownsPlan, ownsDep] = await Promise.all([
    ownsRecord(supabase, 'strategy_plans', planId, ctx.workspaceId),
    ownsRecord(supabase, 'strategy_plans', dependsOnPlanId, ctx.workspaceId),
  ])
  if (!ownsPlan || !ownsDep) return fail('Plan not found.')

  const { error: insertError } = await supabase.from('strategy_plan_dependencies').insert({
    workspace_id: ctx.workspaceId, plan_id: planId, depends_on_plan_id: dependsOnPlanId,
    label: label?.trim() || null, created_by: userId,
  })
  if (insertError) return fail('This dependency already exists.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'plan',
    action: 'added dependency', summary: 'Added a strategic dependency',
    link: '/app/strategy/plans', surface: 'plans',
  })

  revalidateStrategy()
  return { ok: true, message: 'Dependency added.' }
}

export async function removePlanDependency(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('manageDependencies')
  if (!session) return fail(error)
  const { supabase, ctx } = session

  const { error: deleteError } = await supabase.from('strategy_plan_dependencies')
    .delete().eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (deleteError) return fail('Could not remove dependency.')

  revalidateStrategy()
  return { ok: true, message: 'Dependency removed.' }
}

export async function archivePlan(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('editPlan')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: current } = await supabase.from('strategy_plans')
    .select('id, name').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Plan not found.')

  const { error: updateError } = await supabase.from('strategy_plans')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail('Could not archive plan.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'plan', entityId: id,
    action: 'archived plan', summary: `Archived "${current.name}"`,
    link: '/app/strategy/plans', surface: 'plans',
  })

  revalidateStrategy()
  return { ok: true, message: 'Plan archived.' }
}

// ============================================================================
// Forecasts
// ============================================================================

export interface ForecastInput {
  name: string
  metric?: string
  period_start: string
  period_end: string
  target_value?: string
}

export async function createForecast(input: ForecastInput): Promise<ActionResult> {
  const { session, error } = await authorise('createForecast')
  if (!session) return fail(error)

  const name = input.name?.trim()
  if (!name) return fail('Forecast name is required.')
  if (!input.period_start || !input.period_end) return fail('Forecast period is required.')
  if (input.period_end < input.period_start) return fail('Period end cannot be before period start.')

  const { supabase, ctx, userId } = session
  const { data, error: insertError } = await supabase.from('strategy_forecasts').insert({
    workspace_id: ctx.workspaceId,
    name,
    metric: input.metric || 'revenue',
    period_start: input.period_start,
    period_end: input.period_end,
    target_value: input.target_value ? Number(input.target_value) : 0,
    status: 'active',
    owner_id: userId,
    created_by: userId,
    last_recalculated_at: new Date().toISOString(),
  }).select('id').single()

  if (insertError) return fail('Could not create the forecast. Please try again.')

  // Seed the three canonical scenarios so the comparison view is never empty.
  await supabase.from('strategy_forecast_scenarios').insert([
    { workspace_id: ctx.workspaceId, forecast_id: data.id, name: 'Best case', scenario_type: 'best', probability: 25, sort_order: 0 },
    { workspace_id: ctx.workspaceId, forecast_id: data.id, name: 'Expected case', scenario_type: 'expected', is_expected: true, probability: 50, sort_order: 1 },
    { workspace_id: ctx.workspaceId, forecast_id: data.id, name: 'Downside case', scenario_type: 'downside', probability: 25, sort_order: 2 },
  ])

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'forecast', entityId: data.id,
    action: 'created forecast', summary: `Created forecast "${name}"`,
    link: '/app/strategy/forecasts', surface: 'forecasts',
  })

  revalidateStrategy()
  return { ok: true, id: data.id, message: 'Forecast created.' }
}

export interface ScenarioInput {
  forecast_id: string
  name: string
  scenario_type?: string
  probability?: string
  forecast_value?: string
}

export async function addScenario(input: ScenarioInput): Promise<ActionResult> {
  const { session, error } = await authorise('editForecast')
  if (!session) return fail(error)

  const name = input.name?.trim()
  if (!name) return fail('Scenario name is required.')

  const { supabase, ctx, userId } = session
  const owns = await ownsRecord(supabase, 'strategy_forecasts', input.forecast_id, ctx.workspaceId)
  if (!owns) return fail('Forecast not found.')

  const { error: insertError } = await supabase.from('strategy_forecast_scenarios').insert({
    workspace_id: ctx.workspaceId, forecast_id: input.forecast_id, name,
    scenario_type: input.scenario_type || 'custom',
    probability: input.probability ? Number(input.probability) : 0,
    forecast_value: input.forecast_value ? Number(input.forecast_value) : 0,
    last_recalculated_at: new Date().toISOString(),
  })
  if (insertError) return fail('Could not add scenario.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'scenario',
    action: 'added scenario', summary: `Added scenario "${name}"`,
    link: '/app/strategy/forecasts', surface: 'forecasts',
  })

  revalidateStrategy()
  return { ok: true, message: 'Scenario added.' }
}

export async function setExpectedScenario(forecastId: string, scenarioId: string): Promise<ActionResult> {
  const { session, error } = await authorise('editForecast')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const owns = await ownsRecord(supabase, 'strategy_forecasts', forecastId, ctx.workspaceId)
  if (!owns) return fail('Forecast not found.')

  // Two-step, transactional-by-intent: clear the flag first so the partial
  // unique index (`is_expected` per forecast) can never see two rows at once.
  await supabase.from('strategy_forecast_scenarios')
    .update({ is_expected: false }).eq('forecast_id', forecastId).eq('workspace_id', ctx.workspaceId)
  const { error: updateError } = await supabase.from('strategy_forecast_scenarios')
    .update({ is_expected: true }).eq('id', scenarioId).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail('Could not set expected scenario.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'scenario', entityId: scenarioId,
    action: 'updated forecast', summary: 'Expected scenario changed',
    link: '/app/strategy/forecasts', surface: 'forecasts',
  })

  revalidateStrategy()
  return { ok: true, message: 'Expected scenario updated.' }
}

export interface AssumptionInput {
  forecast_id: string
  label: string
  value_text: string
  numeric_value?: string
  unit?: string
  confidence?: string
}

export async function updateAssumption(id: string | null, input: AssumptionInput): Promise<ActionResult> {
  const { session, error } = await authorise('manageAssumptions')
  if (!session) return fail(error)

  const label = input.label?.trim()
  const valueText = input.value_text?.trim()
  if (!label || !valueText) return fail('Label and value are required.')

  const { supabase, ctx, userId } = session
  const owns = await ownsRecord(supabase, 'strategy_forecasts', input.forecast_id, ctx.workspaceId)
  if (!owns) return fail('Forecast not found.')

  const payload = {
    workspace_id: ctx.workspaceId, forecast_id: input.forecast_id, label, value_text: valueText,
    numeric_value: input.numeric_value ? Number(input.numeric_value) : null,
    unit: input.unit || null, confidence: input.confidence || 'medium', updated_by: userId,
  }

  const { error: upsertError } = id
    ? await supabase.from('strategy_forecast_assumptions').update(payload).eq('id', id).eq('workspace_id', ctx.workspaceId)
    : await supabase.from('strategy_forecast_assumptions').insert(payload)
  if (upsertError) return fail('Could not save assumption.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'assumption',
    action: 'updated assumption', summary: `Updated "${label}" to ${valueText}`,
    link: '/app/strategy/forecasts', surface: 'forecasts',
  })

  revalidateStrategy()
  return { ok: true, message: 'Assumption saved.' }
}

/** Recomputes `last_recalculated_at` — the model itself derives from live inputs on read. */
export async function refreshForecastModel(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('editForecast')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: current } = await supabase.from('strategy_forecasts')
    .select('id, name').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Forecast not found.')

  const now = new Date().toISOString()
  await supabase.from('strategy_forecasts').update({ last_recalculated_at: now }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  await supabase.from('strategy_forecast_scenarios').update({ last_recalculated_at: now }).eq('forecast_id', id).eq('workspace_id', ctx.workspaceId)

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'forecast', entityId: id,
    action: 'refreshed model', summary: `Model recalibrated for "${current.name}"`,
    link: '/app/strategy/forecasts', surface: 'forecasts',
  })

  revalidateStrategy()
  return { ok: true, message: 'Model refreshed.' }
}

export async function archiveForecast(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('editForecast')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: current } = await supabase.from('strategy_forecasts')
    .select('id, name').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Forecast not found.')

  const { error: updateError } = await supabase.from('strategy_forecasts')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail('Could not archive forecast.')

  await logActivity(supabase, {
    workspaceId: ctx.workspaceId, actorId: userId, entityType: 'forecast', entityId: id,
    action: 'archived forecast', summary: `Archived "${current.name}"`,
    link: '/app/strategy/forecasts', surface: 'forecasts',
  })

  revalidateStrategy()
  return { ok: true, message: 'Forecast archived.' }
}
