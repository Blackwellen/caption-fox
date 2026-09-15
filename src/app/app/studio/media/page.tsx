import { requireStudioModule } from '@/lib/studio/server'
import { mediaCounts, listMedia, listMediaCollections, getMediaAsset, listWorkspacePeople } from '@/lib/studio/data'
import { parseStudioQuery, hasAnyFilter, type RawParams } from '@/lib/studio/query'
import { MEDIA_STATUSES, MEDIA_STATUS_LABELS, MEDIA_TYPES } from '@/lib/studio/constants'
import StudioHeader from '@/components/studio/StudioHeader'
import KpiStrip from '@/components/studio/KpiStrip'
import Pagination from '@/components/studio/Pagination'
import { AccessBlocked, StudioEmpty, LoadError } from '@/components/studio/states'
import { STUDIO_PAGE } from '@/components/studio/primitives'
import { StudioToolbar, FilterSelect, ClearFiltersButton } from '@/components/studio/Toolbar'
import MediaGrid from './MediaGrid'
import MediaDetail from './MediaDetail'
import UploadButton from './UploadButton'
import type { KpiValue } from '@/lib/studio/types'

export const metadata = { title: 'Media · Studio · Caption Fox' }

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 GB'
  const gb = bytes / 1024 ** 3
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${(bytes / 1024 ** 2).toFixed(0)} MB`
}

export default async function MediaPage({
  searchParams,
}: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, limits, modules, access } = await requireStudioModule('media')

  if (!access.allowed) {
    return (
      <div className={STUDIO_PAGE}>
        <StudioHeader module="media" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const q = parseStudioQuery(params, { views: ['grid', 'list', 'table'], defaultView: 'grid' })

  const [counts, page, collections, owners] = await Promise.all([
    mediaCounts(supabase, ctx.workspaceId),
    listMedia(supabase, ctx.workspaceId, q),
    listMediaCollections(supabase, ctx.workspaceId),
    listWorkspacePeople(supabase, ctx.workspaceId),
  ])

  const selectedId = q.selected || page.rows[0]?.id || ''
  const detail = selectedId ? await getMediaAsset(supabase, ctx.workspaceId, selectedId) : null

  const kpis: KpiValue[] = [
    { id: 'total', label: 'Total assets', value: String(counts.total), tone: 'violet', icon: 'image' },
    { id: 'new', label: 'New uploads', value: String(counts.newUploads), tone: 'blue', icon: 'file' },
    { id: 'ready', label: 'Ready to use', value: String(counts.ready), tone: 'green', icon: 'check' },
    { id: 'review', label: 'Needs review', value: String(counts.needsReview), tone: 'amber', icon: 'eye' },
    {
      id: 'storage', label: 'Storage used',
      value: limits.storageBytes > 0 ? `${Math.round((counts.storageBytes / limits.storageBytes) * 100)}%` : formatBytes(counts.storageBytes),
      hint: `${formatBytes(counts.storageBytes)} of ${formatBytes(limits.storageBytes)}`,
      tone: 'blue', icon: 'drive',
    },
    { id: 'linked', label: 'Linked assets', value: String(counts.linked), tone: 'slate', icon: 'link' },
  ]

  return (
    <div className={STUDIO_PAGE}>
      <StudioHeader
        module="media"
        modules={modules}
        actions={capabilities.uploadMedia ? <UploadButton workspaceId={ctx.workspaceId} storageUsed={counts.storageBytes} storageLimit={limits.storageBytes} /> : undefined}
      />

      {counts.error ? <LoadError message={counts.error} className="mb-4" /> : <KpiStrip items={kpis} className="mb-4" />}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StudioToolbar placeholder="Search media by name or description…" views={['grid', 'list', 'table']}>
              <FilterSelect param="type" label="Type" options={MEDIA_TYPES.map(t => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))} />
              <FilterSelect param="status" label="Status" options={MEDIA_STATUSES.map(s => ({ value: s, label: MEDIA_STATUS_LABELS[s] }))} />
              <FilterSelect param="collection" label="Collection" options={collections.rows.map(c => ({ value: c.id, label: c.name }))} />
              <FilterSelect param="owner" label="Owner" options={owners.map(o => ({ value: o.id, label: o.label }))} />
              <ClearFiltersButton hasFilters={hasAnyFilter(q)} />
            </StudioToolbar>
          </div>

          {page.error ? (
            <LoadError message={page.error} />
          ) : page.rows.length === 0 ? (
            <StudioEmpty
              icon="search"
              title={hasAnyFilter(q) ? 'No assets match these filters' : 'No media uploaded yet'}
              message={hasAnyFilter(q) ? 'Try clearing filters or searching a different term.' : 'Upload images, video or documents to build your media library.'}
            />
          ) : (
            <>
              <MediaGrid rows={page.rows} view={q.view} selectedId={selectedId} capabilities={capabilities} />
              <div className="mt-4">
                <Pagination page={q.page} size={q.size} total={page.total} />
              </div>
            </>
          )}
        </div>

        <MediaDetail detail={detail} capabilities={capabilities} collections={collections.rows} />
      </div>
    </div>
  )
}
