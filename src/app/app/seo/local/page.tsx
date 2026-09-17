import Link from 'next/link'
import { ChevronRight, LayoutGrid, List as ListIcon, MapPin, Star } from 'lucide-react'
import { requireSeoTab } from '@/lib/seo/server'
import {
  getActivity, getListingsHealth, getLocalTrend, getLocations, getOpportunities, getReviewSummary, getSiteDailyWithCompare,
} from '@/lib/seo/queries'
import { buildKpis } from '@/lib/seo/kpis'
import { matchPreset, resolveGranularity } from '@/lib/seo/range'
import { formatCompact, formatDecimal, humanise } from '@/lib/seo/format'
import { availableSeoViews } from '@/lib/seo/entitlements'
import { buildExportHref, buildHref, readEnum, readParam, type SearchParams } from '@/lib/seo/url-state'
import { SEO_TOKENS, Card, CardHeader, DemoBadge, Delta, EmptyPanel, ProgressBar, StatusChip } from '@/components/seo/primitives'
import { KpiStrip } from '@/components/seo/KpiStrip'
import { SeoHeader } from '@/components/seo/SeoHeader'
import { SeoPageChrome } from '@/components/seo/SeoPageChrome'
import { ActivityFeed } from '@/components/seo/ActivityFeed'
import { FilterBar, ViewSwitcher } from '@/components/seo/FilterBar'
import { ChartLegend, TrendChart } from '@/components/seo/charts'
import { ChartRangeControls, PanelSelect, PanelTabs } from '@/components/seo/PanelControls'
import { MapPackMap } from '@/components/seo/MapPackMap'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { HeaderMenuSelect } from '@/components/seo/HeaderMenuSelect'
import { MAP_PACK_BANDS } from '@/lib/seo/map-pack'
import { AddLocationWizard } from '@/components/seo/wizards/AddLocationWizard'
import type { SeoLocation, SeoOpportunity } from '@/lib/seo/types'

export const dynamic = 'force-dynamic'

const VIEWS = [
  { id: 'cards', label: 'Cards', icon: <LayoutGrid size={13} /> },
  { id: 'list', label: 'List', icon: <ListIcon size={13} /> },
  { id: 'map', label: 'Map', icon: <MapPin size={13} /> },
] as const

const DIRECTORY_LABEL: Record<string, string> = {
  google_business_profile: 'Google Business Profile',
  bing_places: 'Bing Places',
  apple_maps: 'Apple Maps',
  facebook: 'Facebook',
  yelp: 'Yelp',
  other: 'Other directory',
}

type OppFilter = 'all' | 'high_impact' | 'quick_wins' | 'needs_attention'

const OPP_FILTERS: Record<OppFilter, (opp: SeoOpportunity) => boolean> = {
  all: () => true,
  high_impact: opp => opp.impact === 'high',
  quick_wins: opp => opp.effort === 'low',
  needs_attention: opp => opp.priority === 'high' && opp.status === 'open',
}

export default async function SeoLocalPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const session = await requireSeoTab('local', params)
  const { site, ctx, range, blocked, capabilities } = session

  if (blocked || !site) {
    return (
      <SeoPageChrome tab="local" tabs={session.tabs} blocked={blocked ?? 'workspace-type'}>
        {!blocked && <EmptyPanel title="No SEO site connected yet" description="Connect a domain to start tracking local SEO performance." />}
      </SeoPageChrome>
    )
  }

  const scope = { supabase: session.supabase, workspaceId: ctx.workspaceId, siteId: site.id }
  const views = availableSeoViews(ctx, VIEWS.map(v => v.id))
  const requestedView = readEnum(params, 'view', VIEWS.map(v => v.id), 'cards')!
  const view = views.includes(requestedView) ? requestedView : (views[0] as typeof requestedView)
  const granularity = resolveGranularity(params)
  const locationId = readParam(params, 'location')
  const category = readParam(params, 'category')
  const oppFilter = readEnum(params, 'opps', ['all', 'high_impact', 'quick_wins', 'needs_attention'] as const, 'all')!

  const [{ current, previous }, allLocations, listedLocations, trend, listings, reviews, localOpps, activity] = await Promise.all([
    getSiteDailyWithCompare(scope, range),
    getLocations(scope, {}),
    getLocations(scope, { q: readParam(params, 'q'), status: readParam(params, 'status') }),
    getLocalTrend(scope, range.from, range.to, locationId),
    getListingsHealth(scope),
    getReviewSummary(scope, range),
    getOpportunities(scope, { scope: 'local', limit: 50 }),
    getActivity(scope, 'local', 5),
  ])

  const kpis = buildKpis('local', current, previous, 'google_business_profile')
  const kpiOrder = ['map-pack', 'local-rank', 'locations', 'review-score', 'profile-views', 'local-opps']
  const extra = [
    { id: 'locations', label: 'Tracked Locations', value: allLocations.length, previous: null, format: 'number' as const, spark: [], source: 'internal_tracker', tooltip: 'Active locations tracked for this site.' },
    { id: 'local-opps', label: 'Local Opportunities', value: localOpps.filter(o => o.status !== 'done' && o.status !== 'dismissed').length, previous: null, format: 'number' as const, spark: [], source: 'internal_tracker', tooltip: 'Open local SEO opportunities such as profile completeness and citation issues.' },
  ]
  const orderedKpis = [...kpis, ...extra].sort((a, b) => kpiOrder.indexOf(a.id) - kpiOrder.indexOf(b.id))

  const categories = [...new Set(allLocations.map(l => l.primary_category).filter(Boolean))] as string[]
  const mapPoints = allLocations
    .filter(l => l.latitude != null && l.longitude != null)
    .filter(l => !locationId || l.id === locationId)
    .filter(l => !category || l.primary_category === category)
    .map(l => ({ id: l.id, name: l.name, latitude: Number(l.latitude), longitude: Number(l.longitude), rank: l.avg_local_rank != null ? Number(l.avg_local_rank) : null }))

  const oppCounts = Object.fromEntries(
    (Object.keys(OPP_FILTERS) as OppFilter[]).map(key => [key, localOpps.filter(OPP_FILTERS[key]).length]),
  ) as Record<OppFilter, number>
  const visibleOpps = localOpps.filter(OPP_FILTERS[oppFilter]).slice(0, 5)

  const locationOptions = allLocations.map(l => ({ value: l.id, label: l.name }))
  const queryString = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (v ? [[k, Array.isArray(v) ? v[0] : v] as [string, string]] : [])),
  ).toString()

  return (
    <SeoPageChrome tab="local" tabs={session.tabs} blocked={null} query={queryString}>
      <SeoHeader
        title="Local"
        subtitle="Manage local discovery, map pack presence, listings, and branch performance."
        pathname="/app/seo/local"
        activePreset={matchPreset(range)}
        rangeLabel={range.label}
        params={params}
        filters={[
          { key: 'status', placeholder: 'Location status', options: ['open', 'at_risk', 'closed'].map(v => ({ value: v, label: humanise(v) })) },
          { key: 'category', placeholder: 'Category', options: categories.map(c => ({ value: c, label: c })) },
        ]}
        badge={site.is_demo ? <span title={`Seeded demonstration data for ${site.domain}.`}><DemoBadge /></span> : undefined}
        extra={(
          <>
            <HeaderMenuSelect
              pathname="/app/seo/local"
              paramKey="location"
              value={locationId}
              label="Location"
              icon="pin"
              placeholder={`All Locations (${allLocations.length})`}
              options={locationOptions}
            />
          </>
        )}
        exportHref={capabilities.exportLocal ? buildExportHref('local', params) : undefined}
        primarySlot={capabilities.addLocation ? <AddLocationWizard /> : undefined}
      />

      <div className="mb-3"><KpiStrip kpis={orderedKpis} compareLabel={range.compareLabel} /></div>

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-3">
          <div>
            <ViewSwitcher pathname="/app/seo/local" params={params} views={VIEWS.filter(v => views.includes(v.id))} active={view} />
          </div>

          <div className={view === 'map' ? 'grid gap-3' : 'grid items-start gap-3 lg:grid-cols-[300px_minmax(0,1fr)]'}>
            {view !== 'map' && (
              <Card className="min-w-0 self-stretch">
                <CardHeader title={<>Locations <span className="ml-1 rounded-full bg-slate-100 px-1.5 text-[10.5px] font-medium text-slate-500">{allLocations.length}</span></>} />
                <FilterBar pathname="/app/seo/local" params={params} searchPlaceholder="Search locations..." />
                {view === 'list' ? <LocationList locations={listedLocations} /> : <LocationCards locations={listedLocations} params={params} />}
                {listedLocations.length > 0 && (
                  <div className="p-3">
                    <Link href="/app/seo/local?view=list" className="flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 text-[12px] font-medium text-blue-600 hover:bg-slate-50">
                      View all locations <ChevronRight size={13} aria-hidden />
                    </Link>
                  </div>
                )}
              </Card>
            )}

            <div className="flex min-w-0 flex-col gap-3">
              <Card className="min-w-0 overflow-hidden">
                <CardHeader
                  title="Map Pack Visibility"
                  help="Tracked locations placed at their real coordinates. Marker number and colour show each location's average local pack rank."
                  action={(
                    <>
                      <PanelSelect pathname="/app/seo/local" params={params} paramKey="location" label="Map location" placeholder="All locations" options={locationOptions} />
                      <PanelSelect pathname="/app/seo/local" params={params} paramKey="category" label="Map category" placeholder="All categories" options={categories.map(c => ({ value: c, label: c }))} />
                    </>
                  )}
                />
                <MapPackMap points={mapPoints} height={view === 'map' ? 420 : 196} />
                <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-2 text-[11.5px] text-slate-600">
                  <span className="font-medium text-slate-700">Map Pack Ranking</span>
                  {MAP_PACK_BANDS.map(band => (
                    <span key={band.label} className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: band.colour }} aria-hidden />
                      {band.label}
                    </span>
                  ))}
                </div>
              </Card>

              <Card className="min-w-0">
                <CardHeader
                  title="Local Ranking Trend"
                  help="Average local pack rank and map pack visibility across the tracked locations in this view."
                  action={<ChartRangeControls size="sm" pathname="/app/seo/local" params={params} activePreset={matchPreset(range)} granularity={granularity} />}
                />
                <div className="px-4 pb-2 pt-2">
                  <div className="mb-1">
                    <ChartLegend series={[{ label: 'Average Local Rank', colour: '#2563EB' }, { label: 'Map Pack Visibility', colour: '#38BDF8', dashed: true }]} />
                  </div>
                  <TrendChart
                    height={118}
                    data={trend.map(row => ({ date: row.date, avgLocalRank: row.avgLocalRank, mapPackVisibility: row.mapPackVisibility }))}
                    series={[
                      { key: 'avgLocalRank', label: 'Average Local Rank', colour: '#2563EB', reversed: true },
                      { key: 'mapPackVisibility', label: 'Map Pack Visibility', colour: '#38BDF8', axis: 'right', dashed: true },
                    ]}
                  />
                </div>
              </Card>
            </div>
          </div>

          <Card className="min-w-0">
            <CardHeader title="Local Opportunities" help="Profile, category, review, citation and schema fixes ranked by expected visibility lift." />
            <div className="border-b border-slate-100 px-4 py-1.5">
              <PanelTabs
                pathname="/app/seo/local"
                params={params}
                paramKey="opps"
                active={oppFilter}
                variant="segmented"
                tabs={[
                  { id: 'all', label: `All (${oppCounts.all})` },
                  { id: 'high_impact', label: `High Impact (${oppCounts.high_impact})` },
                  { id: 'quick_wins', label: `Quick Wins (${oppCounts.quick_wins})` },
                  { id: 'needs_attention', label: `Needs Attention (${oppCounts.needs_attention})` },
                ]}
              />
            </div>
            {visibleOpps.length === 0
              ? <EmptyPanel title="No local opportunities here" description="Profile completeness, category and citation opportunities will appear here." />
              : (
                <div className="relative overflow-x-auto">
                  <table className="w-full min-w-[720px] table-fixed text-[12.5px]">
                    <colgroup>
                      <col className="w-[28%]" /><col className="w-[12%]" /><col className="w-[9%]" /><col className="w-[11%]" />
                      <col className="w-[13%]" /><col className="w-[8%]" /><col className="w-[11%]" /><col className="w-[8%]" />
                    </colgroup>
                    <thead>
                      <tr className={SEO_TOKENS.tableHead}>
                        <th scope="col" className="px-4 py-2 text-left">Opportunity</th>
                        <th scope="col" className="px-2 py-2 text-left">Location</th>
                        <th scope="col" className="px-2 py-2 text-left">Impact</th>
                        <th scope="col" className="px-2 py-2 text-left">Category</th>
                        <th scope="col" className="px-2 py-2 text-left">Potential Lift</th>
                        <th scope="col" className="px-2 py-2 text-left">Effort</th>
                        <th scope="col" className="px-2 py-2 text-left">Status</th>
                        <th scope="col" className="px-2 py-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleOpps.map(opp => (
                        <tr key={opp.id} className={SEO_TOKENS.tableRowTight}>
                          <td className="truncate px-4 py-1.5 font-medium text-slate-800">{opp.title}</td>
                          <td className="truncate px-2 py-1.5 text-slate-600">{shortLocation(opp.location?.name) ?? 'All locations'}</td>
                          <td className="px-2 py-1.5"><StatusChip status={opp.impact} /></td>
                          <td className="truncate px-2 py-1.5 text-slate-600">{categoryLabel(opp.category)}</td>
                          <td className="truncate px-2 py-1.5 text-slate-600">{opp.potential_lift ?? '—'}</td>
                          <td className="px-2 py-1.5"><StatusChip status={effortTone(opp.effort)} label={humanise(opp.effort)} /></td>
                          <td className="px-2 py-1.5"><StatusChip status={opp.status} /></td>
                          <td className="px-2 py-1.5">
                            <Link
                              href={opp.location_id ? buildHref('/app/seo/local', params, { location: opp.location_id }) : '/app/seo/local'}
                              className="inline-flex h-6 items-center rounded-md border border-slate-200 px-2 text-[11px] font-medium text-blue-600 hover:bg-slate-50"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[11.5px] text-slate-500">
              <span>Showing {visibleOpps.length === 0 ? 0 : 1} to {visibleOpps.length} of {oppCounts[oppFilter]} opportunities</span>
            </div>
          </Card>
        </div>

        {/* ── Right rail ──────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-3">
          <Card className="min-w-0">
            <CardHeader title="Listings Health" help="Directory completeness and sync health across every tracked location." />
            {listings.length === 0
              ? <EmptyPanel title="No directory listings yet" description="Connect Google Business Profile or another directory to track listing health." />
              : (
                <ul className="divide-y divide-slate-100">
                  {listings.map(listing => {
                    return (
                      <li key={listing.directory} className="flex items-center gap-3 px-4 py-2">
                        <BrandLogo brand={listing.directory} size={20} tile tileSize={34} />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center justify-between gap-2">
                            <span className="truncate text-[12.5px] font-medium text-slate-800">{DIRECTORY_LABEL[listing.directory]}</span>
                            <StatusChip status={listing.health} />
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="w-8 text-[12.5px] font-semibold text-slate-800">{listing.completeness}%</span>
                            <span className="text-[10.5px] text-slate-400">Complete</span>
                            <span className="min-w-0 flex-1"><ProgressBar value={listing.completeness} label={`${DIRECTORY_LABEL[listing.directory]} completeness`} /></span>
                          </div>
                        </div>
                        <div className="w-14 shrink-0 text-right">
                          <p className="text-[12.5px] font-semibold text-slate-800">{listing.connectedLocations} <span className="font-normal text-slate-400">/ {listing.totalLocations}</span></p>
                          <p className="text-[10.5px] text-slate-400">Locations</p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
          </Card>

          <Card className="min-w-0">
            <CardHeader title="Reviews Overview" help="Review ratings collected from connected directories for all tracked locations." />
            {reviews.total === 0
              ? <EmptyPanel title="No reviews yet" description="Reviews appear once a directory with reviews is connected." />
              : (
                <>
                  <div className="flex items-center gap-4 px-4 py-3">
                    <div className="shrink-0">
                      <p className="text-[26px] font-semibold leading-none text-slate-900">{formatDecimal(reviews.average, 1)}</p>
                      <div className="mt-1.5 flex items-center gap-0.5" aria-label={`${formatDecimal(reviews.average, 1)} out of 5 stars`}>
                        {[1, 2, 3, 4, 5].map(n => (
                          <Star key={n} size={13} aria-hidden className={n <= Math.round(reviews.average) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
                        ))}
                      </div>
                      <p className="mt-1.5 text-[10.5px] text-slate-500">
                        <Delta value={reviews.changeVsPrevious} size="xs" /> {range.compareLabel}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      {reviews.distribution.map(row => (
                        <div key={row.stars} className="flex items-center gap-2 text-[11px]">
                          <span className="w-6 shrink-0 text-slate-500">{row.stars} ★</span>
                          <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-blue-600" style={{ width: `${row.pct}%` }} />
                          </div>
                          <span className="w-9 shrink-0 text-right text-slate-500">{Math.round(row.pct)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 border-t border-slate-100 text-[12px]">
                    <div className="px-4 py-2">
                      <p className="text-[11px] text-slate-500">Total Reviews</p>
                      <p className="mt-0.5 text-[15px] font-semibold text-slate-900">{formatCompact(reviews.total)}</p>
                    </div>
                    <div className="border-l border-slate-100 px-4 py-2">
                      <p className="text-[11px] text-slate-500">New Reviews</p>
                      <p className="mt-0.5 text-[15px] font-semibold text-slate-900">{formatCompact(reviews.newReviews)}</p>
                    </div>
                  </div>
                </>
              )}
          </Card>

          <ActivityFeed title="Recent Activity" items={activity} layout="list" viewAllHref="/app/seo" />
        </div>
      </div>
    </SeoPageChrome>
  )
}

function shortLocation(name?: string | null) {
  if (!name) return null
  const parts = name.split(/\s[—-]\s/)
  return parts[parts.length - 1]
}

function categoryLabel(category: string) {
  const map: Record<string, string> = {
    profile_completeness: 'Profile',
    missing_category: 'Profile',
    reviews: 'Reviews',
    citations: 'Citations',
    local_schema: 'SEO',
  }
  return map[category] ?? humanise(category)
}

function effortTone(effort: string) {
  return effort === 'low' ? 'healthy' : effort === 'medium' ? 'medium' : 'high'
}

function LocationThumb({ location }: { location: SeoLocation }) {
  if (location.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- storage-backed location photo
      <img src={location.image_url} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
    )
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600" aria-hidden>
      <MapPin size={16} />
    </span>
  )
}

function LocationCards({ locations, params }: { locations: SeoLocation[]; params: SearchParams }) {
  if (locations.length === 0) {
    return <EmptyPanel title="No locations match" description="Add a location, or clear the search to see every tracked location." />
  }
  return (
    <ul className="divide-y divide-slate-100">
      {locations.slice(0, 6).map(loc => {
        const rank = loc.avg_local_rank != null ? Number(loc.avg_local_rank) : null
        const rankTone = rank == null ? 'bg-slate-100 text-slate-500' : rank <= 3 ? 'bg-emerald-50 text-emerald-700' : rank <= 6 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
        return (
          <li key={loc.id}>
            <Link href={buildHref('/app/seo/local', params, { location: loc.id })} className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50">
              <LocationThumb location={loc} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-slate-800">{loc.name}</p>
                <p className="truncate text-[11px] text-slate-500">{[loc.address_line, loc.city].filter(Boolean).join(', ')}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className={`rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold ${rankTone}`}>{rank != null ? formatDecimal(rank, 1) : '—'}</span>
                <span className={`flex items-center gap-1 text-[10.5px] font-medium ${loc.status === 'open' ? 'text-emerald-600' : loc.status === 'at_risk' ? 'text-amber-600' : 'text-slate-500'}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                  {humanise(loc.status)}
                </span>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function LocationList({ locations }: { locations: SeoLocation[] }) {
  if (locations.length === 0) {
    return <EmptyPanel title="No locations match" description="Add a location, or clear the search to see every tracked location." />
  }
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className={SEO_TOKENS.tableHead}>
            <th scope="col" className="px-4 py-2 text-left">Location</th>
            <th scope="col" className="px-2 py-2 text-right">Rank</th>
            <th scope="col" className="px-2 py-2 text-right">Reviews</th>
            <th scope="col" className="px-3 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {locations.map(loc => (
            <tr key={loc.id} className={SEO_TOKENS.tableRowTight}>
              <td className="max-w-[120px] truncate px-4 py-1.5 font-medium text-slate-800">{loc.name}</td>
              <td className="px-2 py-1.5 text-right text-slate-600">{loc.avg_local_rank != null ? formatDecimal(loc.avg_local_rank, 1) : '—'}</td>
              <td className="px-2 py-1.5 text-right text-slate-600">{loc.review_score != null ? formatDecimal(loc.review_score, 1) : '—'} ({loc.review_count})</td>
              <td className="px-3 py-1.5 text-slate-500"><StatusChip status={loc.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

