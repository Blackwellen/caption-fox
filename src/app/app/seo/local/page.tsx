import { LayoutGrid, List as ListIcon, MapPin, Star, Table as TableIcon } from 'lucide-react'
import { requireSeoTab } from '@/lib/seo/server'
import {
  getActivity, getListingsHealth, getLocalTrend, getLocations, getOpportunities, getReviewSummary, getSiteDailyWithCompare,
} from '@/lib/seo/queries'
import { buildKpis } from '@/lib/seo/kpis'
import { matchPreset } from '@/lib/seo/range'
import { formatCompact, formatDecimal, humanise } from '@/lib/seo/format'
import { availableSeoViews } from '@/lib/seo/entitlements'
import { readEnum, readParam } from '@/lib/seo/url-state'
import { Card, CardHeader, EmptyPanel, StatusChip } from '@/components/seo/primitives'
import { KpiStrip } from '@/components/seo/KpiStrip'
import { SeoHeader } from '@/components/seo/SeoHeader'
import { SeoPageChrome } from '@/components/seo/SeoPageChrome'
import { ActivityFeed } from '@/components/seo/ActivityFeed'
import { FilterBar, ViewSwitcher } from '@/components/seo/FilterBar'
import { TrendChart } from '@/components/seo/charts'
import { LocationMap } from '@/components/seo/LocationMap'
import { AddLocationWizard } from '@/components/seo/wizards/AddLocationWizard'
import { buildExportHref, type SearchParams } from '@/lib/seo/url-state'
import type { SeoLocation } from '@/lib/seo/types'

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
}

export default async function SeoLocalPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const session = await requireSeoTab('local', params)
  const { site, ctx, range, blocked, capabilities } = session

  if (blocked || !site) {
    return <SeoPageChrome tab="local" tabs={session.tabs} blocked={blocked ?? 'workspace-type'}>{!blocked && <EmptyPanel title="No SEO site connected yet" description="Connect a domain to start tracking local SEO performance." />}</SeoPageChrome>
  }

  const scope = { supabase: session.supabase, workspaceId: ctx.workspaceId, siteId: site.id }
  const views = availableSeoViews(ctx, VIEWS.map(v => v.id))
  const requestedView = readEnum(params, 'view', VIEWS.map(v => v.id), 'cards')!
  const view = views.includes(requestedView) ? requestedView : (views[0] as typeof requestedView)

  const [{ current, previous }, locations, trend, listings, reviews, opportunities, activity] = await Promise.all([
    getSiteDailyWithCompare(scope, range),
    getLocations(scope, { q: readParam(params, 'q'), status: readParam(params, 'status') }),
    getLocalTrend(scope, range.from, range.to),
    getListingsHealth(scope),
    getReviewSummary(scope, range),
    getOpportunities(scope, { scope: 'local', limit: 5 }),
    getActivity(scope, 'local', 5),
  ])

  const kpis = buildKpis('local', current, previous, 'google_business_profile').concat([
    { id: 'locations', label: 'Tracked Locations', value: locations.length, previous: null, format: 'number' as const, spark: [], source: 'internal_tracker', tooltip: 'Active locations tracked for this site.' },
    { id: 'local-opps', label: 'Local Opportunities', value: opportunities.length, previous: null, format: 'number' as const, spark: [], source: 'internal_tracker', tooltip: 'Open local SEO opportunities such as profile completeness and citation issues.' },
  ])

  const queryString = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => v ? [[k, Array.isArray(v) ? v[0] : v] as [string, string]] : [])).toString()

  return (
    <SeoPageChrome tab="local" tabs={session.tabs} blocked={null} query={queryString}>
      <SeoHeader
        title="Local"
        subtitle="Manage local discovery, map pack presence, listings, and branch performance."
        pathname="/app/seo/local"
        activePreset={matchPreset(range)}
        exportHref={capabilities.exportLocal ? buildExportHref('local', params) : undefined}
        primarySlot={capabilities.addLocation ? <AddLocationWizard /> : undefined}
      />

      <div className="mb-5"><KpiStrip kpis={kpis} compareLabel={range.compareLabel} /></div>

      <div className="mb-4"><ViewSwitcher pathname="/app/seo/local" params={params} views={VIEWS.filter(v => views.includes(v.id))} active={view} /></div>

      <div className="mb-5 grid gap-5 xl:grid-cols-[1fr_1.4fr_1fr]">
        <Card>
          <FilterBar pathname="/app/seo/local" params={params} searchPlaceholder="Search locations..." resultCount={locations.length} resultNoun="locations" />
          {view === 'list' ? <LocationList locations={locations} /> : <LocationCards locations={locations} />}
        </Card>

        {view === 'map'
          ? (
            <Card>
              <CardHeader title="Map Pack Visibility" help="Local rank markers for tracked locations. Colour indicates the map pack ranking band." />
              <div className="p-5"><LocationMap locations={locations} /></div>
            </Card>
          )
          : (
            <Card>
              <CardHeader title="Local Ranking Trend" help="Average local rank and map pack visibility across all tracked locations." />
              <div className="p-5">
                <TrendChart
                  data={trend.map(row => ({ date: row.date, avgLocalRank: row.avgLocalRank, mapPackVisibility: row.mapPackVisibility }))}
                  series={[
                    { key: 'avgLocalRank', label: 'Average Local Rank', colour: '#2563EB', reversed: true },
                    { key: 'mapPackVisibility', label: 'Map Pack Visibility', colour: '#38BDF8', axis: 'right', dashed: true },
                  ]}
                />
              </div>
            </Card>
          )}

        <Card>
          <CardHeader title="Listings Health" />
          <ul className="divide-y divide-slate-100">
            {listings.map(listing => (
              <li key={listing.directory} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{DIRECTORY_LABEL[listing.directory]}</p>
                  <p className="text-xs text-slate-500">{listing.connectedLocations} / {listing.totalLocations} locations</p>
                </div>
                <div className="text-right">
                  <StatusChip status={listing.health} />
                  <p className="mt-1 text-xs text-slate-500">{listing.completeness}% complete</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <CardHeader title="Reviews Overview" />
          <div className="mt-3 flex items-center gap-4">
            <div>
              <p className="text-3xl font-bold text-slate-900">{formatDecimal(reviews.average, 1)}</p>
              <div className="mt-1 flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map(n => <Star key={n} size={13} className={n <= Math.round(reviews.average) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />)}
              </div>
            </div>
            <div className="flex-1 space-y-1">
              {reviews.distribution.map(row => (
                <div key={row.stars} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-slate-500">{row.stars}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-400" style={{ width: `${row.pct}%` }} /></div>
                  <span className="w-8 text-right text-slate-500">{row.pct}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
            <div><p className="text-slate-400">Total Reviews</p><p className="font-semibold text-slate-800">{formatCompact(reviews.total)}</p></div>
            <div><p className="text-slate-400">New Reviews</p><p className="font-semibold text-slate-800">{formatCompact(reviews.newReviews)}</p></div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Local Opportunities" />
          {opportunities.length === 0
            ? <EmptyPanel title="No local opportunities yet" description="Profile completeness, category and citation opportunities will appear here." />
            : (
              <ul className="divide-y divide-slate-100">
                {opportunities.map(opp => (
                  <li key={opp.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{opp.title}</p>
                      <p className="truncate text-xs text-slate-500">{opp.location?.name ?? 'All locations'} · {humanise(opp.category)}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-emerald-600">{opp.potential_lift}</span>
                    <StatusChip status={opp.priority} />
                  </li>
                ))}
              </ul>
            )}
        </Card>
      </div>

      <ActivityFeed items={activity} />
    </SeoPageChrome>
  )
}

function LocationCards({ locations }: { locations: SeoLocation[] }) {
  if (locations.length === 0) return <EmptyPanel title="No locations yet" description="Add a location to start tracking map pack visibility and listings." />
  return (
    <ul className="divide-y divide-slate-100">
      {locations.map(loc => (
        <li key={loc.id} className="flex items-center gap-3 px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{loc.name}</p>
            <p className="truncate text-xs text-slate-500">{[loc.address_line, loc.city].filter(Boolean).join(', ')}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-slate-800">{loc.avg_local_rank != null ? `#${formatDecimal(loc.avg_local_rank, 1)}` : '—'}</p>
            <StatusChip status={loc.status} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function LocationList({ locations }: { locations: SeoLocation[] }) {
  if (locations.length === 0) return <EmptyPanel title="No locations yet" description="Add a location to start tracking map pack visibility and listings." />
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-5 py-2 text-left">Location</th>
            <th className="px-3 py-2 text-left">Local Rank</th>
            <th className="px-3 py-2 text-left">Reviews</th>
            <th className="px-3 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {locations.map(loc => (
            <tr key={loc.id} className="h-12 border-b border-slate-100 last:border-0">
              <td className="px-5 py-2.5 font-medium text-slate-800">{loc.name}</td>
              <td className="px-3 py-2.5 text-slate-600">{loc.avg_local_rank != null ? `#${formatDecimal(loc.avg_local_rank, 1)}` : '—'}</td>
              <td className="px-3 py-2.5 text-slate-600">{formatDecimal(loc.review_score, 1)} ({loc.review_count})</td>
              <td className="px-3 py-2.5"><StatusChip status={loc.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
