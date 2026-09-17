// Pure Creators & UGC business rules. No I/O: server actions, data loaders and
// the unit tests all call these, so the rule a page displays is the same rule
// the server enforces.

export interface PayoutCandidate {
  status: string
  approval_state: string
  invoice_status: string
  tax_status: string
  payment_method: string | null
  batch_id: string | null
  currency: string
}

/**
 * Why a payment cannot join a payout batch. An empty list means it can.
 * `creatorPaymentReady` comes from the creator relationship record.
 */
export function batchBlockers(payment: PayoutCandidate, creatorPaymentReady: boolean): string[] {
  const reasons: string[] = []
  if (payment.batch_id) reasons.push('Already in a payout batch')
  if (!['approved', 'scheduled', 'failed'].includes(payment.status)) reasons.push('Payment not approved')
  else if (payment.approval_state !== 'approved') reasons.push('Payment not approved')
  if (!creatorPaymentReady) reasons.push('Creator payout details incomplete')
  if (payment.invoice_status === 'required') reasons.push('Invoice not submitted')
  if (payment.invoice_status === 'flagged') reasons.push('Invoice flagged for review')
  if (payment.tax_status === 'missing') reasons.push('Tax information missing')
  if (!payment.payment_method) reasons.push('No payment method recorded')
  return reasons
}

/** Currencies are never silently converted: a batch must hold exactly one. */
export function batchCurrency(payments: { currency: string }[]): { ok: true; currency: string } | { ok: false; error: string } {
  const currencies = [...new Set(payments.map(p => (p.currency || 'GBP').toUpperCase()))]
  if (currencies.length === 0) return { ok: false, error: 'Select at least one payment.' }
  if (currencies.length > 1) {
    return { ok: false, error: `A batch can only contain one currency. Selected: ${currencies.join(', ')}. Create one batch per currency.` }
  }
  return { ok: true, currency: currencies[0] }
}

/** Batch status once its payments have settled. */
export function settledBatchStatus(itemStatuses: string[]): 'processing' | 'completed' | 'partially_completed' | 'failed' {
  if (itemStatuses.length === 0) return 'processing'
  const open = itemStatuses.some(s => ['scheduled', 'processing', 'approved'].includes(s))
  if (open) return 'processing'
  const paid = itemStatuses.filter(s => s === 'paid').length
  const failed = itemStatuses.filter(s => s === 'failed').length
  if (paid > 0 && failed === 0) return 'completed'
  if (paid === 0 && failed > 0) return 'failed'
  return paid > 0 ? 'partially_completed' : 'completed'
}

/** Whole seconds between review start (or submission) and the decision. */
export function reviewSecondsBetween(startIso: string | null | undefined, endIso: string): number | null {
  if (!startIso) return null
  const start = Date.parse(startIso)
  const end = Date.parse(endIso)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
  return Math.round((end - start) / 1000)
}

/**
 * CSV cell for exports. RFC 4180 quoting plus formula-injection protection: a
 * creator-supplied value beginning with = + - @ (or a tab/CR) is prefixed with
 * an apostrophe so spreadsheet apps treat it as text, not a formula.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let text = Array.isArray(value) ? value.join(' | ') : String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Percentage change label used by every KPI ("12.5% vs last 30 days"). */
export function deltaLabel(pct: number, suffix = 'vs last 30 days', unit = '%'): string {
  const rounded = Math.abs(pct) < 0.05 ? 0 : pct
  return `${Math.abs(rounded).toFixed(1)}${unit} ${suffix}`
}

/** Request-time clock, kept outside components so render stays pure. */
export function nowMs(): number {
  return Date.now()
}

/** Days until a date string (YYYY-MM-DD), UK end of day. */
export function daysLeft(date: string | null | undefined, now = Date.now()): number | null {
  if (!date) return null
  const target = Date.parse(`${date}T23:59:59Z`)
  if (!Number.isFinite(target)) return null
  const days = (target - now) / 86_400_000
  // Past dates floor (yesterday is -1, never -0 / "0 days left").
  return days < 0 ? Math.floor(days) : Math.ceil(days)
}
