import Link from 'next/link'
import { requireStudioModule } from '@/lib/studio/server'
import { contentCounts, listContent, listWorkspacePeople, listWorkspaceCampaigns } from '@/lib/studio/data'
import { parseStudioQuery, hasAnyFilter, type RawParams } from '@/lib/studio/query'
import { CONTENT_STATUSES, CONTENT_STATUS_LABELS, CHANNEL_LABELS, STUDIO_CHANNELS } from '@/lib/studio/constants'
import StudioHeader from '@/components/studio/StudioHeader'
import KpiStrip from '@/components/studio/KpiStrip'
import Pagination from '@/components/studio/Pagination'
import { AccessBlocked, StudioEmpty, LoadError } from '@/components/studio/states'
import { STUDIO_PAGE } from '@/components/studio/primitives'
import { StudioToolbar, FilterSelect, ClearFiltersButton } from '@/components/studio/Toolbar'
import ContentGrid from './ContentGrid'
import type { KpiValue } from '@/lib/studio/types'

export const metadata = { title: 'Content Library · Studio · Caption Fox' }

export default async function ContentLibraryPage({
  searchParams,
}: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireStudioModule('content')

  if (!access.allowed) {
    return (
      <div className={STUDIO_PAGE}>
        <StudioHeader module="content" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const q = parseStudioQuery(params, { views: ['cards', 'table'], defaultView: 'cards' })

  const [counts, page, owners, campaigns] = await Promise.all([
    contentCounts(supabase, ctx.workspaceId),
    listContent(supabase, ctx.workspaceId, q),
    listWorkspacePeople(supabase, ctx.workspaceId),
    listWorkspaceCampaigns(supabase, ctx.workspaceId),
  ])

  const kpis: KpiValue[] = [
    { id: 'total', label: 'Total Content', value: String(counts.total), tone: 'blue', icon: 'layers' },
    { id: 'drafts', label: 'Drafts', value: String(counts.draft), tone: 'violet', icon: 'file' },
    { id: 'review', label: 'In Review', value: String(counts.pending_approval), tone: 'amber', icon: 'eye' },
    { id: 'scheduled', label: 'Scheduled', value: String(counts.scheduled), tone: 'blue', icon: 'calendar' },
    { id: 'published', label: 'Published', value: String(counts.published), tone: 'green', icon: 'send' },
    { id: 'assets', label: 'Reusable Assets', value: String(counts.linkedAssets), tone: 'slate', icon: 'link' },
  ]

  return (
    <div className={STUDIO_PAGE}>
      <StudioHeader
        module="content"
        modules={modules}
        actions={
          capabilities.createContent
            ? <Link href="/app/studio/compose" className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700">New Content</Link>
            : undefined
        }
      />

      {counts.error ? <LoadError message={counts.error} className="mb-4" /> : <KpiStrip items={kpis} className="mb-4" />}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StudioToolbar placeholder="Search content by title or caption…" views={['cards', 'table']}>
          <FilterSelect param="status" label="Status" options={CONTENT_STATUSES.map(s => ({ value: s, label: CONTENT_STATUS_LABELS[s] }))} />
          <FilterSelect param="channel" label="Channel" options={STUDIO_CHANNELS.map(c => ({ value: c, label: CHANNEL_LABELS[c] }))} />
          <FilterSelect param="owner" label="Owner" options={owners.map(o => ({ value: o.id, label: o.label }))} />
          <FilterSelect param="campaign" label="Campaign" options={campaigns.map(c => ({ value: c.id, label: c.name }))} />
          <ClearFiltersButton hasFilters={hasAnyFilter(q)} />
        </StudioToolbar>
      </div>

      {page.error ? (
        <LoadError message={page.error} />
      ) : page.rows.length === 0 ? (
        <StudioEmpty
          icon="search"
          title={hasAnyFilter(q) ? 'No content matches these filters' : 'No content yet'}
          message={hasAnyFilter(q) ? 'Try clearing filters or searching a different term.' : 'Compose your first post to build your content library.'}
          action={!hasAnyFilter(q) && capabilities.createContent
            ? <Link href="/app/studio/compose" className="text-sm font-medium text-blue-600 hover:text-blue-700">Open Compose →</Link>
            : undefined}
        />
      ) : (
        <>
          <ContentGrid rows={page.rows} view={q.view} capabilities={capabilities} />
          <div className="mt-4">
            <Pagination page={q.page} size={q.size} total={page.total} />
          </div>
        </>
      )}
    </div>
  )
}
