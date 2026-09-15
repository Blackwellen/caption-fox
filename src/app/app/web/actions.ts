'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getWebSession } from '@/lib/web/server'
import { computeExperimentStats } from '@/lib/web/data'
import type { WebPageType, WebFormType, WebFunnelType, WebExperimentType } from '@/lib/web/constants'

export interface ActionResult {
  ok: boolean
  error?: string
  /** Present on create actions so the client can route to the new record. */
  id?: string
  message?: string
}

const WEB_PATHS = ['/app/web', '/app/web/pages', '/app/web/forms', '/app/web/funnels', '/app/web/experiments', '/app/web/tracking']

function revalidateWeb() {
  for (const path of WEB_PATHS) revalidatePath(path)
}

function fail(error: string): ActionResult {
  return { ok: false, error }
}

/** Writes a Web & Conversion activity/audit entry. Never throws. */
async function logActivity(
  supabase: SupabaseClient, workspaceId: string, actorId: string,
  entry: { entityType: string; entityId?: string | null; action: string; summary: string; link?: string | null },
) {
  await supabase.from('web_activity').insert({
    workspace_id: workspaceId, actor_id: actorId, entity_type: entry.entityType,
    entity_id: entry.entityId ?? null, action: entry.action, summary: entry.summary, link: entry.link ?? null,
  })
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80) || 'page'
}

// ============================================================================
// Pages
// ============================================================================

export interface PageInput { name: string; slug?: string; page_type: WebPageType }

export async function createPage(input: PageInput): Promise<ActionResult> {
  const { supabase, ctx, capabilities, userId } = await getWebSession()
  if (!capabilities.create) return fail('Your role does not allow creating pages.')
  if (!input.name?.trim()) return fail('A page name is required.')
  if (input.name.trim().length > 140) return fail('Page name must be 140 characters or fewer.')

  const slug = slugify(input.slug || input.name)
  if (!SLUG_RE.test(slug)) return fail('Slug must be lowercase letters, numbers and hyphens only.')

  const { data: clash } = await supabase.from('web_pages').select('id').eq('workspace_id', ctx.workspaceId).eq('slug', slug).maybeSingle()
  if (clash) return fail(`A page already uses the slug "${slug}". Choose a different name or slug.`)

  const { data, error } = await supabase.from('web_pages').insert({
    workspace_id: ctx.workspaceId, name: input.name.trim(), slug, page_type: input.page_type, owner_id: userId,
    content: [
      { id: crypto.randomUUID(), type: 'hero', heading: input.name.trim(), subheading: 'Everything you need to know, above the fold.', cta_label: 'Get started' },
    ],
  }).select('id').single()
  if (error || !data) return fail(error?.message ?? 'Could not create the page.')

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'page', entityId: data.id, action: 'created', summary: `created the page "${input.name.trim()}"`, link: '/app/web/pages',
  })
  revalidateWeb()
  return { ok: true, id: data.id, message: 'Page created.' }
}

export interface PageBlock { id: string; type: string; [key: string]: unknown }

export async function updatePageContent(pageId: string, content: PageBlock[]): Promise<ActionResult> {
  const { supabase, ctx, capabilities, userId } = await getWebSession()
  if (!capabilities.edit) return fail('Your role does not allow editing pages.')
  if (content.length > 40) return fail('A page cannot have more than 40 blocks.')

  const { data: page } = await supabase.from('web_pages').select('id, name, workspace_id').eq('id', pageId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!page) return fail('Page not found.')

  const { error } = await supabase.from('web_pages').update({ content, updated_at: new Date().toISOString() }).eq('id', pageId).eq('workspace_id', ctx.workspaceId)
  if (error) return fail(error.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'page', entityId: pageId, action: 'updated', summary: `updated the layout for "${page.name}"`, link: '/app/web/pages',
  })
  revalidateWeb()
  return { ok: true, message: 'Draft saved.' }
}

export async function publishPage(pageId: string): Promise<ActionResult> {
  const { supabase, ctx, capabilities, userId } = await getWebSession()
  if (!capabilities.publish) return fail('Your role does not allow publishing pages.')

  const { data: page } = await supabase.from('web_pages').select('id, name, content, version').eq('id', pageId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!page) return fail('Page not found.')
  if (!Array.isArray(page.content) || page.content.length === 0) return fail('Add at least one block before publishing.')

  const now = new Date().toISOString()
  const { error } = await supabase.from('web_pages').update({
    status: 'published', published_at: now, version: (page.version ?? 1) + 1, updated_at: now,
  }).eq('id', pageId).eq('workspace_id', ctx.workspaceId)
  if (error) return fail(error.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'page', entityId: pageId, action: 'published', summary: `published "${page.name}"`, link: '/app/web/pages',
  })
  revalidateWeb()
  return { ok: true, message: 'Page published.' }
}

export async function archivePage(pageId: string): Promise<ActionResult> {
  const { supabase, ctx, capabilities, userId } = await getWebSession()
  if (!capabilities.delete) return fail('Your role does not allow archiving pages.')

  const { data: page } = await supabase.from('web_pages').select('id, name').eq('id', pageId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!page) return fail('Page not found.')

  const { error } = await supabase.from('web_pages').update({ status: 'archived', archived_at: new Date().toISOString() }).eq('id', pageId).eq('workspace_id', ctx.workspaceId)
  if (error) return fail(error.message)

  await logActivity(supabase, ctx.workspaceId, userId, { entityType: 'page', entityId: pageId, action: 'archived', summary: `archived "${page.name}"`, link: '/app/web/pages' })
  revalidateWeb()
  return { ok: true, message: 'Page archived.' }
}

export async function restorePage(pageId: string): Promise<ActionResult> {
  const { supabase, ctx, capabilities, userId } = await getWebSession()
  if (!capabilities.edit) return fail('Your role does not allow restoring pages.')
  const { error } = await supabase.from('web_pages').update({ status: 'draft', archived_at: null }).eq('id', pageId).eq('workspace_id', ctx.workspaceId)
  if (error) return fail(error.message)
  await logActivity(supabase, ctx.workspaceId, userId, { entityType: 'page', entityId: pageId, action: 'restored', summary: 'restored a page', link: '/app/web/pages' })
  revalidateWeb()
  return { ok: true, message: 'Page restored to draft.' }
}

// ============================================================================
// Forms
// ============================================================================

export interface FormInput { name: string; form_type: WebFormType; destination_label?: string }

export async function createForm(input: FormInput): Promise<ActionResult> {
  const { supabase, ctx, capabilities, userId } = await getWebSession()
  if (!capabilities.create) return fail('Your role does not allow creating forms.')
  if (!input.name?.trim()) return fail('A form name is required.')

  const { data, error } = await supabase.from('web_forms').insert({
    workspace_id: ctx.workspaceId, name: input.name.trim(), form_type: input.form_type, owner_id: userId,
    destination_label: input.destination_label?.trim() || null,
    fields: [
      { id: crypto.randomUUID(), type: 'email', label: 'Work email', required: true },
      { id: crypto.randomUUID(), type: 'text', label: 'Full name', required: true },
    ],
  }).select('id').single()
  if (error || !data) return fail(error?.message ?? 'Could not create the form.')

  await logActivity(supabase, ctx.workspaceId, userId, { entityType: 'form', entityId: data.id, action: 'created', summary: `created the form "${input.name.trim()}"`, link: '/app/web/forms' })
  revalidateWeb()
  return { ok: true, id: data.id, message: 'Form created.' }
}

export interface FormField { id: string; type: string; label: string; required: boolean; options?: string[] }

export async function updateFormFields(formId: string, fields: FormField[]): Promise<ActionResult> {
  const { supabase, ctx, capabilities, userId } = await getWebSession()
  if (!capabilities.edit) return fail('Your role does not allow editing forms.')
  if (fields.length > 30) return fail('A form cannot have more than 30 fields.')
  for (const field of fields) {
    if (!field.label?.trim()) return fail('Every field needs a label.')
  }

  const { data: form } = await supabase.from('web_forms').select('id, name').eq('id', formId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!form) return fail('Form not found.')

  const { error } = await supabase.from('web_forms').update({ fields, updated_at: new Date().toISOString() }).eq('id', formId).eq('workspace_id', ctx.workspaceId)
  if (error) return fail(error.message)

  await logActivity(supabase, ctx.workspaceId, userId, { entityType: 'form', entityId: formId, action: 'updated', summary: `updated fields on "${form.name}"`, link: '/app/web/forms' })
  revalidateWeb()
  return { ok: true, message: 'Form fields saved.' }
}

export async function publishForm(formId: string): Promise<ActionResult> {
  const { supabase, ctx, capabilities, userId } = await getWebSession()
  if (!capabilities.publish) return fail('Your role does not allow publishing forms.')

  const { data: form } = await supabase.from('web_forms').select('id, name, fields').eq('id', formId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!form) return fail('Form not found.')
  if (!Array.isArray(form.fields) || form.fields.length === 0) return fail('Add at least one field before publishing.')

  const { error } = await supabase.from('web_forms').update({ status: 'published', updated_at: new Date().toISOString() }).eq('id', formId).eq('workspace_id', ctx.workspaceId)
  if (error) return fail(error.message)

  await logActivity(supabase, ctx.workspaceId, userId, { entityType: 'form', entityId: formId, action: 'published', summary: `published "${form.name}"`, link: '/app/web/forms' })
  revalidateWeb()
  return { ok: true, message: 'Form published.' }
}

export async function archiveForm(formId: string): Promise<ActionResult> {
  const { supabase, ctx, capabilities, userId } = await getWebSession()
  if (!capabilities.delete) return fail('Your role does not allow archiving forms.')
  const { error } = await supabase.from('web_forms').update({ status: 'archived', archived_at: new Date().toISOString() }).eq('id', formId).eq('workspace_id', ctx.workspaceId)
  if (error) return fail(error.message)
  await logActivity(supabase, ctx.workspaceId, userId, { entityType: 'form', entityId: formId, action: 'archived', summary: 'archived a form', link: '/app/web/forms' })
  revalidateWeb()
  return { ok: true, message: 'Form archived.' }
}

// ============================================================================
// Funnels
// ============================================================================

export interface FunnelInput { name: string; funnel_type: WebFunnelType }

export async function createFunnel(input: FunnelInput): Promise<ActionResult> {
  const { supabase, ctx, capabilities, userId } = await getWebSession()
  if (!capabilities.create) return fail('Your role does not allow creating funnels.')
  if (!input.name?.trim()) return fail('A funnel name is required.')

  const { data, error } = await supabase.from('web_funnels').insert({
    workspace_id: ctx.workspaceId, name: input.name.trim(), funnel_type: input.funnel_type, owner_id: userId, status: 'active',
  }).select('id').single()
  if (error || !data) return fail(error?.message ?? 'Could not create the funnel.')

  await supabase.from('web_funnel_steps').insert([
    { workspace_id: ctx.workspaceId, funnel_id: data.id, step_order: 1, name: 'Visit landing page', users_count: 0 },
    { workspace_id: ctx.workspaceId, funnel_id: data.id, step_order: 2, name: 'Convert', users_count: 0 },
  ])

  await logActivity(supabase, ctx.workspaceId, userId, { entityType: 'funnel', entityId: data.id, action: 'created', summary: `created the funnel "${input.name.trim()}"`, link: '/app/web/funnels' })
  revalidateWeb()
  return { ok: true, id: data.id, message: 'Funnel created.' }
}

export interface FunnelStepInput { id?: string; name: string; users_count: number }

/**
 * Replaces a funnel's step list and recalculates its entries/conversions from
 * the first and last step's real recorded user counts — never fabricated.
 */
export async function updateFunnelSteps(funnelId: string, steps: FunnelStepInput[]): Promise<ActionResult> {
  const { supabase, ctx, capabilities, userId } = await getWebSession()
  if (!capabilities.edit) return fail('Your role does not allow editing funnels.')
  if (steps.length < 2) return fail('A funnel needs at least two steps.')
  if (steps.length > 12) return fail('A funnel cannot have more than 12 steps.')
  for (const step of steps) {
    if (!step.name?.trim()) return fail('Every step needs a name.')
    if (!Number.isFinite(step.users_count) || step.users_count < 0) return fail('Step counts must be zero or a positive number.')
  }

  const { data: funnel } = await supabase.from('web_funnels').select('id, name').eq('id', funnelId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!funnel) return fail('Funnel not found.')

  await supabase.from('web_funnel_steps').delete().eq('funnel_id', funnelId)
  await supabase.from('web_funnel_steps').insert(
    steps.map((step, index) => ({
      workspace_id: ctx.workspaceId, funnel_id: funnelId, step_order: index + 1, name: step.name.trim(), users_count: step.users_count,
    })),
  )

  const entries = steps[0].users_count
  const conversions = steps[steps.length - 1].users_count
  const { error } = await supabase.from('web_funnels').update({ entries, conversions, updated_at: new Date().toISOString() }).eq('id', funnelId).eq('workspace_id', ctx.workspaceId)
  if (error) return fail(error.message)

  await logActivity(supabase, ctx.workspaceId, userId, { entityType: 'funnel', entityId: funnelId, action: 'updated', summary: `updated steps on "${funnel.name}"`, link: '/app/web/funnels' })
  revalidateWeb()
  return { ok: true, message: 'Funnel steps saved.' }
}

export async function archiveFunnel(funnelId: string): Promise<ActionResult> {
  const { supabase, ctx, capabilities, userId } = await getWebSession()
  if (!capabilities.delete) return fail('Your role does not allow archiving funnels.')
  const { error } = await supabase.from('web_funnels').update({ status: 'archived', archived_at: new Date().toISOString() }).eq('id', funnelId).eq('workspace_id', ctx.workspaceId)
  if (error) return fail(error.message)
  await logActivity(supabase, ctx.workspaceId, userId, { entityType: 'funnel', entityId: funnelId, action: 'archived', summary: 'archived a funnel', link: '/app/web/funnels' })
  revalidateWeb()
  return { ok: true, message: 'Funnel archived.' }
}

// ============================================================================
// Experiments
// ============================================================================

export interface ExperimentInput { name: string; experiment_type: WebExperimentType; surface_ref?: string; traffic_allocation_percent?: number }

export async function createExperiment(input: ExperimentInput): Promise<ActionResult> {
  const { supabase, ctx, capabilities, userId } = await getWebSession()
  if (!capabilities.create) return fail('Your role does not allow creating experiments.')
  if (!input.name?.trim()) return fail('An experiment name is required.')
  const allocation = input.traffic_allocation_percent ?? 50
  if (allocation < 1 || allocation > 99) return fail('Traffic allocation to the variant must be between 1% and 99%.')

  const { data, error } = await supabase.from('web_experiments').insert({
    workspace_id: ctx.workspaceId, name: input.name.trim(), experiment_type: input.experiment_type,
    surface_ref: input.surface_ref?.trim() || null, owner_id: userId, traffic_allocation_percent: allocation,
  }).select('id').single()
  if (error || !data) return fail(error?.message ?? 'Could not create the experiment.')

  await logActivity(supabase, ctx.workspaceId, userId, { entityType: 'experiment', entityId: data.id, action: 'created', summary: `created the experiment "${input.name.trim()}"`, link: '/app/web/experiments' })
  revalidateWeb()
  return { ok: true, id: data.id, message: 'Experiment created as a draft.' }
}

export async function startExperiment(experimentId: string): Promise<ActionResult> {
  const { supabase, ctx, capabilities, userId } = await getWebSession()
  if (!capabilities.launchExperiments) return fail('Your role does not allow launching experiments.')

  const { data: experiment } = await supabase.from('web_experiments').select('id, name, status').eq('id', experimentId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!experiment) return fail('Experiment not found.')
  if (!['draft', 'planning', 'scheduled', 'paused'].includes(experiment.status)) return fail(`Cannot start an experiment that is ${experiment.status}.`)

  const { error } = await supabase.from('web_experiments').update({ status: 'running', starts_at: new Date().toISOString() }).eq('id', experimentId).eq('workspace_id', ctx.workspaceId)
  if (error) return fail(error.message)

  await logActivity(supabase, ctx.workspaceId, userId, { entityType: 'experiment', entityId: experimentId, action: 'started', summary: `started the ${experiment.name} experiment`, link: '/app/web/experiments' })
  revalidateWeb()
  return { ok: true, message: 'Experiment started.' }
}

export async function pauseExperiment(experimentId: string): Promise<ActionResult> {
  const { supabase, ctx, capabilities, userId } = await getWebSession()
  if (!capabilities.launchExperiments) return fail('Your role does not allow pausing experiments.')
  const { data: experiment } = await supabase.from('web_experiments').select('id, name, status').eq('id', experimentId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!experiment) return fail('Experiment not found.')
  if (experiment.status !== 'running') return fail('Only a running experiment can be paused.')
  const { error } = await supabase.from('web_experiments').update({ status: 'paused' }).eq('id', experimentId).eq('workspace_id', ctx.workspaceId)
  if (error) return fail(error.message)
  await logActivity(supabase, ctx.workspaceId, userId, { entityType: 'experiment', entityId: experimentId, action: 'paused', summary: `paused the ${experiment.name} experiment`, link: '/app/web/experiments' })
  revalidateWeb()
  return { ok: true, message: 'Experiment paused.' }
}

export async function completeExperiment(experimentId: string): Promise<ActionResult> {
  const { supabase, ctx, capabilities, userId } = await getWebSession()
  if (!capabilities.launchExperiments) return fail('Your role does not allow completing experiments.')
  const { data: experiment } = await supabase.from('web_experiments').select('id, name, status').eq('id', experimentId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!experiment) return fail('Experiment not found.')
  if (!['running', 'paused'].includes(experiment.status)) return fail('Only a running or paused experiment can move to analysis.')
  const { error } = await supabase.from('web_experiments').update({ status: 'analyzing', ends_at: new Date().toISOString() }).eq('id', experimentId).eq('workspace_id', ctx.workspaceId)
  if (error) return fail(error.message)
  await logActivity(supabase, ctx.workspaceId, userId, { entityType: 'experiment', entityId: experimentId, action: 'analyzing', summary: `moved the ${experiment.name} experiment to analysis`, link: '/app/web/experiments' })
  revalidateWeb()
  return { ok: true, message: 'Experiment moved to analysis.' }
}

/**
 * Winner selection is refused unless the two-proportion z-test shows at
 * least 90% confidence AND both arms have reached the minimum sample size —
 * a real statistical gate, never a one-click override.
 */
export async function declareWinner(experimentId: string, winner: 'control' | 'variant'): Promise<ActionResult> {
  const { supabase, ctx, capabilities, userId } = await getWebSession()
  if (!capabilities.declareWinner) return fail('Your role does not allow declaring an experiment winner.')

  const { data: experiment } = await supabase.from('web_experiments')
    .select('id, name, status, control_visitors, control_conversions, variant_visitors, variant_conversions')
    .eq('id', experimentId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!experiment) return fail('Experiment not found.')
  if (!['analyzing', 'completed'].includes(experiment.status)) return fail('Move the experiment to analysis before declaring a winner.')

  const stats = computeExperimentStats(experiment.control_visitors, experiment.control_conversions, experiment.variant_visitors, experiment.variant_conversions)
  if (!stats.hasEnoughData) return fail('Not enough visitors yet — each arm needs at least 100 visitors before a winner can be declared.')
  if (stats.confidencePercent < 90) return fail(`Confidence is only ${stats.confidencePercent.toFixed(0)}% — 90% is required before declaring a winner.`)

  const { error } = await supabase.from('web_experiments').update({
    status: 'completed', winner, winner_selected_at: new Date().toISOString(), winner_selected_by: userId,
  }).eq('id', experimentId).eq('workspace_id', ctx.workspaceId)
  if (error) return fail(error.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'experiment', entityId: experimentId, action: 'completed',
    summary: `declared ${winner === 'variant' ? 'the variant' : 'the control'} the winner of ${experiment.name} (${stats.confidencePercent.toFixed(0)}% confidence)`,
    link: '/app/web/experiments',
  })
  revalidateWeb()
  return { ok: true, message: `${winner === 'variant' ? 'Variant' : 'Control'} declared the winner.` }
}

export async function archiveExperiment(experimentId: string): Promise<ActionResult> {
  const { supabase, ctx, capabilities, userId } = await getWebSession()
  if (!capabilities.delete) return fail('Your role does not allow archiving experiments.')
  const { error } = await supabase.from('web_experiments').update({ status: 'archived', archived_at: new Date().toISOString() }).eq('id', experimentId).eq('workspace_id', ctx.workspaceId)
  if (error) return fail(error.message)
  await logActivity(supabase, ctx.workspaceId, userId, { entityType: 'experiment', entityId: experimentId, action: 'archived', summary: 'archived an experiment', link: '/app/web/experiments' })
  revalidateWeb()
  return { ok: true, message: 'Experiment archived.' }
}

// ============================================================================
// Tracking
// ============================================================================

export interface TrackingEventInput { event_name: string; event_category: 'conversion' | 'engagement'; source?: string }

export async function createTrackingEvent(input: TrackingEventInput): Promise<ActionResult> {
  const { supabase, ctx, capabilities, userId } = await getWebSession()
  if (!capabilities.manageTracking) return fail('Your role does not allow managing tracking.')
  if (!input.event_name?.trim()) return fail('An event name is required.')

  const { data, error } = await supabase.from('web_tracking_events').insert({
    workspace_id: ctx.workspaceId, event_name: input.event_name.trim(), event_category: input.event_category,
    source: input.source?.trim() || 'website', owner_id: userId,
  }).select('id').single()
  if (error || !data) return fail(error?.message ?? 'Could not create the tracking event.')

  await logActivity(supabase, ctx.workspaceId, userId, { entityType: 'tracking_event', entityId: data.id, action: 'created', summary: `created the tracking event "${input.event_name.trim()}"`, link: '/app/web/tracking' })
  revalidateWeb()
  return { ok: true, id: data.id, message: 'Tracking event created.' }
}

export interface DestinationInput { provider: string; name: string }

export async function connectDestination(input: DestinationInput): Promise<ActionResult> {
  const { supabase, ctx, capabilities, userId } = await getWebSession()
  if (!capabilities.manageTracking) return fail('Your role does not allow managing tracking destinations.')
  if (!input.name?.trim()) return fail('A destination name is required.')

  const { data, error } = await supabase.from('web_tracking_destinations').insert({
    workspace_id: ctx.workspaceId, provider: input.provider, name: input.name.trim(), status: 'warning',
  }).select('id').single()
  if (error || !data) return fail(error?.message ?? 'Could not connect the destination.')

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'tracking_event', entityId: data.id, action: 'created',
    summary: `added the ${input.name.trim()} destination — connect it with your own provider credentials to go live`, link: '/app/web/tracking',
  })
  revalidateWeb()
  return { ok: true, id: data.id, message: 'Destination added. Connect it with your provider credentials to start sending events.' }
}

export async function disconnectDestination(destinationId: string): Promise<ActionResult> {
  const { supabase, ctx, capabilities, userId } = await getWebSession()
  if (!capabilities.manageTracking) return fail('Your role does not allow managing tracking destinations.')
  const { data: destination } = await supabase.from('web_tracking_destinations').select('id, name').eq('id', destinationId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!destination) return fail('Destination not found.')
  const { error } = await supabase.from('web_tracking_destinations').delete().eq('id', destinationId).eq('workspace_id', ctx.workspaceId)
  if (error) return fail(error.message)
  await logActivity(supabase, ctx.workspaceId, userId, { entityType: 'tracking_event', entityId: destinationId, action: 'deleted', summary: `disconnected the ${destination.name} destination`, link: '/app/web/tracking' })
  revalidateWeb()
  return { ok: true, message: 'Destination disconnected.' }
}
