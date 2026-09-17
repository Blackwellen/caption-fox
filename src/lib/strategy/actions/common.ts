'use server'

import type { ActionResult } from '../action-types'
import { authorise, dbError, fail, getStrategyActionSession, invalid, ownsRecord, record, revalidateStrategy } from '../server'
import { STRATEGY_MODULES, STRATEGY_PRIORITIES } from '../constants'
import { FieldErrors, isoDate, oneOf, text, uuid } from '../validation'

// ── Next actions ─────────────────────────────────────────────────────────────

export async function setNextActionDone(id: string, done: boolean): Promise<ActionResult> {
  const { session, error } = await authorise('overview', 'edit')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session
  const { data: current } = await supabase.from('strategy_actions').select('title, status')
    .eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Action not found.')
  if ((current.status === 'done') === done) return { ok: true, message: 'No change.' }

  const { error: updateError } = await supabase.from('strategy_actions').update(done
    ? { status: 'done', completed_at: new Date().toISOString(), completed_by: userId }
    : { status: 'open', completed_at: null, completed_by: null })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not update the action.'))
  await record(session, { entityType: 'system', entityId: id, action: done ? 'completed action' : 'reopened action', summary: `"${current.title}"`, surface: 'overview' })
  revalidateStrategy()
  return { ok: true, message: done ? 'Action completed.' : 'Action reopened.' }
}

export async function createNextAction(input: { title?: string; module?: string; priority?: string; due_date?: string; owner_id?: string }): Promise<ActionResult> {
  const { session, error } = await authorise('overview', 'create')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const values = {
    title: text(errors, 'title', input.title, { label: 'Action', required: true, max: 200 }),
    module: oneOf(errors, 'module', input.module, ['objectives', 'audiences', 'research', 'positioning', 'plans', 'forecasts'] as const, { label: 'Area', fallback: 'objectives' }),
    priority: oneOf(errors, 'priority', input.priority, STRATEGY_PRIORITIES, { label: 'Priority', fallback: 'medium' }),
    due_date: isoDate(errors, 'due_date', input.due_date, { label: 'Due date' }),
    owner_id: uuid(errors, 'owner_id', input.owner_id, { label: 'Owner' }),
  }
  if (!errors.ok) return invalid(errors)
  const { supabase, ctx, userId } = session
  const { data, error: insertError } = await supabase.from('strategy_actions')
    .insert({ ...values, owner_id: values.owner_id ?? userId, workspace_id: ctx.workspaceId, created_by: userId })
    .select('id').single()
  if (insertError || !data) return fail(dbError(insertError, 'Could not add the action.'))
  await record(session, { entityType: 'system', entityId: data.id, action: 'added action', summary: `"${values.title}"`, surface: 'overview' })
  revalidateStrategy()
  return { ok: true, id: data.id, message: 'Action added.' }
}

// ── Saved views (private to the user; viewers may save too) ──────────────────

export async function saveView(module: string, name: string, query: string): Promise<ActionResult> {
  const session = await getStrategyActionSession()
  if (!session) return fail('Your session has expired. Sign in again to continue.')
  const errors = new FieldErrors()
  const cleanModule = oneOf(errors, 'module', module, STRATEGY_MODULES, { label: 'Page', required: true })
  const cleanName = text(errors, 'name', name, { label: 'View name', required: true, max: 60 })
  if (!errors.ok) return invalid(errors)
  // Only keep known, harmless query keys — a saved view can never smuggle state.
  const params = new URLSearchParams(typeof query === 'string' ? query.slice(0, 2000) : '')
  const kept = new URLSearchParams()
  for (const [key, value] of params) if (/^[a-z_]{1,20}$/.test(key) && value.length <= 120 && key !== 'page') kept.set(key, value)

  const { supabase, ctx, userId } = session
  const { error: upsertError } = await supabase.from('strategy_saved_views').upsert({
    workspace_id: ctx.workspaceId, user_id: userId, module: cleanModule, name: cleanName, query: kept.toString(),
  }, { onConflict: 'workspace_id,user_id,module,name' })
  if (upsertError) return fail(dbError(upsertError, 'Could not save the view.'))
  revalidateStrategy()
  return { ok: true, message: `Saved view "${cleanName}".` }
}

export async function deleteView(id: string): Promise<ActionResult> {
  const session = await getStrategyActionSession()
  if (!session) return fail('Your session has expired.')
  const { error: deleteError } = await session.supabase.from('strategy_saved_views').delete()
    .eq('id', id).eq('user_id', session.userId).eq('workspace_id', session.ctx.workspaceId)
  if (deleteError) return fail(dbError(deleteError, 'Could not delete the view.'))
  revalidateStrategy()
  return { ok: true, message: 'View deleted.' }
}

// ── Comments ─────────────────────────────────────────────────────────────────

const COMMENT_TABLE: Record<string, string> = {
  approval: 'strategy_approvals', framework: 'strategy_positioning_frameworks', research: 'strategy_research_items',
  objective: 'strategy_objectives', plan: 'strategy_plans', forecast: 'strategy_forecasts', audience: 'strategy_audiences',
}

export async function addComment(entityType: string, entityId: string, body: string): Promise<ActionResult> {
  const { session, error } = await authorise('overview', 'edit')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const clean = text(errors, 'body', body, { label: 'Comment', required: true, max: 2000 })
  if (!errors.ok) return invalid(errors)
  const table = COMMENT_TABLE[entityType]
  if (!table) return fail('Comments are not supported here.')
  const { supabase, ctx, userId } = session
  if (!(await ownsRecord(supabase, table, entityId, ctx.workspaceId))) return fail('Record not found.')
  const { error: insertError } = await supabase.from('strategy_comments').insert({
    workspace_id: ctx.workspaceId, entity_type: entityType, entity_id: entityId, body: clean, author_id: userId,
  })
  if (insertError) return fail(dbError(insertError, 'Could not post the comment.'))
  await record(session, {
    entityType: entityType === 'approval' ? 'approval' : entityType === 'framework' ? 'framework' : 'system',
    entityId, action: 'commented', summary: clean!.slice(0, 120), surface: entityType === 'research' ? 'research' : 'positioning',
  })
  revalidateStrategy()
  return { ok: true, message: 'Comment posted.' }
}
