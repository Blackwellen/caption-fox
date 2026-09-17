import Link from 'next/link'
import {
  Bookmark, Users, Video, Briefcase, Search, Scale, Plus, ShoppingCart, Activity,
} from 'lucide-react'
import { requireMarketplaceModule } from '@/lib/marketplace/server'
import { parseMarketplaceQuery, type RawParams } from '@/lib/marketplace/query'
import {
  MODULE_ROUTES, RATING_BANDS, startingPrice, type SavedItem,
} from '@/lib/marketplace/module'
import {
  getSavedItems, getSavedSearches, getShortlistIds, getCategories,
  getProfilesByIds, getActivity,
} from '@/lib/marketplace/data'
import { MarketplacePage, AccessBlocked, NoResults } from '@/components/marketplace/module/Layout'
import SearchHero from '@/components/marketplace/module/SearchHero'
import { savedFilters } from '@/components/marketplace/module/filters'
import {
  Panel, PanelLink, StatTile, ProfileAvatar, ProfileCover, Rating, Chip,
  VerifiedMark, LocationLine,
} from '@/components/marketplace/module/primitives'
import { ViewSwitcher, FilterChips } from '@/components/marketplace/module/Controls'
import { SavedItemControls, CompareButton } from '@/components/marketplace/module/ProfileActions'
import DeleteSavedSearch from '@/components/marketplace/module/DeleteSavedSearch'
import { formatRelative } from '@/lib/utils'

export const metadata = { title: 'Marketplace Saved · Caption Fox' }

const PATH = MODULE_ROUTES.saved

export default async function MarketplaceSavedPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const session = await requireMarketplaceModule('saved')
  if (!session.access.allowed) {
    return (
      <MarketplacePage
        module="saved" modules={session.modules}
        title="Marketplace Saved" subtitle="Your saved suppliers, creators, services and search presets."
      >
        <AccessBlocked access={session.access} title="Saved items are not available" />
      </MarketplacePage>
    )
  }

  const params = await searchParams
  const query = parseMarketplaceQuery(params, { views: ['cards', 'list'], defaultView: 'cards' })

  const [items, searches, shortlistIds, categories, activity] = await Promise.all([
    getSavedItems(session, query),
    getSavedSearches(session),
    getShortlistIds(session),
    getCategories(session.supabase),
    getActivity(session, 5),
  ])

  // Client-side-equivalent filters that depend on the joined supplier record.
  const ratingMin = RATING_BANDS.find(band => band.id === query.rating)?.min ?? 0
  const filtered = items.filter(item => {
    if (ratingMin && Number(item.supplier?.rating ?? 0) < ratingMin) return false
    if (query.region && item.supplier?.region !== query.region) return false
    if (query.available && !item.supplier?.available_now) return false
    return true
  })

  const suppliers = filtered.filter(item => item.item_type === 'supplier')
  const creators = filtered.filter(item => item.item_type === 'creator')
  const services = filtered.filter(item => item.item_type === 'service')
  const compareEligible = filtered.filter(item => item.supplier?.status === 'active')

  const shortlistProfiles = await getProfilesByIds(session.supabase, shortlistIds)

  return (
    <MarketplacePage
      module="saved" modules={session.modules}
      title="Marketplace Saved"
      subtitle="Your saved suppliers, creators, services and search presets — organised and ready when you are."
    >
      <div className="grid gap-5 lg:gap-4 xl:grid-cols-[minmax(0,1fr)_250px]">
        <div className="min-w-0 space-y-5 lg:space-y-4">
          <SearchHero
            title="Find saved items fast"
            subtitle="Filter your saved suppliers, creators, services and searches."
            placeholder="Search your saved items…"
            query={query} pathname={PATH} mode="saved" resultCount={filtered.length}
            filters={savedFilters(categories)}
            canSaveSearch={false}
            layout="saved"
            aside={<ViewSwitcher query={query} pathname={PATH} views={['cards', 'list']} withLabels />}
          />

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile iconRight icon={<Bookmark size={17} />} label="Saved items" value={String(items.length)} tone="blue" hint="Across all types" />
            <StatTile iconRight icon={<Users size={17} />} label="Suppliers" value={String(suppliers.length)} tone="violet" hint="Production partners" />
            <StatTile iconRight icon={<Video size={17} />} label="Creators" value={String(creators.length)} tone="emerald" hint="UGC and talent" />
            <StatTile iconRight icon={<Briefcase size={17} />} label="Services" value={String(services.length)} tone="amber" hint="Specialised services" />
            <StatTile iconRight icon={<Search size={17} />} label="Searches" value={String(searches.length)} tone="blue" hint="Saved search presets" />
            <StatTile iconRight icon={<Scale size={17} />} label="Compare eligible" value={String(compareEligible.length)} tone="slate" hint="Ready to compare" />
          </div>

          <FilterChips
            query={query} pathname={PATH}
            labels={{
              type: query.type === 'creator' ? 'Creators' : query.type === 'supplier' ? 'Suppliers' : undefined,
              category: categories.find(c => c.slug === query.category)?.name,
              region: query.region, rating: `${query.rating}+ stars`, available: 'Available now',
            }}
          />

          {filtered.length === 0 ? (
            <NoResults
              title={items.length === 0 ? 'Nothing saved yet' : 'No saved items match these filters'}
              description={items.length === 0
                ? 'Save suppliers and creators from Discover to build your shortlist of trusted partners.'
                : 'Try clearing a filter or searching for a different name.'}
              action={
                <Link href={MODULE_ROUTES.discover} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 lg:text-[11px] lg:py-1.5 lg:px-3">
                  Discover suppliers
                </Link>
              }
            />
          ) : (
            <>
              {[
                { key: 'supplier', label: 'Suppliers', rows: suppliers },
                { key: 'creator', label: 'Creators', rows: creators },
              ].filter(group => group.rows.length > 0).map(group => (
                <Panel
                  key={group.key}
                  title={`${group.label} (${group.rows.length})`}
                  action={<PanelLink href={`${PATH}?type=${group.key}`}>View all</PanelLink>}
                  padded={false}
                >
                  {query.view === 'list' ? (
                    <ul className="divide-y divide-slate-100">
                      {group.rows.map(item => <SavedRow key={item.id} item={item} canEdit={session.capabilities.save} />)}
                    </ul>
                  ) : (
                    <div className="grid gap-4 p-4 sm:grid-cols-2 lg:gap-3 lg:p-3 xl:grid-cols-4">
                      {/* Reference previews four per section; "View all" opens the full group. */}
                      {(query.type ? group.rows : group.rows.slice(0, 4)).map(item => (
                        <SavedCard
                          key={item.id} item={item}
                          canEdit={session.capabilities.save}
                          canCompare={session.capabilities.compare}
                          compareLimit={session.capabilities.compareLimit}
                          query={query}
                        />
                      ))}
                    </div>
                  )}
                </Panel>
              ))}
            </>
          )}

          <div className="grid gap-5 lg:grid-cols-2" id="searches">
            <Panel title={`Saved searches (${searches.length})`} padded={false}>
              {searches.length === 0 ? (
                <p className="p-5 text-xs text-slate-500 lg:text-[10px]">
                  Save a search from any discovery surface to re-run it here with one click.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {searches.map(search => (
                    <li key={search.id} className="flex items-center gap-2 px-4 py-3 lg:py-2 lg:px-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Search size={13} />
                      </span>
                      <Link
                        href={`${MODULE_ROUTES[search.mode as keyof typeof MODULE_ROUTES] ?? MODULE_ROUTES.discover}?${new URLSearchParams(search.params).toString()}`}
                        className="min-w-0 flex-1"
                      >
                        <p className="truncate text-xs font-semibold text-slate-800 lg:text-[10px]">{search.name}</p>
                        <p className="text-[11px] text-slate-400 lg:text-[9px]">
                          {search.result_count !== null ? `${search.result_count} results · ` : ''}
                          Updated {formatRelative(search.updated_at)}
                        </p>
                      </Link>
                      <DeleteSavedSearch id={search.id} canDelete={session.capabilities.search} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Saved services" padded={false}>
              {services.length === 0 ? (
                <p className="p-5 text-xs text-slate-500 lg:text-[10px]">
                  Saved service packages appear here. Save one from a supplier profile to compare packages later.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {services.map(item => (
                    <li key={item.id} className="flex items-center gap-2.5 px-4 py-3 lg:py-2 lg:px-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                        <Briefcase size={13} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-800 lg:text-[10px]">{item.supplier?.display_name ?? 'Service'}</p>
                        <p className="truncate text-[11px] text-slate-400 lg:text-[9px]">{item.note}</p>
                      </div>
                      {item.supplier && <Rating value={item.supplier.rating} count={item.supplier.reviews_count} />}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>

        <div className="space-y-4">
          <Panel
            title="Compare shortlist"
            subtitle={`${shortlistProfiles.length}/${session.capabilities.compareLimit} items`}
            padded={false}
          >
            {shortlistProfiles.length === 0 ? (
              <p className="p-5 text-xs text-slate-500 lg:text-[10px]">
                Shortlist suppliers while you search and they will collect here, ready to compare.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-slate-100">
                  {shortlistProfiles.map(profile => (
                    <li key={profile.id} className="flex items-center gap-2.5 px-4 py-2.5 lg:py-1.5 lg:px-3">
                      <ProfileAvatar profile={profile} size={30} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-800 lg:text-[10px]">{profile.display_name}</p>
                        <p className="truncate text-[11px] text-slate-400 lg:text-[9px]">{profile.headline}</p>
                      </div>
                      <Rating value={profile.rating} />
                    </li>
                  ))}
                </ul>
                <div className="p-3">
                  <Link
                    href={`/app/marketplace/compare?ids=${shortlistProfiles.slice(0, session.capabilities.compareLimit).map(p => p.id).join(',')}`}
                    className="block rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-700 lg:text-[11px] lg:py-1.5"
                  >
                    Compare now
                  </Link>
                </div>
              </>
            )}
          </Panel>

          <Panel title="Recent activity" action={<PanelLink href={MODULE_ROUTES.overview}>View all</PanelLink>} padded={false}>
            {activity.length === 0 ? (
              <p className="p-5 text-xs text-slate-500 lg:text-[10px]">Saving and comparing partners will show up here.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activity.map(entry => (
                  <li key={entry.id} className="flex items-start gap-2.5 px-4 py-3 lg:py-2 lg:px-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                      <Activity size={12} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-700 lg:text-[10px]">{entry.summary}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400 lg:text-[9px]">{formatRelative(entry.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Quick actions" padded={false}>
            <ul className="divide-y divide-slate-100">
              {[
                { href: MODULE_ROUTES.requests, icon: <Plus size={15} />, title: 'Create request', note: 'Get proposals from suppliers', show: session.capabilities.createRequest },
                { href: MODULE_ROUTES.orders, icon: <ShoppingCart size={15} />, title: 'Start an order', note: 'Work with a saved supplier', show: session.capabilities.createOrder },
                { href: MODULE_ROUTES.discover, icon: <Search size={15} />, title: 'Create new search', note: 'Find and save new opportunities', show: session.capabilities.search },
              ].filter(action => action.show).map(action => (
                <li key={action.title}>
                  <Link href={action.href} className="flex items-center gap-2.5 px-4 py-3 hover:bg-slate-50 lg:py-2 lg:px-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">{action.icon}</span>
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

function SavedCard({
  item, canEdit, canCompare, compareLimit, query,
}: {
  item: SavedItem
  canEdit: boolean
  canCompare: boolean
  compareLimit: number
  query: ReturnType<typeof parseMarketplaceQuery>
}) {
  const profile = item.supplier
  if (!profile) return null

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <ProfileCover profile={profile} className="h-24 lg:h-[64px]" />
      <div className="flex flex-1 flex-col p-3.5 lg:px-2.5 lg:py-2">
        <Link href={`/app/marketplace/suppliers/${profile.slug}`} className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 hover:text-blue-700 lg:text-[11px]">
          <span className="truncate">{profile.display_name}</span>
          <VerifiedMark verified={profile.verified} />
        </Link>
        <p className="truncate text-xs text-slate-500 lg:text-[9px]">{profile.headline}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 lg:mt-0.5 lg:flex-nowrap lg:gap-x-1.5 lg:overflow-hidden">
          <span className="shrink-0"><Rating value={profile.rating} count={profile.reviews_count} /></span>
          <LocationLine location={profile.location} />
        </div>
        {item.tags && item.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1 lg:mt-1 lg:h-[18px] lg:overflow-hidden">
            {item.tags.slice(0, 3).map(tag => <Chip key={tag}>{tag}</Chip>)}
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-400 lg:mt-1 lg:text-[8.5px]">
          Last interaction {item.last_interaction_at ? formatRelative(item.last_interaction_at) : formatRelative(item.created_at)}
        </p>
        <div className="mt-2 border-t border-slate-100 pt-2 lg:mt-1 lg:pt-1">
          <SavedItemControls savedItemId={item.id} note={item.note} canEdit={canEdit} />
        </div>
        <div className="mt-3 flex items-center gap-2 lg:mt-1.5 lg:gap-1.5">
          <CompareButton
            supplierId={profile.id} query={query} pathname={PATH}
            limit={compareLimit} disabled={!canCompare} variant="icon"
          />
          <Link
            href={`${MODULE_ROUTES.requests}?supplier=${profile.id}`}
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 lg:py-1 lg:text-[9.5px]"
          >
            Create request
          </Link>
        </div>
      </div>
    </article>
  )
}

function SavedRow({ item, canEdit }: { item: SavedItem; canEdit: boolean }) {
  const profile = item.supplier
  if (!profile) return null
  return (
    <li className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center">
      <ProfileAvatar profile={profile} size={36} />
      <div className="min-w-0 flex-1">
        <Link href={`/app/marketplace/suppliers/${profile.slug}`} className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 hover:text-blue-700 lg:text-[11px]">
          <span className="truncate">{profile.display_name}</span>
          <VerifiedMark verified={profile.verified} />
        </Link>
        <p className="truncate text-xs text-slate-500 lg:text-[10px]">{profile.headline}</p>
      </div>
      <div className="hidden w-40 shrink-0 sm:block">
        <Rating value={profile.rating} count={profile.reviews_count} />
        <LocationLine location={profile.location} />
      </div>
      <div className="w-28 shrink-0 text-xs lg:text-[10px]">
        <p className="text-slate-400">From</p>
        <p className="font-semibold text-slate-900">{startingPrice(profile)}</p>
      </div>
      <div className="min-w-0 flex-1 sm:max-w-xs">
        <SavedItemControls savedItemId={item.id} note={item.note} canEdit={canEdit} />
      </div>
    </li>
  )
}
