import Link from 'next/link'
import { Send, Plus } from 'lucide-react'
import { requireMarketplaceModule } from '@/lib/marketplace/server'
import { parseMarketplaceQuery, buildMarketplaceHref, type RawParams } from '@/lib/marketplace/query'
import {
  MODULE_ROUTES, POPULAR_SEARCHES, SORTS, compactNumber, percent,
} from '@/lib/marketplace/module'
import {
  searchProfiles, getSavedSupplierIds, getShortlistIds, getProfilesByIds,
  getRequests, getProposals,
} from '@/lib/marketplace/data'
import { MarketplacePage, AccessBlocked, NoResults } from '@/components/marketplace/module/Layout'
import SearchHero from '@/components/marketplace/module/SearchHero'
import { influencerFilters } from '@/components/marketplace/module/filters'
import { InfluencerCard, SupplierRow, type CardContext } from '@/components/marketplace/module/ProfileCards'
import { Panel, PanelLink, ProfileAvatar, StatusPill } from '@/components/marketplace/module/primitives'
import {
  ViewSwitcher, SortSelect, Pagination, PageSizeSelect, CompareTray, FilterChips,
} from '@/components/marketplace/module/Controls'
import { formatRelative } from '@/lib/utils'

export const metadata = { title: 'Influencer Search · Caption Fox' }

const PATH = MODULE_ROUTES.influencers

export default async function InfluencerSearchPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const session = await requireMarketplaceModule('influencers')
  if (!session.access.allowed) {
    return (
      <MarketplacePage
        module="influencers" modules={session.modules} showDiscoverNav
        title="Influencer Search" subtitle="Discover the perfect creators to elevate your brand and drive real results."
        breadcrumb={[{ label: 'Marketplace', href: MODULE_ROUTES.overview }, { label: 'Discover', href: MODULE_ROUTES.discover }, { label: 'Influencers' }]}
      >
        <AccessBlocked access={session.access} title="Influencer search is not available on your plan" />
      </MarketplacePage>
    )
  }

  const params = await searchParams
  const query = parseMarketplaceQuery(params, { views: ['cards', 'list'], defaultView: 'cards', defaultSort: 'relevance' })

  const [{ rows, total }, savedIds, shortlistIds, requests, proposals] = await Promise.all([
    searchProfiles(session.supabase, query, { mode: 'influencers' }),
    getSavedSupplierIds(session),
    getShortlistIds(session),
    session.capabilities.viewRequests
      ? getRequests(session, { ...query, page: 1, size: 5, status: '', category: '', type: '' })
      : Promise.resolve({ rows: [], total: 0, kpis: { open: 0, responses: 0, awaiting: 0, shortlisted: 0, closed_won: 0, closed_cancelled: 0 } }),
    session.capabilities.viewRequests ? getProposals(session, { limit: 5 }) : Promise.resolve([]),
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

  // Performance snapshot: real aggregates across the current result set.
  const withEngagement = rows.filter(row => row.engagement_rate !== null)
  const withAudience = rows.filter(row => row.audience_size !== null)
  const snapshot = {
    engagement: withEngagement.length
      ? withEngagement.reduce((sum, row) => sum + Number(row.engagement_rate), 0) / withEngagement.length
      : null,
    audience: withAudience.length
      ? Math.round(withAudience.reduce((sum, row) => sum + Number(row.audience_size), 0) / withAudience.length)
      : null,
    response: rows.filter(row => row.job_success_pct !== null).length
      ? rows.filter(row => row.job_success_pct !== null)
        .reduce((sum, row) => sum + Number(row.job_success_pct), 0) / rows.filter(row => row.job_success_pct !== null).length
      : null,
    projects: rows.reduce((sum, row) => sum + (row.projects_count ?? 0), 0),
  }

  return (
    <MarketplacePage
      module="influencers" modules={session.modules} showDiscoverNav
      title="Influencer Search"
      subtitle="Discover the perfect creators to elevate your brand and drive real results."
      breadcrumb={[{ label: 'Marketplace', href: MODULE_ROUTES.overview }, { label: 'Discover', href: MODULE_ROUTES.discover }, { label: 'Influencers' }]}
    >
      <SearchHero
        title="Find the perfect influencer for your campaign"
        subtitle="Search our premium network of verified creators and drive authentic results."
        placeholder='Try "fitness creator with a US audience on Instagram"'
        query={query} pathname={PATH} mode="influencers" resultCount={total}
        filters={influencerFilters()}
        popular={POPULAR_SEARCHES.influencers}
        searchLabel="Search influencers"
        canSaveSearch={session.capabilities.search}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900" role="status" aria-live="polite">
                {total.toLocaleString('en-GB')} influencer{total === 1 ? '' : 's'} found
              </p>
              <p className="text-xs text-slate-500">
                Sorted by {SORTS.find(sort => sort.id === query.sort)?.label ?? 'Best match'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ViewSwitcher query={query} pathname={PATH} views={['cards', 'list']} withLabels />
              <SortSelect query={query} pathname={PATH} />
            </div>
          </div>

          <div className="mb-3">
            <FilterChips
              query={query} pathname={PATH}
              labels={{
                tag: query.tag, platform: query.platform, region: query.region,
                audience: 'Audience size', engagement: 'Engagement', budget: 'Budget',
                available: 'Available now',
              }}
            />
          </div>

          {rows.length === 0 ? (
            <NoResults
              title="No influencers match these filters"
              description="Try a wider audience band, a different platform, or clear the engagement filter."
              action={<Link href={PATH} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Reset search</Link>}
            />
          ) : query.view === 'list' ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {rows.map(profile => <SupplierRow key={profile.id} profile={profile} ctx={ctx} />)}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {rows.map(profile => <InfluencerCard key={profile.id} profile={profile} ctx={ctx} />)}
            </div>
          )}

          {rows.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <PageSizeSelect query={query} pathname={PATH} />
              <Pagination query={query} pathname={PATH} total={total} />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Panel
            title={`Compare (${query.compare.length})`}
            action={query.compare.length > 0
              ? <PanelLink href={buildMarketplaceHref(PATH, query, { compare: [] })}>Clear all</PanelLink>
              : undefined}
            padded={false}
          >
            {compareProfiles.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">
                Select up to {session.capabilities.compareLimit} creators to compare audience, engagement and rates.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-slate-100">
                  {compareProfiles.map(profile => (
                    <li key={profile.id} className="flex items-center gap-2.5 px-4 py-2.5">
                      <ProfileAvatar profile={profile} size={30} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-800">{profile.display_name}</p>
                        <p className="truncate text-[11px] text-slate-400">@{profile.slug}</p>
                      </div>
                      <Link
                        href={buildMarketplaceHref(PATH, query, { compare: query.compare.filter(id => id !== profile.id), page: query.page })}
                        aria-label={`Remove ${profile.display_name} from comparison`}
                        className="shrink-0 rounded px-1 text-slate-400 hover:text-slate-700"
                      >
                        ×
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="p-3">
                  <Link
                    href={`/app/marketplace/compare?ids=${query.compare.join(',')}`}
                    className="block rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Compare selected
                  </Link>
                </div>
              </>
            )}
          </Panel>

          <Panel title="Performance snapshot" subtitle="Across the current results">
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <dt className="text-[11px] text-slate-500">Avg. engagement rate</dt>
                <dd className="mt-1 text-lg font-bold text-slate-900">{percent(snapshot.engagement, 1)}</dd>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <dt className="text-[11px] text-slate-500">Avg. audience size</dt>
                <dd className="mt-1 text-lg font-bold text-slate-900">{compactNumber(snapshot.audience)}</dd>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <dt className="text-[11px] text-slate-500">Avg. response rate</dt>
                <dd className="mt-1 text-lg font-bold text-slate-900">{percent(snapshot.response)}</dd>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <dt className="text-[11px] text-slate-500">Completed projects</dt>
                <dd className="mt-1 text-lg font-bold text-slate-900">{compactNumber(snapshot.projects)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] text-slate-400">
              Calculated from the {rows.length} creator{rows.length === 1 ? '' : 's'} on this page of results.
            </p>
          </Panel>

          <Panel
            title="Recent outreach"
            action={<PanelLink href={MODULE_ROUTES.requests}>View all</PanelLink>}
            padded={false}
          >
            {!session.capabilities.viewRequests ? (
              <p className="p-5 text-xs text-slate-500">Your role does not include access to outreach requests.</p>
            ) : proposals.length === 0 && requests.rows.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">Invite creators to a request and their responses will appear here.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {proposals.slice(0, 5).map(proposal => (
                  <li key={proposal.id} className="flex items-center gap-2.5 px-4 py-2.5">
                    {proposal.supplier && <ProfileAvatar profile={proposal.supplier} size={26} />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-800">{proposal.supplier?.display_name}</p>
                      <p className="truncate text-[11px] text-slate-400">{proposal.request_title}</p>
                    </div>
                    <StatusPill
                      label={proposal.status === 'submitted' ? 'Responded' : proposal.status === 'shortlisted' ? 'Shortlisted' : 'Requested'}
                      cls={proposal.status === 'shortlisted' ? 'text-emerald-700 bg-emerald-50' : 'text-blue-700 bg-blue-50'}
                    />
                  </li>
                ))}
                {requests.rows.slice(0, 2).map(request => (
                  <li key={request.id} className="flex items-center gap-2.5 px-4 py-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                      <Send size={11} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-800">{request.title}</p>
                      <p className="text-[11px] text-slate-400">
                        {request.invited_count} invited · {formatRelative(request.updated_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {session.capabilities.createRequest && (
              <div className="border-t border-slate-100 p-3">
                <Link
                  href={MODULE_ROUTES.requests}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Plus size={14} />Create new request
                </Link>
              </div>
            )}
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
