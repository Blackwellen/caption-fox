'use server'

import { revalidatePath } from 'next/cache'
import { getAutomationSession } from '@/lib/automations/server'
import { canTransitionAutomation } from '@/lib/automations/constants'

export interface ActionResult {
  ok: boolean
  error?: string
  message?: string
  id?: string
}

function fail(error: string): ActionResult { return { ok: false, error } }

function revalidateAutomations() {
  revalidatePath('/app/automations')
  revalidatePath('/app/automations/logs')
}

/**
 * Installs a template as a real, workspace-scoped automation. Always
 * created as `draft` — a template is never auto-activated, matching the
 * review-first rule: the workspace must explicitly turn it on.
 */
export async function createAutomationFromTemplate(templateKey: string): Promise<ActionResult> {
  const session = await getAutomationSession()
  if (!session.capabilities.create) return fail('Your role does not allow creating automations.')
  const { supabase, ctx, userId } = session

  const { data: template } = await supabase.from('automation_templates').select('*').eq('key', templateKey).maybeSingle()
  if (!template) return fail('Template not found.')

  const { data, error } = await supabase.from('automations').insert({
    workspace_id: ctx.workspaceId,
    name: template.name,
    description: template.description,
    status: 'draft',
    trigger_key: template.trigger_key,
    trigger_config: template.default_trigger_config,
    conditions: template.default_conditions,
    actions: template.default_actions,
    source_template_key: template.key,
    created_by: userId,
  }).select('id').single()

  if (error) return fail(error.message)
  revalidateAutomations()
  return { ok: true, id: data.id, message: `"${template.name}" was added as a draft — activate it from the Automations list when you're ready.` }
}

/**
 * Changes an automation's status. Activating enforces the plan's active-
 * automation cap server-side (not just in the UI) and validates the
 * transition against the state machine — a paused automation cannot be
 * "resumed" straight to archived in one illegal jump, etc.
 */
export async function setAutomationStatus(input: { id: string; status: string }): Promise<ActionResult> {
  const session = await getAutomationSession()
  if (!session.capabilities.activate) return fail('Your role does not allow changing automation status.')
  const { supabase, ctx, capabilities } = session

  const { data: automation } = await supabase.from('automations').select('id, status').eq('id', input.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!automation) return fail('Automation not found.')
  if (!canTransitionAutomation(automation.status, input.status)) {
    return fail(`Cannot move an automation from "${automation.status}" to "${input.status}".`)
  }

  if (input.status === 'active') {
    const { count } = await supabase.from('automations').select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId).eq('status', 'active')
    if ((count ?? 0) >= capabilities.activeLimit) {
      return fail(`Your plan allows up to ${capabilities.activeLimit} active automations. Pause or archive another automation first, or upgrade your plan.`)
    }
  }

  const { error } = await supabase.from('automations').update({ status: input.status }).eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  if (error) return fail(error.message)
  revalidateAutomations()
  return { ok: true, message: 'Automation updated.' }
}

export async function deleteAutomation(id: string): Promise<ActionResult> {
  const session = await getAutomationSession()
  if (!session.capabilities.remove) return fail('Your role does not allow deleting automations.')
  const { supabase, ctx } = session
  const { error } = await supabase.from('automations').delete().eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (error) return fail(error.message)
  revalidateAutomations()
  return { ok: true, message: 'Automation deleted.' }
}

/**
 * Runs an automation once, immediately, against a synthetic context — the
 * "Test" affordance every automation surface needs so a user can validate a
 * recipe without waiting for its real trigger to fire naturally.
 */
export async function runAutomationManually(id: string): Promise<ActionResult> {
  const session = await getAutomationSession()
  if (!session.capabilities.runManually) return fail('Your role does not allow running automations manually.')
  const { supabase, ctx } = session

  const { data: automation } = await supabase.from('automations').select('id, trigger_key').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!automation) return fail('Automation not found.')

  const { error } = await supabase.rpc('fn_run_automations_for_event', {
    p_workspace_id: ctx.workspaceId,
    p_trigger_key: automation.trigger_key,
    p_context: { entity_type: 'manual', triggered_by: 'manual_run' },
    p_source: 'manual',
  })
  if (error) return fail(error.message)
  revalidateAutomations()
  return { ok: true, message: 'Automation run started — check the run history for the result.' }
}

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const session = await getAutomationSession()
  const { supabase, ctx } = session
  const { error } = await supabase.from('automation_notifications').update({ read: true }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (error) return fail(error.message)
  revalidateAutomations()
  return { ok: true }
}
