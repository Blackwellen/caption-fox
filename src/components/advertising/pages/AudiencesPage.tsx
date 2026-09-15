import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  AlertTriangle, ArrowRight, Download, Dumbbell, Globe2, Repeat2, Sparkles, ThumbsUp, UserCheck, UserRound, Users2, UsersRound,
} from 'lucide-react'
import type { AdvertisingSession } from '@/lib/advertising/queries/context'
import { comparisonRange, kpi, loadMetrics, resolveRange, series, totals } from '@/lib/advertising/queries/shared'
import {
  getAudienceComposition, getAudienceDetails, getOverlapPairs, SIZE_BUCKETS, type AudienceDetailRow,
} from '@/lib/advertising/queries/audiences'
import { providerLabel } from '@/lib/advertising/queries/overview'
import { formatCurrency, formatDateRange, formatNumber, formatPercent, formatRoas } from '@/lib/advertising/metrics'
import { AD_PROVIDER_IDS, providerColor } from '@/lib/advertising/providers'
import PageHeader from '../PageHeader'
import KpiCard from '../KpiCard'
import ProviderLogo from '../ProviderLogo'
import StatusPill, { AUDIENCE_STATUS, AUDIENCE_TYPE_LABELS } from '../StatusPill'
import { ClearFiltersButton, SearchInput, ViewSwitcher } from '../Controls'
import { ChipSelect, KebabMenu, ScrollRow } from '../MiniControls'
import { EmptyState, InfoDot, Panel } from '../Primitives'
import TrendChart, { TrendLegend } from '../TrendChart'
import Donut from '../Donut'
import ExportSplit from '../ExportSplit'
import RefreshAudienceButton from '../client/RefreshAudienceButton'
import { CreateAudienceButton, SyncSegmentsButton } from '../client/AudienceActions'

// /{type}/advertising/audiences — built to design reference (5).
// Header, six KPI cards, the filter/view row, the audience card strip (or the
// overlap matrix), Growth / Composition / Platform Distribution, then the
// Audience Performance & Overlap table.

type SearchParams = Record<string, string | string[] | undefined>
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null
const compact = (value: number | null) => value === null ? '—' : formatNumber(value, { compact: true })

const TYPE_STYLE: Record<string, { icon: ReactNode; bg: string; pill: string; color: string }> = {
  custom: { icon: <UserRound size={18} />, bg: 'bg-violet-500', pill: 'bg-violet-50 text-violet-700', color: '#8B5CF6' },
  lookalike: { icon: <UsersRound size={18} />, bg: 'bg-blue-500', pill: 'bg-blue-50 text-blue-700', color: '#3B82F6' },
  website_visitors: { icon: <Globe2 size={18} />, bg: 'bg-teal-600', pill: 'bg-teal-50 text-teal-700', color: '#0D9488' },
  engagers: { icon: <ThumbsUp size={18} />, bg: 'bg-orange-500', pill: 'bg-orange-50 text-orange-700', color: '#F59E0B' },
  crm_list: { icon: <UserCheck size={18} />, bg: 'bg-indigo-500', pill: 'bg-indigo-50 text-indigo-700', color: '#6366F1' },
  interest: { icon: <Dumbbell size={18} />, bg: 'bg-amber-400', pill: 'bg-amber-50 text-amber-700', color: '#EC4899' },
  video_viewers: { icon: <Repeat2 size={18} />, bg: 'bg-rose-500', pill: 'bg-rose-50 text-rose-700', color: '#F43F5E' },
}
const style = (type: string) => TYPE_STYLE[type] ?? TYPE_STYLE.custom
// Card status is plain coloured text in the design, not a pill.
const AUDIENCE_TEXT: Record<string, string> = {
  green: 'text-emerald-600', blue: 'text-blue-600', amber: 'text-amber-600', red: 'text-red-600', slate: 'text-slate-500', violet: 'text-violet-600',
}
// Linked-campaign chips cycle through soft tints, as in the reference.
const CHIP_TINTS = ['bg-teal-50 text-teal-700', 'bg-blue-50 text-blue-700', 'bg-violet-50 text-violet-700', 'bg-amber-50 text-amber-700']
const chipInitials = (name: string) => name.split(/[\s|:]+/).filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase()

function AudienceCard({ row, base, canSync, workspaceId, workspaceType }: { row: AudienceDetailRow; base: string; canSync: boolean; workspaceId: string; workspaceType: string }) {
  const s = style(row.audienceType)
  return (
    // Six cards fit the strip at 1491 wide, as in the design.
    <article className="flex w-[188px] shrink-0 snap-start flex-col rounded-xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]" title={row.name}>
      <div className="flex items-start justify-between gap-1">
        <Link href={`${base}/audiences/${row.id}`} className="flex min-w-0 items-center gap-2">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${s.bg} [&>svg]:h-4 [&>svg]:w-4`} aria-hidden>{s.icon}</span>
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-semibold text-slate-900 hover:text-blue-700">{row.name}</span>
            <span className={`mt-0.5 inline-block max-w-full truncate whitespace-nowrap rounded px-1.5 py-px align-top text-[10px] font-medium ${s.pill}`}>{AUDIENCE_TYPE_LABELS[row.audienceType] ?? row.audienceType}</span>
          </span>
        </Link>
        <KebabMenu size="sm" label={`${row.name} actions`}>
          <Link href={`${base}/audiences/${row.id}`}>View audience</Link>
          <Link href="?view=overlap">Check overlap</Link>
        </KebabMenu>
      </div>
      <div className="mt-2.5 flex items-center gap-2"><ProviderLogo provider={row.provider} size={17} /></div>
      <dl className="mt-2.5 grid grid-cols-[0.9fr_1.1fr_1fr] gap-x-2.5 text-[10.5px] [&_dt]:whitespace-nowrap">
        <div><dt className="text-slate-500">Size</dt><dd className="mt-0.5 text-[12.5px] font-medium text-slate-900">{compact(row.sizeEstimate)}</dd></div>
        <div><dt className="text-slate-500">Match Rate</dt><dd className="mt-0.5 text-[12.5px] font-medium text-slate-900">{row.matchRate === null ? '—' : `${Math.round(Number(row.matchRate))}%`}</dd></div>
        <div className="border-l border-slate-100 pl-2.5"><dt className="text-slate-500">Refresh</dt><dd className="mt-0.5 text-[12.5px] font-medium capitalize text-slate-900">{row.refreshSchedule ?? '—'}</dd></div>
      </dl>
      <dl className="mt-2.5 grid grid-cols-2 gap-x-2 text-[10.5px]">
        <div><dt className="text-slate-500">Status</dt><dd className={`mt-0.5 text-[12.5px] font-semibold ${AUDIENCE_TEXT[AUDIENCE_STATUS[row.refreshStatus]?.tone ?? 'slate']}`}>{AUDIENCE_STATUS[row.refreshStatus]?.label ?? row.refreshStatus}</dd></div>
        <div>
          <dt className="text-slate-500">Spend Impact</dt>
          <dd className={`mt-0.5 text-[12px] font-semibold ${row.spendImpactPct === null ? 'text-slate-400' : row.spendImpactPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {row.spendImpactPct === null ? '—' : `${row.spendImpactPct >= 0 ? '↑' : '↓'} ${Math.abs(row.spendImpactPct).toFixed(1)}%`}
          </dd>
        </div>
      </dl>
      <div className="mt-2.5 border-t border-slate-100 pt-2">
        <p className="text-[10.5px] text-slate-500">Linked Campaigns</p>
        <div className="mt-1.5 flex items-center gap-1">
          {row.linkedCampaigns.length === 0 ? <span className="text-[11px] text-slate-400">Not used yet</span> : row.linkedCampaigns.slice(0, 3).map((campaign, index) => (
            <Link key={campaign.id} href={`${base}/campaigns/${campaign.id}`} title={campaign.name} className={`flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1 text-[9.5px] font-semibold hover:ring-1 hover:ring-blue-300 ${CHIP_TINTS[index % CHIP_TINTS.length]}`}>{chipInitials(campaign.name)}</Link>
          ))}
          {row.linkedCampaigns.length > 3 && <span className="flex h-[22px] items-center rounded-md bg-slate-100 px-1.5 text-[10px] font-medium text-slate-500">+{row.linkedCampaigns.length - 3}</span>}
          {canSync && <span className="ml-auto"><RefreshAudienceButton iconOnly workspaceId={workspaceId} workspaceType={workspaceType} audienceId={row.id} /></span>}
        </div>
      </div>
    </article>
  )
}

export default async function AudiencesPage({
  session, searchParams, nav,
}: { session: AdvertisingSession; searchParams: SearchParams; nav?: ReactNode }) {
  const range = resolveRange({ preset: first(searchParams.range) })
  const compare = comparisonRange(range, first(searchParams.compare))
  const base = session.basePath
  const workspaceId = session.workspace.id
  const view = ['table', 'overlap'].includes(first(searchParams.view) ?? '') ? first(searchParams.view)! : 'cards'
  const distMetric = first(searchParams.dist) === 'spend' ? 'spend' : 'reach'

  const filters = {
    q: first(searchParams.q), platform: first(searchParams.platform), audienceType: first(searchParams.audienceType),
    refreshStatus: first(searchParams.refreshStatus), size: first(searchParams.size), usage: first(searchParams.usage),
  }
  const [rows, allAudiences, overlaps, composition, currentRows, previousRows, accountRows] = await Promise.all([
    getAudienceDetails(session.supabase, workspaceId, range, compare, filters),
    session.supabase.from('ad_audiences').select('id, name, status').eq('workspace_id', workspaceId).neq('status', 'archived').order('name'),
    getOverlapPairs(session.supabase, workspaceId, 50),
    getAudienceComposition(session.supabase, workspaceId),
    loadMetrics(session.supabase, { workspaceId, entityType: 'audience', range }),
    loadMetrics(session.supabase, { workspaceId, entityType: 'audience', range: compare }),
    session.supabase.from('ad_accounts').select('id, name, provider').eq('workspace_id', workspaceId).order('name'),
  ])

  const canCreate = session.capabilities['audiences.create']
  const canSync = session.capabilities['audiences.sync']
  const canExport = session.capabilities['audiences.export']
  const now = totals(currentRows)
  const before = totals(previousRows)
  const rangeLabel = formatDateRange(new Date(`${range.since}T00:00:00Z`), new Date(`${range.until}T00:00:00Z`))
  const compareLabel = formatDateRange(new Date(`${compare.since}T00:00:00Z`), new Date(`${compare.until}T00:00:00Z`))
  const matched = rows.reduce((sum, row) => sum + Number(row.matchedUsers ?? 0), 0)
  const activeCount = (allAudiences.data ?? []).filter(row => row.status === 'ready').length
  const topRoas = [...rows].filter(row => row.roas !== null).sort((a, b) => b.roas! - a.roas!)[0]
  // An overlap above 30% means two audiences are bidding against each other for the same people.
  const overlapAlerts = overlaps.filter(pair => (pair.overlapPct ?? 0) > 30)
  const activeFilterCount = Object.values(filters).filter(Boolean).length
  const exportHref = `/api/advertising/export?workspaceType=${session.workspaceType}&range=${first(searchParams.range) ?? 'last_30'}${filters.platform ? `&platform=${filters.platform}` : ''}`

  const reachSeries = series(currentRows, range, 'reach')
  const reachPrevious = series(previousRows, compare, 'reach')
  const cumulative = (points: { date: string; value: number }[]) => { let run = 0; return points.map(point => ({ date: point.date, value: (run += point.value) })) }

  const byProvider = new Map<string, { reach: number; spend: number }>()
  for (const row of currentRows) {
    const entry = byProvider.get(row.provider) ?? { reach: 0, spend: 0 }
    entry.reach += Number(row.reach); entry.spend += Number(row.spend)
    byProvider.set(row.provider, entry)
  }
  const distribution = [...byProvider].map(([provider, value]) => ({ provider, value: value[distMetric] })).sort((a, b) => b.value - a.value)
  const distTotal = distribution.reduce((sum, row) => sum + row.value, 0) || 1

  const cards = [
    { value: kpi({ id: 'reach', label: 'Reach', format: 'number', current: now.reach, previous: before.reach, spark: reachSeries, tooltip: 'People reached across audiences (summed daily reach; platforms do not share deduplicated reach).' }), icon: <Users2 />, accent: '#7C3AED' },
    { value: kpi({ id: 'matched', label: 'Matched Users', format: 'number', current: matched, previous: null, spark: [], tooltip: 'Users the platforms matched for these audiences.' }), icon: <UserCheck />, accent: '#2563EB' },
    { value: kpi({ id: 'active', label: 'Active Audiences', format: 'integer', current: activeCount, previous: null, spark: [], tooltip: 'Audiences ready to use.' }), icon: <UsersRound />, accent: '#0D9488' },
    { value: kpi({ id: 'frequency', label: 'Avg Frequency', format: 'number', current: now.frequency, previous: before.frequency, spark: series(currentRows, range, 'impressions').map((point, index) => ({ date: point.date, value: reachSeries[index]?.value ? point.value / reachSeries[index].value : 0 })), tooltip: 'Impressions divided by reach.', inverse: true }), icon: <Repeat2 />, accent: '#EA580C' },
  ]

  return (
    <div>
      <PageHeader
        title="Advertising Audiences" hint="Custom audiences, lookalikes and retargeting pools across every platform."
        subtitle="Manage audience segments, lookalikes, retargeting pools, and assess readiness across platforms."
        nav={nav}
      >
        <SyncSegmentsButton workspaceId={workspaceId} workspaceType={session.workspaceType} audienceIds={(allAudiences.data ?? []).map(row => row.id as string)}
          disabledReason={canSync ? null : 'Your role or connected platforms cannot sync audiences.'} />
        <CreateAudienceButton workspaceId={workspaceId} workspaceType={session.workspaceType} basePath={base}
          accounts={(accountRows.data ?? []).map(row => ({ id: row.id as string, name: row.name as string, providerName: providerLabel(row.provider as string) }))}
          audiences={(allAudiences.data ?? []).map(row => ({ id: row.id as string, name: row.name as string }))}
          disabledReason={canCreate ? null : 'Your role or connected platforms cannot create audiences.'} />
        {canExport && <ExportSplit href={exportHref} primary="audiences" />}
      </PageHeader>

      <section className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6" aria-label="Audience metrics">
        {cards.map(card => <KpiCard key={card.value.id} kpi={card.value} icon={card.icon} accent={card.accent} comparisonLabel={compareLabel} />)}
        <div className="flex min-w-0 flex-col rounded-xl border border-slate-200/80 bg-white px-4 pb-2.5 pt-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="flex items-center gap-2 text-[12.5px] font-medium text-slate-600"><Sparkles size={15} className="text-violet-500" aria-hidden />Top ROAS Segment</p>
          {topRoas ? (
            <Link href={`${base}/audiences/${topRoas.id}`} className="mt-2 block truncate text-[18px] font-semibold text-slate-900 hover:text-blue-700">{topRoas.name}</Link>
          ) : <p className="mt-2 text-[18px] font-semibold text-slate-300">—</p>}
          <p className="mt-1.5 text-[12px] text-slate-500">ROAS <span className="font-semibold text-slate-800">{formatRoas(topRoas?.roas ?? null)}</span></p>
          <p className="mt-auto pt-2 text-[11px] text-slate-400">{rangeLabel}</p>
        </div>
        <div className="flex min-w-0 flex-col rounded-xl border border-slate-200/80 bg-white px-4 pb-2.5 pt-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="flex items-center gap-2 text-[12.5px] font-medium text-slate-600"><AlertTriangle size={15} className="text-red-500" aria-hidden />Overlap Alerts</p>
          <p className="mt-2 text-[21px] font-semibold leading-none text-slate-900">{overlapAlerts.length}</p>
          <Link href="?view=overlap" className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-blue-600 hover:underline">View alerts <ArrowRight size={13} aria-hidden /></Link>
          <p className="mt-auto truncate pt-2 text-[11px] text-slate-400" title="Audience pairs overlapping more than 30%">Pairs over 30% overlap</p>
        </div>
      </section>

      <Panel className="mb-2" padded={false}>
        <div className="flex flex-wrap items-center gap-2 p-3">
          <SearchInput placeholder="Search audiences by name, type, or description..." className="min-w-[200px] flex-1 sm:max-w-[280px]" ariaLabel="Search audiences" />
          <ChipSelect paramKey="platform" label="Platform" allLabel="Platform" options={AD_PROVIDER_IDS.map(id => ({ value: id, label: providerLabel(id) }))} className="[&>span]:h-[30px]" />
          <ChipSelect paramKey="audienceType" label="Audience type" allLabel="Audience Type" options={Object.entries(AUDIENCE_TYPE_LABELS).map(([value, label]) => ({ value, label }))} className="[&>span]:h-[30px]" />
          <ChipSelect paramKey="size" label="Size" allLabel="Size" options={SIZE_BUCKETS.map(bucket => ({ value: bucket.value, label: bucket.label }))} className="[&>span]:h-[30px]" />
          <ChipSelect paramKey="refreshStatus" label="Refresh status" allLabel="Refresh Status" options={Object.entries(AUDIENCE_STATUS).map(([value, entry]) => ({ value, label: entry.label }))} className="[&>span]:h-[30px]" />
          <ChipSelect paramKey="usage" label="Campaign usage" allLabel="Campaign Usage" options={[{ value: 'used', label: 'Used in campaigns' }, { value: 'unused', label: 'Not used' }]} className="[&>span]:h-[30px]" />
          <ClearFiltersButton activeCount={activeFilterCount} keep={['view', 'range']} />
          <div className="ml-auto">
            <ViewSwitcher defaultView="cards" views={[
              { value: 'cards', label: 'Cards', icon: 'cards' }, { value: 'table', label: 'Table', icon: 'table' }, { value: 'overlap', label: 'Overlap', icon: 'overlap' },
            ]} />
          </div>
        </div>
      </Panel>

      {view === 'overlap' ? (
        <Panel className="mb-2">
          <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-900">Audience Overlap <InfoDot label="Measured overlap between pairs of audiences. Above 30% the audiences compete for the same people; consider an exclusion." /></h2>
          {overlaps.length === 0 ? <EmptyState compact title="No overlap measured yet" description="Overlap appears once a platform reports it for two audiences on the same account." className="mt-3" /> : (
            <ul className="mt-3 grid gap-2 md:grid-cols-2">
              {overlaps.map(pair => {
                const pct = pair.overlapPct ?? 0
                return (
                  <li key={`${pair.audienceAId}-${pair.audienceBId}`} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="min-w-0 truncate">
                        <Link href={`${base}/audiences/${pair.audienceAId}`} className="font-medium text-slate-800 hover:text-blue-700">{pair.audienceAName}</Link>
                        <span className="mx-1.5 text-slate-400">×</span>
                        <Link href={`${base}/audiences/${pair.audienceBId}`} className="font-medium text-slate-800 hover:text-blue-700">{pair.audienceBName}</Link>
                      </span>
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11.5px] font-semibold ${pct > 30 ? 'bg-red-50 text-red-700' : pct > 15 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{pct.toFixed(0)}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${pct > 30 ? 'bg-red-500' : pct > 15 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
                    <p className="mt-1.5 text-[11px] text-slate-500">{compact(pair.overlapUsers)} shared users{pct > 30 ? ' · Recommend excluding one from the other' : ''} · estimate</p>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      ) : view === 'cards' && (
        <div className="mb-2">
          {rows.length === 0 ? <Panel><EmptyState title="No audiences match these filters" description="Clear a filter or create an audience." /></Panel> : (
            <ScrollRow label="audiences">
              {rows.map(row => <AudienceCard key={row.id} row={row} base={base} canSync={canSync} workspaceId={workspaceId} workspaceType={session.workspaceType} />)}
            </ScrollRow>
          )}
        </div>
      )}

      {view !== 'table' && (
        <div className="mb-2 grid gap-2 xl:grid-cols-[1fr_0.95fr_1.1fr]">
          <Panel>
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-slate-900">Audience Growth</h2>
              <ChipSelect paramKey="range" label="Growth period" allLabel="Last 30 Days" options={[{ value: 'last_7', label: 'Last 7 Days' }, { value: 'last_14', label: 'Last 14 Days' }, { value: 'last_90', label: 'Last 90 Days' }]} />
            </div>
            <p className="mt-2 flex items-baseline gap-2"><span className="text-[21px] font-semibold text-slate-900">{compact(now.reach)}</span>
              {before.reach > 0 && <span className={`text-[12px] font-semibold ${now.reach >= before.reach ? 'text-emerald-600' : 'text-red-500'}`}>{now.reach >= before.reach ? '↑' : '↓'} {Math.abs(((now.reach - before.reach) / before.reach) * 100).toFixed(1)}%</span>}
            </p>
            <TrendChart className="mt-2" points={cumulative(reachSeries)} comparison={cumulative(reachPrevious)} format="number" height={96} color="#4F46E5" summary={`Cumulative reach for ${rangeLabel} against ${compareLabel}`} />
            <TrendLegend current={rangeLabel} comparison={compareLabel} color="#4F46E5" />
          </Panel>
          <Panel>
            <h2 className="text-[14px] font-semibold text-slate-900">Audience Composition</h2>
            {composition.length === 0 ? <EmptyState compact title="No audiences yet" description="Composition by type appears once audiences exist." className="mt-3" /> : (
              <Donut className="mt-3" size={128} thickness={22}
                centerValue={compact(composition.reduce((sum, slice) => sum + slice.value, 0))} centerLabel="Total Size"
                summary="Audience size by type"
                slices={composition.map(slice => ({ key: slice.type, label: AUDIENCE_TYPE_LABELS[slice.type] ?? slice.type, value: slice.value, color: style(slice.type).color }))} />
            )}
          </Panel>
          <Panel>
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-slate-900">Platform Distribution</h2>
              <ChipSelect paramKey="dist" label="Distribution metric" allLabel="Reach" options={[{ value: 'spend', label: 'Spend' }]} />
            </div>
            {distribution.length === 0 ? <EmptyState compact title="No delivery yet" description="Distribution appears once audiences deliver." className="mt-3" /> : (
              <ul className="mt-3 space-y-3">
                {distribution.map(row => (
                  <li key={row.provider} className="flex items-center gap-3">
                    <ProviderLogo provider={row.provider} size={24} decorative />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] leading-4 text-slate-600">{providerLabel(row.provider)}</p>
                      {/* Label above; bar, value and share on one line, as in the design. */}
                      <div className="mt-1 flex items-center gap-2.5">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${(row.value / distTotal) * 100}%`, backgroundColor: providerColor(row.provider) }} /></div>
                        <span className="w-14 shrink-0 whitespace-nowrap text-right text-[11.5px] tabular-nums text-slate-700">{distMetric === 'spend' ? formatCurrency(row.value, undefined, { compact: true }) : compact(row.value)}</span>
                        <span className="w-11 shrink-0 text-right text-[11.5px] tabular-nums text-slate-600">{((row.value / distTotal) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      <Panel padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 pb-3">
          <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-900">Audience Performance &amp; Overlap <InfoDot label="Every audience with its highest overlap against any other, and where it is excluded." /></h2>
          {canExport && (
            <a href={`${exportHref}&dataset=audiences`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50"><Download size={14} aria-hidden /> Download</a>
          )}
        </div>
        {rows.length === 0 ? <div className="px-4 pb-4"><EmptyState compact title="No audiences" description="Audiences matching the filters appear here." /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1060px] text-left text-[12px]">
              <caption className="sr-only">Audience performance and overlap</caption>
              <thead>
                <tr className="border-y border-slate-100 text-[11.5px] text-slate-700">
                  {['Audience Name', 'Type', 'Platform', 'Size', 'Match Rate', 'Overlap (vs All)', 'Exclude From', 'Recency Window', 'ROAS', 'CPA', 'CTR', 'Spend', 'Status', ''].map(header => <th key={header} className="px-3 py-2 font-semibold first:pl-4">{header}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="py-1 pl-4 pr-3"><Link href={`${base}/audiences/${row.id}`} className="font-medium text-slate-800 hover:text-blue-700">{row.name}</Link></td>
                    <td className="px-3 py-1 text-slate-600">{AUDIENCE_TYPE_LABELS[row.audienceType] ?? row.audienceType}</td>
                    <td className="px-3 py-1"><ProviderLogo provider={row.provider} size={15} /></td>
                    <td className="px-3 py-1 tabular-nums">{compact(row.sizeEstimate)}</td>
                    <td className="px-3 py-1 tabular-nums">{row.matchRate === null ? '—' : `${Math.round(Number(row.matchRate))}%`}</td>
                    <td className="px-3 py-1">
                      {row.maxOverlapPct === null ? <span className="text-slate-400">—</span> : (
                        <span className="flex items-center gap-2"><span className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, row.maxOverlapPct)}%` }} /></span><span className="tabular-nums">{row.maxOverlapPct.toFixed(0)}%</span></span>
                      )}
                    </td>
                    <td className="px-3 py-1 text-slate-600">{row.excludeFromName ?? '—'}</td>
                    <td className="px-3 py-1 text-slate-600">{row.recencyDays ? `${row.recencyDays} Days` : '—'}</td>
                    <td className={`px-3 py-1 font-medium tabular-nums ${row.roas === null ? '' : row.roas >= 4 ? 'text-emerald-600' : row.roas < 2 ? 'text-red-500' : 'text-slate-700'}`}>{formatRoas(row.roas)}</td>
                    <td className="px-3 py-1 tabular-nums">{formatCurrency(row.cpa)}</td>
                    <td className="px-3 py-1 tabular-nums">{formatPercent(row.ctr)}</td>
                    <td className="px-3 py-1 tabular-nums">{formatCurrency(row.spend)}</td>
                    <td className="px-3 py-1"><StatusPill status={row.status === 'ready' ? 'ready' : row.status} map={AUDIENCE_STATUS} dot={false} label={row.status === 'ready' ? 'Active' : undefined} className="rounded-md px-1.5 text-[10.5px]" /></td>
                    <td className="px-3 py-1"><KebabMenu size="sm" label={`${row.name} actions`}><Link href={`${base}/audiences/${row.id}`}>View audience</Link><Link href="?view=overlap">Check overlap</Link></KebabMenu></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
