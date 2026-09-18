import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUp, File as FileIcon, FileSpreadsheet, FileText, Image as ImageIcon, Presentation, Star, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStrategyPageContext } from '@/lib/strategy/page-context'
import { listActivity, listAllTags, listCollections, listFindings, listResearch } from '@/lib/strategy/data'
import { parseStrategyQuery, type RawParams } from '@/lib/strategy/query'
import { compare, loadSnapshots, refreshSnapshot } from '@/lib/strategy/kpis'
import { average, pct } from '@/lib/strategy/metrics'
import { formatAgoLong, formatRelative, objectiveRef, shortName } from '@/lib/strategy/format'
import {
  IMPACT_LEVELS, IMPACT_SHORT, RESEARCH_METHOD_COLOUR, RESEARCH_METHOD_LABELS, RESEARCH_METHODS, RESEARCH_SOURCE_LABELS,
  RESEARCH_SOURCE_TYPES, RESEARCH_STATUS_LABELS, RESEARCH_STATUSES, strategyPath,
  type ImpactLevel, type ResearchSource, type ResearchStatus,
} from '@/lib/strategy/constants'
import type { ResearchRow } from '@/lib/strategy/types'
import StrategyHeader from '@/components/strategy/StrategyHeader'
import KpiStrip, { type KpiItem } from '@/components/strategy/KpiStrip'
import { ClearFilters, MoreFilters, SearchFilter, SelectFilter, ViewSwitcher } from '@/components/strategy/FilterBar'
import { Avatar, CARD, DotLabel, HeaderLink, Panel, TableScroll, type Tone } from '@/components/strategy/primitives'
import { EmptyState, PanelError } from '@/components/strategy/states'
import { StatusChip } from '@/components/strategy/badges'
import { Donut } from '@/components/strategy/charts'
import Pagination from '@/components/strategy/Pagination'
import { AddTagButton, FavouriteToggle, NewCollectionButton, ResearchHeaderActions, ResearchMenu } from '@/components/strategy/research/ResearchClient'

export const metadata: Metadata = {
  title: 'Research · Strategy · Caption Fox',
  description: 'Discover, collect, and manage the insights that drive better strategy.',
}

const VIEWS = ['library', 'table', 'board'] as const
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? ''
const STATUS_TONE: Record<string, Tone> = { approved: 'green', in_review: 'amber', needs_revision: 'orange', draft: 'slate', archived: 'slate' }
const IMPACT_TONE: Record<string, string> = { high: 'bg-emerald-100/70 text-emerald-700', medium: 'bg-orange-100/70 text-orange-600', low: 'bg-slate-100 text-slate-500' }

function fileTile(item: Pick<ResearchRow, 'file_type' | 'method'>) {
  const type = item.file_type ?? ''
  const kind = type.includes('pdf') ? 'pdf' : type.includes('sheet') || type.includes('csv') || type.includes('excel') ? 'sheet'
    : type.includes('presentation') ? 'slides' : type.startsWith('image/') ? 'image'
      : ({ report: 'pdf', survey: 'sheet', market_data: 'slides', interview: 'doc', social_listening: 'image' } as Record<string, string>)[item.method] ?? 'doc'
  return {
    pdf: { Icon: FileText, tone: 'bg-red-50 text-red-500' },
    sheet: { Icon: FileSpreadsheet, tone: 'bg-emerald-50 text-emerald-600' },
    slides: { Icon: Presentation, tone: 'bg-orange-50 text-orange-500' },
    image: { Icon: ImageIcon, tone: 'bg-violet-50 text-violet-500' },
    doc: { Icon: FileIcon, tone: 'bg-sg-blue-soft text-sg-blue' },
  }[kind as 'pdf']
}

export default async function ResearchPage({
  params, searchParams,
}: { params: Promise<{ workspaceType: string }>; searchParams: Promise<RawParams> }) {
  const [{ workspaceType: kind }, search] = await Promise.all([params, searchParams])
  const page = await getStrategyPageContext(kind, 'research')
  const { supabase, capabilities: can, userId } = page
  const workspaceId = page.workspace.id
  const q = parseStrategyQuery(search, { views: [...VIEWS], defaultView: 'library', defaultSort: 'updated' })
  const view = q.view as typeof VIEWS[number]
  const scope = (['favourites', 'recent', 'mine'] as const).find(value => value === one(search.scope)) ?? 'all'
  const more = Math.min(20, Math.max(0, Number.parseInt(one(search.more), 10) || 0))
  if (q.owner && !page.people.some(person => person.id === q.owner)) q.owner = ''
  if (scope === 'favourites') q.favourites = true
  q.size = view === 'library' ? 6 * (more + 1) : view === 'table' ? 12 : 200
  if (view === 'library') q.page = 1
  const now = new Date()
  const since30 = new Date(now.getTime() - 30 * 86_400_000).toISOString()

  const [list, all, collections, tags, findings, activity, snapshots, planLinks, topAssets] = await Promise.all([
    listResearch(supabase, workspaceId, q, {
      paginate: true, statuses: view === 'board' ? ['draft', 'in_review', 'needs_revision', 'approved'] : undefined,
      uploadedBy: scope === 'mine' ? userId : undefined, updatedSince: scope === 'recent' ? since30 : undefined,
    }),
    supabase.from('strategy_research_items').select('id, status, impact, confidence, method, theme, is_favourite, uploaded_by, updated_at, archived_at').eq('workspace_id', workspaceId),
    listCollections(supabase, workspaceId),
    listAllTags(supabase, workspaceId),
    listFindings(supabase, workspaceId, 3),
    listActivity(supabase, workspaceId, { limit: 4, surface: 'research' }),
    loadSnapshots(supabase, workspaceId, now),
    supabase.from('strategy_links').select('source_id').eq('workspace_id', workspaceId).eq('source_type', 'research').eq('target_type', 'plan'),
    listResearch(supabase, workspaceId, { ...q, q: '', source: '', impact: '', confidence: '', status: '', owner: '', tag: '', favourites: false, sort: 'confidence_desc', page: 1 }, { limit: 5, statuses: ['approved', 'in_review'] }),
  ])

  const rows = list.rows
  const shown = [...rows, ...topAssets.rows]
  // Links are polymorphic (no FK to embed on), so resolve objective refs with
  // two batched queries for every row on screen — never one per row.
  const refs = new Map<string, string[]>()
  const { data: linkRows } = shown.length
    ? await supabase.from('strategy_links').select('source_id, target_id').eq('workspace_id', workspaceId)
      .eq('source_type', 'research').eq('target_type', 'objective').in('source_id', [...new Set(shown.map(row => row.id))])
    : { data: [] }
  const targets = [...new Set(((linkRows ?? []) as { target_id: string }[]).map(row => row.target_id))]
  if (targets.length) {
    const { data: objectives } = await supabase.from('strategy_objectives').select('id, ref_number').eq('workspace_id', workspaceId).in('id', targets)
    const refById = new Map(((objectives ?? []) as { id: string; ref_number: number | null }[]).map(row => [row.id, objectiveRef(row.ref_number)]))
    for (const link of (linkRows ?? []) as { source_id: string; target_id: string }[]) {
      const ref = refById.get(link.target_id)
      if (ref) refs.set(link.source_id, [...(refs.get(link.source_id) ?? []), ref].sort())
    }
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const items = (all.data ?? []) as { id: string; status: string; impact: string; confidence: number; method: string; theme: string | null; is_favourite: boolean; uploaded_by: string | null; updated_at: string; archived_at: string | null }[]
  const live = items.filter(row => !row.archived_at)
  const highImpact = live.filter(row => row.impact === 'high').length
  const pending = live.filter(row => row.status === 'in_review').length
  const archived = items.length - live.length
  const avgConfidence = live.length ? Math.round(average(live.map(row => row.confidence))) : 0
  const linkedToPlans = new Set(((planLinks.data ?? []) as { source_id: string }[]).map(row => row.source_id)).size
  const metrics = {
    research_total: live.length, research_high_impact: highImpact, research_pending: pending,
    research_archived: archived, research_confidence: avgConfidence, research_linked_plans: linkedToPlans,
  }
  await refreshSnapshot(supabase, workspaceId, snapshots.current, metrics, now)
  const d = (key: keyof typeof metrics, value: number, unit = '', good: 'up' | 'down' = 'up') => {
    const change = compare(value, snapshots.lastMonth, key)
    return change ? { value: change.value, unit, comparison: 'vs last month', good } : null
  }
  const kpis: KpiItem[] = [
    { id: 'total', label: 'Total research items', value: live.length, icon: 'file', tone: 'blue', delta: d('research_total', live.length) },
    { id: 'high', label: 'High-impact findings', value: highImpact, icon: 'star', tone: 'orange', delta: d('research_high_impact', highImpact) },
    { id: 'pending', label: 'Pending review', value: pending, icon: 'clock', tone: 'orange', delta: d('research_pending', pending, '', 'down') },
    { id: 'archived', label: 'Archived sources', value: archived, icon: 'archive', tone: 'slate', delta: d('research_archived', archived) },
    { id: 'confidence', label: 'Average confidence', value: `${avgConfidence}%`, icon: 'line', tone: 'blue', delta: d('research_confidence', avgConfidence, 'pp') },
    { id: 'linked', label: 'Linked to plans', value: linkedToPlans, icon: 'link', tone: 'green', delta: d('research_linked_plans', linkedToPlans) },
  ]

  const methodMix = RESEARCH_METHODS.map(method => ({ key: method, label: RESEARCH_METHOD_LABELS[method], value: live.filter(row => row.method === method).length, colour: RESEARCH_METHOD_COLOUR[method] }))
  const themeCounts = new Map<string, number>()
  for (const row of live) if (row.impact === 'high' && row.theme) themeCounts.set(row.theme, (themeCounts.get(row.theme) ?? 0) + 1)
  const themes = [...themeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  const themeMax = Math.max(10, Math.ceil(Math.max(0, ...themes.map(([, value]) => value)) / 10) * 10)

  const pathname = strategyPath(kind, 'research')
  const queryState = Object.fromEntries(Object.entries(search).map(([key, value]) => [key, one(value)]))
  const hrefWith = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries({ ...queryState, ...patch })) if (value) next.set(key, value)
    next.delete('page')
    const qs = next.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }
  const filtered = Boolean(q.q || q.source || q.impact || q.confidence || q.status || q.owner || q.tag || q.collection || scope !== 'all' || q.archived)
  const collectionOptions = collections.map(item => ({ id: item.id, name: item.name }))
  const menuCan = { create: can.createResearch, upload: can.uploadResearch, approve: can.approveResearch, delete: can.deleteResearch, export: can.export }

  const card = (item: ResearchRow) => {
    const tile = fileTile(item)
    return (
      <article className={cn(CARD, 'group/card flex h-full flex-col px-3 py-3 lg:px-[12px] lg:pb-[7px] lg:pt-[12px]')} aria-labelledby={`res-${item.id}`}>
        <div className="flex items-start justify-between">
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-md lg:h-[26px] lg:w-[26px]', tile.tone)}><tile.Icon aria-hidden className="h-4 w-4 lg:h-[14px] lg:w-[14px]" /></span>
          <span className="flex items-center"><FavouriteToggle id={item.id} title={item.title} favourite={item.is_favourite} canEdit={can.createResearch} /><span className="lg:w-0 lg:overflow-hidden lg:group-hover/card:w-auto lg:group-focus-within/card:w-auto"><ResearchMenu item={item} collections={collectionOptions} can={menuCan} /></span></span>
        </div>
        <h3 id={`res-${item.id}`} className="mt-2 truncate text-[13.5px] font-semibold text-sg-ink lg:mt-[11px] lg:text-[10.5px]">{item.title}</h3>
        <p className="truncate text-[12px] text-sg-muted lg:text-[9px]">{RESEARCH_SOURCE_LABELS[item.source_type as ResearchSource] ?? item.source_type}</p>
        <p className="mt-2 flex flex-wrap gap-1.5 lg:mt-[9px] lg:flex-nowrap lg:gap-[6px]">
          <span className={cn('inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded px-1.5 text-[11px] font-medium lg:h-[16px] lg:text-[8.5px]', IMPACT_TONE[item.impact])}>{IMPACT_SHORT[item.impact as ImpactLevel]} impact</span>
          <span className="inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded bg-sg-blue-soft px-1.5 text-[11px] font-medium text-sg-blue lg:h-[16px] lg:text-[8.5px]">{item.confidence}% confidence</span>
        </p>
        <div className="mt-3 flex items-center gap-2 lg:mt-[14px]">
          <Avatar person={item.owner} size={18} />
          <span className="truncate text-[12px] text-sg-body lg:text-[9px]">{shortName(item.owner?.full_name ?? item.owner?.email)}</span>
          <DotLabel tone={STATUS_TONE[item.status] ?? 'slate'} className="ml-auto lg:text-[8.5px]">{RESEARCH_STATUS_LABELS[item.status as ResearchStatus]}</DotLabel>
        </div>
        <p className="mt-2 text-[11.5px] text-sg-muted lg:mt-[8px] lg:text-[9px]">Updated {formatAgoLong(item.updated_at)}</p>
      </article>
    )
  }

  const table = (tableRows: ResearchRow[], caption: string, compact = false) => (
    <TableScroll label={caption}>
      <table className="w-full min-w-[860px] border-collapse xl:min-w-0">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-left text-[11px] text-sg-muted lg:text-[8.5px]">
            <th scope="col" className="w-6"><span className="sr-only">Favourite</span></th>
            {['Title', 'Source type', 'Impact', 'Confidence', 'Owner', 'Status', 'Linked objectives', 'Updated'].map(label => <th key={label} scope="col" className="whitespace-nowrap py-2 pr-3 font-normal lg:py-[6px]">{label}</th>)}
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map(item => (
            <tr key={item.id} className={cn('border-t border-sg-line-soft text-[12.5px] text-sg-body lg:text-[9px]', compact ? 'h-12 lg:h-[30px]' : 'h-12 lg:h-9')}>
              <td><Star aria-label={item.is_favourite ? 'Favourite' : undefined} aria-hidden={!item.is_favourite} className={cn('h-3.5 w-3.5 lg:h-3 lg:w-3', item.is_favourite ? 'fill-orange-400 text-orange-400' : 'text-slate-300')} /></td>
              <td className="max-w-[220px] truncate pr-3 text-sg-ink">{item.title}</td>
              <td className="whitespace-nowrap pr-3">{RESEARCH_SOURCE_LABELS[item.source_type as ResearchSource]}</td>
              <td className="pr-3"><span className={cn('inline-flex h-5 items-center rounded px-1.5 text-[11px] lg:h-[15px] lg:text-[8px]', IMPACT_TONE[item.impact])}>{IMPACT_SHORT[item.impact as ImpactLevel]}</span></td>
              <td className="pr-3 tabular-nums">{item.confidence}%</td>
              <td className="pr-3"><span className="flex items-center gap-1.5 whitespace-nowrap"><Avatar person={item.owner} size={16} />{shortName(item.owner?.full_name)}</span></td>
              <td className="pr-3"><StatusChip status={item.status} label={RESEARCH_STATUS_LABELS[item.status as ResearchStatus]} /></td>
              <td className="whitespace-nowrap pr-3">
                {(refs.get(item.id) ?? []).length ? <Link href={strategyPath(kind, 'objectives')} className="text-sg-blue hover:underline">{refs.get(item.id)!.slice(0, 2).join(', ')}</Link> : <span className="text-sg-subtle">—</span>}
              </td>
              <td className="whitespace-nowrap pr-3">{formatRelative(item.updated_at)}</td>
              <td className="text-right"><ResearchMenu item={item} collections={collectionOptions} can={menuCan} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  )

  const empty = <EmptyState filtered={filtered} title={filtered ? 'No research matches' : 'Your research library is empty'}
    description={filtered ? 'Clear filters or pick another collection.' : 'Add research or upload a study to start building evidence.'} />

  const scopeCounts = {
    all: live.length,
    favourites: live.filter(row => row.is_favourite).length,
    recent: live.filter(row => row.updated_at >= since30).length,
    mine: live.filter(row => row.uploaded_by === userId).length,
  }
  const collectionsNav = (
    <nav aria-label="Research collections" className="border-sg-line-soft lg:w-[190px] lg:shrink-0 lg:border-r lg:pr-[10px] lg:pt-[9px]">
      <div className="flex items-center justify-between pb-2">
        <h3 className="text-[13px] font-semibold text-sg-ink lg:text-[10px]">Collections</h3>
        <NewCollectionButton canCreate={can.createResearch} />
      </div>
      <ul className="space-y-0.5 border-b border-sg-line-soft pb-2">
        {([['all', 'All research'], ['favourites', 'Favorites'], ['recent', 'Recent'], ['mine', 'My uploads']] as const).map(([key, label]) => {
          const active = scope === key && !q.collection
          return (
            <li key={key}>
              <Link href={hrefWith({ scope: key === 'all' ? null : key, collection: null, more: null, favourites: null })} aria-current={active ? 'true' : undefined}
                className={cn('flex min-h-10 items-center justify-between rounded-md px-2 text-[13px] lg:min-h-[25px] lg:text-[9.5px]', active ? 'bg-sg-blue-soft font-medium text-sg-blue' : 'text-sg-body hover:bg-slate-50')}>
                {label}<span className="text-sg-muted">{scopeCounts[key]}</span>
              </Link>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-[11px] uppercase tracking-wide text-sg-muted lg:text-[8px]">Collections</p>
      <ul className="mt-1 space-y-0.5">
        {collections.map(collection => {
          const active = q.collection === collection.id
          return (
            <li key={collection.id}>
              <Link href={hrefWith({ collection: active ? null : collection.id, scope: null, more: null })} aria-current={active ? 'true' : undefined}
                className={cn('flex min-h-10 items-center justify-between gap-2 rounded-md px-2 text-[13px] lg:min-h-[22px] lg:text-[9px]', active ? 'bg-sg-blue-soft font-medium text-sg-blue' : 'text-sg-body hover:bg-slate-50')}>
                <span className="truncate">{collection.name}</span><span className="text-sg-muted">{collection.item_count ?? 0}</span>
              </Link>
            </li>
          )
        })}
      </ul>
      <Link href={`${pathname}?view=table`} className="mt-2 inline-block px-2 text-[12px] font-medium text-sg-blue hover:underline lg:text-[9px]">View all collections</Link>
    </nav>
  )

  let body: React.ReactNode
  if (view === 'library') {
    body = (
      <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-[11px] xl:grid-cols-[798fr_397fr] xl:gap-[15px]">
        <div className="min-w-0 space-y-3 xl:space-y-[10px]">
          <Panel headerClassName="lg:pt-[8px]!" bodyClassName="lg:pt-[4px]! lg:pb-[2px]!" title={<>Research library <span className="ml-2 text-[11px] font-normal text-sg-muted lg:text-[9px]">{list.total} items</span></>}
            action={<SelectFilter param="sort" labelText="Sort by" allLabel="Sort by: Updated (latest)" className="w-[170px] lg:w-[146px] [&_button]:lg:h-[24px] [&_button]:lg:text-[9.5px]"
              options={[{ value: 'confidence_desc', label: 'Sort by: Confidence' }, { value: 'name_asc', label: 'Sort by: Title (A–Z)' }, { value: 'priority', label: 'Sort by: Priority' }]} />}>
            <div className="flex flex-col gap-3 lg:flex-row lg:gap-[16px]">
              {collectionsNav}
              <div className="min-w-0 flex-1">
                {rows.length ? (
                  <>
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 xl:gap-[12px]">
                      {rows.map(item => <li key={item.id}>{card(item)}</li>)}
                    </ul>
                    {list.total > rows.length && (
                      <div className="mt-3 flex justify-center lg:mt-[8px]">
                        <Link href={hrefWith({ more: String(more + 1) })} scroll={false}
                          className="inline-flex h-10 items-center rounded-lg border border-sg-blue/40 bg-sg-blue-soft/40 px-6 text-[13px] font-medium text-sg-blue hover:bg-sg-blue-soft lg:h-[20px] lg:px-[45px] lg:text-[9px]">
                          Load more ⌄
                        </Link>
                      </div>
                    )}
                  </>
                ) : empty}
              </div>
            </div>
          </Panel>
          <Panel title="Top research assets" headerClassName="lg:pt-[8px]!" bodyClassName="lg:pt-0!" footer={<HeaderLink href={`${pathname}?view=table&sort=confidence_desc`}>View all research assets</HeaderLink>}>
            {topAssets.rows.length ? table(topAssets.rows, 'Top research assets', true) : <EmptyState compact title="No reviewed research yet" />}
          </Panel>
        </div>

        <div className="min-w-0 space-y-3 xl:space-y-[10px]">
          <Panel title="Research source mix" headerClassName="lg:pt-[8px]!">
            {live.length ? (
              <div className="flex items-center gap-6 lg:gap-[34px] lg:pl-[12px] lg:pt-[4px]">
                <Donut caption="Research by method" size={128} thickness={34} slices={methodMix} gap={0} center={<span className="sr-only">{live.length} items</span>} />
                <ul className="flex-1 space-y-2.5 lg:space-y-[8px]">
                  {methodMix.map(item => (
                    <li key={item.key} className="flex items-center gap-2 text-[12px] text-sg-body lg:text-[8.5px]">
                      <i aria-hidden className="h-2 w-2 rounded-full" style={{ background: item.colour }} />
                      <Link href={hrefWith({ q: null })} className="flex-1">{item.label}</Link>
                      <span className="tabular-nums">{pct(item.value, live.length)}% ({item.value})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : <EmptyState compact title="No research yet" />}
          </Panel>
          <Panel title="Research impact by theme" headerClassName="lg:pt-[8px]!" bodyClassName="lg:pt-[10px]!">
            {themes.length ? (
              <figure>
                <ul className="space-y-2 lg:space-y-[2px]">
                  {themes.map(([theme, value]) => (
                    <li key={theme} className="flex items-center gap-3 text-[12px] text-sg-body lg:text-[8.5px]">
                      <span className="w-28 shrink-0 truncate lg:w-[100px]">{theme}</span>
                      <span aria-hidden className="h-2 flex-1 lg:h-[5px]"><span className="block h-full rounded-sm bg-[#7ea1fb]" style={{ width: `${(value / themeMax) * 100}%` }} /></span>
                      <span className="w-6 text-right tabular-nums">{value}</span>
                    </li>
                  ))}
                </ul>
                <div aria-hidden className="ml-[124px] mr-9 mt-2 flex justify-between text-[10px] text-sg-muted lg:ml-[112px] lg:text-[8px]">
                  {[0, themeMax / 3, (themeMax * 2) / 3, themeMax].map(tick => <span key={tick}>{Math.round(tick)}</span>)}
                </div>
                <figcaption className="mt-1 text-center text-[11px] text-sg-muted lg:text-[8.5px]">High impact findings</figcaption>
              </figure>
            ) : <EmptyState compact title="No high-impact findings yet" />}
          </Panel>
          <Panel title="Latest findings" headerClassName="lg:pt-[8px]!" action={<HeaderLink href={`${pathname}?view=table&impact=high`}>View all</HeaderLink>}>
            {findings.length ? (
              <ul className="space-y-3 lg:space-y-[7px]">
                {findings.map((finding, index) => {
                  const Icon = [ArrowUp, Star, TrendingUp][index % 3]
                  const tone = ['bg-emerald-50 text-emerald-600', 'bg-orange-50 text-orange-500', 'bg-sg-blue-soft text-sg-blue'][index % 3]
                  return (
                    <li key={finding.id} className="flex items-start gap-3">
                      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md lg:h-[22px] lg:w-[22px]', tone)}><Icon aria-hidden className="h-4 w-4 lg:h-3 lg:w-3" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] text-sg-ink lg:text-[9px]">{finding.headline}</p>
                        <p className="text-[11.5px] text-sg-muted lg:text-[8.5px]">{finding.research?.title}</p>
                      </div>
                      <time dateTime={finding.created_at} className="shrink-0 self-end whitespace-nowrap text-[11px] text-sg-subtle lg:text-[8.5px]">{formatAgoLong(finding.created_at)}</time>
                    </li>
                  )
                })}
              </ul>
            ) : <EmptyState compact title="No findings yet" />}
          </Panel>
          <Panel title="Recent activity" headerClassName="lg:pt-[8px]!" action={<HeaderLink href={strategyPath(kind)}>View all</HeaderLink>}>
            {activity.length ? (
              <ul className="space-y-2 lg:space-y-[7px]">
                {activity.map(row => (
                  <li key={row.id} className="flex items-center gap-2 text-[12px] lg:text-[8.5px]">
                    <Avatar person={row.actor} size={16} />
                    <p className="min-w-0 flex-1 truncate text-sg-muted"><span className="font-semibold text-sg-ink">{shortName(row.actor?.full_name)}</span> {row.action} <span className="text-sg-body">{row.summary}</span></p>
                    <time dateTime={row.created_at} className="shrink-0 text-sg-subtle">{formatAgoLong(row.created_at)}</time>
                  </li>
                ))}
              </ul>
            ) : <EmptyState compact title="No research activity yet" />}
          </Panel>
        </div>
      </div>
    )
  } else if (view === 'table') {
    body = (
      <Panel className="mt-3 lg:mt-[16px]" title="All research" subtitle={`${list.total} items`}>
        {rows.length ? <>{table(rows, 'All research')}<Pagination pathname={pathname} params={queryState} page={q.page} size={q.size} total={list.total} label="items" /></> : empty}
      </Panel>
    )
  } else {
    const columns = (['draft', 'in_review', 'needs_revision', 'approved'] as const)
    body = (
      <div className="-mx-4 mt-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:mt-[16px] lg:px-0" role="region" aria-label="Research review board" tabIndex={0}>
        <div className="flex min-w-max gap-3 lg:grid lg:min-w-0 lg:grid-cols-4 lg:gap-[13px]">
          {columns.map(status => {
            const items = rows.filter(row => row.status === status)
            return (
              <section key={status} aria-label={`${RESEARCH_STATUS_LABELS[status]}, ${items.length} items`} className="w-[280px] shrink-0 rounded-xl border border-sg-line bg-slate-50/70 p-2 lg:w-auto">
                <h3 className="mb-2 flex items-center justify-between px-1 text-[12.5px] font-semibold text-sg-ink lg:text-[11px]">
                  {RESEARCH_STATUS_LABELS[status]}<span className="rounded bg-white px-1.5 text-[11px] font-medium text-sg-muted ring-1 ring-sg-line">{items.length}</span>
                </h3>
                <ul className="space-y-2">{items.map(item => <li key={item.id}>{card(item)}</li>)}</ul>
                {items.length === 0 && <p className="rounded-lg border border-dashed border-sg-line px-2 py-6 text-center text-[11px] text-sg-subtle">Nothing here</p>}
              </section>
            )
          })}
        </div>
        <p className="mt-2 text-[11.5px] text-sg-muted lg:text-[10px]">Use each card’s menu to submit, approve or request revision. Approvals are limited to reviewers.</p>
      </div>
    )
  }

  return (
    <>
      <StrategyHeader kind={kind} module="research" modules={page.modules}
        actions={<ResearchHeaderActions workspaceId={workspaceId} collections={collectionOptions} can={menuCan} />} />
      {(list.error || all.error) && <div className="mb-3"><PanelError message="Research could not load. Refresh to try again." /></div>}
      <KpiStrip items={kpis} itemClassName="lg:h-[77px]! lg:py-[9px]!" />

      <div className="mt-4 flex flex-col gap-2 lg:mt-[15px] xl:flex-row xl:items-center xl:gap-[10px]">
        <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:flex lg:flex-1 lg:flex-wrap lg:items-center lg:gap-[10px]">
          <SearchFilter placeholder="Search research library..." label="Search research library" className="lg:w-[236px]" />
          <SelectFilter param="source" labelText="Source type" allLabel="Source type" className="lg:w-[96px] [&_button]:lg:gap-[4px] [&_button]:lg:px-[8px] [&_button]:lg:text-[10px]" options={RESEARCH_SOURCE_TYPES.map(value => ({ value, label: RESEARCH_SOURCE_LABELS[value] }))} />
          <SelectFilter param="impact" labelText="Impact" allLabel="Impact" className="lg:w-[74px] [&_button]:lg:gap-[4px] [&_button]:lg:px-[8px] [&_button]:lg:text-[10px]" options={IMPACT_LEVELS.map(value => ({ value, label: IMPACT_SHORT[value] }))} />
          <SelectFilter param="confidence" labelText="Confidence" allLabel="Confidence" className="lg:w-[96px] [&_button]:lg:gap-[4px] [&_button]:lg:px-[8px] [&_button]:lg:text-[10px]" options={[{ value: 'high', label: 'High (75%+)' }, { value: 'medium', label: 'Medium (45–74%)' }, { value: 'low', label: 'Low (<45%)' }]} />
          <SelectFilter param="status" labelText="Status" allLabel="Status" className="lg:w-[72px] [&_button]:lg:gap-[4px] [&_button]:lg:px-[8px] [&_button]:lg:text-[10px]" options={RESEARCH_STATUSES.filter(value => value !== 'archived').map(value => ({ value, label: RESEARCH_STATUS_LABELS[value] }))} />
          <SelectFilter param="owner" labelText="Owner" allLabel="Owner" className="lg:w-[74px] [&_button]:lg:gap-[4px] [&_button]:lg:px-[8px] [&_button]:lg:text-[10px]" options={page.people.map(person => ({ value: person.id, label: person.full_name ?? person.email ?? 'Member' }))} />
          <SelectFilter param="tag" labelText="Tag" allLabel="Tag" className="lg:w-[58px] [&_button]:lg:gap-[4px] [&_button]:lg:px-[8px] [&_button]:lg:text-[10px]" options={tags.map(value => ({ value, label: value }))} />
          <MoreFilters fields={[
            { param: 'collection', label: 'Collection', options: collections.map(item => ({ value: item.id, label: item.name })) },
            { param: 'archived', label: 'Archive', options: [{ value: '1', label: 'Archived only' }] },
          ]} />
          <ClearFilters alwaysVisible keys={['q', 'source', 'impact', 'confidence', 'status', 'owner', 'tag', 'collection', 'scope', 'archived', 'more']} />
        </div>
        <ViewSwitcher current={view} defaultView="library" showLabel={false}
          views={[{ id: 'library', label: 'Library' }, { id: 'table', label: 'Table' }, { id: 'board', label: 'Board' }]} />
      </div>

      <ul className="mt-2 flex flex-wrap gap-2 lg:mt-[12px] lg:gap-[9px]" aria-label="Filter by tag">
        <li><Link href={hrefWith({ tag: null })} aria-current={!q.tag ? 'true' : undefined} className={cn('inline-flex h-9 items-center rounded-md border px-2.5 text-[12px] lg:h-[17px] lg:px-[6px] lg:text-[8.5px]', !q.tag ? 'border-sg-blue/40 bg-sg-blue-soft text-sg-blue' : 'border-sg-line bg-white text-sg-body')}>All tags</Link></li>
        {tags.slice(0, 6).map(tag => (
          <li key={tag}><Link href={hrefWith({ tag: q.tag === tag ? null : tag })} aria-current={q.tag === tag ? 'true' : undefined}
            className={cn('inline-flex h-9 items-center rounded-md border px-2.5 text-[12px] lg:h-[17px] lg:px-[6px] lg:text-[8.5px]', q.tag === tag ? 'border-sg-blue/40 bg-sg-blue-soft text-sg-blue' : 'border-sg-line bg-white text-sg-body hover:bg-slate-50')}>{tag}</Link></li>
        ))}
        <li><AddTagButton canEdit={can.createResearch} items={rows.map(item => ({ id: item.id, name: item.title }))} /></li>
      </ul>

      {body}
    </>
  )
}
