'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, MoreHorizontal, Loader2, Download, X, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MarketplaceOrder } from '@/lib/marketplace/module'
import { ESCROW_META, DELIVERY_META, money } from '@/lib/marketplace/module'
import {
  approveDelivery, releaseEscrow, requestRevision, holdEscrow, openDispute,
} from '@/lib/marketplace/actions'

interface Caps {
  approveDelivery: boolean
  editOrder: boolean
  releaseEscrow: boolean
  createDispute: boolean
}

/**
 * Row actions for an order. Every option is permission-gated and reflects the
 * order's real state — options that cannot legally run are not offered, and the
 * server re-checks both anyway.
 */
export function OrderActions({ order, caps }: { order: MarketplaceOrder; caps: Caps }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<null | 'revision' | 'dispute' | 'hold'>(null)

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    start(async () => {
      const result = await fn()
      if (!result.ok) setError(result.error ?? 'Could not complete that action.')
      else { setOpen(false); router.refresh() }
    })
  }

  const canApprove = caps.approveDelivery
    && ['pending_review', 'pending_delivery', 'in_progress'].includes(order.delivery_status)
    && order.escrow_status !== 'on_hold'
  const canRelease = caps.releaseEscrow
    && order.delivery_status === 'delivered'
    && ['in_escrow', 'funded', 'partially_released'].includes(order.escrow_status)
  const canDispute = caps.createDispute
    && !order.dispute_state
    && !['released', 'refunded'].includes(order.escrow_status)

  const actions = [
    { label: 'Approve delivery', show: canApprove, run: () => run(() => approveDelivery(order.id)) },
    { label: 'Request revision', show: caps.editOrder && order.delivery_status !== 'delivered', run: () => setDialog('revision') },
    { label: 'Release escrow', show: canRelease, run: () => run(() => releaseEscrow(order.id)) },
    { label: 'Hold escrow', show: caps.releaseEscrow && order.escrow_status !== 'on_hold' && order.escrow_status !== 'released', run: () => setDialog('hold') },
    { label: 'Raise dispute', show: canDispute, danger: true, run: () => setDialog('dispute') },
  ].filter(action => action.show)

  return (
    <>
      <div className="relative flex items-center justify-end gap-1">
        <a
          href={`/app/marketplace/orders?q=${encodeURIComponent(order.reference)}`}
          aria-label={`View order ${order.reference}`}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <Eye size={15} />
        </a>
        {actions.length > 0 && (
          <button
            type="button" onClick={() => setOpen(value => !value)}
            aria-expanded={open} aria-haspopup="menu"
            aria-label={`Actions for order ${order.reference}`}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            {pending ? <Loader2 size={15} className="animate-spin" /> : <MoreHorizontal size={15} />}
          </button>
        )}
        {open && (
          <>
            <button type="button" className="fixed inset-0 z-10 cursor-default" aria-hidden="true" onClick={() => setOpen(false)} />
            <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {actions.map(action => (
                <button
                  key={action.label} type="button" role="menuitem" disabled={pending}
                  onClick={action.run}
                  className={cn('block w-full px-3 py-2 text-left text-xs hover:bg-slate-50',
                    action.danger ? 'text-red-600' : 'text-slate-700')}
                >
                  {action.label}
                </button>
              ))}
              {error && <p className="px-3 py-2 text-[11px] text-red-600">{error}</p>}
            </div>
          </>
        )}
      </div>

      {dialog && (
        <OrderDialog
          order={order} kind={dialog}
          onClose={() => { setDialog(null); setOpen(false) }}
          onDone={() => { setDialog(null); setOpen(false); router.refresh() }}
        />
      )}
    </>
  )
}

function OrderDialog({
  order, kind, onClose, onDone,
}: {
  order: MarketplaceOrder
  kind: 'revision' | 'dispute' | 'hold'
  onClose: () => void
  onDone: () => void
}) {
  const [note, setNote] = useState('')
  const [resolution, setResolution] = useState('')
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium')
  const [pending, start] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const titles = {
    revision: 'Request a revision',
    dispute: 'Raise a dispute',
    hold: 'Hold escrow funds',
  }

  function submit() {
    setErrors({}); setFormError(null)
    start(async () => {
      if (kind === 'revision') {
        const result = await requestRevision(order.id, note)
        if (result.ok) onDone(); else setFormError(result.error ?? 'Could not request a revision.')
      } else if (kind === 'hold') {
        if (note.trim().length < 5) { setErrors({ note: 'Give a short reason for the hold.' }); return }
        const result = await holdEscrow(order.id, note)
        if (result.ok) onDone(); else setFormError(result.error ?? 'Could not hold escrow.')
      } else {
        const result = await openDispute({
          orderId: order.id, reason: note, requestedResolution: resolution, severity,
        })
        if (result.ok) onDone()
        else if (result.fieldErrors) setErrors(result.fieldErrors)
        else setFormError(result.error ?? 'Could not open a dispute.')
      }
    })
  }

  const field = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={titles[kind]}>
      <div className="w-full max-w-lg rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{titles[kind]}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {order.reference} · {order.supplier?.display_name} · {money(order.amount_cents, order.currency)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </header>

        <div className="space-y-4 p-5">
          {kind === 'dispute' && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              <ShieldAlert size={15} className="mt-0.5 shrink-0" />
              Opening a dispute freezes the remaining escrow balance on this order until it is resolved.
            </div>
          )}

          <div>
            <label htmlFor="order-note" className="mb-1.5 block text-xs font-semibold text-slate-700">
              {kind === 'dispute' ? 'What went wrong?' : kind === 'hold' ? 'Reason for the hold' : 'What needs revising?'}
            </label>
            <textarea
              id="order-note" rows={4} value={note} maxLength={2000}
              onChange={event => setNote(event.target.value)}
              aria-invalid={Boolean(errors.reason || errors.note)}
              className={field}
              placeholder={kind === 'dispute' ? 'Describe the issue and reference the agreed scope…' : 'Be specific so the supplier can act quickly…'}
            />
            {(errors.reason || errors.note) && <p className="mt-1 text-xs text-red-600">{errors.reason ?? errors.note}</p>}
          </div>

          {kind === 'dispute' && (
            <>
              <div>
                <label htmlFor="order-resolution" className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Resolution you are asking for
                </label>
                <input
                  id="order-resolution" value={resolution} maxLength={500}
                  onChange={event => setResolution(event.target.value)}
                  aria-invalid={Boolean(errors.requestedResolution)}
                  className={field}
                  placeholder="e.g. One revision round and a 20% partial refund"
                />
                {errors.requestedResolution && <p className="mt-1 text-xs text-red-600">{errors.requestedResolution}</p>}
              </div>
              <div>
                <label htmlFor="order-severity" className="mb-1.5 block text-xs font-semibold text-slate-700">Severity</label>
                <select
                  id="order-severity" value={severity}
                  onChange={event => setSeverity(event.target.value as 'low' | 'medium' | 'high')}
                  className={field}
                >
                  <option value="low">Low — minor issue</option>
                  <option value="medium">Medium — needs attention</option>
                  <option value="high">High — blocks the project</option>
                </select>
              </div>
            </>
          )}

          {formError && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{formError}</p>}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-200 p-5">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
            Cancel
          </button>
          <button
            type="button" onClick={submit} disabled={pending}
            className={cn('inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60',
              kind === 'dispute' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700')}
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            {kind === 'dispute' ? 'Open dispute' : kind === 'hold' ? 'Hold funds' : 'Request revision'}
          </button>
        </footer>
      </div>
    </div>
  )
}

/** CSV export of the orders currently shown, honouring filters and sorting. */
export function ExportOrders({ rows, canExport }: { rows: MarketplaceOrder[]; canExport: boolean }) {
  function onExport() {
    if (!canExport) return
    const header = ['Order ID', 'Supplier', 'Category', 'Amount', 'Currency', 'Escrow status', 'Delivery status', 'Milestone', 'Due date', 'Dispute state', 'Created']
    const lines = rows.map(row => [
      row.reference, row.supplier?.display_name ?? '', row.category ?? '',
      (row.amount_cents / 100).toFixed(2), row.currency,
      ESCROW_META[row.escrow_status].label, DELIVERY_META[row.delivery_status].label,
      row.current_milestone ?? '', row.due_date ?? '', row.dispute_state ?? '', row.created_at,
    ])
    const csv = [header, ...lines]
      .map(cells => cells.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `marketplace-orders-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button" onClick={onExport} disabled={!canExport || rows.length === 0}
      title={canExport ? 'Export the current view to CSV' : 'Your role cannot export marketplace data'}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download size={13} />Export
    </button>
  )
}
