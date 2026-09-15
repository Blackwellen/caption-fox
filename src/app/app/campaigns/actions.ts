'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCampaignSession } from '@/lib/campaigns/server'
import { canTransitionStage, LIFECYCLE_LABELS, type LifecycleStage } from '@/lib/campaigns/constants'
import type { CampaignCapabilities } from '@/lib/campaigns/entitlements'

export interface ActionResult {
  ok: boolean
  error?: string
  /** Present on create actions so the client can route to the new record. */
  id?: string
  /** Human summary shown in the success toast. */
  message?: string
}

const CAMPAIGN_PATHS = [
  '/app/campaigns', '/app/campaigns/all', '/app/campaigns/giveaways',
  '/app/campaigns/competitions', '/app/campaigns/templates',
  '/app/campaigns/board', '/app/campaigns/timeline',
]

function revalidateCampaigns() {
  for (const path of CAMPAIGN_PATHS) revalidatePath(path)
}

function fail(error: string): ActionResult {
  return { ok: false, error }
}

/**
 * Writes a Campaigns activity/audit entry. Never throws: an audit write failing
 * must not roll back or mask the user's actual change, but it is logged.
 */
async function logActivity(
  supabase: SupabaseClient,
  workspaceId: string,
  actorId: string,
  entry: {
    entityType: string; entityId?: string | null; action: string
    summary: string; link?: string | null; surface?: string | null
    metadata?: Record<string, unknown>
  },
) {
  const { error } = await supabase.from('campaign_activity').insert({
    workspace_id: workspaceId,
    actor_id: actorId,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    action: entry.action,
    summary: entry.summary,
    link: entry.link ?? null,
    surface: entry.surface ?? null,
    metadata: entry.metadata ?? {},
  })
  if (error) console.error('[campaigns] activity log failed', error.message)
}

/** Resolves the session and asserts one capability in a single step. */
async function authorise(capability: keyof CampaignCapabilities) {
  const session = await getCampaignSession()
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
// Campaigns
// ============================================================================

export interface CampaignInput {
  name: string
  description?: string
  campaign_type?: string
  lifecycle_stage?: string
  priority?: string
  owner_id?: string
  start_date?: string
  end_date?: string
  launch_date?: string
  budget?: string
  channels?: string[]
  tags?: string[]
  template_id?: string
  approval_status?: string
  thumbnail_url?: string
}

function validateCampaign(input: CampaignInput): string | null {
  const name = input.name?.trim()
  if (!name) return 'Campaign name is required.'
  if (name.length > 140) return 'Campaign name must be 140 characters or fewer.'
  if (input.start_date && input.end_date && input.end_date < input.start_date) {
    return 'End date cannot be before the start date.'
  }
  if (input.budget) {
    const budget = Number(input.budget)
    if (!Number.isFinite(budget) || budget < 0) return 'Budget must be a positive number.'
    if (budget > 1_000_000_000) return 'Budget is out of range.'
  }
  return null
}

export async function createCampaign(input: CampaignInput): Promise<ActionResult> {
  const { session, error } = await authorise('create')
  if (!session) return fail(error)

  const invalid = validateCampaign(input)
  if (invalid) return fail(invalid)

  const { supabase, ctx, userId } = session
  const name = input.name.trim()

  // Same-name guard: prevents the duplicate record a double-submitted form
  // would otherwise create, and surfaces genuine duplicates to the user.
  const { data: existing } = await supabase
    .from('campaigns').select('id').eq('workspace_id', ctx.workspaceId).eq('name', name)
    .is('archived_at', null).maybeSingle()
  if (existing) return fail('A campaign with this name already exists in this workspace.')

  const { data, error: insertError } = await supabase.from('campaigns').insert({
    workspace_id: ctx.workspaceId,
    name,
    description: input.description?.trim() || null,
    campaign_type: input.campaign_type || 'standard',
    lifecycle_stage: input.lifecycle_stage || 'planning',
    priority: input.priority || 'medium',
    owner_id: input.owner_id || userId,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    launch_date: input.launch_date || null,
    budget: input.budget ? Number(input.budget) : null,
    channels: input.channels ?? [],
    tags: input.tags ?? null,
    template_id: input.template_id || null,
    approval_status: input.approval_status || 'not_required',
    thumbnail_url: input.thumbnail_url || null,
    created_by: userId,
    status: 'draft',
  }).select('id, name').single()

  if (insertError) return fail(insertError.message)

  if (input.template_id) {
    // Usage count is advisory; a failure here must not fail the creation.
    const { data: template } = await supabase
      .from('campaign_templates').select('usage_count').eq('id', input.template_id)
      .eq('workspace_id', ctx.workspaceId).maybeSingle()
    if (template) {
      await supabase.from('campaign_templates')
        .update({ usage_count: (template.usage_count as number) + 1 })
        .eq('id', input.template_id).eq('workspace_id', ctx.workspaceId)
    }
  }

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'campaign', entityId: data.id, action: 'created',
    summary: `created campaign ${data.name}`, link: `/app/campaigns/${data.id}`, surface: 'campaigns',
  })

  revalidateCampaigns()
  return { ok: true, id: data.id, message: `${data.name} created.` }
}

export async function updateCampaign(id: string, input: Partial<CampaignInput>): Promise<ActionResult> {
  const { session, error } = await authorise('edit')
  if (!session) return fail(error)

  const { supabase, ctx, userId } = session
  if (!await ownsRecord(supabase, 'campaigns', id, ctx.workspaceId)) {
    return fail('Campaign not found in this workspace.')
  }
  if (input.name !== undefined) {
    const invalid = validateCampaign({ ...input, name: input.name })
    if (invalid) return fail(invalid)
  }

  const patch: Record<string, unknown> = {}
  const passthrough = [
    'description', 'campaign_type', 'lifecycle_stage', 'priority', 'owner_id',
    'start_date', 'end_date', 'launch_date', 'approval_status', 'thumbnail_url',
  ] as const
  if (input.name !== undefined) patch.name = input.name.trim()
  for (const key of passthrough) if (input[key] !== undefined) patch[key] = input[key] || null
  if (input.budget !== undefined) patch.budget = input.budget ? Number(input.budget) : null
  if (input.channels !== undefined) patch.channels = input.channels
  if (input.tags !== undefined) patch.tags = input.tags
  patch.updated_at = new Date().toISOString()

  const { error: updateError } = await supabase.from('campaigns')
    .update(patch).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'campaign', entityId: id, action: 'updated',
    summary: `updated campaign details`, link: `/app/campaigns/${id}`, surface: 'campaigns',
    metadata: { fields: Object.keys(patch) },
  })

  revalidateCampaigns()
  return { ok: true, message: 'Campaign updated.' }
}

/** Board drag-and-drop and the row menus both land here. */
export async function moveCampaignStage(id: string, stage: string): Promise<ActionResult> {
  const { session, error } = await authorise('manageBoard')
  if (!session) return fail(error)

  const { supabase, ctx, userId } = session
  const { data: campaign } = await supabase
    .from('campaigns').select('id, name, lifecycle_stage')
    .eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!campaign) return fail('Campaign not found in this workspace.')

  const from = campaign.lifecycle_stage as LifecycleStage
  if (from === stage) return { ok: true, message: 'No change.' }
  if (!canTransitionStage(from, stage)) {
    return fail(`${LIFECYCLE_LABELS[from]} cannot move straight to ${LIFECYCLE_LABELS[stage as LifecycleStage] ?? stage}.`)
  }

  const patch: Record<string, unknown> = { lifecycle_stage: stage, updated_at: new Date().toISOString() }
  // The board's At risk / Blocked columns are the visible face of health.
  if (stage === 'at_risk') patch.health = 'at_risk'
  else if (stage === 'blocked') patch.health = 'blocked'
  else if (from === 'at_risk' || from === 'blocked') patch.health = 'on_track'
  if (stage === 'completed') patch.progress = 100

  const { error: updateError } = await supabase.from('campaigns')
    .update(patch).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'campaign', entityId: id, action: 'stage_changed',
    summary: `moved ${campaign.name} to ${LIFECYCLE_LABELS[stage as LifecycleStage] ?? stage}`,
    link: `/app/campaigns/${id}`, surface: 'board',
    metadata: { from, to: stage },
  })

  revalidateCampaigns()
  return { ok: true, message: `Moved to ${LIFECYCLE_LABELS[stage as LifecycleStage] ?? stage}.` }
}

export async function archiveCampaign(id: string, restore = false): Promise<ActionResult> {
  const { session, error } = await authorise('archive')
  if (!session) return fail(error)

  const { supabase, ctx, userId } = session
  const { data: campaign } = await supabase
    .from('campaigns').select('id, name').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!campaign) return fail('Campaign not found in this workspace.')

  const { error: updateError } = await supabase.from('campaigns').update({
    archived_at: restore ? null : new Date().toISOString(),
    lifecycle_stage: restore ? 'planning' : 'archived',
  }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'campaign', entityId: id, action: restore ? 'restored' : 'archived',
    summary: `${restore ? 'restored' : 'archived'} campaign ${campaign.name}`,
    link: `/app/campaigns/${id}`, surface: 'campaigns',
  })

  revalidateCampaigns()
  return { ok: true, message: restore ? 'Campaign restored.' : 'Campaign archived.' }
}

export async function deleteCampaign(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('delete')
  if (!session) return fail(error)

  const { supabase, ctx, userId } = session
  const { data: campaign } = await supabase
    .from('campaigns').select('id, name').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!campaign) return fail('Campaign not found in this workspace.')

  const { error: deleteError } = await supabase.from('campaigns')
    .delete().eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (deleteError) return fail(deleteError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'campaign', entityId: id, action: 'deleted',
    summary: `deleted campaign ${campaign.name}`, surface: 'campaigns',
  })

  revalidateCampaigns()
  return { ok: true, message: 'Campaign deleted.' }
}

export interface BulkPatch {
  owner_id?: string
  lifecycle_stage?: string
  priority?: string
  approval_status?: string
  archive?: boolean
}

export async function bulkUpdateCampaigns(ids: string[], patch: BulkPatch): Promise<ActionResult> {
  const { session, error } = await authorise('edit')
  if (!session) return fail(error)
  if (ids.length === 0) return fail('Select at least one campaign.')
  if (ids.length > 200) return fail('Bulk actions are limited to 200 records at a time.')

  const { supabase, ctx, userId } = session

  // Never trust the client's selection: reduce it to records this workspace
  // actually owns before writing anything.
  const { data: owned } = await supabase
    .from('campaigns').select('id').eq('workspace_id', ctx.workspaceId).in('id', ids)
  const ownedIds = (owned ?? []).map(row => row.id as string)
  if (ownedIds.length === 0) return fail('No matching campaigns in this workspace.')

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.owner_id) update.owner_id = patch.owner_id
  if (patch.lifecycle_stage) update.lifecycle_stage = patch.lifecycle_stage
  if (patch.priority) update.priority = patch.priority
  if (patch.approval_status) update.approval_status = patch.approval_status
  if (patch.archive !== undefined) {
    if (!session.capabilities.archive) return fail('Your role does not allow archiving.')
    update.archived_at = patch.archive ? new Date().toISOString() : null
    if (patch.archive) update.lifecycle_stage = 'archived'
  }
  if (Object.keys(update).length === 1) return fail('Choose a change to apply.')

  const { error: updateError } = await supabase.from('campaigns')
    .update(update).eq('workspace_id', ctx.workspaceId).in('id', ownedIds)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'campaign', action: 'bulk_updated',
    summary: `bulk updated ${ownedIds.length} campaign${ownedIds.length === 1 ? '' : 's'}`,
    surface: 'campaigns', metadata: { count: ownedIds.length, patch },
  })

  revalidateCampaigns()
  return { ok: true, message: `${ownedIds.length} campaign${ownedIds.length === 1 ? '' : 's'} updated.` }
}

// ============================================================================
// Templates
// ============================================================================

export interface TemplateInput {
  name: string
  description?: string
  category?: string
  template_type?: string
  channels?: string[]
  default_budget?: string
  default_duration_days?: string
  owner_id?: string
}

export async function createTemplate(input: TemplateInput): Promise<ActionResult> {
  const { session, error } = await authorise('manageTemplates')
  if (!session) return fail(error)

  const name = input.name?.trim()
  if (!name) return fail('Template name is required.')
  if (name.length > 140) return fail('Template name must be 140 characters or fewer.')

  const { supabase, ctx, userId } = session
  const { data: existing } = await supabase
    .from('campaign_templates').select('id').eq('workspace_id', ctx.workspaceId).eq('name', name)
    .is('archived_at', null).maybeSingle()
  if (existing) return fail('A template with this name already exists.')

  const { data, error: insertError } = await supabase.from('campaign_templates').insert({
    workspace_id: ctx.workspaceId,
    name,
    description: input.description?.trim() || null,
    category: input.category || 'standard',
    template_type: input.template_type || 'multi_channel',
    channels: input.channels ?? [],
    default_budget: input.default_budget ? Number(input.default_budget) : null,
    default_duration_days: input.default_duration_days ? Number(input.default_duration_days) : null,
    owner_id: input.owner_id || userId,
    created_by: userId,
    status: 'draft',
  }).select('id, name').single()
  if (insertError) return fail(insertError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'template', entityId: data.id, action: 'created',
    summary: `created template ${data.name}`, link: '/app/campaigns/templates', surface: 'templates',
  })

  revalidateCampaigns()
  return { ok: true, id: data.id, message: `${data.name} created.` }
}

const TEMPLATE_TRANSITIONS: Record<string, string[]> = {
  publish: ['draft', 'in_review'],
  unpublish: ['published'],
  submit_review: ['draft'],
  approve: ['in_review'],
  request_changes: ['in_review'],
}

export async function setTemplateStatus(
  id: string,
  intent: 'publish' | 'unpublish' | 'submit_review' | 'approve' | 'request_changes',
): Promise<ActionResult> {
  const needsApproval = intent === 'approve' || intent === 'request_changes' || intent === 'publish'
  const { session, error } = await authorise(needsApproval ? 'publishTemplates' : 'manageTemplates')
  if (!session) return fail(error)

  const { supabase, ctx, userId } = session
  const { data: template } = await supabase
    .from('campaign_templates').select('id, name, status')
    .eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!template) return fail('Template not found in this workspace.')

  const allowedFrom = TEMPLATE_TRANSITIONS[intent]
  if (!allowedFrom.includes(template.status as string)) {
    return fail(`A ${template.status} template cannot be ${intent.replace('_', ' ')}d.`)
  }

  const nextStatus = {
    publish: 'published', unpublish: 'draft', submit_review: 'in_review',
    approve: 'published', request_changes: 'draft',
  }[intent]

  const { error: updateError } = await supabase.from('campaign_templates')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'template', entityId: id, action: intent,
    summary: `${intent.replace('_', ' ')} template ${template.name}`,
    link: '/app/campaigns/templates', surface: 'templates',
  })

  revalidateCampaigns()
  return { ok: true, message: `Template ${nextStatus.replace('_', ' ')}.` }
}

export async function duplicateTemplate(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('manageTemplates')
  if (!session) return fail(error)

  const { supabase, ctx, userId } = session
  const { data: source } = await supabase
    .from('campaign_templates')
    .select('name, description, category, template_type, channels, default_budget, default_duration_days, config, cover_url')
    .eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!source) return fail('Template not found in this workspace.')

  // A copy always starts as a draft — never inherits published status.
  const { data, error: insertError } = await supabase.from('campaign_templates').insert({
    ...source,
    name: `${source.name} (copy)`,
    workspace_id: ctx.workspaceId,
    owner_id: userId,
    created_by: userId,
    status: 'draft',
    usage_count: 0,
    is_favourite: false,
  }).select('id, name').single()
  if (insertError) return fail(insertError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'template', entityId: data.id, action: 'duplicated',
    summary: `duplicated ${source.name}`, link: '/app/campaigns/templates', surface: 'templates',
  })

  revalidateCampaigns()
  return { ok: true, id: data.id, message: 'Template duplicated as a draft.' }
}

export async function toggleTemplateFavourite(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('manageTemplates')
  if (!session) return fail(error)

  const { supabase, ctx } = session
  const { data: template } = await supabase
    .from('campaign_templates').select('id, is_favourite')
    .eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!template) return fail('Template not found in this workspace.')

  const { error: updateError } = await supabase.from('campaign_templates')
    .update({ is_favourite: !template.is_favourite })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  revalidatePath('/app/campaigns/templates')
  return { ok: true, message: template.is_favourite ? 'Removed from favourites.' : 'Added to favourites.' }
}

export async function archiveTemplate(id: string, restore = false): Promise<ActionResult> {
  const { session, error } = await authorise('manageTemplates')
  if (!session) return fail(error)

  const { supabase, ctx, userId } = session
  if (!await ownsRecord(supabase, 'campaign_templates', id, ctx.workspaceId)) {
    return fail('Template not found in this workspace.')
  }

  const { error: updateError } = await supabase.from('campaign_templates').update({
    archived_at: restore ? null : new Date().toISOString(),
    status: restore ? 'draft' : 'archived',
  }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'template', entityId: id, action: restore ? 'restored' : 'archived',
    summary: `${restore ? 'restored' : 'archived'} a campaign template`, surface: 'templates',
  })

  revalidateCampaigns()
  return { ok: true, message: restore ? 'Template restored.' : 'Template archived.' }
}

/** Instantiates a real campaign from a template — not a copy of the card UI. */
export async function createCampaignFromTemplate(
  templateId: string,
  input: {
    name?: string; owner_id?: string; start_date?: string; end_date?: string
    budget?: string; channels?: string[]; includeMilestones?: boolean
  },
): Promise<ActionResult> {
  const { session, error } = await authorise('create')
  if (!session) return fail(error)

  const { supabase, ctx } = session
  const { data: template } = await supabase
    .from('campaign_templates')
    .select('id, name, description, category, channels, default_budget, default_duration_days, status, cover_url')
    .eq('id', templateId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!template) return fail('Template not found in this workspace.')
  if (template.status === 'archived') return fail('Archived templates cannot be used to create campaigns.')

  const start = input.start_date || new Date().toISOString().slice(0, 10)
  const duration = template.default_duration_days ? Number(template.default_duration_days) : 30
  const end = input.end_date || new Date(Date.parse(start) + duration * 86_400_000).toISOString().slice(0, 10)

  const result = await createCampaign({
    name: input.name?.trim() || `${template.name} — ${new Date().getFullYear()}`,
    description: template.description ?? undefined,
    campaign_type: (template.category as string) || 'standard',
    owner_id: input.owner_id,
    start_date: start,
    end_date: end,
    budget: input.budget ?? (template.default_budget ? String(template.default_budget) : undefined),
    channels: input.channels ?? ((template.channels as string[]) ?? []),
    template_id: template.id,
    thumbnail_url: (template.cover_url as string | null) ?? undefined,
  })
  if (!result.ok || !result.id) return result

  if (input.includeMilestones !== false) {
    await supabase.from('campaign_milestones').insert([
      { workspace_id: ctx.workspaceId, campaign_id: result.id, title: 'Brief approved', due_date: start, milestone_type: 'brief', created_by: session.userId },
      { workspace_id: ctx.workspaceId, campaign_id: result.id, title: 'Launch', due_date: end, milestone_type: 'launch', created_by: session.userId },
    ])
  }

  revalidateCampaigns()
  return { ...result, message: `Campaign created from ${template.name}.` }
}

// ============================================================================
// Giveaways — entries, winner review, prize fulfilment
// ============================================================================

export interface ImportedEntry {
  handle?: string
  email?: string
  method?: string
}

export interface ImportResult extends ActionResult {
  imported?: number
  duplicates?: number
  invalid?: number
  errors?: string[]
}

export async function importGiveawayEntries(
  giveawayId: string, rows: ImportedEntry[],
): Promise<ImportResult> {
  const { session, error } = await authorise('manageGiveaways')
  if (!session) return fail(error)
  if (rows.length === 0) return fail('The file contained no rows.')
  if (rows.length > 5_000) return fail('Imports are limited to 5,000 rows per file.')

  const { supabase, ctx, userId } = session
  const { data: giveaway } = await supabase
    .from('giveaways').select('id, title, total_entries')
    .eq('id', giveawayId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!giveaway) return fail('Giveaway not found in this workspace.')

  const { data: existingRows } = await supabase
    .from('giveaway_entries').select('participant_handle').eq('giveaway_id', giveawayId)
  const existing = new Set((existingRows ?? [])
    .map(row => (row.participant_handle as string | null)?.toLowerCase())
    .filter(Boolean) as string[])

  const errors: string[] = []
  const seen = new Set<string>()
  const payload: Record<string, unknown>[] = []
  let duplicates = 0
  let invalid = 0

  rows.forEach((row, index) => {
    const handle = row.handle?.trim()
    const email = row.email?.trim()
    if (!handle && !email) {
      invalid += 1
      if (errors.length < 20) errors.push(`Row ${index + 2}: a handle or email is required.`)
      return
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      invalid += 1
      if (errors.length < 20) errors.push(`Row ${index + 2}: "${email}" is not a valid email address.`)
      return
    }
    const key = (handle ?? email ?? '').toLowerCase()
    if (existing.has(key) || seen.has(key)) { duplicates += 1; return }
    seen.add(key)
    payload.push({
      giveaway_id: giveawayId,
      workspace_id: ctx.workspaceId,
      participant_handle: handle || null,
      participant_email: email || null,
      entry_method: row.method?.trim() || null,
      source: 'import',
    })
  })

  if (payload.length > 0) {
    const { error: insertError } = await supabase.from('giveaway_entries').insert(payload)
    if (insertError) return fail(insertError.message)

    await supabase.from('giveaways')
      .update({ total_entries: Number(giveaway.total_entries ?? 0) + payload.length })
      .eq('id', giveawayId).eq('workspace_id', ctx.workspaceId)
  }

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'entry', entityId: giveawayId, action: 'entries_imported',
    summary: `imported ${payload.length} entries for ${giveaway.title}`,
    link: `/app/campaigns/giveaways/${giveawayId}`, surface: 'giveaways',
    metadata: { imported: payload.length, duplicates, invalid },
  })

  revalidateCampaigns()
  return {
    ok: true, imported: payload.length, duplicates, invalid, errors,
    message: `${payload.length} imported, ${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped, ${invalid} invalid.`,
  }
}

const WINNER_TRANSITIONS: Record<string, string[]> = {
  approve: ['candidate', 'rejected'],
  reject: ['candidate', 'approved'],
  contact: ['approved'],
  accept: ['contacted'],
  fulfil: ['accepted', 'contacted'],
  replace: ['approved', 'contacted', 'rejected'],
}

export async function reviewGiveawayWinner(
  entryId: string,
  intent: 'approve' | 'reject' | 'contact' | 'accept' | 'fulfil' | 'replace',
  note?: string,
): Promise<ActionResult> {
  const { session, error } = await authorise('reviewWinners')
  if (!session) return fail(error)

  const { supabase, ctx, userId } = session
  const { data: entry } = await supabase
    .from('giveaway_entries')
    .select('id, giveaway_id, participant_handle, winner_status')
    .eq('id', entryId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!entry) return fail('Entry not found in this workspace.')

  const allowed = WINNER_TRANSITIONS[intent]
  if (!allowed.includes(entry.winner_status as string)) {
    return fail(`This entry is "${entry.winner_status}" and cannot be ${intent}ed from that state.`)
  }

  const nextStatus = {
    approve: 'approved', reject: 'rejected', contact: 'contacted',
    accept: 'accepted', fulfil: 'fulfilled', replace: 'replaced',
  }[intent]

  const { error: updateError } = await supabase.from('giveaway_entries').update({
    winner_status: nextStatus,
    is_winner: !['rejected', 'replaced'].includes(nextStatus),
    review_note: note?.slice(0, 500) ?? null,
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
  }).eq('id', entryId).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  if (nextStatus === 'fulfilled') {
    await supabase.from('giveaways')
      .update({ prize_fulfilment: 'fulfilled' })
      .eq('id', entry.giveaway_id).eq('workspace_id', ctx.workspaceId)
  }

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'entry', entityId: entryId, action: `winner_${nextStatus}`,
    summary: `marked ${entry.participant_handle ?? 'an entrant'} as ${nextStatus}`,
    link: `/app/campaigns/giveaways/${entry.giveaway_id}`, surface: 'giveaways',
  })

  revalidateCampaigns()
  return { ok: true, message: `Winner ${nextStatus}.` }
}

// ============================================================================
// Competitions — submissions and judging
// ============================================================================

export interface ImportedSubmission {
  handle?: string
  email?: string
  url?: string
  text?: string
}

export async function importCompetitionSubmissions(
  competitionId: string, rows: ImportedSubmission[],
): Promise<ImportResult> {
  const { session, error } = await authorise('manageCompetitions')
  if (!session) return fail(error)
  if (rows.length === 0) return fail('The file contained no rows.')
  if (rows.length > 5_000) return fail('Imports are limited to 5,000 rows per file.')

  const { supabase, ctx, userId } = session
  const { data: competition } = await supabase
    .from('competitions').select('id, title, submission_count')
    .eq('id', competitionId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!competition) return fail('Competition not found in this workspace.')

  const { data: existingRows } = await supabase
    .from('competition_submissions').select('participant_handle, submission_url')
    .eq('competition_id', competitionId)
  const existing = new Set((existingRows ?? []).map(r =>
    `${(r.participant_handle as string | null)?.toLowerCase() ?? ''}|${(r.submission_url as string | null) ?? ''}`))

  const errors: string[] = []
  const seen = new Set<string>()
  const payload: Record<string, unknown>[] = []
  let duplicates = 0
  let invalid = 0

  rows.forEach((row, index) => {
    const handle = row.handle?.trim()
    const url = row.url?.trim()
    if (!handle) {
      invalid += 1
      if (errors.length < 20) errors.push(`Row ${index + 2}: a participant handle is required.`)
      return
    }
    if (url && !/^https?:\/\/\S+$/i.test(url)) {
      invalid += 1
      if (errors.length < 20) errors.push(`Row ${index + 2}: "${url}" is not a valid http(s) URL.`)
      return
    }
    const key = `${handle.toLowerCase()}|${url ?? ''}`
    if (existing.has(key) || seen.has(key)) { duplicates += 1; return }
    seen.add(key)
    payload.push({
      competition_id: competitionId,
      workspace_id: ctx.workspaceId,
      participant_handle: handle,
      participant_email: row.email?.trim() || null,
      submission_url: url || null,
      submission_text: row.text?.trim()?.slice(0, 4000) || null,
      source: 'import',
      judging_status: 'pending',
    })
  })

  if (payload.length > 0) {
    const { error: insertError } = await supabase.from('competition_submissions').insert(payload)
    if (insertError) return fail(insertError.message)
    await supabase.from('competitions')
      .update({ submission_count: Number(competition.submission_count ?? 0) + payload.length })
      .eq('id', competitionId).eq('workspace_id', ctx.workspaceId)
  }

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'submission', entityId: competitionId, action: 'submissions_imported',
    summary: `imported ${payload.length} submissions for ${competition.title}`,
    link: `/app/campaigns/competitions/${competitionId}`, surface: 'competitions',
    metadata: { imported: payload.length, duplicates, invalid },
  })

  revalidateCampaigns()
  return {
    ok: true, imported: payload.length, duplicates, invalid, errors,
    message: `${payload.length} imported, ${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped, ${invalid} invalid.`,
  }
}

export async function setSubmissionJudgingStatus(
  submissionId: string, status: string, note?: string,
): Promise<ActionResult> {
  const { session, error } = await authorise('judge')
  if (!session) return fail(error)

  const allowed = ['pending', 'in_progress', 'review', 'shortlist', 'final_review', 'completed', 'rejected', 'disqualified']
  if (!allowed.includes(status)) return fail('Unknown judging status.')

  const { supabase, ctx, userId } = session
  const { data: submission } = await supabase
    .from('competition_submissions').select('id, competition_id, participant_handle')
    .eq('id', submissionId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!submission) return fail('Submission not found in this workspace.')

  const { error: updateError } = await supabase.from('competition_submissions').update({
    judging_status: status,
    review_note: note?.slice(0, 500) ?? null,
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
    is_winner: status === 'completed',
  }).eq('id', submissionId).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'submission', entityId: submissionId, action: `judging_${status}`,
    summary: `moved ${submission.participant_handle ?? 'a submission'} to ${status.replace('_', ' ')}`,
    link: `/app/campaigns/competitions/${submission.competition_id}`, surface: 'competitions',
  })

  revalidateCampaigns()
  return { ok: true, message: `Submission moved to ${status.replace('_', ' ')}.` }
}

// ============================================================================
// Milestones (timeline)
// ============================================================================

export async function createMilestone(input: {
  campaign_id: string; title: string; due_date: string
  milestone_type?: string; owner_id?: string; notes?: string
}): Promise<ActionResult> {
  const { session, error } = await authorise('manageTimeline')
  if (!session) return fail(error)

  const title = input.title?.trim()
  if (!title) return fail('Milestone title is required.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.due_date ?? '')) return fail('A valid due date is required.')

  const { supabase, ctx, userId } = session
  const { data: campaign } = await supabase
    .from('campaigns').select('id, name, start_date, end_date')
    .eq('id', input.campaign_id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!campaign) return fail('Campaign not found in this workspace.')

  // Keep milestones inside their campaign's window so the timeline stays honest.
  if (campaign.start_date && input.due_date < (campaign.start_date as string)) {
    return fail('The milestone date is before the campaign starts.')
  }
  if (campaign.end_date && input.due_date > (campaign.end_date as string)) {
    return fail('The milestone date is after the campaign ends.')
  }

  const { data, error: insertError } = await supabase.from('campaign_milestones').insert({
    workspace_id: ctx.workspaceId,
    campaign_id: input.campaign_id,
    title,
    due_date: input.due_date,
    milestone_type: input.milestone_type || 'checkpoint',
    owner_id: input.owner_id || userId,
    notes: input.notes?.trim()?.slice(0, 1000) || null,
    created_by: userId,
  }).select('id').single()
  if (insertError) return fail(insertError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'milestone', entityId: data.id, action: 'created',
    summary: `added milestone ${title} for ${campaign.name}`,
    link: '/app/campaigns/timeline', surface: 'timeline',
  })

  revalidateCampaigns()
  return { ok: true, id: data.id, message: 'Milestone added.' }
}

export async function setMilestoneStatus(id: string, status: string): Promise<ActionResult> {
  const { session, error } = await authorise('manageTimeline')
  if (!session) return fail(error)

  const allowed = ['pending', 'in_progress', 'completed', 'at_risk', 'blocked']
  if (!allowed.includes(status)) return fail('Unknown milestone status.')

  const { supabase, ctx, userId } = session
  const { data: milestone } = await supabase
    .from('campaign_milestones').select('id, title')
    .eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!milestone) return fail('Milestone not found in this workspace.')

  const { error: updateError } = await supabase.from('campaign_milestones').update({
    status, completed_at: status === 'completed' ? new Date().toISOString() : null,
  }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'milestone', entityId: id, action: `status_${status}`,
    summary: `marked milestone ${milestone.title} as ${status.replace('_', ' ')}`,
    link: '/app/campaigns/timeline', surface: 'timeline',
  })

  revalidateCampaigns()
  return { ok: true, message: 'Milestone updated.' }
}

/** Timeline drag-to-reschedule. Validated against the campaign's own window. */
export async function rescheduleCampaign(
  id: string, startDate: string, endDate: string,
): Promise<ActionResult> {
  const { session, error } = await authorise('manageTimeline')
  if (!session) return fail(error)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return fail('Invalid dates.')
  }
  if (endDate < startDate) return fail('A campaign cannot end before it starts.')

  const { supabase, ctx, userId } = session
  const { data: campaign } = await supabase
    .from('campaigns').select('id, name, start_date, end_date')
    .eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!campaign) return fail('Campaign not found in this workspace.')

  const { error: updateError } = await supabase.from('campaigns')
    .update({ start_date: startDate, end_date: endDate, updated_at: new Date().toISOString() })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'campaign', entityId: id, action: 'rescheduled',
    summary: `rescheduled ${campaign.name}`, link: `/app/campaigns/${id}`, surface: 'timeline',
    metadata: { from: { start: campaign.start_date, end: campaign.end_date }, to: { start: startDate, end: endDate } },
  })

  revalidateCampaigns()
  return { ok: true, message: 'Campaign rescheduled.' }
}
