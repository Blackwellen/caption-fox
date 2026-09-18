'use server'

import type { ActionResult } from '../action-types'
import { authorise, dbError, fail, invalid, ownsRecord, rateLimited, record, revalidateStrategy } from '../server'
import { APPROVAL_STAGE_LABELS, IMPACT_LEVELS, MATRIX_SCORES, PROOF_CATEGORIES, RISK_LEVELS, STRATEGY_MARKETS, VERIFICATION_STATES, type ApprovalStage } from '../constants'
import { FieldErrors, isoDate, oneOf, text, uuid } from '../validation'
import { notifyStrategy } from '../notify'

/** The governed sign-off path every framework follows, in order. */
const WORKFLOW: ApprovalStage[] = ['draft', 'review', 'legal_review', 'leadership', 'approved']

export interface FrameworkInput {
  name?: string; category_promise?: string; foundation?: string; positioning_statement?: string; target_audience_id?: string; market?: string
}

function parseFramework(input: FrameworkInput, errors: FieldErrors) {
  return {
    name: text(errors, 'name', input.name, { label: 'Framework name', required: true, max: 80 }),
    category_promise: text(errors, 'category_promise', input.category_promise, { label: 'Category promise', max: 240 }),
    foundation: text(errors, 'foundation', input.foundation, { label: 'Foundation', max: 240 }),
    positioning_statement: text(errors, 'positioning_statement', input.positioning_statement, { label: 'Positioning statement', max: 600 }),
    target_audience_id: uuid(errors, 'target_audience_id', input.target_audience_id, { label: 'Target audience' }),
    market: oneOf(errors, 'market', input.market, STRATEGY_MARKETS, { label: 'Market' }),
  }
}

export async function createFramework(input: FrameworkInput): Promise<ActionResult> {
  const { session, error } = await authorise('positioning', 'createFramework')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const values = parseFramework(input, errors)
  if (!errors.ok) return invalid(errors)
  const { supabase, ctx, userId } = session
  if (values.target_audience_id && !(await ownsRecord(supabase, 'strategy_audiences', values.target_audience_id, ctx.workspaceId))) return fail('Audience not found.')
  const { count } = await supabase.from('strategy_positioning_frameworks').select('id', { count: 'exact', head: true }).eq('workspace_id', ctx.workspaceId).is('archived_at', null)
  const { data, error: insertError } = await supabase.from('strategy_positioning_frameworks').insert({
    ...values, is_primary: (count ?? 0) === 0, status: 'draft', owner_id: userId, created_by: userId, workspace_id: ctx.workspaceId,
  }).select('id').single()
  if (insertError || !data) return fail(dbError(insertError, 'Could not create the framework.'))
  await record(session, { entityType: 'framework', entityId: data.id, action: 'created framework', summary: `"${values.name}"`, surface: 'positioning' })
  revalidateStrategy()
  return { ok: true, id: data.id, message: 'Framework created as a draft.' }
}

export async function updateFramework(id: string, input: FrameworkInput): Promise<ActionResult> {
  const { session, error } = await authorise('positioning', 'editFramework')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const values = parseFramework(input, errors)
  if (!errors.ok) return invalid(errors)
  const { supabase, ctx } = session
  const { data: current } = await supabase.from('strategy_positioning_frameworks').select('status, version, archived_at').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Framework not found.')
  if (current.archived_at) return fail('Restore this framework before editing it.')
  if (current.status === 'in_review') return fail('This framework is in review. Withdraw it or wait for a decision before editing.')
  if (values.target_audience_id && !(await ownsRecord(supabase, 'strategy_audiences', values.target_audience_id, ctx.workspaceId))) return fail('Audience not found.')
  // Editing an approved framework starts a new draft version so approvals stay meaningful.
  const patch = current.status === 'approved' ? { ...values, status: 'draft', version: current.version + 1 } : values
  const { error: updateError } = await supabase.from('strategy_positioning_frameworks').update(patch).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not save the framework.'))
  await record(session, { entityType: 'framework', entityId: id, action: 'updated positioning statement', summary: `${values.name}${current.status === 'approved' ? ` (v${current.version + 1} draft)` : ''}`, surface: 'positioning' })
  revalidateStrategy()
  return { ok: true, id, message: current.status === 'approved' ? `Saved as draft v${current.version + 1}. Submit it for approval when ready.` : 'Framework saved.' }
}

export async function addProofPoint(input: { framework_id?: string; label?: string; category?: string; impact?: string; evidence_research_id?: string }): Promise<ActionResult> {
  const { session, error } = await authorise('positioning', 'editFramework')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const values = {
    framework_id: uuid(errors, 'framework_id', input.framework_id, { label: 'Framework', required: true }),
    label: text(errors, 'label', input.label, { label: 'Proof point', required: true, max: 120 }),
    category: oneOf(errors, 'category', input.category, PROOF_CATEGORIES, { label: 'Category', fallback: 'trust' }),
    impact: oneOf(errors, 'impact', input.impact, IMPACT_LEVELS, { label: 'Impact', fallback: 'medium' }),
    evidence_research_id: uuid(errors, 'evidence_research_id', input.evidence_research_id, { label: 'Evidence' }),
  }
  if (!errors.ok) return invalid(errors)
  const { supabase, ctx, userId } = session
  if (!(await ownsRecord(supabase, 'strategy_positioning_frameworks', values.framework_id, ctx.workspaceId))) return fail('Framework not found.')
  if (values.evidence_research_id && !(await ownsRecord(supabase, 'strategy_research_items', values.evidence_research_id, ctx.workspaceId))) return fail('Evidence not found.')
  const { data: last } = await supabase.from('strategy_proof_points').select('sort_order').eq('framework_id', values.framework_id!).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  // New claims start unverified; evidence moves them to review, never straight to verified.
  const { error: insertError } = await supabase.from('strategy_proof_points').insert({
    ...values, verification: values.evidence_research_id ? 'in_review' : 'unverified', sort_order: (last?.sort_order ?? 0) + 1, created_by: userId, workspace_id: ctx.workspaceId,
  })
  if (insertError) return fail(dbError(insertError, 'Could not add the proof point.'))
  await record(session, { entityType: 'proof_point', entityId: values.framework_id, action: 'added proof point', summary: `"${values.label}"`, surface: 'positioning' })
  revalidateStrategy()
  return { ok: true, message: 'Proof point added.' }
}

export async function setProofVerification(id: string, verification: string): Promise<ActionResult> {
  const { session, error } = await authorise('positioning', 'approveFramework')
  if (!session) return fail(error)
  if (!(VERIFICATION_STATES as readonly string[]).includes(verification)) return fail('Unknown verification state.')
  const { supabase, ctx } = session
  const { data, error: updateError } = await supabase.from('strategy_proof_points').update({ verification }).eq('id', id).eq('workspace_id', ctx.workspaceId).select('label, framework_id')
  if (updateError) return fail(dbError(updateError, 'Could not update verification.'))
  if (!data?.length) return fail('Proof point not found.')
  await record(session, { entityType: 'proof_point', entityId: data[0].framework_id, action: `marked proof ${verification.replace('_', ' ')}`, summary: `"${data[0].label}"`, surface: 'positioning' })
  revalidateStrategy()
  return { ok: true, message: 'Verification updated.' }
}

export async function addClaim(input: { framework_id?: string; claim?: string; risk_level?: string; rationale?: string }): Promise<ActionResult> {
  const { session, error } = await authorise('positioning', 'editFramework')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const values = {
    framework_id: uuid(errors, 'framework_id', input.framework_id, { label: 'Framework', required: true }),
    claim: text(errors, 'claim', input.claim, { label: 'Claim', required: true, max: 160 }),
    risk_level: oneOf(errors, 'risk_level', input.risk_level, RISK_LEVELS, { label: 'Risk', fallback: 'medium' }),
    rationale: text(errors, 'rationale', input.rationale, { label: 'Rationale', max: 500 }),
  }
  if (!errors.ok) return invalid(errors)
  const { supabase, ctx, userId } = session
  if (!(await ownsRecord(supabase, 'strategy_positioning_frameworks', values.framework_id, ctx.workspaceId))) return fail('Framework not found.')
  const { error: insertError } = await supabase.from('strategy_claims').insert({ ...values, created_by: userId, workspace_id: ctx.workspaceId })
  if (insertError) return fail(dbError(insertError, 'Could not add the claim.'))
  await record(session, { entityType: 'claim', entityId: values.framework_id, action: 'added claim', summary: `"${values.claim}"`, surface: 'positioning' })
  revalidateStrategy()
  return { ok: true, message: 'Claim added for risk review.' }
}

/** Cycles one matrix cell. Both ids must belong to the same framework in this workspace. */
export async function setMatrixScore(competitorId: string, attributeId: string, score: string): Promise<ActionResult> {
  const { session, error } = await authorise('positioning', 'editFramework')
  if (!session) return fail(error)
  if (!(MATRIX_SCORES as readonly string[]).includes(score)) return fail('Unknown score.')
  const { supabase, ctx } = session
  const [{ data: competitor }, { data: attribute }] = await Promise.all([
    supabase.from('strategy_competitors').select('framework_id, name').eq('id', competitorId).eq('workspace_id', ctx.workspaceId).maybeSingle(),
    supabase.from('strategy_competitor_attributes').select('framework_id, name').eq('id', attributeId).eq('workspace_id', ctx.workspaceId).maybeSingle(),
  ])
  if (!competitor || !attribute || competitor.framework_id !== attribute.framework_id) return fail('Matrix cell not found.')
  const { error: upsertError } = await supabase.from('strategy_competitor_scores').upsert({
    workspace_id: ctx.workspaceId, competitor_id: competitorId, attribute_id: attributeId, score, updated_at: new Date().toISOString(),
  }, { onConflict: 'competitor_id,attribute_id' })
  if (upsertError) return fail(dbError(upsertError, 'Could not update the score.'))
  await record(session, { entityType: 'competitor', entityId: competitor.framework_id, action: 'updated matrix', summary: `${competitor.name} · ${attribute.name} → ${score}`, surface: 'positioning' })
  revalidateStrategy()
  return { ok: true }
}

/**
 * Starts (or restarts) the governed workflow: Draft ✓ → Review → Legal review
 * → Leadership → Approved. Approvers must be workspace members.
 */
export async function submitFrameworkForApproval(input: { framework_id?: string; reviewer_id?: string; legal_id?: string; leadership_id?: string; due_date?: string }): Promise<ActionResult> {
  const { session, error } = await authorise('positioning', 'editFramework')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const frameworkId = uuid(errors, 'framework_id', input.framework_id, { label: 'Framework', required: true })
  const approvers = {
    review: uuid(errors, 'reviewer_id', input.reviewer_id, { label: 'Reviewer', required: true }),
    legal_review: uuid(errors, 'legal_id', input.legal_id, { label: 'Legal reviewer', required: true }),
    leadership: uuid(errors, 'leadership_id', input.leadership_id, { label: 'Leadership approver', required: true }),
  }
  const due = isoDate(errors, 'due_date', input.due_date, { label: 'Due date' })
  if (due && due < new Date().toISOString().slice(0, 10)) errors.add('due_date', 'Due date cannot be in the past.')
  if (!errors.ok) return invalid(errors)
  const { supabase, ctx, userId } = session

  const { data: framework } = await supabase.from('strategy_positioning_frameworks').select('name, status, archived_at').eq('id', frameworkId!).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!framework) return fail('Framework not found.')
  if (framework.archived_at) return fail('Archived frameworks cannot be submitted.')
  if (framework.status === 'in_review') return fail('This framework is already in review.')
  const ids = [...new Set(Object.values(approvers))] as string[]
  const { data: members } = await supabase.from('workspace_members').select('user_id').eq('workspace_id', ctx.workspaceId).in('user_id', ids)
  if ((members ?? []).length !== ids.length) return fail('Every approver must be a member of this workspace.')

  await supabase.from('strategy_approvals').delete().eq('workspace_id', ctx.workspaceId).eq('entity_type', 'framework').eq('entity_id', frameworkId!).eq('status', 'pending')
  const now = new Date().toISOString()
  const { error: insertError } = await supabase.from('strategy_approvals').insert(WORKFLOW.map((stage, index) => ({
    workspace_id: ctx.workspaceId, entity_type: 'framework', entity_id: frameworkId, stage, sort_order: index + 1,
    status: stage === 'draft' ? 'approved' : 'pending', requested_by: userId, requested_at: now,
    approver_id: stage === 'draft' ? userId : stage === 'approved' ? approvers.leadership : approvers[stage as keyof typeof approvers],
    decided_at: stage === 'draft' ? now : null, due_date: due,
  })))
  if (insertError) return fail(dbError(insertError, 'Could not start the approval workflow.'))
  const { error: updateError } = await supabase.from('strategy_positioning_frameworks').update({ status: 'in_review' }).eq('id', frameworkId!).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not submit the framework.'))
  await notifyStrategy(session, {
    recipientId: approvers.review, type: 'strategy_approval_request', title: 'Positioning needs your review',
    body: `"${framework.name}" is waiting for your review.`, module: 'positioning', entityId: frameworkId,
  })
  await record(session, { entityType: 'framework', entityId: frameworkId, action: 'submitted framework', summary: `"${framework.name}" for review`, surface: 'positioning' })
  revalidateStrategy()
  return { ok: true, message: 'Submitted for approval.' }
}

/**
 * Records a decision on the current stage. Only the assigned approver (or an
 * admin/owner) may decide, stages cannot be skipped, and changes/rejection
 * require a comment. Approving the last stage approves the framework.
 */
export async function decideApproval(approvalId: string, decision: 'approved' | 'changes_requested' | 'rejected', comment?: string): Promise<ActionResult> {
  const { session, error } = await authorise('positioning', 'approveFramework')
  if (!session) return fail(error)
  if (!['approved', 'changes_requested', 'rejected'].includes(decision)) return fail('Unknown decision.')
  const errors = new FieldErrors()
  const note = text(errors, 'comment', comment, { label: 'Comment', required: decision !== 'approved', max: 1000 })
  if (!errors.ok) return invalid(errors)
  const { supabase, ctx, userId } = session

  const { data: approval } = await supabase.from('strategy_approvals').select('id, entity_type, entity_id, stage, status, approver_id, sort_order, requested_by')
    .eq('id', approvalId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!approval) return fail('Approval not found.')
  if (approval.status !== 'pending') return fail('This stage has already been decided.')
  const privileged = ['owner', 'admin'].includes(ctx.role ?? '')
  if (approval.approver_id && approval.approver_id !== userId && !privileged) return fail('Only the assigned approver can decide this stage.')
  const { data: earlier } = await supabase.from('strategy_approvals').select('id').eq('workspace_id', ctx.workspaceId)
    .eq('entity_type', approval.entity_type).eq('entity_id', approval.entity_id).eq('status', 'pending').lt('sort_order', approval.sort_order).limit(1)
  if ((earlier ?? []).length) return fail('Earlier stages must be decided first.')

  const now = new Date().toISOString()
  const { error: updateError } = await supabase.from('strategy_approvals').update({ status: decision, comment: note, decided_at: now, approver_id: approval.approver_id ?? userId })
    .eq('id', approvalId).eq('workspace_id', ctx.workspaceId).eq('status', 'pending')
  if (updateError) return fail(dbError(updateError, 'Could not record the decision.'))
  if (note) await supabase.from('strategy_comments').insert({ workspace_id: ctx.workspaceId, entity_type: 'approval', entity_id: approvalId, body: note, author_id: userId })

  if (approval.entity_type === 'framework') {
    let frameworkStatus: string | null = null
    if (decision !== 'approved') frameworkStatus = 'changes_requested'
    else {
      const { data: remaining } = await supabase.from('strategy_approvals').select('id, stage').eq('workspace_id', ctx.workspaceId)
        .eq('entity_type', 'framework').eq('entity_id', approval.entity_id).eq('status', 'pending').order('sort_order')
      const next = (remaining ?? []) as { id: string; stage: string }[]
      // The terminal "approved" stage closes automatically once leadership signs off.
      if (next.length === 1 && next[0].stage === 'approved') {
        await supabase.from('strategy_approvals').update({ status: 'approved', decided_at: now }).eq('id', next[0].id)
        frameworkStatus = 'approved'
      } else if (next.length === 0) frameworkStatus = 'approved'
    }
    if (decision !== 'approved') {
      await supabase.from('strategy_approvals').delete().eq('workspace_id', ctx.workspaceId).eq('entity_type', 'framework').eq('entity_id', approval.entity_id).eq('status', 'pending')
    }
    if (frameworkStatus) await supabase.from('strategy_positioning_frameworks').update({ status: frameworkStatus }).eq('id', approval.entity_id).eq('workspace_id', ctx.workspaceId)
    await notifyStrategy(session, {
      recipientId: approval.requested_by, type: 'strategy_approval_decision',
      title: decision === 'approved' ? `${APPROVAL_STAGE_LABELS[approval.stage as ApprovalStage]} approved` : 'Changes requested on positioning',
      body: note ? note.slice(0, 200) : null, module: 'positioning', entityId: approval.entity_id,
    })
  }
  await record(session, {
    entityType: 'approval', entityId: approval.entity_id,
    action: decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'requested changes',
    summary: `${APPROVAL_STAGE_LABELS[approval.stage as ApprovalStage]}${note ? `: ${note.slice(0, 80)}` : ''}`, surface: 'positioning',
    metadata: { stage: approval.stage, decision },
  })
  revalidateStrategy()
  return { ok: true, message: decision === 'approved' ? 'Stage approved.' : 'Sent back with your comments.' }
}

/** In-app reminder to the current approver. At most one per stage per 24 hours. */
export async function sendApprovalReminder(approvalId: string): Promise<ActionResult> {
  const { session, error } = await authorise('positioning', 'editFramework')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session
  const { data: approval } = await supabase.from('strategy_approvals').select('id, entity_id, stage, status, approver_id').eq('id', approvalId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!approval) return fail('Approval not found.')
  if (approval.status !== 'pending' || !approval.approver_id) return fail('There is no pending approver to remind.')
  if (approval.approver_id === userId) return fail('You are the current approver.')
  const since = new Date(Date.now() - 86_400_000).toISOString()
  const { count } = await supabase.from('strategy_activity').select('id', { count: 'exact', head: true })
    .eq('workspace_id', ctx.workspaceId).eq('action', 'sent reminder').eq('entity_id', approval.entity_id).gte('created_at', since)
  if ((count ?? 0) > 0 || await rateLimited(supabase, ctx.workspaceId, userId, 'sent reminder', 10, 60)) return fail('A reminder was sent in the last 24 hours.')
  const { data: framework } = await supabase.from('strategy_positioning_frameworks').select('name').eq('id', approval.entity_id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  const sent = await notifyStrategy(session, {
    recipientId: approval.approver_id, type: 'strategy_approval_reminder',
    title: `Reminder: ${APPROVAL_STAGE_LABELS[approval.stage as ApprovalStage]} is waiting on you`,
    body: framework ? `"${framework.name}"` : null, module: 'positioning', entityId: approval.entity_id,
  })
  if (!sent.inApp && sent.email !== 'sent') return fail('Could not send the reminder. The approver may have turned approval notifications off.')
  await record(session, { entityType: 'approval', entityId: approval.entity_id, action: 'sent reminder', summary: APPROVAL_STAGE_LABELS[approval.stage as ApprovalStage], surface: 'positioning' })
  revalidateStrategy()
  return { ok: true, message: 'Reminder sent.' }
}

export async function setFrameworkArchived(id: string, archived: boolean): Promise<ActionResult> {
  const { session, error } = await authorise('positioning', 'editFramework')
  if (!session) return fail(error)
  const { supabase, ctx } = session
  const { data: current } = await supabase.from('strategy_positioning_frameworks').select('name, archived_at, is_primary').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Framework not found.')
  if (archived && current.is_primary) return fail('Make another framework primary before archiving this one.')
  const { error: updateError } = await supabase.from('strategy_positioning_frameworks')
    .update(archived ? { status: 'archived', archived_at: new Date().toISOString() } : { status: 'draft', archived_at: null })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not update the framework.'))
  await record(session, { entityType: 'framework', entityId: id, action: archived ? 'archived framework' : 'restored framework', summary: `"${current.name}"`, surface: 'positioning' })
  revalidateStrategy()
  return { ok: true, message: archived ? 'Framework archived.' : 'Framework restored as a draft.' }
}

export async function makeFrameworkPrimary(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('positioning', 'approveFramework')
  if (!session) return fail(error)
  const { supabase, ctx } = session
  const { data: current } = await supabase.from('strategy_positioning_frameworks').select('name, status, archived_at').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current || current.archived_at) return fail('Framework not found.')
  await supabase.from('strategy_positioning_frameworks').update({ is_primary: false }).eq('workspace_id', ctx.workspaceId).eq('is_primary', true)
  const { error: updateError } = await supabase.from('strategy_positioning_frameworks').update({ is_primary: true }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not change the primary framework.'))
  await record(session, { entityType: 'framework', entityId: id, action: 'set primary framework', summary: `"${current.name}"`, surface: 'positioning' })
  revalidateStrategy()
  return { ok: true, message: `"${current.name}" is now the primary framework.` }
}
