'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/campaigns/Toast'
import { approvePendingBatches, recordPayoutOutcome, retryPayout, updatePaymentStatus } from '@/lib/creators/actions'
import { PAYMENT_STATUS_LABELS, PAYMENT_TRANSITIONS, type PaymentStatus } from '@/lib/creators/constants'
import { BUTTON_SECONDARY } from './design'

type Result = { ok: boolean; error?: string; message?: string }

/**
 * Row menu for one payment. Status moves follow PAYMENT_TRANSITIONS (enforced
 * again by the server action and a database trigger). Payout outcomes are
 * recorded with the bank/provider reference so every attempt is auditable.
 */
export function PaymentRowMenu({
  id, status, href, canApprove, canProcess,
}: { id: string; status: string; href: string; canApprove: boolean; canProcess: boolean }) {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<null | 'paid' | 'failed'>(null)
  const [value, setValue] = useState('')
  const [pending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => { setOpen(false); setMode(null); setValue('') }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, close])

  function run(action: () => Promise<Result>) {
    close()
    startTransition(async () => {
      const result = await action()
      notify(result.ok ? 'success' : 'error', result.ok ? result.message ?? 'Updated.' : result.error ?? 'Something went wrong.')
      router.refresh()
    })
  }

  const moves = canApprove
    ? (PAYMENT_TRANSITIONS[status as PaymentStatus] ?? []).filter(s => s !== status && !['processing', 'paid', 'failed', 'partially_paid', 'refunded'].includes(s))
    : []
  const settleable = canProcess && ['scheduled', 'processing'].includes(status)

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button type="button" aria-label="Payment actions" aria-expanded={open} disabled={pending} onClick={() => setOpen(v => !v)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#667085] hover:bg-slate-100 disabled:opacity-50">
        {pending ? <Loader2 size={13} className="animate-spin" /> : <MoreVertical size={14} />}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1 text-[12.5px] shadow-lg">
          <Link role="menuitem" href={href} onClick={close} className="block rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-slate-50">Open payment</Link>
          {settleable && !mode && (
            <>
              <button type="button" role="menuitem" onClick={() => setMode('paid')} className="block w-full rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-50">Record payout as paid…</button>
              <button type="button" role="menuitem" onClick={() => setMode('failed')} className="block w-full rounded-lg px-2.5 py-1.5 text-left text-red-600 hover:bg-slate-50">Record payout failure…</button>
            </>
          )}
          {mode && (
            <form className="space-y-2 px-2.5 py-2" onSubmit={e => {
              e.preventDefault()
              if (!value.trim()) return
              run(() => recordPayoutOutcome(mode === 'paid'
                ? { paymentId: id, outcome: 'paid', providerReference: value }
                : { paymentId: id, outcome: 'failed', failureReason: value }))
            }}>
              <label className="block text-[11px] font-medium text-slate-500">
                {mode === 'paid' ? 'Bank / provider payout reference' : 'Why did the payout fail?'}
                <input autoFocus required maxLength={mode === 'paid' ? 120 : 500} value={value} onChange={e => setValue(e.target.value)}
                  className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-[12px]" />
              </label>
              <button type="submit" className={`w-full rounded-md py-1 text-[12px] font-medium text-white ${mode === 'paid' ? 'bg-blue-600' : 'bg-red-600'}`}>
                {mode === 'paid' ? 'Mark paid' : 'Mark failed'}
              </button>
            </form>
          )}
          {canProcess && status === 'failed' && (
            <button type="button" role="menuitem" onClick={() => run(() => retryPayout(id))} className="block w-full rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-50">Retry payout</button>
          )}
          {moves.length > 0 && <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Change status</p>}
          {moves.map(next => (
            <button key={next} type="button" role="menuitem"
              onClick={() => { if (next === 'cancelled' && !window.confirm('Cancel this payment? This cannot be undone.')) return; run(() => updatePaymentStatus(id, next)) }}
              className={`block w-full rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-50 ${next === 'cancelled' ? 'text-red-600' : 'text-slate-700'}`}>
              Move to {PAYMENT_STATUS_LABELS[next]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Header "Approve Payouts": confirms, then approves every batch pending approval. */
export function ApprovePayoutsButton({ pendingBatches, pendingTotal }: { pendingBatches: number; pendingTotal: string }) {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function approve() {
    if (pending) return
    startTransition(async () => {
      const result = await approvePendingBatches()
      notify(result.ok ? 'success' : 'error', result.ok ? result.message ?? 'Payouts approved.' : result.error ?? 'Could not approve payouts.')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <button type="button" className={BUTTON_SECONDARY} onClick={() => setOpen(true)} disabled={pendingBatches === 0}
        title={pendingBatches === 0 ? 'No payout batches are waiting for approval.' : undefined}>
        <CheckCircle2 size={16} aria-hidden />Approve Payouts
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Approve payout batches"
        description={`Approve ${pendingBatches} batch${pendingBatches === 1 ? '' : 'es'} totalling ${pendingTotal}. Approved batches are scheduled for payout; outcomes are recorded per payment.`}
        footer={<div className="flex w-full justify-end gap-2"><Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button><Button size="sm" loading={pending} onClick={approve}>Approve {pendingBatches}</Button></div>}>
        <p className="text-[13px] text-slate-500">Caption Fox never moves money from the browser. Payments are made through your own bank or payout provider, then recorded here with their reference.</p>
      </Modal>
    </>
  )
}
