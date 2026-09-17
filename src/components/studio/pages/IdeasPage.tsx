import Link from 'next/link'
import {
  Bookmark, CheckCircle2, ChevronRight, ExternalLink, FileText, KanbanSquare, LayoutGrid, Lightbulb, List,
  PenLine, PlayCircle, Sparkles, Star, TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { requireStudioModule } from '@/lib/studio/server'
import {
  getOrNullIdea, ideaCounts, listIdeaCollections, listIdeaTasks, listIdeas, listStudioActivity, listTrendSignals, listWorkspacePeople,
} from '@/lib/studio/data'
import { IDEA_BOARD_STAGES, IDEA_SOURCES, IDEA_STAGE_LABELS, IDEA_STAGES, type IdeaStage } from '@/lib/studio/constants'
import { parseStudioQuery, type RawParams } from '@/lib/studio/query'
import { signStudioMedia } from '@/lib/studio/sign'
import type { IdeaRow } from '@/lib/studio/types'
import StudioPageHeader from '../StudioPageHeader'
import { AccessBlocked } from '../states'
import { ClearFilters, FiltersMenu, Pager, SearchInput, SelectFilter, ViewToggle } from '../controls'
import { IdeaDialogs, IdeaStageButton, NewIdeaButton, NextActions, OpenIdeaButton, SortSelect } from '../ideas/IdeaClient'
import { STAGE_STYLE } from '../ideas/stage-style'
import {
  Card, CardHeader, Delta, EmptyBlock, ErrorBlock, PersonAvatar, S_TD, S_TH_PLAIN, TextLink, delta, fmtAgo, fmtDate, personName,
} from '../ui'

const COLLECTION_DOT: Record<string, string> = {
  violet: 'bg-[#7c3aed]', blue: 'bg-[#2563eb]', green: 'bg-[#16a34a]', amber: 'bg-[#f59e0b]', red: 'bg-[#ef4444]', slate: 'bg-slate-400',
}

function ScoreRing({ score, size = 34 }: { score: number | null; size?: number }) {
  const value = score ?? 0
  const r = 15
  const c = 2 * Math.PI * r
  const stroke = value >= 80 ? '#22a55b' : value >= 60 ? '#e59a0b' : '#94a3b8'
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} role="img" aria-label={score === null ? 'Not scored' : `Score ${value} out of 100`}>
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" stroke="#edf0f4" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-semibold text-slate-900" style={{ fontSize: Math.round(size * 0.32) }}>{score ?? '–'}</span>
    </span>
  )
}

const SORTS = [
  { id: 'created_desc', label: 'Newest' }, { id: 'created_asc', label: 'Oldest' }, { id: 'score_desc', label: 'Highest score' },
  { id: 'updated_desc', label: 'Recently updated' }, { id: 'title_asc', label: 'Title (A–Z)' },
]

export default async function IdeasPage({ searchParams }: { searchParams: RawParams }) {
  const { supabase, ctx, capabilities, modules, access, base } = await requireStudioModule('ideas')
  if (!access.allowed) {
    return (
      <>
        <StudioPageHeader layout="bar" base={base} modules={modules} title="Ideas" />
        <AccessBlocked access={access} />
      </>
    )
  }

  const q = parseStudioQuery(searchParams, { views: ['cards', 'list', 'board'], defaultView: 'cards', defaultSort: 'created_desc', defaultSize: 6 })
  const score = ['high', 'medium', 'low'].includes(String(searchParams.score)) ? String(searchParams.score) : ''
  const size = q.view === 'list' ? Math.max(q.size, 10) : q.view === 'board' ? 200 : q.size

  const [counts, ideas, collections, tasks, signals, activity, people, featuredRes] = await Promise.all([
    ideaCounts(supabase, ctx.workspaceId),
    listIdeas(supabase, ctx.workspaceId, { ...q, size, page: q.view === 'board' ? 1 : q.page }, { scoreBand: score }),
    listIdeaCollections(supabase, ctx.workspaceId),
    listIdeaTasks(supabase, ctx.workspaceId, 3),
    listTrendSignals(supabase, ctx.workspaceId, 3),
    listStudioActivity(supabase, ctx.workspaceId, 3, 'idea'),
    listWorkspacePeople(supabase, ctx.workspaceId),
    supabase.from('content_ideas').select('id').eq('workspace_id', ctx.workspaceId).is('archived_at', null)
      .not('stage', 'in', '(converted,archived)').order('featured', { ascending: false }).order('score', { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
  ])

  const selectedId = q.selected
  const [featured, selected, selectedTasks] = await Promise.all([
    featuredRes.data ? getOrNullIdea(supabase, ctx.workspaceId, featuredRes.data.id) : Promise.resolve(null),
    selectedId ? getOrNullIdea(supabase, ctx.workspaceId, selectedId) : Promise.resolve(null),
    selectedId ? listIdeaTasks(supabase, ctx.workspaceId, 20, selectedId) : Promise.resolve({ rows: [], error: null }),
  ])
  const signed = await signStudioMedia(ctx.workspaceId, { ideas: ideas.rows, activity: activity.rows, featured, selected })

  // Server render time anchors relative dates for this request.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const trend = (key: string) => counts.trends[key] ?? { current: 0, previous: 0 }
  const perms = { create: capabilities.createIdeas, edit: capabilities.editIdeas, convert: capabilities.convertIdeas }
  const collectionOptions = collections.rows.map(c => ({ id: c.id, name: c.name }))
  const filterKeys = ['q', 'stage', 'source', 'score', 'owner', 'tag', 'collection', 'from', 'to']
  const filtered = filterKeys.some(k => searchParams[k])
  const allTags = [...new Set(signed.ideas.flatMap(i => i.tags ?? []))].slice(0, 30)

  const kpis = [
    { key: 'new', label: 'New ideas', value: counts.total - (counts.byStage.converted ?? 0) - (counts.byStage.archived ?? 0), icon: <Lightbulb size={14} className="text-[#2f62f5]" />, href: `${base}/ideas?sort=created_desc` },
    { key: 'stage:prioritised', label: 'Prioritised', value: counts.byStage.prioritised ?? 0, icon: <Star size={14} className="fill-[#f5a524] text-[#f5a524]" />, href: `${base}/ideas?stage=prioritised` },
    { key: 'stage:ready_to_draft', label: 'Ready to draft', value: counts.byStage.ready_to_draft ?? 0, icon: <PenLine size={14} className="text-[#2f62f5]" />, href: `${base}/ideas?stage=ready_to_draft` },
    { key: 'trend', label: 'Trend signals', value: counts.trendSignals, icon: <TrendingUp size={14} className="text-[#e5484d]" />, href: `${base}/ideas?source=trend` },
    { key: 'saved', label: 'Saved inspirations', value: counts.savedInspirations, icon: <Bookmark size={14} className="text-[#2f62f5]" />, href: `${base}/ideas` },
    { key: 'stage:converted', label: 'Converted to content', value: counts.converted, icon: <PlayCircle size={14} className="text-[#7045e6]" />, href: `${base}/ideas?stage=converted` },
  ]

  const card = (idea: IdeaRow, compact = false) => {
    const label = typeof idea.metadata?.source_label === 'string' ? idea.metadata.source_label : idea.source ? idea.source.charAt(0).toUpperCase() + idea.source.slice(1) : '—'
    return (
      <article key={idea.id} className={cn('relative flex h-full flex-col rounded-[10px] border bg-white px-3 pb-3 pt-3 lg:px-[11px] lg:pb-[10px] lg:pt-[12px]',
        idea.featured ? 'border-[#8fb0ff] ring-1 ring-[#c9d8ff]' : 'border-[#e6e9f0]')}>
        {idea.featured && <span className="absolute -top-px right-3 rounded-b-[4px] bg-[#1a5cff] px-2 py-0.5 text-[10px] font-medium text-white lg:text-[8.5px]">Featured</span>}
        <div className="flex gap-2.5 lg:gap-[11px]">
          <ScoreRing score={idea.score} size={compact ? 28 : 34} />
          <div className="min-w-0">
            <OpenIdeaButton id={idea.id} className="block text-left text-[14px] font-semibold leading-snug text-slate-900 hover:text-[#1a5cff] focus-visible:outline-none focus-visible:underline lg:text-[12px] lg:leading-[16px]">
              {idea.title}
            </OpenIdeaButton>
            {!compact && <p className="mt-1.5 line-clamp-3 text-[12px] leading-snug text-slate-600 lg:mt-[6px] lg:text-[9.5px] lg:leading-[15px]">{idea.description}</p>}
          </div>
        </div>
        {!compact && (
          <>
            <p className="mt-3 flex items-center gap-2 text-[12px] lg:mt-[11px] lg:gap-[24px] lg:text-[9px]">
              <span className="text-slate-500">Source</span>
              <span className="flex min-w-0 items-center gap-1.5 truncate text-slate-700"><FileText size={11} className="shrink-0 text-slate-500" aria-hidden />{label}</span>
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5 lg:mt-[10px] lg:gap-[6px]" aria-label="Tags">
              {(idea.tags ?? []).slice(0, 4).map(tag => (
                <li key={tag}><Link href={`${base}/ideas?tag=${encodeURIComponent(tag)}`} className="inline-flex h-6 items-center rounded-[4px] bg-[#f1f3f7] px-2 text-[11px] text-slate-600 hover:bg-[#e6eaf2] lg:h-[18px] lg:px-[9px] lg:text-[8.5px]">{tag}</Link></li>
              ))}
            </ul>
          </>
        )}
        <div className="mt-auto flex items-center gap-2 pt-3 text-[12px] text-slate-600 lg:pt-[10px] lg:text-[9px]">
          <PersonAvatar person={idea.owner} size={16} /><span className="truncate">{personName(idea.owner)}</span>
          <time className="ml-auto shrink-0 text-slate-500" dateTime={idea.created_at}>{fmtDate(idea.created_at)}</time>
        </div>
        <IdeaStageButton id={idea.id} stage={idea.stage} canEdit={capabilities.editIdeas} className="mt-2 lg:mt-[9px]" />
      </article>
    )
  }

  return (
    <>
      <StudioPageHeader layout="bar" base={base} modules={modules} title="Ideas" className="lg:mb-[14px]" ownHeading />
      <div className="grid grid-cols-1 gap-4 lg:gap-[20px] xl:grid-cols-[minmax(0,1fr)_338px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="flex items-center gap-2 text-[24px] font-semibold tracking-[-0.02em] text-slate-900 lg:text-[24px]">Ideas <Sparkles size={18} className="text-[#1a5cff]" aria-hidden /></h1>
              <p className="mt-1 text-[13px] text-slate-600 lg:mt-[10px] lg:text-[11px]">Capture, evaluate and prioritise ideas that drive meaningful content.</p>
            </div>
            <NewIdeaButton collections={collectionOptions} base={base} perms={perms} />
          </div>

          {counts.error ? <Card className="mt-4"><ErrorBlock message={counts.error} /></Card> : (
            <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:mt-[18px] lg:gap-[10px] xl:grid-cols-6">
              {kpis.map(k => (
                <li key={k.key}>
                  <Link href={k.href} className="block h-full rounded-[10px] border border-[#e6e9f0] bg-white px-3 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:border-[#c9d8ff] lg:h-[108px] lg:px-[11px] lg:pt-[16px]">
                    <span className="flex items-center gap-2 text-[12px] text-slate-700 lg:gap-[6px] lg:text-[9.5px]">{k.icon}<span className="truncate lg:overflow-visible lg:whitespace-nowrap">{k.label}</span></span>
                    <span className="mt-2 block text-[22px] font-semibold text-slate-900 lg:mt-[12px] lg:text-[21px]">{k.value.toLocaleString('en-GB')}</span>
                    <Delta value={delta(trend(k.key).current, trend(k.key).previous)} suffix="vs last 7 days" className="mt-1 block text-[11px] lg:mt-[8px] lg:text-[9.5px]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Card className="mt-4 px-3 pb-3 pt-3 lg:mt-[20px] lg:px-[12px] lg:pb-[14px] lg:pt-[14px]">
            <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:gap-[6px]">
              <SearchInput placeholder="Search ideas…" className="w-full sm:w-auto lg:w-[110px] lg:min-w-0 lg:shrink" inputClassName="lg:text-[9.5px]" />
              <SelectFilter param="stage" label="Status" options={IDEA_STAGES.map(s => ({ value: s, label: IDEA_STAGE_LABELS[s] }))} dense />
              <SelectFilter param="source" label="Source" options={IDEA_SOURCES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))} dense />
              <SelectFilter param="score" label="Score" options={[{ value: 'high', label: '80 and above' }, { value: 'medium', label: '60 to 79' }, { value: 'low', label: 'Below 60' }]} dense />
              <SelectFilter param="owner" label="Owner" options={people.map(p => ({ value: p.id, label: p.label }))} dense />
              <SelectFilter param="tag" label="Tags" options={allTags.map(t => ({ value: t, label: t }))} dense />
              <FiltersMenu label="More filters" iconRight className="lg:h-[30px] lg:shrink-0 lg:px-[8px] lg:text-[9.5px]" fields={[
                { param: 'collection', label: 'Collection', options: collectionOptions.map(c => ({ value: c.id, label: c.name })) },
                { param: 'channel', label: 'Channel', options: [{ value: 'instagram', label: 'Instagram' }, { value: 'linkedin', label: 'LinkedIn' }, { value: 'tiktok', label: 'TikTok' }, { value: 'facebook', label: 'Facebook' }, { value: 'x', label: 'X' }] },
              ]} />
              <ViewToggle value={q.view} defaultValue="cards" className="lg:ml-[4px] lg:shrink-0 lg:border-0 lg:p-0" itemClassName="lg:h-[30px] lg:px-[6px] lg:text-[9.5px] lg:gap-[5px]"
                options={[{ id: 'cards', label: 'Cards', icon: <LayoutGrid size={12} /> }, { id: 'list', label: 'List', icon: <List size={12} /> }, { id: 'board', label: 'Board', icon: <KanbanSquare size={12} /> }]} />
              <div className="lg:ml-auto lg:shrink-0"><SortSelect value={q.sort} options={SORTS} /></div>
            </div>
            <div className="mt-3 flex items-center gap-3 lg:mt-[16px]">
              <p className="text-[12px] text-slate-600 lg:text-[9.5px]" aria-live="polite">{ideas.total.toLocaleString('en-GB')} idea{ideas.total === 1 ? '' : 's'}</p>
              <ClearFilters params={filterKeys} className="lg:text-[9.5px]" />
            </div>

            {ideas.error ? <ErrorBlock message={ideas.error} className="mx-0" /> : signed.ideas.length === 0 ? (
              <EmptyBlock search={filtered} title={filtered ? 'No ideas match these filters' : 'No ideas yet'}
                message={filtered ? 'Try a different search, or clear the filters to see every idea.' : 'Capture your first idea to start building a pipeline of content.'} />
            ) : q.view === 'list' ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse">
                  <caption className="sr-only">Ideas</caption>
                  <thead><tr className="border-y border-[#eef0f4]">
                    {['Score', 'Idea', 'Source', 'Owner', 'Created', 'Stage'].map(h => <th key={h} scope="col" className={S_TH_PLAIN}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {signed.ideas.map(idea => (
                      <tr key={idea.id} className="border-b border-[#f0f2f5] hover:bg-slate-50/60">
                        <td className={cn(S_TD, 'h-12 w-14')}><ScoreRing score={idea.score} size={28} /></td>
                        <td className={cn(S_TD, 'max-w-[320px]')}><OpenIdeaButton id={idea.id} className="block truncate text-left font-medium text-slate-800 hover:text-[#1a5cff]">{idea.title}</OpenIdeaButton></td>
                        <td className={S_TD}>{typeof idea.metadata?.source_label === 'string' ? idea.metadata.source_label : idea.source}</td>
                        <td className={S_TD}><span className="flex items-center gap-1.5"><PersonAvatar person={idea.owner} size={16} />{personName(idea.owner)}</span></td>
                        <td className={cn(S_TD, 'whitespace-nowrap')}>{fmtDate(idea.created_at)}</td>
                        <td className={cn(S_TD, 'w-[130px]')}><IdeaStageButton id={idea.id} stage={idea.stage} canEdit={capabilities.editIdeas} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : q.view === 'board' ? (
              <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                {IDEA_BOARD_STAGES.map(stage => {
                  const items = signed.ideas.filter(i => i.stage === stage)
                  return (
                    <section key={stage} aria-label={IDEA_STAGE_LABELS[stage]} className="w-[250px] shrink-0 rounded-[10px] bg-[#f6f8fb] p-2">
                      <h3 className="flex items-center gap-1.5 px-1 pb-2 text-[12px] font-semibold text-slate-700">{STAGE_STYLE[stage]?.icon}{IDEA_STAGE_LABELS[stage]}<span className="ml-auto text-slate-500">{items.length}</span></h3>
                      <div className="space-y-2">{items.length ? items.map(i => card(i, true)) : <p className="px-1 py-4 text-center text-[11px] text-slate-400">No ideas</p>}</div>
                    </section>
                  )
                })}
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:mt-[10px] lg:grid-cols-3 lg:gap-x-[16px] lg:gap-y-[14px]">
                {signed.ideas.map(idea => card(idea))}
              </div>
            )}
            {q.view !== 'board' && ideas.total > size && <Pager page={q.page} size={size} total={ideas.total} noun="ideas" className="mt-3" />}
          </Card>

          <Card className="mt-4 px-3.5 pb-4 pt-3.5 lg:mt-[16px] lg:px-[14px] lg:pb-[16px] lg:pt-[14px]" aria-labelledby="idea-pipeline-title">
            <CardHeader id="idea-pipeline-title" title="Idea pipeline" titleClassName="lg:text-[12px]" action={<TextLink href={`${base}/ideas?view=board`}>View pipeline</TextLink>} />
            <ol className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:mt-[22px] lg:grid-cols-6 lg:gap-0">
              {(['backlog', 'in_research', 'prioritised', 'ready_to_draft', 'approved', 'converted'] as IdeaStage[]).map((stage, i) => {
                const t = trend(`stage:${stage}`)
                return (
                  <li key={stage} className={cn('lg:px-[12px]', i > 0 && 'lg:border-l lg:border-dashed lg:border-[#d7dce5]')}>
                    <Link href={`${base}/ideas?stage=${stage}`} className="block rounded-md hover:bg-slate-50">
                      <span className="flex items-center gap-2 text-[12px] text-slate-700 lg:text-[10.5px]">
                        <span className={cn('flex h-5 w-5 items-center justify-center rounded-md', STAGE_STYLE[stage]?.bar)} aria-hidden>{STAGE_STYLE[stage]?.icon}</span>
                        {IDEA_STAGE_LABELS[stage]}
                      </span>
                      <span className="mt-2 flex items-center gap-2 lg:mt-[16px]">
                        <span className="text-[18px] font-semibold text-slate-900 lg:text-[16px]">{counts.byStage[stage] ?? 0}</span>
                        <Delta short value={delta(t.current, t.previous)} className="rounded-full bg-[#f3f5f8] px-1.5 text-[10px] lg:text-[8.5px]" />
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          </Card>
        </div>

        {/* ── Right rail ─────────────────────────────────────────────────── */}
        <aside className="flex min-w-0 flex-col gap-3 lg:gap-[12px]" aria-label="Featured idea and insights">
          <Card className="px-4 pb-4 pt-4 lg:px-[15px] lg:pb-[15px] lg:pt-[13px]" aria-labelledby="featured-idea-title">
            <h2 id="featured-idea-title" className="text-[14px] font-semibold text-slate-900 lg:text-[12px]">Featured idea</h2>
            {!featured ? <EmptyBlock title="No ideas to feature" message="Score your ideas and the strongest one appears here." /> : (
              <>
                <div className="mt-3 flex gap-3 lg:mt-[14px] lg:gap-[14px]">
                  <ScoreRing score={featured.score} size={58} />
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold leading-snug text-slate-900 lg:text-[14px] lg:leading-[19px]">{featured.title}</p>
                    <span className={cn('mt-1.5 inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium lg:h-[20px] lg:text-[9.5px]', STAGE_STYLE[featured.stage]?.bar)}>
                      {STAGE_STYLE[featured.stage]?.icon}{IDEA_STAGE_LABELS[featured.stage as IdeaStage] ?? featured.stage}
                    </span>
                  </div>
                </div>
                {featured.description && (<>
                  <h3 className="mt-4 text-[13px] font-semibold text-slate-900 lg:mt-[16px] lg:text-[11px]">Concept summary</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-600 lg:mt-[6px] lg:text-[10px] lg:leading-[17px]">{featured.description}</p>
                </>)}
                {(featured.why_it_works?.length ?? 0) > 0 && (<>
                  <h3 className="mt-4 text-[13px] font-semibold text-slate-900 lg:mt-[14px] lg:text-[11px]">Why it works</h3>
                  <ul className="mt-2 space-y-1.5 lg:mt-[8px] lg:space-y-[6px]">
                    {featured.why_it_works!.map(w => <li key={w} className="flex items-start gap-2 text-[12px] text-slate-600 lg:text-[9.5px]"><CheckCircle2 size={12} className="mt-px shrink-0 text-slate-400" aria-hidden />{w}</li>)}
                  </ul>
                </>)}
                {featured.next_step && (<>
                  <h3 className="mt-4 text-[13px] font-semibold text-slate-900 lg:mt-[14px] lg:text-[11px]">Suggested next step</h3>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-600 lg:mt-[6px] lg:text-[10px] lg:leading-[17px]">{featured.next_step}</p>
                </>)}
                <OpenIdeaButton id={featured.id} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-[6px] bg-[#1a5cff] text-[13px] font-medium text-white hover:bg-[#1450e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 lg:mt-[16px] lg:h-[27px] lg:text-[10px]">
                  <span className="flex-1">View full brief</span><ExternalLink size={12} className="mr-3" aria-hidden />
                </OpenIdeaButton>
              </>
            )}
          </Card>

          <Card className="px-3.5 pb-3.5 pt-3 lg:px-[13px] lg:pb-[12px] lg:pt-[12px]" aria-labelledby="next-actions-title">
            <CardHeader id="next-actions-title" title="Next actions" titleClassName="lg:text-[11px]" action={featured ? <OpenIdeaButton id={featured.id} className="text-[12px] font-medium text-[#1a5cff] hover:underline lg:text-[9px]">View all</OpenIdeaButton> : undefined} />
            {tasks.error ? <ErrorBlock message={tasks.error} className="mx-0" /> : <NextActions rows={tasks.rows} canEdit={capabilities.editIdeas} base={base} now={now} />}
          </Card>

          <Card className="px-3.5 pb-3.5 pt-3 lg:px-[13px] lg:pb-[12px] lg:pt-[12px]" aria-labelledby="idea-collections-title">
            <CardHeader id="idea-collections-title" title="Idea collections" titleClassName="lg:text-[11px]" action={<TextLink href={`${base}/ideas?view=list`} className="lg:text-[9px]">View all</TextLink>} />
            {collections.rows.length === 0 ? <p className="py-3 text-[12px] text-slate-500 lg:text-[9.5px]">Group related ideas into collections from an idea’s brief.</p> : (
              <ul className="mt-2 space-y-1.5 lg:mt-[9px] lg:space-y-[4px]">
                {collections.rows.slice(0, 3).map(c => (
                  <li key={c.id}>
                    <Link href={`${base}/ideas?collection=${c.id}`} className="flex items-center gap-2 rounded py-0.5 text-[12px] text-slate-700 hover:text-[#1a5cff] lg:text-[9.5px]">
                      <span className={cn('h-2 w-2 rounded-full', COLLECTION_DOT[c.colour] ?? 'bg-slate-400')} aria-hidden />{c.name}
                      <span className="ml-auto text-slate-500">{c.idea_count ?? 0}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="px-3.5 pb-3.5 pt-3 lg:px-[13px] lg:pb-[12px] lg:pt-[12px]" aria-labelledby="trend-signals-title">
            <CardHeader id="trend-signals-title" title="Trend signals" titleClassName="lg:text-[11px]" action={modules.includes('hashtags') ? <TextLink href={`${base}/hashtags`} className="lg:text-[9px]">View all</TextLink> : undefined} />
            {signals.rows.length === 0 ? <p className="py-3 text-[12px] text-slate-500 lg:text-[9.5px]">Keyword clusters with growth data appear here.</p> : (
              <ul className="mt-2 space-y-1.5 lg:mt-[9px] lg:space-y-[4px]">
                {signals.rows.map(s => (
                  <li key={s.id} className="flex items-center gap-2 text-[12px] text-slate-700 lg:text-[9.5px]">
                    <ChevronRight size={9} className="text-slate-400" aria-hidden />
                    <Link href={`${base}/hashtags?selected=${s.id}`} className="truncate hover:text-[#1a5cff]">{s.name}</Link>
                    <span className={cn('ml-auto font-medium', s.growth >= 0 ? 'text-[#16a34a]' : 'text-[#e5484d]')}>{s.growth >= 0 ? '↑' : '↓'} {Math.abs(Math.round(s.growth))}%</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="px-3.5 pb-3.5 pt-3 lg:px-[13px] lg:pb-[12px] lg:pt-[12px]" aria-labelledby="idea-activity-title">
            <CardHeader id="idea-activity-title" title="Recent activity" titleClassName="lg:text-[11px]" />
            {signed.activity.length === 0 ? <p className="py-3 text-[12px] text-slate-500 lg:text-[9.5px]">Idea activity will appear here.</p> : (
              <ul className="mt-2 space-y-2.5 lg:mt-[12px] lg:space-y-[14px]">
                {signed.activity.map(a => (
                  <li key={a.id} className="flex items-center gap-2 lg:gap-[9px]">
                    <PersonAvatar person={a.actor} size={22} />
                    {a.link ? (
                      <Link href={a.link} className="min-w-0 flex-1 truncate text-[12px] text-slate-600 hover:text-slate-900 lg:text-[9.5px]"><span className="font-semibold text-slate-800">{personName(a.actor)}</span> {a.summary}</Link>
                    ) : <span className="min-w-0 flex-1 truncate text-[12px] text-slate-600 lg:text-[9.5px]"><span className="font-semibold text-slate-800">{personName(a.actor)}</span> {a.summary}</span>}
                    <time className="shrink-0 text-[11px] text-slate-500 lg:text-[9px]" dateTime={a.created_at}>{fmtAgo(a.created_at, now)}</time>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>

      <IdeaDialogs selected={signed.selected} tasks={selectedTasks.rows} collections={collectionOptions} base={base} perms={perms} />
    </>
  )
}
