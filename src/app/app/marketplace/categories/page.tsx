import Link from 'next/link'
import { ArrowRight, Boxes, ShieldCheck, Star, TrendingUp, Activity, CreditCard, Headphones } from 'lucide-react'
import { requireMarketplaceModule } from '@/lib/marketplace/server'
import { parseMarketplaceQuery, type RawParams } from '@/lib/marketplace/query'
import {
  MODULE_ROUTES, POPULAR_SEARCHES, compactNumber, money, startingPrice,
} from '@/lib/marketplace/module'
import {
  getCategories, searchProfiles, getActivity,
} from '@/lib/marketplace/data'
import { MarketplacePage, AccessBlocked, NoResults } from '@/components/marketplace/module/Layout'
import SearchHero from '@/components/marketplace/module/SearchHero'
import { categoryFilters } from '@/components/marketplace/module/filters'
import { Panel, PanelLink, StatTile, ProfileCover, Rating, TrustStrip } from '@/components/marketplace/module/primitives'
import { ViewSwitcher, SortSelect } from '@/components/marketplace/module/Controls'
import CategoryIcon from '@/components/marketplace/module/CategoryIcon'
import { formatRelative } from '@/lib/utils'

export const metadata = { title: 'Marketplace Categories · Caption Fox' }

/** Card prices read as whole pounds; sub-pound per-word rates keep their pence. */
function wholePounds(cents: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP',
    maximumFractionDigits: cents < 100 ? 2 : 0,
  }).format(cents / 100)
}

const PATH = MODULE_ROUTES.categories

export default async function MarketplaceCategoriesPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const session = await requireMarketplaceModule('categories')
  if (!session.access.allowed) {
    return (
      <MarketplacePage
        module="categories" modules={session.modules}
        title="Marketplace Categories" subtitle="Discover the perfect category and connect with top-tier suppliers."
      >
        <AccessBlocked access={session.access} title="Categories are not available" />
      </MarketplacePage>
    )
  }

  const params = await searchParams
  const query = parseMarketplaceQuery(params, { views: ['grid', 'list'], defaultView: 'grid' })

  // This page shows no save/compare controls, so it does not fetch saved or
  // shortlist ids — that was two queries per load feeding nothing.
  const [categories, recommended, activity] = await Promise.all([
    getCategories(session.supabase),
    searchProfiles(session.supabase, { ...query, sort: 'rating' }, { limit: 4 }),
    getActivity(session, 4),
  ])

  const term = query.q.trim().toLowerCase()
  let visible = categories.filter(category =>
    !term || category.name.toLowerCase().includes(term) || (category.description ?? '').toLowerCase().includes(term))
  if (query.category) visible = visible.filter(category => category.slug === query.category)

  // Sorting mirrors the visible sort control; "popularity" is supplier volume.
  visible = [...visible].sort((a, b) => {
    if (query.sort === 'rating') return b.avg_rating - a.avg_rating
    if (query.sort === 'price_low') return (a.avg_price_cents || Infinity) - (b.avg_price_cents || Infinity)
    if (query.sort === 'price_high') return b.avg_price_cents - a.avg_price_cents
    return b.supplier_count - a.supplier_count
  })

  const totalSuppliers = categories.reduce((sum, category) => sum + category.supplier_count, 0)
  const totalProjects = categories.reduce((sum, category) => sum + category.projects_count, 0)
  const rated = categories.filter(category => category.avg_rating > 0)
  const avgRating = rated.length ? rated.reduce((sum, category) => sum + category.avg_rating, 0) / rated.length : 0
  const satisfaction = avgRating ? (avgRating / 5) * 100 : 0

  const topCategories = [...categories].sort((a, b) => b.projects_count - a.projects_count).slice(0, 5)
  const trending = [...categories].sort((a, b) => b.avg_rating - a.avg_rating).slice(0, 5)
  const compareCategories = topCategories.slice(0, 3)

  return (
    <MarketplacePage
      module="categories" modules={session.modules}
      title="Marketplace Categories"
      subtitle="Discover the perfect category and connect with top-tier suppliers."
    >
      <div className="grid gap-5 lg:gap-4 xl:grid-cols-[minmax(0,1fr)_250px]">
        <div className="min-w-0 space-y-5 lg:space-y-4">
          <SearchHero
            title="Find the perfect category for your next project"
            subtitle={`Explore ${categories.length} categories and ${compactNumber(totalSuppliers)} verified suppliers worldwide.`}
            placeholder="Search categories, skills, or services…"
            query={query} pathname={PATH} mode="categories" resultCount={visible.length}
            filters={categoryFilters(categories)}
            popular={POPULAR_SEARCHES.categories}
            canSaveSearch={session.capabilities.search}
            canSearch={false}
          />

          <Panel
            title="Browse categories" subtitle="Explore our most popular service categories"
            action={
              <div className="flex items-center gap-2">
                <ViewSwitcher query={query} pathname={PATH} views={['grid', 'list']} withLabels />
                <SortSelect
                  query={query} pathname={PATH}
                  options={[
                    { id: 'relevance', label: 'Popularity' },
                    { id: 'rating', label: 'Highest rated' },
                    { id: 'price_low', label: 'Lowest avg. price' },
                    { id: 'price_high', label: 'Highest avg. price' },
                  ]}
                />
              </div>
            }
            padded={false}
          >
            {visible.length === 0 ? (
              <NoResults
                title="No categories match that search"
                description="Try a broader term, or clear the category filter."
                action={<Link href={PATH} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Reset</Link>}
              />
            ) : query.view === 'list' ? (
              <ul className="divide-y divide-slate-100">
                {visible.map(category => (
                  <li key={category.id}>
                    <Link
                      href={`${MODULE_ROUTES.discover}?category=${category.slug}`}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50"
                    >
                      <CategoryIcon icon={category.icon} accent={category.accent} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{category.name}</p>
                        <p className="truncate text-xs text-slate-500">{category.description}</p>
                      </div>
                      <span className="hidden w-28 shrink-0 text-xs text-slate-500 sm:block">
                        {category.supplier_count.toLocaleString('en-GB')} suppliers
                      </span>
                      <span className="hidden w-24 shrink-0 text-xs text-slate-500 md:block">
                        {compactNumber(category.projects_count)} projects
                      </span>
                      <Rating value={category.avg_rating} />
                      <ArrowRight size={15} className="shrink-0 text-slate-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-2.5 lg:p-3 xl:grid-cols-5">
                {(visible.length > 10 ? visible.slice(0, 9) : visible).map(category => (
                  <Link
                    key={category.id}
                    href={`${MODULE_ROUTES.discover}?category=${category.slug}`}
                    className="group min-w-0 rounded-xl border border-slate-200 p-4 transition hover:border-blue-300 hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)] lg:p-2.5"
                  >
                    <div className="flex items-start gap-3 lg:gap-2">
                      <CategoryIcon icon={category.icon} accent={category.accent} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 lg:text-[11.5px]">{category.name}</p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500 lg:text-[9px] lg:leading-[1.25]">{category.description}</p>
                      </div>
                    </div>
                    <dl className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] lg:mt-2 lg:pt-2 lg:text-[9px]">
                      <div>
                        <dt className="sr-only">Suppliers</dt>
                        <dd className="font-medium text-slate-700">{category.supplier_count.toLocaleString('en-GB')} suppliers</dd>
                      </div>
                      <div>
                        <dt className="sr-only">Projects</dt>
                        <dd className="text-slate-500">{compactNumber(category.projects_count)} projects</dd>
                      </div>
                    </dl>
                    <div className="mt-2 flex items-center justify-between">
                      {/* A category nobody has joined yet has no rating to show — 0.0 would read as a bad score. */}
                      {category.supplier_count > 0
                        ? <Rating value={category.avg_rating} />
                        : <span className="text-[11px] text-slate-400 lg:text-[9px]">No suppliers yet</span>}
                      <span className="text-[11px] font-medium text-slate-500 lg:text-[9px]">
                        {category.avg_price_cents ? `from ${wholePounds(category.avg_price_cents)}` : '—'}
                      </span>
                    </div>
                  </Link>
                ))}
                {visible.length > 10 && (
                  // Reference: the grid closes with a tile into the full category list.
                  <Link
                    href={`${PATH}?view=list`}
                    className="flex min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 p-4 text-center transition hover:border-blue-300 hover:bg-blue-50/40 lg:gap-1.5 lg:p-2.5"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 lg:h-8 lg:w-8"><Boxes size={16} /></span>
                    <span className="text-sm font-semibold text-slate-900 lg:text-[11px]">More categories</span>
                    <span className="text-[11px] text-slate-500 lg:text-[9px]">{visible.length - 9} more specialised categories</span>
                    <span className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-blue-700 lg:text-[9.5px]">View all categories</span>
                  </Link>
                )}
              </div>
            )}
          </Panel>
        </div>


        <div className="space-y-4">
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] [&>*]:lg:!h-[62px]">
            <StatTile cell icon={<Boxes size={17} />} label="Categories" value={String(categories.length)} tone="blue" hint="Verified service categories" />
            <StatTile cell icon={<ShieldCheck size={17} />} label="Verified suppliers" value={compactNumber(totalSuppliers)} tone="violet" hint="Across all categories" />
            <StatTile cell icon={<Star size={17} />} label="Average rating" value={avgRating ? avgRating.toFixed(1) : '—'} tone="emerald" hint={`${compactNumber(totalProjects)} projects completed`} />
          </div>

          <Panel title="Category performance" subtitle="Ranked by completed projects" padded={false}>
            <ol className="divide-y divide-slate-100">
              {topCategories.map((category, index) => (
                <li key={category.id}>
                  <Link href={`${MODULE_ROUTES.discover}?category=${category.slug}`} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50 lg:py-1.5 lg:px-3">
                    <span className="w-4 shrink-0 text-[11px] font-semibold text-slate-400 lg:text-[9px]">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800 lg:text-[10px]">{category.name}</span>
                    <span className="shrink-0 text-[11px] text-slate-500 lg:text-[9px]">{compactNumber(category.projects_count)} projects</span>
                  </Link>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Trending categories" subtitle="Highest rated right now" padded={false}>
            <ul className="divide-y divide-slate-100">
              {trending.map(category => (
                <li key={category.id}>
                  <Link href={`${MODULE_ROUTES.discover}?category=${category.slug}`} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50 lg:py-1.5 lg:px-3">
                    <TrendingUp size={13} className="shrink-0 text-emerald-600" />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800 lg:text-[10px]">{category.name}</span>
                    <Rating value={category.avg_rating} />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

        </div>
      </div>

      <div className="grid gap-5 lg:gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,0.72fr)]">
        <Panel
          title="Recommended suppliers" subtitle="Top suppliers in your selected categories"
          action={<PanelLink href={MODULE_ROUTES.discover}>View all</PanelLink>}
          padded={false}
        >
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 lg:gap-2 lg:p-3">
            {recommended.rows.slice(0, 4).map(profile => (
              <Link
                key={profile.id}
                href={`/app/marketplace/suppliers/${profile.slug}`}
                className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 transition hover:border-slate-300 hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)]"
              >
                <ProfileCover profile={profile} className="h-20 lg:h-[58px]" />
                <span className="flex flex-col p-2 lg:p-1.5">
                  <span className="truncate text-xs font-semibold text-slate-800 group-hover:text-blue-700 lg:text-[9.5px]">{profile.display_name}</span>
                  <span className="truncate text-[11px] text-slate-500 lg:text-[8.5px]">{profile.headline}</span>
                  <Rating value={profile.rating} count={profile.reviews_count} />
                  <span className="mt-1 text-[11px] text-slate-500 lg:mt-0.5 lg:text-[8.5px]">From <span className="font-semibold text-slate-800">{startingPrice(profile)}</span></span>
                </span>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel
          title="Compare categories" subtitle="Compare up to 3 categories side by side"
          action={<PanelLink href={MODULE_ROUTES.discover}>View full comparison</PanelLink>}
          padded={false}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-xs lg:text-[10px]">
              <caption className="sr-only">Category comparison</caption>
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400 lg:text-[8.5px]">
                <tr>
                  <th scope="col" className="px-5 py-2 text-left font-semibold">Category</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold">Suppliers</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold">Projects</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold">Avg. rating</th>
                  <th scope="col" className="px-5 py-2 text-left font-semibold">Avg. price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {compareCategories.map(category => (
                  <tr key={category.id} className="hover:bg-slate-50">
                    <th scope="row" className="px-5 py-2.5 text-left lg:py-1.5">
                      <Link href={`${MODULE_ROUTES.discover}?category=${category.slug}`} className="font-medium text-slate-800 hover:text-blue-700">
                        {category.name}
                      </Link>
                    </th>
                    <td className="px-3 py-2.5 text-slate-600 lg:py-1.5">{category.supplier_count.toLocaleString('en-GB')}</td>
                    <td className="px-3 py-2.5 text-slate-600 lg:py-1.5">{compactNumber(category.projects_count)}</td>
                    <td className="px-3 py-2.5 lg:py-1.5"><Rating value={category.avg_rating} /></td>
                    <td className="px-5 py-2.5 font-medium text-slate-800 lg:py-1.5">
                      {category.avg_price_cents ? money(category.avg_price_cents) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Recent activity" action={<PanelLink href={MODULE_ROUTES.overview}>View all</PanelLink>} padded={false}>
          {activity.length === 0 ? (
            <p className="p-5 text-xs text-slate-500 lg:text-[10px]">Category activity will appear here once you start ordering.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activity.map(entry => (
                <li key={entry.id} className="flex items-start gap-2.5 px-4 py-3 lg:py-2 lg:px-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                    <Activity size={12} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800 lg:text-[10px]">{entry.summary}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400 lg:text-[9px]">{formatRelative(entry.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <TrustStrip items={[
        { icon: <ShieldCheck size={16} />, title: 'All suppliers are verified', note: 'Rigorous vetting process' },
        { icon: <CreditCard size={16} />, title: 'Secure payments', note: 'Funds held in escrow until approval' },
        { icon: <Star size={16} />, title: `${satisfaction.toFixed(0)}% satisfaction`, note: 'Based on marketplace ratings' },
        { icon: <Headphones size={16} />, title: 'Support when you need it', note: 'Dispute mediation included' },
      ]} />
    </MarketplacePage>
  )
}
