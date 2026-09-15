'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getMarketplaceSession, type MarketplaceSession } from './server'
import { MARKETPLACE_BASE } from './module'
import type { MarketplaceCapabilities, MarketplaceContext } from './entitlements'

export interface ActionResult<T = undefined> {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
  data?: T
}

const GENERIC_ERROR = 'We could not complete that action. Try again, or contact support with reference MKT-ACTION.'

/**
 * Every mutation goes through this guard. It re-resolves the session on the
 * server — never trusting a client-supplied workspace id — and re-checks the
 * capability. Hiding a button is not security.
 */
async function guard(
  capability: keyof MarketplaceCapabilities,
): Promise<{ session: MarketplaceSession } | { error: string }> {
  const session = await getMarketplaceSession()
  if (!session.capabilities[capability]) {
    return { error: 'You do not have permission to perform this action.' }
  }
  return { session }
}

/** Audit trail. Uses the real `audit_logs` column names and never throws. */
async function audit(
  supabase: SupabaseClient,
  ctx: MarketplaceContext,
  userId: string,
  action: string,
  resource: { type: string; id: string | null },
  metadata: Record<string, unknown> = {},
) {
  try {
    await supabase.from('audit_logs').insert({
      workspace_id: ctx.workspaceId,
      actor_id: userId,
      action: `marketplace.${action}`,
      resource_type: resource.type,
      resource_id: resource.id,
      metadata: { ...metadata, source_route: MARKETPLACE_BASE },
    })
  } catch {
    // Auditing must never break the primary action.
  }
}

/** Human-readable workspace activity used by the on-page feeds. */
async function activity(
  session: MarketplaceSession,
  event: string,
  summary: string,
  entity: { type: string; id: string | null; href?: string },
) {
  try {
    await session.supabase.from('marketplace_activity').insert({
      workspace_id: session.ctx.workspaceId,
      actor_id: session.userId,
      event,
      summary,
      entity_type: entity.type,
      entity_id: entity.id,
      href: entity.href ?? null,
    })
  } catch {
    // Activity is a convenience, never a hard dependency of the mutation.
  }
}

function revalidateMarketplace() {
  for (const path of ['', '/discover', '/discover/influencers', '/discover/services',
    '/discover/ugc-creators', '/categories', '/saved', '/requests', '/orders']) {
    revalidatePath(`${MARKETPLACE_BASE}${path}`)
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── Saved items ──────────────────────────────────────────────────────────────

export async function toggleSavedSupplier(supplierId: string, note?: string): Promise<ActionResult<{ saved: boolean }>> {
  if (!UUID.test(supplierId)) return { ok: false, error: 'That supplier could not be found.' }
  const guarded = await guard('save')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { session } = guarded

  try {
    // The supplier must be publicly visible — never save a hidden or suspended profile.
    const { data: supplier } = await session.supabase
      .from('marketplace_suppliers')
      .select('id, display_name, type')
      .eq('id', supplierId).eq('status', 'active').maybeSingle()
    if (!supplier) return { ok: false, error: 'That supplier is no longer available.' }

    const { data: existing } = await session.supabase
      .from('marketplace_saved_items')
      .select('id')
      .eq('workspace_id', session.ctx.workspaceId)
      .eq('user_id', session.userId)
      .eq('supplier_id', supplierId)
      .maybeSingle()

    if (existing) {
      await session.supabase.from('marketplace_saved_items').delete().eq('id', existing.id)
      await audit(session.supabase, session.ctx, session.userId, 'supplier.unsaved', { type: 'marketplace_supplier', id: supplierId })
      await activity(session, 'supplier.unsaved', `Removed ${supplier.display_name} from saved`, { type: 'supplier', id: supplierId, href: `${MARKETPLACE_BASE}/saved` })
      revalidateMarketplace()
      return { ok: true, data: { saved: false } }
    }

    const { count } = await session.supabase
      .from('marketplace_saved_items')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', session.ctx.workspaceId)
      .eq('user_id', session.userId)
    if ((count ?? 0) >= session.capabilities.savedLimit) {
      return { ok: false, error: `Your plan allows ${session.capabilities.savedLimit} saved items. Remove one or upgrade to save more.` }
    }

    const { error } = await session.supabase.from('marketplace_saved_items').insert({
      workspace_id: session.ctx.workspaceId,
      user_id: session.userId,
      item_type: supplier.type === 'ugc_creator' || supplier.type === 'influencer' ? 'creator' : 'supplier',
      supplier_id: supplierId,
      note: note?.slice(0, 500) || null,
      last_interaction_at: new Date().toISOString(),
    })
    if (error) throw error

    await audit(session.supabase, session.ctx, session.userId, 'supplier.saved', { type: 'marketplace_supplier', id: supplierId })
    await activity(session, 'supplier.saved', `Saved ${supplier.display_name} to your partners`, { type: 'supplier', id: supplierId, href: `${MARKETPLACE_BASE}/saved` })
    revalidateMarketplace()
    return { ok: true, data: { saved: true } }
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }
}

export async function updateSavedNote(savedItemId: string, note: string): Promise<ActionResult> {
  if (!UUID.test(savedItemId)) return { ok: false, error: 'That saved item could not be found.' }
  const guarded = await guard('save')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { session } = guarded

  const { error } = await session.supabase
    .from('marketplace_saved_items')
    .update({ note: note.slice(0, 500) || null, updated_at: new Date().toISOString() })
    .eq('id', savedItemId)
    .eq('workspace_id', session.ctx.workspaceId)
    .eq('user_id', session.userId)
  if (error) return { ok: false, error: GENERIC_ERROR }
  revalidatePath(`${MARKETPLACE_BASE}/saved`)
  return { ok: true }
}

export async function removeSavedItem(savedItemId: string): Promise<ActionResult> {
  if (!UUID.test(savedItemId)) return { ok: false, error: 'That saved item could not be found.' }
  const guarded = await guard('save')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { session } = guarded

  const { error } = await session.supabase
    .from('marketplace_saved_items').delete()
    .eq('id', savedItemId)
    .eq('workspace_id', session.ctx.workspaceId)
    .eq('user_id', session.userId)
  if (error) return { ok: false, error: GENERIC_ERROR }
  await audit(session.supabase, session.ctx, session.userId, 'saved_item.removed', { type: 'marketplace_saved_item', id: savedItemId })
  revalidateMarketplace()
  return { ok: true }
}

// ── Shortlist ────────────────────────────────────────────────────────────────

export async function toggleShortlist(supplierId: string, requestId?: string): Promise<ActionResult<{ shortlisted: boolean }>> {
  if (!UUID.test(supplierId)) return { ok: false, error: 'That supplier could not be found.' }
  const guarded = await guard('compare')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { session } = guarded

  try {
    const { data: existing } = await session.supabase
      .from('marketplace_shortlist_items')
      .select('id')
      .eq('workspace_id', session.ctx.workspaceId)
      .eq('user_id', session.userId)
      .eq('supplier_id', supplierId)
      .maybeSingle()

    if (existing) {
      await session.supabase.from('marketplace_shortlist_items').delete().eq('id', existing.id)
      revalidateMarketplace()
      return { ok: true, data: { shortlisted: false } }
    }

    const { error } = await session.supabase.from('marketplace_shortlist_items').insert({
      workspace_id: session.ctx.workspaceId,
      user_id: session.userId,
      supplier_id: supplierId,
      request_id: requestId && UUID.test(requestId) ? requestId : null,
    })
    if (error) throw error
    await audit(session.supabase, session.ctx, session.userId, 'supplier.shortlisted', { type: 'marketplace_supplier', id: supplierId })
    revalidateMarketplace()
    return { ok: true, data: { shortlisted: true } }
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }
}

// ── Saved searches ───────────────────────────────────────────────────────────

export async function saveSearch(input: {
  name: string
  mode: string
  params: Record<string, string>
  resultCount?: number
}): Promise<ActionResult<{ id: string }>> {
  const guarded = await guard('search')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { session } = guarded

  const name = input.name.trim().slice(0, 80)
  if (!name) return { ok: false, fieldErrors: { name: 'Give this search a name.' } }

  try {
    const { data, error } = await session.supabase
      .from('marketplace_saved_searches')
      .insert({
        workspace_id: session.ctx.workspaceId,
        user_id: session.userId,
        name,
        mode: input.mode,
        params: input.params,
        result_count: input.resultCount ?? null,
      })
      .select('id')
      .single()
    if (error) throw error
    await activity(session, 'search.saved', `Created search preset "${name}"`, { type: 'search', id: data.id, href: `${MARKETPLACE_BASE}/saved` })
    revalidateMarketplace()
    return { ok: true, data: { id: data.id } }
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }
}

export async function deleteSavedSearch(id: string): Promise<ActionResult> {
  if (!UUID.test(id)) return { ok: false, error: 'That saved search could not be found.' }
  const guarded = await guard('search')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { session } = guarded

  const { error } = await session.supabase
    .from('marketplace_saved_searches').delete()
    .eq('id', id)
    .eq('workspace_id', session.ctx.workspaceId)
    .eq('user_id', session.userId)
  if (error) return { ok: false, error: GENERIC_ERROR }
  revalidatePath(`${MARKETPLACE_BASE}/saved`)
  return { ok: true }
}

// ── Requests ─────────────────────────────────────────────────────────────────

export interface RequestInput {
  kind: 'discovery' | 'rfq'
  title: string
  category: string
  description: string
  deliverables: string[]
  budgetMin: string
  budgetMax: string
  deadline: string
  proposalsRequested: string
  supplierIds: string[]
  publish: boolean
}

function poundsToCents(value: string): number | null {
  const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null
}

export async function createRequest(input: RequestInput): Promise<ActionResult<{ id: string }>> {
  const guarded = await guard('createRequest')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { session } = guarded

  const fieldErrors: Record<string, string> = {}
  const title = input.title.trim().slice(0, 160)
  if (!title) fieldErrors.title = 'Add a project title.'
  if (!input.category.trim()) fieldErrors.category = 'Choose a category.'
  if (input.description.trim().length < 20) fieldErrors.description = 'Describe the project in at least 20 characters.'

  const budgetMin = poundsToCents(input.budgetMin)
  const budgetMax = poundsToCents(input.budgetMax)
  if (budgetMin !== null && budgetMin < 0) fieldErrors.budgetMin = 'Budget cannot be negative.'
  if (budgetMin !== null && budgetMax !== null && budgetMax < budgetMin) {
    fieldErrors.budgetMax = 'The maximum budget must be at least the minimum.'
  }
  if (input.deadline && Number.isNaN(Date.parse(input.deadline))) fieldErrors.deadline = 'Enter a valid deadline.'
  if (input.deadline && new Date(input.deadline) < new Date(new Date().toDateString())) {
    fieldErrors.deadline = 'The deadline must be in the future.'
  }
  const supplierIds = input.supplierIds.filter(id => UUID.test(id)).slice(0, 25)
  if (input.kind === 'rfq' && supplierIds.length === 0) {
    fieldErrors.supplierIds = 'Invite at least one supplier to an RFQ.'
  }
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors }

  try {
    const { data, error } = await session.supabase
      .from('marketplace_requests')
      .insert({
        workspace_id: session.ctx.workspaceId,
        created_by: session.userId,
        kind: input.kind,
        title,
        category: input.category.trim().slice(0, 80),
        description: input.description.trim().slice(0, 4000),
        deliverables: input.deliverables.map(d => d.trim()).filter(Boolean).slice(0, 20),
        budget_min_cents: budgetMin,
        budget_max_cents: budgetMax,
        deadline: input.deadline || null,
        proposals_requested: Math.min(Math.max(Number.parseInt(input.proposalsRequested, 10) || 5, 1), 25),
        status: input.publish ? 'open' : 'draft',
      })
      .select('id, reference')
      .single()
    if (error) throw error

    if (supplierIds.length && session.capabilities.inviteSuppliers) {
      // Only invite profiles that are genuinely visible in the marketplace.
      const { data: valid } = await session.supabase
        .from('marketplace_suppliers').select('id').in('id', supplierIds).eq('status', 'active')
      const rows = (valid ?? []).map(supplier => ({ request_id: data.id, supplier_id: supplier.id }))
      if (rows.length) await session.supabase.from('marketplace_request_invites').insert(rows)
    }

    await audit(session.supabase, session.ctx, session.userId, 'request.created',
      { type: 'marketplace_request', id: data.id },
      { reference: data.reference, kind: input.kind, invited: supplierIds.length })
    await activity(session, 'request.created',
      input.publish
        ? `New request "${title}" submitted to ${supplierIds.length} supplier${supplierIds.length === 1 ? '' : 's'}`
        : `Draft request "${title}" saved`,
      { type: 'request', id: data.id, href: `${MARKETPLACE_BASE}/requests` })

    revalidateMarketplace()
    return { ok: true, data: { id: data.id } }
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }
}

export async function setRequestStatus(
  requestId: string,
  status: 'open' | 'awaiting_proposals' | 'shortlisted' | 'closed_won' | 'closed_cancelled',
): Promise<ActionResult> {
  if (!UUID.test(requestId)) return { ok: false, error: 'That request could not be found.' }
  const capability = status.startsWith('closed') ? 'closeRequest' : 'editRequest'
  const guarded = await guard(capability)
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { session } = guarded

  const { data: current } = await session.supabase
    .from('marketplace_requests').select('status, title')
    .eq('id', requestId).eq('workspace_id', session.ctx.workspaceId).maybeSingle()
  if (!current) return { ok: false, error: 'That request could not be found.' }
  if (current.status.startsWith('closed')) {
    return { ok: false, error: 'This request is already closed and cannot change status.' }
  }

  const { error } = await session.supabase
    .from('marketplace_requests')
    .update({
      status,
      closed_at: status.startsWith('closed') ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId).eq('workspace_id', session.ctx.workspaceId)
  if (error) return { ok: false, error: GENERIC_ERROR }

  await audit(session.supabase, session.ctx, session.userId, 'request.status_changed',
    { type: 'marketplace_request', id: requestId }, { from: current.status, to: status })
  await activity(session, 'request.status_changed', `"${current.title}" moved to ${status.replace(/_/g, ' ')}`,
    { type: 'request', id: requestId, href: `${MARKETPLACE_BASE}/requests` })
  revalidateMarketplace()
  return { ok: true }
}

export async function setProposalStatus(
  proposalId: string,
  status: 'shortlisted' | 'clarification' | 'rejected' | 'accepted',
): Promise<ActionResult> {
  if (!UUID.test(proposalId)) return { ok: false, error: 'That proposal could not be found.' }
  const guarded = await guard('evaluateProposals')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { session } = guarded

  // Ownership is proven through the request's workspace, not the client payload.
  const { data: proposal } = await session.supabase
    .from('marketplace_proposals')
    .select('id, request_id, supplier_id, marketplace_requests!inner(workspace_id, title)')
    .eq('id', proposalId)
    .eq('marketplace_requests.workspace_id', session.ctx.workspaceId)
    .maybeSingle()
  if (!proposal) return { ok: false, error: 'That proposal could not be found.' }

  const { error } = await session.supabase
    .from('marketplace_proposals')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', proposalId)
  if (error) return { ok: false, error: GENERIC_ERROR }

  await audit(session.supabase, session.ctx, session.userId, `proposal.${status}`,
    { type: 'marketplace_proposal', id: proposalId }, { request_id: proposal.request_id })
  revalidateMarketplace()
  return { ok: true }
}

// ── Orders, delivery and escrow ──────────────────────────────────────────────

async function loadOrder(session: MarketplaceSession, orderId: string) {
  const { data } = await session.supabase
    .from('marketplace_orders')
    .select('id, reference, amount_cents, released_cents, status, escrow_status, delivery_status, supplier_id')
    .eq('id', orderId).eq('workspace_id', session.ctx.workspaceId).maybeSingle()
  return data
}

export async function approveDelivery(orderId: string): Promise<ActionResult> {
  if (!UUID.test(orderId)) return { ok: false, error: 'That order could not be found.' }
  const guarded = await guard('approveDelivery')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { session } = guarded

  const order = await loadOrder(session, orderId)
  if (!order) return { ok: false, error: 'That order could not be found.' }
  if (!['pending_review', 'pending_delivery', 'in_progress'].includes(order.delivery_status)) {
    return { ok: false, error: 'This order is not awaiting delivery approval.' }
  }
  if (order.escrow_status === 'on_hold') {
    return { ok: false, error: 'Escrow is on hold while a dispute is open. Resolve the dispute first.' }
  }

  const { error } = await session.supabase
    .from('marketplace_orders')
    .update({ delivery_status: 'delivered', current_milestone: 'Completed', updated_at: new Date().toISOString() })
    .eq('id', orderId).eq('workspace_id', session.ctx.workspaceId)
  if (error) return { ok: false, error: GENERIC_ERROR }

  await audit(session.supabase, session.ctx, session.userId, 'order.delivery_approved',
    { type: 'marketplace_order', id: orderId }, { reference: order.reference })
  await activity(session, 'order.delivery_approved', `Delivery approved on ${order.reference}`,
    { type: 'order', id: orderId, href: `${MARKETPLACE_BASE}/orders` })
  revalidateMarketplace()
  return { ok: true }
}

export async function requestRevision(orderId: string, note: string): Promise<ActionResult> {
  if (!UUID.test(orderId)) return { ok: false, error: 'That order could not be found.' }
  const guarded = await guard('editOrder')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { session } = guarded

  const order = await loadOrder(session, orderId)
  if (!order) return { ok: false, error: 'That order could not be found.' }

  const { error } = await session.supabase
    .from('marketplace_orders')
    .update({ delivery_status: 'in_progress', current_milestone: 'Revision requested', updated_at: new Date().toISOString() })
    .eq('id', orderId).eq('workspace_id', session.ctx.workspaceId)
  if (error) return { ok: false, error: GENERIC_ERROR }

  await audit(session.supabase, session.ctx, session.userId, 'order.revision_requested',
    { type: 'marketplace_order', id: orderId }, { note: note.slice(0, 500) })
  await activity(session, 'order.revision_requested', `Revision requested on ${order.reference}`,
    { type: 'order', id: orderId, href: `${MARKETPLACE_BASE}/orders` })
  revalidateMarketplace()
  return { ok: true }
}

/**
 * Releases escrow for an order.
 *
 * The ledger row is written first with a deterministic idempotency key so a
 * double-click or a retry can never release twice; the order is only moved to
 * `released` once that row exists. No payment provider is connected in this
 * environment, so the transaction is recorded as `pending` and reconciled by the
 * provider webhook when Stripe Connect is configured (see user-fixes doc).
 */
export async function releaseEscrow(orderId: string, note?: string): Promise<ActionResult> {
  if (!UUID.test(orderId)) return { ok: false, error: 'That order could not be found.' }
  const guarded = await guard('releaseEscrow')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { session } = guarded

  const order = await loadOrder(session, orderId)
  if (!order) return { ok: false, error: 'That order could not be found.' }
  if (order.escrow_status === 'released') return { ok: false, error: 'Escrow has already been released for this order.' }
  if (order.escrow_status === 'on_hold') return { ok: false, error: 'Escrow is on hold while a dispute is open.' }
  if (!['in_escrow', 'funded', 'partially_released'].includes(order.escrow_status)) {
    return { ok: false, error: 'This order has no funds available to release.' }
  }
  if (order.delivery_status !== 'delivered') {
    return { ok: false, error: 'Approve the delivery before releasing escrow.' }
  }

  const remaining = order.amount_cents - (order.released_cents ?? 0)
  if (remaining <= 0) return { ok: false, error: 'There are no remaining funds to release.' }

  const { error: ledgerError } = await session.supabase
    .from('marketplace_escrow_transactions')
    .insert({
      order_id: orderId,
      workspace_id: session.ctx.workspaceId,
      kind: 'release',
      amount_cents: remaining,
      state: 'pending',
      actor_id: session.userId,
      note: note?.slice(0, 300) ?? null,
      idempotency_key: `release-${orderId}-${order.released_cents ?? 0}`,
    })
  if (ledgerError) {
    // A unique-violation here means the same release is already in flight.
    return { ok: false, error: 'A release for this order is already in progress.' }
  }

  await session.supabase
    .from('marketplace_orders')
    .update({
      escrow_status: 'released',
      released_cents: order.amount_cents,
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId).eq('workspace_id', session.ctx.workspaceId)

  await audit(session.supabase, session.ctx, session.userId, 'escrow.released',
    { type: 'marketplace_order', id: orderId }, { reference: order.reference, amount_cents: remaining })
  await activity(session, 'escrow.released', `Escrow released on ${order.reference}`,
    { type: 'order', id: orderId, href: `${MARKETPLACE_BASE}/orders` })
  revalidateMarketplace()
  return { ok: true }
}

export async function holdEscrow(orderId: string, reason: string): Promise<ActionResult> {
  if (!UUID.test(orderId)) return { ok: false, error: 'That order could not be found.' }
  const guarded = await guard('releaseEscrow')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { session } = guarded

  const order = await loadOrder(session, orderId)
  if (!order) return { ok: false, error: 'That order could not be found.' }
  if (order.escrow_status === 'released') return { ok: false, error: 'Escrow has already been released for this order.' }

  await session.supabase.from('marketplace_escrow_transactions').insert({
    order_id: orderId, workspace_id: session.ctx.workspaceId, kind: 'hold',
    amount_cents: order.amount_cents - (order.released_cents ?? 0),
    state: 'succeeded', actor_id: session.userId, note: reason.slice(0, 300),
    idempotency_key: `hold-${orderId}-${Date.now()}`,
  })
  await session.supabase.from('marketplace_orders')
    .update({ escrow_status: 'on_hold', updated_at: new Date().toISOString() })
    .eq('id', orderId).eq('workspace_id', session.ctx.workspaceId)

  await audit(session.supabase, session.ctx, session.userId, 'escrow.held',
    { type: 'marketplace_order', id: orderId }, { reference: order.reference, reason: reason.slice(0, 300) })
  revalidateMarketplace()
  return { ok: true }
}

// ── Disputes ─────────────────────────────────────────────────────────────────

export async function openDispute(input: {
  orderId: string
  reason: string
  requestedResolution: string
  severity: 'low' | 'medium' | 'high'
}): Promise<ActionResult<{ id: string }>> {
  if (!UUID.test(input.orderId)) return { ok: false, error: 'That order could not be found.' }
  const guarded = await guard('createDispute')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { session } = guarded

  const fieldErrors: Record<string, string> = {}
  if (input.reason.trim().length < 10) fieldErrors.reason = 'Describe the issue in at least 10 characters.'
  if (!input.requestedResolution.trim()) fieldErrors.requestedResolution = 'Say what resolution you are asking for.'
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors }

  const order = await loadOrder(session, input.orderId)
  if (!order) return { ok: false, error: 'That order could not be found.' }
  if (order.escrow_status === 'released' || order.escrow_status === 'refunded') {
    return { ok: false, error: 'This order is already settled and cannot be disputed here. Contact support.' }
  }

  const { data: existing } = await session.supabase
    .from('marketplace_disputes').select('id')
    .eq('order_id', input.orderId).not('stage', 'in', '(resolved,rejected)').maybeSingle()
  if (existing) return { ok: false, error: 'A dispute is already open on this order.' }

  const { data, error } = await session.supabase
    .from('marketplace_disputes')
    .insert({
      order_id: input.orderId,
      workspace_id: session.ctx.workspaceId,
      raised_by: session.userId,
      stage: 'opened',
      reason: input.reason.trim().slice(0, 2000),
      requested_resolution: input.requestedResolution.trim().slice(0, 500),
      severity: input.severity,
      amount_cents: order.amount_cents - (order.released_cents ?? 0),
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: GENERIC_ERROR }

  // Opening a dispute freezes the remaining escrow balance.
  await session.supabase.from('marketplace_orders')
    .update({ dispute_state: 'under_review', escrow_status: 'on_hold', status: 'disputed', updated_at: new Date().toISOString() })
    .eq('id', input.orderId).eq('workspace_id', session.ctx.workspaceId)

  await audit(session.supabase, session.ctx, session.userId, 'dispute.opened',
    { type: 'marketplace_dispute', id: data.id }, { order_id: input.orderId, severity: input.severity })
  await activity(session, 'dispute.opened', `Dispute opened on ${order.reference}`,
    { type: 'dispute', id: data.id, href: `${MARKETPLACE_BASE}/orders` })
  revalidateMarketplace()
  return { ok: true, data: { id: data.id } }
}
