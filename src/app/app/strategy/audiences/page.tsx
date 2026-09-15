import Link from 'next/link'
import { Download, Plus, RefreshCw, Upload } from 'lucide-react'
import { requireStrategyModule, listWorkspacePeople } from '@/lib/strategy/server'
import {
  audienceAggregates, audienceGeography, hydrateAudiences, listActivity, listAudienceMetrics, listAudiences,
} from '@/lib/strategy/data'
import { parseStrategyQuery, type RawParams } from '@/lib/strategy/query'
import {
  AUDIENCE_CHANNELS, CHANNEL_LABELS, LIFECYCLE_LABELS,
  LIFECYCLE_STAGES, STRATEGY_MODULE_META, fitBand,
} from '@/lib/strategy/constants'
import StrategyHeader from '@/components/strategy/StrategyHeader'
import ViewSwitcher from '@/components/strategy/ViewSwitcher'
import KpiStrip from '@/components/strategy/KpiStrip'
import FilterBar, { FilterChips, type FilterField } from '@/components/strategy/FilterBar'
import ActivityPanel from '@/components/strategy/ActivityPanel'
import { AccessState, EmptyState } from '@/components/strategy/states'
import {
  AvatarStack, Avatar, ChannelChips, Panel, STRATEGY_PAGE, ScoreRing, BarRow, formatCompact,
  CARD, CARD_SHADOW, formatDayMonth,
} from '@/components/strategy/primitives'
import { ColumnChart, DonutChart, TrendChart } from '@/components/strategy/charts'
import { cn } from '@/lib/utils'
import type { KpiValue } from '@/lib/strategy/types'

export const metadata = {
  title: 'Audiences · Strategy · Caption Fox',
  description: STRATEGY_MODULE_META.audiences.description,
}

export default async function AudiencesPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireStrategyModule('audiences')

  if (!access.allowed) {
    return (
      <div className={STRATEGY_PAGE}>
        <StrategyHeader module="audiences" modules={modules} />
        <AccessState access={access} />
      </div>
    )
  }

  const query = parseStrategyQuery(params, { views: ['cards', 'table', 'map', 'compare'], defaultView: 'cards' })

  const [page, people, aggregates, geography, activity] = await Promise.all([
    listAudiences(supabase, ctx.workspaceId, query, {
      paginate: query.view !== 'map' && query.view !== 'compare',
      limit: query.view === 'map' || query.view === 'compare' ? 200 : undefined,
    }),
    listWorkspacePeople(supabase, ctx.workspaceId),
    audienceAggregates(supabase, ctx.workspaceId),
    audienceGeography(supabase, ctx.workspaceId),
    listActivity(supabase, ctx.workspaceId, { entityTypes: ['audience'], limit: 5 }),
  ])

  const audiences = await hydrateAudiences(supabase, ctx.workspaceId, page.rows)
  const channelMetrics = await listAudienceMetrics(supabase, ctx.workspaceId, ['channel', 'gender', 'age'])

  const kpis: KpiValue[] = [
    { id: 'total', label: 'Total audiences', value: String(aggregates.total), tone: 'blue', icon: 'users2' },
    { id: 'segments', label: 'Active segments', value: String(aggregates.active), tone: 'green', icon: 'trend' },
    { id: 'coverage', label: 'Persona coverage', value: `${aggregates.avgCompleteness}%`, tone: 'violet', icon: 'users' },
    { id: 'reach', label: 'Geographic reach', value: String(geography.countries), hint: 'Countries', tone: 'blue', icon: 'globe' },
    { id: 'missing', label: 'Missing data', value: `${aggregates.missingPct}%`, tone: 'red', icon: 'alert' },
    { id: 'fit', label: 'Campaign match score', value: String(aggregates.avgFit), tone: 'green', icon: 'target' },
  ]

  const filterFields: FilterField[] = [
    { key: 'status', label: 'Status', options: [
      { value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }, { value: 'draft', label: 'Draft' },
    ] },
    { key: 'lifecycle', label: 'Lifecycle', options: LIFECYCLE_STAGES.map(value => ({ value, label: LIFECYCLE_LABELS[value] })) },
    { key: 'channel', label: 'Channel', options: AUDIENCE_CHANNELS.map(value => ({ value, label: CHANNEL_LABELS[value] })) },
    { key: 'owner', label: 'Owner', options: people.map(p => ({ value: p.id, label: p.full_name ?? p.email ?? 'Unknown' })) },
  ]

  const channelSlices = channelMetrics.filter(m => m.metric_group === 'channel')
    .sort((a, b) => b.metric_value - a.metric_value).slice(0, 5)
  const maxChannel = Math.max(1, ...channelSlices.map(s => s.metric_value))

  const genderSlices = channelMetrics.filter(m => m.metric_group === 'gender')
  const genderTotal = genderSlices.reduce((sum, s) => sum + s.metric_value, 0)
  const genderColours: Record<string, string> = { female: '#3b82f6', male: '#8b5cf6', other: '#94a3b8' }
  const ageSlices = channelMetrics.filter(m => m.metric_group === 'age')
    .map(m => ({ label: m.metric_label, value: m.metric_value }))

  const growthSeries = channelMetrics.filter(m => m.metric_group === 'growth')
    .map(m => ({ label: formatDayMonth(m.metric_date), size: m.metric_value }))

  return (
    <div className={STRATEGY_PAGE}>
      <StrategyHeader
        module="audiences" modules={modules}
        actions={(
          <>
            {capabilities.createAudience && (
              <Link href="/app/strategy/audiences?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700">
                <Plus size={15} /> New audience
              </Link>
            )}
            {capabilities.importAudiences && (
              <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                <Upload size={15} /> Import segments
              </button>
            )}
            {capabilities.syncCrm && (
              <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                <RefreshCw size={15} /> Sync CRM
              </button>
            )}
            {capabilities.export && (
              <Link href="/app/strategy/audiences?export=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                <Download size={15} /> Export
              </Link>
            )}
          </>
        )}
      />

      <div className="mb-4"><KpiStrip items={kpis} /></div>

      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <FilterBar query={query} fields={filterFields} />
        <ViewSwitcher views={['cards', 'table', 'map', 'compare']} active={query.view} />
      </div>
      <FilterChips query={query} fields={filterFields} />

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_320px]">
        <div>
          {audiences.length === 0
            ? (
              <EmptyState
                title="No audiences yet"
                message="Create or import your first audience segment to start targeting the right people."
                action={capabilities.createAudience && (
                  <Link href="/app/strategy/audiences?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700">
                    <Plus size={15} /> New audience
                  </Link>
                )}
              />
            )
            : query.view === 'table'
            ? <AudiencesTable audiences={audiences} />
            : query.view === 'compare'
            ? <AudiencesCompare audiences={audiences.slice(0, 4)} />
            : query.view === 'map'
            ? <AudiencesMapView geography={geography.rows} />
            : <AudiencesCards audiences={audiences} />}
        </div>

        {query.view !== 'map' && (
          <Panel title="Geographic coverage" viewAllHref="/app/strategy/audiences?view=map" viewAllLabel="View full geographic breakdown">
            <AudiencesMapView geography={geography.rows.slice(0, 5)} compact />
          </Panel>
        )}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title="Audience growth" info="Total audience size over time" viewAllHref="/app/strategy/audiences?view=table" viewAllLabel="View growth details">
          <TrendChart
            data={growthSeries as unknown as Record<string, string | number>[]}
            series={[{ key: 'size', label: 'Audience size', colour: '#3b82f6' }]}
            area height={160}
          />
        </Panel>

        <Panel title="Channel affinity" info="Where audiences are most active" viewAllHref="/app/strategy/audiences?view=table" viewAllLabel="View channel insights">
          {channelSlices.length === 0
            ? <EmptyState compact title="No channel data" message="Channel affinity appears once audiences record engagement." />
            : (
              <ul className="space-y-2.5">
                {channelSlices.map(metric => (
                  <BarRow key={metric.metric_key} label={metric.metric_label} value={Math.round(metric.metric_value)} max={maxChannel} suffix="%" />
                ))}
              </ul>
            )}
        </Panel>

        <Panel title="Demographic mix" info="Age and gender distribution" viewAllHref="/app/strategy/audiences?view=table" viewAllLabel="View full demographics">
          {genderSlices.length === 0 && ageSlices.length === 0
            ? <EmptyState compact title="No demographic data" message="Demographic breakdowns appear once audiences record data." />
            : (
              <div className="flex items-center gap-3">
                <DonutChart
                  slices={genderSlices.map(s => ({ key: s.metric_key, label: s.metric_label, value: s.metric_value, colour: genderColours[s.metric_key] ?? '#94a3b8' }))}
                  total={genderTotal} size={90}
                />
                <div className="min-w-0 flex-1">
                  <ColumnChart data={ageSlices} height={70} />
                </div>
              </div>
            )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title="Audience insights & intelligence" viewAllHref="/app/strategy/research" viewAllLabel="Go to research library" className="xl:col-span-2">
          {audiences.length === 0
            ? <EmptyState compact title="No insights yet" message="Insights surface once audiences and research are linked." />
            : (
              <ul className="space-y-2">
                {audiences.slice(0, 3).map(audience => (
                  <li key={audience.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-slate-800">{audience.name}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {audience.description || `${formatCompact(audience.audience_size)} people · ${LIFECYCLE_LABELS[audience.lifecycle_stage as keyof typeof LIFECYCLE_LABELS] ?? audience.lifecycle_stage}`}
                      </p>
                    </div>
                    <span className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                      audience.growth_rate > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500',
                    )}>
                      {audience.growth_rate > 0 ? 'High impact' : 'Opportunity'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
        </Panel>

        <ActivityPanel title="Recent audience activity" rows={activity} viewAllHref="/app/strategy/audiences?view=table" />
      </div>
    </div>
  )
}

type AudRow = Awaited<ReturnType<typeof hydrateAudiences>>[number]

function AudiencesCards({ audiences }: { audiences: AudRow[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
      {audiences.map(audience => {
        const fit = fitBand(audience.fit_score)
        return (
          <div key={audience.id} className={cn(CARD, CARD_SHADOW, 'p-4')}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-[13px] font-semibold text-slate-900">{audience.name}</h3>
                <p className="truncate text-[11px] text-slate-500">{audience.description}</p>
              </div>
              <ScoreRing value={audience.fit_score} colour={fit.colour} size={44} />
            </div>

            <div className="mb-2 grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <p className="text-slate-400">Audience size</p>
                <p className="font-semibold text-slate-800">{formatCompact(audience.audience_size)}</p>
              </div>
              <div>
                <p className="text-slate-400">Fit score</p>
                <p className="font-semibold text-slate-800">{fit.label}</p>
              </div>
            </div>

            <div className="mb-2">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">Top personas</p>
              <AvatarStack people={(audience.personas ?? []).map(p => ({ id: p.id, name: p.name, avatar_url: p.avatar_url }))} />
            </div>

            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Top channels</span>
              <ChannelChips channels={audience.channels} />
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                {LIFECYCLE_LABELS[audience.lifecycle_stage as keyof typeof LIFECYCLE_LABELS] ?? audience.lifecycle_stage}
              </span>
              <span className="text-slate-400">{audience.linkedObjectives?.length ?? 0} objectives</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AudiencesTable({ audiences }: { audiences: AudRow[] }) {
  return (
    <Panel bodyClassName="px-0 pb-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-t border-slate-100 text-[11px] text-slate-400">
              <th className="px-4 py-2.5 font-medium">Audience</th>
              <th className="px-2 py-2.5 font-medium">Lifecycle</th>
              <th className="px-2 py-2.5 font-medium">Size</th>
              <th className="px-2 py-2.5 font-medium">Growth</th>
              <th className="px-2 py-2.5 font-medium">Fit score</th>
              <th className="px-2 py-2.5 font-medium">Owner</th>
              <th className="px-4 py-2.5 font-medium">Data completeness</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {audiences.map(audience => {
              const fit = fitBand(audience.fit_score)
              return (
                <tr key={audience.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{audience.name}</td>
                  <td className="px-2 py-2.5 text-slate-500">{LIFECYCLE_LABELS[audience.lifecycle_stage as keyof typeof LIFECYCLE_LABELS] ?? audience.lifecycle_stage}</td>
                  <td className="px-2 py-2.5 text-slate-500">{formatCompact(audience.audience_size)}</td>
                  <td className="px-2 py-2.5 text-slate-500">{audience.growth_rate > 0 ? '+' : ''}{audience.growth_rate}%</td>
                  <td className="px-2 py-2.5 text-slate-500">{fit.label} ({audience.fit_score})</td>
                  <td className="px-2 py-2.5"><Avatar person={audience.owner} size={20} /></td>
                  <td className="px-4 py-2.5 text-slate-500">{audience.data_completeness}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function AudiencesCompare({ audiences }: { audiences: AudRow[] }) {
  if (audiences.length < 2) {
    return <EmptyState title="Select audiences to compare" message="Add `?compare=id,id` or choose at least two audiences from the table to see them side by side." />
  }
  const rows: { label: string; render: (a: AudRow) => React.ReactNode }[] = [
    { label: 'Audience size', render: a => formatCompact(a.audience_size) },
    { label: 'Growth', render: a => `${a.growth_rate > 0 ? '+' : ''}${a.growth_rate}%` },
    { label: 'Fit score', render: a => `${a.fit_score} · ${fitBand(a.fit_score).label}` },
    { label: 'Lifecycle', render: a => LIFECYCLE_LABELS[a.lifecycle_stage as keyof typeof LIFECYCLE_LABELS] ?? a.lifecycle_stage },
    { label: 'Channels', render: a => a.channels.map(c => CHANNEL_LABELS[c] ?? c).join(', ') || '—' },
    { label: 'Data completeness', render: a => `${a.data_completeness}%` },
  ]
  return (
    <Panel bodyClassName="px-0 pb-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-t border-slate-100 text-[11px] text-slate-400">
              <th className="px-4 py-2.5 font-medium">Metric</th>
              {audiences.map(a => <th key={a.id} className="px-4 py-2.5 font-medium text-slate-700">{a.name}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(row => (
              <tr key={row.label}>
                <td className="px-4 py-2.5 font-medium text-slate-500">{row.label}</td>
                {audiences.map(a => <td key={a.id} className="px-4 py-2.5 text-slate-800">{row.render(a)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function AudiencesMapView({ geography, compact }: { geography: { code: string; name: string; size: number }[]; compact?: boolean }) {
  if (geography.length === 0) {
    return <EmptyState compact={compact} title="No geographic data" message="Geographic breakdowns appear once audience regions are recorded." />
  }
  const max = Math.max(1, ...geography.map(g => g.size))
  return (
    <ul className="space-y-2">
      {geography.map(country => (
        <BarRow key={country.code} label={country.name} value={country.size} max={max} suffix="" tone="bg-blue-500" />
      ))}
    </ul>
  )
}
