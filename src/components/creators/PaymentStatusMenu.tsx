'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { useToast } from '@/components/campaigns/Toast'
import { updatePaymentStatus } from '@/app/app/creators/actions'
import { cn } from '@/lib/utils'
import {
  PAYMENT_LOCKED_STATUSES, PAYMENT_STATUS_BADGE, PAYMENT_STATUS_LABELS,
  PAYMENT_TRANSITIONS, type PaymentStatus,
} from '@/lib/creators/constants'
import { Badge } from '@/components/ui/Badge'

/**
 * Status changer for one payment. Only offers transitions the payment
 * lifecycle allows, and requires confirmation for moves into a terminal
 * (locked) state — paid, refunded or cancelled cannot be casually undone.
 */
export default function PaymentStatusMenu({
  id, current, compact,
}: { id: string; current: PaymentStatus; compact?: boolean }) {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const locked = PAYMENT_LOCKED_STATUSES.includes(current)
  const options = locked ? [] : (PAYMENT_TRANSITIONS[current] ?? []).filter(status => status !== current)

  function change(status: PaymentStatus) {
    setOpen(false)
    if (PAYMENT_LOCKED_STATUSES.includes(status) && !window.confirm(`Move this payment to "${PAYMENT_STATUS_LABELS[status]}"? This cannot be casually undone.`)) return
    startTransition(async () => {
      const result = await updatePaymentStatus(id, status)
      if (!result.ok) { notify('error', result.error ?? 'Could not update the payment status.'); return }
      notify('success', result.message ?? 'Payment status updated.')
      router.refresh()
    })
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button" onClick={() => setOpen(v => !v)} disabled={pending || options.length === 0}
        aria-expanded={open} aria-label="Change payment status"
        className={cn('inline-flex items-center gap-1 rounded-full disabled:opacity-60', compact ? '' : 'opacity-0 group-hover:opacity-100')}
      >
        <Badge variant={PAYMENT_STATUS_BADGE[current]}>{PAYMENT_STATUS_LABELS[current]}</Badge>
        {options.length > 0 && <ChevronDown size={12} className="text-slate-400" />}
      </button>
      {open && options.length > 0 && (
        <>
          <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
            {options.map(status => (
              <button
                key={status} type="button" onClick={() => change(status)}
                className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50"
              >
                Move to {PAYMENT_STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
