import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  BadgeCheck, CircleDollarSign, Clapperboard, Film, GalleryHorizontal, Image as ImageIcon, MousePointerClick,
  Play, ShieldAlert, Smartphone, Sparkles, Trophy, Zap,
} from 'lucide-react'
import type { AdvertisingSession } from '@/lib/advertising/queries/context'
import { comparisonRange, kpi, pageParam, pageSizeParam, resolveRange } from '@/lib/advertising/queries/shared'
import {
  CREATIVE_TIERS, getAspectRatios, getCreativeKpis, getCreativesPage, getReviewQueue, getTopPerformingCreatives,
  getVariantGroups, type CreativeFilters, type CreativeListRow,
} from '@/lib/advertising/queries/creatives'
import { providerLabel } from '@/lib/advertising/queries/overview'
import { formatCurrency, formatDateRange, formatNumber, formatPercent, formatRelativeTime } from '@/lib/advertising/metrics'
import { AD_PROVIDER_IDS } from '@/lib/advertising/providers'
import PageHeader from '../PageHeader'
import KpiCard from '../KpiCard'
import ProviderLogo from '../ProviderLogo'
import StatusPill, { CAMPAIGN_STATUS, FORMAT_LABELS, OBJECTIVE_LABELS, REVIEW_STATUS } from '../StatusPill'
import { ClearFiltersButton, Pagination, SearchInput, SortSelect, ViewSwitcher } from '../Controls'
import { ChipSelect, DateRangeButton, FiltersPopover, InlineLabelSelect, KebabMenu, SegmentedParam } from '../MiniControls'
import { EmptyState, Panel } from '../Primitives'
import ExportSplit from '../ExportSplit'
import UploadCreative from '../client/UploadCreative'
import ReviewCreativeButtons from '../client/ReviewCreativeButtons'

// /{type}/advertising/creatives — built to design reference (4).
// Header, six KPI cards, a two-row filter panel, then a 4-up creative grid
// (or table / review list) beside a right rail with Review Queue / Top
// Performers / Tests & Variants tabs and the Top Performing Creatives list.

type SearchParams = Record<string, string | string[] | undefined>
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null

const FORMAT_CHIP: Record<string, { icon: ReactNode; tone: string }> = {
  image: { icon: <ImageIcon size={12} />, tone: 'bg-blue-50 text-blue-700' },
  video: { icon: <Film size={12} />, tone: 'bg-violet-50 text-violet-700' },
  carousel: { icon: <GalleryHorizontal size={12} />, tone: 'bg-orange-50 text-orange-700' },
  story: { icon: <Smartphone size={12} />, tone: 'bg-amber-50 text-amber-700' },
  reel: { icon: <Clapperboard size={12} />, tone: 'bg-fuchsia-50 text-fuchsia-700' },
}

function FormatChip({ format }: { format: string }) {
  const chip = FORMAT_CHIP[format] ?? { icon: <ImageIcon size={12} />, tone: 'bg-slate-100 text-slate-600' }
  return (
    <span className={`inline-flex h-[22px] items-center gap-1 rounded-lg px-2 text-[11.5px] font-medium ${chip.tone}`}>
      <span aria-hidden>{chip.icon}</span>{FORMAT_LABELS[format] ?? format}
    </span>
  )
}

const duration = (seconds: number | null) => seconds === null ? null : `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`

/**
 * Thumbnail: the signed asset when one exists, otherwise an honest format tile.
 * `compact` drops the aspect-ratio tag, which collides with the duration on small rail thumbs.
 */
function Thumb({ row, className, compact = false }: { row: CreativeListRow; className?: string; compact?: boolean }) {
  const isVideo = row.format === 'video' || row.format === 'reel' || row.format === 'story'
  return (
    <div className={`relative overflow-hidden rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 ${className ?? ''}`}>
      {row.thumbnailUrl ? (
        // Signed, short-lived URL from the private bucket; not a remote image host Next can optimise.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.thumbnailUrl} alt={`${row.name} preview`} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className={`flex h-full w-full items-center justify-center ${isVideo ? 'bg-gradient-to-br from-sky-100 via-indigo-100 to-violet-100 text-indigo-400' : row.format === 'carousel' ? 'bg-gradient-to-br from-rose-50 to-amber-100 text-amber-500' : 'text-slate-400'}`} role="img" aria-label={`${FORMAT_LABELS[row.format] ?? row.format} creative: ${row.name} (no preview uploaded)`}>
          {!isVideo && <ImageIcon size={26} aria-hidden />}
        </div>
      )}
      {isVideo && (
        <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-800 shadow-sm" aria-hidden>
          <Play size={16} className="ml-0.5 fill-current" />
        </span>
      )}
      {row.aspectRatio && !compact && <span className="absolute bottom-1.5 left-1.5 rounded bg-slate-900/70 px-1.5 py-0.5 text-[10.5px] font-medium text-white">{row.aspectRatio}</span>}
      {isVideo && duration(row.durationSeconds) && <span className="absolute bottom-1.5 right-1.5 rounded bg-slate-900/70 px-1.5 py-0.5 text-[10.5px] font-medium text-white">{duration(row.durationSeconds)}</span>}
    </div>
  )
}

function CreativeCard({ row, base }: { row: CreativeListRow; base: string }) {
  const statusPill = row.reviewStatus === 'under_review' || row.reviewStatus === 'disapproved'
    ? <StatusPill status={row.reviewStatus} map={REVIEW_STATUS} dot={false} className="rounded-md px-2 text-[10.5px]" />
    : <StatusPill status={row.status} map={CAMPAIGN_STATUS} dot={false} className="rounded-md px-2 text-[10.5px]" />
  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5"><FormatChip format={row.format} /><ProviderLogo provider={row.provider} size={15} /></div>
        {statusPill}
      </div>
      <div className="relative mt-2.5">
        <Link href={`${base}/creatives/${row.id}`} aria-label={`Open ${row.name}`}><Thumb row={row} className="aspect-[4/3]" /></Link>
        <div className="absolute right-1.5 top-1.5 rounded-md bg-white/90">
          <KebabMenu label={`${row.name} actions`}>
            <Link href={`${base}/creatives/${row.id}`}>View creative</Link>
            {row.campaignId && <Link href={`${base}/campaigns/${row.campaignId}`}>Open campaign</Link>}
            <Link href={`${base}/creatives?view=review`}>Review queue</Link>
          </KebabMenu>
        </div>
      </div>
      <Link href={`${base}/creatives/${row.id}`} className="mt-2.5 flex items-center gap-1 text-[13px] font-semibold text-slate-900 hover:text-blue-700">
        <span className="truncate">{row.name}</span>
        {row.isWinningVariant && <Sparkles size={13} className="shrink-0 text-amber-400" aria-label="Winning variant" />}
      </Link>
      {row.campaignId ? (
        <Link href={`${base}/campaigns/${row.campaignId}`} className="truncate text-[11.5px] text-blue-600 hover:underline">{row.campaignName}</Link>
      ) : <span className="text-[11.5px] text-slate-400">No campaign</span>}
      {/* Spend is the widest figure, so its column gets the extra share; every value truncates rather than collide. */}
      <dl className="mt-3 grid grid-cols-[1.45fr_1fr_0.85fr] gap-x-1.5 gap-y-2.5 text-[10.5px] [&>div]:min-w-0 [&_dd]:mt-0.5 [&_dd]:truncate [&_dd]:text-[12px] [&_dd]:font-semibold [&_dd]:tabular-nums [&_dd]:text-slate-900 [&_dt]:truncate [&_dt]:text-slate-500">
        <div><dt>Spend</dt><dd>{formatCurrency(row.spend)}</dd></div>
        <div><dt>CTR</dt><dd>{formatPercent(row.ctr)}</dd></div>
        <div><dt>Clicks</dt><dd>{formatNumber(row.clicks)}</dd></div>
        <div><dt>Conversions</dt><dd>{formatNumber(row.conversions)}</dd></div>
        <div><dt>Hook Rate</dt><dd>{formatPercent(row.hookRate)}</dd></div>
      </dl>
      <div className="mt-auto flex items-center justify-between pt-2.5 text-[10.5px] text-slate-500">
        <span className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${row.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden />Last updated {formatRelativeTime(row.updatedAt)}</span>
        <ProviderLogo provider={row.provider} size={14} decorative />
      </div>
    </article>
  )
}

export default async function CreativesPage({
  session, searchParams, nav,
}: { session: AdvertisingSession; searchParams: SearchParams; nav?: ReactNode }) {
  const range = resolveRange({ preset: first(searchParams.range) })
  const compare = comparisonRange(range, first(searchParams.compare))
  const base = session.basePath
  const workspaceId = session.workspace.id
  const view = ['table', 'review'].includes(first(searchParams.view) ?? '') ? first(searchParams.view)! : 'grid'
  const rail = ['top', 'tests'].includes(first(searchParams.rail) ?? '') ? first(searchParams.rail)! : 'review'

  const filters: CreativeFilters = {
    q: first(searchParams.q), platform: first(searchParams.platform), format: first(searchParams.format),
    aspect: first(searchParams.aspect), status: first(searchParams.status), reviewStatus: first(searchParams.reviewStatus),
    objective: first(searchParams.objective), performance: first(searchParams.performance),
    sort: first(searchParams.sort), page: pageParam(searchParams), pageSize: pageSizeParam(searchParams, 8),
  }

  const [list, reviewQueue, topPerformers, variants, kpis, aspects, accountRows, campaignRows] = await Promise.all([
    getCreativesPage(session.supabase, workspaceId, range, filters),
    getReviewQueue(session.supabase, workspaceId, 10),
    getTopPerformingCreatives(session.supabase, workspaceId, range, 5),
    rail === 'tests' ? getVariantGroups(session.supabase, workspaceId, range) : Promise.resolve([]),
    getCreativeKpis(session.supabase, workspaceId, range, compare),
    getAspectRatios(session.supabase, workspaceId),
    session.supabase.from('ad_accounts').select('id, name, provider').eq('workspace_id', workspaceId).order('name'),
    session.supabase.from('ad_campaigns').select('id, name, account_id').eq('workspace_id', workspaceId).neq('status', 'archived').order('name'),
  ])

  const canUpload = session.capabilities['creatives.upload']
  const canCreate = session.capabilities['creatives.create']
  const canReview = session.capabilities['creatives.review']
  const canExport = session.capabilities['creatives.export']
  const compareLabel = formatDateRange(new Date(`${compare.since}T00:00:00Z`), new Date(`${compare.until}T00:00:00Z`))
  const rangeLabel = formatDateRange(new Date(`${range.since}T00:00:00Z`), new Date(`${range.until}T00:00:00Z`))
  const activeFilterCount = [filters.q, filters.platform, filters.format, filters.aspect, filters.status, filters.reviewStatus, filters.objective, filters.performance].filter(Boolean).length
  const accounts = (accountRows.data ?? []).map(row => ({ id: row.id as string, name: row.name as string, providerName: providerLabel(row.provider as string) }))
  const campaigns = (campaignRows.data ?? []).map(row => ({ id: row.id as string, name: row.name as string, accountId: row.account_id as string }))
  const exportHref = `/api/advertising/export?workspaceType=${session.workspaceType}&range=${first(searchParams.range) ?? 'last_30'}${filters.platform ? `&platform=${filters.platform}` : ''}`

  const cards = [
    { value: kpi({ id: 'spend', label: 'Creative Spend', format: 'currency', current: kpis.current.spend, previous: kpis.previous.spend, spark: kpis.series.spend, tooltip: 'Spend attributed to creatives.' }), icon: <CircleDollarSign />, accent: '#2563EB' },
    { value: kpi({ id: 'topctr', label: 'Top CTR', format: 'percent', current: kpis.topCtr, previous: kpis.previousTopCtr, spark: kpis.series.topCtr, tooltip: 'Highest click-through rate of any single creative with at least 1,000 impressions.' }), icon: <MousePointerClick />, accent: '#7C3AED' },
    { value: kpi({ id: 'hook', label: 'Average Hook Rate', format: 'percent', current: kpis.hookRate, previous: kpis.previousHookRate, spark: kpis.series.hook, tooltip: '3-second video views divided by impressions, across video creatives only.' }), icon: <Zap />, accent: '#0D9488' },
    { value: kpi({ id: 'active', label: 'Active Creatives', format: 'integer', current: kpis.activeCount, previous: null, spark: [], tooltip: 'Creatives currently live. No history is kept, so there is no comparison.' }), icon: <BadgeCheck />, accent: '#EA580C' },
    { value: kpi({ id: 'disapproved', label: 'Disapproved Creatives', format: 'integer', current: kpis.disapprovedCount, previous: null, spark: [], inverse: true, tooltip: 'Creatives a platform has rejected.' }), icon: <ShieldAlert />, accent: '#2563EB' },
    { value: kpi({ id: 'winning', label: 'Winning Variants', format: 'integer', current: kpis.winningCount, previous: null, spark: [], tooltip: 'Creatives marked as the winner of a test.' }), icon: <Trophy />, accent: '#7C3AED' },
  ]

  return (
    <div>
      <PageHeader
        title="Advertising Creatives" hint="Ad assets, performance and provider review states across every channel."
        subtitle="Manage ad assets, track performance, and review creative states across all channels."
        nav={nav}
      >
        <UploadCreative workspaceId={workspaceId} workspaceType={session.workspaceType} basePath={base} accounts={accounts} campaigns={campaigns}
          disabledReason={canUpload ? null : 'Your role, plan or connected platforms do not allow creative uploads.'} />
        <UploadCreative mode="ad" workspaceId={workspaceId} workspaceType={session.workspaceType} basePath={base} accounts={accounts} campaigns={campaigns}
          disabledReason={canCreate ? null : 'Your role, plan or connected platforms do not allow creating ads.'} />
        {canExport && <ExportSplit href={exportHref} primary="creatives" />}
      </PageHeader>

      <section className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6" aria-label="Creative metrics">
        {cards.map(card => <KpiCard key={card.value.id} kpi={card.value} icon={card.icon} accent={card.accent} comparisonLabel={compareLabel} />)}
      </section>

      <Panel className="mb-2">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput placeholder="Search creatives by name, campaign, ad set, or ID..." className="min-w-[240px] flex-1" ariaLabel="Search creatives" />
          <DateRangeButton label={rangeLabel} className="min-w-[170px]" />
          <InlineLabelSelect paramKey="format" label="Creative Type" allLabel="" options={Object.entries(FORMAT_LABELS).map(([value, label]) => ({ value, label }))} className="w-[150px]" />
          <InlineLabelSelect paramKey="platform" label="Platform" allLabel="" options={AD_PROVIDER_IDS.map(id => ({ value: id, label: providerLabel(id) }))} className="w-[120px]" />
          <InlineLabelSelect paramKey="status" label="Status" allLabel="" options={Object.entries(CAMPAIGN_STATUS).filter(([value]) => ['draft', 'active', 'paused', 'archived'].includes(value)).map(([value, entry]) => ({ value, label: entry.label }))} className="w-[110px]" />
          <FiltersPopover activeCount={filters.reviewStatus ? 1 : 0}>
            <label className="block text-[11.5px] font-medium text-slate-500">Review status</label>
            <ChipSelect paramKey="reviewStatus" label="Review status" allLabel="Any review status" options={Object.entries(REVIEW_STATUS).map(([value, entry]) => ({ value, label: entry.label }))} className="w-full [&>span]:w-full [&>span]:justify-between" />
          </FiltersPopover>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ChipSelect paramKey="aspect" label="Format" prefix="Format:" allLabel="Format: All" options={aspects.map(value => ({ value, label: value }))} />
          <ChipSelect paramKey="objective" label="Objective" prefix="Objective:" allLabel="Objective: All" options={Object.entries(OBJECTIVE_LABELS).map(([value, label]) => ({ value, label }))} />
          <ChipSelect paramKey="performance" label="Performance tier" prefix="Performance Tier:" allLabel="Performance Tier: All" options={CREATIVE_TIERS.map(tier => ({ value: tier.value, label: tier.label }))} />
          <ClearFiltersButton activeCount={activeFilterCount} keep={['view', 'range', 'rail']} />
          <div className="ml-auto flex items-center gap-2">
            <ViewSwitcher defaultView="grid" views={[
              { value: 'grid', label: 'Grid', icon: 'grid' }, { value: 'table', label: 'Table', icon: 'table' }, { value: 'review', label: 'Review', icon: 'review' },
            ]} />
            <SortSelect defaultValue="updated_desc" className="w-48" options={[
              { value: 'updated_desc', label: 'Last Updated' }, { value: 'spend_desc', label: 'Spend' }, { value: 'ctr_desc', label: 'CTR' },
              { value: 'hook_desc', label: 'Hook Rate' }, { value: 'conversions_desc', label: 'Conversions' }, { value: 'name_asc', label: 'Name A–Z' },
            ]} />
          </div>
        </div>
      </Panel>

      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {view === 'review' ? (
            <Panel padded={false}>
              {reviewQueue.length === 0 ? <div className="p-4"><EmptyState title="Nothing waiting for review" description="Creatives under review, disapproved or sent back for changes appear here." /></div> : (
                <ul className="divide-y divide-slate-100">
                  {reviewQueue.map(row => (
                    <li key={row.id} id={`creative-${row.id}`} className="flex flex-wrap items-start justify-between gap-4 p-4">
                      <div className="flex min-w-0 gap-3">
                        <Link href={`${base}/creatives/${row.id}`}><Thumb row={row} className="h-20 w-16 shrink-0" /></Link>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2"><FormatChip format={row.format} /><ProviderLogo provider={row.provider} size={15} /></div>
                          <Link href={`${base}/creatives/${row.id}`} className="mt-1 block truncate text-[13px] font-semibold text-slate-900 hover:text-blue-700">{row.name}</Link>
                          <p className="truncate text-[11.5px] text-slate-500">{row.campaignName ?? 'No campaign'} · submitted {formatRelativeTime(row.updatedAt)}{row.createdByName ? ` by ${row.createdByName}` : ''}</p>
                          {row.providerFeedback && <p className="mt-1 text-[11.5px] text-red-600">Platform feedback: {row.providerFeedback}</p>}
                          <StatusPill status={row.reviewStatus} map={REVIEW_STATUS} className="mt-1.5" />
                        </div>
                      </div>
                      {canReview && row.reviewStatus !== 'disapproved'
                        ? <ReviewCreativeButtons workspaceId={workspaceId} workspaceType={session.workspaceType} creativeId={row.id} />
                        : <span className="text-[11.5px] text-slate-400">{row.reviewStatus === 'disapproved' ? 'Replace the asset and resubmit on the platform' : 'View only'}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : list.rows.length === 0 ? (
            <Panel><EmptyState title="No creatives match these filters" description="Clear a filter, or upload a creative." /></Panel>
          ) : view === 'table' ? (
            <Panel padded={false}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-[12.5px]">
                  <caption className="sr-only">Advertising creatives</caption>
                  <thead>
                    <tr className="border-b border-slate-100 text-[12px] text-slate-700">
                      {['Creative', 'Type', 'Platform', 'Campaign', 'Spend', 'CTR', 'Clicks', 'Conversions', 'Hook Rate', 'Review', 'Updated'].map(header => <th key={header} className="px-3 py-2.5 font-semibold first:pl-4">{header}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {list.rows.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="py-2 pl-4 pr-3"><Link href={`${base}/creatives/${row.id}`} className="flex items-center gap-2.5 font-medium text-slate-800 hover:text-blue-700"><Thumb row={row} className="h-9 w-9 shrink-0 [&_span]:hidden" /><span className="truncate">{row.name}</span></Link></td>
                        <td className="px-3 py-2"><FormatChip format={row.format} /></td>
                        <td className="px-3 py-2"><ProviderLogo provider={row.provider} size={16} /></td>
                        <td className="px-3 py-2">{row.campaignId ? <Link href={`${base}/campaigns/${row.campaignId}`} className="text-blue-600 hover:underline">{row.campaignName}</Link> : '—'}</td>
                        <td className="px-3 py-2 tabular-nums">{formatCurrency(row.spend)}</td>
                        <td className="px-3 py-2 tabular-nums">{formatPercent(row.ctr)}</td>
                        <td className="px-3 py-2 tabular-nums">{formatNumber(row.clicks)}</td>
                        <td className="px-3 py-2 tabular-nums">{formatNumber(row.conversions)}</td>
                        <td className="px-3 py-2 tabular-nums">{formatPercent(row.hookRate)}</td>
                        <td className="px-3 py-2"><StatusPill status={row.reviewStatus} map={REVIEW_STATUS} dot={false} className="rounded-md px-2 text-[10.5px]" /></td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-500">{formatRelativeTime(row.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={filters.page} pageSize={filters.pageSize} total={list.total} itemLabel="creatives" />
            </Panel>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {list.rows.map(row => <CreativeCard key={row.id} row={row} base={base} />)}
              </div>
              <div className="mt-3 rounded-xl border border-slate-200 bg-white"><Pagination page={filters.page} pageSize={filters.pageSize} total={list.total} itemLabel="creatives" /></div>
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <Panel padded={false}>
            <div className="px-3 pt-3">
              <SegmentedParam paramKey="rail" defaultValue="review" ariaLabel="Creative review rail" badgeTone="blue"
                className="w-full [&>button]:flex-1 [&>button]:whitespace-nowrap [&>button]:px-1.5 [&>button]:text-[11.5px]"
                options={[{ value: 'review', label: 'Review Queue', badge: reviewQueue.length }, { value: 'top', label: 'Top Performers' }, { value: 'tests', label: 'Tests & Variants' }]} />
            </div>
            <div className="p-3">
              {rail === 'review' && (reviewQueue.length === 0 ? <EmptyState compact title="Nothing to review" description="Creatives under review or disapproved appear here." /> : (
                <ul className="space-y-3">
                  {reviewQueue.slice(0, 3).map(row => (
                    <li key={row.id} className="flex gap-3 rounded-lg border border-slate-100 p-2">
                      <Link href={`${base}/creatives/${row.id}`}><Thumb row={row} compact className="h-[84px] w-[68px] shrink-0" /></Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex items-center gap-1.5"><FormatChip format={row.format} /><ProviderLogo provider={row.provider} size={14} /></div>
                          <StatusPill status={row.reviewStatus} map={REVIEW_STATUS} dot={false} className="rounded-md px-1.5 text-[10px]" />
                        </div>
                        <p className="mt-1 truncate text-[12.5px] font-semibold text-slate-900">{row.name}</p>
                        <p className="truncate text-[11px] text-slate-500">{row.campaignName ?? 'No campaign'}</p>
                        <p className="mt-1 text-[10.5px] text-slate-500">{row.reviewStatus === 'disapproved' ? 'Rejected' : 'Submitted'} {formatRelativeTime(row.updatedAt)}</p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] text-slate-600">{row.createdByName ?? '—'}</span>
                          <Link href={row.reviewStatus === 'disapproved' ? `${base}/creatives/${row.id}` : `${base}/creatives?view=review#creative-${row.id}`} className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50">
                            {row.reviewStatus === 'disapproved' ? 'View Feedback' : 'View & Review'}
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ))}
              {rail === 'top' && (topPerformers.length === 0 ? <EmptyState compact title="No performance data" description="Top performers appear once creatives have clicks." /> : (
                <ul className="space-y-2.5">
                  {topPerformers.map(row => (
                    <li key={row.id}>
                      <Link href={`${base}/creatives/${row.id}`} className="flex items-center gap-2.5 rounded-md p-1 hover:bg-slate-50">
                        <Thumb row={row} className="h-11 w-11 shrink-0 [&_span]:hidden" />
                        <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-medium text-slate-800">{row.name}</span><span className="block text-[11px] text-slate-500">{formatCurrency(row.spend)} spend · {formatNumber(row.clicks)} clicks</span></span>
                        <span className="text-[12.5px] font-semibold tabular-nums text-slate-800">{formatPercent(row.ctr)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ))}
              {rail === 'tests' && (variants.length === 0 ? <EmptyState compact title="No creative tests yet" description="Creatives synced with a parent creative appear here grouped as a test, with the winner marked." /> : (
                <ul className="space-y-3">
                  {variants.map(group => (
                    <li key={group.parent.id} className="rounded-lg border border-slate-100 p-2.5">
                      <p className="text-[12.5px] font-semibold text-slate-900">{group.parent.name}</p>
                      <ul className="mt-1.5 space-y-1">
                        {group.variants.map(variant => (
                          <li key={variant.id} className="flex items-center justify-between text-[11.5px]">
                            <Link href={`${base}/creatives/${variant.id}`} className="truncate text-slate-700 hover:text-blue-700">{variant.name}{variant.isWinningVariant && ' 🏆'}</Link>
                            <span className="tabular-nums text-slate-600">{formatPercent(variant.ctr)}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-slate-900">Top Performing Creatives</h2>
              <Link href="?sort=ctr_desc" className="text-[12px] font-medium text-blue-600 hover:underline">View all</Link>
            </div>
            {topPerformers.length === 0 ? <EmptyState compact title="No performance data" description="Ranked by CTR once creatives have clicks." className="mt-3" /> : (
              <ol className="mt-3 space-y-3">
                {topPerformers.slice(0, 3).map((row, index) => (
                  <li key={row.id}>
                    <Link href={`${base}/creatives/${row.id}`} className="flex items-center gap-2.5 hover:text-blue-700">
                      <span className="w-3 text-[11.5px] font-semibold text-slate-500">{index + 1}</span>
                      <Thumb row={row} className="h-11 w-11 shrink-0 [&_span]:hidden" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1 truncate text-[12.5px] font-medium text-slate-800">{row.name}{row.isWinningVariant && <Sparkles size={12} className="text-amber-400" aria-label="Winning variant" />}</span>
                        <span className="block text-[11px] text-slate-500">{FORMAT_LABELS[row.format] ?? row.format} • {providerLabel(row.provider).replace(' Ads', '')}</span>
                      </span>
                      <span className="text-right"><span className="block text-[10px] text-slate-400">CTR</span><span className="text-[12.5px] font-semibold tabular-nums text-slate-800">{formatPercent(row.ctr)}</span></span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-3 text-[11px] text-slate-400">Compared to {compareLabel}</p>
          </Panel>
        </div>
      </div>
    </div>
  )
}
