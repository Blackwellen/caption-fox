import type { Metadata } from 'next'
import Link from 'next/link'
import { FileSpreadsheet, FileText, Presentation, File as FileIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStrategyPageContext } from '@/lib/strategy/page-context'
import { getOverviewData, type OverviewFilters } from '@/lib/strategy/overview'
import { resolveRange } from '@/lib/strategy/metrics'
import { formatAgoLong, formatSignedPercent } from '@/lib/strategy/format'
import { RESEARCH_SOURCE_LABELS, strategyPath, type ResearchSource } from '@/lib/strategy/constants'
import StrategyHeader from '@/components/strategy/StrategyHeader'
import KpiStrip, { type KpiItem } from '@/components/strategy/KpiStrip'
import { ClearFilters, MoreFilters, RangeFilter, SelectFilter, ViewSwitcher } from '@/components/strategy/FilterBar'
import { FooterLink, Panel } from '@/components/strategy/primitives'
import { EmptyState, PanelError } from '@/components/strategy/states'
import { Donut, GroupedBars, Legend, LineChart } from '@/components/strategy/charts'
import { ActivityList } from '@/components/strategy/ActivityPanel'
import Pagination from '@/components/strategy/Pagination'
import StrategyPageActions from '@/components/strategy/overview/OverviewActions'
import NextActions from '@/components/strategy/overview/NextActions'
import InitiativesTable from '@/components/strategy/overview/InitiativesTable'

export const metadata: Metadata = {
  title: 'Strategy · Campaign Manager · Caption Fox',
  description: 'Strategic planning and governance for sustained growth.',
}

type Search = Record<string, string | string[] | undefined>
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? ''

const RANGE_PRESETS = [
  { value: 'this_quarter', label: 'This quarter' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_quarter', label: 'Last quarter' },
  { value: 'this_year', label: 'This year' },
  { value: 'all', label: 'All time' },
]

const DONUT_SEGMENTS = [
  { key: 'on_track', label: 'On track', colour: '#22c55e' },
  { key: 'at_risk', label: 'At risk', colour: '#fbbf24' },
  { key: 'off_track', label: 'Off track', colour: '#ef4444' },
  { key: 'completed', label: 'Completed', colour: '#3f6ff8' },
  { key: 'not_started', label: 'Not started', colour: '#cbd5e1' },
  { key: 'draft', label: 'Draft', colour: '#e2e8f0' },
]

function fileTile(method: string, fileType: string | null) {
  const kind = fileType?.includes('pdf') ? 'pdf' : fileType?.includes('sheet') || fileType?.includes('csv') ? 'sheet'
    : fileType?.includes('presentation') ? 'slides' : { report: 'pdf', survey: 'sheet', market_data: 'slides' }[method] ?? 'doc'
  return {
    pdf: { Icon: FileText, tone: 'text-red-500' },
    sheet: { Icon: FileSpreadsheet, tone: 'text-emerald-600' },
    slides: { Icon: Presentation, tone: 'text-orange-500' },
    doc: { Icon: FileIcon, tone: 'text-slate-500' },
  }[kind as 'pdf' | 'sheet' | 'slides' | 'doc']
}

export default async function StrategyOverviewPage({
  params, searchParams,
}: { params: Promise<{ workspaceType: string }>; searchParams: Promise<Search> }) {
  const [{ workspaceType }, search] = await Promise.all([params, searchParams])
  const page = await getStrategyPageContext(workspaceType, 'overview')
  const { capabilities: can } = page

  const range = resolveRange({ range: one(search.range), from: one(search.from), to: one(search.to) }, 'this_quarter')
  const view = one(search.view) === 'table' ? 'table' : 'dashboard'
  const sort = (['priority', 'progress', 'due', 'name'] as const).find(value => value === one(search.sort)) ?? 'priority'
  const filters: OverviewFilters = {
    strategy: one(search.strategy), owner: one(search.owner), from: range.from, to: range.to,
    status: one(search.status), priority: one(search.priority), sort, activity: one(search.activity),
    page: Math.max(1, Number.parseInt(one(search.page), 10) || 1), size: view === 'table' ? 12 : 3,
  }
  // Ownership / strategy ids come from the URL, so only pass through known ones.
  if (filters.owner && !page.people.some(person => person.id === filters.owner)) filters.owner = ''

  const data = await getOverviewData(page.supabase, page.workspace.id, filters)
  if (filters.strategy && !data.strategies.some(item => item.id === filters.strategy)) filters.strategy = ''
  const filtered = Boolean(filters.strategy || filters.owner || filters.status || filters.priority || one(search.range))
  const currency = data.forecast?.currency ?? page.workspace.currency

  const kpis: KpiItem[] = [
    { id: 'strategies', label: 'Active Strategies', value: data.kpis.activeStrategies.value, icon: 'target', tone: 'blue',
      delta: data.kpis.activeStrategies.delta && { value: data.kpis.activeStrategies.delta.value, comparison: 'vs last month' },
      note: data.kpis.activeStrategies.delta ? undefined : 'No prior month to compare' },
    { id: 'objectives', label: 'Objectives on Track', icon: 'check', tone: 'green',
      value: <>{data.kpis.objectives.onTrack}<span className="font-normal text-slate-500"> / {data.kpis.objectives.total}</span></>,
      bar: { pct: data.kpis.objectives.pct, label: <><span className="font-semibold text-emerald-600">{data.kpis.objectives.pct}%</span> on track</> } },
    { id: 'coverage', label: 'Audience Coverage', value: `${data.kpis.audienceCoverage.value}%`, icon: 'users', tone: 'violet',
      delta: data.kpis.audienceCoverage.delta && { value: data.kpis.audienceCoverage.delta.value, unit: 'pp', comparison: 'vs last month' } },
    { id: 'research', label: 'Research Health', value: `${data.kpis.researchHealth.value}%`, icon: 'flask', tone: 'blue',
      delta: data.kpis.researchHealth.delta && { value: data.kpis.researchHealth.delta.value, unit: 'pp', comparison: 'vs last month' } },
    { id: 'positioning', label: 'Positioning Health', value: `${data.kpis.positioningHealth.value}%`, icon: 'star', tone: 'orange',
      delta: data.kpis.positioningHealth.delta && { value: data.kpis.positioningHealth.delta.value, unit: 'pp', comparison: 'vs last month' } },
    { id: 'forecast', label: 'Forecast Confidence', value: data.kpis.forecastConfidence.label, icon: 'line', tone: 'blue',
      delta: data.kpis.forecastConfidence.delta && { value: data.kpis.forecastConfidence.delta.value, unit: 'pp', comparison: 'vs last month' },
      note: page.modules.includes('forecasts') ? undefined : 'Not in your plan' },
  ]

  const donut = DONUT_SEGMENTS
    .map(segment => ({ ...segment, value: data.objectiveCounts[segment.key] ?? 0 }))
    .filter((segment, index) => index < 3 || segment.value > 0)
  const pathname = strategyPath(workspaceType)
  // Research created in the last 14 days is badged "New".
  const freshSince = new Date(new Date().setDate(new Date().getDate() - 14)).toISOString()
  const queryState = Object.fromEntries(Object.entries(search).map(([key, value]) => [key, one(value)]))

  return (
    <>
      <StrategyHeader kind={workspaceType} module="overview" modules={page.modules}
        actions={(
          <StrategyPageActions module="overview" people={page.people} strategies={data.strategies}
            can={{ createObjective: can.createObjective, createResearch: can.createResearch, export: can.export }}
            extraMenu={[{ id: 'plans', label: 'Manage plans', href: strategyPath(workspaceType, 'plans') }]} />
        )} />

      {data.errors.length > 0 && <div className="mb-3"><PanelError message="Some strategy data could not load. Refresh to try again." /></div>}

      <KpiStrip items={kpis} />

      <div className="mt-4 flex flex-col gap-2 lg:mt-[18px] lg:flex-row lg:items-center lg:gap-[13px]">
        <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:flex lg:flex-1 lg:items-center lg:gap-[13px]">
          <RangeFilter presets={RANGE_PRESETS} fallbackLabel={range.label} className="lg:w-[211px]" />
          <SelectFilter param="strategy" labelText="Strategy" allLabel="All strategies" icon="user" className="lg:w-[150px]"
            options={data.strategies.map(item => ({ value: item.id, label: item.name }))} />
          <SelectFilter param="owner" labelText="Owner" allLabel="All owners" className="lg:w-[112px]"
            options={page.people.map(person => ({ value: person.id, label: person.full_name ?? person.email ?? 'Member' }))} />
          <MoreFilters fields={[
            { param: 'status', label: 'Initiative status', options: [
              { value: 'on_track', label: 'On track' }, { value: 'at_risk', label: 'At risk' },
              { value: 'off_track', label: 'Off track' }, { value: 'not_started', label: 'Not started' }, { value: 'completed', label: 'Completed' }] },
            { param: 'priority', label: 'Priority', options: [
              { value: 'urgent', label: 'Urgent' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }] },
          ]} />
          <ClearFilters keys={['range', 'from', 'to', 'strategy', 'owner', 'status', 'priority']} />
        </div>
        <ViewSwitcher current={view} defaultView="dashboard" views={[{ id: 'dashboard', label: 'Dashboard' }, { id: 'table', label: 'Table' }]} />
      </div>

      {view === 'table' ? (
        <Panel className="mt-3 lg:mt-[13px]" title="Initiatives" subtitle={`${data.initiativesTotal} initiatives in this range`}
          action={<SelectFilter param="sort" labelText="Sort by" allLabel="Sort by: Priority" className="w-[150px]"
            options={[{ value: 'progress', label: 'Sort by: Progress' }, { value: 'due', label: 'Sort by: Due date' }, { value: 'name', label: 'Sort by: Name' }]} />}>
          {data.initiatives.length ? (
            <>
              <InitiativesTable kind={workspaceType} rows={data.initiatives} />
              <Pagination pathname={pathname} params={queryState} page={filters.page} size={filters.size} total={data.initiativesTotal} label="initiatives" />
            </>
          ) : <EmptyState compact filtered={filtered} title="No initiatives match" description="Clear filters or create a plan to track delivery." />}
        </Panel>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:mt-[13px] xl:grid-cols-[419fr_355fr_408fr] xl:gap-[15px]">
            <Panel title="Strategy performance trend" info="Monthly Strategy Health Score against the industry benchmark for your sector." className="xl:min-h-[229px]"
              bodyClassName="lg:pb-0!" footerClassName="lg:pb-[10px]!"
              footer={<p className="text-[11px] text-sg-subtle lg:text-[9px]">Strategy Health Score combines objectives, research, positioning, and plan progress.</p>}>
              <Legend className="mb-2 lg:mb-3" items={[
                { label: 'Strategy Health Score', colour: '#3f6ff8' },
                { label: 'Industry Benchmark', colour: '#94a3b8', dashed: true },
              ]} />
              {data.trend.length > 1 ? (
                <LineChart caption="Strategy health score by month" xKey="label" data={data.trend} height={124} yMax={100}
                  series={[
                    { key: 'health', label: 'Strategy Health Score', colour: '#3f6ff8', area: true, endBadge: true },
                    { key: 'benchmark', label: 'Industry Benchmark', colour: '#94a3b8', dashed: true, endBadge: true },
                  ]} />
              ) : <EmptyState compact title="Trend starts next month" description="A monthly score is recorded automatically." />}
            </Panel>

            <Panel title="Objectives by status" className="xl:min-h-[229px]"
              bodyClassName="lg:pb-0!" footerClassName="lg:pt-[7px] lg:pb-[7px]!"
              footer={<FooterLink href={strategyPath(workspaceType, 'objectives')}>View all objectives</FooterLink>}>
              {data.objectivesTotal ? (
                <div className="flex items-center gap-3 border-b border-sg-line-soft pb-3 sm:gap-5 lg:gap-4 lg:pb-4 lg:pl-0 lg:pt-[10px] min-[1400px]:gap-[26px] min-[1400px]:pl-[10px]">
                  <Donut caption="Objectives by status" size={132} thickness={24} slices={donut}
                    center={<><span className="text-[18px] font-semibold leading-none text-sg-ink">{data.objectivesTotal}</span><span className="mt-1 text-[9px] text-sg-muted">Total</span></>} />
                  <ul className="min-w-0 flex-1 space-y-0 lg:space-y-[12px]">
                    {donut.map(segment => (
                      <li key={segment.key} className="flex items-center gap-2 text-[12px] text-sg-body lg:text-[9.5px]">
                        <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: segment.colour }} />
                        <Link className="block min-w-0 flex-1 truncate py-3 hover:underline lg:py-0" href={`${strategyPath(workspaceType, 'objectives')}?status=${segment.key}`}>{segment.label}</Link>
                        <span className="whitespace-nowrap font-semibold tabular-nums text-sg-ink">{segment.value} <span className="font-normal text-sg-muted">({Math.round((segment.value / data.objectivesTotal) * 100)}%)</span></span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : <EmptyState compact filtered={filtered} title="No objectives yet" description={can.createObjective ? 'Use “New objective” to add your first.' : 'Objectives appear here once created.'} />}
            </Panel>

            <Panel title={`Forecast vs target (${data.forecast ? 'Revenue' : 'Forecast'})`} className="md:col-span-2 xl:col-span-1 xl:min-h-[229px]"
              bodyClassName="lg:pb-0!" footerClassName="lg:pt-[3px] lg:pb-[7px]!"
              footer={page.modules.includes('forecasts') ? <FooterLink href={strategyPath(workspaceType, 'forecasts')}>View forecasts</FooterLink> : undefined}>
              {data.forecast && data.forecast.bars.length ? (
                <>
                  <Legend items={[{ label: 'Forecast', colour: '#3f6ff8', shape: 'square' }, { label: 'Target', colour: '#c7d4fd', shape: 'square' }]} />
                  <div className="mt-2 flex items-start gap-3">
                    <GroupedBars className="min-w-0 flex-1" caption="Forecast versus target this quarter" xKey="label" height={138} barWidth={18} groupGap={6}
                      data={data.forecast.bars} currency={currency}
                      series={[{ key: 'forecast', label: 'Forecast', colour: '#3f6ff8' }, { key: 'target', label: 'Target', colour: '#c7d4fd' }]} />
                    {data.forecast.variance !== null && (
                      <p className="w-[84px] shrink-0 pt-4 text-left lg:w-[78px] lg:pt-[18px]">
                        <span className={cn('block text-[18px] font-semibold', data.forecast.variance >= 0 ? 'text-emerald-600' : 'text-red-500')}>{formatSignedPercent(data.forecast.variance)}</span>
                        <span className="text-[11px] text-sg-muted lg:text-[9.5px]">Variance (QTD)</span>
                      </p>
                    )}
                  </div>
                </>
              ) : <EmptyState compact title="No active forecast" description={page.modules.includes('forecasts') ? 'Create a revenue forecast to compare against target.' : 'Forecasts are not included in your plan.'} />}
            </Panel>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:mt-4 xl:grid-cols-[419fr_396fr_366fr] xl:gap-[15px]">
            <Panel title="Next actions" className="xl:min-h-[232px]"
              headerClassName="lg:pt-[9px]!" bodyClassName="lg:pt-[5px]! lg:pb-3" footerClassName="lg:pt-[3px] lg:pb-2!"
              footer={<FooterLink href={strategyPath(workspaceType, 'plans')}>View all actions</FooterLink>}>
              {data.actions.length
                ? <NextActions kind={workspaceType} rows={data.actions} canEdit={can.edit} />
                : <EmptyState compact title="You’re all caught up" description="Open actions from across Strategy appear here." />}
            </Panel>

            <Panel title="Research library highlights" className="xl:min-h-[232px]"
              headerClassName="lg:pt-[9px]!" footerClassName="lg:pt-[3px] lg:pb-2!"
              footer={<FooterLink href={strategyPath(workspaceType, 'research')}>Go to research library</FooterLink>}>
              {data.research.length ? (
                <ul className="divide-y divide-sg-line-soft">
                  {data.research.map(item => {
                    const tile = fileTile(item.method, item.file_type)
                    const fresh = item.created_at >= freshSince
                    const badge = item.impact === 'high' ? { label: 'High impact', tone: 'bg-emerald-100/70 font-medium text-emerald-700' }
                      : fresh || item.status === 'in_review' ? { label: 'New', tone: 'bg-sg-blue-soft font-medium text-sg-blue' } : null
                    return (
                      <li key={item.id} className="py-1.5 first:pt-0 last:pb-0 lg:py-[6.75px]">
                        <Link href={`${strategyPath(workspaceType, 'research')}?selected=${item.id}`} className="group flex items-center gap-3 lg:gap-[15px]">
                          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white ring-1 ring-sg-line lg:ml-[4px] lg:h-[22px] lg:w-[20px]', tile.tone)}>
                            <tile.Icon aria-hidden className="h-4 w-4 lg:h-3 lg:w-3" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] text-sg-ink group-hover:underline lg:text-[10px]">{item.title}</span>
                            <span className="block truncate text-[11.5px] text-sg-muted lg:text-[9px]">
                              {RESEARCH_SOURCE_LABELS[item.source_type as ResearchSource] ?? item.source_type} • Updated {formatAgoLong(item.updated_at)}
                            </span>
                          </span>
                          {badge && <span className={cn('inline-flex h-5 shrink-0 items-center rounded px-2 text-[11px] lg:h-[16px] lg:text-[8.5px]', badge.tone)}>{badge.label}</span>}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              ) : <EmptyState compact title="No research yet" description="Upload or add research to build your evidence base." />}
            </Panel>

            <Panel title="Recent activity" className="md:col-span-2 xl:col-span-1 xl:min-h-[232px]"
              headerClassName="lg:pt-2!" bodyClassName="lg:pt-[6px]!" footerClassName="lg:pt-[3px] lg:pb-2!"
              action={<SelectFilter param="activity" labelText="Activity type" allLabel="All activity" className="w-[120px] lg:w-[86px] [&_button]:lg:h-[22px] [&_button]:lg:px-[8px] [&_button]:lg:text-[9px]"
                options={page.modules.filter(item => item !== 'overview').map(item => ({ value: item, label: item[0].toUpperCase() + item.slice(1) }))} />}
              footer={<FooterLink href={strategyPath(workspaceType, 'plans')}>View all activity</FooterLink>}>
              <ActivityList kind={workspaceType} rows={data.activity} className="lg:space-y-[14px]" />
            </Panel>
          </div>

          <Panel className="mt-3 lg:mt-[15px]" title="Priority initiatives" headerClassName="lg:items-center lg:pt-[6px]!" bodyClassName="lg:pt-0! lg:pb-0!"
            action={(
              <>
                <SelectFilter param="sort" labelText="Sort by" allLabel="Sort by: Priority" className="w-[150px] lg:w-[126px] [&_button]:lg:h-[27px]"
                  options={[{ value: 'progress', label: 'Sort by: Progress' }, { value: 'due', label: 'Sort by: Due date' }, { value: 'name', label: 'Sort by: Name' }]} />
                <Link href={`${pathname}?view=table`} className="ml-2 inline-flex min-h-10 items-center text-[12px] font-medium text-sg-blue hover:underline lg:ml-[30px] lg:min-h-0 lg:text-[10.5px]">View all</Link>
              </>
            )}>
            {data.initiatives.length
              ? <InitiativesTable kind={workspaceType} rows={data.initiatives} />
              : <EmptyState compact filtered={filtered} title="No initiatives in this range" description="Plans with priority and targets appear here." />}
          </Panel>
        </>
      )}
    </>
  )
}
