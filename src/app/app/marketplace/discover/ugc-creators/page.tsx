import Link from 'next/link'
import { Plus, MessageCircleQuestion, Bookmark } from 'lucide-react'
import { requireMarketplaceModule } from '@/lib/marketplace/server'
import { parseMarketplaceQuery, buildMarketplaceHref, type RawParams } from '@/lib/marketplace/query'
import { MODULE_ROUTES, POPULAR_SEARCHES, startingPrice } from '@/lib/marketplace/module'
import {
  searchProfiles, getSavedSupplierIds, getShortlistIds, getProfilesByIds, getRequests,
  getPortfolioBySupplier,
} from '@/lib/marketplace/data'
import { MarketplacePage, AccessBlocked, NoResults } from '@/components/marketplace/module/Layout'
import SearchHero, { SaveSearchControl } from '@/components/marketplace/module/SearchHero'
import { ugcFilters } from '@/components/marketplace/module/filters'
import { UgcCreatorCard, SupplierRow, type CardContext } from '@/components/marketplace/module/ProfileCards'
import { Panel, PanelLink, ProfileAvatar, StatusPill } from '@/components/marketplace/module/primitives'
import {
  ViewSwitcher, SortSelect, Pagination, CompareTray, FilterChips,
} from '@/components/marketplace/module/Controls'
import { formatRelative } from '@/lib/utils'

export const metadata = { title: 'UGC Creator Search · Caption Fox' }

const PATH = MODULE_ROUTES['ugc-creators']

export default async function UgcCreatorSearchPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const session = await requireMarketplaceModule('ugc-creators')
  if (!session.access.allowed) {
    return (
      <MarketplacePage
        module="ugc-creators" modules={session.modules} showDiscoverNav
        title="UGC Creator Search" subtitle="Find the perfect UGC creator for your brand and content goals."
      >
        <AccessBlocked access={session.access} title="UGC creator search is not available on your plan" />
      </MarketplacePage>
    )
  }

  const params = await searchParams
  const query = parseMarketplaceQuery(params, { views: ['cards', 'list'], defaultView: 'cards' })

  const [{ rows, total }, savedIds, shortlistIds, requests] = await Promise.all([
    searchProfiles(session.supabase, query, { mode: 'ugc-creators' }),
    getSavedSupplierIds(session),
    getShortlistIds(session),
    session.capabilities.viewRequests
      ? getRequests(session, { ...query, page: 1, size: 4, status: '', category: '', type: '' })
      : Promise.resolve({ rows: [], total: 0, kpis: { open: 0, responses: 0, awaiting: 0, shortlisted: 0, closed_won: 0, closed_cancelled: 0 } }),
  ])

  const compareProfiles = await getProfilesByIds(session.supabase, query.compare)

  const portfolio = await getPortfolioBySupplier(session.supabase, rows.map(row => row.id))

  const ctx: CardContext = {
    query, pathname: PATH, portfolio,
    savedIds: new Set(savedIds),
    shortlistIds: new Set(shortlistIds),
    canSave: session.capabilities.save,
    canCompare: session.capabilities.compare,
    compareLimit: session.capabilities.compareLimit,
  }

  return (
    <MarketplacePage
      module="ugc-creators" modules={session.modules} showDiscoverNav
      title="UGC Creator Search"
      subtitle="Find the perfect UGC creator for your brand and content goals."
    >

      <div className="grid gap-5 lg:gap-4 xl:grid-cols-[minmax(0,1fr)_238px]">
        <div className="min-w-0">
          <SearchHero
            title="Find UGC creators that drive real results"
            subtitle={`Search across ${total.toLocaleString('en-GB')} verified creators with proven performance.`}
            placeholder='Try "Skincare creator in US with unboxing style for TikTok"'
            query={query} pathname={PATH} mode="ugc-creators" resultCount={total}
            filters={ugcFilters()}
            popular={POPULAR_SEARCHES['ugc-creators']}
            searchLabel="Search creators"
            canSaveSearch={session.capabilities.search}
            saveInHero={false}
            searchInside
          />
          <div className="mb-3 mt-4 flex flex-wrap items-center justify-between gap-2 lg:mt-3">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold text-slate-900 lg:text-[11px]" role="status" aria-live="polite">
                {total.toLocaleString('en-GB')} creator{total === 1 ? '' : 's'} found
              </p>
              <SortSelect query={query} pathname={PATH} />
            </div>
            <div className="flex items-center gap-2">
              {session.capabilities.search && (
                <SaveSearchControl mode="ugc-creators" query={query} resultCount={total} variant="outline" />
              )}
              <ViewSwitcher query={query} pathname={PATH} views={['cards', 'list']} withLabels />
            </div>
          </div>

          <div className="mb-3">
            <FilterChips
              query={query} pathname={PATH}
              labels={{
                tag: query.tag, platform: query.platform, region: query.region,
                language: query.language, budget: 'Budget', available: 'Available now',
                rating: `${query.rating}+ rating`,
              }}
            />
          </div>

          {rows.length === 0 ? (
            <NoResults
              title="No creators match these filters"
              description="Try a different niche, widen the budget band, or clear the availability filter."
              action={<Link href={PATH} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 lg:text-[11px] lg:px-3">Reset search</Link>}
            />
          ) : query.view === 'list' ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {rows.map(profile => <SupplierRow key={profile.id} profile={profile} ctx={ctx} />)}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:gap-3 xl:grid-cols-3">
              {rows.map(profile => <UgcCreatorCard key={profile.id} profile={profile} ctx={ctx} />)}
            </div>
          )}

          <div className="mt-5">
            <Pagination query={query} pathname={PATH} total={total} />
          </div>
        </div>

        <div className="space-y-4">
          <Panel
            title={`Compare creators (${query.compare.length})`}
            subtitle={`Select up to ${session.capabilities.compareLimit} creators to compare`}
            action={query.compare.length > 0
              ? <PanelLink href={buildMarketplaceHref(PATH, query, { compare: [] })}>Clear all</PanelLink>
              : undefined}
            padded={false}
          >
            {compareProfiles.length === 0 ? (
              <p className="p-5 text-xs text-slate-500 lg:text-[10px] lg:p-3">
                Tick “Compare” on a creator card to line up turnaround, engagement and package pricing.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-slate-100">
                  {compareProfiles.map(profile => (
                    <li key={profile.id} className="flex items-center gap-2.5 px-4 py-2.5 lg:py-1.5 lg:px-3">
                      <ProfileAvatar profile={profile} size={30} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-800 lg:text-[10px]">{profile.display_name}</p>
                        <p className="truncate text-[11px] text-slate-400 lg:text-[9px]">
                          {startingPrice(profile)} · {profile.location}
                        </p>
                      </div>
                      <Link
                        href={buildMarketplaceHref(PATH, query, { compare: query.compare.filter(id => id !== profile.id), page: query.page })}
                        aria-label={`Remove ${profile.display_name} from comparison`}
                        className="shrink-0 px-1 text-slate-400 hover:text-slate-700"
                      >
                        ×
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="space-y-2 border-t border-slate-100 p-3">
                  <Link
                    href={MODULE_ROUTES['ugc-creators']}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 lg:text-[10px]"
                  >
                    <Plus size={13} />Add another creator
                  </Link>
                  <Link
                    href={`/app/marketplace/compare?ids=${query.compare.join(',')}`}
                    className="block rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-700 lg:text-[11px]"
                  >
                    Compare now
                  </Link>
                  <Link
                    href={`/app/marketplace/compare?ids=${query.compare.join(',')}`}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 lg:text-[10px]"
                  >
                    <Bookmark size={13} />Save comparison
                  </Link>
                </div>
              </>
            )}
          </Panel>

          <Panel
            title="Recent requests and outreach"
            action={<PanelLink href={MODULE_ROUTES.requests}>View all</PanelLink>}
            padded={false}
          >
            {!session.capabilities.viewRequests ? (
              <p className="p-5 text-xs text-slate-500 lg:text-[10px] lg:p-3">Your role does not include access to requests.</p>
            ) : requests.rows.length === 0 ? (
              <p className="p-5 text-xs text-slate-500 lg:text-[10px] lg:p-3">Create a request to brief several creators at once.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {requests.rows.map(request => (
                  <li key={request.id} className="px-4 py-3 lg:py-2 lg:px-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800 lg:text-[10px]">{request.title}</p>
                      <span className="shrink-0 text-[11px] text-slate-400 lg:text-[9px]">{formatRelative(request.updated_at)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-[11px] text-slate-500 lg:text-[9px]">{request.invited_count} creators contacted</p>
                      <StatusPill
                        label={request.response_count > 0 ? `${request.response_count} responded` : 'No responses yet'}
                        cls={request.response_count > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600 bg-slate-100'}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {session.capabilities.createRequest && (
              <div className="border-t border-slate-100 p-3">
                <Link
                  href={MODULE_ROUTES.requests}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 lg:text-[11px]"
                >
                  <Plus size={14} />Create new request
                </Link>
              </div>
            )}
          </Panel>

          <Panel title="Need help finding the right creator?" padded>
            <p className="text-xs text-slate-500 lg:text-[10px]">
              Post a brief and our marketplace team will help match creators to your brand and goals.
            </p>
            <Link
              href="/contact?topic=marketplace"
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 lg:text-[11px]"
            >
              <MessageCircleQuestion size={14} />Talk to the marketplace team
            </Link>
          </Panel>
        </div>
      </div>

      <CompareTray railWidth={238}
        profiles={compareProfiles} query={query} pathname={PATH}
        limit={session.capabilities.compareLimit}
      />
    </MarketplacePage>
  )
}
