'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updatePayoutStatus, processPayoutViaStripe } from '@/app/app/partnerships/actions'
import { useToast } from '@/components/campaigns/Toast'

const NEXT_STATUS: Record<string, { label: string; status: string; danger?: boolean }[]> = {
  draft: [{ label: 'Submit for review', status: 'pending_review' }],
  pending_review: [{ label: 'Approve', status: 'approved' }, { label: 'Hold', status: 'on_hold', danger: true }],
  approved: [{ label: 'Mark paid manually', status: 'paid' }],
  processing: [{ label: 'Mark paid', status: 'paid' }, { label: 'Mark failed', status: 'failed', danger: true }],
  on_hold: [{ label: 'Resume review', status: 'pending_review' }],
  failed: [{ label: 'Reset to approved', status: 'approved' }],
}

export default function PayoutActions({
  payoutId, status, canApprove, canProcess, stripeEligible,
}: {
  payoutId: string; status: string; canApprove: boolean; canProcess: boolean
  /** Partner has a verified, payouts-enabled Stripe Connect account. */
  stripeEligible?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const { notify } = useToast()

  const actions = (NEXT_STATUS[status] ?? []).filter(a =>
    a.status === 'approved' ? canApprove : ['processing', 'paid', 'failed'].includes(a.status) ? canProcess : canApprove || canProcess)

  const showStripePay = status === 'approved' && canProcess

  if (actions.length === 0 && !showStripePay) return <span className="text-[11px] text-slate-400">No action</span>

  function set(next: string) {
    startTransition(async () => {
      const result = await updatePayoutStatus(payoutId, next)
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Payout updated.') : (result.error ?? 'Update failed.'))
      if (result.ok) router.refresh()
    })
  }

  function payViaStripe() {
    startTransition(async () => {
      const result = await processPayoutViaStripe(payoutId)
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Paid via Stripe.') : (result.error ?? 'Stripe payout failed.'))
      if (result.ok) router.refresh()
    })
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {showStripePay && (
        <button
          type="button" onClick={payViaStripe} disabled={pending || !stripeEligible}
          title={stripeEligible ? 'Send a real Stripe transfer to this partner' : 'Partner has not completed Stripe Connect verification'}
          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {pending ? 'Paying…' : 'Pay via Stripe'}
        </button>
      )}
      {actions.map(action => (
        <button
          key={action.status} type="button" onClick={() => set(action.status)} disabled={pending}
          className={`rounded-lg px-2.5 py-1 text-[12px] font-medium disabled:opacity-50 ${
            action.danger ? 'border border-red-200 text-red-600 hover:bg-red-50' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
