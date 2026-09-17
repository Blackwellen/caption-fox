import Link from 'next/link'
import {
  Users, FileText, ShoppingCart, Wallet, Bookmark, ShieldAlert,
  Activity, GitCompareArrows, Plus, ArrowRight, Handshake,
  CheckCircle2, MessageSquare, Search,
} from 'lucide-react'
import { requireMarketplaceModule } from '@/lib/marketplace/server'
import { parseMarketplaceQuery, type RawParams } from '@/lib/marketplace/query'
import {
  MODULE_ROUTES, POPULAR_SEARCHES, REQUEST_STATUS_META, DELIVERY_META,
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
  Panel, PanelLink, StatTile, KpiStrip, ProfileAvatar, StatusPill, Rating,
} from '@/components/marketplace/module/primitives'
import CategoryIcon from '@/components/marketplace/module/CategoryIcon'
import { CarouselArrows } from '@/components/marketplace/module/Controls'
import { formatRelative, cn } from '@/lib/utils'

export const metadata = { title: 'Marketplace Overview · Caption Fox' }

/** A KPI delta is only rendered when a real prior period exists to compare. */
function pctDelta(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return undefined
  return { value: `${Math.abs(value).toFixed(1)}%`, up: value >= 0 }
}

/** Activity icon and tone per event type, so the feed scans like the reference. */
const ACTIVITY_ICONS: Record<string, { icon: typeof Activity; cls: string }> = {
  'order.created': { icon: ShoppingCart, cls: 'bg-blue-600 text-white' },
  'order.completed': { icon: CheckCircle2, cls: 'bg-emerald-500 text-white' },
  'proposal.received': { icon: MessageSquare, cls: 'bg-violet-600 text-white' },
  'request.created': { icon: FileText, cls: 'bg-amber-500 text-white' },
  'supplier.saved': { icon: Bookmark, cls: 'bg-blue-600 text-white' },
  'search.saved': { icon: Search, cls: 'bg-slate-500 text-white' },
  'dispute.opened': { icon: ShieldAlert, cls: 'bg-red-600 text-white' },
}

/** Compact tables use the shorter status wording the reference pills show. */
const SHORT_REQUEST_STATUS: Record<string, string> = {
  awaiting_proposals: 'Awaiting', closed_won: 'Won', closed_cancelled: 'Cancelled',
}
const SHORT_DELIVERY_STATUS: Record<string, string> = {
  pending_delivery: 'Pending', pending_review: 'In review', not_started: 'Not started',
}

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
    searchProfiles(session.supabase, { ...query, sort: 'rating' }, { limit: 7 }),
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

  const recommended = featured.rows.slice(3, 7)

  // With nothing selected the panel compares the three featured suppliers, as
  // the reference does, instead of sitting empty. It is labelled as such and
  // the user's own selection replaces it as soon as one exists.
  const comparingDefault = compareProfiles.length === 0
  const comparing = comparingDefault
    ? featured.rows.slice(0, Math.min(3, session.capabilities.compareLimit))
    : compareProfiles
  const compareIds = comparing.map(profile => profile.id)
  const shortDate = (value: string) =>
    new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })

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
        canSearch={false}
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

      <div className="grid gap-5 lg:gap-3 xl:grid-cols-[minmax(0,1fr)_238px]">
        <div className="min-w-0 space-y-5 lg:space-y-3">
          {/* KPI strip — every value is calculated from live workspace data. */}
          <KpiStrip columns={5} className="lg:[&>*]:!h-[64px]">
            <StatTile cell icon={<Users size={17} />} label="Active suppliers" value={kpis.activeSuppliers.toLocaleString('en-GB')} tone="blue" delta={pctDelta(kpis.deltas.activeSuppliers)} />
            <StatTile cell icon={<FileText size={17} />} label="Open requests" value={kpis.openRequests.toLocaleString('en-GB')} tone="violet" delta={pctDelta(kpis.deltas.openRequests)} />
            <StatTile cell icon={<ShoppingCart size={17} />} label="Orders in progress" value={kpis.ordersInProgress.toLocaleString('en-GB')} tone="amber" delta={pctDelta(kpis.deltas.ordersInProgress)} />
            <StatTile cell icon={<Wallet size={17} />} label="Escrow value" value={money(kpis.escrowValueCents, 'GBP', { compact: true })} tone="emerald" />
            <StatTile cell icon={<Bookmark size={17} />} label="Saved partners" value={kpis.savedPartners.toLocaleString('en-GB')} tone="blue" delta={pctDelta(kpis.deltas.savedPartners)} />
          </KpiStrip>

          <div className="grid gap-5 lg:gap-3 lg:grid-cols-2">
            <Panel
              title="Featured suppliers" subtitle="Hand-picked top performers"
              action={featured.rows.length > 3
                ? <CarouselArrows targetId="featured-suppliers" label="Featured suppliers" />
                : <PanelLink href={MODULE_ROUTES.discover}>View all</PanelLink>}
              padded={false}
            >
              {/* Reference: three cards at a time, paged with the header arrows. */}
              <div
                id="featured-suppliers"
                className="flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto scroll-smooth p-4 [scrollbar-width:none] lg:scroll-px-3 lg:gap-2.5 lg:px-3 lg:pb-2.5 lg:pt-1 [&::-webkit-scrollbar]:hidden [&>*]:w-[calc((100%-1.5rem)/2)] [&>*]:shrink-0 [&>*]:snap-start lg:[&>*]:w-[calc((100%-1.25rem)/3)]"
              >
                {featured.rows.map(profile => (
                  <SupplierCard key={profile.id} profile={profile} ctx={ctx} compact />
                ))}
              </div>
            </Panel>

            <Panel
              title="Compare suppliers"
              subtitle={comparingDefault
                ? 'Featured suppliers side by side'
                : `Comparing ${comparing.length} of up to ${session.capabilities.compareLimit} suppliers`}
              action={query.compare.length > 0
                ? <PanelLink href={PATH}>Clear all</PanelLink>
                : undefined}
              padded={false}
            >
              {comparing.length === 0 ? (
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
                  <table className="w-full min-w-[420px] table-fixed text-xs lg:min-w-0 lg:text-[9.5px]">
                    <caption className="sr-only">Supplier comparison</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="w-28 px-4 py-2 text-left font-medium text-slate-400 lg:w-[78px] lg:px-3"><span className="sr-only">Metric</span></th>
                        {comparing.map(profile => (
                          <th key={profile.id} scope="col" className="px-2 py-2 text-center lg:px-1 lg:py-0.5">
                            <span className="flex flex-col items-center gap-1 lg:gap-0.5 [&>span:first-child]:lg:!h-4 [&>span:first-child]:lg:!w-4">
                              <ProfileAvatar profile={profile} size={20} />
                              <span className="w-full truncate font-semibold text-slate-800 lg:text-[9px]">{profile.display_name}</span>
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {[
                        { label: 'Rating', get: (p: typeof comparing[number]) => Number(p.rating).toFixed(1) },
                        { label: 'Min. order', get: (p: typeof comparing[number]) => money(p.min_order_cents, p.currency) },
                        { label: 'Turnaround', get: (p: typeof comparing[number]) => turnaround(p.turnaround_hours) },
                        { label: 'Location', get: (p: typeof comparing[number]) => p.location ?? '—' },
                        { label: 'Response', get: (p: typeof comparing[number]) => responseTime(p.response_time_minutes) },
                        { label: 'On-time', get: (p: typeof comparing[number]) => percent(p.on_time_delivery_pct) },
                      ].map(row => (
                        <tr key={row.label}>
                          <th scope="row" className="whitespace-nowrap px-4 py-2 text-left font-normal text-slate-500 lg:px-3 lg:py-[2px] lg:text-[9px]">{row.label}</th>
                          {comparing.map(profile => (
                            <td key={profile.id} className="truncate px-2 py-2 text-center font-medium text-slate-800 lg:px-1 lg:py-[2px] lg:text-[9px]">{row.get(profile)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex gap-2 p-4 lg:px-3 lg:py-1">
                    <Link
                      href={`/app/marketplace/compare?ids=${compareIds.join(',')}`}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 lg:py-1 lg:text-[10px]"
                    >
                      View full comparison
                    </Link>
                    <Link
                      href={MODULE_ROUTES.discover}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-slate-50 lg:py-1 lg:text-[10px]"
                    >
                      <Plus size={13} />Add another supplier
                    </Link>
                  </div>
                </div>
              )}
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 lg:gap-3 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_170px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_170px]">
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
                <div className="overflow-x-auto lg:overflow-x-visible">
                  <table className="w-full min-w-[460px] text-xs lg:min-w-0 lg:table-fixed lg:text-[9px]">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400 lg:text-[8px]">
                      <tr>
                        <th scope="col" className="px-4 py-2 text-left font-semibold lg:px-1.5 lg:py-0.5 lg:w-[28%]">Request</th>
                        <th scope="col" className="px-3 py-2 text-left font-semibold lg:px-1.5 lg:py-0.5 lg:w-[19%]">Category</th>
                        <th scope="col" className="px-3 py-2 text-left font-semibold lg:px-1.5 lg:py-0.5 lg:w-[15%]">Budget</th>
                        <th scope="col" className="px-3 py-2 text-left font-semibold lg:px-1.5 lg:py-0.5 lg:w-[8%]">Resp.</th>
                        <th scope="col" className="px-3 py-2 text-left font-semibold lg:px-1.5 lg:py-0.5 lg:w-[12%]">Deadline</th>
                        <th scope="col" className="px-4 py-2 text-left font-semibold lg:px-1.5 lg:py-0.5 lg:w-[18%]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {requests.rows.map(request => {
                        const meta = REQUEST_STATUS_META[request.status]
                        const due = deadlineState(request.deadline)
                        return (
                          <tr key={request.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 lg:px-3 lg:py-[3px]">
                              <Link href={`${MODULE_ROUTES.requests}?q=${request.reference}`} className="block max-w-[150px] truncate font-medium text-slate-800 hover:text-blue-700 lg:max-w-none">
                                {request.title}
                              </Link>
                            </td>
                            <td className="truncate whitespace-nowrap px-3 py-2.5 text-slate-500 lg:px-1.5 lg:py-[3px]">{request.category ?? '—'}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 lg:px-1.5 lg:py-[3px]">
                              {money(request.budget_min_cents, 'GBP', { compact: true })}–{money(request.budget_max_cents, 'GBP', { compact: true })}
                            </td>
                            <td className="px-3 py-2.5 lg:px-1.5 lg:py-[3px] text-slate-600">{request.response_count}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-slate-500 lg:px-1.5 lg:py-[3px]">
                              <span className={due.tone === 'danger' ? 'text-red-600' : due.tone === 'warn' ? 'text-amber-600' : undefined}>
                                {request.deadline ? shortDate(request.deadline) : '—'}
                              </span>
                            </td>
                            <td className="overflow-hidden px-4 py-2.5 lg:px-1.5 lg:py-[3px]"><StatusPill label={SHORT_REQUEST_STATUS[request.status] ?? meta.label} cls={meta.cls} /></td>
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
                <div className="overflow-x-auto lg:overflow-x-visible">
                  <table className="w-full min-w-[440px] text-xs lg:min-w-0 lg:table-fixed lg:text-[9px]">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400 lg:text-[8px]">
                      <tr>
                        <th scope="col" className="px-4 py-2 text-left font-semibold lg:px-1.5 lg:py-0.5 lg:w-[18%]">Order</th>
                        <th scope="col" className="px-3 py-2 text-left font-semibold lg:px-1.5 lg:py-0.5 lg:w-[31%]">Supplier</th>
                        <th scope="col" className="px-3 py-2 text-left font-semibold lg:px-1.5 lg:py-0.5 lg:w-[14%]">Amount</th>
                        <th scope="col" className="px-3 py-2 text-left font-semibold lg:px-1.5 lg:py-0.5 lg:w-[22%]">Status</th>
                        <th scope="col" className="px-4 py-2 text-left font-semibold lg:px-1.5 lg:py-0.5 lg:w-[15%]">ETA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.rows.map(order => {
                        const meta = DELIVERY_META[order.delivery_status]
                        return (
                          <tr key={order.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 lg:px-3 lg:py-[3px]">
                              <Link href={`${MODULE_ROUTES.orders}?q=${order.reference}`} className="whitespace-nowrap font-medium text-blue-600 hover:text-blue-700">
                                {order.reference}
                              </Link>
                            </td>
                            <td className="px-3 py-2.5 lg:px-1.5 lg:py-[3px]">
                              <span className="flex items-center gap-1.5">
                                {order.supplier && <ProfileAvatar profile={order.supplier} size={16} />}
                                <span className="truncate text-slate-700">{order.supplier?.display_name ?? '—'}</span>
                              </span>
                            </td>
                            <td className="px-3 py-2.5 lg:px-1.5 lg:py-[3px] font-medium text-slate-800">{money(order.amount_cents, order.currency)}</td>
                            <td className="overflow-hidden px-3 py-2.5 lg:px-1.5 lg:py-[3px]"><StatusPill label={SHORT_DELIVERY_STATUS[order.delivery_status] ?? meta.label} cls={meta.cls} dot={meta.dot} /></td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-slate-500 lg:px-2 lg:py-[3px]">{order.due_date ? shortDate(order.due_date) : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
            <div className="flex flex-col rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 p-5 text-white lg:col-span-2 xl:col-span-1 lg:p-3.5">
              <Handshake size={20} className="mb-2 lg:h-4 lg:w-4" />
              <h3 className="text-sm font-semibold lg:text-[12px] lg:leading-4">Grow with trusted partners</h3>
              <p className="mt-1 text-xs text-blue-100 lg:text-[9.5px]">
                Build long-term relationships with verified top performers.
              </p>
              <Link
                href={MODULE_ROUTES.discover}
                className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 lg:px-2.5 lg:py-1 lg:text-[10px]"
              >
                Browse verified partners<ArrowRight size={12} />
              </Link>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 lg:gap-3">
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
                    className="bg-white p-3 text-center transition hover:bg-slate-50 lg:px-1.5 lg:py-1.5"
                  >
                    <span className="mx-auto mb-2 flex w-fit lg:mb-1.5">
                      <CategoryIcon icon={category.icon} accent={category.accent} />
                    </span>
                    <p className="truncate text-xs font-semibold text-slate-800 lg:text-[9.5px]">{category.name}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400 lg:text-[8.5px]">{category.supplier_count} suppliers</p>
                  </Link>
                ))}
              </div>
            </Panel>

            <Panel
              title="Recommended for you" subtitle="Based on your activity and preferences"
              action={<PanelLink href={MODULE_ROUTES.discover}>View all</PanelLink>}
              padded={false}
            >
              <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
                {recommended.map(profile => (
                  <Link
                    key={profile.id}
                    href={`/app/marketplace/suppliers/${profile.slug}`}
                    className="flex min-w-0 flex-col rounded-lg border border-slate-200 p-2.5 transition hover:border-slate-300 hover:bg-slate-50 lg:p-2"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <ProfileAvatar profile={profile} size={26} />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-slate-800 lg:text-[9.5px]">{profile.display_name}</span>
                        <Rating value={profile.rating} count={profile.reviews_count} />
                      </span>
                    </span>
                    <span className="mt-2 text-[11px] text-slate-500 lg:text-[9px]">
                      From <span className="font-semibold text-slate-800">{startingPrice(profile)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </Panel>
          </div>
        </div>

        {/* Right rail: activity timeline and quick actions. */}
        <div className="space-y-4 lg:space-y-3">
          <Panel
            title="Activity timeline"
            action={<PanelLink href={MODULE_ROUTES.orders}>View all</PanelLink>}
            padded={false}
          >
            {activity.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">Marketplace events appear here as you save partners, post requests and place orders.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activity.map(entry => {
                  const meta = ACTIVITY_ICONS[entry.event] ?? { icon: Activity, cls: 'bg-blue-50 text-blue-600' }
                  const Icon = meta.icon
                  return (
                  <li key={entry.id} className="flex items-start gap-2.5 px-4 py-3 lg:gap-2 lg:px-3 lg:py-2">
                    <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full lg:h-6 lg:w-6', meta.cls)}>
                      <Icon size={13} className="lg:h-3 lg:w-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      {entry.href
                        ? <Link href={entry.href} className="line-clamp-2 text-xs font-medium text-slate-800 hover:text-blue-700 lg:text-[10px] lg:leading-tight">{entry.summary}</Link>
                        : <p className="line-clamp-2 text-xs font-medium text-slate-800 lg:text-[10px] lg:leading-tight">{entry.summary}</p>}
                      <p className="mt-0.5 text-[11px] text-slate-400 lg:text-[9px]">{formatRelative(entry.created_at)}</p>
                    </div>
                  </li>
                  )
                })}
              </ul>
            )}
            <div className="px-4 pb-3 pt-1 lg:px-3 lg:pb-2.5">
              <Link
                href={MODULE_ROUTES.orders}
                className="flex w-full items-center justify-center rounded-lg border border-slate-200 py-2 text-xs font-medium text-blue-700 transition hover:bg-slate-50 lg:py-1.5 lg:text-[10px]"
              >
                View all activity
              </Link>
            </div>
          </Panel>

          <Panel title="Quick actions" padded={false}>
            <ul className="space-y-2 p-3 lg:space-y-1.5 lg:p-2.5">
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
                  <Link href={action.href} className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 transition hover:border-slate-300 hover:bg-slate-50 lg:gap-2 lg:px-2.5 lg:py-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 lg:h-7 lg:w-7 [&>svg]:lg:h-3.5 [&>svg]:lg:w-3.5">
                      {action.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-blue-700 lg:text-[10px]">{action.title}</p>
                      <p className="truncate text-[11px] text-slate-500 lg:text-[9px]">{action.note}</p>
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
