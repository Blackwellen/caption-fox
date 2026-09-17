import Link from 'next/link'
import {
  ShoppingCart, Wallet, Truck, ClipboardCheck, CheckCircle2, ShieldAlert, Activity,
} from 'lucide-react'
import { requireMarketplaceModule } from '@/lib/marketplace/server'
import { parseMarketplaceQuery, buildMarketplaceHref, type RawParams } from '@/lib/marketplace/query'
import {
  MODULE_ROUTES, ESCROW_META, DELIVERY_META, money, percent, responseTime, deadlineState,
} from '@/lib/marketplace/module'
import {
  getOrders, getOrderInsights, getDisputes, getActivity, getCategories,
} from '@/lib/marketplace/data'
import { MarketplacePage, AccessBlocked, NoResults } from '@/components/marketplace/module/Layout'
import SearchHero from '@/components/marketplace/module/SearchHero'
import { orderFilters } from '@/components/marketplace/module/filters'
import { Panel, PanelLink, StatTile, KpiStrip, ProfileAvatar, StatusPill } from '@/components/marketplace/module/primitives'
import { Pagination, PageSizeSelect, FilterChips, ColumnsMenu } from '@/components/marketplace/module/Controls'
import { OrderActions, ExportOrders } from '@/components/marketplace/module/OrdersClient'
import { formatRelative, cn } from '@/lib/utils'

export const metadata = { title: 'Marketplace Orders · Caption Fox' }

const DONUT_CIRCUMFERENCE = 2 * Math.PI * 14

/** Toggleable table columns; Order ID and Actions always stay visible. */
const ORDER_COLUMNS = [
  { id: 'supplier', label: 'Supplier' },
  { id: 'category', label: 'Category' },
  { id: 'amount', label: 'Amount' },
  { id: 'escrow', label: 'Escrow status' },
  { id: 'delivery', label: 'Delivery status' },
  { id: 'milestone', label: 'Milestone' },
  { id: 'due', label: 'Due date' },
  { id: 'dispute', label: 'Dispute state' },
]

const PATH = MODULE_ROUTES.orders

const QUICK_FILTERS: { label: string; patch: Record<string, string> }[] = [
  { label: 'Active orders', patch: { status: 'in_progress' } },
  { label: 'In escrow', patch: { escrow: 'in_escrow' } },
  { label: 'Pending delivery', patch: { delivery: 'pending_delivery' } },
  { label: 'Pending review', patch: { delivery: 'pending_review' } },
  { label: 'Disputes', patch: { status: 'disputed' } },
  { label: 'Completed', patch: { status: 'completed' } },
]

export default async function MarketplaceOrdersPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const session = await requireMarketplaceModule('orders')
  if (!session.access.allowed) {
    return (
      <MarketplacePage
        module="orders" modules={session.modules}
        title="Marketplace Orders" subtitle="Manage, track, and resolve marketplace orders with full operational visibility."
      >
        <AccessBlocked access={session.access} title="Orders are not available" />
      </MarketplacePage>
    )
  }

  const params = await searchParams
  const query = parseMarketplaceQuery(params, { views: ['table', 'cards'], defaultView: 'table' })

  const [{ rows, total }, insights, disputes, activity, categories] = await Promise.all([
    getOrders(session, query),
    getOrderInsights(session),
    session.capabilities.viewDisputes ? getDisputes(session, 6) : Promise.resolve([]),
    getActivity(session, 5, { entityTypes: ['order', 'dispute'] }),
    getCategories(session.supabase),
  ])

  // Supplier filter options come from the suppliers this workspace has actually
  // ordered from, so the control never lists the whole directory.
  const orderSuppliers = [...new Map(
    rows.filter(row => row.supplier).map(row => [row.supplier!.id, {
      id: row.supplier!.id, display_name: row.supplier!.display_name,
    }]),
  ).values()].sort((a, b) => a.display_name.localeCompare(b.display_name))

  const first = (query.page - 1) * query.size + 1
  const last = Math.min(query.page * query.size, total)
  const trackerColours: Record<string, string> = {
    in_progress: 'bg-blue-500', pending_delivery: 'bg-amber-500',
    pending_review: 'bg-violet-500', delivered: 'bg-emerald-500', overdue: 'bg-red-500',
  }
  // Donut segments: each arc starts where the previous one ended.
  const trackerTotal = insights.tracker.reduce((sum, entry) => sum + entry.count, 0)
  const donutArcs = insights.tracker
    .filter(entry => entry.count > 0)
    .reduce<{ key: string; length: number; offset: number }[]>((arcs, entry) => {
      const offset = arcs.length ? arcs[arcs.length - 1].offset + arcs[arcs.length - 1].length : 0
      const length = trackerTotal ? (entry.count / trackerTotal) * DONUT_CIRCUMFERENCE : 0
      return [...arcs, { key: entry.key, length, offset }]
    }, [])
  // Same palette as the legend dots, as raw colours for the SVG donut.
  const trackerStroke: Record<string, string> = {
    in_progress: '#3b82f6', pending_delivery: '#f59e0b',
    pending_review: '#8b5cf6', delivered: '#10b981', overdue: '#ef4444',
  }

  return (
    <MarketplacePage
      module="orders" modules={session.modules}
      title="Marketplace Orders"
      subtitle="Manage, track, and resolve marketplace orders with full operational visibility."
    >
      <SearchHero
        title="Search and filter orders"
        subtitle="Find exactly what you need with advanced search and filters."
        placeholder="Search by order ID, project, supplier, or content…"
        query={query} pathname={PATH} mode="orders" resultCount={total}
        filters={orderFilters(categories, orderSuppliers)}
        canSaveSearch={session.capabilities.search}
        inlineSearch
        extraRow={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-blue-100 lg:text-[10px]">Quick filters:</span>
            {QUICK_FILTERS.map(filter => (
              <Link
                key={filter.label}
                href={buildMarketplaceHref(PATH, query, filter.patch)}
                className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/25 lg:text-[10px]"
              >
                {filter.label}
              </Link>
            ))}
          </div>
        }
      />

      <KpiStrip>
        <StatTile cell icon={<ShoppingCart size={17} />} label="Active orders" value={String(insights.kpis.active)} tone="blue" />
        <StatTile cell icon={<Wallet size={17} />} label="In escrow" value={money(insights.kpis.inEscrowCents, 'GBP', { compact: true })} tone="violet" />
        <StatTile cell icon={<Truck size={17} />} label="Pending delivery" value={String(insights.kpis.pendingDelivery)} tone="amber" />
        <StatTile cell icon={<ClipboardCheck size={17} />} label="Pending review" value={String(insights.kpis.pendingReview)} tone="amber" />
        <StatTile cell icon={<CheckCircle2 size={17} />} label="Completed" value={String(insights.kpis.completed)} tone="emerald" />
        <StatTile cell icon={<ShieldAlert size={17} />} label="Disputes" value={String(insights.kpis.disputes)} tone={insights.kpis.disputes > 0 ? 'red' : 'slate'} />
      </KpiStrip>

      <div className="grid gap-5 lg:gap-4 xl:grid-cols-[minmax(0,1fr)_250px]">
        <div className="min-w-0 space-y-5 lg:space-y-4">
          <Panel
            title={`Orders (${total})`}
            subtitle={total > 0 ? `Showing ${first}–${last} of ${total} orders` : 'No orders match these filters'}
            action={
              <div className="flex items-center gap-2">
                <ExportOrders rows={rows} canExport={session.capabilities.export} />
                <ColumnsMenu tableId="orders" columns={ORDER_COLUMNS} />
                <PageSizeSelect query={query} pathname={PATH} />
              </div>
            }
            padded={false}
          >
            <div className="px-4 pt-3 lg:px-3">
              <FilterChips
                query={query} pathname={PATH}
                labels={{
                  status: query.status, escrow: ESCROW_META[query.escrow as keyof typeof ESCROW_META]?.label,
                  delivery: DELIVERY_META[query.delivery as keyof typeof DELIVERY_META]?.label,
                  category: categories.find(c => c.slug === query.category)?.name,
                }}
              />
            </div>

            {rows.length === 0 ? (
              <NoResults
                title="No orders match these filters"
                description="Clear a filter, or start an order from a supplier profile or an accepted proposal."
                action={
                  <Link href={MODULE_ROUTES.discover} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 lg:text-[11px] lg:px-3">
                    Find a supplier
                  </Link>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table data-columns="orders" className="w-full min-w-[1000px] text-xs lg:min-w-0 lg:text-[9px]">
                  <caption className="sr-only">Marketplace orders</caption>
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400 lg:text-[8px]">
                    <tr>
                      <th scope="col" data-col="order" className="whitespace-nowrap px-4 py-2.5 text-left font-semibold lg:px-2 lg:py-[5px]">Order ID</th>
                      <th scope="col" data-col="supplier" className="whitespace-nowrap px-3 py-2.5 text-left font-semibold lg:px-1.5 lg:py-[5px]">Supplier</th>
                      <th scope="col" data-col="category" className="whitespace-nowrap px-3 py-2.5 text-left font-semibold lg:px-1.5 lg:py-[5px]">Category</th>
                      <th scope="col" data-col="amount" className="whitespace-nowrap px-3 py-2.5 text-left font-semibold lg:px-1.5 lg:py-[5px]">Amount</th>
                      <th scope="col" data-col="escrow" className="whitespace-nowrap px-3 py-2.5 text-left font-semibold lg:px-1.5 lg:py-[5px]">Escrow status</th>
                      <th scope="col" data-col="delivery" className="whitespace-nowrap px-3 py-2.5 text-left font-semibold lg:px-1.5 lg:py-[5px]">Delivery status</th>
                      <th scope="col" data-col="milestone" className="whitespace-nowrap px-3 py-2.5 text-left font-semibold lg:px-1.5 lg:py-[5px]">Milestone</th>
                      <th scope="col" data-col="due" className="whitespace-nowrap px-3 py-2.5 text-left font-semibold lg:px-1.5 lg:py-[5px]">Due date</th>
                      <th scope="col" data-col="dispute" className="whitespace-nowrap px-3 py-2.5 text-left font-semibold lg:px-1.5 lg:py-[5px]">Dispute state</th>
                      <th scope="col" data-col="actions" className="px-4 py-2.5 text-right font-semibold lg:py-1.5 lg:px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map(order => {
                      const escrow = ESCROW_META[order.escrow_status]
                      const delivery = DELIVERY_META[order.delivery_status]
                      const due = deadlineState(order.due_date)
                      // A delivered or cancelled order has no deadline left to
                      // miss, so it must not be badged "overdue".
                      const settled = ['delivered', 'cancelled'].includes(order.delivery_status)
                        || ['completed', 'cancelled', 'refunded'].includes(order.status)
                      return (
                        <tr key={order.id} className="hover:bg-slate-50">
                          <td data-col="order" className="px-4 py-2.5 lg:px-2 lg:py-[5px]">
                            <Link href={`${PATH}?q=${order.reference}`} className="whitespace-nowrap font-medium text-blue-600 hover:text-blue-700">
                              {order.reference}
                            </Link>
                          </td>
                          <td data-col="supplier" className="px-3 py-2.5 lg:px-1.5 lg:py-[5px]">
                            <span className="flex items-center gap-1.5">
                              {order.supplier && <ProfileAvatar profile={order.supplier} size={18} />}
                              <span className="truncate whitespace-nowrap text-slate-700">{order.supplier?.display_name ?? '—'}</span>
                            </span>
                          </td>
                          <td data-col="category" className="whitespace-nowrap px-3 py-2.5 text-slate-500 lg:px-1.5 lg:py-[5px]">{order.category ?? '—'}</td>
                          <td data-col="amount" className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-800 lg:px-1.5 lg:py-[5px]">{money(order.amount_cents, order.currency)}</td>
                          <td data-col="escrow" className="px-3 py-2.5 lg:px-1.5 lg:py-[5px]"><StatusPill label={escrow.label} cls={escrow.cls} dot={escrow.dot} /></td>
                          <td data-col="delivery" className="px-3 py-2.5 lg:px-1.5 lg:py-[5px]"><StatusPill label={delivery.label} cls={delivery.cls} dot={delivery.dot} /></td>
                          <td data-col="milestone" className="whitespace-nowrap px-3 py-2.5 text-slate-600 lg:px-1.5 lg:py-[5px]">{order.current_milestone ?? '—'}</td>
                          <td data-col="due" className="px-3 py-2.5 lg:px-1.5 lg:py-[5px]">
                            <span className="whitespace-nowrap text-slate-600">{order.due_date ? new Date(order.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' }) : '—'}</span>
                            {settled ? null : (
                              <span className={cn('ml-1 whitespace-nowrap rounded px-1 text-[10px] font-medium lg:text-[9px]',
                                due.tone === 'danger' ? 'bg-red-50 text-red-600'
                                  : due.tone === 'warn' ? 'bg-amber-50 text-amber-600' : 'text-slate-400')}>
                                {due.label}
                              </span>
                            )}
                          </td>
                          <td data-col="dispute" className="px-3 py-2.5 lg:px-1.5 lg:py-[5px]">
                            {order.dispute_state
                              ? <StatusPill label={order.dispute_state.replace(/_/g, ' ')} cls="text-red-700 bg-red-50" />
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td data-col="actions" className="px-4 py-2.5 lg:px-2 lg:py-[5px]">
                            <OrderActions
                              order={order}
                              caps={{
                                approveDelivery: session.capabilities.approveDelivery,
                                editOrder: session.capabilities.editOrder,
                                releaseEscrow: session.capabilities.releaseEscrow,
                                createDispute: session.capabilities.createDispute,
                              }}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {rows.length > 0 && (
              <div className="border-t border-slate-100 p-4">
                <Pagination query={query} pathname={PATH} total={total} />
              </div>
            )}
          </Panel>

          <div className="grid gap-5 lg:gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.95fr)]">
            {session.capabilities.viewEscrow && (
              <Panel title="Escrow management" action={<PanelLink href={`${PATH}?escrow=in_escrow`}>View all</PanelLink>}>
                <dl className="space-y-2.5 text-xs lg:text-[10px]">
                  {[
                    ['Funds in escrow', money(insights.escrow.fundsCents)],
                    ['Pending release', money(insights.escrow.pendingReleaseCents)],
                    ['Hold on disputes', money(insights.escrow.holdCents)],
                    ['Auto-release eligible', money(insights.escrow.autoReleaseCents)],
                    ['Released to date', money(insights.escrow.releasedCents)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="font-semibold text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
                <Link
                  href={`${PATH}?escrow=in_escrow`}
                  className="mt-4 block rounded-lg border border-slate-200 px-3 py-2 text-center text-xs font-medium text-slate-700 hover:bg-slate-50 lg:text-[10px]"
                >
                  Manage escrow
                </Link>
              </Panel>
            )}

            <Panel title="Milestone and delivery tracker" action={<PanelLink href={PATH}>View all</PanelLink>}>
              <div className="flex items-center gap-4 lg:gap-2">
              {/* Reference: donut of delivery states with the order total in the centre. */}
              <div className="relative h-28 w-28 shrink-0 lg:h-[74px] lg:w-[74px]" role="img" aria-label={`${insights.totalOrders} total orders by delivery status`}>
                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#f1f5f9" strokeWidth="5" />
                  {donutArcs.map(arc => (
                    <circle
                      key={arc.key} cx="18" cy="18" r="14" fill="none" strokeWidth="5"
                      stroke={trackerStroke[arc.key] ?? '#94a3b8'}
                      strokeDasharray={`${arc.length} ${DONUT_CIRCUMFERENCE - arc.length}`}
                      strokeDashoffset={-arc.offset}
                    />
                  ))}
                </svg>
                <span className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold leading-none text-slate-900 lg:text-[13px]">{insights.totalOrders}</span>
                  <span className="mt-0.5 text-[10px] text-slate-400 lg:text-[8px]">Total orders</span>
                </span>
              </div>
              <ul className="min-w-0 flex-1 space-y-2 lg:space-y-1.5">
                {insights.tracker.map(entry => (
                  <li key={entry.key}>
                    <Link
                      href={buildMarketplaceHref(PATH, query, entry.key === 'overdue' ? {} : { delivery: entry.key })}
                      className="flex items-center gap-2 text-xs hover:text-blue-700 lg:gap-1.5 lg:text-[9px]"
                    >
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', trackerColours[entry.key])} />
                      <span className="min-w-0 flex-1 truncate text-slate-600">{entry.label}</span>
                      <span className="shrink-0 font-semibold text-slate-900">{entry.count}</span>
                      <span className="w-11 shrink-0 text-right text-[11px] text-slate-400 lg:w-7 lg:text-[8.5px]">{entry.pct}%</span>
                    </Link>
                  </li>
                ))}
              </ul>
              </div>
            </Panel>

            {session.capabilities.viewDisputes && (
              <Panel title="Disputes needing attention" action={<PanelLink href={`${PATH}?status=disputed`}>View all</PanelLink>} padded={false}>
                {disputes.length === 0 ? (
                  <p className="p-5 text-xs text-slate-500 lg:text-[10px]">No open disputes. Escrow releases can proceed normally.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {disputes.map(dispute => (
                      <li key={dispute.id} className="px-4 py-2.5 lg:py-1.5 lg:px-3">
                        <div className="flex items-start justify-between gap-2">
                          <Link href={`${PATH}?q=${dispute.order?.reference ?? ''}`} className="text-xs font-semibold text-red-600 hover:text-red-700 lg:text-[10px]">
                            {dispute.order?.reference ?? 'Order'}
                          </Link>
                          <span className="shrink-0 text-[11px] font-medium text-slate-700 lg:text-[9px]">{money(dispute.amount_cents)}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500 lg:text-[9px]">{dispute.supplier_name}</p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] text-slate-400 lg:text-[9px]">{dispute.reason}</span>
                          <StatusPill
                            label={dispute.severity ?? 'medium'}
                            cls={dispute.severity === 'high' ? 'text-red-700 bg-red-50' : dispute.severity === 'low' ? 'text-slate-600 bg-slate-100' : 'text-amber-700 bg-amber-50'}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="border-t border-slate-100 p-3">
                  <Link
                    href={`${PATH}?status=disputed`}
                    className="block rounded-lg bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-700 hover:bg-red-100 lg:text-[10px]"
                  >
                    Review all disputes
                  </Link>
                </div>
              </Panel>
            )}

            <Panel title="Recent order activity" action={<PanelLink href={MODULE_ROUTES.overview}>View all</PanelLink>} padded={false}>
              {activity.length === 0 ? (
                <p className="p-5 text-xs text-slate-500 lg:text-[10px]">Order events will appear here.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {activity.map(entry => (
                    <li key={entry.id} className="flex items-start gap-2 px-4 py-2.5 lg:px-3 lg:py-1.5">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 lg:h-5 lg:w-5">
                        <Activity size={11} />
                      </span>
                      <div className="min-w-0 flex-1">
                        {entry.href
                          ? <Link href={entry.href} className="line-clamp-2 text-xs text-slate-700 hover:text-blue-700 lg:text-[9.5px] lg:leading-tight">{entry.summary}</Link>
                          : <p className="line-clamp-2 text-xs text-slate-700 lg:text-[9.5px] lg:leading-tight">{entry.summary}</p>}
                        <p className="mt-0.5 text-[11px] text-slate-400 lg:text-[8.5px]">{formatRelative(entry.created_at)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>

        <div className="space-y-4">
          <Panel title="Order summary" action={<PanelLink href="/app/analytics">View report</PanelLink>}>
            <dl className="space-y-2.5 text-xs lg:text-[10px]">
              {[
                ['Total order value', money(insights.summary.totalValueCents)],
                ['Avg. order value', money(insights.summary.avgValueCents)],
                ['Orders this month', String(insights.summary.ordersThisMonth)],
                ['Repeat orders', `${insights.summary.repeatOrders} (${insights.summary.repeatPct}%)`],
                ['On-time delivery', percent(insights.summary.onTimePct, 1)],
                ['Supplier response time', responseTime(insights.summary.responseMinutes)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-semibold text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          {session.capabilities.viewEscrow && (
            <Panel title="Escrow balance" action={<PanelLink href={`${PATH}?escrow=in_escrow`}>View details</PanelLink>}>
              <dl className="space-y-2.5 text-xs lg:text-[10px]">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Total escrow</dt>
                  <dd className="font-semibold text-slate-900">{money(insights.escrow.fundsCents + insights.escrow.holdCents)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">In escrow</dt>
                  <dd className="font-semibold text-slate-900">{money(insights.escrow.fundsCents)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Pending release</dt>
                  <dd className="font-semibold text-slate-900">{money(insights.escrow.pendingReleaseCents)}</dd>
                </div>
              </dl>
              <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-[11px] leading-snug text-slate-500 lg:text-[9px]">
                Escrow releases are recorded in the ledger with an idempotency key and reconciled by the payment
                provider webhook. Connect Stripe Connect in Billing to enable live settlement.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </MarketplacePage>
  )
}
