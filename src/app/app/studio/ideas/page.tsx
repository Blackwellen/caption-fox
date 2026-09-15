import Link from 'next/link'
import { requireStudioModule } from '@/lib/studio/server'
import { ideaCounts, listIdeas, listIdeaCollections, listStudioActivity } from '@/lib/studio/data'
import { parseStudioQuery, hasAnyFilter, type RawParams } from '@/lib/studio/query'
import { IDEA_STAGES, IDEA_STAGE_LABELS, IDEA_SOURCES } from '@/lib/studio/constants'
import StudioHeader from '@/components/studio/StudioHeader'
import KpiStrip from '@/components/studio/KpiStrip'
import Pagination from '@/components/studio/Pagination'
import { AccessBlocked, StudioEmpty, LoadError } from '@/components/studio/states'
import { STUDIO_PAGE, Panel, formatShortDate } from '@/components/studio/primitives'
import { collectionDotClass } from '@/components/studio/colour'
import { StudioToolbar, FilterSelect, ClearFiltersButton } from '@/components/studio/Toolbar'
import IdeaGrid from './IdeaGrid'
import NewIdeaButton from './NewIdeaButton'
import type { KpiValue } from '@/lib/studio/types'

export const metadata = { title: 'Ideas · Studio · Caption Fox' }

export default async function IdeasPage({
  searchParams,
}: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireStudioModule('ideas')

  if (!access.allowed) {
    return (
      <div className={STUDIO_PAGE}>
        <StudioHeader module="ideas" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const q = parseStudioQuery(params, { views: ['cards', 'list', 'board'], defaultView: 'cards', defaultSort: 'score_desc' })

  const [counts, page, collections, activity] = await Promise.all([
    ideaCounts(supabase, ctx.workspaceId),
    q.view === 'board'
      ? listIdeas(supabase, ctx.workspaceId, q, { paginate: false, limit: 500 })
      : listIdeas(supabase, ctx.workspaceId, q),
    listIdeaCollections(supabase, ctx.workspaceId),
    listStudioActivity(supabase, ctx.workspaceId, 6),
  ])

  const featured = page.rows.find(r => r.featured) ?? page.rows[0] ?? null

  const kpis: KpiValue[] = [
    { id: 'new', label: 'New ideas', value: String(counts.newLast7), tone: 'blue', icon: 'lightbulb' },
    { id: 'prioritised', label: 'Prioritised', value: String(counts.byStage.prioritised ?? 0), tone: 'amber', icon: 'sparkles' },
    { id: 'ready', label: 'Ready to draft', value: String(counts.byStage.ready_to_draft ?? 0), tone: 'blue', icon: 'file' },
    { id: 'research', label: 'In research', value: String(counts.byStage.in_research ?? 0), tone: 'violet', icon: 'eye' },
    { id: 'saved', label: 'Saved inspirations', value: String(counts.savedInspirations), tone: 'slate', icon: 'bookmark' },
    { id: 'converted', label: 'Converted to content', value: String(counts.converted), tone: 'green', icon: 'check' },
  ]

  return (
    <div className={STUDIO_PAGE}>
      <StudioHeader
        module="ideas"
        modules={modules}
        actions={capabilities.createIdeas ? <NewIdeaButton collections={collections.rows} /> : undefined}
      />

      {counts.error ? <LoadError message={counts.error} className="mb-4" /> : <KpiStrip items={kpis} className="mb-4" />}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StudioToolbar placeholder="Search ideas…" views={['cards', 'list', 'board']}>
              <FilterSelect param="stage" label="Status" options={IDEA_STAGES.map(s => ({ value: s, label: IDEA_STAGE_LABELS[s] }))} />
              <FilterSelect param="source" label="Source" options={IDEA_SOURCES.map(s => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} />
              <FilterSelect param="collection" label="Collection" options={collections.rows.map(c => ({ value: c.id, label: c.name }))} />
              <ClearFiltersButton hasFilters={hasAnyFilter(q)} />
            </StudioToolbar>
          </div>

          {page.error ? (
            <LoadError message={page.error} />
          ) : page.rows.length === 0 ? (
            <StudioEmpty
              icon="search"
              title={hasAnyFilter(q) ? 'No ideas match these filters' : 'No ideas yet'}
              message={hasAnyFilter(q) ? 'Try clearing filters or searching a different term.' : 'Capture your first idea to start building a content pipeline.'}
            />
          ) : (
            <>
              <IdeaGrid rows={page.rows} view={q.view} capabilities={capabilities} />
              {q.view !== 'board' && (
                <div className="mt-4">
                  <Pagination page={q.page} size={q.size} total={page.total} />
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-4">
          <Panel title="Featured idea">
            {featured ? (
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-emerald-400 text-xs font-bold text-emerald-600">
                    {featured.score ?? '—'}
                  </span>
                  <p className="text-sm font-semibold text-slate-900">{featured.title}</p>
                </div>
                {featured.description && <p className="mt-2 text-[13px] text-slate-500">{featured.description}</p>}
                {featured.why_it_works && featured.why_it_works.length > 0 && (
                  <ul className="mt-3 space-y-1 text-[13px] text-slate-600">
                    {featured.why_it_works.map((reason, i) => <li key={i}>• {reason}</li>)}
                  </ul>
                )}
                {featured.next_step && (
                  <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-500">
                    <span className="font-medium text-slate-700">Suggested next step: </span>{featured.next_step}
                  </p>
                )}
                <Link
                  href={`/app/studio/ideas?selected=${featured.id}`}
                  className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700"
                >
                  View full brief
                </Link>
              </div>
            ) : (
              <StudioEmpty bare title="No featured idea" message="Ideas with a high score will appear here." />
            )}
          </Panel>

          <Panel title="Idea collections" viewAllHref="/app/studio/ideas">
            {collections.rows.length === 0 ? (
              <p className="py-3 text-center text-[13px] text-slate-400">No collections yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {collections.rows.map(c => (
                  <li key={c.id}>
                    <Link href={`/app/studio/ideas?collection=${c.id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[13px] hover:bg-slate-50">
                      <span className="flex items-center gap-2 text-slate-700">
                        <span className={`h-2 w-2 rounded-full ${collectionDotClass(c.colour)}`} />
                        {c.name}
                      </span>
                      <span className="text-slate-400">{c.idea_count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Recent activity">
            {activity.rows.length === 0 ? (
              <p className="py-3 text-center text-[13px] text-slate-400">No activity yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {activity.rows.filter(a => a.entity_type === 'idea').map(item => (
                  <li key={item.id} className="text-[13px]">
                    <Link href={item.link ?? '#'} className="text-slate-700 hover:text-blue-600">{item.summary}</Link>
                    <span className="block text-[11px] text-slate-400">{formatShortDate(item.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
