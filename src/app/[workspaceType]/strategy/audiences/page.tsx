import type { Metadata } from 'next'
import Link from 'next/link'
import { Globe2, Sparkles, UserRoundSearch } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStrategyPageContext } from '@/lib/strategy/page-context'
import { audienceGeography, hydrateAudiences, listActivity, listAudienceMetrics, listAudiences } from '@/lib/strategy/data'
import { parseStrategyQuery, type RawParams } from '@/lib/strategy/query'
import { compare, loadSnapshots, refreshSnapshot } from '@/lib/strategy/kpis'
import { average, pct } from '@/lib/strategy/metrics'
import { formatCompact, formatDate, formatRelative, shortName } from '@/lib/strategy/format'
import {
  AUDIENCE_CHANNELS, AUDIENCE_STATUSES, AUDIENCE_STATUS_LABELS, CHANNEL_LABELS, fitBand, LIFECYCLE_LABELS, LIFECYCLE_STAGES, strategyPath,
  type AudienceLifecycle, type AudienceStatus,
} from '@/lib/strategy/constants'
import type { AudienceRow, InsightRow } from '@/lib/strategy/types'
import StrategyHeader from '@/components/strategy/StrategyHeader'
import KpiStrip, { type KpiItem } from '@/components/strategy/KpiStrip'
import { ClearFilters, MoreFilters, SearchFilter, SelectFilter, ViewSwitcher } from '@/components/strategy/FilterBar'
import { Avatar, CARD, FooterLink, Panel, ScoreRing, TableScroll } from '@/components/strategy/primitives'
import { EmptyState, PanelError } from '@/components/strategy/states'
import { Donut, Legend, LineChart } from '@/components/strategy/charts'
import Pagination from '@/components/strategy/Pagination'
import { StatusChip } from '@/components/strategy/badges'
import WorldMap from '@/components/strategy/audiences/WorldMap'
import { AudienceMenu, AudiencesHeaderActions, ChannelMark, SaveViewButton } from '@/components/strategy/audiences/AudienceClient'

export const metadata: Metadata = {
  title: 'Audiences · Strategy · Caption Fox',
  description: 'Understand, segment, and activate the right audiences for higher impact and ROI.',
}

const VIEWS = ['cards', 'table', 'map', 'compare'] as const
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? ''

const LIFECYCLE_TONE: Record<string, string> = {
  awareness: 'bg-orange-50 text-orange-500', consideration: 'bg-sg-blue-soft text-sg-blue',
  decision: 'bg-violet-50 text-violet-600', retention: 'bg-teal-50 text-teal-700', advocacy: 'bg-emerald-50 text-emerald-600',
}
/** Dense desktop spacing shared by this page's chart panels (design 3). */
const DENSE_HEADER = 'lg:pt-[6px]! [&_p]:lg:mt-0!'
const DENSE_FOOTER = 'lg:pt-[3px] lg:pb-[10px]!'
const INSIGHT_ICON = { opportunity: Sparkles, gap: UserRoundSearch, expansion: Globe2, risk: Sparkles }
const INSIGHT_TONE: Record<string, string> = {
  opportunity: 'bg-emerald-50 text-emerald-600', gap: 'bg-orange-50 text-orange-500', expansion: 'bg-sg-blue-soft text-sg-blue', risk: 'bg-red-50 text-red-500',
}
const IMPACT_CHIP: Record<string, { label: string; tone: string }> = {
  high: { label: 'High impact', tone: 'bg-emerald-50 text-emerald-600' },
  medium: { label: 'Medium impact', tone: 'bg-orange-50 text-orange-500' },
  low: { label: 'Low impact', tone: 'bg-slate-100 text-slate-500' },
  opportunity: { label: 'Opportunity', tone: 'bg-sg-blue-soft text-sg-blue' },
}

export default async function AudiencesPage({
  params, searchParams,
}: { params: Promise<{ workspaceType: string }>; searchParams: Promise<RawParams> }) {
  const [{ workspaceType: kind }, search] = await Promise.all([params, searchParams])
  const page = await getStrategyPageContext(kind, 'audiences')
  const { supabase, capabilities: can } = page
  const workspaceId = page.workspace.id

  const q = parseStrategyQuery(search, { views: [...VIEWS], defaultView: 'cards', defaultSort: 'size_desc' })
  const view = q.view as typeof VIEWS[number]
  q.size = view === 'cards' ? 4 : 12
  if (q.owner && !page.people.some(person => person.id === q.owner)) q.owner = ''
  const now = new Date()

  const [list, allAudiences, geography, metrics, snapshots, activity, insights, personaRows, crm] = await Promise.all([
    listAudiences(supabase, workspaceId, q, { paginate: !q.region && !q.persona, limit: 200 }),
    supabase.from('strategy_audiences').select('id, name, status, audience_size, fit_score, data_completeness').eq('workspace_id', workspaceId).is('archived_at', null),
    audienceGeography(supabase, workspaceId),
    listAudienceMetrics(supabase, workspaceId, ['growth', 'channel', 'gender', 'age']),
    loadSnapshots(supabase, workspaceId, now),
    listActivity(supabase, workspaceId, { limit: 5, surface: 'audiences' }),
    supabase.from('strategy_insights').select('id, module, kind, title, detail, impact, research_id, created_at')
      .eq('workspace_id', workspaceId).eq('module', 'audiences').is('dismissed_at', null).order('created_at', { ascending: false }).limit(3),
    supabase.from('strategy_audience_personas').select('audience_id').eq('workspace_id', workspaceId),
    supabase.from('strategy_crm_connections').select('account_label, token_tail, status, last_synced_at, last_sync_status, last_sync_error, last_sync_count')
      .eq('workspace_id', workspaceId).eq('provider', 'hubspot').maybeSingle(),
  ])

  // Region / persona filters narrow after fetch, so page in code for those.
  let rows = list.rows
  let total = list.total
  if (q.region || q.persona) {
    total = rows.length
    rows = rows.slice((q.page - 1) * q.size, q.page * q.size)
  }
  const compareIds = view === 'compare'
    ? (q.compare.length ? q.compare : list.rows.slice(0, 3).map(row => row.id))
    : []
  const compareRows = view === 'compare' ? (await listAudiences(supabase, workspaceId, { ...q, q: '', status: '', page: 1 }, { ids: compareIds, limit: 4 })).rows : []
  const hydrated = await hydrateAudiences(supabase, workspaceId, view === 'compare' ? compareRows : rows)

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const audiences = (allAudiences.data ?? []) as { id: string; name: string; status: string; audience_size: number; fit_score: number; data_completeness: number }[]
  const active = audiences.filter(row => row.status === 'active')
  const personaCounts = new Map<string, number>()
  for (const row of (personaRows.data ?? []) as { audience_id: string }[]) personaCounts.set(row.audience_id, (personaCounts.get(row.audience_id) ?? 0) + 1)
  const personaCoverage = pct(audiences.filter(row => (personaCounts.get(row.id) ?? 0) >= 3).length, audiences.length)
  const missing = audiences.length ? Math.round(100 - average(audiences.map(row => row.data_completeness))) : 0
  const matchScore = active.length ? Math.round(average(active.map(row => row.fit_score))) : 0
  const live = {
    audiences_total: audiences.length, audiences_active: active.length, persona_coverage: personaCoverage,
    geographic_countries: geography.countries, missing_data: missing, campaign_match: matchScore,
  }
  await refreshSnapshot(supabase, workspaceId, snapshots.current, live, now)
  const prev = snapshots.lastMonth
  const d = (key: keyof typeof live, value: number, unit = '', good: 'up' | 'down' = 'up') => {
    const change = compare(value, prev, key)
    return change ? { value: change.value, unit, comparison: 'vs last month', good } : null
  }
  const kpis: KpiItem[] = [
    { id: 'total', label: 'Total audiences', value: audiences.length, icon: 'users', tone: 'blue', delta: d('audiences_total', audiences.length) },
    { id: 'active', label: 'Active segments', value: active.length, icon: 'trend', tone: 'green', delta: d('audiences_active', active.length) },
    { id: 'persona', label: 'Persona coverage', value: `${personaCoverage}%`, icon: 'user', tone: 'violet', delta: d('persona_coverage', personaCoverage, 'pp') },
    { id: 'geo', label: 'Geographic reach', value: <>{geography.countries}<span className="block text-[11px] font-normal leading-tight text-sg-muted lg:text-[9.5px]">Countries</span></>, icon: 'globe', tone: 'orange', delta: d('geographic_countries', geography.countries) },
    { id: 'missing', label: 'Missing data', value: `${missing}%`, icon: 'alert', tone: 'red', delta: d('missing_data', missing, 'pp', 'down') },
    { id: 'match', label: 'Campaign match score', value: matchScore, icon: 'target', tone: 'blue', delta: d('campaign_match', matchScore) },
  ]

  // ── Charts ────────────────────────────────────────────────────────────────
  const growth = new Map<string, { label: string; total: number | null; active: number | null }>()
  for (const metric of metrics.filter(row => row.metric_group === 'growth' && row.metric_date)) {
    const entry = growth.get(metric.metric_date!) ?? { label: new Date(`${metric.metric_date}T00:00:00`).toLocaleDateString('en-GB', { month: 'short' }), total: null, active: null }
    if (metric.metric_key === 'total') entry.total = Number(metric.metric_value)
    if (metric.metric_key === 'active') entry.active = Number(metric.metric_value)
    growth.set(metric.metric_date!, entry)
  }
  const growthRows = [...growth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value)

  const activeIds = new Set(active.map(row => row.id))
  const scoped = (group: string) => metrics.filter(row => row.metric_group === group && activeIds.has(row.audience_id))
  const meanBy = (group: string) => {
    const buckets = new Map<string, { label: string; values: number[] }>()
    for (const row of scoped(group)) {
      const bucket = buckets.get(row.metric_key) ?? { label: row.metric_label, values: [] }
      bucket.values.push(Number(row.metric_value))
      buckets.set(row.metric_key, bucket)
    }
    return [...buckets.entries()].map(([key, bucket]) => ({ key, label: bucket.label, value: Math.round(average(bucket.values)) }))
  }
  const channels = meanBy('channel').sort((a, b) => b.value - a.value)
  const gender = meanBy('gender')
  const age = meanBy('age')
  const topAudiences = [...active].sort((a, b) => b.fit_score - a.fit_score).slice(0, 6)
  const countryTotal = geography.rows.reduce((sum, row) => sum + row.size, 0)

  const pathname = strategyPath(kind, 'audiences')
  const queryState = Object.fromEntries(Object.entries(search).map(([key, value]) => [key, one(value)]))
  const filtered = Boolean(q.q || q.status || q.persona || q.region || q.lifecycle || q.channel || q.owner || q.completeness || q.archived)
  const menuCan = { create: can.createAudience, edit: can.editAudience, import: can.importAudiences, sync: can.syncCrm, export: can.export }
  const regionOptions = geography.rows.map(row => ({ value: row.code, label: row.name }))

  const card = (row: AudienceRow) => {
    const fit = fitBand(row.fit_score)
    const regions = row.regions ?? []
    return (
      <article className="flex h-full flex-col px-3 py-3 lg:px-[12px] lg:pb-[9px] lg:pt-[9px]" aria-labelledby={`aud-${row.id}`}>
        <header className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 id={`aud-${row.id}`} className="truncate text-[14px] font-semibold text-sg-ink lg:text-[11.5px]">{row.name}</h3>
            <p className="truncate text-[12px] text-sg-muted lg:text-[9.5px]">{row.description ?? '—'}</p>
          </div>
          <AudienceMenu audience={row} people={page.people} can={menuCan} />
        </header>
        <div className="mt-3 flex items-start justify-between lg:mt-[13px]">
          <div>
            <p className="text-[11px] text-sg-body lg:text-[8.5px]">Audience size</p>
            <p className="mt-1 flex items-baseline gap-2 lg:mt-0">
              <span className="text-[20px] font-semibold text-sg-ink lg:text-[16px]">{formatCompact(row.audience_size)}</span>
              <span className={cn('text-[11px] font-medium lg:text-[8.5px]', row.growth_rate >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                {row.growth_rate >= 0 ? '↑' : '↓'} {Math.abs(Math.round(row.growth_rate))}%
              </span>
            </p>
          </div>
          <div className="flex flex-col items-center">
            <p className="mb-1 text-[11px] text-sg-body lg:mb-0 lg:text-[8.5px]">Fit score</p>
            <ScoreRing value={row.fit_score} size={42} stroke={4} colour="#22c55e" textClassName="text-[14px] lg:text-[13px]" label={`Fit score ${row.fit_score}, ${fit.label}`} />
            <p className="mt-1 text-[11px] text-emerald-600 lg:text-[8.5px]">{fit.label}</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-sg-body lg:-mt-[8px] lg:text-[8.5px]">Top personas</p>
        <ul className="mt-1 flex items-center gap-1 lg:mt-[6px]" aria-label={`Top personas: ${(row.personas ?? []).map(persona => persona.name).join(', ') || 'none'}`}>
          {(row.personas ?? []).slice(0, 3).map(persona => <li key={persona.id}><Avatar name={persona.name} src={persona.avatar_url} size={18} /></li>)}
          {(row.personas ?? []).length > 3 && <li className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-sg-line bg-white px-0.5 text-[10px] text-sg-muted lg:text-[8px]">+{(row.personas ?? []).length - 3}</li>}
          {(row.personas ?? []).length === 0 && <li className="text-[11px] text-sg-subtle lg:text-[8.5px]">None yet</li>}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-2 lg:mt-[9px]">
          <div>
            <p className="text-[11px] text-sg-body lg:text-[8.5px]">Top regions</p>
            <ul className="mt-1 flex flex-wrap gap-1 lg:mt-[5px] lg:flex-nowrap lg:gap-[3px]" aria-label="Top regions">
              {regions.slice(0, 3).map(region => (
                <li key={region.id} title={region.country_name} className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[9px] font-medium text-sg-body lg:h-[20px] lg:w-[20px] lg:text-[7.5px]">{region.country_code}</li>
              ))}
              {regions.length > 3 && <li className="flex h-6 w-6 items-center justify-center rounded-full border border-sg-line bg-white text-[9px] text-sg-muted lg:h-[20px] lg:w-[20px] lg:text-[7.5px]">+{regions.length - 3}</li>}
            </ul>
          </div>
          <div>
            <p className="text-[11px] text-sg-body lg:text-[8.5px]">Top channels</p>
            <ul className="mt-1 flex items-center gap-1.5 lg:mt-[5px] lg:h-[20px]" aria-label="Top channels">
              {row.channels.slice(0, 4).map(channel => <li key={channel}><ChannelMark channel={channel} size={14} /></li>)}
            </ul>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 lg:mt-[6px]">
          <div>
            <p className="text-[11px] text-sg-body lg:text-[8.5px]">Lifecycle stage</p>
            <span className={cn('mt-1 inline-flex h-5 items-center rounded px-1.5 text-[11px] lg:mt-0 lg:h-[15px] lg:text-[8px]', LIFECYCLE_TONE[row.lifecycle_stage])}>
              {LIFECYCLE_LABELS[row.lifecycle_stage as AudienceLifecycle] ?? row.lifecycle_stage}
            </span>
          </div>
          <div>
            <p className="text-[11px] text-sg-body lg:text-[8.5px]">Linked objectives</p>
            <Link href={strategyPath(kind, 'objectives')} className="mt-1 inline-block py-2.5 text-[12px] text-sg-blue hover:underline lg:mt-[2px] lg:py-0 lg:text-[9px]">
              {(row.linkedObjectives ?? []).length} objective{(row.linkedObjectives ?? []).length === 1 ? '' : 's'}
            </Link>
          </div>
        </div>
      </article>
    )
  }

  const table = (tableRows: AudienceRow[]) => (
    <TableScroll label="Audiences">
      <table className="w-full min-w-[1000px] border-collapse">
        <caption className="sr-only">Audiences</caption>
        <thead>
          <tr className="text-left text-[11px] text-sg-muted lg:text-[9.5px]">
            {['Audience', 'Status', 'Lifecycle', 'Size', 'Growth', 'Fit', 'Completeness', 'Channels', 'Owner', 'Updated'].map(label => (
              <th key={label} scope="col" className="whitespace-nowrap py-2 pr-3 font-normal">{label}</th>
            ))}
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map(row => (
            <tr key={row.id} className="h-12 border-t border-sg-line-soft text-[12.5px] text-sg-body lg:h-9 lg:text-[10px]">
              <td className="pr-3"><span className="block font-medium text-sg-ink">{row.name}</span><span className="block text-[11px] text-sg-muted lg:text-[9px]">{row.description}</span></td>
              <td className="pr-3"><StatusChip status={row.status} label={AUDIENCE_STATUS_LABELS[row.status as AudienceStatus]} /></td>
              <td className="pr-3">{LIFECYCLE_LABELS[row.lifecycle_stage as AudienceLifecycle]}</td>
              <td className="pr-3 tabular-nums">{formatCompact(row.audience_size)}</td>
              <td className={cn('pr-3 tabular-nums', row.growth_rate >= 0 ? 'text-emerald-600' : 'text-red-500')}>{row.growth_rate >= 0 ? '+' : ''}{row.growth_rate}%</td>
              <td className="pr-3 tabular-nums">{row.fit_score}</td>
              <td className="pr-3 tabular-nums">{row.data_completeness}%</td>
              <td className="pr-3"><span className="flex gap-1">{row.channels.slice(0, 4).map(channel => <ChannelMark key={channel} channel={channel} size={14} />)}</span></td>
              <td className="pr-3"><span className="flex items-center gap-1.5"><Avatar person={row.owner} size={18} />{shortName(row.owner?.full_name)}</span></td>
              <td className="whitespace-nowrap pr-3">{formatRelative(row.updated_at)}</td>
              <td className="text-right"><AudienceMenu audience={row} people={page.people} can={menuCan} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  )

  const switcher = (
    <ViewSwitcher current={view} defaultView="cards" showLabel={false} compact className="xl:w-full"
      views={[{ id: 'cards', label: 'Cards' }, { id: 'table', label: 'Table' }, { id: 'map', label: 'Map' }, { id: 'compare', label: 'Compare' }]} />
  )

  const empty = <EmptyState filtered={filtered} title={filtered ? 'No audiences match these filters' : 'No audiences yet'}
    description={filtered ? 'Clear filters to see every segment.' : 'Create an audience or import segments from a CSV.'} />

  const geoPanel = (
    <Panel title="Geographic coverage" headerClassName="lg:pt-[7px]!" bodyClassName="lg:pt-[8px]! lg:pb-0! [&_svg]:lg:h-[122px]" footerClassName="lg:pt-0 lg:pb-[4px]!"
      footer={<FooterLink href={`${pathname}?view=map`}>View full geographic breakdown</FooterLink>}>
      <WorldMap rows={geography.rows} />
      <h3 className="mt-4 text-[12px] font-semibold text-sg-ink lg:mt-[12px] lg:text-[9.5px]">Top countries by audience</h3>
      <ul className="mt-2 space-y-0 lg:mt-[3px] lg:space-y-[2.5px]">
        {geography.rows.slice(0, 5).map(row => (
          <li key={row.code} className="flex items-center gap-3 text-[12px] text-sg-body lg:text-[9px]">
            <Link href={`${pathname}?region=${row.code}`} className="w-24 shrink-0 truncate py-3 hover:underline lg:w-[66px] lg:py-0">{row.name}</Link>
            <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 lg:h-[4px]"><span className="block h-full rounded-full bg-sg-blue" style={{ width: `${pct(row.size, geography.rows[0]?.size ?? 1)}%` }} /></span>
            <span className="w-9 text-right tabular-nums">{pct(row.size, countryTotal)}%</span>
          </li>
        ))}
      </ul>
    </Panel>
  )

  let body: React.ReactNode
  if (view === 'cards') {
    body = (
      <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-[12px] xl:grid-cols-[871fr_333fr] xl:gap-[13px]">
        <div className="min-w-0 space-y-3 xl:space-y-[10px]">
          <section className={CARD} aria-label="Audience segments">
            {hydrated.length ? (
              <>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-[10px]">
                  {hydrated.map(row => <li key={row.id} className="rounded-xl border border-sg-line bg-white">{card(row)}</li>)}
                </ul>
                <div className="border-t border-sg-line-soft py-2.5"><FooterLink href={`${pathname}?view=table`}>View all audiences</FooterLink></div>
              </>
            ) : empty}
          </section>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-[305fr_236fr_308fr] xl:gap-[11px]">
            <Panel title="Audience growth" info="Total people across segments and people in active segments, by month." subtitle="Total audience size over time"
              headerClassName={DENSE_HEADER} bodyClassName="lg:pt-[5px]! lg:pb-0!" footerClassName={DENSE_FOOTER}
              footer={<FooterLink href={`${pathname}?view=table&sort=size_desc`}>View growth details</FooterLink>}>
              <Legend className="mb-1" items={[{ label: 'Total audience', colour: '#3f6ff8' }, { label: 'Active segments', colour: '#94a3b8', dashed: true }]} />
              {growthRows.length > 1 ? (
                <LineChart caption="Audience growth" xKey="label" data={growthRows} height={108} padLeft={26} valueFormat="compact"
                  series={[{ key: 'total', label: 'Total audience', colour: '#3f6ff8', area: true, endBadge: true }, { key: 'active', label: 'Active segments', colour: '#94a3b8', dashed: true, endBadge: true }]} />
              ) : <EmptyState compact title="Growth history starts next month" />}
            </Panel>
            <Panel title="Channel affinity" info="Average engagement share by channel across active segments." subtitle="Where audiences are most active"
              headerClassName={DENSE_HEADER} bodyClassName="lg:pt-[5px]! lg:pb-0!" footerClassName={DENSE_FOOTER}
              footer={<FooterLink href={`${pathname}?view=compare`}>View channel insights</FooterLink>}>
              <ul className="space-y-0 lg:space-y-[4px] lg:pt-[1px]">
                {channels.slice(0, 6).map(channel => (
                  <li key={channel.key} className="flex items-center gap-3 text-[12px] text-sg-body lg:gap-[12px] lg:text-[8.5px]">
                    <Link href={`${pathname}?channel=${channel.key === 'social' ? '' : channel.key}`} className="w-20 shrink-0 truncate py-3 hover:underline lg:w-[50px] lg:py-0">{channel.label}</Link>
                    <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 lg:h-[4px]"><span className="block h-full rounded-full bg-sg-blue" style={{ width: `${channel.value}%` }} /></span>
                    <span className="w-8 text-right tabular-nums">{channel.value}%</span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Demographic mix" info="Aggregated age and gender distribution across active segments." subtitle="Age and gender distribution"
              headerClassName={DENSE_HEADER} bodyClassName="lg:pt-[2px]! lg:pb-0!" footerClassName={DENSE_FOOTER}
              footer={<FooterLink href={`${pathname}?view=compare`}>View full demographics</FooterLink>}>
              <p className="text-[11px] text-sg-body lg:text-[8.5px]">Gender</p>
              <div className="mt-1 flex items-center gap-5 lg:gap-[18px]">
                <Donut caption="Gender distribution" size={46} thickness={7} slices={gender.map((item, index) => ({ ...item, colour: ['#3f6ff8', '#93b0fb', '#dbe4fe'][index] ?? '#e2e8f0' }))} />
                <ul className="space-y-1 text-[11px] text-sg-body lg:space-y-0 lg:text-[8.5px] lg:leading-[13px]">
                  {gender.map((item, index) => (
                    <li key={item.key} className="flex w-[88px] items-center gap-1.5"><i aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: ['#3f6ff8', '#93b0fb', '#cbd5e1'][index] }} /><span className="flex-1">{item.label}</span><span className="tabular-nums">{item.value}%</span></li>
                  ))}
                </ul>
              </div>
              <p className="mt-2 text-[11px] text-sg-body lg:mt-[3px] lg:text-[8.5px]">Age</p>
              <div className="mt-1 flex h-[60px] items-end gap-3 border-b lg:h-[42px] border-sg-line-soft pb-0 pl-6 lg:gap-[30px]" role="img" aria-label={`Age distribution: ${age.map(item => `${item.label} ${item.value}%`).join(', ')}`}>
                {age.map((item, index) => (
                  <span key={item.key} className="flex h-full flex-1 flex-col items-center justify-end">
                    <span className="w-3 rounded-t-[2px] lg:w-4" style={{ height: `${Math.max(4, Math.min(100, item.value * 3.6))}%`, background: ['#3f6ff8', '#5a82f9', '#84a3fb', '#b1c5fc', '#d6e0fe'][index] }} />
                  </span>
                ))}
              </div>
              <div className="flex gap-3 pl-6 text-[10px] text-sg-muted lg:gap-[30px] lg:text-[8px]" aria-hidden>{age.map(item => <span key={item.key} className="flex-1 text-center">{item.label}</span>)}</div>
            </Panel>
          </div>
        </div>
        <div className="min-w-0 space-y-3 xl:space-y-[10px]">
          <div className="flex justify-end xl:-mt-[6px] xl:justify-stretch [&_[role=radiogroup]]:xl:w-full [&_[role=radio]]:xl:flex-1 [&_[role=radio]]:xl:justify-center">{switcher}</div>
          {geoPanel}
          <Panel title="Engagement potential" info="Fit score of each active segment for current campaigns (0–100)." subtitle="Predicted engagement by segment"
            className="xl:mt-[12px]!" headerClassName={DENSE_HEADER} bodyClassName="lg:pt-[6px]! lg:pb-[2px]!" footerClassName="lg:pb-0!"
            footer={<FooterLink href={`${pathname}?view=table&sort=fit_desc`}>How scoring works</FooterLink>}>
            <ul className="space-y-2.5 lg:space-y-[3.5px]">
              {topAudiences.map(row => {
                const band = fitBand(row.fit_score)
                return (
                  <li key={row.id} className="flex items-center gap-3 text-[12px] text-sg-body lg:text-[8.5px]">
                    <span className="w-28 shrink-0 truncate lg:w-[100px]">{row.name}</span>
                    <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 lg:h-[4px]"><span className="block h-full rounded-full bg-sg-blue" style={{ width: `${row.fit_score}%` }} /></span>
                    <span className="w-6 text-right tabular-nums text-sg-ink">{row.fit_score}</span>
                    <span className={cn('w-14 shrink-0', row.fit_score >= 70 ? 'text-emerald-600' : 'text-orange-500')}>{band.label}</span>
                  </li>
                )
              })}
            </ul>
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:col-span-2 xl:grid-cols-[550fr_653fr] xl:gap-[13px]">
          <Panel title="Audience insights & intelligence" headerClassName="lg:pt-[6px]!" bodyClassName="lg:pt-0!" footerClassName="lg:pb-[3px]!" footer={<FooterLink href={strategyPath(kind, 'research')}>Go to research library</FooterLink>}>
            {(insights.data ?? []).length ? (
              <ul className="divide-y divide-sg-line-soft">
                {((insights.data ?? []) as InsightRow[]).map(insight => {
                  const Icon = INSIGHT_ICON[insight.kind as keyof typeof INSIGHT_ICON] ?? Sparkles
                  const chip = IMPACT_CHIP[insight.impact] ?? IMPACT_CHIP.medium
                  return (
                    <li key={insight.id} className="flex items-start gap-3 py-2.5 lg:py-[5px]">
                      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg lg:h-[22px] lg:w-[22px]', INSIGHT_TONE[insight.kind])}><Icon aria-hidden className="h-4 w-4 lg:h-3 lg:w-3" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-sg-ink lg:text-[9.5px]">{insight.title}</p>
                        <p className="text-[12px] text-sg-muted lg:text-[8.5px]">{insight.detail}</p>
                      </div>
                      <span className={cn('mt-1 inline-flex h-5 shrink-0 items-center rounded px-2 text-[11px] lg:h-[15px] lg:text-[8px]', chip.tone)}>{chip.label}</span>
                    </li>
                  )
                })}
              </ul>
            ) : <EmptyState compact title="No insights yet" description="Insights appear as research and segment data accumulate." />}
          </Panel>
          <Panel title="Recent audience activity" headerClassName="lg:pt-[6px]!" bodyClassName="lg:pt-[5px]!" footerClassName="lg:pb-[3px]!" footer={<FooterLink href={strategyPath(kind)}>View all activity</FooterLink>}>
            {activity.length ? (
              <TableScroll label="Recent audience activity">
                <table className="w-full min-w-[560px] border-collapse">
                  <caption className="sr-only">Recent audience activity</caption>
                  <tbody>
                    {activity.map(row => {
                      const [segment, ...rest] = row.summary.split(' — ')
                      return (
                        <tr key={row.id} className="h-10 text-[12px] text-sg-body lg:h-[23px] lg:text-[8.5px]">
                          <td className="w-[90px] pr-2"><span className="flex items-center gap-2"><Avatar person={row.actor} size={18} /><span className="whitespace-nowrap font-medium text-sg-ink">{shortName(row.actor?.full_name)}</span></span></td>
                          <td className="whitespace-nowrap pr-2 text-sg-muted">{row.action.replace('segment', 'segment').replace('synced', 'synced')}</td>
                          <td className="pr-2"><span className="whitespace-nowrap rounded border border-sg-line px-1.5 py-0.5 text-[11px] lg:text-[8px]">{rest.length ? segment : '—'}</span></td>
                          <td className="truncate pr-2 text-sg-muted">{rest.length ? rest.join(' — ') : segment}</td>
                          <td className="whitespace-nowrap text-right text-sg-subtle"><time dateTime={row.created_at}>{formatRelative(row.created_at)}</time></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </TableScroll>
            ) : <EmptyState compact title="No audience activity yet" />}
          </Panel>
        </div>
      </div>
    )
  } else if (view === 'table') {
    body = (
      <Panel className="mt-3 lg:mt-[12px]" title="All audiences" subtitle={`${total} segments`}>
        {hydrated.length ? <>{table(hydrated)}<Pagination pathname={pathname} params={queryState} page={q.page} size={q.size} total={total} label="audiences" /></> : empty}
      </Panel>
    )
  } else if (view === 'map') {
    body = (
      <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-[12px] xl:grid-cols-[2fr_1fr] xl:gap-[13px]">
        <Panel title="Audience coverage map" subtitle={`${geography.countries} countries · aggregated segment counts, never individuals`}>
          <WorldMap rows={geography.rows} />
        </Panel>
        <Panel title="Countries">
          <TableScroll label="Audience by country">
            <table className="w-full border-collapse text-[12.5px] lg:text-[10px]">
              <caption className="sr-only">Audience by country</caption>
              <thead><tr className="text-left text-sg-muted"><th scope="col" className="py-1.5 font-normal">Country</th><th scope="col" className="py-1.5 text-right font-normal">Audience</th><th scope="col" className="py-1.5 text-right font-normal">Share</th></tr></thead>
              <tbody>
                {geography.rows.map(row => (
                  <tr key={row.code} className="h-10 border-t border-sg-line-soft lg:h-7">
                    <td><Link href={`${pathname}?view=table&region=${row.code}`} className="hover:underline">{row.name}</Link></td>
                    <td className="text-right tabular-nums">{formatCompact(row.size)}</td>
                    <td className="text-right tabular-nums">{pct(row.size, countryTotal)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Panel>
      </div>
    )
  } else {
    const pickHref = (id: string) => {
      const set = new Set(compareIds)
      if (set.has(id)) set.delete(id); else if (set.size < 4) set.add(id)
      return `${pathname}?view=compare&compare=${[...set].join(',')}`
    }
    body = (
      <div className="mt-3 space-y-3 lg:mt-[12px]">
        <Panel title="Choose up to 4 segments">
          <ul className="flex flex-wrap gap-1.5">
            {audiences.map(row => (
              <li key={row.id}>
                <Link href={pickHref(row.id)} aria-pressed={compareIds.includes(row.id)}
                  className={cn('inline-flex h-10 items-center rounded-lg border px-3 text-[13px] lg:h-7 lg:text-[10.5px]', compareIds.includes(row.id) ? 'border-sg-blue bg-sg-blue-soft text-sg-blue' : 'border-sg-line text-sg-body hover:bg-slate-50')}>
                  {row.name}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        {hydrated.length ? (
          <ul className={cn(CARD, 'grid grid-cols-1 divide-y divide-sg-line sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4 xl:divide-x')}>
            {hydrated.map(row => <li key={row.id}>{card(row)}</li>)}
          </ul>
        ) : <div className={CARD}><EmptyState title="Pick segments to compare" /></div>}
      </div>
    )
  }

  return (
    <>
      <StrategyHeader kind={kind} module="audiences" modules={page.modules}
        actions={<AudiencesHeaderActions people={page.people} can={menuCan} crm={crm.data ?? null} canManageCrm={can.syncCrm && ['owner', 'admin'].includes(page.ctx.role ?? '')} />} />
      {(list.error || allAudiences.error) && <div className="mb-3"><PanelError message="Audience data could not load. Refresh to try again." /></div>}
      <KpiStrip items={kpis} />

      <div className="mt-4 flex flex-col gap-2 lg:mt-[12px] xl:flex-row xl:items-center xl:gap-[10px]">
        <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:flex lg:flex-1 lg:flex-wrap lg:items-center lg:gap-[10px]">
          <SearchFilter placeholder="Search audiences…" label="Search audiences" className="lg:w-[178px]" />
          <SelectFilter param="status" prefix="Status" labelText="Status" allLabel="All" className="lg:w-[100px] [&_button]:lg:text-[10.5px]"
            options={AUDIENCE_STATUSES.filter(value => value !== 'archived').map(value => ({ value, label: AUDIENCE_STATUS_LABELS[value] }))} />
          <SelectFilter param="persona" prefix="Persona" labelText="Persona" allLabel="All" className="lg:w-[104px] [&_button]:lg:text-[10.5px]"
            options={['Value Maximiser', 'Busy Planner', 'Conscious Chooser', 'Research Lead', 'Deal Hunter', 'Trend Setter'].map(value => ({ value, label: value }))} />
          <SelectFilter param="region" prefix="Region" labelText="Region" allLabel="All" className="lg:w-[98px] [&_button]:lg:text-[10.5px]" options={regionOptions} />
          <SelectFilter param="lifecycle" prefix="Lifecycle" labelText="Lifecycle" allLabel="All" className="lg:w-[114px] [&_button]:lg:text-[10.5px]"
            options={LIFECYCLE_STAGES.map(value => ({ value, label: LIFECYCLE_LABELS[value] }))} />
          <SelectFilter param="channel" prefix="Channel" labelText="Channel" allLabel="All" className="lg:w-[110px] [&_button]:lg:text-[10.5px]"
            options={AUDIENCE_CHANNELS.filter(value => value !== 'social').map(value => ({ value, label: CHANNEL_LABELS[value] ?? value }))} />
          <MoreFilters label="More filters" fields={[
            { param: 'owner', label: 'Owner', options: page.people.map(person => ({ value: person.id, label: person.full_name ?? person.email ?? 'Member' })) },
            { param: 'completeness', label: 'Data completeness', options: [{ value: 'complete', label: '90% and above' }, { value: 'partial', label: '50–89%' }, { value: 'missing', label: 'Below 50%' }] },
            { param: 'sort', label: 'Sort by', options: [{ value: 'fit_desc', label: 'Fit score' }, { value: 'updated', label: 'Recently updated' }, { value: 'name_asc', label: 'Name (A–Z)' }] },
            { param: 'archived', label: 'Archive', options: [{ value: '1', label: 'Archived only' }] },
          ]} />
        </div>
        <div className="flex items-center gap-2">
          <ClearFilters alwaysVisible keys={['q', 'status', 'persona', 'region', 'lifecycle', 'channel', 'owner', 'completeness', 'archived']} className="lg:rounded-[6px] lg:border lg:border-sg-line lg:bg-white lg:px-[10px] lg:h-[26px]" />
          <SaveViewButton module="audiences" />
        </div>
      </div>

      {view !== 'cards' && <div className="mt-3 flex justify-end lg:mt-[10px]">{switcher}</div>}

      {body}
      <p className="sr-only">Last refreshed {formatDate(now)}</p>
    </>
  )
}
