import Link from 'next/link'
import { Activity, Clock3, GitCompareArrows, Users } from 'lucide-react'
import { requireMarketplaceModule } from '@/lib/marketplace/server'
import { parseMarketplaceQuery, buildMarketplaceHref, type RawParams } from '@/lib/marketplace/query'
import {
  MODULE_ROUTES, POPULAR_SEARCHES, compactNumber,
} from '@/lib/marketplace/module'
import {
  searchProfiles, getCategories, getCategorySupplierIds, getSavedSupplierIds,
  getShortlistIds, getProfilesByIds, getActivity, getSavedSearches,
} from '@/lib/marketplace/data'
import { MarketplacePage, AccessBlocked, NoResults } from '@/components/marketplace/module/Layout'
import SearchHero from '@/components/marketplace/module/SearchHero'
import FilterSidebar from '@/components/marketplace/module/FilterSidebar'
import { discoverFilters } from '@/components/marketplace/module/filters'
import { SupplierCard, SupplierRow, type CardContext } from '@/components/marketplace/module/ProfileCards'
import { Panel, PanelLink, ProfileAvatar } from '@/components/marketplace/module/primitives'
import {
  ViewSwitcher, SortSelect, Pagination, CompareTray, FilterChips,
} from '@/components/marketplace/module/Controls'
import { formatRelative } from '@/lib/utils'

export const metadata = { title: 'Marketplace Discover · Caption Fox' }

const PATH = MODULE_ROUTES.discover

export default async function MarketplaceDiscoverPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const session = await requireMarketplaceModule('discover')
  if (!session.access.allowed) {
    return (
      <MarketplacePage
        module="discover" modules={session.modules}
        title="Marketplace Discover" subtitle="Discover and connect with verified suppliers and creators for your next project."
      >
        <AccessBlocked access={session.access} title="Discovery is not available" />
      </MarketplacePage>
    )
  }

  const params = await searchParams
  const query = parseMarketplaceQuery(params, { views: ['cards', 'list'], defaultView: 'cards' })
  const categories = await getCategories(session.supabase)

  const categorySupplierIds = query.category
    ? await getCategorySupplierIds(session.supabase, query.category)
    : undefined

  const [{ rows, total }, savedIds, shortlistIds, activity, savedSearches] = await Promise.all([
    searchProfiles(session.supabase, query, { mode: 'discover', categorySupplierIds }),
    getSavedSupplierIds(session),
    getShortlistIds(session),
    getActivity(session, 5),
    getSavedSearches(session),
  ])

  const compareProfiles = await getProfilesByIds(session.supabase, query.compare)

  const ctx: CardContext = {
    query, pathname: PATH,
    savedIds: new Set(savedIds),
    shortlistIds: new Set(shortlistIds),
    canSave: session.capabilities.save,
    canCompare: session.capabilities.compare,
    compareLimit: session.capabilities.compareLimit,
  }

  const first = (query.page - 1) * query.size + 1
  const last = Math.min(query.page * query.size, total)

  return (
    <MarketplacePage
      module="discover" modules={session.modules} showDiscoverNav
      title="Marketplace Discover"
      subtitle="Discover and connect with verified suppliers and creators for your next project."
      breadcrumb={[{ label: 'Marketplace', href: MODULE_ROUTES.overview }, { label: 'Discover' }]}
    >
      <SearchHero
        title="Find the perfect partner for your next project"
        subtitle={`Search ${compactNumber(total)} verified suppliers and creators worldwide.`}
        placeholder='Try "YouTube thumbnails", "Explainer video", or "Technical writing"'
        query={query} pathname={PATH} mode="discover" resultCount={total}
        filters={discoverFilters(categories)}
        popular={POPULAR_SEARCHES.discover}
        canSaveSearch={session.capabilities.search}
      />

      <div className="grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)_280px]">
        <div className="hidden xl:block">
          <FilterSidebar query={query} pathname={PATH} categories={categories} />
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600" role="status" aria-live="polite">
              {total > 0
                ? <>Showing <span className="font-semibold text-slate-900">{first}–{last}</span> of {total.toLocaleString('en-GB')} results</>
                : 'No results'}
            </p>
            <div className="flex items-center gap-2">
              <SortSelect query={query} pathname={PATH} />
              <ViewSwitcher query={query} pathname={PATH} views={['cards', 'list']} />
            </div>
          </div>

          <div className="mb-3">
            <FilterChips
              query={query} pathname={PATH}
              labels={{
                category: categories.find(c => c.slug === query.category)?.name,
                region: query.region, platform: query.platform, location: query.location,
                budget: 'Budget', rating: `${query.rating}+ stars`, turnaround: 'Delivery speed',
                available: 'Available now', verified: 'Verified only',
              }}
            />
          </div>

          {rows.length === 0 ? (
            <NoResults
              action={
                <Link href={PATH} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  Reset discovery
                </Link>
              }
            />
          ) : query.view === 'list' ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {rows.map(profile => <SupplierRow key={profile.id} profile={profile} ctx={ctx} />)}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {rows.map(profile => <SupplierCard key={profile.id} profile={profile} ctx={ctx} />)}
            </div>
          )}

          <div className="mt-5">
            <Pagination query={query} pathname={PATH} total={total} />
          </div>
        </div>

        <div className="space-y-4">
          <Panel
            title="Recent activity"
            action={<PanelLink href={MODULE_ROUTES.overview}>View all</PanelLink>}
            padded={false}
          >
            {activity.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">Saving, shortlisting and comparing suppliers will show here.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activity.map(entry => (
                  <li key={entry.id} className="flex items-start gap-2.5 px-4 py-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                      <Activity size={12} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-800">{entry.summary}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{formatRelative(entry.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Recent searches"
            action={<PanelLink href={MODULE_ROUTES.saved}>Manage</PanelLink>}
            padded={false}
          >
            {savedSearches.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">Save a search from the search bar above to reuse it later.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {savedSearches.slice(0, 5).map(search => (
                  <li key={search.id}>
                    <Link
                      href={`${MODULE_ROUTES[(search.mode as keyof typeof MODULE_ROUTES)] ?? PATH}?${new URLSearchParams(search.params).toString()}`}
                      className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-50"
                    >
                      <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-slate-700">
                        <Clock3 size={12} className="shrink-0 text-slate-400" />
                        <span className="truncate">{search.name}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-400">{formatRelative(search.updated_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Compare summary"
            subtitle={`${query.compare.length}/${session.capabilities.compareLimit} selected`}
            action={query.compare.length > 0
              ? <PanelLink href={buildMarketplaceHref(PATH, query, { compare: [] })}>Clear</PanelLink>
              : undefined}
            padded={false}
          >
            {compareProfiles.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">
                Add up to {session.capabilities.compareLimit} suppliers to compare rating, price, turnaround and delivery side by side.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-slate-100">
                  {compareProfiles.map(profile => (
                    <li key={profile.id} className="flex items-center gap-2.5 px-4 py-2.5">
                      <ProfileAvatar profile={profile} size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-800">{profile.display_name}</p>
                        <p className="truncate text-[11px] text-slate-400">{profile.headline}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="p-3">
                  <Link
                    href={`/app/marketplace/compare?ids=${query.compare.join(',')}`}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <GitCompareArrows size={14} />Compare now
                  </Link>
                </div>
              </>
            )}
          </Panel>

          <Panel title="Need a shortlist built for you?" padded>
            <p className="text-xs text-slate-500">
              Post a request and invited suppliers respond with scoped proposals you can compare in one place.
            </p>
            <Link
              href={MODULE_ROUTES.requests}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Users size={14} />Create a request
            </Link>
          </Panel>
        </div>
      </div>

      <CompareTray
        profiles={compareProfiles} query={query} pathname={PATH}
        limit={session.capabilities.compareLimit}
      />
    </MarketplacePage>
  )
}
