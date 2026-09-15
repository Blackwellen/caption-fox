import Link from 'next/link'
import {
  Users, FileText, ShoppingCart, Wallet, Bookmark, ShieldAlert,
  Activity, GitCompareArrows, Plus, ArrowRight, Handshake,
} from 'lucide-react'
import { requireMarketplaceModule } from '@/lib/marketplace/server'
import { parseMarketplaceQuery, type RawParams } from '@/lib/marketplace/query'
import {
  MODULE_ROUTES, POPULAR_SEARCHES, REQUEST_STATUS_META, ESCROW_META, DELIVERY_META,
  compactNumber, money, percent, responseTime, startingPrice, turnaround, deadlineState,
} from '@/lib/marketplace/module'
import {
  searchProfiles, getCategories, getSavedSupplierIds, getShortlistIds,
  getProfilesByIds, getActivity, getOrders, getOrderInsights, getOverviewKpis, getRequests,
} from '@/lib/marketplace/data'
import { MarketplacePage, AccessBlocked } from '@/components/marketplace/module/Layout'
import SearchHero from '@/components/marketplace/module/SearchHero'
import { discoverFilters } from '@/components/marketplace/module/filters'
import { SupplierCard, type CardContext } from '@/components/marketplace/module/ProfileCards'
import {
  Panel, PanelLink, StatTile, ProfileAvatar, StatusPill, Rating,
} from '@/components/marketplace/module/primitives'
import { formatRelative, formatDate } from '@/lib/utils'

export const metadata = { title: 'Marketplace Overview · Caption Fox' }

const PATH = MODULE_ROUTES.overview

export default async function MarketplaceOverviewPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const session = await requireMarketplaceModule('overview')
  if (!session.access.allowed) {
    return (
      <MarketplacePage
        module="overview" modules={session.modules}
        title="Marketplace Overview" subtitle="Discover trusted suppliers, place orders, and grow your content ecosystem."
      >
        <AccessBlocked access={session.access} title="Marketplace is not available" />
      </MarketplacePage>
    )
  }

  const params = await searchParams
  const query = parseMarketplaceQuery(params, { views: ['cards'], defaultView: 'cards' })

  const [categories, featured, savedIds, shortlistIds, activity, insights] = await Promise.all([
    getCategories(session.supabase),
    searchProfiles(session.supabase, { ...query, sort: 'rating' }, { limit: 6 }),
    getSavedSupplierIds(session),
    getShortlistIds(session),
    getActivity(session, 5),
    getOrderInsights(session),
  ])

  const [kpis, requests, orders, compareProfiles] = await Promise.all([
    getOverviewKpis(session, insights),
    session.capabilities.viewRequests
      ? getRequests(session, { ...query, size: 4, page: 1 })
      : Promise.resolve({ rows: [], total: 0, kpis: { open: 0, responses: 0, awaiting: 0, shortlisted: 0, closed_won: 0, closed_cancelled: 0 } }),
    session.capabilities.viewOrders
      ? getOrders(session, query, 5)
      : Promise.resolve({ rows: [], total: 0 }),
    getProfilesByIds(session.supabase, query.compare),
  ])

  const ctx: CardContext = {
    query, pathname: PATH,
    savedIds: new Set(savedIds),
    shortlistIds: new Set(shortlistIds),
    canSave: session.capabilities.save,
    canCompare: session.capabilities.compare,
    compareLimit: session.capabilities.compareLimit,
  }

  const recommended = featured.rows.slice(3, 6)

  return (
    <MarketplacePage
      module="overview" modules={session.modules}
      title="Marketplace Overview"
      subtitle="Discover trusted suppliers, place orders, and grow your content ecosystem."
    >
      <SearchHero
        title="Find the perfect supplier for your next project"
        subtitle={`Search across ${compactNumber(kpis.activeSuppliers)} verified suppliers and creators worldwide.`}
        placeholder='Try "YouTube thumbnails", "Explainer video", or "Technical writing"'
        query={query} pathname={MODULE_ROUTES.discover} mode="overview" resultCount={kpis.activeSuppliers}
        filters={discoverFilters(categories)}
        popular={POPULAR_SEARCHES.overview}
        canSaveSearch={session.capabilities.search}
        aside={
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {featured.rows.slice(0, 5).map(profile => (
                <ProfileAvatar key={profile.id} profile={profile} size={32} />
              ))}
            </div>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
              {compactNumber(kpis.activeSuppliers)}
            </span>
            <span className="text-xs text-blue-100">Active suppliers</span>
          </div>
        }
      />

      {/* KPI strip — every value is calculated from live workspace data. */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6" aria-label="Marketplace summary">
        <StatTile icon={<Users size={17} />} label="Active suppliers" value={kpis.activeSuppliers.toLocaleString('en-GB')} tone="blue" />
        <StatTile icon={<FileText size={17} />} label="Open requests" value={kpis.openRequests.toLocaleString('en-GB')} tone="violet" />
        <StatTile icon={<ShoppingCart size={17} />} label="Orders in progress" value={kpis.ordersInProgress.toLocaleString('en-GB')} tone="amber" />
        <StatTile icon={<Wallet size={17} />} label="Escrow value" value={money(kpis.escrowValueCents, 'GBP', { compact: true })} tone="emerald" />
        <StatTile icon={<Bookmark size={17} />} label="Saved partners" value={kpis.savedPartners.toLocaleString('en-GB')} tone="blue" />
        <StatTile icon={<ShieldAlert size={17} />} label="Disputes to review" value={kpis.disputes.toLocaleString('en-GB')} tone={kpis.disputes > 0 ? 'red' : 'slate'} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              title="Featured suppliers" subtitle="Hand-picked top performers"
              action={<PanelLink href={MODULE_ROUTES.discover}>View all</PanelLink>}
              padded={false}
            >
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
                {featured.rows.slice(0, 2).map(profile => (
                  <SupplierCard key={profile.id} profile={profile} ctx={ctx} compact />
                ))}
              </div>
            </Panel>

            <Panel
              title="Compare suppliers"
              subtitle={`Compare up to ${session.capabilities.compareLimit} suppliers`}
              action={query.compare.length > 0
                ? <PanelLink href={PATH}>Clear all</PanelLink>
                : undefined}
              padded={false}
            >
              {compareProfiles.length === 0 ? (
                <div className="p-5">
                  <p className="text-xs text-slate-500">
                    Select suppliers from Discover to compare rating, minimum order, turnaround, location,
                    response time and on-time delivery side by side.
                  </p>
                  <Link
                    href={MODULE_ROUTES.discover}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <GitCompareArrows size={14} />Start comparing
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-xs">
                    <caption className="sr-only">Supplier comparison</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="w-28 px-4 py-2 text-left font-medium text-slate-400">Metric</th>
                        {compareProfiles.map(profile => (
                          <th key={profile.id} scope="col" className="px-3 py-2 text-left">
                            <span className="flex items-center gap-1.5">
                              <ProfileAvatar profile={profile} size={22} />
                              <span className="truncate font-semibold text-slate-800">{profile.display_name}</span>
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        { label: 'Rating', get: (p: typeof compareProfiles[number]) => Number(p.rating).toFixed(1) },
                        { label: 'Min. order', get: (p: typeof compareProfiles[number]) => money(p.min_order_cents, p.currency) },
                        { label: 'Turnaround', get: (p: typeof compareProfiles[number]) => turnaround(p.turnaround_hours) },
                        { label: 'Location', get: (p: typeof compareProfiles[number]) => p.location ?? '—' },
                        { label: 'Response time', get: (p: typeof compareProfiles[number]) => responseTime(p.response_time_minutes) },
                        { label: 'On-time delivery', get: (p: typeof compareProfiles[number]) => percent(p.on_time_delivery_pct) },
                      ].map(row => (
                        <tr key={row.label}>
                          <th scope="row" className="px-4 py-2 text-left font-normal text-slate-500">{row.label}</th>
                          {compareProfiles.map(profile => (
                            <td key={profile.id} className="px-3 py-2 font-medium text-slate-800">{row.get(profile)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex gap-2 p-4">
                    <Link
                      href={`/app/marketplace/compare?ids=${query.compare.join(',')}`}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      View full comparison
                    </Link>
                    <Link
                      href={MODULE_ROUTES.discover}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Plus size={13} />Add another supplier
                    </Link>
                  </div>
                </div>
              )}
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              title="Buyer requests" subtitle="Latest supplier requests"
              action={<PanelLink href={MODULE_ROUTES.requests}>View all</PanelLink>}
              padded={false}
            >
              {!session.capabilities.viewRequests ? (
                <p className="p-5 text-xs text-slate-500">Your role does not include access to marketplace requests.</p>
              ) : requests.rows.length === 0 ? (
                <p className="p-5 text-xs text-slate-500">No requests yet. Create one to collect scoped proposals from suppliers.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[460px] text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                      <tr>
                        <th scope="col" className="px-4 py-2 text-left font-semibold">Request</th>
                        <th scope="col" className="px-3 py-2 text-left font-semibold">Category</th>
                        <th scope="col" className="px-3 py-2 text-left font-semibold">Budget</th>
                        <th scope="col" className="px-3 py-2 text-left font-semibold">Responses</th>
                        <th scope="col" className="px-3 py-2 text-left font-semibold">Deadline</th>
                        <th scope="col" className="px-4 py-2 text-left font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {requests.rows.map(request => {
                        const meta = REQUEST_STATUS_META[request.status]
                        const due = deadlineState(request.deadline)
                        return (
                          <tr key={request.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5">
                              <Link href={`${MODULE_ROUTES.requests}?q=${request.reference}`} className="font-medium text-slate-800 hover:text-blue-700">
                                {request.title}
                              </Link>
                            </td>
                            <td className="px-3 py-2.5 text-slate-500">{request.category ?? '—'}</td>
                            <td className="px-3 py-2.5 text-slate-600">
                              {money(request.budget_min_cents)} – {money(request.budget_max_cents)}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600">{request.response_count}</td>
                            <td className="px-3 py-2.5 text-slate-500">
                              {request.deadline ? formatDate(request.deadline) : '—'}
                              <span className={due.tone === 'danger' ? ' text-red-600' : due.tone === 'warn' ? ' text-amber-600' : ''}> </span>
                            </td>
                            <td className="px-4 py-2.5"><StatusPill label={meta.label} cls={meta.cls} /></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel
              title="Recent orders" subtitle="Your latest marketplace orders"
              action={<PanelLink href={MODULE_ROUTES.orders}>View all</PanelLink>}
              padded={false}
            >
              {!session.capabilities.viewOrders ? (
                <p className="p-5 text-xs text-slate-500">Your role does not include access to marketplace orders.</p>
              ) : orders.rows.length === 0 ? (
                <p className="p-5 text-xs text-slate-500">No orders yet. Accept a proposal or order a package to get started.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[440px] text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                      <tr>
                        <th scope="col" className="px-4 py-2 text-left font-semibold">Order</th>
                        <th scope="col" className="px-3 py-2 text-left font-semibold">Supplier</th>
                        <th scope="col" className="px-3 py-2 text-left font-semibold">Amount</th>
                        <th scope="col" className="px-3 py-2 text-left font-semibold">Status</th>
                        <th scope="col" className="px-4 py-2 text-left font-semibold">Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.rows.map(order => {
                        const meta = DELIVERY_META[order.delivery_status]
                        return (
                          <tr key={order.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5">
                              <Link href={`${MODULE_ROUTES.orders}?q=${order.reference}`} className="font-medium text-blue-600 hover:text-blue-700">
                                {order.reference}
                              </Link>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="flex items-center gap-1.5">
                                {order.supplier && <ProfileAvatar profile={order.supplier} size={20} />}
                                <span className="truncate text-slate-700">{order.supplier?.display_name ?? '—'}</span>
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-medium text-slate-800">{money(order.amount_cents, order.currency)}</td>
                            <td className="px-3 py-2.5"><StatusPill label={meta.label} cls={meta.cls} dot={meta.dot} /></td>
                            <td className="px-4 py-2.5 text-slate-500">{order.due_date ? formatDate(order.due_date) : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Panel
              title="Category spotlight" subtitle="Explore top performing categories"
              action={<PanelLink href={MODULE_ROUTES.categories}>View all categories</PanelLink>}
              padded={false}
            >
              <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3 xl:grid-cols-6">
                {categories.slice(0, 6).map(category => (
                  <Link
                    key={category.id}
                    href={`${MODULE_ROUTES.discover}?category=${category.slug}`}
                    className="bg-white p-3 text-center transition hover:bg-slate-50"
                  >
                    <span className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-blue-600">
                      {category.name.slice(0, 2).toUpperCase()}
                    </span>
                    <p className="truncate text-xs font-semibold text-slate-800">{category.name}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">{category.supplier_count} suppliers</p>
                  </Link>
                ))}
              </div>
            </Panel>

            <Panel
              title="Recommended for you" subtitle="Based on your saved partners and categories"
              action={<PanelLink href={MODULE_ROUTES.discover}>View all</PanelLink>}
              padded={false}
            >
              <ul className="divide-y divide-slate-100">
                {recommended.map(profile => (
                  <li key={profile.id}>
                    <Link
                      href={`/app/marketplace/suppliers/${profile.slug}`}
                      className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50"
                    >
                      <ProfileAvatar profile={profile} size={30} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-800">{profile.display_name}</p>
                        <Rating value={profile.rating} count={profile.reviews_count} />
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-slate-700">{startingPrice(profile)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>

        {/* Right rail: activity timeline and quick actions. */}
        <div className="space-y-4">
          <Panel
            title="Activity timeline"
            action={<PanelLink href={MODULE_ROUTES.orders}>View all</PanelLink>}
            padded={false}
          >
            {activity.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">Marketplace events appear here as you save partners, post requests and place orders.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activity.map(entry => (
                  <li key={entry.id} className="flex items-start gap-2.5 px-4 py-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Activity size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      {entry.href
                        ? <Link href={entry.href} className="text-xs font-medium text-slate-800 hover:text-blue-700">{entry.summary}</Link>
                        : <p className="text-xs font-medium text-slate-800">{entry.summary}</p>}
                      <p className="mt-0.5 text-[11px] text-slate-400">{formatRelative(entry.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 p-5 text-white">
            <Handshake size={20} className="mb-2" />
            <h3 className="text-sm font-semibold">Grow with trusted partners</h3>
            <p className="mt-1 text-xs text-blue-100">
              Build long-term relationships with verified top performers.
            </p>
            <Link
              href={MODULE_ROUTES.discover}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
            >
              Browse verified partners<ArrowRight size={13} />
            </Link>
          </div>

          <Panel title="Quick actions" padded={false}>
            <ul className="divide-y divide-slate-100">
              {[
                {
                  href: MODULE_ROUTES.requests, icon: <Plus size={15} />, title: 'Create request',
                  note: 'Get proposals from suppliers', show: session.capabilities.createRequest,
                },
                {
                  href: MODULE_ROUTES.discover, icon: <GitCompareArrows size={15} />, title: 'Compare suppliers',
                  note: `Compare up to ${session.capabilities.compareLimit} suppliers`, show: session.capabilities.compare,
                },
                {
                  href: MODULE_ROUTES.saved, icon: <Bookmark size={15} />, title: 'View saved',
                  note: `Browse your ${kpis.savedPartners} saved partners`, show: session.capabilities.save,
                },
                {
                  href: `${MODULE_ROUTES.orders}?status=disputed`, icon: <ShieldAlert size={15} />, title: 'Review disputes',
                  note: kpis.disputes > 0 ? `${kpis.disputes} dispute${kpis.disputes === 1 ? '' : 's'} need attention` : 'No open disputes',
                  show: session.capabilities.viewDisputes,
                },
              ].filter(action => action.show).map(action => (
                <li key={action.title}>
                  <Link href={action.href} className="flex items-center gap-2.5 px-4 py-3 hover:bg-slate-50">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      {action.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-blue-700">{action.title}</p>
                      <p className="truncate text-[11px] text-slate-500">{action.note}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </MarketplacePage>
  )
}
