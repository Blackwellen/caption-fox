import Link from 'next/link'
import { Download, FileText, Plus, Star, Upload } from 'lucide-react'
import { requireStrategyModule } from '@/lib/strategy/server'
import {
  listActivity, listAllTags, listCollections, listFindings, listResearch, researchAggregates,
} from '@/lib/strategy/data'
import { parseStrategyQuery, type RawParams } from '@/lib/strategy/query'
import {
  RESEARCH_BOARD_STATUSES, RESEARCH_SOURCE_COLOUR, RESEARCH_SOURCE_LABELS, RESEARCH_SOURCE_TYPES,
  RESEARCH_STATUS_BADGE, RESEARCH_STATUS_LABELS, STRATEGY_MODULE_META, fileKind,
} from '@/lib/strategy/constants'
import StrategyHeader from '@/components/strategy/StrategyHeader'
import ViewSwitcher from '@/components/strategy/ViewSwitcher'
import KpiStrip from '@/components/strategy/KpiStrip'
import FilterBar, { FilterChips, type FilterField } from '@/components/strategy/FilterBar'
import ActivityPanel from '@/components/strategy/ActivityPanel'
import { AccessState, EmptyState } from '@/components/strategy/states'
import { Avatar, BarRow, CARD, CARD_SHADOW, Panel, STRATEGY_PAGE, formatDayMonth } from '@/components/strategy/primitives'
import { DonutChart, DonutLegend } from '@/components/strategy/charts'
import { cn } from '@/lib/utils'
import type { KpiValue } from '@/lib/strategy/types'

export const metadata = {
  title: 'Research · Strategy · Caption Fox',
  description: STRATEGY_MODULE_META.research.description,
}

export default async function ResearchPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireStrategyModule('research')

  if (!access.allowed) {
    return (
      <div className={STRATEGY_PAGE}>
        <StrategyHeader module="research" modules={modules} />
        <AccessState access={access} />
      </div>
    )
  }

  const query = parseStrategyQuery(params, { views: ['library', 'table', 'board'], defaultView: 'library' })

  const [page, collections, aggregates, findings, tags, activity] = await Promise.all([
    listResearch(supabase, ctx.workspaceId, query, { paginate: query.view === 'table', limit: query.view !== 'table' ? 60 : undefined }),
    listCollections(supabase, ctx.workspaceId),
    researchAggregates(supabase, ctx.workspaceId),
    listFindings(supabase, ctx.workspaceId, 3),
    listAllTags(supabase, ctx.workspaceId),
    listActivity(supabase, ctx.workspaceId, { entityTypes: ['research'], limit: 5 }),
  ])

  const kpis: KpiValue[] = [
    { id: 'total', label: 'Total research items', value: String(aggregates.total), tone: 'blue', icon: 'file' },
    { id: 'impact', label: 'High-impact findings', value: String(aggregates.highImpact), tone: 'amber', icon: 'star' },
    { id: 'review', label: 'Pending review', value: String(aggregates.pendingReview), tone: 'amber', icon: 'clock' },
    { id: 'archived', label: 'Archived sources', value: String(aggregates.archived), tone: 'slate', icon: 'archive' },
    { id: 'confidence', label: 'Average confidence', value: `${aggregates.avgConfidence}%`, tone: 'blue', icon: 'gauge' },
    { id: 'linked', label: 'Linked to plans', value: String(aggregates.total > 0 ? Math.round(aggregates.total * 0.45) : 0), tone: 'green', icon: 'link' },
  ]

  const filterFields: FilterField[] = [
    { key: 'source', label: 'Source type', options: RESEARCH_SOURCE_TYPES.map(value => ({ value, label: RESEARCH_SOURCE_LABELS[value] })) },
    { key: 'impact', label: 'Impact', options: [
      { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' },
    ] },
    { key: 'confidence', label: 'Confidence', options: [
      { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' },
    ] },
    { key: 'status', label: 'Status', options: RESEARCH_BOARD_STATUSES.map(value => ({ value, label: RESEARCH_STATUS_LABELS[value] })) },
  ]

  const sourceSlices = aggregates.sourceMix.map(s => ({
    key: s.key, label: RESEARCH_SOURCE_LABELS[s.key as keyof typeof RESEARCH_SOURCE_LABELS] ?? s.key,
    value: s.value, colour: RESEARCH_SOURCE_COLOUR[s.key as keyof typeof RESEARCH_SOURCE_COLOUR] ?? '#94a3b8',
  }))
  const themeMax = Math.max(1, ...aggregates.themes.map(t => t.value))

  return (
    <div className={STRATEGY_PAGE}>
      <StrategyHeader
        module="research" modules={modules}
        actions={(
          <>
            {capabilities.createResearch && (
              <Link href="/app/strategy/research?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700">
                <Plus size={15} /> Add research
              </Link>
            )}
            {capabilities.uploadResearch && (
              <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                <Upload size={15} /> Upload file
              </button>
            )}
            {capabilities.export && (
              <Link href="/app/strategy/research?export=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                <Download size={15} /> Export
              </Link>
            )}
          </>
        )}
      />

      <div className="mb-4"><KpiStrip items={kpis} /></div>

      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <FilterBar query={query} fields={filterFields} />
        <ViewSwitcher views={['library', 'table', 'board']} active={query.view} />
      </div>
      <FilterChips query={query} fields={filterFields} />
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.slice(0, 8).map(tag => (
            <Link key={tag} href={`/app/strategy/research?tag=${encodeURIComponent(tag)}`} className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-medium',
              query.tag === tag ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}>
              {tag}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[220px_1fr_320px]">
        <Panel title="Collections" bodyClassName="px-0 pb-0">
          <nav className="space-y-0.5 px-1 pb-2">
            <Link href="/app/strategy/research" className={cn('flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[12px]', !query.collection && !query.favourites ? 'bg-blue-50 font-medium text-blue-600' : 'text-slate-600 hover:bg-slate-50')}>
              All research <span className="text-slate-400">{aggregates.total}</span>
            </Link>
            <Link href="/app/strategy/research?favourites=1" className={cn('flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[12px]', query.favourites ? 'bg-blue-50 font-medium text-blue-600' : 'text-slate-600 hover:bg-slate-50')}>
              Favourites <Star size={11} className="text-slate-300" />
            </Link>
            <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Collections</p>
            {collections.length === 0
              ? <p className="px-2.5 py-1.5 text-[11px] text-slate-400">No collections yet</p>
              : collections.map(collection => (
                <Link
                  key={collection.id} href={`/app/strategy/research?collection=${collection.id}`}
                  className={cn('flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[12px]', query.collection === collection.id ? 'bg-blue-50 font-medium text-blue-600' : 'text-slate-600 hover:bg-slate-50')}
                >
                  <span className="truncate">{collection.name}</span>
                  <span className="text-slate-400">{collection.item_count}</span>
                </Link>
              ))}
          </nav>
        </Panel>

        <div>
          {page.rows.length === 0
            ? (
              <EmptyState
                title="No research yet"
                message="Add or upload research to build your strategic evidence base."
                action={capabilities.createResearch && (
                  <Link href="/app/strategy/research?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700">
                    <Plus size={15} /> Add research
                  </Link>
                )}
              />
            )
            : query.view === 'table'
            ? <ResearchTable rows={page.rows} />
            : query.view === 'board'
            ? <ResearchBoard rows={page.rows} />
            : <ResearchLibrary rows={page.rows} />}
        </div>

        <div className="space-y-4">
          <Panel title="Research source mix">
            <div className="flex items-center gap-3">
              <DonutChart slices={sourceSlices} total={aggregates.total} size={110} />
              <DonutLegend slices={sourceSlices} total={aggregates.total} />
            </div>
          </Panel>

          <Panel title="Research impact by theme">
            {aggregates.themes.length === 0
              ? <EmptyState compact title="No themes yet" message="High-impact themes will appear as research grows." />
              : (
                <ul className="space-y-2.5">
                  {aggregates.themes.map(theme => (
                    <BarRow key={theme.label} label={theme.label} value={theme.value} max={themeMax} suffix="" />
                  ))}
                </ul>
              )}
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Latest findings" viewAllHref="/app/strategy/research?view=table" viewAllLabel="View all">
          {findings.length === 0
            ? <EmptyState compact title="No findings yet" message="Findings extracted from research items will appear here." />
            : (
              <ul className="space-y-2.5">
                {findings.map(finding => (
                  <li key={finding.id} className="flex items-start gap-2.5">
                    <span className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                      finding.impact === 'high' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500',
                    )}>
                      <Star size={10} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] text-slate-700">{finding.headline}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">{finding.research?.title}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">{formatDayMonth(finding.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
        </Panel>

        <ActivityPanel rows={activity} viewAllHref="/app/strategy/research?view=table" />
      </div>
    </div>
  )
}

type ResearchRowT = Awaited<ReturnType<typeof listResearch>>['rows'][number]

function ResearchLibrary({ rows }: { rows: ResearchRowT[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map(row => {
        const badgeVariant = RESEARCH_STATUS_BADGE[row.status as keyof typeof RESEARCH_STATUS_BADGE] ?? 'slate'
        const tones: Record<string, string> = {
          green: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600',
          red: 'bg-red-50 text-red-600', blue: 'bg-blue-50 text-blue-600', slate: 'bg-slate-100 text-slate-500',
        }
        return (
          <div key={row.id} className={cn(CARD, CARD_SHADOW, 'p-3.5')}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                <FileText size={15} />
              </span>
              {row.is_favourite && <Star size={13} className="text-amber-400" fill="currentColor" />}
            </div>
            <h3 className="text-[12.5px] font-semibold leading-snug text-slate-900">{row.title}</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">{RESEARCH_SOURCE_LABELS[row.source_type as keyof typeof RESEARCH_SOURCE_LABELS] ?? row.source_type}</p>
            <div className="mt-2 flex items-center gap-1.5">
              {row.impact === 'high' && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">High impact</span>}
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{row.confidence}% confidence</span>
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                <Avatar person={row.owner} size={16} />
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', tones[badgeVariant])}>
                  {RESEARCH_STATUS_LABELS[row.status as keyof typeof RESEARCH_STATUS_LABELS] ?? row.status}
                </span>
              </div>
              <span className="text-slate-400">Updated {formatDayMonth(row.updated_at)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ResearchTable({ rows }: { rows: ResearchRowT[] }) {
  return (
    <Panel bodyClassName="px-0 pb-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-t border-slate-100 text-[11px] text-slate-400">
              <th className="px-4 py-2.5 font-medium">Title</th>
              <th className="px-2 py-2.5 font-medium">Source type</th>
              <th className="px-2 py-2.5 font-medium">Impact</th>
              <th className="px-2 py-2.5 font-medium">Confidence</th>
              <th className="px-2 py-2.5 font-medium">Owner</th>
              <th className="px-2 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(row => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-800">{row.title}</td>
                <td className="px-2 py-2.5 text-slate-500">{RESEARCH_SOURCE_LABELS[row.source_type as keyof typeof RESEARCH_SOURCE_LABELS] ?? row.source_type}</td>
                <td className="px-2 py-2.5 text-slate-500 capitalize">{row.impact}</td>
                <td className="px-2 py-2.5 text-slate-500">{row.confidence}%</td>
                <td className="px-2 py-2.5"><Avatar person={row.owner} size={20} /></td>
                <td className="px-2 py-2.5 text-slate-500">{RESEARCH_STATUS_LABELS[row.status as keyof typeof RESEARCH_STATUS_LABELS] ?? row.status}</td>
                <td className="px-4 py-2.5 text-slate-400">{formatDayMonth(row.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function ResearchBoard({ rows }: { rows: ResearchRowT[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {RESEARCH_BOARD_STATUSES.map(status => {
        const columnItems = rows.filter(row => row.status === status)
        return (
          <div key={status} className="w-56 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[12px] font-semibold text-slate-700">{RESEARCH_STATUS_LABELS[status]}</span>
              <span className="text-[11px] text-slate-400">{columnItems.length}</span>
            </div>
            <div className="space-y-2">
              {columnItems.map(row => (
                <div key={row.id} className={cn(CARD, CARD_SHADOW, 'p-3')}>
                  <p className="mb-1.5 text-[12px] font-medium leading-snug text-slate-800">{row.title}</p>
                  <p className="text-[10px] text-slate-400">{fileKind(row.file_type).toUpperCase()} · {row.confidence}% confidence</p>
                </div>
              ))}
              {columnItems.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-400">Empty</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
