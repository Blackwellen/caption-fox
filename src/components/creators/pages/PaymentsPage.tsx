import Link from 'next/link'
import { AlertTriangle, CircleDollarSign, Flag, Landmark } from 'lucide-react'
import { requireCreatorModule } from '@/lib/creators/server'
import {
  batchEligiblePayments, creatorPickerList, flaggedInvoices, listPaymentBatches, listPayments, paymentAggregates,
  recentActivity, upcomingPayouts, workspaceCampaigns, workspaceMembers,
} from '@/lib/creators/data'
import { parsePaymentsQuery } from '@/lib/creators/query'
import {
  PAYMENT_METHOD_LABELS, PAYMENT_METHODS, PAYMENT_SORTS, PAYMENT_STATUS_LABELS, PAYMENT_STATUSES,
  type PaymentMethod, type PaymentStatus,
} from '@/lib/creators/constants'
import { deltaLabel } from '@/lib/creators/rules'
import { delta } from '@/lib/creators/data'
import type { PaymentRow } from '@/lib/creators/types'
import { cn } from '@/lib/utils'
import { CreatePaymentBatchButton, CreatePaymentButton } from '../PaymentButtons'
import { ApprovePayoutsButton, PaymentRowMenu } from '../PaymentControls'
import {
  DateRangeControl, ExportMenu, Pager, SearchBox, SelectControl, SettingsMenu, ViewToggle,
} from '../controls'
import {
  Avatar, CARD, Donut, Kpi, KpiGrid, Legend, LineChart, Panel, PanelEmpty, Person, Pill, TD, TH, type Slice, type Tone,
} from '../design'
import { formatAgo } from '../primitives'
import { CreatorsFrame, kpiDelta, link, type RawSearchParams } from './shared'

const STATUS_TONE: Record<string, Tone> = {
  draft: 'slate', invoice_required: 'amber', invoice_submitted: 'blue', in_review: 'orange', pending_approval: 'violet',
  approved: 'green', scheduled: 'blue', processing: 'sky', paid: 'green', failed: 'red', on_hold: 'amber',
  cancelled: 'slate', refunded: 'violet', partially_paid: 'orange',
}
const MIX_COLOUR: Record<string, string> = { paid: '#22c55e', scheduled: '#3b82f6', in_review: '#f59e0b', pending_approval: '#a78bfa', failed: '#ef4444' }
const METHOD_COLOUR: Record<string, string> = { bank_transfer: '#3b82f6', paypal: '#1d4ed8', wise: '#22c55e', manual: '#c084fc' }

function money(value: number, currency = 'GBP', decimals = 2) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)
}
const shortDate = (value: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value))
const time = (value: string) => new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Europe/London' }).format(new Date(value)).toUpperCase()

function MethodMark({ method }: { method: string | null }) {
  const m = method ?? 'manual'
  const mark = m === 'paypal'
    ? <span className="flex h-[16px] w-[16px] items-center justify-center rounded-[3px] text-[12px] font-black italic text-[#1d4ed8]" aria-hidden>P</span>
    : m === 'wise'
      ? <span className="flex h-[16px] w-[16px] items-center justify-center rounded-[3px] bg-[#9fe870] text-[10px] font-black text-[#163300]" aria-hidden>7</span>
      : m === 'bank_transfer'
        ? <span className="flex h-[16px] w-[16px] items-center justify-center rounded-[3px] bg-[#eef2f7] text-[#475467]" aria-hidden><Landmark size={11} /></span>
        : <span className="flex h-[16px] w-[16px] items-center justify-center rounded-[3px] bg-[#f4f0ff] text-[#7c3aed]" aria-hidden><CircleDollarSign size={11} /></span>
  return <span className="flex items-center gap-[8px] text-[10px] text-[#344054]">{mark}{PAYMENT_METHOD_LABELS[m as PaymentMethod] ?? m}</span>
}

export default async function PaymentsPage({ searchParams }: { searchParams: RawSearchParams }) {
  const { access, ...session } = await requireCreatorModule('payments')
  const { supabase, ctx, capabilities, basePath, userId } = session
  const query = parsePaymentsQuery(searchParams)
  // Payment values are financial data: module access alone is not enough.
  const blocked = access.allowed && !capabilities.viewPayments
    ? { allowed: false as const, reason: 'permission' as const, upgrade: false, message: 'Creator payment records are restricted to owners, admins and managers.' }
    : access
  if (!blocked.allowed) return <CreatorsFrame session={session} module="payments" access={blocked}>{null}</CreatorsFrame>

  const size = query.view === 'cards' ? Math.min(query.size, 12) : Math.min(query.size, query.view === 'table' ? query.size : 8)
  const [page, timeline, aggregates, upcoming, flagged, activity, batches, eligible, creators, campaigns, members] = await Promise.all([
    listPayments(supabase, ctx.workspaceId, { ...query, size }),
    query.view === 'timeline' ? listPayments(supabase, ctx.workspaceId, { ...query, sort: 'payout_soonest' }, { all: true, limit: 300 }) : Promise.resolve(null),
    paymentAggregates(supabase, ctx.workspaceId),
    upcomingPayouts(supabase, ctx.workspaceId, 14),
    flaggedInvoices(supabase, ctx.workspaceId, 3),
    recentActivity(supabase, ctx.workspaceId, 4, { surface: 'payments' }),
    listPaymentBatches(supabase, ctx.workspaceId, 50),
    capabilities.processPayouts ? batchEligiblePayments(supabase, ctx.workspaceId) : Promise.resolve([]),
    creatorPickerList(supabase, ctx.workspaceId),
    workspaceCampaigns(supabase, ctx.workspaceId),
    workspaceMembers(supabase, ctx.workspaceId),
  ])

  const currency = aggregates.currency
  const pendingBatches = batches.filter(b => b.status === 'pending_approval')
  const payoutDelta = aggregates.avgPayoutDays !== null && aggregates.previous.avgPayoutDays !== null ? aggregates.avgPayoutDays - aggregates.previous.avgPayoutDays : null
  const spendDelta = delta(aggregates.totalSpend, aggregates.previous.totalSpend)

  const kpis: Kpi[] = [
    { id: 'pending', label: 'Pending Payments', value: money(aggregates.pendingAmount, currency, 0), tone: 'violet', icon: 'money', spark: aggregates.spendSeries.map(p => Number(p.total)), href: `${basePath}/payments?status=pending_approval`, ...kpiDelta(aggregates.pendingAmount, aggregates.previous.pendingAmount) },
    { id: 'paid', label: 'Paid This Month', value: money(aggregates.paidThisMonth, currency, 0), tone: 'green', icon: 'shield', spark: aggregates.spendSeries.map(p => Number(p.paid)), href: `${basePath}/payments?status=paid`, ...kpiDelta(aggregates.paidThisMonth, aggregates.previous.paidAmount, 'vs last month') },
    { id: 'review', label: 'In Review', value: money(aggregates.inReviewAmount, currency, 0), tone: 'blue', icon: 'hourglass', spark: aggregates.spendSeries.map(p => Number(p.total)), href: `${basePath}/payments?status=in_review`, ...kpiDelta(aggregates.inReviewAmount, aggregates.previous.inReviewAmount) },
    { id: 'payout_time', label: 'Avg. Payout Time', value: aggregates.avgPayoutDays === null ? '—' : `${aggregates.avgPayoutDays.toFixed(1)} days`, tone: 'orange', icon: 'clock', spark: aggregates.spendSeries.map(p => Number(p.paid)),
      delta: payoutDelta === null ? 'Submitted to paid' : `${Math.abs(payoutDelta).toFixed(1)} days vs last 30 days`, trend: payoutDelta === null ? 'flat' : payoutDelta <= 0 ? 'down' : 'up' },
    { id: 'upcoming', label: 'Upcoming Payouts', value: money(aggregates.upcomingAmount, currency, 0), tone: 'violet', icon: 'calendar', delta: 'Next 7 days', trend: 'flat', href: `${basePath}/payments?status=scheduled&sort=payout_soonest` },
    { id: 'spend', label: 'Total Creator Spend', value: money(aggregates.totalSpend, currency, 0), tone: 'blue', icon: 'target', spark: aggregates.spendSeries.map(p => Number(p.paid)), ...kpiDelta(aggregates.totalSpend, aggregates.previous.totalSpend) },
  ]

  const mix: Slice[] = (['paid', 'scheduled', 'in_review', 'pending_approval', 'failed'] as PaymentStatus[]).map(key => ({
    key, label: PAYMENT_STATUS_LABELS[key], value: aggregates.byStatus[key], colour: MIX_COLOUR[key], href: `${basePath}/payments?status=${key}`,
  }))
  const mixTotal = aggregates.total
  const methods: Slice[] = aggregates.byMethod.map(m => ({ key: m.method, label: PAYMENT_METHOD_LABELS[m.method as PaymentMethod] ?? 'Other', value: m.count, colour: METHOD_COLOUR[m.method] ?? '#c084fc', href: `${basePath}/payments?method=${m.method}` }))
  const campaignSpend = aggregates.byCampaign.slice(0, 5)
  const otherSpend = aggregates.byCampaign.slice(5).reduce((a, c) => a + c.amount, 0)
  const campaignTotal = aggregates.byCampaign.reduce((a, c) => a + c.amount, 0)
  const upcomingTotal = upcoming.reduce((a, u) => a + u.amount, 0)
  const hasFilters = Boolean(query.q || query.status || query.campaign || query.creator || query.method || query.approver || query.from || query.to || query.batch || query.invoice || query.tax || query.currency)

  const approval = (row: PaymentRow) => row.approval_state === 'approved'
    ? <span className="flex items-center gap-[7px]"><Avatar name={row.approver?.full_name} src={row.approver?.avatar_url} size={20} /><span className="leading-tight"><span className="block text-[8.5px] text-[#8a94a6]">Approved by</span><span className="block text-[9.5px] font-medium text-[#101828]">{row.approver?.full_name ?? 'Approver'}</span></span></span>
    : row.approval_state === 'pending'
      ? <span className="flex items-center gap-[6px] text-[9.5px] text-[#101828]"><span className="h-[9px] w-[9px] rounded-full border-2 border-[#f59e0b]" aria-hidden />In Review</span>
      : row.approval_state === 'rejected' ? <span className="text-[9.5px] text-[#dc2626]">Rejected</span> : <span className="text-[9.5px] text-[#98a2b3]">Not submitted</span>

  return (
    <CreatorsFrame
      session={session} module="payments" access={blocked}
      actions={(
        <>
          {capabilities.processPayouts && <CreatePaymentBatchButton eligible={eligible} />}
          {capabilities.approvePayments && (
            <ApprovePayoutsButton pendingBatches={pendingBatches.length} pendingTotal={money(pendingBatches.reduce((a, b) => a + Number(b.total_amount), 0), currency)} />
          )}
          <ExportMenu entity="payments" allowed={capabilities.export} />
        </>
      )}
    >
      <KpiGrid items={kpis} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-[14px] xl:grid-cols-[842fr_310fr]">
        <div className="flex min-w-0 flex-col gap-[14px]">
          <div className="flex flex-wrap items-center gap-[10px]">
            <SearchBox placeholder="Search payments..." width={146} />
            <SelectControl spec={{ key: 'status', label: 'Status', all: 'Status', width: 84, options: PAYMENT_STATUSES.map(s => ({ value: s, label: PAYMENT_STATUS_LABELS[s] })) }} />
            <SelectControl spec={{ key: 'campaign', label: 'Campaign', all: 'Campaign', width: 98, options: campaigns.map(c => ({ value: c.id, label: c.name })) }} />
            <SelectControl spec={{ key: 'creator', label: 'Creator', all: 'Creator', width: 88, options: creators.map(c => ({ value: c.id, label: c.name })) }} />
            <SelectControl spec={{ key: 'method', label: 'Payment method', all: 'Payment Method', width: 124, options: PAYMENT_METHODS.map(m => ({ value: m, label: PAYMENT_METHOD_LABELS[m] })) }} />
            <SelectControl spec={{ key: 'approver', label: 'Approver', all: 'Approver', width: 94, options: members.map(m => ({ value: m.id, label: m.id === userId ? 'You' : m.full_name ?? m.email ?? 'Member' })) }} />
            <DateRangeControl width={134} allLabel="Payout Period" />
          </div>

          {query.view === 'timeline' ? <PaymentTimeline rows={timeline?.rows ?? []} basePath={basePath} />
            : query.view === 'cards' ? (
              page.rows.length === 0 ? <div className={CARD}><PanelEmpty className="min-h-[240px]">{hasFilters ? 'No payments match these filters.' : 'No payments yet.'}</PanelEmpty></div> : (
                <>
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {page.rows.map(row => (
                      <li key={row.id} className={cn(CARD, 'p-[12px]')}>
                        <div className="flex items-start justify-between gap-2">
                          <Person name={row.creator?.name ?? 'Unknown'} handle={row.creator?.handle} src={row.creator?.avatar_url} href={`${basePath}/payments/${row.id}`} />
                          <Pill tone={STATUS_TONE[row.status] ?? 'slate'}>{PAYMENT_STATUS_LABELS[row.status as PaymentStatus]}</Pill>
                        </div>
                        <p className="mt-3 text-[18px] font-semibold text-[#101828]">{money(Number(row.amount), row.currency)}</p>
                        <p className="truncate text-[10px] text-[#1d6bf3]">{row.brief?.title ?? row.campaign?.name ?? 'No brief'}</p>
                        <div className="mt-3 flex items-center justify-between"><MethodMark method={row.payment_method} /><span className="text-[10px] text-[#475467]">{row.payout_date ? `Payout ${shortDate(row.payout_date)}` : 'Not scheduled'}</span></div>
                        <div className="mt-2 flex items-center justify-between">{approval(row)}<PaymentRowMenu id={row.id} status={row.status} href={`${basePath}/payments/${row.id}`} canApprove={capabilities.approvePayments} canProcess={capabilities.processPayouts} /></div>
                      </li>
                    ))}
                  </ul>
                  <Pager compact page={query.page} size={size} total={page.total} noun="payments" sizes={[12]} />
                </>
              )
            ) : (
              <section className={cn(CARD, 'min-w-0')} aria-labelledby="payments-title">
                <header className="flex items-center gap-3 px-[14px] pb-[8px] pt-[13px]">
                  <h2 id="payments-title" className="text-[12.5px] font-semibold text-[#101828]">Payments</h2>
                  <span className="text-[9.5px] text-[#8a94a6]">{page.total} payments</span>
                  {capabilities.managePayments && <span className="ml-auto"><CreatePaymentButton creators={creators} /></span>}
                </header>
                {page.error ? <PanelEmpty className="text-red-600">We could not load payments ({page.error}). Reference CF-CREATORS.</PanelEmpty>
                  : page.rows.length === 0 ? <PanelEmpty className="min-h-[240px]">{hasFilters ? 'No payments match these filters.' : 'No creator payments yet. Payments appear once work is approved and a payment is recorded.'}</PanelEmpty> : (
                    <div className="relative overflow-x-auto">
                      <table className="w-full min-w-[720px] [&_td]:px-[5px] [&_th]:px-[5px]">
                        <caption className="sr-only">Creator payments</caption>
                        <thead className="border-y border-[#eef0f4]">
                          <tr className="h-[32px]">
                            {['Creator', 'Brief / Campaign', 'Amount', 'Payment Method', 'Submitted Date', 'Approval State', 'Payout Date', 'Status'].map(h => <th key={h} scope="col" className={cn(TH, 'text-[9.5px]', h === 'Creator' && '!pl-[14px]')}>{h}</th>)}
                            <th scope="col" className={TH}><span className="sr-only">Actions</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          {page.rows.map(row => (
                            <tr key={row.id} className="h-[42.5px] border-b border-[#f1f3f6] last:border-0 hover:bg-[#fafbfd]">
                              <td className={cn(TD, '!pl-[14px]')}><Person name={row.creator?.name ?? 'Unknown'} handle={row.creator?.handle} src={row.creator?.avatar_url} size={24} href={`${basePath}/payments/${row.id}`} /></td>
                              <td className={cn(TD, 'max-w-[108px] truncate text-[9.5px]')}>
                                {row.brief ? <Link href={`${basePath}/briefs/${row.brief.id}`} className="text-[#1d6bf3] hover:underline">{row.brief.title}</Link> : <span className="text-[#475467]">{row.campaign?.name ?? '—'}</span>}
                              </td>
                              <td className={cn(TD, 'text-[10px] leading-tight tabular-nums')}>{money(Number(row.amount), row.currency)}<span className="block text-[8.5px] text-[#8a94a6]">{row.currency}</span></td>
                              <td className={TD}><MethodMark method={row.payment_method} /></td>
                              <td className={cn(TD, 'text-[9.5px] leading-tight')}>{row.submitted_date ? <>{shortDate(row.submitted_date)}<span className="block text-[8.5px] text-[#8a94a6]">{time(row.submitted_date)}</span></> : '—'}</td>
                              <td className={TD}>{approval(row)}</td>
                              <td className={cn(TD, 'text-[9.5px]')}>{row.payout_date ? shortDate(row.payout_date) : '—'}</td>
                              <td className={TD}><Pill tone={STATUS_TONE[row.status] ?? 'slate'}>{PAYMENT_STATUS_LABELS[row.status as PaymentStatus] ?? row.status}</Pill></td>
                              <td className={cn(TD, 'text-right')}><PaymentRowMenu id={row.id} status={row.status} href={`${basePath}/payments/${row.id}`} canApprove={capabilities.approvePayments} canProcess={capabilities.processPayouts} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                <Pager compact className="border-t border-[#eef0f4] px-[14px] py-[9px]" page={query.page} size={size} total={page.total} noun="payments" />
              </section>
            )}

          <div className="grid grid-cols-[minmax(0,1fr)] gap-[14px] md:grid-cols-3">
            <Panel title="Payment Spend Trend" titleClassName="text-[12px]" href="/app/analytics" hrefLabel="View analytics">
              <p className="flex items-baseline gap-2"><span className="text-[16px] font-semibold text-[#101828]">{money(aggregates.totalSpend, currency, 0)}</span><span className="text-[9.5px] text-[#475467]">Total Spend</span></p>
              <p className={cn('mb-[6px] text-[9.5px]', spendDelta.trend === 'down' ? 'text-[#dc2626]' : 'text-[#16a34a]')}>{spendDelta.trend === 'down' ? '↘' : '↗'} {deltaLabel(spendDelta.pct)}</p>
              <LineChart money currency={currency} data={aggregates.spendSeries} height={132} series={[
                { key: 'total', label: 'Total Spend', colour: '#3b82f6' },
                { key: 'paid', label: 'Paid Amount', colour: '#3b82f6', dashed: true },
              ]} />
            </Panel>
            <Panel title="Spend by Campaign" titleClassName="text-[12px]" href={`${basePath}/payments?sort=amount_desc`} hrefLabel="View report">
              {campaignSpend.length === 0 ? <PanelEmpty>No spend yet.</PanelEmpty> : (
                <>
                  <ul className="space-y-[12px] pt-[4px]">
                    {[...campaignSpend.map(c => ({ key: c.id ?? 'none', label: c.name, amount: c.amount, href: c.id ? `${basePath}/payments?campaign=${c.id}` : undefined })),
                      ...(otherSpend > 0 ? [{ key: 'others', label: 'Others', amount: otherSpend, href: undefined }] : [])].map(item => {
                      const pct = campaignTotal ? (item.amount / campaignTotal) * 100 : 0
                      const row = (
                        <>
                          <span className="w-[86px] shrink-0 truncate text-[#344054]">{item.label}</span>
                          <span className="block h-[6px] min-w-0 flex-1 overflow-hidden rounded-full bg-[#edf0f5]"><span className={cn('block h-full rounded-full', item.key === 'others' ? 'bg-[#cbd5e1]' : 'bg-[#2f6fed]')} style={{ width: `${pct}%` }} /></span>
                          <span className="w-[52px] shrink-0 text-right tabular-nums text-[#344054]">{money(item.amount, currency, 0)}</span>
                          <span className="w-[32px] shrink-0 text-right tabular-nums text-[#8a94a6]">{pct.toFixed(1)}%</span>
                        </>
                      )
                      return <li key={item.key} className="text-[8.5px]">{item.href ? <Link href={item.href} className="flex items-center gap-[8px] hover:underline">{row}</Link> : <span className="flex items-center gap-[8px]">{row}</span>}</li>
                    })}
                  </ul>
                  <p className="mt-[16px] flex justify-between border-t border-[#eef0f4] pt-[10px] text-[10.5px] font-medium text-[#101828]"><span>Total</span><span>{money(campaignTotal, currency, 0)}</span></p>
                </>
              )}
            </Panel>
            <Panel title="Payment Methods Usage" titleClassName="text-[12px]">
              {methods.length === 0 ? <PanelEmpty>No payments yet.</PanelEmpty> : (
                <>
                  <div className="flex items-center gap-[14px] pt-[4px]">
                    <Donut slices={methods} total={mixTotal} caption="Total" size={112} thickness={18} />
                    <ul className="min-w-0 flex-1 space-y-[9px]">
                      {methods.map(m => (
                        <li key={m.key} className="text-[9.5px]">
                          <Link href={m.href!} className="flex items-start gap-[6px] hover:underline">
                            <span className="mt-[3px] h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: m.colour }} aria-hidden />
                            <span className="leading-tight text-[#344054]">{m.label}<span className="block text-[#8a94a6]">{m.value} ({mixTotal ? ((m.value / mixTotal) * 100).toFixed(1) : 0}%)</span></span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="mt-[12px] flex justify-between border-t border-[#eef0f4] pt-[10px] text-[10px] font-medium text-[#101828]"><span>Total</span><span>{mixTotal}</span></p>
                </>
              )}
            </Panel>
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-[14px]" aria-label="Payment insights">
          <div className="flex items-center gap-[10px]">
            <ViewToggle size="sm" className="flex-1 justify-between" active={query.view} views={[{ id: 'table', label: 'Table View', icon: 'table' }, { id: 'cards', label: 'Cards View', icon: 'cards' }, { id: 'timeline', label: 'Timeline View', icon: 'timeline' }]} />
            <SettingsMenu defaultSort="submitted_newest" sorts={PAYMENT_SORTS.map(s => ({ value: s.id, label: s.label }))} extra={[
              { key: 'invoice', label: 'Invoice state', all: 'Any invoice state', options: [['required', 'Required'], ['submitted', 'Submitted'], ['approved', 'Approved'], ['flagged', 'Flagged']].map(([value, label]) => ({ value, label })) },
              { key: 'tax', label: 'Tax information', all: 'Any tax state', options: [['missing', 'Missing'], ['submitted', 'Submitted'], ['verified', 'Verified']].map(([value, label]) => ({ value, label })) },
              { key: 'batch', label: 'Payment batch', all: 'Any batch', options: batches.map(b => ({ value: b.id, label: b.name })) },
            ]} />
          </div>

          <Panel title="Payment Status Mix" titleClassName="text-[12px]" href={`${basePath}/payments`}>
            {mixTotal === 0 ? <PanelEmpty>No payments yet.</PanelEmpty> : (
              <div className="flex items-center gap-[14px]">
                <Donut slices={mix} total={mixTotal} caption="Total" size={110} thickness={18} />
                <Legend slices={mix} total={mixTotal} className="flex-1 space-y-[10px] [&_li]:text-[9px]" />
              </div>
            )}
          </Panel>

          <Panel title="Upcoming Payouts" titleClassName="text-[12px]" href={`${basePath}/payments?status=scheduled&sort=payout_soonest`}>
            {upcoming.length === 0 ? <PanelEmpty>No payouts scheduled in the next 14 days.</PanelEmpty> : (
              <>
                <ul className="space-y-[9px]">
                  {upcoming.slice(0, 4).map(u => (
                    <li key={u.date}>
                      <Link href={`${basePath}/payments?from=${u.date}&to=${u.date}`} className="grid grid-cols-[1fr_1fr_auto] text-[9.5px] text-[#344054] hover:underline">
                        <span>{shortDate(u.date).replace(/ \d{4}$/, '')}, {u.date.slice(0, 4)}</span>
                        <span className="text-[#667085]">{u.count} payment{u.count === 1 ? '' : 's'}</span>
                        <span className="tabular-nums">{money(u.amount, currency)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-[12px] flex justify-between border-t border-[#eef0f4] pt-[10px] text-[10px] font-semibold text-[#101828]"><span>Total Upcoming</span><span>{money(upcomingTotal, currency)}</span></p>
              </>
            )}
          </Panel>

          <Panel title="Flagged Invoices" titleClassName="text-[12px]" href={`${basePath}/payments?invoice=flagged`}>
            {flagged.length === 0 ? <PanelEmpty>No flagged invoices.</PanelEmpty> : (
              <ul className="space-y-[11px]">
                {flagged.map(row => (
                  <li key={row.id}>
                    <Link href={`${basePath}/payments/${row.id}`} className="grid grid-cols-[auto_1fr_1fr_auto] items-start gap-x-[6px] hover:bg-[#fafbfd]">
                      <Flag size={11} className="mt-[2px] fill-[#ef4444] text-[#ef4444]" aria-hidden />
                      <span className="min-w-0 leading-tight"><span className="block truncate text-[9px] font-medium text-[#1d6bf3]">{row.invoice_number ?? 'No invoice'}</span><span className="block truncate text-[8.5px] text-[#8a94a6]">{row.creator?.name}</span></span>
                      <span className="min-w-0 leading-tight"><span className="flex items-center gap-[3px] truncate text-[8.5px] text-[#475467]">{row.invoice_flag ?? (row.tax_status === 'missing' ? 'Missing tax info' : row.status === 'failed' ? 'Payout failed' : 'Flagged')}<AlertTriangle size={9} className="shrink-0 text-[#f59e0b]" aria-hidden /></span><span className="block text-[8px] text-[#98a2b3]">{formatAgo(row.updated_at)}</span></span>
                      <span className="text-[9px] tabular-nums text-[#101828]">{money(Number(row.amount), row.currency)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Payment Activity" titleClassName="text-[12px]" href={`${basePath}/payments?sort=submitted_newest`} className="flex-1">
            {activity.length === 0 ? <PanelEmpty>Payment approvals, batches and payouts appear here.</PanelEmpty> : (
              <ul className="space-y-[12px]">
                {activity.map(item => {
                  const href = link(session, item.link)
                  const body = (
                    <span className="flex items-start gap-[8px]">
                      <Avatar name={item.actor?.full_name} src={item.actor?.avatar_url} size={22} />
                      <span className="min-w-0 flex-1"><span className="block text-[9.5px] leading-[13px] text-[#101828]">{item.summary}</span><span className="block text-[8.5px] text-[#98a2b3]">{formatAgo(item.created_at)}</span></span>
                    </span>
                  )
                  return <li key={item.id}>{href ? <Link href={href} className="block rounded hover:bg-[#fafbfd]">{body}</Link> : body}</li>
                })}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </CreatorsFrame>
  )
}

/** Timeline view: payments grouped by payout date. */
function PaymentTimeline({ rows, basePath }: { rows: PaymentRow[]; basePath: string }) {
  const groups = new Map<string, PaymentRow[]>()
  for (const row of rows) {
    const key = row.payout_date ?? 'unscheduled'
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => (a === 'unscheduled' ? 1 : b === 'unscheduled' ? -1 : a.localeCompare(b)))
  if (ordered.length === 0) return <div className={CARD}><PanelEmpty className="min-h-[240px]">No payments to show on the timeline.</PanelEmpty></div>
  return (
    <section className={cn(CARD, 'min-w-0 p-[14px]')} aria-label="Payment timeline">
      <ol className="relative space-y-[16px] border-l border-[#e4e7ec] pl-[18px]">
        {ordered.map(([date, items]) => (
          <li key={date} className="relative">
            <span className="absolute -left-[23px] top-[3px] h-[9px] w-[9px] rounded-full border-2 border-white bg-[#1d6bf3] ring-1 ring-[#1d6bf3]" aria-hidden />
            <h3 className="text-[11px] font-semibold text-[#101828]">{date === 'unscheduled' ? 'Not yet scheduled' : shortDate(date)}
              <span className="ml-2 text-[10px] font-normal text-[#8a94a6]">{items.length} payment{items.length === 1 ? '' : 's'} · {money(items.reduce((a, r) => a + Number(r.amount), 0), items[0].currency)}</span>
            </h3>
            <ul className="mt-[6px] grid grid-cols-[minmax(0,1fr)] gap-[6px] sm:grid-cols-2">
              {items.map(row => (
                <li key={row.id}>
                  <Link href={`${basePath}/payments/${row.id}`} className="flex items-center gap-[8px] rounded-md border border-[#eef0f4] px-[8px] py-[6px] hover:border-[#cfd6e2]">
                    <Avatar name={row.creator?.name} src={row.creator?.avatar_url} size={22} />
                    <span className="min-w-0 flex-1 truncate text-[10px] text-[#101828]">{row.creator?.name} · {row.brief?.title ?? '—'}</span>
                    <span className="text-[10px] tabular-nums">{money(Number(row.amount), row.currency, 0)}</span>
                    <Pill tone={STATUS_TONE[row.status] ?? 'slate'}>{PAYMENT_STATUS_LABELS[row.status as PaymentStatus]}</Pill>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  )
}
