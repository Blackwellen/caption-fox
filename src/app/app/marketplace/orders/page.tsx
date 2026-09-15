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
import { Panel, PanelLink, StatTile, ProfileAvatar, StatusPill } from '@/components/marketplace/module/primitives'
import { Pagination, PageSizeSelect, FilterChips } from '@/components/marketplace/module/Controls'
import { OrderActions, ExportOrders } from '@/components/marketplace/module/OrdersClient'
import { formatDate, formatRelative, cn } from '@/lib/utils'

export const metadata = { title: 'Marketplace Orders · Caption Fox' }

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
    getActivity(session, 6),
    getCategories(session.supabase),
  ])

  const first = (query.page - 1) * query.size + 1
  const last = Math.min(query.page * query.size, total)
  const trackerColours: Record<string, string> = {
    in_progress: 'bg-blue-500', pending_delivery: 'bg-amber-500',
    pending_review: 'bg-violet-500', delivered: 'bg-emerald-500', overdue: 'bg-red-500',
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
        filters={orderFilters(categories)}
        canSaveSearch={session.capabilities.search}
        extraRow={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-blue-100">Quick filters:</span>
            {QUICK_FILTERS.map(filter => (
              <Link
                key={filter.label}
                href={buildMarketplaceHref(PATH, query, filter.patch)}
                className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/25"
              >
                {filter.label}
              </Link>
            ))}
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6" aria-label="Order summary">
        <StatTile icon={<ShoppingCart size={17} />} label="Active orders" value={String(insights.kpis.active)} tone="blue" />
        <StatTile icon={<Wallet size={17} />} label="In escrow" value={money(insights.kpis.inEscrowCents, 'GBP', { compact: true })} tone="violet" />
        <StatTile icon={<Truck size={17} />} label="Pending delivery" value={String(insights.kpis.pendingDelivery)} tone="amber" />
        <StatTile icon={<ClipboardCheck size={17} />} label="Pending review" value={String(insights.kpis.pendingReview)} tone="amber" />
        <StatTile icon={<CheckCircle2 size={17} />} label="Completed" value={String(insights.kpis.completed)} tone="emerald" />
        <StatTile icon={<ShieldAlert size={17} />} label="Disputes" value={String(insights.kpis.disputes)} tone={insights.kpis.disputes > 0 ? 'red' : 'slate'} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <Panel
            title={`Orders (${total})`}
            subtitle={total > 0 ? `Showing ${first}–${last} of ${total} orders` : 'No orders match these filters'}
            action={
              <div className="flex items-center gap-2">
                <ExportOrders rows={rows} canExport={session.capabilities.export} />
                <PageSizeSelect query={query} pathname={PATH} />
              </div>
            }
            padded={false}
          >
            <div className="px-4 pt-3">
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
                  <Link href={MODULE_ROUTES.discover} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                    Find a supplier
                  </Link>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-xs">
                  <caption className="sr-only">Marketplace orders</caption>
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 text-left font-semibold">Order ID</th>
                      <th scope="col" className="px-3 py-2.5 text-left font-semibold">Supplier</th>
                      <th scope="col" className="px-3 py-2.5 text-left font-semibold">Category</th>
                      <th scope="col" className="px-3 py-2.5 text-left font-semibold">Amount</th>
                      <th scope="col" className="px-3 py-2.5 text-left font-semibold">Escrow status</th>
                      <th scope="col" className="px-3 py-2.5 text-left font-semibold">Delivery status</th>
                      <th scope="col" className="px-3 py-2.5 text-left font-semibold">Milestone</th>
                      <th scope="col" className="px-3 py-2.5 text-left font-semibold">Due date</th>
                      <th scope="col" className="px-3 py-2.5 text-left font-semibold">Dispute state</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map(order => {
                      const escrow = ESCROW_META[order.escrow_status]
                      const delivery = DELIVERY_META[order.delivery_status]
                      const due = deadlineState(order.due_date)
                      return (
                        <tr key={order.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5">
                            <Link href={`${PATH}?q=${order.reference}`} className="font-medium text-blue-600 hover:text-blue-700">
                              {order.reference}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="flex items-center gap-1.5">
                              {order.supplier && <ProfileAvatar profile={order.supplier} size={22} />}
                              <span className="truncate text-slate-700">{order.supplier?.display_name ?? '—'}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">{order.category ?? '—'}</td>
                          <td className="px-3 py-2.5 font-medium text-slate-800">{money(order.amount_cents, order.currency)}</td>
                          <td className="px-3 py-2.5"><StatusPill label={escrow.label} cls={escrow.cls} dot={escrow.dot} /></td>
                          <td className="px-3 py-2.5"><StatusPill label={delivery.label} cls={delivery.cls} dot={delivery.dot} /></td>
                          <td className="px-3 py-2.5 text-slate-600">{order.current_milestone ?? '—'}</td>
                          <td className="px-3 py-2.5">
                            <span className="text-slate-600">{order.due_date ? formatDate(order.due_date) : '—'}</span>
                            <span className={cn('ml-1 rounded px-1 text-[10px] font-medium',
                              due.tone === 'danger' ? 'bg-red-50 text-red-600'
                                : due.tone === 'warn' ? 'bg-amber-50 text-amber-600' : 'text-slate-400')}>
                              {due.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {order.dispute_state
                              ? <StatusPill label={order.dispute_state.replace(/_/g, ' ')} cls="text-red-700 bg-red-50" />
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5">
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

          <div className="grid gap-5 lg:grid-cols-3">
            {session.capabilities.viewEscrow && (
              <Panel title="Escrow management" action={<PanelLink href={`${PATH}?escrow=in_escrow`}>View all</PanelLink>}>
                <dl className="space-y-2.5 text-xs">
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
                  className="mt-4 block rounded-lg border border-slate-200 px-3 py-2 text-center text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Manage escrow
                </Link>
              </Panel>
            )}

            <Panel title="Milestone and delivery tracker" action={<PanelLink href={PATH}>View all</PanelLink>}>
              <p className="text-2xl font-bold tracking-tight text-slate-900">{insights.totalOrders}</p>
              <p className="text-[11px] text-slate-400">Total orders</p>
              <ul className="mt-3 space-y-2">
                {insights.tracker.map(entry => (
                  <li key={entry.key}>
                    <Link
                      href={buildMarketplaceHref(PATH, query, entry.key === 'overdue' ? {} : { delivery: entry.key })}
                      className="flex items-center gap-2 text-xs hover:text-blue-700"
                    >
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', trackerColours[entry.key])} />
                      <span className="min-w-0 flex-1 truncate text-slate-600">{entry.label}</span>
                      <span className="shrink-0 font-semibold text-slate-900">{entry.count}</span>
                      <span className="w-11 shrink-0 text-right text-[11px] text-slate-400">{entry.pct}%</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>

            {session.capabilities.viewDisputes && (
              <Panel title="Disputes needing attention" action={<PanelLink href={`${PATH}?status=disputed`}>View all</PanelLink>} padded={false}>
                {disputes.length === 0 ? (
                  <p className="p-5 text-xs text-slate-500">No open disputes. Escrow releases can proceed normally.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {disputes.map(dispute => (
                      <li key={dispute.id} className="px-4 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <Link href={`${PATH}?q=${dispute.order?.reference ?? ''}`} className="text-xs font-semibold text-red-600 hover:text-red-700">
                            {dispute.order?.reference ?? 'Order'}
                          </Link>
                          <span className="shrink-0 text-[11px] font-medium text-slate-700">{money(dispute.amount_cents)}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">{dispute.supplier_name}</p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] text-slate-400">{dispute.reason}</span>
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
                    className="block rounded-lg bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    Review all disputes
                  </Link>
                </div>
              </Panel>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Panel title="Order summary" action={<PanelLink href="/app/analytics">View report</PanelLink>}>
            <dl className="space-y-2.5 text-xs">
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
              <dl className="space-y-2.5 text-xs">
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
              <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-[11px] leading-snug text-slate-500">
                Escrow releases are recorded in the ledger with an idempotency key and reconciled by the payment
                provider webhook. Connect Stripe Connect in Billing to enable live settlement.
              </p>
            </Panel>
          )}

          <Panel title="Recent order activity" action={<PanelLink href={MODULE_ROUTES.overview}>View all</PanelLink>} padded={false}>
            {activity.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">Order events will appear here.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activity.map(entry => (
                  <li key={entry.id} className="flex items-start gap-2.5 px-4 py-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                      <Activity size={12} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-700">{entry.summary}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{formatRelative(entry.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </MarketplacePage>
  )
}
