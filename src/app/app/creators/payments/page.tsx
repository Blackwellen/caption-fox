import Link from 'next/link'
import { requireCreatorModule } from '@/lib/creators/server'
import {
  batchEligiblePayments, creatorPickerList, flaggedInvoices, listBriefs, listPayments,
  paymentAggregates, recentActivity, upcomingPayouts, workspaceCampaigns, workspaceMembers, delta,
} from '@/lib/creators/data'
import { parsePaymentsQuery, hasAnyFilter, type RawParams } from '@/lib/creators/query'
import {
  INVOICE_STATUS_LABELS, INVOICE_STATUSES, PAYMENT_METHOD_COLOUR, PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS, PAYMENT_STATUS_BADGE, PAYMENT_STATUS_COLOUR, PAYMENT_STATUS_LABELS,
  PAYMENT_STATUSES, TAX_STATUS_LABELS, TAX_STATUSES, type PaymentStatus,
} from '@/lib/creators/constants'
import CreatorsHeader from '@/components/creators/CreatorsHeader'
import KpiStrip from '@/components/creators/KpiStrip'
import FilterBar, { type FilterSpec } from '@/components/creators/FilterBar'
import Pagination from '@/components/creators/Pagination'
import ActivityFeed from '@/components/creators/ActivityFeed'
import { BarList, DonutChart, DonutLegend } from '@/components/creators/charts'
import { CreatePaymentButton, CreatePaymentBatchButton } from '@/components/creators/PaymentButtons'
import ExportButton, { HeaderOverflow } from '@/components/creators/ExportButton'
import PaymentStatusMenu from '@/components/creators/PaymentStatusMenu'
import { AccessBlocked, CreatorsEmpty, LoadError, PanelEmpty } from '@/components/creators/states'
import {
  CARD, CARD_SHADOW, CREATORS_PAGE, CreatorChip, Panel,
  formatCompactMoney, formatDays, formatMoney, formatShortDate,
} from '@/components/creators/primitives'
import { Badge } from '@/components/ui/Badge'
import type { KpiValue, StatusCount } from '@/lib/creators/types'

export const metadata = { title: 'Payments · Caption Fox' }

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireCreatorModule('payments')

  if (!access.allowed) {
    return (
      <div className={CREATORS_PAGE}>
        <CreatorsHeader module="payments" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }
  if (!capabilities.viewPayments) {
    return (
      <div className={CREATORS_PAGE}>
        <CreatorsHeader module="payments" modules={modules} />
        <AccessBlocked access={{ allowed: false, reason: 'permission', upgrade: false, message: 'Viewing creator payments requires billing access. Ask a workspace owner or admin for access.' }} />
      </div>
    )
  }

  const query = parsePaymentsQuery(params)

  const [aggregates, page, upcoming, flagged, eligible, activity, briefs, campaigns, members, creators] = await Promise.all([
    paymentAggregates(supabase, ctx.workspaceId),
    listPayments(supabase, ctx.workspaceId, query),
    upcomingPayouts(supabase, ctx.workspaceId, 14),
    flaggedInvoices(supabase, ctx.workspaceId, 5),
    capabilities.processPayouts ? batchEligiblePayments(supabase, ctx.workspaceId) : Promise.resolve([]),
    recentActivity(supabase, ctx.workspaceId, 6, { entityType: 'payment' }),
    listBriefs(supabase, ctx.workspaceId, {
      q: '', page: 1, size: 100, from: '', to: '', campaign: '', channel: '', owner: '', status: '',
      approval: '', creator: '', rights: '', due: '', budgetMin: null, budgetMax: null, archived: false, sort: 'recent', view: 'table',
    }, { all: true, limit: 200 }),
    workspaceCampaigns(supabase, ctx.workspaceId),
    workspaceMembers(supabase, ctx.workspaceId),
    creatorPickerList(supabase, ctx.workspaceId),
  ])

  const pendingDelta = delta(aggregates.pendingAmount, aggregates.previous.pendingAmount)
  const paidDelta = delta(aggregates.paidThisMonth, aggregates.previous.paidAmount)
  const reviewDelta = delta(aggregates.inReviewAmount, aggregates.previous.inReviewAmount)
  const payoutTimeDelta = aggregates.avgPayoutDays !== null && aggregates.previous.avgPayoutDays !== null
    ? delta(aggregates.avgPayoutDays, aggregates.previous.avgPayoutDays) : null
  const spendDelta = delta(aggregates.totalSpend, aggregates.previous.totalSpend)

  const kpis: KpiValue[] = [
    { id: 'pending', label: 'Pending Payments', value: formatCompactMoney(aggregates.pendingAmount, aggregates.currency), hint: `${pendingDelta.pct >= 0 ? '+' : ''}${pendingDelta.pct.toFixed(1)}% vs last 30 days`, trend: pendingDelta.trend, icon: 'money', tone: 'violet' },
    { id: 'paid', label: 'Paid This Month', value: formatCompactMoney(aggregates.paidThisMonth, aggregates.currency), hint: `${paidDelta.pct >= 0 ? '+' : ''}${paidDelta.pct.toFixed(1)}% vs last month`, trend: paidDelta.trend, icon: 'shieldCheck', tone: 'green' },
    { id: 'review', label: 'In Review', value: formatCompactMoney(aggregates.inReviewAmount, aggregates.currency), hint: `${reviewDelta.pct >= 0 ? '+' : ''}${reviewDelta.pct.toFixed(1)}% vs last 30 days`, trend: reviewDelta.trend, icon: 'gauge', tone: 'amber' },
    { id: 'payout-time', label: 'Avg. Payout Time', value: formatDays(aggregates.avgPayoutDays), hint: payoutTimeDelta ? `${payoutTimeDelta.pct >= 0 ? '+' : ''}${payoutTimeDelta.pct.toFixed(1)}% vs last 30 days` : undefined, trend: payoutTimeDelta ? (payoutTimeDelta.trend === 'up' ? 'down' : payoutTimeDelta.trend === 'down' ? 'up' : 'flat') : undefined, icon: 'clock', tone: 'blue' },
    { id: 'upcoming', label: 'Upcoming Payouts', value: formatCompactMoney(aggregates.upcomingAmount, aggregates.currency), hint: 'Next 7 days', icon: 'calendar', tone: 'blue' },
    { id: 'spend', label: 'Total Creator Spend', value: formatCompactMoney(aggregates.totalSpend, aggregates.currency), hint: `${spendDelta.pct >= 0 ? '+' : ''}${spendDelta.pct.toFixed(1)}% vs last 30 days`, trend: spendDelta.trend, icon: 'wallet', tone: 'slate' },
  ]

  const filters: FilterSpec[] = [
    { key: 'creator', label: 'Creator', allLabel: 'All Creators', options: creators.map(c => ({ value: c.id, label: c.name })) },
    { key: 'campaign', label: 'Campaign', allLabel: 'All Campaigns', options: campaigns.map(c => ({ value: c.id, label: c.name })) },
    { key: 'brief', label: 'Brief', allLabel: 'All Briefs', options: briefs.rows.map(b => ({ value: b.id, label: b.title })) },
    { key: 'status', label: 'Status', allLabel: 'All Statuses', options: PAYMENT_STATUSES.map(s => ({ value: s, label: PAYMENT_STATUS_LABELS[s] })) },
    { key: 'method', label: 'Method', allLabel: 'All Methods', options: PAYMENT_METHODS.map(m => ({ value: m, label: PAYMENT_METHOD_LABELS[m] })) },
    { key: 'approver', label: 'Approver', allLabel: 'All Approvers', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Unknown' })), advanced: true },
    { key: 'invoice', label: 'Invoice', allLabel: 'All', options: INVOICE_STATUSES.map(s => ({ value: s, label: INVOICE_STATUS_LABELS[s] })), advanced: true },
    { key: 'tax', label: 'Tax status', allLabel: 'All', options: TAX_STATUSES.map(s => ({ value: s, label: TAX_STATUS_LABELS[s] })), advanced: true },
  ]

  const filtered = hasAnyFilter(query)
  const statusSlices: StatusCount[] = PAYMENT_STATUSES
    .filter(status => aggregates.byStatus[status] > 0)
    .map(status => ({ key: status, label: PAYMENT_STATUS_LABELS[status], value: aggregates.byStatus[status], colour: PAYMENT_STATUS_COLOUR[status] }))
  const statusTotal = statusSlices.reduce((sum, slice) => sum + slice.value, 0)

  const methodSlices: StatusCount[] = aggregates.byMethod.map(entry => ({
    key: entry.method, label: PAYMENT_METHOD_LABELS[entry.method as keyof typeof PAYMENT_METHOD_LABELS] ?? entry.method,
    value: entry.count, colour: PAYMENT_METHOD_COLOUR[entry.method] ?? '#94a3b8',
  }))
  const methodTotal = methodSlices.reduce((sum, slice) => sum + slice.value, 0)

  const spendCampaigns = aggregates.byCampaign.slice(0, 6).map(entry => ({ key: entry.id ?? 'none', label: entry.name, value: entry.amount }))
  const spendTotal = aggregates.byCampaign.reduce((sum, entry) => sum + entry.amount, 0)

  return (
    <div className={CREATORS_PAGE}>
      <CreatorsHeader
        module="payments" modules={modules}
        actions={(
          <>
            {capabilities.processPayouts && <CreatePaymentBatchButton eligible={eligible} />}
            {capabilities.managePayments && <CreatePaymentButton creators={creators} />}
            <ExportButton entity="payments" allowed={capabilities.export} />
            <HeaderOverflow items={[{ label: 'Refresh data', onSelect: 'refresh' }]} />
          </>
        )}
      />

      <div className="space-y-4">
        <KpiStrip items={kpis} />

        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            <FilterBar
              searchPlaceholder="Search payments by invoice or reference…" filters={filters}
              views={['table', 'cards', 'timeline']} activeView={query.view} values={query}
            />

            {page.error ? (
              <LoadError message={page.error} />
            ) : page.rows.length === 0 ? (
              <CreatorsEmpty
                icon={filtered ? 'search' : 'creators'}
                title={filtered ? 'No payments match these filters' : 'No payments yet'}
                message={filtered ? 'Try widening your filters or clearing the search term.' : 'Payments will appear here once a creator has approved deliverables and is ready to be paid.'}
                action={!filtered && capabilities.managePayments ? <CreatePaymentButton creators={creators} /> : undefined}
              />
            ) : query.view === 'cards' ? (
              <PaymentCards rows={page.rows} canApprove={capabilities.approvePayments} />
            ) : query.view === 'timeline' ? (
              <PaymentTimeline rows={page.rows} />
            ) : (
              <PaymentTable rows={page.rows} canApprove={capabilities.approvePayments} />
            )}

            {page.rows.length > 0 && (
              <div className={`${CARD} ${CARD_SHADOW}`}>
                <Pagination page={query.page} size={query.size} total={page.total} label="payments" />
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <Panel title="Payment Status Mix" viewAllHref="/app/analytics">
              <div className="flex items-center gap-4">
                <DonutChart slices={statusSlices} total={statusTotal} caption="Total" size={140} thickness={18} />
                <DonutLegend slices={statusSlices} total={statusTotal} className="flex-1" />
              </div>
            </Panel>

            <Panel title="Upcoming Payouts" viewAllHref="/app/creators/payments?status=scheduled">
              {upcoming.length === 0 ? <PanelEmpty message="No payouts scheduled in the next two weeks." /> : (
                <>
                  <ul className="space-y-2">
                    {upcoming.slice(0, 5).map(item => (
                      <li key={item.date} className="flex items-center justify-between text-[12.5px]">
                        <span className="text-slate-600">{formatShortDate(item.date)} · {item.count} payment{item.count === 1 ? '' : 's'}</span>
                        <span className="font-semibold text-slate-900">{formatMoney(item.amount)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 border-t border-slate-100 pt-2.5 text-[12px] text-slate-500">
                    Total upcoming · <span className="font-semibold text-slate-800">{formatMoney(upcoming.reduce((sum, item) => sum + item.amount, 0))}</span>
                  </p>
                </>
              )}
            </Panel>

            <Panel title="Flagged Invoices" viewAllHref="/app/creators/payments?invoice=flagged">
              {flagged.length === 0 ? <PanelEmpty message="No invoices are flagged for review." /> : (
                <ul className="space-y-2.5">
                  {flagged.map(payment => (
                    <li key={payment.id}>
                      <Link href={`/app/creators/payments/${payment.id}`} className="flex items-center justify-between rounded-lg px-1 py-1 text-[12.5px] hover:bg-slate-50">
                        <span className="min-w-0 truncate text-red-700">{payment.invoice_number ?? `Payment #${payment.id.slice(0, 6)}`}</span>
                        <span className="shrink-0 text-slate-400">{formatMoney(payment.amount, payment.currency)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Payment Activity" viewAllHref="/app/creators">
              <ActivityFeed items={activity} />
            </Panel>

            <Panel title="Spend by Campaign" viewAllHref="/app/analytics">
              <BarList items={spendCampaigns} total={spendTotal} valueFormatter={value => formatMoney(value)} />
              <p className="mt-3 border-t border-slate-100 pt-2.5 text-[12px] text-slate-500">Total · <span className="font-semibold text-slate-800">{formatMoney(spendTotal)}</span></p>
            </Panel>

            <Panel title="Payment Method Usage" viewAllHref="/app/analytics">
              <div className="flex items-center gap-4">
                <DonutChart slices={methodSlices} total={methodTotal} caption="Total" size={130} thickness={16} />
                <DonutLegend slices={methodSlices} total={methodTotal} className="flex-1" />
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  )
}

function PaymentTable({ rows, canApprove }: { rows: Awaited<ReturnType<typeof listPayments>>['rows']; canApprove: boolean }) {
  return (
    <div className={`${CARD} ${CARD_SHADOW} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5 font-medium">Creator</th>
              <th className="px-3 py-2.5 font-medium">Brief / Campaign</th>
              <th className="px-3 py-2.5 font-medium">Amount</th>
              <th className="px-3 py-2.5 font-medium">Method</th>
              <th className="px-3 py-2.5 font-medium">Submitted</th>
              <th className="px-3 py-2.5 font-medium">Approval</th>
              <th className="px-3 py-2.5 font-medium">Payout Date</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(payment => (
              <tr key={payment.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5"><CreatorChip creator={payment.creator} size={24} href={`/app/creators/payments/${payment.id}`} /></td>
                <td className="px-3 py-2.5 text-slate-500">
                  {payment.brief ? <Link href={`/app/creators/briefs/${payment.brief.id}`} className="hover:text-blue-600">{payment.brief.title}</Link> : (payment.campaign?.name ?? '—')}
                </td>
                <td className="px-3 py-2.5 font-medium text-slate-900">{formatMoney(payment.amount, payment.currency)}</td>
                <td className="px-3 py-2.5 text-slate-600">{payment.payment_method ? PAYMENT_METHOD_LABELS[payment.payment_method as keyof typeof PAYMENT_METHOD_LABELS] ?? payment.payment_method : '—'}</td>
                <td className="px-3 py-2.5 text-slate-500">{formatShortDate(payment.submitted_date)}</td>
                <td className="px-3 py-2.5 text-slate-500">{payment.approver ? (payment.approver.full_name ?? payment.approver.email) : '—'}</td>
                <td className="px-3 py-2.5 text-slate-500">{formatShortDate(payment.payout_date)}</td>
                <td className="px-3 py-2.5"><Badge variant={PAYMENT_STATUS_BADGE[payment.status as PaymentStatus]}>{PAYMENT_STATUS_LABELS[payment.status as PaymentStatus]}</Badge></td>
                <td className="px-4 py-2.5 text-right">{canApprove && <PaymentStatusMenu id={payment.id} current={payment.status as PaymentStatus} compact />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PaymentCards({ rows, canApprove }: { rows: Awaited<ReturnType<typeof listPayments>>['rows']; canApprove: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(payment => (
        <div key={payment.id} className={`${CARD} ${CARD_SHADOW} flex flex-col gap-2.5 p-4`}>
          <div className="flex items-start justify-between gap-2">
            <CreatorChip creator={payment.creator} href={`/app/creators/payments/${payment.id}`} />
            <Badge variant={PAYMENT_STATUS_BADGE[payment.status as PaymentStatus]}>{PAYMENT_STATUS_LABELS[payment.status as PaymentStatus]}</Badge>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatMoney(payment.amount, payment.currency)}</p>
          <p className="text-[12px] text-slate-500">{payment.brief?.title ?? payment.campaign?.name ?? 'No linked brief'}</p>
          <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11.5px] text-slate-400">
            <span>Payout {formatShortDate(payment.payout_date)}</span>
            {canApprove && <PaymentStatusMenu id={payment.id} current={payment.status as PaymentStatus} compact />}
          </div>
        </div>
      ))}
    </div>
  )
}

function PaymentTimeline({ rows }: { rows: Awaited<ReturnType<typeof listPayments>>['rows'] }) {
  const withDates = rows.filter(row => row.payout_date).sort((a, b) => (a.payout_date ?? '').localeCompare(b.payout_date ?? ''))
  if (withDates.length === 0) return <CreatorsEmpty title="No dated payments" message="Payments need a payout date to appear on the timeline." />
  return (
    <div className={`${CARD} ${CARD_SHADOW} p-4`}>
      <ol className="space-y-4 border-l-2 border-slate-100 pl-4">
        {withDates.map(payment => (
          <li key={payment.id} className="relative">
            <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-slate-300 ring-4 ring-white" aria-hidden />
            <Link href={`/app/creators/payments/${payment.id}`} className="text-[13px] font-medium text-slate-800 hover:text-blue-600">{payment.creator?.name} — {formatMoney(payment.amount, payment.currency)}</Link>
            <p className="text-[11px] text-slate-400">{formatShortDate(payment.payout_date)} · {PAYMENT_STATUS_LABELS[payment.status as PaymentStatus]}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
