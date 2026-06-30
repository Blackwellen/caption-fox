import type { SupplierType } from './types'

// ── DB row shapes (marketplace_* tables) ──────────────────────────────
export interface SupplierRow {
  id: string
  user_id: string | null
  slug: string
  display_name: string
  type: SupplierType
  headline: string | null
  bio: string | null
  location: string | null
  avatar_url: string | null
  cover_url: string | null
  rating: number
  reviews_count: number
  verified: boolean
  status: 'active' | 'paused' | 'suspended'
  created_at: string
}

export type ListingKind = 'service' | 'product' | 'booking'

export interface ListingRow {
  id: string
  supplier_id: string
  kind: ListingKind
  title: string
  summary: string | null
  description: string | null
  category: string | null
  price_cents: number
  currency: string
  delivery_days: number | null
  images: string[]
  rating: number
  reviews_count: number
  status: 'active' | 'paused' | 'archived'
  created_at: string
}

export type OrderStatus =
  | 'pending' | 'escrow_held' | 'in_progress' | 'delivered'
  | 'completed' | 'disputed' | 'refunded' | 'cancelled'

export interface OrderRow {
  id: string
  listing_id: string
  supplier_id: string
  buyer_id: string
  amount_cents: number
  currency: string
  status: OrderStatus
  stripe_payment_intent: string | null
  scheduled_for: string | null
  created_at: string
}

export type DisputeStage = 'opened' | 'evidence' | 'mediation' | 'resolved' | 'refunded' | 'rejected'

export interface DisputeRow {
  id: string
  order_id: string
  raised_by: string | null
  stage: DisputeStage
  reason: string | null
  resolution: string | null
  created_at: string
}

// ── Labels + styling ──────────────────────────────────────────────────
export const LISTING_KINDS: { id: ListingKind; label: string; hint: string }[] = [
  { id: 'service', label: 'Service', hint: 'Delivered work (e.g. content, ads management)' },
  { id: 'product', label: 'Product', hint: 'A fixed deliverable or asset pack' },
  { id: 'booking', label: 'Booking', hint: 'A scheduled slot (e.g. influencer post, call)' },
]

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; cls: string }> = {
  pending:     { label: 'Pending',      cls: 'bg-slate-100 text-slate-600' },
  escrow_held: { label: 'Escrow held',  cls: 'bg-blue-50 text-blue-700' },
  in_progress: { label: 'In progress',  cls: 'bg-amber-50 text-amber-700' },
  delivered:   { label: 'Delivered',    cls: 'bg-violet-50 text-violet-700' },
  completed:   { label: 'Completed',    cls: 'bg-emerald-50 text-emerald-700' },
  disputed:    { label: 'Disputed',     cls: 'bg-red-50 text-red-700' },
  refunded:    { label: 'Refunded',     cls: 'bg-slate-100 text-slate-500' },
  cancelled:   { label: 'Cancelled',    cls: 'bg-slate-100 text-slate-500' },
}

export const DISPUTE_STAGE_META: Record<DisputeStage, { label: string; cls: string }> = {
  opened:    { label: 'Opened',     cls: 'bg-amber-50 text-amber-700' },
  evidence:  { label: 'Evidence',   cls: 'bg-blue-50 text-blue-700' },
  mediation: { label: 'Mediation',  cls: 'bg-violet-50 text-violet-700' },
  resolved:  { label: 'Resolved',   cls: 'bg-emerald-50 text-emerald-700' },
  refunded:  { label: 'Refunded',   cls: 'bg-slate-100 text-slate-500' },
  rejected:  { label: 'Rejected',   cls: 'bg-red-50 text-red-700' },
}

// Which next statuses a supplier may move an order to.
export function nextOrderActions(status: OrderStatus): { to: OrderStatus; label: string }[] {
  switch (status) {
    case 'escrow_held': return [{ to: 'in_progress', label: 'Start work' }]
    case 'in_progress': return [{ to: 'delivered', label: 'Mark delivered' }]
    case 'delivered':   return [{ to: 'completed', label: 'Mark complete' }]
    default: return []
  }
}

export function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'supplier'
  return `${base}-${Math.random().toString(36).slice(2, 6)}`
}

export function gbp(cents: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100)
}
