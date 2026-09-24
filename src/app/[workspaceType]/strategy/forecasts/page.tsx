import type { Metadata } from 'next'
import Link from 'next/link'
import { Activity, ArrowDown, ArrowUp, CalendarClock, Percent, Share2, TrendingDown, TrendingUp, UserRound, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStrategyPageContext } from '@/lib/strategy/page-context'
import { getForecastDetail, listActivity, listForecasts, listStrategyRecords } from '@/lib/strategy/data'
import { parseStrategyQuery, type RawParams } from '@/lib/strategy/query'
import { compare, loadSnapshots, refreshSnapshot } from '@/lib/strategy/kpis'
import { CONFIDENCE_SCORE, cumulative, quarterRollup, resolveRange, variancePct } from '@/lib/strategy/metrics'
import { formatAgoLong, formatCompactMoney, formatDate, formatRelative, formatSignedMoney, formatSignedPercent, shortName } from '@/lib/strategy/format'
import { strategyPath } from '@/lib/strategy/constants'
import type { ScenarioRow } from '@/lib/strategy/types'
import StrategyHeader from '@/components/strategy/StrategyHeader'
import KpiStrip, { type KpiItem } from '@/components/strategy/KpiStrip'
import { ClearFilters, MoreFilters, RangeFilter, SelectFilter, ViewSwitcher } from '@/components/strategy/FilterBar'
import { Avatar, CARD, FooterLink, Panel, TableScroll } from '@/components/strategy/primitives'
import { EmptyState, PanelError } from '@/components/strategy/states'
import { Legend, LineChart, VarianceChart } from '@/components/strategy/charts'
import { AssumptionEditor, ForecastsHeaderActions } from '@/components/strategy/forecasts/ForecastsClient'

export const metadata: Metadata = {
  title: 'Forecasts · Strategy · Caption Fox',
  description: 'Model future performance, compare scenarios, and track progress toward strategic targets.',
}

const VIEWS = ['charts', 'table', 'scenarios'] as const
const RANGE_PRESETS = [{ value: 'this_year', label: 'This year' }, { value: 'last_12_months', label: 'Last 12 months' }, { value: 'all', label: 'All forecasts' }]
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? ''
const LEVEL_TONE: Record<string, string> = { high: 'bg-emerald-100/70 font-medium text-emerald-700', medium: 'bg-orange-100/70 font-medium text-orange-600', low: 'bg-slate-100 font-medium text-slate-500' }
const SCENARIO_STYLE: Record<string, { icon: typeof TrendingUp; tone: string; chips: string; text: string }> = {
  best: { icon: TrendingUp, tone: 'bg-emerald-50 text-emerald-600', chips: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-600' },
  expected: { icon: Share2, tone: 'bg-sg-blue-soft text-sg-blue', chips: 'bg-slate-100 text-slate-600', text: 'text-emerald-600' },
  downside: { icon: TrendingDown, tone: 'bg-red-50 text-red-500', chips: 'bg-red-50 text-red-600', text: 'text-red-500' },
  custom: { icon: Activity, tone: 'bg-violet-50 text-violet-600', chips: 'bg-violet-50 text-violet-600', text: 'text-sg-body' },
}
/** Dense desktop header spacing for the rows under the charts (design 7). */
const ROW_HEADER = 'lg:pt-[6px]!'
const ASSUMPTION_ICON = [TrendingUp, Share2, Percent, CalendarClock, UserRound, Users]

export default async function ForecastsPage({
  params, searchParams,
}: { params: Promise<{ workspaceType: string }>; searchParams: Promise<RawParams> }) {
  const [{ workspaceType: kind }, search] = await Promise.all([params, searchParams])
  const page = await getStrategyPageContext(kind, 'forecasts')
  const { supabase, capabilities: can } = page
  const workspaceId = page.workspace.id
  const q = parseStrategyQuery(search, { views: [...VIEWS], defaultView: 'charts' })
  const view = q.view as typeof VIEWS[number]
  const range = resolveRange({ range: one(search.range), from: one(search.from), to: one(search.to) }, 'this_year')
  q.from = range.from
  q.to = range.to
  if (q.owner && !page.people.some(person => person.id === q.owner)) q.owner = ''
  const now = new Date()

  const [list, strategies, snapshots, activity] = await Promise.all([
    listForecasts(supabase, workspaceId, q),
    listStrategyRecords(supabase, workspaceId),
    loadSnapshots(supabase, workspaceId, now),
    listActivity(supabase, workspaceId, { limit: 4, surface: 'forecasts' }),
  ])
  const forecast = list.rows.find(row => row.id === q.forecast) ?? list.rows.find(row => row.metric === 'revenue') ?? list.rows[0] ?? null
  const detail = forecast ? await getForecastDetail(supabase, workspaceId, forecast.id) : null
  const currency = forecast?.currency ?? page.workspace.currency
  const pathname = strategyPath(kind, 'forecasts')
  const menuCan = { create: can.createForecast, edit: can.editForecast, assumptions: can.manageAssumptions, export: can.export }
  const header = (
    <StrategyHeader kind={kind} module="forecasts" modules={page.modules}
      actions={<ForecastsHeaderActions forecast={forecast ? { id: forecast.id, name: forecast.name, currency } : null}
        scenarios={(detail?.scenarios ?? []).map(row => ({ id: row.id, name: row.name, probability: row.probability }))}
        strategies={strategies.rows.map(row => ({ id: row.id, name: row.name }))} can={menuCan}
        compareHref={`${pathname}?view=table${forecast ? `&forecast=${forecast.id}` : ''}`} />} />
  )
  const filters = (
    <div className="mt-4 flex flex-col gap-2 lg:mt-[14px] xl:flex-row xl:items-center xl:gap-[12px]">
      <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:flex lg:flex-1 lg:flex-wrap lg:items-center lg:gap-[12px]">
        <RangeFilter presets={RANGE_PRESETS} fallbackLabel={range.label} className="lg:w-[228px]" />
        <SelectFilter param="strategy" labelText="Strategy" allLabel="All strategies" icon="user" className="lg:w-[152px]" options={strategies.rows.map(row => ({ value: row.id, label: row.name }))} />
        <SelectFilter param="owner" labelText="Owner" allLabel="All owners" className="lg:w-[106px]" options={page.people.map(person => ({ value: person.id, label: person.full_name ?? person.email ?? 'Member' }))} />
        <MoreFilters fields={[
          { param: 'forecast', label: 'Forecast', options: list.rows.map(row => ({ value: row.id, label: row.name })) },
          { param: 'archived', label: 'Archive', options: [{ value: '1', label: 'Archived only' }] },
        ]} />
        <ClearFilters keys={['range', 'from', 'to', 'strategy', 'owner', 'forecast', 'archived']} />
      </div>
      <ViewSwitcher current={view} defaultView="charts" views={[{ id: 'charts', label: 'Charts' }, { id: 'table', label: 'Table' }, { id: 'scenarios', label: 'Scenarios' }]} />
    </div>
  )

  if (!forecast || !detail) {
    return (
      <>
        {header}
        {list.error && <div className="mb-3"><PanelError message="Forecasts could not load. Refresh to try again." /></div>}
        {filters}
        <div className={cn(CARD, 'mt-3')}>
          <EmptyState filtered={Boolean(q.strategy || q.owner || one(search.range))} title="No forecasts in this range"
            description={can.createForecast ? 'Create a forecast with your target and scenario totals to start modelling.' : 'Forecasts appear here once created.'} />
        </div>
      </>
    )
  }

  // ── Series ────────────────────────────────────────────────────────────────
  const byType = (type: string) => detail.scenarios.find(row => row.scenario_type === type) ?? null
  const expected = detail.scenarios.find(row => row.is_expected) ?? byType('expected')
  const best = byType('best')
  const downside = byType('downside')
  const periodsFor = (scenario: ScenarioRow | null) => (scenario ? detail.periods.filter(row => row.scenario_id === scenario.id) : [])
  const expectedPeriods = periodsFor(expected)
  const months = expectedPeriods.map(row => ({ date: row.period_date, label: row.period_label, target: Number(row.target_value), forecast: Number(row.forecast_value), actual: row.actual_value === null ? null : Number(row.actual_value) }))
  const running = (scenario: ScenarioRow | null) => cumulative(periodsFor(scenario).map(row => ({ date: row.period_date, label: row.period_label, target: Number(row.target_value), forecast: Number(row.forecast_value) })))
  const cumExpected = cumulative(months)
  const cumBest = running(best)
  const cumDown = running(downside)
  const trend = cumExpected.map((row, index) => ({ label: row.label, expected: row.forecast, best: cumBest[index]?.forecast ?? null, downside: cumDown[index]?.forecast ?? null, target: row.target }))
  const variance = months.map(row => ({ label: row.label, variance: Math.round(row.forecast - row.target), pct: variancePct(row.forecast, row.target) }))

  const target = Number(forecast.target_value)
  const expectedValue = Number(expected?.forecast_value ?? 0)
  const bestValue = Number(best?.forecast_value ?? 0)
  const downValue = Number(downside?.forecast_value ?? 0)
  const targetVariance = variancePct(expectedValue, target)
  const confidenceScore = CONFIDENCE_SCORE[forecast.confidence] ?? 65
  const lastRefreshed = forecast.last_recalculated_at
  const nextUpdateDays = lastRefreshed ? Math.max(0, forecast.refresh_interval_days - Math.floor((now.getTime() - new Date(lastRefreshed).getTime()) / 86_400_000)) : 0
  const metrics = { forecast_confidence_score: confidenceScore, forecast_projected: expectedValue, forecast_best: bestValue }
  await refreshSnapshot(supabase, workspaceId, snapshots.current, metrics, now)
  const priorProjected = snapshots.lastMonth?.forecast_projected
  const projectedChange = typeof priorProjected === 'number' && priorProjected > 0 ? variancePct(expectedValue, priorProjected) : null
  const confidenceDelta = compare(confidenceScore, snapshots.lastMonth, 'forecast_confidence_score')
  const fyLabel = forecast.period_start.slice(0, 4) === forecast.period_end.slice(0, 4) ? `FY${forecast.period_start.slice(0, 4)}` : 'Period'
  const money = (value: number) => formatCompactMoney(value, currency)

  const kpis: KpiItem[] = [
    { id: 'confidence', label: 'Forecast confidence', value: forecast.confidence[0].toUpperCase() + forecast.confidence.slice(1), icon: 'line', tone: 'blue',
      delta: confidenceDelta ? { value: confidenceDelta.value, unit: 'pp', comparison: 'vs last month' } : null },
    { id: 'projected', label: `Projected ${forecast.metric} (${fyLabel})`, value: money(expectedValue), icon: 'money', tone: 'green',
      delta: projectedChange === null ? null : { value: projectedChange, unit: '%', comparison: 'vs prior forecast' } },
    { id: 'variance', label: `Target variance (${fyLabel})`, value: formatSignedPercent(targetVariance), icon: 'target', tone: 'green',
      note: <><span className={cn('font-semibold', expectedValue >= target ? 'text-emerald-600' : 'text-red-500')}>{formatSignedMoney(expectedValue - target, currency)}</span> {expectedValue >= target ? 'above' : 'below'} target</> },
    { id: 'best', label: 'Best case scenario', value: best ? money(bestValue) : '—', icon: 'trend', tone: 'blue',
      note: best ? <><span className="font-semibold text-emerald-600">↑ {formatSignedPercent(variancePct(bestValue, expectedValue)).replace('+', '')}</span> upside</> : 'No best case' },
    { id: 'risk', label: 'Risk exposure', value: forecast.risk_level[0].toUpperCase() + forecast.risk_level.slice(1), icon: 'alert', tone: 'orange',
      note: `${forecast.risk_level[0].toUpperCase() + forecast.risk_level.slice(1)} risk level`, noteTone: forecast.risk_level === 'high' ? 'red' : forecast.risk_level === 'medium' ? 'amber' : 'green' },
    { id: 'freshness', label: 'Model freshness', value: lastRefreshed ? formatAgoLong(lastRefreshed).replace(/^./, char => char.toUpperCase()) : 'Never', icon: 'clock', tone: 'blue',
      note: nextUpdateDays === 0 ? 'Update due now' : `Next update in ${nextUpdateDays} day${nextUpdateDays === 1 ? '' : 's'}` },
  ]

  const rollups = [expected, best, downside].map(scenario => quarterRollup(periodsFor(scenario).map(row => ({ date: row.period_date, target: Number(row.target_value), forecast: Number(row.forecast_value) }))))
  const summaryRows = [...rollups[0].quarters.map((quarter, index) => ({ key: quarter.key, label: quarter.label, target: quarter.target, e: quarter.forecast, b: rollups[1].quarters[index]?.forecast ?? 0, d: rollups[2].quarters[index]?.forecast ?? 0 })),
    { key: 'total', label: rollups[0].total.label, target: rollups[0].total.target, e: rollups[0].total.forecast, b: rollups[1].total.forecast, d: rollups[2].total.forecast }]
  const status = (pctValue: number) => (pctValue >= 0 ? { label: 'On track', tone: 'bg-emerald-100/70 font-medium text-emerald-700' } : pctValue > -5 ? { label: 'At risk', tone: 'bg-orange-100/70 font-medium text-orange-600' } : { label: 'Off track', tone: 'bg-red-100/70 font-medium text-red-600' })
  const confidenceFor = (pctValue: number) => (pctValue >= 0 ? forecast.confidence : pctValue > -5 ? 'medium' : 'low')

  const summaryTable = (
    <TableScroll label="Forecast summary by period">
      <table className="w-full min-w-[1080px] border-collapse text-right text-[12px] tabular-nums text-sg-body lg:text-[9px]">
        <caption className="sr-only">Forecast summary by period for {forecast.name}</caption>
        <thead>
          <tr className="text-sg-muted">
            <th scope="col" colSpan={2} />
            <th scope="colgroup" colSpan={3} className="border-l border-sg-line-soft pb-1 text-center font-normal">Expected (Base)</th>
            <th scope="colgroup" colSpan={3} className="border-l border-sg-line-soft pb-1 text-center font-normal">Best case</th>
            <th scope="colgroup" colSpan={3} className="border-l border-sg-line-soft pb-1 text-center font-normal">Downside</th>
            <th scope="col" colSpan={2} />
          </tr>
          <tr className="text-sg-muted">
            {['Period', 'Target', 'Forecast', 'Variance', 'Variance %', 'Forecast', 'Variance', 'Variance %', 'Forecast', 'Variance', 'Variance %', 'Confidence', 'Status'].map((label, index) => (
              <th key={`${label}-${index}`} scope="col" className={cn('pb-1.5 font-normal text-sg-body', index === 0 ? 'text-left' : index >= 11 ? 'text-center' : '', [2, 11].includes(index) && 'border-l border-sg-line-soft', [5, 8].includes(index) && 'border-l border-sg-line-soft')}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {summaryRows.map(row => {
            const cells = [row.e, row.b, row.d].map(value => ({ value, diff: value - row.target, pct: variancePct(value, row.target) }))
            const state = status(cells[0].pct)
            const level = confidenceFor(cells[0].pct)
            return (
              <tr key={row.key} className={cn('h-11 border-t border-sg-line-soft lg:h-[21px]', row.key === 'total' && 'bg-slate-50 font-medium text-sg-ink')}>
                <th scope="row" className="text-left font-normal">{row.label}</th>
                <td>{money(row.target)}</td>
                {cells.map((cell, index) => (
                  <FragmentCells key={index} value={money(cell.value)} diff={formatSignedMoney(cell.diff, currency)} pct={formatSignedPercent(cell.pct)} negative={cell.diff < 0} />
                ))}
                <td className="border-l border-sg-line-soft text-center"><span className={cn('rounded px-1.5 py-px text-[11px] lg:text-[8px]', LEVEL_TONE[level])}>{level[0].toUpperCase() + level.slice(1)}</span></td>
                <td className="text-center"><span className={cn('rounded px-1.5 py-px text-[11px] lg:text-[8px]', state.tone)}>{state.label}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </TableScroll>
  )

  const scenarioCards = (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:gap-[8px]">
      {detail.scenarios.map(scenario => {
        const style = SCENARIO_STYLE[scenario.scenario_type] ?? SCENARIO_STYLE.custom
        const change = variancePct(Number(scenario.forecast_value), target)
        return (
          <li key={scenario.id} className={cn('relative rounded-lg border p-3 lg:px-[8px] lg:pb-[7px] lg:pt-[7px]', scenario.is_expected ? 'border-[#9fb7fb] bg-sg-blue-soft/30 ring-1 ring-[#9fb7fb]' : 'border-sg-line')}>
            <div className="flex items-start gap-2.5">
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg lg:h-[28px] lg:w-[28px]', style.tone)}><style.icon aria-hidden className="h-4 w-4 lg:h-3.5 lg:w-3.5" /></span>
              <div className={cn('min-w-0 flex-1', scenario.is_expected && 'pr-16 lg:pr-[52px]')}>
                <p className={cn('truncate text-[12px] font-medium lg:text-[9px]', scenario.is_expected ? 'text-sg-blue' : 'text-sg-ink')}>{scenario.name}</p>
                <p className="text-[18px] font-semibold text-sg-ink lg:text-[13px]">{money(Number(scenario.forecast_value))}</p>
                <p className={cn('text-[11px] lg:text-[8px]', change >= 0 ? 'text-emerald-600' : 'text-red-500')}>{change >= 0 ? '↑' : '↓'} {formatSignedPercent(change).replace(/^[+-]/, '')} vs target</p>
              </div>
              {scenario.is_expected && <span className="absolute right-2 top-2 whitespace-nowrap rounded border border-sg-blue/40 px-1 text-[10px] text-sg-blue lg:text-[7.5px]">Most likely</span>}
            </div>
            <dl className="mt-3 space-y-1.5 border-t border-sg-line-soft pt-2 text-[11.5px] lg:mt-[7px] lg:space-y-[5px] lg:pt-[7px] lg:text-[8.5px]">
              <div className="flex justify-between"><dt className="text-sg-body">Probability</dt><dd className="text-sg-ink">{scenario.probability}%</dd></div>
              <div className="flex justify-between"><dt className="text-sg-body">Revenue range</dt><dd className="text-sg-ink">{scenario.range_low !== null && scenario.range_high !== null ? `${money(Number(scenario.range_low))} – ${money(Number(scenario.range_high))}` : '—'}</dd></div>
              <div><dt className="text-sg-body">Key drivers</dt>
                <dd className="mt-1 flex flex-wrap gap-1 lg:mt-[3px] lg:gap-[3px]">{(scenario.drivers.length ? scenario.drivers : scenario.risks).map(driver => <span key={driver} className={cn('whitespace-nowrap rounded px-1.5 py-0.5 text-[10.5px] lg:px-[5px] lg:py-[1px] lg:text-[7.5px]', style.chips)}>{driver}</span>)}</dd>
              </div>
            </dl>
          </li>
        )
      })}
    </ul>
  )

  let body: React.ReactNode
  if (view === 'table') {
    body = <Panel className="mt-3" title={`Forecast summary by period · ${forecast.name}`} footer={<p className="text-[11px] text-sg-muted">All values in {currency} · Last updated {lastRefreshed ? formatAgoLong(lastRefreshed) : 'never'}</p>}>{summaryTable}</Panel>
  } else if (view === 'scenarios') {
    body = (
      <div className="mt-3 space-y-3">
        <Panel title={`Scenario comparison (${fyLabel})`}>{scenarioCards}</Panel>
        <Panel title="All forecasts">
          <ul className="divide-y divide-sg-line-soft">
            {list.rows.map(row => (
              <li key={row.id} className="flex min-h-12 items-center gap-3 text-[13px]">
                <Link href={`${pathname}?forecast=${row.id}`} aria-current={row.id === forecast.id ? 'true' : undefined} className={cn('flex-1 hover:underline', row.id === forecast.id ? 'font-semibold text-sg-blue' : 'text-sg-ink')}>{row.name}</Link>
                <span className="text-sg-muted">{formatDate(row.period_start)} – {formatDate(row.period_end)}</span>
                <span className="w-24 text-right tabular-nums">{formatCompactMoney(Number(row.target_value), row.currency)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    )
  } else {
    body = (
      <>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-[10px] xl:grid-cols-[683fr_510fr] xl:gap-[15px]">
          <Panel title={<>{forecast.metric === 'revenue' ? 'Revenue' : forecast.name} forecast over time</>} info="Running total by month for each scenario against the cumulative target."
            headerClassName="lg:pt-[7px]!" bodyClassName="lg:pt-[5px]! lg:pb-[4px]!" footerClassName="lg:pb-[4px]!"
            footer={<FooterLink href={`${pathname}?view=table&forecast=${forecast.id}`}>View full forecast model</FooterLink>}>
            <Legend className="mb-2" items={[
              { label: 'Expected (Base)', colour: '#3f6ff8' }, { label: 'Best case', colour: '#16a34a', dashed: true },
              { label: 'Downside', colour: '#ef4444', dashed: true }, { label: 'Target', colour: '#94a3b8', dashed: true },
            ]} />
            <div className="flex flex-col gap-3 lg:flex-row lg:gap-[12px]">
              <LineChart className="min-w-0 flex-1" caption={`${forecast.name}: cumulative forecast by scenario`} xKey="label" data={trend} height={162} valueFormat={{ money: currency }}
                series={[
                  { key: 'expected', label: 'Expected (Base)', colour: '#3f6ff8' }, { key: 'best', label: 'Best case', colour: '#16a34a', dashed: true },
                  { key: 'downside', label: 'Downside', colour: '#ef4444', dashed: true }, { key: 'target', label: 'Target', colour: '#94a3b8', dashed: true },
                ]} />
              <aside className="rounded-lg border border-sg-line-soft p-3 lg:w-[142px] lg:p-[10px]" aria-label={`${fyLabel} projection`}>
                <h3 className="text-[12px] font-semibold text-sg-ink lg:text-[9px]">{fyLabel} projection</h3>
                <dl className="mt-2 space-y-2.5 text-[12px] lg:mt-[10px] lg:space-y-[10px] lg:text-[8.5px]">
                  {[['Best case', bestValue, 'text-emerald-600'], ['Expected (Base)', expectedValue, 'text-sg-blue'], ['Target', target, 'text-sg-body'], ['Downside', downValue, 'text-red-500']].map(([label, value, tone]) => (
                    <div key={label as string}>
                      <div className="flex justify-between"><dt className={tone as string}>{label as string}</dt><dd className="text-sg-ink">{money(value as number)}</dd></div>
                      {label !== 'Target' && <p className={cn('flex items-center gap-0.5', (value as number) >= target ? 'text-emerald-600' : 'text-red-500')}>
                        {(value as number) >= target ? <ArrowUp aria-hidden className="h-2.5 w-2.5" /> : <ArrowDown aria-hidden className="h-2.5 w-2.5" />}{formatSignedPercent(variancePct(value as number, target)).replace(/^[+-]/, '')}</p>}
                    </div>
                  ))}
                </dl>
              </aside>
            </div>
          </Panel>
          <Panel title="Variance to target" headerClassName="lg:pt-[7px]!" bodyClassName="lg:pt-[5px]! lg:pb-[4px]!" footerClassName="lg:pb-[4px]!" footer={<FooterLink href={`${pathname}?view=table&forecast=${forecast.id}`}>View variance analysis</FooterLink>}>
            <Legend className="mb-2" items={[{ label: 'Above target', colour: '#16a34a', shape: 'square' }, { label: 'Below target', colour: '#ef4444', shape: 'square' }, { label: 'Variance %', colour: '#3f6ff8' }]} />
            <VarianceChart caption="Monthly variance to target" data={variance} currency={currency} height={172} />
          </Panel>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-[15px] xl:grid-cols-[570fr_293fr_330fr] xl:gap-[13px]">
          <Panel title={`Scenario comparison (${fyLabel})`} headerClassName={ROW_HEADER} bodyClassName="lg:pt-[6px]! lg:pb-[5px]!" footerClassName="lg:pb-[6px]!" footer={<FooterLink href={`${pathname}?view=scenarios&forecast=${forecast.id}`}>View all scenarios</FooterLink>}>{scenarioCards}</Panel>
          <Panel title="Model assumptions & inputs" headerClassName={ROW_HEADER} bodyClassName="lg:pt-[5px]! lg:pb-[5px]!" footerClassName="lg:pb-[6px]!" footer={<FooterLink href={`${pathname}?view=scenarios&forecast=${forecast.id}`}>Manage assumptions</FooterLink>}>
            {detail.assumptions.length ? (
              <ul className="divide-y divide-sg-line-soft">
                {detail.assumptions.map((assumption, index) => {
                  const Icon = ASSUMPTION_ICON[index % ASSUMPTION_ICON.length]
                  return (
                    <li key={assumption.id} className="group flex items-center gap-2 py-1 text-[12px] text-sg-body first:pt-0 lg:py-[3.5px] lg:text-[8.5px]">
                      <Icon aria-hidden className="h-3.5 w-3.5 text-slate-500 lg:h-3 lg:w-3" />
                      <span className="flex-1 truncate">{assumption.label}</span>
                      <span className="text-sg-ink">{assumption.value_text}</span>
                      <span className={cn('w-14 rounded px-1.5 text-center text-[11px] lg:w-[42px] lg:text-[8px]', LEVEL_TONE[assumption.confidence])}>{assumption.confidence[0].toUpperCase() + assumption.confidence.slice(1)}</span>
                      <span className="inline-flex lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:focus-within:opacity-100"><AssumptionEditor id={assumption.id} label={assumption.label} value={assumption.value_text} numeric={assumption.numeric_value} confidence={assumption.confidence} canEdit={can.manageAssumptions} /></span>
                    </li>
                  )
                })}
              </ul>
            ) : <EmptyState compact title="No assumptions recorded" />}
          </Panel>
          <Panel title="Recent forecast updates" headerClassName={ROW_HEADER} bodyClassName="lg:pt-[5px]! lg:pb-[5px]!" footerClassName="lg:pb-[6px]!" footer={<FooterLink href={strategyPath(kind)}>View all activity</FooterLink>}>
            {activity.length ? (
              <ul className="space-y-3 lg:space-y-[14px]">
                {activity.map(row => (
                  <li key={row.id} className="flex items-start gap-2">
                    <Avatar person={row.actor} size={22} />
                    <div className="min-w-0 flex-1 text-[12px] lg:text-[8.5px]">
                      <p className="truncate text-sg-muted"><span className="font-semibold text-sg-ink">{shortName(row.actor?.full_name)}</span> {row.action}</p>
                      <p className="truncate text-sg-body">{row.summary}</p>
                    </div>
                    <time dateTime={row.created_at} className="shrink-0 text-[11px] text-sg-subtle lg:text-[8.5px]">{formatRelative(row.created_at)}</time>
                  </li>
                ))}
              </ul>
            ) : <EmptyState compact title="No forecast updates yet" />}
          </Panel>
        </div>

        <Panel className="mt-3 lg:mt-[10px]" title="Forecast summary by period" headerClassName={ROW_HEADER} bodyClassName="lg:pt-0!"
          footer={(
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-sg-muted lg:text-[8.5px]">
              <span>All values in {currency} · Last updated {lastRefreshed ? formatAgoLong(lastRefreshed) : 'never'}</span>
              <Link href={`${pathname}?view=table&forecast=${forecast.id}`} className="inline-flex min-h-10 items-center font-medium text-sg-blue hover:underline lg:min-h-0 lg:text-[9.5px]">View full forecast table →</Link>
            </div>
          )}>
          {summaryTable}
        </Panel>
      </>
    )
  }

  return (
    <>
      {header}
      {list.error && <div className="mb-3"><PanelError message="Forecasts could not load. Refresh to try again." /></div>}
      <KpiStrip items={kpis} itemClassName="lg:h-[78px]! lg:py-[10px]! lg:gap-[8px]! lg:pr-[8px]! [&_p:first-child]:lg:text-[9px]! [&_p:nth-child(3)]:lg:text-[8.5px]!" />
      {filters}
      {body}
    </>
  )
}

function FragmentCells({ value, diff, pct, negative }: { value: string; diff: string; pct: string; negative: boolean }) {
  return (
    <>
      <td className="border-l border-sg-line-soft">{value}</td>
      <td className={negative ? 'text-red-500' : 'text-emerald-600'}>{diff}</td>
      <td className={negative ? 'text-red-500' : 'text-emerald-600'}>{pct}</td>
    </>
  )
}
