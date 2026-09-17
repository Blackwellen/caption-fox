import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { requireCreatorModule } from '@/lib/creators/server'
import { getPayment, payoutAttempts, recentActivity } from '@/lib/creators/data'
import {
  INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_BADGE, PAYMENT_STATUS_LABELS,
  TAX_STATUS_LABELS, type PaymentStatus,
} from '@/lib/creators/constants'
import { PaymentRowMenu } from '@/components/creators/PaymentControls'
import ActivityFeed from '@/components/creators/ActivityFeed'
import {
  CARD, CARD_SHADOW, CREATORS_PAGE, CreatorChip, Panel,
  formatDateTime, formatMoney, formatShortDate,
} from '@/components/creators/primitives'
import { Badge } from '@/components/ui/Badge'
import { AccessBlocked, PanelEmpty } from '@/components/creators/states'

export const dynamic = 'force-dynamic'

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, ctx, capabilities, access, basePath } = await requireCreatorModule('payments')

  if (!access.allowed) return <div className={CREATORS_PAGE}><AccessBlocked access={access} /></div>
  if (!capabilities.viewPayments) {
    return (
      <div className={CREATORS_PAGE}>
        <AccessBlocked access={{ allowed: false, reason: 'permission', upgrade: false, message: 'Viewing creator payments requires billing access.' }} />
      </div>
    )
  }

  const payment = await getPayment(supabase, ctx.workspaceId, id)
  if (!payment) notFound()

  const [attempts, activity] = await Promise.all([
    payoutAttempts(supabase, ctx.workspaceId, id),
    recentActivity(supabase, ctx.workspaceId, 10, { entityId: id }),
  ])

  return (
    <div className={CREATORS_PAGE}>
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-[11px] text-slate-400">
        <Link href={basePath} className="hover:text-slate-700">Creators and UGC</Link>
        <ChevronRight size={11} aria-hidden />
        <Link href={`${basePath}/payments`} className="hover:text-slate-700">Payments</Link>
        <ChevronRight size={11} aria-hidden />
        <span className="font-medium text-slate-600">{payment.invoice_number ?? `Payment #${payment.id.slice(0, 6)}`}</span>
      </nav>

      <div className={`${CARD} ${CARD_SHADOW} mb-4 p-5`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{formatMoney(payment.amount, payment.currency)}</h1>
              <Badge variant={PAYMENT_STATUS_BADGE[payment.status as PaymentStatus]}>{PAYMENT_STATUS_LABELS[payment.status as PaymentStatus]}</Badge>
              {(capabilities.approvePayments || capabilities.processPayouts) && (
                <PaymentRowMenu id={payment.id} status={payment.status} href={`${basePath}/payments/${payment.id}`} canApprove={capabilities.approvePayments} canProcess={capabilities.processPayouts} />
              )}
            </div>
            <p className="mt-1 text-[13px] text-slate-500">
              {payment.brief ? <Link href={`${basePath}/briefs/${payment.brief.id}`} className="hover:text-blue-600">{payment.brief.title}</Link> : (payment.campaign?.name ?? 'No linked brief or campaign')}
            </p>
          </div>
          <CreatorChip creator={payment.creator} href={payment.creator ? `${basePath}/creators/${payment.creator.id}` : undefined} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-5">
          <Stat label="Method" value={payment.payment_method ? PAYMENT_METHOD_LABELS[payment.payment_method as keyof typeof PAYMENT_METHOD_LABELS] ?? payment.payment_method : '—'} />
          <Stat label="Submitted" value={formatShortDate(payment.submitted_date)} />
          <Stat label="Payout date" value={formatShortDate(payment.payout_date)} />
          <Stat label="Invoice" value={payment.invoice_number ?? '—'} />
          <Stat label="Approver" value={payment.approver ? (payment.approver.full_name ?? payment.approver.email ?? '—') : '—'} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Panel title="Invoice & Tax">
            <ul className="grid grid-cols-2 gap-3 text-[13px] text-slate-600 sm:grid-cols-4">
              <li>Invoice: <b>{INVOICE_STATUS_LABELS[payment.invoice_status as keyof typeof INVOICE_STATUS_LABELS] ?? payment.invoice_status}</b></li>
              <li>Tax: <b>{TAX_STATUS_LABELS[payment.tax_status as keyof typeof TAX_STATUS_LABELS] ?? payment.tax_status}</b></li>
              <li>Approval: <b className="capitalize">{payment.approval_state.replace(/_/g, ' ')}</b></li>
              {payment.invoice_flag && <li className="text-red-600">Flag: {payment.invoice_flag}</li>}
            </ul>
          </Panel>

          {payment.failure_reason && (
            <Panel title="Failure Reason">
              <p className="text-[13px] text-red-600">{payment.failure_reason}</p>
            </Panel>
          )}
          {payment.blocked_reason && (
            <Panel title="Blocked">
              <p className="text-[13px] text-amber-600">{payment.blocked_reason}</p>
            </Panel>
          )}

          <Panel title="Payout Attempts">
            {attempts.length === 0 ? <PanelEmpty message="No payout attempts recorded yet." /> : (
              <ul className="divide-y divide-slate-50">
                {attempts.map(attempt => (
                  <li key={attempt.id} className="flex items-center justify-between py-2.5 text-[13px]">
                    <span className="text-slate-700">Attempt #{attempt.attempt_no} · {attempt.provider ?? 'manual'}</span>
                    <div className="flex items-center gap-2">
                      {attempt.error_message && <span className="text-[11px] text-red-500">{attempt.error_message}</span>}
                      <Badge variant={attempt.status === 'succeeded' ? 'green' : attempt.status === 'failed' ? 'red' : 'blue'}>{attempt.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {payment.notes && (
            <Panel title="Notes"><p className="text-[13px] text-slate-600">{payment.notes}</p></Panel>
          )}
        </div>

        <aside className="space-y-4">
          <Panel title="History">
            <ul className="space-y-1.5 text-[12.5px] text-slate-500">
              <li>Created {formatDateTime(payment.created_at)}</li>
              <li>Last updated {formatDateTime(payment.updated_at)}</li>
              {payment.approved_at && <li>Approved {formatDateTime(payment.approved_at)}</li>}
            </ul>
          </Panel>
          <Panel title="Activity"><ActivityFeed basePath={basePath} items={activity} /></Panel>
        </aside>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="mt-0.5 text-[14px] font-semibold text-slate-900">{value}</p>
    </div>
  )
}
