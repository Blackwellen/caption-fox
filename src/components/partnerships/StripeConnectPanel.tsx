'use client'

import { useEffect, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CreditCard, RefreshCcw, ShieldCheck } from 'lucide-react'
import { startPartnerStripeOnboarding, refreshPartnerStripeStatus } from '@/app/app/partnerships/actions'
import { useToast } from '@/components/campaigns/Toast'
import { Badge } from '@/components/ui/Badge'
import type { BadgeVariant } from '@/components/ui/Badge'

const STATUS_LABEL: Record<string, string> = {
  not_connected: 'Not connected', pending: 'Verification pending',
  verified: 'Verified — ready for payouts', restricted: 'Restricted', rejected: 'Rejected',
}
const STATUS_BADGE: Record<string, BadgeVariant> = {
  not_connected: 'slate', pending: 'amber', verified: 'green', restricted: 'red', rejected: 'red',
}

export default function StripeConnectPanel({
  partnerId, status, canManage,
}: { partnerId: string; status: string; canManage: boolean }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { notify } = useToast()

  // Returning from Stripe-hosted onboarding — sync the real status immediately.
  useEffect(() => {
    const stripeParam = searchParams.get('stripe')
    if (stripeParam === 'return' || stripeParam === 'refresh') {
      startTransition(async () => {
        const result = await refreshPartnerStripeStatus(partnerId)
        notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Status synced.') : (result.error ?? 'Could not sync status.'))
        router.replace(`/app/partnerships/partners/${partnerId}`)
        router.refresh()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function connect() {
    startTransition(async () => {
      const result = await startPartnerStripeOnboarding(partnerId)
      if (!result.ok || !result.url) { notify('error', result.error ?? 'Could not start Stripe onboarding.'); return }
      window.location.href = result.url
    })
  }

  function refresh() {
    startTransition(async () => {
      const result = await refreshPartnerStripeStatus(partnerId)
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Status synced.') : (result.error ?? 'Could not sync status.'))
      if (result.ok) router.refresh()
    })
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_0_rgb(15_23_42/0.04)]">
      <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-slate-900">
        <CreditCard size={14} className="text-blue-500" />
        Stripe Connect payouts
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_BADGE[status] ?? 'slate'}>{STATUS_LABEL[status] ?? status}</Badge>
        {status === 'verified' && <ShieldCheck size={14} className="text-emerald-600" />}
      </div>
      <p className="mt-2 text-[12px] text-slate-500">
        {status === 'verified'
          ? 'This partner can receive real Stripe transfers for approved payouts.'
          : status === 'pending'
            ? 'Onboarding started but not yet complete — Stripe still needs identity/bank details.'
            : status === 'restricted' || status === 'rejected'
              ? 'Stripe has restricted this account. Ask the partner to check their Stripe dashboard.'
              : 'Connect this partner\'s Stripe account to pay them directly for approved payouts.'}
      </p>
      {canManage && (
        <div className="mt-3 flex items-center gap-2">
          {status === 'not_connected' || status === 'restricted' || status === 'rejected' ? (
            <button
              type="button" onClick={connect} disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? 'Opening Stripe…' : 'Connect Stripe account'}
            </button>
          ) : status === 'pending' ? (
            <button
              type="button" onClick={connect} disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? 'Opening Stripe…' : 'Continue setup'}
            </button>
          ) : null}
          <button
            type="button" onClick={refresh} disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCcw size={13} />
            Refresh status
          </button>
        </div>
      )}
    </section>
  )
}
