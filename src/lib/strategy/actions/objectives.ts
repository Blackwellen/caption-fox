'use server'

import type { ActionResult } from '../action-types'
import {
  authorise, dbError, fail, invalid, ownsRecord, rateLimited, record, revalidateStrategy,
} from '../server'
import {
  canTransitionObjective, OBJECTIVE_STATUSES, OBJECTIVE_STATUS_LABELS, OBJECTIVE_TYPES, STRATEGY_PRIORITIES,
  type ObjectiveStatus,
} from '../constants'
import {
  dateOrder, FieldErrors, integer, isoDate, oneOf, parseCsv, tags as cleanTags, text, uuid, uuidList,
} from '../validation'

export interface ObjectiveInput {
  name?: string
  description?: string
  objective_type?: string
  priority?: string
  status?: string
  owner_id?: string
  strategy_id?: string
  start_date?: string
  due_date?: string
  target_summary?: string
  next_action?: string
  progress?: string | number
  confidence?: string | number
  tags?: string | string[]
}

function parseObjective(input: ObjectiveInput, errors: FieldErrors) {
  const start = isoDate(errors, 'start_date', input.start_date, { label: 'Start date' })
  const due = isoDate(errors, 'due_date', input.due_date, { label: 'Due date' })
  dateOrder(errors, 'due_date', start, due, 'Due date cannot be before the start date.')
  return {
    name: text(errors, 'name', input.name, { label: 'Objective name', required: true, max: 140 }),
    description: text(errors, 'description', input.description, { label: 'Description', max: 2000 }),
    objective_type: oneOf(errors, 'objective_type', input.objective_type, OBJECTIVE_TYPES, { label: 'Type', fallback: 'growth' }),
    priority: oneOf(errors, 'priority', input.priority, STRATEGY_PRIORITIES, { label: 'Priority', fallback: 'medium' }),
    target_summary: text(errors, 'target_summary', input.target_summary, { label: 'Target', max: 140 }),
    next_action: text(errors, 'next_action', input.next_action, { label: 'Next action', max: 140 }),
    progress: integer(errors, 'progress', input.progress, { label: 'Progress', min: 0, max: 100, fallback: 0 }),
    confidence: integer(errors, 'confidence', input.confidence, { label: 'Confidence', min: 0, max: 100, fallback: 50 }),
    owner_id: uuid(errors, 'owner_id', input.owner_id, { label: 'Owner' }),
    strategy_id: uuid(errors, 'strategy_id', input.strategy_id, { label: 'Strategy' }),
    start_date: start,
    due_date: due,
    tags: cleanTags(input.tags),
  }
}

async function memberOf(session: NonNullable<Awaited<ReturnType<typeof authorise>>['session']>, userId: string | null) {
  if (!userId) return true
  const { data } = await session.supabase.from('workspace_members').select('user_id')
    .eq('workspace_id', session.ctx.workspaceId).eq('user_id', userId).maybeSingle()
  return Boolean(data)
}

export async function createObjective(input: ObjectiveInput): Promise<ActionResult> {
  const { session, error } = await authorise('objectives', 'createObjective')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const values = parseObjective(input, errors)
  const status = oneOf(errors, 'status', input.status, ['draft', 'not_started', 'on_track'] as const, { label: 'Status', fallback: 'not_started' })
  if (!errors.ok) return invalid(errors)

  const { supabase, ctx, userId } = session
  if (!(await memberOf(session, values.owner_id))) return fail('Owner must be a member of this workspace.', { owner_id: 'Choose a workspace member.' })
  if (values.strategy_id && !(await ownsRecord(supabase, 'strategy_records', values.strategy_id, ctx.workspaceId))) {
    return fail('Strategy not found.', { strategy_id: 'Choose a strategy from this workspace.' })
  }

  const { data, error: insertError } = await supabase.from('strategy_objectives').insert({
    ...values, status, owner_id: values.owner_id ?? userId, workspace_id: ctx.workspaceId, created_by: userId,
  }).select('id').single()
  if (insertError || !data) return fail(dbError(insertError, 'Could not create the objective. Please try again.'))

  await record(session, { entityType: 'objective', entityId: data.id, action: 'created objective', summary: `"${values.name}"`, surface: 'objectives' })
  revalidateStrategy()
  return { ok: true, id: data.id, message: 'Objective created.' }
}

export async function updateObjective(id: string, input: ObjectiveInput): Promise<ActionResult> {
  const { session, error } = await authorise('objectives', 'editObjective')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const values = parseObjective(input, errors)
  if (!errors.ok) return invalid(errors)
  const { supabase, ctx } = session

  const { data: current } = await supabase.from('strategy_objectives').select('id, name, archived_at')
    .eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Objective not found.')
  if (current.archived_at) return fail('Restore this objective before editing it.')
  if (!(await memberOf(session, values.owner_id))) return fail('Owner must be a member of this workspace.', { owner_id: 'Choose a workspace member.' })
  if (values.strategy_id && !(await ownsRecord(supabase, 'strategy_records', values.strategy_id, ctx.workspaceId))) {
    return fail('Strategy not found.')
  }

  const { error: updateError } = await supabase.from('strategy_objectives').update(values)
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not save the objective.'))

  await record(session, { entityType: 'objective', entityId: id, action: 'updated objective', summary: `"${values.name}"`, surface: 'objectives' })
  revalidateStrategy()
  return { ok: true, id, message: 'Objective saved.' }
}

export async function updateObjectiveStatus(id: string, status: string): Promise<ActionResult> {
  const { session, error } = await authorise('objectives', 'editObjective')
  if (!session) return fail(error)
  if (!(OBJECTIVE_STATUSES as readonly string[]).includes(status)) return fail('Unknown status.')
  const { supabase, ctx } = session

  const { data: current } = await supabase.from('strategy_objectives').select('id, name, status, progress')
    .eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Objective not found.')
  if (current.status === status) return { ok: true, message: 'Status unchanged.' }
  if (!canTransitionObjective(current.status, status)) {
    return fail(`An objective cannot move from ${OBJECTIVE_STATUS_LABELS[current.status as ObjectiveStatus]} to ${OBJECTIVE_STATUS_LABELS[status as ObjectiveStatus]}.`)
  }

  const patch: Record<string, unknown> = { status }
  if (status === 'completed') patch.progress = 100
  if (status === 'archived') patch.archived_at = new Date().toISOString()
  const { error: updateError } = await supabase.from('strategy_objectives').update(patch).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not update the status.'))

  await record(session, {
    entityType: 'objective', entityId: id, action: 'updated objective',
    summary: `"${current.name}" status to ${OBJECTIVE_STATUS_LABELS[status as ObjectiveStatus]}`, surface: 'objectives',
    metadata: { from: current.status, to: status },
  })
  revalidateStrategy()
  return { ok: true, message: `Moved to ${OBJECTIVE_STATUS_LABELS[status as ObjectiveStatus]}.` }
}

export async function updateObjectiveProgress(id: string, progress: number): Promise<ActionResult> {
  const { session, error } = await authorise('objectives', 'editObjective')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const value = integer(errors, 'progress', progress, { label: 'Progress', min: 0, max: 100, required: true })
  if (!errors.ok || value === null) return invalid(errors)
  const { supabase, ctx } = session
  const { data: current } = await supabase.from('strategy_objectives').select('name, progress, archived_at')
    .eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Objective not found.')
  if (current.archived_at) return fail('Archived objectives cannot be edited.')

  const { error: updateError } = await supabase.from('strategy_objectives').update({ progress: value }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not update progress.'))
  await record(session, {
    entityType: 'objective', entityId: id, action: 'updated objective',
    summary: `"${current.name}" progress from ${current.progress}% to ${value}%`, surface: 'objectives',
  })
  revalidateStrategy()
  return { ok: true, message: 'Progress updated.' }
}

export async function assignObjectiveOwner(id: string, ownerId: string): Promise<ActionResult> {
  const { session, error } = await authorise('objectives', 'editObjective')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const owner = uuid(errors, 'owner_id', ownerId, { label: 'Owner', required: true })
  if (!errors.ok) return invalid(errors)
  if (!(await memberOf(session, owner))) return fail('Owner must be a member of this workspace.')
  const { supabase, ctx } = session
  const { data: current } = await supabase.from('strategy_objectives').select('name').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Objective not found.')
  const { error: updateError } = await supabase.from('strategy_objectives').update({ owner_id: owner }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not assign the owner.'))
  await record(session, { entityType: 'objective', entityId: id, action: 'assigned owner', summary: `"${current.name}"`, surface: 'objectives' })
  revalidateStrategy()
  return { ok: true, message: 'Owner assigned.' }
}

/** Links (or unlinks) an objective to an audience or plan in this workspace. */
export async function setObjectiveLink(
  objectiveId: string, targetType: 'audience' | 'plan', targetId: string, linked: boolean,
): Promise<ActionResult> {
  const { session, error } = await authorise('objectives', 'editObjective')
  if (!session) return fail(error)
  if (targetType !== 'audience' && targetType !== 'plan') return fail('Unsupported link type.')
  const { supabase, ctx, userId } = session
  const table = targetType === 'audience' ? 'strategy_audiences' : 'strategy_plans'
  const [ownsObjective, ownsTarget] = await Promise.all([
    ownsRecord(supabase, 'strategy_objectives', objectiveId, ctx.workspaceId),
    ownsRecord(supabase, table, targetId, ctx.workspaceId),
  ])
  if (!ownsObjective || !ownsTarget) return fail('Record not found.')

  if (linked) {
    const { error: linkError } = await supabase.from('strategy_links').upsert({
      workspace_id: ctx.workspaceId, source_type: 'objective', source_id: objectiveId,
      target_type: targetType, target_id: targetId, created_by: userId,
    }, { onConflict: 'source_type,source_id,target_type,target_id', ignoreDuplicates: true })
    if (linkError) return fail(dbError(linkError, 'Could not link the records.'))
  } else {
    await supabase.from('strategy_links').delete().eq('workspace_id', ctx.workspaceId)
      .or(`and(source_type.eq.objective,source_id.eq.${objectiveId},target_type.eq.${targetType},target_id.eq.${targetId}),and(source_type.eq.${targetType},source_id.eq.${targetId},target_type.eq.objective,target_id.eq.${objectiveId})`)
  }
  await record(session, {
    entityType: 'objective', entityId: objectiveId, action: linked ? `linked ${targetType}` : `unlinked ${targetType}`,
    summary: `${linked ? 'Linked' : 'Unlinked'} a${targetType === 'audience' ? 'n audience' : ' plan'}`, surface: 'objectives',
  })
  revalidateStrategy()
  return { ok: true, message: linked ? 'Linked.' : 'Link removed.' }
}

export async function bulkUpdateObjectives(
  ids: string[], patch: { status?: string; owner_id?: string; priority?: string },
): Promise<ActionResult> {
  const { session, error } = await authorise('objectives', 'editObjective')
  if (!session) return fail(error)
  const list = uuidList(ids, 100)
  if (list.length === 0) return fail('Select at least one objective.')
  const errors = new FieldErrors()
  const status = oneOf(errors, 'status', patch.status, OBJECTIVE_STATUSES, { label: 'Status' })
  const priority = oneOf(errors, 'priority', patch.priority, STRATEGY_PRIORITIES, { label: 'Priority' })
  const owner = uuid(errors, 'owner_id', patch.owner_id, { label: 'Owner' })
  if (!errors.ok) return invalid(errors)
  if (!status && !priority && !owner) return fail('Choose at least one change to apply.')
  if (!(await memberOf(session, owner))) return fail('Owner must be a member of this workspace.')

  const { supabase, ctx } = session
  const { data: rows } = await supabase.from('strategy_objectives').select('id, status, archived_at')
    .eq('workspace_id', ctx.workspaceId).in('id', list)
  const scoped = (rows ?? []) as { id: string; status: string; archived_at: string | null }[]
  const eligible = scoped.filter(row => !row.archived_at && (!status || row.status === status || canTransitionObjective(row.status, status)))
  const skipped = list.length - eligible.length
  if (eligible.length === 0) return fail('None of the selected objectives can take that change.')

  const update: Record<string, unknown> = {}
  if (status) { update.status = status; if (status === 'completed') update.progress = 100; if (status === 'archived') update.archived_at = new Date().toISOString() }
  if (priority) update.priority = priority
  if (owner) update.owner_id = owner
  const { error: updateError } = await supabase.from('strategy_objectives').update(update)
    .eq('workspace_id', ctx.workspaceId).in('id', eligible.map(row => row.id))
  if (updateError) return fail(dbError(updateError, 'Could not apply the bulk update.'))

  await record(session, {
    entityType: 'objective', action: 'bulk updated objectives', summary: `${eligible.length} objectives`, surface: 'objectives',
    metadata: { ids: eligible.map(row => row.id), update },
  })
  revalidateStrategy()
  return { ok: true, message: `Updated ${eligible.length} objective${eligible.length === 1 ? '' : 's'}${skipped ? ` · ${skipped} skipped (not allowed)` : ''}.` }
}

export async function archiveObjective(id: string): Promise<ActionResult> {
  return setArchived(id, true)
}

export async function restoreObjective(id: string): Promise<ActionResult> {
  return setArchived(id, false)
}

async function setArchived(id: string, archive: boolean): Promise<ActionResult> {
  const { session, error } = await authorise('objectives', 'editObjective')
  if (!session) return fail(error)
  const { supabase, ctx } = session
  const { data: current } = await supabase.from('strategy_objectives').select('name, archived_at')
    .eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Objective not found.')
  if (archive === Boolean(current.archived_at)) return { ok: true, message: archive ? 'Already archived.' : 'Already active.' }
  const { error: updateError } = await supabase.from('strategy_objectives')
    .update(archive ? { status: 'archived', archived_at: new Date().toISOString() } : { status: 'not_started', archived_at: null })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, archive ? 'Could not archive.' : 'Could not restore.'))
  await record(session, { entityType: 'objective', entityId: id, action: archive ? 'archived objective' : 'restored objective', summary: `"${current.name}"`, surface: 'objectives' })
  revalidateStrategy()
  return { ok: true, message: archive ? 'Objective archived.' : 'Objective restored.' }
}

export async function deleteObjective(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('objectives', 'deleteObjective')
  if (!session) return fail(error)
  const { supabase, ctx } = session
  const { data: current } = await supabase.from('strategy_objectives').select('name, archived_at')
    .eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Objective not found.')
  if (!current.archived_at) return fail('Archive the objective before deleting it permanently.')
  await supabase.from('strategy_links').delete().eq('workspace_id', ctx.workspaceId)
    .or(`and(source_type.eq.objective,source_id.eq.${id}),and(target_type.eq.objective,target_id.eq.${id})`)
  const { error: deleteError } = await supabase.from('strategy_objectives').delete().eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (deleteError) return fail(dbError(deleteError, 'Could not delete the objective.'))
  await record(session, { entityType: 'objective', entityId: id, action: 'deleted objective', summary: `"${current.name}"`, surface: 'objectives' })
  revalidateStrategy()
  return { ok: true, message: 'Objective deleted.' }
}

/**
 * CSV import: header row required with at least `name`. Optional columns:
 * type, priority, status, due_date, target, next_action, progress, confidence.
 * Every row is validated; nothing is written if any row fails.
 */
export async function importObjectives(csv: string): Promise<ActionResult> {
  const { session, error } = await authorise('objectives', 'createObjective')
  if (!session) return fail(error)
  if (typeof csv !== 'string' || csv.length === 0) return fail('The file is empty.')
  if (csv.length > 500_000) return fail('Import files must be under 500 KB.')
  const { supabase, ctx, userId } = session
  if (await rateLimited(supabase, ctx.workspaceId, userId, 'imported objectives', 10, 60)) {
    return fail('Import limit reached. Try again in an hour.')
  }

  const rows = parseCsv(csv)
  if (rows.length < 2) return fail('Add a header row and at least one objective.')
  const header = rows[0].map(cell => cell.trim().toLowerCase().replace(/\s+/g, '_'))
  if (!header.includes('name')) return fail('The header row must include a "name" column.')
  if (rows.length - 1 > 500) return fail('Import up to 500 objectives at a time.')

  const { data: existing } = await supabase.from('strategy_objectives').select('name').eq('workspace_id', ctx.workspaceId).is('archived_at', null)
  const existingNames = new Set(((existing ?? []) as { name: string }[]).map(row => row.name.toLowerCase()))

  const records: Record<string, unknown>[] = []
  const problems: string[] = []
  const seen = new Set<string>()
  rows.slice(1).forEach((cells, index) => {
    const get = (key: string) => cells[header.indexOf(key)] ?? ''
    const errors = new FieldErrors()
    const values = parseObjective({
      name: get('name'), objective_type: get('type').toLowerCase(), priority: get('priority').toLowerCase(),
      due_date: get('due_date'), target_summary: get('target'), next_action: get('next_action'),
      progress: get('progress'), confidence: get('confidence'),
    }, errors)
    const status = oneOf(errors, 'status', get('status').toLowerCase().replace(/\s+/g, '_'), ['draft', 'not_started', 'on_track', 'at_risk', 'off_track'] as const, { label: 'Status', fallback: 'not_started' })
    const key = (values.name ?? '').toLowerCase()
    if (key && (existingNames.has(key) || seen.has(key))) errors.add('name', `"${values.name}" already exists`)
    seen.add(key)
    if (!errors.ok) problems.push(`Row ${index + 2}: ${errors.first}`)
    else records.push({ ...values, status, owner_id: userId, workspace_id: ctx.workspaceId, created_by: userId })
  })
  if (problems.length) return fail(`${problems.length} row${problems.length === 1 ? '' : 's'} could not be imported. ${problems.slice(0, 3).join(' · ')}`)

  const { error: insertError } = await supabase.from('strategy_objectives').insert(records)
  if (insertError) return fail(dbError(insertError, 'Import failed. No objectives were created.'))
  await record(session, { entityType: 'objective', action: 'imported objectives', summary: `${records.length} objectives from CSV`, surface: 'objectives' })
  revalidateStrategy()
  return { ok: true, message: `Imported ${records.length} objective${records.length === 1 ? '' : 's'}.` }
}
