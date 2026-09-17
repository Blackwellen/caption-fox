import Link from 'next/link'
import {
  Users, ShieldCheck, Clock3, Globe2, Headphones, FileText, Bookmark, Boxes, LifeBuoy, GitCompareArrows,
} from 'lucide-react'
import { requireMarketplaceModule } from '@/lib/marketplace/server'
import { parseMarketplaceQuery, buildMarketplaceHref, type RawParams } from '@/lib/marketplace/query'
import { MODULE_ROUTES, POPULAR_SEARCHES, compactNumber, percent, responseTime } from '@/lib/marketplace/module'
import {
  searchProfiles, getCategories, getCategorySupplierIds, getSavedSupplierIds,
  getShortlistIds, getProfilesByIds, getRequests,
  getPortfolioBySupplier,
} from '@/lib/marketplace/data'
import { MarketplacePage, AccessBlocked, NoResults } from '@/components/marketplace/module/Layout'
import SearchHero, { SaveSearchControl } from '@/components/marketplace/module/SearchHero'
import { serviceFilters } from '@/components/marketplace/module/filters'
import { ServiceCard, SupplierRow, type CardContext } from '@/components/marketplace/module/ProfileCards'
import { Panel, PanelLink, ProfileAvatar, TrustStrip } from '@/components/marketplace/module/primitives'
import {
  ViewSwitcher, SortSelect, Pagination, CompareTray, FilterChips,
} from '@/components/marketplace/module/Controls'

export const metadata = { title: 'Services Search · Caption Fox' }

const PATH = MODULE_ROUTES.services

export default async function ServicesSearchPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const session = await requireMarketplaceModule('services')
  if (!session.access.allowed) {
    return (
      <MarketplacePage
        module="services" modules={session.modules} showDiscoverNav
        title="Services Search" subtitle="Find the perfect service provider for your next project."
      >
        <AccessBlocked access={session.access} title="Services search is not available" />
      </MarketplacePage>
    )
  }

  const params = await searchParams
  const query = parseMarketplaceQuery(params, { views: ['cards', 'list'], defaultView: 'cards' })
  const categories = await getCategories(session.supabase)
  const categorySupplierIds = query.category
    ? await getCategorySupplierIds(session.supabase, query.category)
    : undefined

  const [{ rows, total }, savedIds, shortlistIds, requests] = await Promise.all([
    searchProfiles(session.supabase, query, { mode: 'services', categorySupplierIds }),
    getSavedSupplierIds(session),
    getShortlistIds(session),
    session.capabilities.viewRequests
      ? getRequests(session, { ...query, page: 1, size: 5, type: 'rfq', status: '', category: '' })
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

  const withSuccess = rows.filter(row => row.job_success_pct !== null)
  const avgSuccess = withSuccess.length
    ? withSuccess.reduce((sum, row) => sum + Number(row.job_success_pct), 0) / withSuccess.length
    : null
  const withResponse = rows.filter(row => row.response_time_minutes !== null)
  const avgResponse = withResponse.length
    ? Math.round(withResponse.reduce((sum, row) => sum + Number(row.response_time_minutes), 0) / withResponse.length)
    : null
  const countries = new Set(rows.map(row => row.country).filter(Boolean)).size

  const first = (query.page - 1) * query.size + 1
  const last = Math.min(query.page * query.size, total)

  return (
    <MarketplacePage
      module="services" modules={session.modules} showDiscoverNav
      title="Services Search"
      subtitle="Find the perfect service provider for your next project."
    >
      <div className="grid gap-5 lg:gap-4 xl:grid-cols-[minmax(0,1fr)_250px]">
        <div className="min-w-0">
        <SearchHero
          title="Find the perfect service partner"
          subtitle={`Search ${compactNumber(total)} verified service providers and specialists worldwide.`}
          placeholder="What service do you need? e.g. Video Editing, Voice Over, Logo Design…"
          query={query} pathname={PATH} mode="services" resultCount={total}
          filters={serviceFilters(categories)}
          segmentedFilters
          popular={POPULAR_SEARCHES.services}
          canSaveSearch={session.capabilities.search}
          saveInHero={false}
          aside={
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {rows.slice(0, 5).map(profile => <ProfileAvatar key={profile.id} profile={profile} size={30} />)}
              </div>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold lg:text-[10px]">{compactNumber(total)}</span>
              <span className="text-xs text-blue-100 lg:text-[10px]">Active providers</span>
            </div>
          }
        />

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600 lg:text-[11px]" role="status" aria-live="polite">
              {total > 0
                ? <>Showing <span className="font-semibold text-slate-900">{first}–{last}</span> of {total.toLocaleString('en-GB')} providers</>
                : 'No providers match these filters'}
            </p>
            <div className="flex items-center gap-2">
              {session.capabilities.search && (
                <SaveSearchControl mode="services" query={query} resultCount={total} variant="outline" />
              )}
              <ViewSwitcher query={query} pathname={PATH} views={['cards', 'list']} withLabels />
              <SortSelect query={query} pathname={PATH} />
            </div>
          </div>

          <div className="mb-3">
            <FilterChips
              query={query} pathname={PATH}
              labels={{
                category: categories.find(c => c.slug === query.category)?.name,
                type: query.type, turnaround: 'Turnaround', budget: 'Budget',
                rating: `${query.rating}+ stars`, region: query.region, language: query.language,
              }}
            />
          </div>

          {rows.length === 0 ? (
            <NoResults
              title="No providers match these filters"
              action={<Link href={PATH} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 lg:text-[11px] lg:px-3">Reset search</Link>}
            />
          ) : query.view === 'list' ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {rows.map(profile => <SupplierRow key={profile.id} profile={profile} ctx={ctx} />)}
            </div>
          ) : (
            <div className="space-y-4">
              {rows.map(profile => <ServiceCard key={profile.id} profile={profile} ctx={ctx} />)}
            </div>
          )}

          <div className="mt-5">
            <Pagination query={query} pathname={PATH} total={total} />
          </div>

          <div className="mt-5">
            <TrustStrip items={[
              { icon: <Users size={16} />, title: `${compactNumber(total)} verified providers`, note: 'Every profile is reviewed before listing' },
              { icon: <ShieldCheck size={16} />, title: `${percent(avgSuccess)} job success`, note: 'Average across these results' },
              { icon: <Clock3 size={16} />, title: `${responseTime(avgResponse)} avg. response`, note: 'Time to first supplier reply' },
              { icon: <Globe2 size={16} />, title: `${countries} countries covered`, note: 'Within the current result set' },
            ]} />
          </div>
        </div>

        <div className="space-y-4">
          <Panel
            title="Compare providers"
            action={query.compare.length > 0
              ? <PanelLink href={buildMarketplaceHref(PATH, query, { compare: [] })}>Clear all</PanelLink>
              : undefined}
            padded={false}
          >
            {compareProfiles.length === 0 ? (
              <p className="p-5 text-xs text-slate-500 lg:text-[10px] lg:p-3">
                Add up to {session.capabilities.compareLimit} providers to compare price, turnaround and delivery record.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-slate-100">
                  {compareProfiles.map(profile => (
                    <li key={profile.id} className="flex items-center gap-2.5 px-4 py-2.5 lg:py-1.5 lg:px-3">
                      <ProfileAvatar profile={profile} size={30} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-800 lg:text-[10px]">{profile.display_name}</p>
                        <p className="truncate text-[11px] text-slate-400 lg:text-[9px]">{profile.location}</p>
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
                <div className="space-y-2 p-3">
                  <Link
                    href={`/app/marketplace/compare?ids=${query.compare.join(',')}`}
                    className="block rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-700 lg:text-[11px]"
                  >
                    Compare {compareProfiles.length} provider{compareProfiles.length === 1 ? '' : 's'}
                  </Link>
                  <Link
                    href={`/app/marketplace/compare?ids=${query.compare.join(',')}`}
                    className="flex items-center justify-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 lg:text-[10px]"
                  >
                    <GitCompareArrows size={13} />View comparison table
                  </Link>
                </div>
              </>
            )}
          </Panel>

          {session.capabilities.createRequest && (
            <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-blue-50 p-5 lg:p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-violet-900 lg:text-[11px]">Create an RFQ</h3>
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 lg:text-[8.5px]">Recommended</span>
              </div>
              <p className="mt-1 text-xs text-violet-800 lg:text-[10px]">Get tailored proposals from verified providers.</p>
              <ul className="mt-3 space-y-1.5 text-xs text-violet-900 lg:text-[10px]">
                {['Describe your project', 'Receive custom proposals', 'Compare and hire confidently'].map(item => (
                  <li key={item} className="flex items-center gap-1.5">
                    <ShieldCheck size={13} className="shrink-0 text-violet-600" />{item}
                  </li>
                ))}
              </ul>
              <Link
                href={`${MODULE_ROUTES.requests}?new=rfq`}
                className="mt-4 block rounded-lg bg-violet-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-violet-700 lg:text-[11px]"
              >
                Create RFQ
              </Link>
              <Link
                href={`${MODULE_ROUTES.requests}?type=rfq`}
                className="mt-2 block text-center text-xs font-medium text-violet-700 hover:text-violet-900 lg:text-[10px]"
              >
                View my RFQs ({requests.total})
              </Link>
            </div>
          )}

          <Panel title="Quick actions" padded={false}>
            <ul className="divide-y divide-slate-100">
              {[
                { href: MODULE_ROUTES.saved, icon: <Bookmark size={15} />, title: 'Saved providers', note: 'View your saved providers' },
                { href: `${MODULE_ROUTES.saved}#searches`, icon: <Clock3 size={15} />, title: 'Recent searches', note: 'View your search history' },
                { href: MODULE_ROUTES.categories, icon: <Boxes size={15} />, title: 'Category explorer', note: 'Browse all service categories' },
                { href: '/help/marketplace', icon: <LifeBuoy size={15} />, title: 'Help and support', note: 'Get help with the marketplace' },
              ].map(action => (
                <li key={action.title}>
                  <Link href={action.href} className="flex items-center gap-2.5 px-4 py-3 hover:bg-slate-50 lg:py-2 lg:px-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">{action.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 lg:text-[10px]">{action.title}</p>
                      <p className="truncate text-[11px] text-slate-500 lg:text-[9px]">{action.note}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Buying with confidence" padded>
            <ul className="space-y-2.5 text-xs text-slate-600 lg:text-[10px]">
              <li className="flex items-start gap-2">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                Funds are held in escrow until you approve delivery.
              </li>
              <li className="flex items-start gap-2">
                <FileText size={14} className="mt-0.5 shrink-0 text-blue-600" />
                Every order records scope, milestones and an audit trail.
              </li>
              <li className="flex items-start gap-2">
                <Headphones size={14} className="mt-0.5 shrink-0 text-violet-600" />
                Disputes are reviewed with evidence from both sides.
              </li>
            </ul>
          </Panel>
        </div>
      </div>

      <CompareTray railWidth={250}
        profiles={compareProfiles} query={query} pathname={PATH}
        limit={session.capabilities.compareLimit}
      />
    </MarketplacePage>
  )
}
