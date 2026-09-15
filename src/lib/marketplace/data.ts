// Server-side data access for the Marketplace module.
//
// Every read is scoped by the active workspace (buyer-side records) or by the
// public "active profile" rule (seller directory). Filtering, sorting and
// pagination happen in Postgres so large datasets stay cheap, and counts come
// back from the same query rather than being estimated on the client.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  BUDGET_BANDS, RATING_BANDS, TURNAROUND_BANDS, AUDIENCE_BANDS, ENGAGEMENT_BANDS,
  MODE_SUPPLIER_TYPES, matchScore,
  type ActivityEntry, type MarketplaceCategory, type MarketplaceDispute,
  type MarketplaceModule, type MarketplaceOrder, type MarketplaceProfile,
  type MarketplaceProposal, type MarketplaceRequest, type OrderMilestone,
  type SavedItem, type SavedSearch,
} from './module'
import type { MarketplaceQuery } from './query'
import type { MarketplaceSession } from './server'

const PROFILE_COLUMNS = `
  id, slug, display_name, type, headline, tagline, bio, location, region, country,
  avatar_url, cover_url, rating, reviews_count, verified, status, tags, platforms,
  languages, badges, starting_price_cents, price_unit, min_order_cents, currency,
  turnaround_hours, response_time_minutes, on_time_delivery_pct, job_success_pct,
  projects_count, available_now, audience_size, audience_summary, engagement_rate,
  follower_counts, is_demo
`

function band<T extends { id: string }>(bands: T[], id: string): T | undefined {
  return id ? bands.find(b => b.id === id) : undefined
}

/** Escapes a user term for a PostgREST `or=(...ilike...)` filter. */
function safeTerm(value: string): string {
  return value.replace(/[,()*\\]/g, ' ').trim()
}

// ── Supplier / creator discovery ─────────────────────────────────────────────

export interface ProfileSearchResult {
  rows: MarketplaceProfile[]
  total: number
}

export async function searchProfiles(
  supabase: SupabaseClient,
  query: MarketplaceQuery,
  opts: { mode?: MarketplaceModule; ids?: string[]; limit?: number; categorySupplierIds?: string[] } = {},
): Promise<ProfileSearchResult> {
  let builder = supabase
    .from('marketplace_suppliers')
    .select(PROFILE_COLUMNS, { count: 'exact' })
    .eq('status', 'active')

  const modeTypes = opts.mode ? MODE_SUPPLIER_TYPES[opts.mode] : undefined
  if (modeTypes) builder = builder.in('type', modeTypes)
  if (query.type) builder = builder.eq('type', query.type)
  if (opts.ids) {
    if (opts.ids.length === 0) return { rows: [], total: 0 }
    builder = builder.in('id', opts.ids)
  }
  if (opts.categorySupplierIds) {
    if (opts.categorySupplierIds.length === 0) return { rows: [], total: 0 }
    builder = builder.in('id', opts.categorySupplierIds)
  }

  const term = safeTerm(query.q)
  if (term) {
    builder = builder.or(
      `display_name.ilike.%${term}%,headline.ilike.%${term}%,tagline.ilike.%${term}%,bio.ilike.%${term}%,location.ilike.%${term}%`,
    )
  }
  if (query.location) builder = builder.ilike('location', `%${safeTerm(query.location)}%`)
  if (query.region) builder = builder.eq('region', query.region)
  if (query.country) builder = builder.eq('country', query.country)
  if (query.platform) builder = builder.contains('platforms', [query.platform])
  if (query.language) builder = builder.contains('languages', [query.language])
  if (query.tag) builder = builder.contains('tags', [query.tag])
  if (query.available) builder = builder.eq('available_now', true)
  if (query.verified) builder = builder.eq('verified', true)

  const budget = band(BUDGET_BANDS, query.budget)
  if (budget?.min !== undefined) builder = builder.gte('starting_price_cents', budget.min)
  if (budget?.max !== undefined) builder = builder.lte('starting_price_cents', budget.max)

  const rating = band(RATING_BANDS, query.rating)
  if (rating?.min) builder = builder.gte('rating', rating.min)

  const speed = band(TURNAROUND_BANDS, query.turnaround)
  if (speed?.maxHours) builder = builder.lte('turnaround_hours', speed.maxHours)

  const audience = band(AUDIENCE_BANDS, query.audience)
  if (audience?.min) builder = builder.gte('audience_size', audience.min)
  if (audience?.max) builder = builder.lte('audience_size', audience.max)

  const engagement = band(ENGAGEMENT_BANDS, query.engagement)
  if (engagement?.min) builder = builder.gte('engagement_rate', engagement.min)

  switch (query.sort) {
    case 'rating': builder = builder.order('rating', { ascending: false }).order('reviews_count', { ascending: false }); break
    case 'reviews': builder = builder.order('reviews_count', { ascending: false }); break
    case 'price_low': builder = builder.order('starting_price_cents', { ascending: true, nullsFirst: false }); break
    case 'price_high': builder = builder.order('starting_price_cents', { ascending: false, nullsFirst: false }); break
    case 'fastest': builder = builder.order('turnaround_hours', { ascending: true, nullsFirst: false }); break
    case 'audience': builder = builder.order('audience_size', { ascending: false, nullsFirst: false }); break
    default:
      // "Best match": verified and highly-rated profiles with proven volume first.
      builder = builder
        .order('verified', { ascending: false })
        .order('rating', { ascending: false })
        .order('reviews_count', { ascending: false })
  }
  builder = builder.order('id', { ascending: true })

  const size = opts.limit ?? query.size
  const from = opts.limit ? 0 : (query.page - 1) * size
  builder = builder.range(from, from + size - 1)

  const { data, count, error } = await builder
  if (error) throw error
  return { rows: (data ?? []) as unknown as MarketplaceProfile[], total: count ?? 0 }
}

export async function getProfilesByIds(supabase: SupabaseClient, ids: string[]): Promise<MarketplaceProfile[]> {
  if (!ids.length) return []
  const { data } = await supabase
    .from('marketplace_suppliers')
    .select(PROFILE_COLUMNS)
    .in('id', ids)
    .eq('status', 'active')
  const rows = (data ?? []) as unknown as MarketplaceProfile[]
  // Preserve the caller's ordering (compare tray order matters visually).
  return ids.map(id => rows.find(row => row.id === id)).filter(Boolean) as MarketplaceProfile[]
}

// ── Categories ───────────────────────────────────────────────────────────────

export async function getCategories(supabase: SupabaseClient): Promise<MarketplaceCategory[]> {
  const [{ data: categories }, { data: links }] = await Promise.all([
    supabase.from('marketplace_categories').select('id, slug, name, description, icon, accent, sort_order')
      .eq('active', true).order('sort_order'),
    supabase.from('marketplace_supplier_categories')
      .select('category_id, marketplace_suppliers(rating, reviews_count, projects_count, starting_price_cents, status)'),
  ])

  type LinkRow = {
    category_id: string
    marketplace_suppliers: {
      rating: number | null; reviews_count: number | null; projects_count: number | null
      starting_price_cents: number | null; status: string
    } | null
  }

  const stats = new Map<string, { count: number; rating: number; projects: number; price: number; priced: number }>()
  for (const raw of (links ?? []) as unknown as LinkRow[]) {
    const supplier = raw.marketplace_suppliers
    if (!supplier || supplier.status !== 'active') continue
    const entry = stats.get(raw.category_id) ?? { count: 0, rating: 0, projects: 0, price: 0, priced: 0 }
    entry.count += 1
    entry.rating += Number(supplier.rating ?? 0)
    entry.projects += supplier.projects_count ?? supplier.reviews_count ?? 0
    if (supplier.starting_price_cents) { entry.price += supplier.starting_price_cents; entry.priced += 1 }
    stats.set(raw.category_id, entry)
  }

  return (categories ?? []).map(category => {
    const entry = stats.get(category.id)
    return {
      ...category,
      supplier_count: entry?.count ?? 0,
      projects_count: entry?.projects ?? 0,
      avg_rating: entry && entry.count ? Number((entry.rating / entry.count).toFixed(1)) : 0,
      avg_price_cents: entry && entry.priced ? Math.round(entry.price / entry.priced) : 0,
    } as MarketplaceCategory
  })
}

export async function getCategorySupplierIds(supabase: SupabaseClient, slug: string): Promise<string[]> {
  const { data: category } = await supabase.from('marketplace_categories').select('id').eq('slug', slug).maybeSingle()
  if (!category) return []
  const { data } = await supabase.from('marketplace_supplier_categories').select('supplier_id').eq('category_id', category.id)
  return (data ?? []).map(row => row.supplier_id as string)
}

// ── Saved items, searches and shortlist ──────────────────────────────────────

export async function getSavedItems(session: MarketplaceSession, query?: MarketplaceQuery): Promise<SavedItem[]> {
  let builder = session.supabase
    .from('marketplace_saved_items')
    .select(`id, item_type, supplier_id, listing_id, note, tags, collection, last_interaction_at, created_at,
             marketplace_suppliers(${PROFILE_COLUMNS})`)
    .eq('workspace_id', session.ctx.workspaceId)
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })

  if (query?.type === 'creator' || query?.type === 'supplier') builder = builder.eq('item_type', query.type)
  if (query?.tag) builder = builder.contains('tags', [query.tag])

  const { data } = await builder
  type Row = Omit<SavedItem, 'supplier'> & { marketplace_suppliers: MarketplaceProfile | MarketplaceProfile[] | null }
  let rows = ((data ?? []) as unknown as Row[]).map(row => {
    const supplier = Array.isArray(row.marketplace_suppliers) ? row.marketplace_suppliers[0] : row.marketplace_suppliers
    return { ...row, supplier: supplier ?? null } as SavedItem
  })

  const term = query?.q?.toLowerCase().trim()
  if (term) {
    rows = rows.filter(row =>
      row.supplier?.display_name.toLowerCase().includes(term) ||
      row.supplier?.headline?.toLowerCase().includes(term) ||
      row.note?.toLowerCase().includes(term))
  }
  if (query?.location) {
    const needle = query.location.toLowerCase()
    rows = rows.filter(row => row.supplier?.location?.toLowerCase().includes(needle))
  }
  return rows
}

export async function getSavedSearches(session: MarketplaceSession, mode?: string): Promise<SavedSearch[]> {
  let builder = session.supabase
    .from('marketplace_saved_searches')
    .select('id, name, mode, params, result_count, shared, updated_at')
    .eq('workspace_id', session.ctx.workspaceId)
    .order('updated_at', { ascending: false })
  if (mode) builder = builder.eq('mode', mode)
  const { data } = await builder
  return (data ?? []) as unknown as SavedSearch[]
}

export async function getShortlistIds(session: MarketplaceSession): Promise<string[]> {
  const { data } = await session.supabase
    .from('marketplace_shortlist_items')
    .select('supplier_id')
    .eq('workspace_id', session.ctx.workspaceId)
    .eq('user_id', session.userId)
  return (data ?? []).map(row => row.supplier_id as string)
}

export async function getSavedSupplierIds(session: MarketplaceSession): Promise<string[]> {
  const { data } = await session.supabase
    .from('marketplace_saved_items')
    .select('supplier_id')
    .eq('workspace_id', session.ctx.workspaceId)
    .eq('user_id', session.userId)
    .not('supplier_id', 'is', null)
  return (data ?? []).map(row => row.supplier_id as string)
}

// ── Requests and proposals ───────────────────────────────────────────────────

export interface RequestSearchResult {
  rows: MarketplaceRequest[]
  total: number
  kpis: Record<'open' | 'responses' | 'awaiting' | 'shortlisted' | 'closed_won' | 'closed_cancelled', number>
}

export async function getRequests(session: MarketplaceSession, query: MarketplaceQuery): Promise<RequestSearchResult> {
  let builder = session.supabase
    .from('marketplace_requests')
    .select(`id, reference, kind, title, category, description, deliverables, budget_min_cents,
             budget_max_cents, currency, deadline, status, proposals_requested, created_at, updated_at`,
      { count: 'exact' })
    .eq('workspace_id', session.ctx.workspaceId)

  const term = safeTerm(query.q)
  if (term) builder = builder.or(`title.ilike.%${term}%,reference.ilike.%${term}%,category.ilike.%${term}%`)
  if (query.status) builder = builder.eq('status', query.status)
  if (query.type === 'discovery' || query.type === 'rfq') builder = builder.eq('kind', query.type)
  if (query.category) builder = builder.ilike('category', `%${safeTerm(query.category)}%`)
  if (query.from) builder = builder.gte('deadline', query.from)
  if (query.to) builder = builder.lte('deadline', query.to)

  const budget = band(BUDGET_BANDS, query.budget)
  if (budget?.min !== undefined) builder = builder.gte('budget_max_cents', budget.min)
  if (budget?.max !== undefined) builder = builder.lte('budget_min_cents', budget.max)

  builder = builder.order('updated_at', { ascending: false })
  const from = (query.page - 1) * query.size
  builder = builder.range(from, from + query.size - 1)

  const [{ data, count }, statusCounts, responses] = await Promise.all([
    builder,
    session.supabase.from('marketplace_requests').select('status').eq('workspace_id', session.ctx.workspaceId),
    session.supabase.from('marketplace_proposals').select('request_id, marketplace_requests!inner(workspace_id)')
      .eq('marketplace_requests.workspace_id', session.ctx.workspaceId),
  ])

  const requests = (data ?? []) as unknown as Omit<MarketplaceRequest, 'invited_count' | 'response_count' | 'invited_profiles'>[]
  const ids = requests.map(request => request.id)

  const [{ data: invites }, { data: proposals }] = await Promise.all([
    ids.length
      ? session.supabase.from('marketplace_request_invites')
        .select(`request_id, marketplace_suppliers(id, display_name, avatar_url)`).in('request_id', ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? session.supabase.from('marketplace_proposals').select('request_id').in('request_id', ids)
      : Promise.resolve({ data: [] }),
  ])

  type InviteRow = { request_id: string; marketplace_suppliers: { id: string; display_name: string; avatar_url: string | null } | null }
  const invitesByRequest = new Map<string, InviteRow['marketplace_suppliers'][]>()
  for (const invite of (invites ?? []) as unknown as InviteRow[]) {
    const list = invitesByRequest.get(invite.request_id) ?? []
    list.push(invite.marketplace_suppliers)
    invitesByRequest.set(invite.request_id, list)
  }
  const proposalsByRequest = new Map<string, number>()
  for (const proposal of (proposals ?? []) as { request_id: string }[]) {
    proposalsByRequest.set(proposal.request_id, (proposalsByRequest.get(proposal.request_id) ?? 0) + 1)
  }

  const rows: MarketplaceRequest[] = requests.map(request => {
    const invited = (invitesByRequest.get(request.id) ?? []).filter(Boolean)
    return {
      ...request,
      invited_count: invited.length,
      response_count: proposalsByRequest.get(request.id) ?? 0,
      invited_profiles: invited.slice(0, 4) as MarketplaceRequest['invited_profiles'],
    }
  })

  const statuses = (statusCounts.data ?? []) as { status: string }[]
  const tally = (status: string) => statuses.filter(row => row.status === status).length

  return {
    rows,
    total: count ?? 0,
    kpis: {
      open: tally('open'),
      responses: (responses.data ?? []).length,
      awaiting: tally('awaiting_proposals'),
      shortlisted: tally('shortlisted'),
      closed_won: tally('closed_won'),
      closed_cancelled: tally('closed_cancelled'),
    },
  }
}

export async function getProposals(
  session: MarketplaceSession,
  opts: { requestId?: string; limit?: number } = {},
): Promise<MarketplaceProposal[]> {
  let builder = session.supabase
    .from('marketplace_proposals')
    .select(`id, request_id, supplier_id, amount_cents, currency, delivery_days, message, status,
             capability_score, availability_score, created_at,
             marketplace_suppliers(${PROFILE_COLUMNS}),
             marketplace_requests!inner(id, title, workspace_id)`)
    .eq('marketplace_requests.workspace_id', session.ctx.workspaceId)
    .order('created_at', { ascending: false })

  if (opts.requestId) builder = builder.eq('request_id', opts.requestId)
  if (opts.limit) builder = builder.limit(opts.limit)

  const { data } = await builder
  type Row = Omit<MarketplaceProposal, 'supplier' | 'match_score' | 'request_title'> & {
    marketplace_suppliers: MarketplaceProfile | MarketplaceProfile[] | null
    marketplace_requests: { title: string } | { title: string }[] | null
  }
  const rows = (data ?? []) as unknown as Row[]
  if (!rows.length) return []

  // Match scores compare like with like: cheapest/dearest within the same request.
  const bounds = new Map<string, { min: number; max: number }>()
  for (const row of rows) {
    const current = bounds.get(row.request_id) ?? { min: row.amount_cents, max: row.amount_cents }
    bounds.set(row.request_id, {
      min: Math.min(current.min, row.amount_cents),
      max: Math.max(current.max, row.amount_cents),
    })
  }

  return rows.map(row => {
    const supplier = Array.isArray(row.marketplace_suppliers) ? row.marketplace_suppliers[0] : row.marketplace_suppliers
    const request = Array.isArray(row.marketplace_requests) ? row.marketplace_requests[0] : row.marketplace_requests
    const bound = bounds.get(row.request_id)!
    return {
      ...row,
      supplier: supplier ?? null,
      request_title: request?.title ?? null,
      match_score: matchScore({
        amountCents: row.amount_cents,
        cheapestCents: bound.min,
        dearestCents: bound.max,
        capability: row.capability_score,
        availability: row.availability_score,
        rating: supplier?.rating ?? null,
      }),
    } as MarketplaceProposal
  })
}

// ── Orders, escrow, milestones and disputes ──────────────────────────────────

export interface OrderSearchResult {
  rows: MarketplaceOrder[]
  total: number
}

export async function getOrders(session: MarketplaceSession, query: MarketplaceQuery, limit?: number): Promise<OrderSearchResult> {
  let builder = session.supabase
    .from('marketplace_orders')
    .select(`id, reference, title, category, supplier_id, amount_cents, currency, status,
             escrow_status, delivery_status, current_milestone, due_date, dispute_state,
             released_cents, refunded_cents, created_at, updated_at,
             marketplace_suppliers(${PROFILE_COLUMNS})`, { count: 'exact' })
    .eq('workspace_id', session.ctx.workspaceId)

  const term = safeTerm(query.q)
  if (term) builder = builder.or(`reference.ilike.%${term}%,title.ilike.%${term}%,category.ilike.%${term}%`)
  if (query.status) builder = builder.eq('status', query.status)
  if (query.escrow) builder = builder.eq('escrow_status', query.escrow)
  if (query.delivery) builder = builder.eq('delivery_status', query.delivery)
  if (query.supplier) builder = builder.eq('supplier_id', query.supplier)
  if (query.category) builder = builder.ilike('category', `%${safeTerm(query.category)}%`)
  if (query.from) builder = builder.gte('created_at', query.from)
  if (query.to) builder = builder.lte('created_at', `${query.to}T23:59:59`)

  switch (query.sort) {
    case 'price_low': builder = builder.order('amount_cents', { ascending: true }); break
    case 'price_high': builder = builder.order('amount_cents', { ascending: false }); break
    default: builder = builder.order('created_at', { ascending: false })
  }

  const size = limit ?? query.size
  const from = limit ? 0 : (query.page - 1) * size
  builder = builder.range(from, from + size - 1)

  const { data, count } = await builder
  type Row = Omit<MarketplaceOrder, 'supplier'> & { marketplace_suppliers: MarketplaceProfile | MarketplaceProfile[] | null }
  const rows = ((data ?? []) as unknown as Row[]).map(row => {
    const supplier = Array.isArray(row.marketplace_suppliers) ? row.marketplace_suppliers[0] : row.marketplace_suppliers
    return { ...row, supplier: supplier ?? null } as MarketplaceOrder
  })
  return { rows, total: count ?? 0 }
}

export interface OrderInsights {
  kpis: { active: number; inEscrowCents: number; pendingDelivery: number; pendingReview: number; completed: number; disputes: number }
  summary: { totalValueCents: number; avgValueCents: number; ordersThisMonth: number; repeatOrders: number; repeatPct: number; onTimePct: number; responseMinutes: number }
  escrow: { fundsCents: number; pendingReleaseCents: number; holdCents: number; autoReleaseCents: number; releasedCents: number }
  tracker: { key: string; label: string; count: number; pct: number }[]
  totalOrders: number
}

export async function getOrderInsights(session: MarketplaceSession): Promise<OrderInsights> {
  const { data } = await session.supabase
    .from('marketplace_orders')
    .select('id, supplier_id, amount_cents, released_cents, status, escrow_status, delivery_status, due_date, created_at')
    .eq('workspace_id', session.ctx.workspaceId)

  type Row = {
    id: string; supplier_id: string; amount_cents: number; released_cents: number
    status: string; escrow_status: string; delivery_status: string; due_date: string | null; created_at: string
  }
  const rows = (data ?? []) as Row[]
  const total = rows.length
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

  const overdue = rows.filter(row => row.due_date && row.due_date < today && row.delivery_status !== 'delivered').length
  const bySupplier = new Map<string, number>()
  for (const row of rows) bySupplier.set(row.supplier_id, (bySupplier.get(row.supplier_id) ?? 0) + 1)
  const repeatOrders = [...bySupplier.values()].filter(count => count > 1).reduce((sum, count) => sum + count, 0)

  const inEscrow = rows.filter(row => row.escrow_status === 'in_escrow' || row.escrow_status === 'funded')
  const onHold = rows.filter(row => row.escrow_status === 'on_hold')
  const pendingReview = rows.filter(row => row.delivery_status === 'pending_review')
  const delivered = rows.filter(row => row.delivery_status === 'delivered')
  const totalValue = rows.reduce((sum, row) => sum + row.amount_cents, 0)

  const counts = {
    in_progress: rows.filter(row => row.delivery_status === 'in_progress').length,
    pending_delivery: rows.filter(row => row.delivery_status === 'pending_delivery').length,
    pending_review: pendingReview.length,
    delivered: delivered.length,
    overdue,
  }
  const tracker = [
    { key: 'in_progress', label: 'In progress', count: counts.in_progress },
    { key: 'pending_delivery', label: 'Pending delivery', count: counts.pending_delivery },
    { key: 'pending_review', label: 'Pending review', count: counts.pending_review },
    { key: 'delivered', label: 'Delivered', count: counts.delivered },
    { key: 'overdue', label: 'Overdue', count: counts.overdue },
  ].map(entry => ({ ...entry, pct: total ? Number(((entry.count / total) * 100).toFixed(1)) : 0 }))

  const { count: disputeCount } = await session.supabase
    .from('marketplace_disputes')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', session.ctx.workspaceId)
    .not('stage', 'in', '(resolved,rejected)')

  const supplierIds = [...bySupplier.keys()]
  let responseMinutes = 0
  if (supplierIds.length) {
    const { data: suppliers } = await session.supabase
      .from('marketplace_suppliers')
      .select('response_time_minutes, on_time_delivery_pct')
      .in('id', supplierIds)
    const list = (suppliers ?? []) as { response_time_minutes: number | null; on_time_delivery_pct: number | null }[]
    const withResponse = list.filter(row => row.response_time_minutes)
    responseMinutes = withResponse.length
      ? Math.round(withResponse.reduce((sum, row) => sum + (row.response_time_minutes ?? 0), 0) / withResponse.length)
      : 0
  }

  const onTime = rows.filter(row => row.delivery_status === 'delivered' && (!row.due_date || row.due_date >= today)).length

  return {
    totalOrders: total,
    tracker,
    kpis: {
      active: rows.filter(row => !['completed', 'cancelled', 'refunded'].includes(row.status)).length,
      inEscrowCents: inEscrow.reduce((sum, row) => sum + row.amount_cents, 0),
      pendingDelivery: counts.pending_delivery,
      pendingReview: counts.pending_review,
      completed: rows.filter(row => row.status === 'completed').length,
      disputes: disputeCount ?? 0,
    },
    summary: {
      totalValueCents: totalValue,
      avgValueCents: total ? Math.round(totalValue / total) : 0,
      ordersThisMonth: rows.filter(row => new Date(row.created_at) >= monthStart).length,
      repeatOrders,
      repeatPct: total ? Number(((repeatOrders / total) * 100).toFixed(1)) : 0,
      onTimePct: delivered.length ? Number(((onTime / delivered.length) * 100).toFixed(1)) : 0,
      responseMinutes,
    },
    escrow: {
      fundsCents: inEscrow.reduce((sum, row) => sum + row.amount_cents, 0),
      pendingReleaseCents: pendingReview.reduce((sum, row) => sum + row.amount_cents, 0),
      holdCents: onHold.reduce((sum, row) => sum + row.amount_cents, 0),
      autoReleaseCents: delivered
        .filter(row => row.escrow_status === 'in_escrow')
        .reduce((sum, row) => sum + row.amount_cents, 0),
      releasedCents: rows.reduce((sum, row) => sum + (row.released_cents ?? 0), 0),
    },
  }
}

export async function getMilestones(session: MarketplaceSession, orderIds: string[]): Promise<OrderMilestone[]> {
  if (!orderIds.length) return []
  const { data } = await session.supabase
    .from('marketplace_order_milestones')
    .select('id, order_id, position, title, amount_cents, due_date, status')
    .in('order_id', orderIds)
    .order('position')
  return (data ?? []) as unknown as OrderMilestone[]
}

export async function getDisputes(session: MarketplaceSession, limit = 10): Promise<MarketplaceDispute[]> {
  const { data } = await session.supabase
    .from('marketplace_disputes')
    .select(`id, order_id, stage, reason, severity, amount_cents, requested_resolution, created_at,
             marketplace_orders(reference, supplier_id, marketplace_suppliers(display_name))`)
    .eq('workspace_id', session.ctx.workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit)

  type Row = Omit<MarketplaceDispute, 'order' | 'supplier_name'> & {
    marketplace_orders: {
      reference: string; supplier_id: string
      marketplace_suppliers: { display_name: string } | { display_name: string }[] | null
    } | null
  }
  return ((data ?? []) as unknown as Row[]).map(row => {
    const order = row.marketplace_orders
    const supplier = Array.isArray(order?.marketplace_suppliers) ? order?.marketplace_suppliers[0] : order?.marketplace_suppliers
    return {
      ...row,
      order: order ? { reference: order.reference, supplier_id: order.supplier_id } : null,
      supplier_name: supplier?.display_name ?? null,
    } as MarketplaceDispute
  })
}

// ── Activity ─────────────────────────────────────────────────────────────────

export async function getActivity(session: MarketplaceSession, limit = 8): Promise<ActivityEntry[]> {
  const { data } = await session.supabase
    .from('marketplace_activity')
    .select('id, event, summary, entity_type, entity_id, href, created_at')
    .eq('workspace_id', session.ctx.workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as unknown as ActivityEntry[]
}

// ── Overview composite ───────────────────────────────────────────────────────

export interface OverviewKpis {
  activeSuppliers: number
  openRequests: number
  ordersInProgress: number
  escrowValueCents: number
  savedPartners: number
  disputes: number
}

export async function getOverviewKpis(session: MarketplaceSession, insights: OrderInsights): Promise<OverviewKpis> {
  const [{ count: suppliers }, { count: openRequests }, { count: saved }] = await Promise.all([
    session.supabase.from('marketplace_suppliers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    session.supabase.from('marketplace_requests').select('id', { count: 'exact', head: true })
      .eq('workspace_id', session.ctx.workspaceId).in('status', ['open', 'awaiting_proposals', 'shortlisted']),
    session.supabase.from('marketplace_saved_items').select('id', { count: 'exact', head: true })
      .eq('workspace_id', session.ctx.workspaceId).eq('user_id', session.userId),
  ])

  return {
    activeSuppliers: suppliers ?? 0,
    openRequests: openRequests ?? 0,
    ordersInProgress: insights.kpis.active,
    escrowValueCents: insights.escrow.fundsCents,
    savedPartners: saved ?? 0,
    disputes: insights.kpis.disputes,
  }
}
