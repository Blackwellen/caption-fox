import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getPartnershipSession } from '@/lib/partnerships/server'
import { listPayouts } from '@/lib/partnerships/data'
import { PAYOUT_STATUS_BADGE, PAYOUT_STATUS_LABELS } from '@/lib/partnerships/constants'
import { Badge } from '@/components/ui/Badge'
import { CARD, CARD_SHADOW, PARTNERSHIPS_PAGE, formatMoney, formatShortDate } from '@/components/partnerships/primitives'
import { PartnershipsEmpty } from '@/components/partnerships/states'
import PayoutActions from '@/components/partnerships/PayoutActions'

export const metadata = { title: 'Payouts · Partnerships · Caption Fox' }

export default async function PartnershipPayoutsPage() {
  const { supabase, ctx, capabilities } = await getPartnershipSession()
  const payouts = await listPayouts(supabase, ctx.workspaceId, { limit: 200 })

  return (
    <div className={PARTNERSHIPS_PAGE}>
      <header className="mb-4">
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-1 text-xs text-slate-400">
            <li><Link href="/app/partnerships" className="hover:text-slate-600">Partnerships</Link></li>
            <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
            <li aria-current="page" className="font-medium text-slate-700">Payouts</li>
          </ol>
        </nav>
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-slate-900">Partner payouts</h1>
        <p className="mt-0.5 text-sm text-slate-500">Review, approve and process payouts across every partnership programme.</p>
      </header>

      {!capabilities.viewPayouts ? (
        <PartnershipsEmpty title="No access" message="Your role does not include viewing payouts. Ask a workspace owner or admin for access." />
      ) : payouts.length === 0 ? (
        <PartnershipsEmpty title="No payouts yet" message="Payouts are created once commissions become payable for a billing period." />
      ) : (
        <div className={`${CARD} ${CARD_SHADOW} overflow-x-auto`}>
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <caption className="sr-only">Partner payouts</caption>
            <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Partner</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Period</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Gross</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Adjustments</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Net</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payouts.map(payout => (
                <tr key={payout.id}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{payout.partner?.name ?? '—'}</td>
                  <td className="px-3 py-2.5 text-slate-500">{formatShortDate(payout.period_start)} – {formatShortDate(payout.period_end)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-700">{formatMoney(payout.gross_amount, payout.currency)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-500">{formatMoney(payout.adjustments, payout.currency)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-900">{formatMoney(payout.net_amount, payout.currency)}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={PAYOUT_STATUS_BADGE[payout.status as keyof typeof PAYOUT_STATUS_BADGE] ?? 'slate'} className="text-[10px]">
                      {PAYOUT_STATUS_LABELS[payout.status as keyof typeof PAYOUT_STATUS_LABELS] ?? payout.status}
                    </Badge>
                    {payout.status === 'failed' && payout.provider_error && (
                      <p className="mt-0.5 max-w-[220px] truncate text-[10px] text-red-500" title={payout.provider_error}>{payout.provider_error}</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <PayoutActions
                      payoutId={payout.id} status={payout.status}
                      canApprove={capabilities.approvePayouts} canProcess={capabilities.processPayouts}
                      stripeEligible={payout.partner?.stripe_account_status === 'verified' && Boolean(payout.partner?.stripe_payouts_enabled)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
