import Link from 'next/link'
import { Download, GitCompare, Plus } from 'lucide-react'
import { requireStrategyModule } from '@/lib/strategy/server'
import {
  forecastAggregates, forecastPeriodSeries, getForecastDetail, listActivity, listForecasts,
} from '@/lib/strategy/data'
import { parseStrategyQuery, type RawParams } from '@/lib/strategy/query'
import {
  CONFIDENCE_BADGE, CONFIDENCE_LABELS, FORECAST_METRIC_LABELS,
  SCENARIO_COLOUR, SCENARIO_TYPE_LABELS, STRATEGY_MODULE_META,
} from '@/lib/strategy/constants'
import StrategyHeader from '@/components/strategy/StrategyHeader'
import ViewSwitcher from '@/components/strategy/ViewSwitcher'
import KpiStrip from '@/components/strategy/KpiStrip'
import ActivityPanel from '@/components/strategy/ActivityPanel'
import { AccessState, EmptyState } from '@/components/strategy/states'
import {
  CARD, CARD_SHADOW, Panel, STRATEGY_PAGE, formatCompactMoney, formatDayMonth,
  formatMetric, formatRelative,
} from '@/components/strategy/primitives'
import { TrendChart, VarianceChart } from '@/components/strategy/charts'
import { cn } from '@/lib/utils'
import type { KpiValue } from '@/lib/strategy/types'

export const metadata = {
  title: 'Forecasts · Strategy · Caption Fox',
  description: STRATEGY_MODULE_META.forecasts.description,
}

const STATUS_TONE: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600', blue: 'bg-blue-50 text-blue-600', slate: 'bg-slate-100 text-slate-500',
}

export default async function ForecastsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access, workspace } = await requireStrategyModule('forecasts')

  if (!access.allowed) {
    return (
      <div className={STRATEGY_PAGE}>
        <StrategyHeader module="forecasts" modules={modules} />
        <AccessState access={access} />
      </div>
    )
  }

  const query = parseStrategyQuery(params, { views: ['charts', 'table', 'scenarios'], defaultView: 'charts' })

  const [page, aggregates, series, activity] = await Promise.all([
    listForecasts(supabase, ctx.workspaceId, query),
    forecastAggregates(supabase, ctx.workspaceId),
    forecastPeriodSeries(supabase, ctx.workspaceId, 12),
    listActivity(supabase, ctx.workspaceId, { entityTypes: ['forecast', 'scenario', 'assumption'], limit: 5 }),
  ])

  const forecasts = page.rows
  const active = query.forecast
    ? forecasts.find(f => f.id === query.forecast) ?? forecasts[0]
    : forecasts[0]
  const detail = active ? await getForecastDetail(supabase, ctx.workspaceId, active.id) : null

  const currency = active?.currency ?? workspace.currency

  const kpis: KpiValue[] = [
    { id: 'confidence', label: 'Forecast confidence', value: capitalise(aggregates.confidence), tone: 'blue', icon: 'trend' },
    { id: 'projected', label: 'Projected revenue (FY)', value: formatMetric(aggregates.expected, 'revenue', currency), tone: 'green', icon: 'money' },
    { id: 'variance', label: 'Target variance (FY)', value: `${aggregates.variancePct >= 0 ? '+' : ''}${aggregates.variancePct}%`, tone: aggregates.variancePct >= 0 ? 'green' : 'red', icon: 'target' },
    { id: 'best', label: 'Best case scenario', value: formatMetric(aggregates.best, 'revenue', currency), hint: aggregates.target ? `${(((aggregates.best - aggregates.target) / aggregates.target) * 100).toFixed(1)}% upside` : undefined, trend: 'up', tone: 'blue', icon: 'trend' },
    { id: 'risk', label: 'Risk exposure', value: capitalise(aggregates.risk), tone: aggregates.risk === 'high' ? 'red' : aggregates.risk === 'medium' ? 'amber' : 'green', icon: 'alert' },
    { id: 'fresh', label: 'Model freshness', value: aggregates.lastRecalculated ? formatRelative(aggregates.lastRecalculated) : 'Never', tone: 'slate', icon: 'clock' },
  ]

  const chartData = series.map(period => ({ label: formatDayMonth(period.date), forecast: period.forecast, target: period.target }))
  const varianceData = series.map(period => ({
    label: formatDayMonth(period.date), variance: period.forecast - period.target,
    variancePct: period.target > 0 ? Number((((period.forecast - period.target) / period.target) * 100).toFixed(1)) : 0,
  }))

  return (
    <div className={STRATEGY_PAGE}>
      <StrategyHeader
        module="forecasts" modules={modules}
        actions={(
          <>
            {capabilities.createForecast && (
              <Link href="/app/strategy/forecasts?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700">
                <Plus size={15} /> New forecast
              </Link>
            )}
            {capabilities.editForecast && active && (
              <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                <Plus size={15} /> Add scenario
              </button>
            )}
            <Link href="/app/strategy/forecasts?view=scenarios" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
              <GitCompare size={15} /> Compare targets
            </Link>
            {capabilities.export && (
              <Link href="/app/strategy/forecasts?export=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                <Download size={15} /> Export
              </Link>
            )}
          </>
        )}
      />

      <div className="mb-4"><KpiStrip items={kpis} /></div>

      {forecasts.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {forecasts.map(forecast => (
            <Link
              key={forecast.id} href={`/app/strategy/forecasts?forecast=${forecast.id}&view=${query.view}`}
              className={cn(
                'rounded-full px-3 py-1.5 text-[12px] font-medium',
                active?.id === forecast.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
              )}
            >
              {forecast.name}
            </Link>
          ))}
        </div>
      )}

      <div className="mb-4 flex justify-end">
        <ViewSwitcher views={['charts', 'table', 'scenarios']} active={query.view} />
      </div>

      {forecasts.length === 0
        ? (
          <EmptyState
            title="No forecasts yet"
            message="Create a forecast to model future performance and compare scenarios against targets."
            action={capabilities.createForecast && (
              <Link href="/app/strategy/forecasts?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700">
                <Plus size={15} /> New forecast
              </Link>
            )}
          />
        )
        : query.view === 'table'
        ? <ForecastTable forecasts={forecasts} />
        : query.view === 'scenarios' && detail
        ? <ScenarioComparison scenarios={detail.scenarios} currency={currency} target={active?.target_value ?? 0} />
        : detail && active
        ? <ForecastCharts chartData={chartData} varianceData={varianceData} currency={currency} />
        : null}

      {detail && active && query.view !== 'scenarios' && (
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Panel title="Scenario comparison" info={`FY${new Date(active.period_end).getFullYear()}`} viewAllHref="/app/strategy/forecasts?view=scenarios" viewAllLabel="View all scenarios" className="xl:col-span-2">
            <ScenarioComparison scenarios={detail.scenarios} currency={currency} target={active.target_value} compact />
          </Panel>

          <Panel title="Model assumptions & inputs" viewAllHref="/app/strategy/forecasts?view=table" viewAllLabel="Manage assumptions">
            {detail.assumptions.length === 0
              ? <EmptyState compact title="No assumptions yet" message="Model assumptions will appear here." />
              : (
                <ul className="space-y-2">
                  {detail.assumptions.map(assumption => (
                    <li key={assumption.id} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate text-slate-600">{assumption.label}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span className="font-medium text-slate-800">{assumption.value_text}</span>
                        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', STATUS_TONE[CONFIDENCE_BADGE[assumption.confidence as keyof typeof CONFIDENCE_BADGE] ?? 'slate'])}>
                          {CONFIDENCE_LABELS[assumption.confidence as keyof typeof CONFIDENCE_LABELS] ?? assumption.confidence}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
          </Panel>
        </div>
      )}

      {query.view !== 'scenarios' && (
        <div className="mt-4">
          <ActivityPanel title="Recent forecast updates" rows={activity} viewAllHref="/app/strategy/forecasts?view=table" />
        </div>
      )}

      <Panel title="Forecast summary by period" viewAllHref="/app/strategy/forecasts?view=table" viewAllLabel="View full forecast table" bodyClassName="px-0 pb-0" className="mt-4">
        <PeriodSummary series={series} currency={currency} />
      </Panel>
    </div>
  )
}

type ForecastRowT = Awaited<ReturnType<typeof listForecasts>>['rows'][number]
type ForecastDetail = Awaited<ReturnType<typeof getForecastDetail>>

function ForecastCharts({
  chartData, varianceData, currency,
}: {
  chartData: Record<string, string | number>[]
  varianceData: { label: string; variance: number; variancePct: number }[]
  currency: string
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Revenue forecast over time" viewAllHref="/app/strategy/forecasts?view=table" viewAllLabel="View full forecast model">
        <TrendChart
          data={chartData}
          series={[
            { key: 'forecast', label: 'Expected (Base)', colour: '#3b82f6' },
            { key: 'target', label: 'Target', colour: '#94a3b8', dashed: true },
          ]}
          currency={currency} height={220}
        />
      </Panel>
      <Panel title="Variance to target" viewAllHref="/app/strategy/forecasts?view=table" viewAllLabel="View variance analysis">
        <VarianceChart data={varianceData} currency={currency} height={220} />
      </Panel>
    </div>
  )
}

function ScenarioComparison({
  scenarios, currency, target, compact,
}: { scenarios: ForecastDetail['scenarios']; currency: string; target: number; compact?: boolean }) {
  if (scenarios.length === 0) {
    return <EmptyState compact={compact} title="No scenarios yet" message="Add best, expected and downside scenarios to compare outcomes." />
  }
  return (
    <div className={cn('grid gap-3', compact ? 'sm:grid-cols-3' : 'md:grid-cols-3')}>
      {scenarios.map(scenario => {
        const variance = target > 0 ? (((scenario.forecast_value - target) / target) * 100).toFixed(1) : '0.0'
        const colour = SCENARIO_COLOUR[scenario.scenario_type as keyof typeof SCENARIO_COLOUR] ?? '#3b82f6'
        return (
          <div
            key={scenario.id}
            className={cn(CARD, CARD_SHADOW, 'p-3.5', scenario.is_expected && 'ring-2 ring-blue-200')}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-800">
                <span className="h-2 w-2 rounded-full" style={{ background: colour }} />
                {SCENARIO_TYPE_LABELS[scenario.scenario_type as keyof typeof SCENARIO_TYPE_LABELS] ?? scenario.name}
              </span>
              {scenario.is_expected && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-600">Most likely</span>}
            </div>
            <p className="text-[19px] font-bold text-slate-900">{formatMetric(scenario.forecast_value, 'revenue', currency)}</p>
            <p className={cn('text-[11px] font-medium', Number(variance) >= 0 ? 'text-emerald-600' : 'text-red-500')}>
              {Number(variance) >= 0 ? '+' : ''}{variance}% vs target
            </p>
            <p className="mt-2 text-[11px] text-slate-400">Probability</p>
            <p className="text-[12px] font-medium text-slate-700">{scenario.probability}%</p>
            {(scenario.range_low || scenario.range_high) && (
              <p className="mt-1 text-[11px] text-slate-400">
                Range {formatMetric(scenario.range_low ?? 0, 'revenue', currency)} – {formatMetric(scenario.range_high ?? 0, 'revenue', currency)}
              </p>
            )}
            {scenario.drivers.length > 0 && (
              <>
                <p className="mt-2 text-[11px] text-slate-400">Key drivers</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {scenario.drivers.slice(0, 2).map(driver => (
                    <span key={driver} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{driver}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ForecastTable({ forecasts }: { forecasts: ForecastRowT[] }) {
  return (
    <Panel bodyClassName="px-0 pb-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-t border-slate-100 text-[11px] text-slate-400">
              <th className="px-4 py-2.5 font-medium">Forecast</th>
              <th className="px-2 py-2.5 font-medium">Metric</th>
              <th className="px-2 py-2.5 font-medium">Period</th>
              <th className="px-2 py-2.5 font-medium">Target</th>
              <th className="px-2 py-2.5 font-medium">Confidence</th>
              <th className="px-4 py-2.5 font-medium">Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {forecasts.map(forecast => (
              <tr key={forecast.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-800">{forecast.name}</td>
                <td className="px-2 py-2.5 text-slate-500">{FORECAST_METRIC_LABELS[forecast.metric as keyof typeof FORECAST_METRIC_LABELS] ?? forecast.metric}</td>
                <td className="px-2 py-2.5 text-slate-500">{formatDayMonth(forecast.period_start)} – {formatDayMonth(forecast.period_end)}</td>
                <td className="px-2 py-2.5 text-slate-500">{formatMetric(forecast.target_value, forecast.metric, forecast.currency)}</td>
                <td className="px-2 py-2.5 text-slate-500 capitalize">{forecast.confidence}</td>
                <td className="px-4 py-2.5 text-slate-500 capitalize">{forecast.risk_level}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function PeriodSummary({ series, currency }: { series: Awaited<ReturnType<typeof forecastPeriodSeries>>; currency: string }) {
  if (series.length === 0) {
    return <EmptyState compact title="No period data" message="Forecast periods will appear here once modelled." className="px-4 pb-4" />
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[12px]">
        <thead>
          <tr className="border-t border-slate-100 text-[11px] text-slate-400">
            <th className="px-4 py-2.5 font-medium">Period</th>
            <th className="px-2 py-2.5 font-medium">Target</th>
            <th className="px-2 py-2.5 font-medium">Forecast</th>
            <th className="px-4 py-2.5 font-medium">Variance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {series.map(period => {
            const variance = period.target > 0 ? (((period.forecast - period.target) / period.target) * 100).toFixed(1) : '0.0'
            return (
              <tr key={period.date}>
                <td className="px-4 py-2.5 font-medium text-slate-800">{period.label}</td>
                <td className="px-2 py-2.5 text-slate-500">{formatCompactMoney(period.target, currency)}</td>
                <td className="px-2 py-2.5 text-slate-500">{formatCompactMoney(period.forecast, currency)}</td>
                <td className={cn('px-4 py-2.5 font-medium', Number(variance) >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                  {Number(variance) >= 0 ? '+' : ''}{variance}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
