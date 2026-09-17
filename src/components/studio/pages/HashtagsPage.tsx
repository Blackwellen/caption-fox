import { Ban, Flame, FolderClosed, Gem, Hash, Heart, Info, LayoutGrid, List, Sprout, TrendingUp, Wand2, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { requireStudioModule } from '@/lib/studio/server'
import {
  getKeywordSet, keywordCounts, keywordRecommendations, keywordSeries, latestOwnDraft, listContent, listKeywordSets,
} from '@/lib/studio/data'
import { CHANNEL_LABELS, STUDIO_CHANNELS } from '@/lib/studio/constants'
import { parseStudioQuery, type RawParams } from '@/lib/studio/query'
import type { KeywordSetRow, KeywordTermRow } from '@/lib/studio/types'
import StudioPageHeader from '../StudioPageHeader'
import { AccessBlocked } from '../states'
import { FiltersMenu, Pager, SearchInput, SelectFilter, ViewToggle } from '../controls'
import {
  AllTermsButton, Combinations, CopyOutput, ExportSets, FavouriteStar, GroupList, GroupMenu, HowItWorks, SelectRowLink,
  type KeywordPerms,
} from '../hashtags/HashtagClient'
import { SetIcon } from '../hashtags/set-icon'
import { Card, EmptyBlock, ErrorBlock, S_CARD, delta, fmtAgo, fmtCompact, fmtDate, type Tone } from '../ui'

function GrowthLine({ series, growth, className }: { series: number[] | undefined; growth: number | null; className?: string; id?: string }) {
  // Plots the stored daily volume history (studio_keyword_metrics_daily).
  const points = series ?? []
  const up = (growth ?? 0) >= 0
  if (points.length < 2) return <span className={cn('inline-block text-[10px] text-slate-400', className)}>No history</span>
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const path = points.map((v, i) => `${i ? 'L' : 'M'}${((i / (points.length - 1)) * 78 + 1).toFixed(1)},${(22 - ((v - min) / span) * 20).toFixed(1)}`).join(' ')
  return (
    <svg viewBox="0 0 80 24" className={className} role="img" aria-label={`Daily volume over ${points.length} days, from ${points[0]} to ${points[points.length - 1]}`}>
      <path d={path} fill="none" stroke={up ? '#16a34a' : '#dc2626'} strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
function DeltaPill({ current, previous }: { current: number; previous: number }) {
  const d = delta(current, previous)
  if (d.pct === null) return <span className="rounded-full bg-[#eef3ff] px-1.5 text-[10px] font-medium text-[#1a5cff] lg:text-[8.5px]">New</span>
  const up = d.pct >= 0
  return <span className={cn('text-[11px] font-medium lg:text-[9px]', up ? 'text-[#16a34a]' : 'text-red-600')}>{up ? '↑' : '↓'} {Math.abs(d.pct)}%</span>
}

const COMPETITION: { max: number; label: string; tone: string }[] = [
  { max: 0.45, label: 'Low', tone: 'bg-[#eaf7ef] text-[#16803c]' },
  { max: 0.65, label: 'Medium', tone: 'bg-[#fff4df] text-[#b86e00]' },
  { max: 2, label: 'High', tone: 'bg-[#fdecec] text-[#c53030]' },
]
const competitionBand = (c: number | null) => (c === null ? null : COMPETITION.find(b => c < b.max) ?? COMPETITION[2]!)
const relevanceBand = (r: number | null) => (r === null ? null : r >= 80 ? { label: 'High', tone: 'bg-[#eaf7ef] text-[#16803c]' } : r >= 60 ? { label: 'Medium', tone: 'bg-[#fff4df] text-[#b86e00]' } : { label: 'Low', tone: 'bg-slate-100 text-slate-600' })

function combinations(terms: KeywordTermRow[], hashtags: string[]): { tags: string[]; volume: number }[] {
  const ranked = terms.filter(t => t.kind === 'hashtag' || t.term.startsWith('#'))
    .map(t => ({ tag: t.term.startsWith('#') ? t.term : `#${t.term}`, volume: t.avg_volume ?? 0 }))
    .sort((a, b) => b.volume - a.volume)
  for (const h of hashtags) if (!ranked.some(r => r.tag.toLowerCase() === h.toLowerCase())) ranked.push({ tag: h, volume: 0 })
  const top = ranked.slice(0, 10)
  const pairs: { tags: string[]; volume: number }[] = []
  for (let i = 0; i < top.length; i += 1) for (let j = i + 1; j < top.length; j += 1) {
    pairs.push({ tags: [top[i]!.tag, top[j]!.tag], volume: Math.min(top[i]!.volume, top[j]!.volume) })
  }
  return pairs.filter(p => p.volume > 0).sort((a, b) => b.volume - a.volume).slice(0, 25)
}

export default async function HashtagsPage({ searchParams }: { searchParams: RawParams }) {
  const { supabase, ctx, userId, capabilities, modules, access, base } = await requireStudioModule('hashtags')
  if (!access.allowed) {
    return (
      <>
        <StudioPageHeader layout="bar" base={base} modules={modules} title="Hashtags & Keywords" />
        <AccessBlocked access={access} />
      </>
    )
  }

  const q = parseStudioQuery(searchParams, { views: ['cards', 'table'], defaultView: 'cards', defaultSort: 'updated_desc', defaultSize: 4 })
  const tab = searchParams.tab === 'sets' ? 'sets' : 'clusters'
  const size = q.view === 'table' ? Math.max(q.size, 12) : q.size
  const filterQuery = { ...q, page: 1 }

  const [counts, recs, clusters, sets, table, allForExport, facets, drafts, latest] = await Promise.all([
    keywordCounts(supabase, ctx.workspaceId),
    keywordRecommendations(supabase, ctx.workspaceId),
    listKeywordSets(supabase, ctx.workspaceId, filterQuery, { kind: 'cluster', paginate: false, limit: 200 }),
    listKeywordSets(supabase, ctx.workspaceId, filterQuery, { kind: 'set', paginate: false, limit: 200 }),
    listKeywordSets(supabase, ctx.workspaceId, { ...q, size }),
    listKeywordSets(supabase, ctx.workspaceId, q, { paginate: false, limit: 2000 }),
    supabase.from('hashtag_sets').select('topic, language').eq('workspace_id', ctx.workspaceId).is('archived_at', null).limit(2000),
    capabilities.editContent ? listContent(supabase, ctx.workspaceId, { ...q, q: '', status: '', channel: '', owner: userId, tag: '', campaign: '', from: '', to: '', archived: false, sort: 'updated_desc', page: 1, size: 6 }, { statuses: ['draft'] }) : Promise.resolve({ rows: [], total: 0, error: null }),
    capabilities.editContent ? latestOwnDraft(supabase, ctx.workspaceId, userId, 'compose') : Promise.resolve(null),
  ])

  const listed = tab === 'clusters' ? clusters.rows : sets.rows
  const selectedId = q.selected || listed[0]?.id || null
  const detail = selectedId ? await getKeywordSet(supabase, ctx.workspaceId, selectedId) : { row: null, terms: [], error: null }
  const group: KeywordSetRow | null = detail.row
  const series = await keywordSeries(supabase, ctx.workspaceId, [...new Set([...table.rows.map(r => r.id), ...(group ? [group.id] : [])])])

  // Server render time anchors relative dates for this request.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const perms: KeywordPerms = {
    create: capabilities.createHashtags, edit: capabilities.editHashtags, export: capabilities.exportHashtags,
    compose: capabilities.editContent && modules.includes('compose'),
  }
  const topics = [...new Set((facets.data ?? []).map(f => f.topic).filter(Boolean) as string[])].sort()
  const languages = [...new Set((facets.data ?? []).map(f => f.language).filter(Boolean) as string[])].sort()
  const t = (key: string) => counts.trends[key] ?? { current: 0, previous: 0 }
  const topTerms = detail.terms.filter(x => x.kind !== 'hashtag' && !x.term.startsWith('#')).slice(0, 5)
  const hashtagOutput = group ? [...new Set([...group.hashtags, ...detail.terms.filter(x => x.kind === 'hashtag' || x.term.startsWith('#')).map(x => (x.term.startsWith('#') ? x.term : `#${x.term}`))])] : []
  const filtered = ['q', 'kind', 'channel', 'topic', 'language', 'status'].some(k => searchParams[k])

  const kpis: { key: string; label: string; value: string; icon: React.ReactNode; tile: string; trend?: string; note: string }[] = [
    { key: 'active', label: 'Active Keyword Sets', value: counts.activeClusters.toLocaleString('en-GB'), icon: <Wand2 size={17} />, tile: 'bg-[#f1ebff] text-[#7c3aed]', trend: 'active', note: 'vs last 30 days' },
    { key: 'hashtags', label: 'Recommended Hashtags', value: counts.recommendedHashtags.toLocaleString('en-GB'), icon: <Hash size={18} />, tile: 'bg-[#e9f0ff] text-[#1a5cff]', trend: 'hashtags', note: 'vs last 30 days' },
    { key: 'trending', label: 'Trending Terms', value: counts.trendingTerms.toLocaleString('en-GB'), icon: <TrendingUp size={17} />, tile: 'bg-[#f1ebff] text-[#7c3aed]', trend: 'trending', note: 'vs last 30 days' },
    { key: 'saved', label: 'Saved Groups', value: counts.savedGroups.toLocaleString('en-GB'), icon: <FolderClosed size={17} />, tile: 'bg-[#e8f7ee] text-[#16a34a]', trend: 'saved', note: 'vs last 30 days' },
    { key: 'lift', label: 'Performance Lift', value: counts.avgGrowth === null ? '—' : `${counts.avgGrowth > 0 ? '+' : ''}${counts.avgGrowth}%`, icon: <BarChart3 size={17} />, tile: 'bg-[#e9f0ff] text-[#1a5cff]', note: 'avg. 30-day growth' },
    { key: 'blocked', label: 'Blocked Terms', value: counts.blockedTerms.toLocaleString('en-GB'), icon: <Ban size={17} />, tile: 'bg-[#fdecec] text-[#e5484d]', trend: 'blocked', note: 'vs last 30 days' },
  ]

  const recBlock = (key: string, icon: React.ReactNode, title: string, hint: string, rows: { label: string; value: string; up?: boolean }[], empty: string) => (
    <li key={key} className="rounded-[8px] border border-[#eceff4] px-3 py-3 lg:px-[10px] lg:py-[10px]">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900 lg:text-[10.5px]">{icon}{title}</p>
      <p className="text-[11px] text-slate-500 lg:text-[8.5px]">{hint}</p>
      {rows.length === 0 ? <p className="mt-2 text-[11px] text-slate-400 lg:text-[9px]">{empty}</p> : (
        <ul className="mt-2 space-y-1 lg:mt-[6px] lg:space-y-[3px]">
          {rows.map(r => (
            <li key={r.label} className="flex items-center text-[12px] lg:text-[9.5px]">
              <span className="min-w-0 flex-1 truncate text-slate-800">{r.label}</span>
              <span className={cn('tabular-nums', r.up === undefined ? 'text-slate-700' : r.up ? 'text-[#16a34a]' : 'text-red-600')}>{r.up !== undefined && (r.up ? '↑ ' : '↓ ')}{r.value}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )

  const tableCard = (
    <Card className="overflow-hidden" aria-labelledby="all-sets-title">
      <div className="flex items-center gap-2 px-3.5 py-3 lg:h-[50px] lg:px-[14px] lg:py-0">
        <h2 id="all-sets-title" className="text-[14px] font-semibold text-slate-900 lg:text-[12px]">All Keyword &amp; Hashtag Sets</h2>
        <span className="rounded-full bg-[#eef3ff] px-2 text-[11px] font-medium text-[#1a5cff] lg:text-[9px]">{table.total}</span>
        <div className="ml-auto"><ExportSets rows={allForExport.rows} perms={perms} /></div>
      </div>
      {table.error ? <ErrorBlock message={table.error} /> : table.rows.length === 0 ? (
        <EmptyBlock search={filtered} title={filtered ? 'No groups match these filters' : 'No keyword groups yet'} message={filtered ? 'Clear the filters to see every group.' : 'Create a keyword cluster or hashtag set to get started.'} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <caption className="sr-only">All keyword and hashtag sets</caption>
            <thead><tr className="border-y border-[#eef0f4] bg-[#fbfcfd]">
              {[['Name', 'pl-3.5 lg:pl-[16px] lg:w-[195px]'], ['Type', 'lg:w-[80px]'], ['Terms', 'lg:w-[80px]'], ['Avg. Volume', 'lg:w-[92px]'], ['Competition', 'lg:w-[114px]'], ['Growth (30d)', 'lg:w-[118px]'], ['Relevance', 'lg:w-[64px]'], ['Last Updated', 'lg:w-[74px]'], ['Status', 'lg:w-[50px]'], ['Actions', 'pr-3']].map(([h, c]) => (
                <th key={h} scope="col" className={cn('h-9 whitespace-nowrap px-2 text-left text-[12px] font-medium text-slate-600 lg:h-[30px] lg:text-[9.5px]', c)}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {table.rows.map(r => {
                const band = competitionBand(r.competition)
                return (
                  <tr key={r.id} className={cn('border-b border-[#f0f2f5] last:border-0 hover:bg-slate-50/60', r.id === group?.id && 'bg-[#f7f9ff]')}>
                    <td className="h-12 px-2 pl-3.5 lg:h-[36px] lg:pl-[16px]">
                      <SelectRowLink id={r.id} className="flex items-center gap-2.5 text-[13px] text-slate-800 hover:text-[#1a5cff] lg:gap-[14px] lg:text-[9.5px]">
                        <SetIcon icon={r.icon} className="h-4 w-4 lg:h-[15px] lg:w-[15px]" /><span className="truncate">{r.name}</span>
                      </SelectRowLink>
                    </td>
                    <td className="px-2"><span className={cn('rounded-[4px] px-2 py-0.5 text-[11px] font-medium lg:text-[8.5px]', r.kind === 'cluster' ? 'bg-[#e9f0ff] text-[#1a5cff]' : 'bg-[#f1ebff] text-[#7c3aed]')}>{r.kind === 'cluster' ? 'Cluster' : 'Set'}</span></td>
                    <td className="px-2 text-[13px] tabular-nums text-slate-700 lg:text-[9.5px]">{r.term_count ?? 0}</td>
                    <td className="px-2 text-[13px] tabular-nums text-slate-700 lg:text-[9.5px]">{r.avg_volume !== null ? fmtCompact(r.avg_volume) : '—'}</td>
                    <td className="px-2 text-[13px] tabular-nums text-slate-700 lg:text-[9.5px]">
                      {r.competition !== null ? <span className="flex items-center gap-2">{r.competition.toFixed(2)}{band && <span className={cn('rounded-[4px] px-1.5 text-[10px] lg:text-[8px]', band.tone)}>{band.label}</span>}</span> : '—'}
                    </td>
                    <td className="px-2">
                      <span className="flex items-center gap-1.5 text-[13px] tabular-nums lg:text-[9.5px]">
                        <span className={(r.growth_30d ?? 0) >= 0 ? 'text-[#16a34a]' : 'text-red-600'}>{r.growth_30d !== null ? `${r.growth_30d > 0 ? '+' : ''}${r.growth_30d}%` : '—'}</span>
                        <GrowthLine series={series.get(r.id)} growth={r.growth_30d} className="h-5 w-12 lg:h-[18px] lg:w-[40px]" />
                      </span>
                    </td>
                    <td className="px-2"><span className="rounded-[4px] bg-[#eaf7ef] px-2 py-0.5 text-[12px] font-semibold text-[#16803c] lg:text-[9px]">{r.relevance_score ?? '–'}</span></td>
                    <td className="whitespace-nowrap px-2 text-[12px] text-slate-600 lg:text-[9.5px]">{fmtAgo(r.updated_at, now)}</td>
                    <td className="px-2"><span className={cn('rounded-[4px] px-1.5 py-0.5 text-[10px] font-medium capitalize lg:text-[8px]', r.status === 'active' ? 'bg-[#eaf7ef] text-[#16803c]' : 'bg-slate-100 text-slate-600')}>{r.status}</span></td>
                    <td className="px-2 pr-3"><GroupMenu group={r} perms={perms} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {table.total > size && <Pager page={q.page} size={size} total={table.total} noun="groups" className="border-t border-[#eef0f4] px-3.5 py-2.5" />}
    </Card>
  )

  return (
    <>
      <StudioPageHeader layout="bar" base={base} modules={modules} title="Hashtags & Keywords" className="lg:mb-[18px]" ownHeading />
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-slate-900 lg:text-[19px]">Hashtags &amp; Keywords</h1>
          <p className="mt-1 text-[13px] text-slate-600 lg:mt-[10px] lg:text-[11px]">Discover, analyse and curate high-performing hashtags and keywords to grow your reach.</p>
        </div>
        <HowItWorks />
      </div>

      {counts.error ? <Card className="mt-4"><ErrorBlock message={counts.error} /></Card> : (
        <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:mt-[16px] lg:gap-[12px] xl:grid-cols-6">
          {kpis.map(k => (
            <li key={k.key} className={cn(S_CARD, 'flex gap-3 px-3.5 py-3 lg:h-[97px] lg:gap-[10px] lg:px-[12px] lg:pt-[20px]')}>
              <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full lg:h-[34px] lg:w-[34px]', k.tile)} aria-hidden>{k.icon}</span>
              <span className="min-w-0">
                <span className="block truncate text-[12px] text-slate-600 lg:overflow-visible lg:whitespace-nowrap lg:text-[9.5px]">{k.label}</span>
                <span className="mt-1 flex items-center gap-2 lg:mt-[10px]">
                  <span className="text-[20px] font-semibold text-slate-900 lg:text-[17px]">{k.value}</span>
                  {k.trend && <DeltaPill {...t(k.trend)} />}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-500 lg:mt-[6px] lg:text-[9px]">{k.note}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className={cn(S_CARD, 'mt-4 flex flex-wrap items-center gap-2 bg-[#fbfcfe] px-3 py-3 lg:mt-[12px] lg:h-[64px] lg:flex-nowrap lg:gap-[12px] lg:px-[12px] lg:py-0')}>
        <SearchInput placeholder="Search clusters, sets or terms…" className="w-full sm:w-auto lg:w-[340px] lg:shrink" inputClassName="lg:h-[35px]" />
        <SelectFilter param="kind" label="Type" display="stacked" className="lg:h-[35px] lg:w-[128px] lg:shrink-0" options={[{ value: 'cluster', label: 'Clusters' }, { value: 'set', label: 'Hashtag sets' }]} />
        <SelectFilter param="channel" label="Platform" display="stacked" className="lg:h-[35px] lg:w-[128px] lg:shrink-0" options={STUDIO_CHANNELS.map(c => ({ value: c, label: CHANNEL_LABELS[c]! }))} />
        <SelectFilter param="topic" label="Topic" display="stacked" className="lg:h-[35px] lg:w-[125px] lg:shrink-0" options={topics.map(x => ({ value: x, label: x }))} />
        <SelectFilter param="language" label="Language" display="stacked" className="lg:h-[35px] lg:w-[125px] lg:shrink-0" options={languages.map(x => ({ value: x, label: x }))} />
        <ViewToggle value={q.view} defaultValue="cards" className="lg:ml-auto lg:h-[35px] lg:shrink-0" itemClassName="lg:h-[31px] lg:w-[80px] lg:justify-center lg:text-[10.5px]"
          options={[{ id: 'cards', label: 'Cards', icon: <LayoutGrid size={13} /> }, { id: 'table', label: 'Table', icon: <List size={13} /> }]} />
        <FiltersMenu label="Filters" className="lg:h-[35px] lg:shrink-0 lg:px-[14px] lg:text-[10.5px]" fields={[
          { param: 'status', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }] },
        ]} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-[10px] lg:gap-[12px] xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          {q.view === 'cards' && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[272px_minmax(0,1fr)] lg:gap-[12px]">
              <Card className="lg:h-[460px]" aria-label="Keyword groups">
                {clusters.error || sets.error ? <ErrorBlock message={clusters.error ?? sets.error ?? ''} /> : (
                  <GroupList clusters={clusters.rows} sets={sets.rows} selectedId={group?.id ?? null} tab={tab} perms={perms} now={now} />
                )}
              </Card>

              <Card className="min-w-0 px-4 pb-4 pt-4 lg:h-[460px] lg:px-[16px] lg:pb-[14px] lg:pt-[16px]" aria-labelledby="group-detail-title">
                {detail.error ? <ErrorBlock message={detail.error} /> : !group ? (
                  <EmptyBlock title="Select a group" message="Choose a keyword cluster or hashtag set to see its terms and output." />
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <h2 id="group-detail-title" className="truncate text-[18px] font-semibold text-slate-900 lg:text-[16px]">{group.name}</h2>
                      <FavouriteStar key={group.id} id={group.id} favourite={group.favourite} canEdit={perms.edit} />
                      <div className="ml-auto"><GroupMenu group={group} perms={perms} /></div>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-slate-500 lg:text-[9.5px]">
                      <span className="inline-flex items-center gap-1.5 capitalize text-slate-600"><span className={cn('h-2 w-2 rounded-full', group.status === 'active' ? 'bg-[#16a34a]' : 'bg-slate-400')} aria-hidden />{group.status}</span>
                      <span aria-hidden>•</span><span>Created {fmtDate(group.created_at)}</span><span aria-hidden>•</span><span>Updated {fmtAgo(group.updated_at, now).toLowerCase()}</span>
                    </p>

                    <dl className="mt-4 grid grid-cols-2 gap-3 border-b border-[#eef0f4] pb-4 sm:grid-cols-4 lg:mt-[22px] lg:grid-cols-[112px_130px_128px_1fr] lg:gap-0 lg:pb-[14px]">
                      {(() => {
                        const rel = relevanceBand(group.relevance_score)
                        const comp = competitionBand(group.competition)
                        return (<>
                          <div><dd className="text-[18px] font-semibold text-slate-900 lg:text-[16px]">{group.relevance_score ?? '—'}</dd>
                            <dt className="mt-1 flex items-center gap-2 text-[11px] text-slate-500 lg:text-[9px]">Relevance Score{rel && <span className={cn('rounded-[4px] px-1.5 text-[10px] lg:text-[8px]', rel.tone)}>{rel.label}</span>}</dt></div>
                          <div><dd className="text-[18px] font-semibold text-slate-900 lg:text-[16px]">{group.avg_volume !== null ? fmtCompact(group.avg_volume) : '—'}</dd>
                            <dt className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 lg:text-[9px]">Avg. Volume <span title="Estimated monthly searches across the group's terms"><Info size={10} aria-hidden /></span></dt></div>
                          <div><dd className="text-[18px] font-semibold text-slate-900 lg:text-[16px]">{group.competition !== null ? group.competition.toFixed(2) : '—'}</dd>
                            <dt className="mt-1 flex items-center gap-2 text-[11px] text-slate-500 lg:text-[9px]">Competition{comp && <span className={cn('rounded-[4px] px-1.5 text-[10px] lg:text-[8px]', comp.tone)}>{comp.label}</span>}</dt></div>
                          <div className="flex items-center gap-3 lg:border-l lg:border-[#eef0f4] lg:pl-[16px]">
                            <div><dd className={cn('text-[18px] font-semibold lg:text-[16px]', (group.growth_30d ?? 0) >= 0 ? 'text-[#16a34a]' : 'text-red-600')}>{group.growth_30d !== null ? `${group.growth_30d > 0 ? '+' : ''}${group.growth_30d}%` : '—'}</dd>
                              <dt className="mt-1 text-[11px] text-slate-500 lg:text-[9px]">Growth (30d)</dt></div>
                            <GrowthLine series={series.get(group.id)} growth={group.growth_30d} className="ml-auto h-8 w-24 lg:h-[30px] lg:w-[86px]" />
                          </div>
                        </>)
                      })()}
                    </dl>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3 lg:mt-[14px] lg:grid-cols-[134fr_172fr_270fr] lg:gap-[20px]">
                      <section aria-labelledby="top-terms-title" className="flex flex-col">
                        <h3 id="top-terms-title" className="text-[13px] font-semibold text-slate-900 lg:text-[10.5px]">Top Terms</h3>
                        <div className="mt-2 flex text-[11px] text-slate-500 lg:mt-[18px] lg:text-[8.5px]"><span className="flex-1">Term</span><span>Avg. Volume</span></div>
                        {topTerms.length === 0 ? <p className="py-6 text-[12px] text-slate-500 lg:text-[9.5px]">No keyword terms yet.</p> : (
                          <ul className="mt-1 flex-1">
                            {topTerms.map(x => (
                              <li key={x.id} className="flex h-9 items-center text-[12px] lg:h-[30px] lg:text-[9.5px]">
                                <span className="min-w-0 flex-1 truncate text-slate-800">{x.term}</span>
                                <span className="tabular-nums text-slate-700">{x.avg_volume !== null ? fmtCompact(x.avg_volume) : '—'}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-2 lg:mt-auto"><AllTermsButton group={group} terms={detail.terms} perms={perms} /></div>
                      </section>
                      <section aria-labelledby="combos-title" className="flex flex-col">
                        <h3 id="combos-title" className="text-[13px] font-semibold text-slate-900 lg:text-[10.5px]">Suggested Combinations</h3>
                        <Combinations key={group.id} combos={combinations(detail.terms, group.hashtags)} />
                      </section>
                      <section aria-labelledby="copy-title" className="flex flex-col">
                        <h3 id="copy-title" className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900 lg:text-[10.5px]">Copy-Ready Output <span title="Trimmed to each platform's recommended hashtag count"><Info size={11} className="text-slate-400" aria-hidden /></span></h3>
                        <CopyOutput key={group.id} hashtags={hashtagOutput} drafts={drafts.rows.map(d => ({ id: d.id, title: d.internal_title || d.title || 'Untitled draft' }))}
                          latestDraftId={latest?.id ?? null} perms={perms} base={base} />
                      </section>
                    </div>
                  </>
                )}
              </Card>
            </div>
          )}

          <div className="mt-3 lg:mt-[12px]">{tableCard}</div>
        </div>

        <aside aria-labelledby="recs-title">
          <Card className="px-3.5 pb-3.5 pt-3.5 lg:px-[12px] lg:pb-[12px] lg:pt-[14px]">
            <h2 id="recs-title" className="text-[14px] font-semibold text-slate-900 lg:text-[11px]">Recommendations</h2>
            {recs.error ? <ErrorBlock message={recs.error} className="mx-0" /> : (
              <ul className="mt-3 space-y-2.5 lg:mt-[12px] lg:space-y-[10px]">
                {recBlock('trending', <Flame size={13} className="text-[#f97316]" aria-hidden />, 'Trending Now', 'Fastest 30-day growth in your terms',
                  recs.trending.map(r => ({ label: r.term, value: `${Math.abs(r.growth_30d ?? 0)}%`, up: (r.growth_30d ?? 0) >= 0 })), 'No growing terms yet.')}
                {recBlock('low', <Sprout size={13} className="text-[#16a34a]" aria-hidden />, 'Low Competition', 'High potential, less competition',
                  recs.lowCompetition.map(r => ({ label: r.term, value: (r.competition ?? 0).toFixed(2) })), 'No low-competition terms yet.')}
                {recBlock('gems', <Gem size={13} className="text-[#0ea5e9]" aria-hidden />, 'Underused Gems', 'Relevant terms with volume and room to grow',
                  recs.underused.map(r => ({ label: r.term, value: `${Math.abs(r.growth_30d ?? 0)}%`, up: (r.growth_30d ?? 0) >= 0 })), 'No underused terms found.')}
                {recBlock('audience', <Heart size={13} className="fill-[#e5487a] text-[#e5487a]" aria-hidden />, 'Audience Favourites', 'Hashtags beating your average engagement',
                  recs.audience.map(r => ({ label: r.term, value: `+${r.lift}%` })), 'Publish posts with hashtags to see what your audience engages with.')}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </>
  )
}
