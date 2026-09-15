import { requireStudioModule } from '@/lib/studio/server'
import {
  keywordCounts, listKeywordSets, getKeywordSet, listBlockedTerms, keywordRecommendations,
} from '@/lib/studio/data'
import { parseStudioQuery, hasAnyFilter, type RawParams } from '@/lib/studio/query'
import { KEYWORD_KINDS, KEYWORD_KIND_LABELS, CHANNEL_LABELS, STUDIO_CHANNELS } from '@/lib/studio/constants'
import StudioHeader from '@/components/studio/StudioHeader'
import KpiStrip from '@/components/studio/KpiStrip'
import Pagination from '@/components/studio/Pagination'
import { AccessBlocked, StudioEmpty, LoadError } from '@/components/studio/states'
import { STUDIO_PAGE } from '@/components/studio/primitives'
import { StudioToolbar, FilterSelect, ClearFiltersButton } from '@/components/studio/Toolbar'
import KeywordList from './KeywordList'
import KeywordDetail from './KeywordDetail'
import NewKeywordSetButton from './NewKeywordSetButton'
import type { KpiValue } from '@/lib/studio/types'

export const metadata = { title: 'Hashtags & Keywords · Studio · Caption Fox' }

export default async function HashtagsPage({
  searchParams,
}: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireStudioModule('hashtags')

  if (!access.allowed) {
    return (
      <div className={STUDIO_PAGE}>
        <StudioHeader module="hashtags" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const q = parseStudioQuery(params, { views: ['cards', 'table'], defaultView: 'cards', defaultSort: 'score_desc' })

  const [counts, page, blocked, recommendations] = await Promise.all([
    keywordCounts(supabase, ctx.workspaceId),
    listKeywordSets(supabase, ctx.workspaceId, q),
    listBlockedTerms(supabase, ctx.workspaceId),
    keywordRecommendations(supabase, ctx.workspaceId),
  ])

  const selectedId = q.selected || page.rows[0]?.id || ''
  const detail = selectedId ? await getKeywordSet(supabase, ctx.workspaceId, selectedId) : null

  const kpis: KpiValue[] = [
    { id: 'clusters', label: 'Active keyword sets', value: String(counts.activeClusters), tone: 'blue', icon: 'sparkles' },
    { id: 'hashtags', label: 'Recommended hashtags', value: String(counts.recommendedHashtags), tone: 'violet', icon: 'hash' },
    { id: 'trending', label: 'Trending terms', value: String(counts.trendingTerms), tone: 'green', icon: 'trend' },
    { id: 'saved', label: 'Saved groups', value: String(counts.savedGroups), tone: 'slate', icon: 'bookmark' },
    { id: 'lift', label: 'Performance lift', value: counts.avgGrowth !== null ? `${counts.avgGrowth > 0 ? '+' : ''}${counts.avgGrowth}%` : '—', tone: counts.avgGrowth && counts.avgGrowth > 0 ? 'green' : 'slate', icon: 'percent' },
    { id: 'blocked', label: 'Blocked terms', value: String(counts.blockedTerms), tone: 'red', icon: 'ban' },
  ]

  return (
    <div className={STUDIO_PAGE}>
      <StudioHeader
        module="hashtags"
        modules={modules}
        actions={capabilities.createHashtags ? <NewKeywordSetButton /> : undefined}
      />

      {counts.error ? <LoadError message={counts.error} className="mb-4" /> : <KpiStrip items={kpis} className="mb-4" />}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StudioToolbar placeholder="Search clusters, sets or terms…" views={['cards', 'table']}>
              <FilterSelect param="kind" label="Type" options={KEYWORD_KINDS.map(k => ({ value: k, label: KEYWORD_KIND_LABELS[k] }))} />
              <FilterSelect param="channel" label="Platform" options={STUDIO_CHANNELS.map(c => ({ value: c, label: CHANNEL_LABELS[c] }))} />
              <ClearFiltersButton hasFilters={hasAnyFilter(q)} />
            </StudioToolbar>
          </div>

          {page.error ? (
            <LoadError message={page.error} />
          ) : page.rows.length === 0 ? (
            <StudioEmpty
              icon="search"
              title={hasAnyFilter(q) ? 'No groups match these filters' : 'No keyword clusters or hashtag sets yet'}
              message={hasAnyFilter(q) ? 'Try clearing filters or searching a different term.' : 'Create a cluster or hashtag set to start tracking performance.'}
            />
          ) : (
            <>
              <KeywordList rows={page.rows} view={q.view} selectedId={selectedId} capabilities={capabilities} />
              <div className="mt-4">
                <Pagination page={q.page} size={q.size} total={page.total} />
              </div>
            </>
          )}
        </div>

        <div className="space-y-4">
          <KeywordDetail
            detail={detail}
            recommendations={recommendations}
            blocked={blocked.rows}
            capabilities={capabilities}
          />
        </div>
      </div>
    </div>
  )
}
