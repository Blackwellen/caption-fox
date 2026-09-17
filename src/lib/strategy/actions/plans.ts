'use server'

import type { ActionResult } from '../action-types'
import { authorise, dbError, fail, invalid, ownsRecord, record, revalidateStrategy } from '../server'
import {
  canTransitionPlan, PLAN_ITEM_STATUSES, PLAN_ITEM_TYPES, PLAN_STATUSES, PLAN_STATUS_LABELS, RISK_LEVELS,
  STRATEGY_PRIORITIES, type PlanStatus,
} from '../constants'
import { wouldCreateCycle } from '../metrics'
import { amount, dateOrder, FieldErrors, integer, isoDate, oneOf, text, uuid } from '../validation'

async function isMember(supabase: import('@supabase/supabase-js').SupabaseClient, workspaceId: string, userId: string | null) {
  if (!userId) return true
  const { data } = await supabase.from('workspace_members').select('user_id').eq('workspace_id', workspaceId).eq('user_id', userId).maybeSingle()
  return Boolean(data)
}

export interface PlanInput {
  name?: string; description?: string; owner_id?: string; strategy_id?: string; start_date?: string; end_date?: string
  budget?: string | number; budget_spent?: string | number; priority?: string; target_summary?: string; progress?: string | number
}

function parsePlan(input: PlanInput, errors: FieldErrors) {
  const start = isoDate(errors, 'start_date', input.start_date, { label: 'Start date' })
  const end = isoDate(errors, 'end_date', input.end_date, { label: 'End date' })
  dateOrder(errors, 'end_date', start, end, 'End date cannot be before the start date.')
  return {
    name: text(errors, 'name', input.name, { label: 'Plan name', required: true, max: 140 }),
    description: text(errors, 'description', input.description, { label: 'Description', max: 2000 }),
    owner_id: uuid(errors, 'owner_id', input.owner_id, { label: 'Owner' }),
    strategy_id: uuid(errors, 'strategy_id', input.strategy_id, { label: 'Strategy' }),
    start_date: start,
    end_date: end,
    budget: amount(errors, 'budget', input.budget, { label: 'Budget', min: 0 }),
    budget_spent: amount(errors, 'budget_spent', input.budget_spent, { label: 'Spent', min: 0 }) ?? 0,
    priority: oneOf(errors, 'priority', input.priority, STRATEGY_PRIORITIES, { label: 'Priority', fallback: 'medium' }),
    target_summary: text(errors, 'target_summary', input.target_summary, { label: 'Target', max: 140 }),
    progress: integer(errors, 'progress', input.progress, { label: 'Progress', min: 0, max: 100, fallback: 0 }),
  }
}

export async function createPlan(input: PlanInput): Promise<ActionResult> {
  const { session, error } = await authorise('plans', 'createPlan')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const values = parsePlan(input, errors)
  if (!errors.ok) return invalid(errors)
  const { supabase, ctx, userId } = session
  if (!(await isMember(supabase, ctx.workspaceId, values.owner_id))) return fail('Owner must be a member of this workspace.', { owner_id: 'Choose a workspace member.' })
  if (values.strategy_id && !(await ownsRecord(supabase, 'strategy_records', values.strategy_id, ctx.workspaceId))) return fail('Strategy not found.')
  const { data, error: insertError } = await supabase.from('strategy_plans').insert({
    ...values, owner_id: values.owner_id ?? userId, status: 'not_started', workspace_id: ctx.workspaceId, created_by: userId,
  }).select('id').single()
  if (insertError || !data) return fail(dbError(insertError, 'Could not create the plan.'))
  await record(session, { entityType: 'plan', entityId: data.id, action: 'created plan', summary: `"${values.name}"`, surface: 'plans' })
  revalidateStrategy()
  return { ok: true, id: data.id, message: 'Plan created.' }
}

export async function updatePlan(id: string, input: PlanInput): Promise<ActionResult> {
  const { session, error } = await authorise('plans', 'editPlan')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const values = parsePlan(input, errors)
  if (!errors.ok) return invalid(errors)
  const { supabase, ctx } = session
  const { data: current } = await supabase.from('strategy_plans').select('archived_at').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Plan not found.')
  if (current.archived_at) return fail('Restore this plan before editing it.')
  if (!(await isMember(supabase, ctx.workspaceId, values.owner_id))) return fail('Owner must be a member of this workspace.')
  if (values.strategy_id && !(await ownsRecord(supabase, 'strategy_records', values.strategy_id, ctx.workspaceId))) return fail('Strategy not found.')
  const { error: updateError } = await supabase.from('strategy_plans').update(values).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not save the plan.'))
  await record(session, { entityType: 'plan', entityId: id, action: 'updated plan', summary: `"${values.name}"`, surface: 'plans' })
  revalidateStrategy()
  return { ok: true, id, message: 'Plan saved.' }
}

export async function setPlanStatus(id: string, status: string): Promise<ActionResult> {
  const { session, error } = await authorise('plans', 'editPlan')
  if (!session) return fail(error)
  if (!(PLAN_STATUSES as readonly string[]).includes(status)) return fail('Unknown status.')
  const { supabase, ctx } = session
  const { data: current } = await supabase.from('strategy_plans').select('name, status').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Plan not found.')
  if (current.status === status) return { ok: true, message: 'Status unchanged.' }
  if (!canTransitionPlan(current.status, status)) return fail(`A plan cannot move from ${PLAN_STATUS_LABELS[current.status as PlanStatus]} to ${PLAN_STATUS_LABELS[status as PlanStatus]}.`)
  const patch: Record<string, unknown> = { status }
  if (status === 'completed') patch.progress = 100
  if (status === 'archived') patch.archived_at = new Date().toISOString()
  const { error: updateError } = await supabase.from('strategy_plans').update(patch).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not update the plan status.'))
  await record(session, { entityType: 'plan', entityId: id, action: 'updated plan status', summary: `"${current.name}" to ${PLAN_STATUS_LABELS[status as PlanStatus]}`, surface: 'plans', metadata: { from: current.status, to: status } })
  revalidateStrategy()
  return { ok: true, message: `Plan moved to ${PLAN_STATUS_LABELS[status as PlanStatus]}.` }
}

export async function setPlanProgress(id: string, progress: number): Promise<ActionResult> {
  const { session, error } = await authorise('plans', 'editPlan')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const value = integer(errors, 'progress', progress, { label: 'Progress', min: 0, max: 100, required: true })
  if (!errors.ok || value === null) return invalid(errors)
  const { supabase, ctx } = session
  const { data: current } = await supabase.from('strategy_plans').select('name').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Plan not found.')
  const { error: updateError } = await supabase.from('strategy_plans').update({ progress: value }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not update progress.'))
  await record(session, { entityType: 'plan', entityId: id, action: 'updated progress', summary: `"${current.name}" to ${value}%`, surface: 'plans' })
  revalidateStrategy()
  return { ok: true, message: 'Progress updated.' }
}

export async function assignPlanOwner(ids: string[], ownerId: string): Promise<ActionResult> {
  const { session, error } = await authorise('plans', 'editPlan')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const owner = uuid(errors, 'owner_id', ownerId, { label: 'Owner', required: true })
  if (!errors.ok) return invalid(errors)
  const { supabase, ctx } = session
  if (!(await isMember(supabase, ctx.workspaceId, owner))) return fail('Owner must be a member of this workspace.')
  const list = ids.filter(Boolean).slice(0, 100)
  if (list.length === 0) return fail('Choose at least one plan.')
  const { data, error: updateError } = await supabase.from('strategy_plans').update({ owner_id: owner })
    .eq('workspace_id', ctx.workspaceId).in('id', list).select('id')
  if (updateError) return fail(dbError(updateError, 'Could not assign the owner.'))
  if (!data?.length) return fail('Plan not found.')
  await record(session, { entityType: 'plan', action: 'assigned owner', summary: `${data.length} plan${data.length === 1 ? '' : 's'}`, surface: 'plans' })
  revalidateStrategy()
  return { ok: true, message: `Owner assigned to ${data.length} plan${data.length === 1 ? '' : 's'}.` }
}

export interface PlanItemInput {
  plan_id?: string; title?: string; item_type?: string; status?: string; priority?: string; progress?: string | number
  owner_id?: string; start_date?: string; due_date?: string; notes?: string
}

export async function addPlanItem(input: PlanItemInput): Promise<ActionResult> {
  const { session, error } = await authorise('plans', 'editPlan')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const planId = uuid(errors, 'plan_id', input.plan_id, { label: 'Plan', required: true })
  const itemType = oneOf(errors, 'item_type', input.item_type, PLAN_ITEM_TYPES, { label: 'Type', fallback: 'task' })
  const start = isoDate(errors, 'start_date', input.start_date, { label: 'Start date' })
  const due = isoDate(errors, 'due_date', input.due_date, { label: itemType === 'milestone' ? 'Milestone date' : 'Due date', required: itemType === 'milestone' })
  dateOrder(errors, 'due_date', start, due, 'Due date cannot be before the start date.')
  const values = {
    title: text(errors, 'title', input.title, { label: 'Title', required: true, max: 160 }),
    item_type: itemType,
    status: oneOf(errors, 'status', input.status, PLAN_ITEM_STATUSES, { label: 'Status', fallback: 'not_started' }),
    priority: oneOf(errors, 'priority', input.priority, STRATEGY_PRIORITIES, { label: 'Priority', fallback: 'medium' }),
    progress: integer(errors, 'progress', input.progress, { label: 'Progress', min: 0, max: 100, fallback: 0 }),
    owner_id: uuid(errors, 'owner_id', input.owner_id, { label: 'Owner' }),
    notes: text(errors, 'notes', input.notes, { label: 'Notes', max: 2000 }),
    start_date: itemType === 'milestone' ? null : start,
    due_date: due,
  }
  if (!errors.ok) return invalid(errors)
  const { supabase, ctx, userId } = session
  const { data: plan } = await supabase.from('strategy_plans').select('name, start_date, end_date, archived_at').eq('id', planId!).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!plan) return fail('Plan not found.', { plan_id: 'Choose a plan from this workspace.' })
  if (plan.archived_at) return fail('Restore the plan before adding items.')
  if (!(await isMember(supabase, ctx.workspaceId, values.owner_id))) return fail('Owner must be a member of this workspace.')
  const { data: last } = await supabase.from('strategy_plan_items').select('sort_order').eq('plan_id', planId!).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const { data, error: insertError } = await supabase.from('strategy_plan_items').insert({
    ...values, plan_id: planId, workspace_id: ctx.workspaceId, created_by: userId, sort_order: (last?.sort_order ?? 0) + 1,
  }).select('id').single()
  if (insertError || !data) return fail(dbError(insertError, 'Could not add the item.'))
  await record(session, { entityType: 'plan_item', entityId: data.id, action: `added ${values.item_type}`, summary: `${values.title} · ${plan.name}`, surface: 'plans' })
  revalidateStrategy()
  return { ok: true, id: data.id, message: `${values.item_type === 'milestone' ? 'Milestone' : values.item_type === 'phase' ? 'Phase' : 'Task'} added.` }
}

export async function updatePlanItem(id: string, patch: { status?: string; progress?: number; start_date?: string | null; due_date?: string | null; owner_id?: string }): Promise<ActionResult> {
  const { session, error } = await authorise('plans', 'editPlan')
  if (!session) return fail(error)
  const { supabase, ctx } = session
  const { data: current } = await supabase.from('strategy_plan_items')
    .select('id, plan_id, title, item_type, start_date, due_date, status').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Plan item not found.')
  const errors = new FieldErrors()
  const update: Record<string, unknown> = {}
  if (patch.status !== undefined) update.status = oneOf(errors, 'status', patch.status, PLAN_ITEM_STATUSES, { label: 'Status', required: true })
  if (patch.progress !== undefined) update.progress = integer(errors, 'progress', patch.progress, { label: 'Progress', min: 0, max: 100, required: true })
  if (patch.owner_id !== undefined) update.owner_id = uuid(errors, 'owner_id', patch.owner_id, { label: 'Owner', required: true })
  if (patch.start_date !== undefined) update.start_date = isoDate(errors, 'start_date', patch.start_date, { label: 'Start date' })
  if (patch.due_date !== undefined) update.due_date = isoDate(errors, 'due_date', patch.due_date, { label: 'Due date', required: current.item_type === 'milestone' })
  const nextStart = (update.start_date as string | null | undefined) ?? current.start_date
  const nextDue = (update.due_date as string | null | undefined) ?? current.due_date
  dateOrder(errors, 'due_date', nextStart, nextDue, 'Due date cannot be before the start date.')
  if (!errors.ok) return invalid(errors)
  if (update.status === 'completed') update.progress = 100
  if (update.owner_id && !(await isMember(supabase, ctx.workspaceId, update.owner_id as string))) return fail('Owner must be a member of this workspace.')

  const { error: updateError } = await supabase.from('strategy_plan_items').update(update).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not update the item.'))
  await record(session, {
    entityType: 'plan_item', entityId: id,
    action: 'start_date' in update || 'due_date' in update ? `moved ${current.item_type}` : `updated ${current.item_type}`,
    summary: current.title, surface: 'plans', metadata: { before: { start_date: current.start_date, due_date: current.due_date, status: current.status }, after: update },
  })
  revalidateStrategy()
  return { ok: true, message: 'Saved.' }
}

/**
 * Reschedules a plan from the Gantt (drag to move, drag an edge to resize).
 * A plan cannot start before a plan it depends on has finished; that rule is
 * checked here, not only in the browser.
 */
export async function setPlanDates(id: string, startDate: string, endDate: string): Promise<ActionResult> {
  const { session, error } = await authorise('plans', 'editPlan')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const start = isoDate(errors, 'start_date', startDate, { label: 'Start date', required: true })
  const end = isoDate(errors, 'end_date', endDate, { label: 'End date', required: true })
  dateOrder(errors, 'end_date', start, end, 'End date cannot be before the start date.')
  if (!errors.ok) return invalid(errors)
  const { supabase, ctx } = session
  const { data: plan } = await supabase.from('strategy_plans').select('name, start_date, end_date, archived_at').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!plan) return fail('Plan not found.')
  if (plan.archived_at) return fail('Archived plans cannot be rescheduled.')
  const { data: deps } = await supabase.from('strategy_plan_dependencies')
    .select('depends_on:strategy_plans!strategy_plan_dependencies_depends_on_plan_id_fkey(name, end_date)')
    .eq('workspace_id', ctx.workspaceId).eq('plan_id', id)
  const blocking = ((deps ?? []) as unknown as { depends_on: { name: string; end_date: string | null } | null }[])
    .map(row => row.depends_on).find(row => row?.end_date && row.end_date > start!)
  if (blocking) return fail(`"${plan.name}" depends on "${blocking.name}", which ends ${blocking.end_date}. Start on or after that date.`)
  const { error: updateError } = await supabase.from('strategy_plans').update({ start_date: start, end_date: end }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not reschedule the plan.'))
  await record(session, {
    entityType: 'plan', entityId: id, action: 'rescheduled plan', summary: `"${plan.name}" to ${start} – ${end}`, surface: 'plans',
    metadata: { before: { start_date: plan.start_date, end_date: plan.end_date }, after: { start_date: start, end_date: end } },
  })
  revalidateStrategy()
  return { ok: true, message: 'Plan rescheduled.' }
}

export async function deletePlanItem(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('plans', 'editPlan')
  if (!session) return fail(error)
  const { supabase, ctx } = session
  const { data: current } = await supabase.from('strategy_plan_items').select('title, item_type').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Plan item not found.')
  const { error: deleteError } = await supabase.from('strategy_plan_items').delete().eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (deleteError) return fail(dbError(deleteError, 'Could not remove the item.'))
  await record(session, { entityType: 'plan_item', entityId: id, action: `removed ${current.item_type}`, summary: current.title, surface: 'plans' })
  revalidateStrategy()
  return { ok: true, message: 'Item removed.' }
}

export async function addPlanDependency(input: { plan_id?: string; depends_on_plan_id?: string; label?: string; risk_level?: string; blocked_items?: string | number }): Promise<ActionResult> {
  const { session, error } = await authorise('plans', 'manageDependencies')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const planId = uuid(errors, 'plan_id', input.plan_id, { label: 'Plan', required: true })
  const dependsOn = uuid(errors, 'depends_on_plan_id', input.depends_on_plan_id, { label: 'Depends on', required: true })
  const values = {
    label: text(errors, 'label', input.label, { label: 'Description', max: 160 }),
    risk_level: oneOf(errors, 'risk_level', input.risk_level, RISK_LEVELS, { label: 'Risk', fallback: 'low' }),
    blocked_items: integer(errors, 'blocked_items', input.blocked_items, { label: 'Blocked items', min: 0, max: 999, fallback: 0 }),
  }
  if (planId && planId === dependsOn) errors.add('depends_on_plan_id', 'A plan cannot depend on itself.')
  if (!errors.ok) return invalid(errors)
  const { supabase, ctx, userId } = session
  const { data: plans } = await supabase.from('strategy_plans').select('id, name').eq('workspace_id', ctx.workspaceId).in('id', [planId!, dependsOn!])
  if ((plans ?? []).length !== 2) return fail('Both plans must belong to this workspace.')
  const { data: edges } = await supabase.from('strategy_plan_dependencies').select('plan_id, depends_on_plan_id').eq('workspace_id', ctx.workspaceId)
  if (wouldCreateCycle((edges ?? []) as { plan_id: string; depends_on_plan_id: string }[], planId!, dependsOn!)) {
    return fail('That dependency would create a circular chain.', { depends_on_plan_id: 'This plan already depends on the selected plan.' })
  }
  const { data, error: insertError } = await supabase.from('strategy_plan_dependencies')
    .insert({ ...values, plan_id: planId, depends_on_plan_id: dependsOn, workspace_id: ctx.workspaceId, created_by: userId }).select('id').single()
  if (insertError || !data) return fail(insertError?.code === '23505' ? 'That dependency already exists.' : dbError(insertError, 'Could not add the dependency.'))
  const names = new Map(((plans ?? []) as { id: string; name: string }[]).map(row => [row.id, row.name]))
  await record(session, { entityType: 'plan', entityId: planId, action: 'added dependency', summary: `${names.get(planId!)} → ${names.get(dependsOn!)}`, surface: 'plans' })
  revalidateStrategy()
  return { ok: true, id: data.id, message: 'Dependency added.' }
}

export async function removePlanDependency(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('plans', 'manageDependencies')
  if (!session) return fail(error)
  const { supabase, ctx } = session
  const { data: current } = await supabase.from('strategy_plan_dependencies').select('plan_id').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Dependency not found.')
  const { error: deleteError } = await supabase.from('strategy_plan_dependencies').delete().eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (deleteError) return fail(dbError(deleteError, 'Could not remove the dependency.'))
  await record(session, { entityType: 'plan', entityId: current.plan_id, action: 'removed dependency', summary: 'Plan dependency', surface: 'plans' })
  revalidateStrategy()
  return { ok: true, message: 'Dependency removed.' }
}

export async function addPlanRisk(input: { plan_id?: string; title?: string; detail?: string; severity?: string; owner_id?: string }): Promise<ActionResult> {
  const { session, error } = await authorise('plans', 'editPlan')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const values = {
    plan_id: uuid(errors, 'plan_id', input.plan_id, { label: 'Plan', required: true }),
    title: text(errors, 'title', input.title, { label: 'Risk', required: true, max: 140 }),
    detail: text(errors, 'detail', input.detail, { label: 'Detail', max: 1000 }),
    severity: oneOf(errors, 'severity', input.severity, RISK_LEVELS, { label: 'Severity', fallback: 'medium' }),
    owner_id: uuid(errors, 'owner_id', input.owner_id, { label: 'Owner' }),
  }
  if (!errors.ok) return invalid(errors)
  const { supabase, ctx, userId } = session
  if (!(await ownsRecord(supabase, 'strategy_plans', values.plan_id, ctx.workspaceId))) return fail('Plan not found.')
  const { error: insertError } = await supabase.from('strategy_plan_risks').insert({ ...values, owner_id: values.owner_id ?? userId, workspace_id: ctx.workspaceId })
  if (insertError) return fail(dbError(insertError, 'Could not add the risk.'))
  await record(session, { entityType: 'plan', entityId: values.plan_id, action: 'added risk', summary: values.title!, surface: 'plans' })
  revalidateStrategy()
  return { ok: true, message: 'Risk added.' }
}

export async function setRiskStatus(id: string, status: string): Promise<ActionResult> {
  const { session, error } = await authorise('plans', 'editPlan')
  if (!session) return fail(error)
  if (!['open', 'mitigating', 'resolved'].includes(status)) return fail('Unknown status.')
  const { supabase, ctx } = session
  const { data, error: updateError } = await supabase.from('strategy_plan_risks').update({ status }).eq('id', id).eq('workspace_id', ctx.workspaceId).select('title, plan_id')
  if (updateError) return fail(dbError(updateError, 'Could not update the risk.'))
  if (!data?.length) return fail('Risk not found.')
  await record(session, { entityType: 'plan', entityId: data[0].plan_id, action: `marked risk ${status}`, summary: data[0].title, surface: 'plans' })
  revalidateStrategy()
  return { ok: true, message: 'Risk updated.' }
}

export async function archivePlan(id: string): Promise<ActionResult> { return setArchived(id, true) }
export async function restorePlan(id: string): Promise<ActionResult> { return setArchived(id, false) }

async function setArchived(id: string, archive: boolean): Promise<ActionResult> {
  const { session, error } = await authorise('plans', 'editPlan')
  if (!session) return fail(error)
  const { supabase, ctx } = session
  const { data: current } = await supabase.from('strategy_plans').select('name, archived_at').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Plan not found.')
  if (archive === Boolean(current.archived_at)) return { ok: true, message: 'No change.' }
  const { error: updateError } = await supabase.from('strategy_plans')
    .update(archive ? { status: 'archived', archived_at: new Date().toISOString() } : { status: 'not_started', archived_at: null })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not update the plan.'))
  await record(session, { entityType: 'plan', entityId: id, action: archive ? 'archived plan' : 'restored plan', summary: `"${current.name}"`, surface: 'plans' })
  revalidateStrategy()
  return { ok: true, message: archive ? 'Plan archived.' : 'Plan restored.' }
}

export async function deletePlan(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('plans', 'delete')
  if (!session) return fail(error)
  const { supabase, ctx } = session
  const { data: current } = await supabase.from('strategy_plans').select('name, archived_at').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Plan not found.')
  if (!current.archived_at) return fail('Archive the plan before deleting it permanently.')
  await supabase.from('strategy_links').delete().eq('workspace_id', ctx.workspaceId)
    .or(`and(source_type.eq.plan,source_id.eq.${id}),and(target_type.eq.plan,target_id.eq.${id})`)
  const { error: deleteError } = await supabase.from('strategy_plans').delete().eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (deleteError) return fail(dbError(deleteError, 'Could not delete the plan.'))
  await record(session, { entityType: 'plan', entityId: id, action: 'deleted plan', summary: `"${current.name}"`, surface: 'plans' })
  revalidateStrategy()
  return { ok: true, message: 'Plan deleted.' }
}
