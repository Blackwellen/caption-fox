import Link from 'next/link'
import { AlertCircle, CheckCircle2, ChevronDown, FolderSync, HardDrive, Images, LayoutGrid, Link2, List, Settings, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { requireStudioModule } from '@/lib/studio/server'
import {
  getMediaAsset, listMedia, listMediaCollections, listStudioActivity, listWorkspacePeople, mediaCounts,
} from '@/lib/studio/data'
import { MEDIA_STATUSES, MEDIA_TYPES } from '@/lib/studio/constants'
import { parseStudioQuery, type RawParams } from '@/lib/studio/query'
import { signStudioMedia } from '@/lib/studio/sign'
import type { MediaRow } from '@/lib/studio/types'
import StudioPageHeader from '../StudioPageHeader'
import { AccessBlocked } from '../states'
import { ClearFilters, Pager, SearchInput, SelectFilter, ViewToggle } from '../controls'
import { SortSelect } from '../ideas/IdeaClient'
import {
  AssetDetail, AssetPickerRail, AssetsTable, MediaCard, NewCollectionButton, PageSizeSelect, UploadRail,
  type MediaPerms,
} from '../media/MediaClient'
import { statusLabel } from '../media/media-kind'
import { MenuLink } from '../MenuLink'
import { Card, CardHeader, Delta, EmptyBlock, ErrorBlock, PersonAvatar, S_CARD, btnClass, delta, fmtAgo, fmtBytes, personName } from '../ui'

const SORTS = [
  { id: 'created_desc', label: 'Newest first' }, { id: 'created_asc', label: 'Oldest first' }, { id: 'title_asc', label: 'Name (A–Z)' },
  { id: 'size_desc', label: 'Largest first' }, { id: 'updated_desc', label: 'Recently updated' },
]

/** Strip storage paths before rows cross to the client; only signed URLs are sent. */
const forClient = (rows: MediaRow[]) => rows.map(({ file_path: _path, ...rest }) => ({ ...rest, file_path: '' }))

export default async function MediaPage({ searchParams }: { searchParams: RawParams }) {
  const { supabase, ctx, capabilities, modules, access, base, limits } = await requireStudioModule('media')
  if (!access.allowed) {
    return (
      <>
        <StudioPageHeader layout="stacked" base={base} modules={modules} title="Media" />
        <AccessBlocked access={access} />
      </>
    )
  }

  const q = parseStudioQuery(searchParams, { views: ['grid', 'list'], defaultView: 'grid', defaultSort: 'created_desc', defaultSize: 10 })
  const [counts, grid, table, collections, people, activity, picker] = await Promise.all([
    mediaCounts(supabase, ctx.workspaceId),
    listMedia(supabase, ctx.workspaceId, { ...q, page: 1, size: 8 }),
    listMedia(supabase, ctx.workspaceId, q),
    listMediaCollections(supabase, ctx.workspaceId),
    listWorkspacePeople(supabase, ctx.workspaceId),
    listStudioActivity(supabase, ctx.workspaceId, 4, 'asset'),
    listMedia(supabase, ctx.workspaceId, { ...q, q: '', status: 'ready', type: '', collection: '', owner: '', tag: '', from: '', to: '', archived: false, sort: 'updated_desc', page: 1, size: 24 }),
  ])

  const closed = searchParams.selected === 'none'
  const selectedId = closed ? null : q.selected || grid.rows[0]?.id || null
  const [detail, history] = selectedId
    ? await Promise.all([getMediaAsset(supabase, ctx.workspaceId, selectedId), listStudioActivity(supabase, ctx.workspaceId, 20, 'asset', selectedId)])
    : [{ row: null, versions: [], error: null }, { rows: [], error: null }]

  const signed = await signStudioMedia(ctx.workspaceId, {
    grid: forClient(grid.rows), table: forClient(table.rows), picker: forClient(picker.rows),
    detail: detail.row ? forClient([detail.row])[0]! : null, versions: detail.versions, activity: activity.rows, history: history.rows,
  })

  // Server render time anchors relative dates for this request.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const perms: MediaPerms = { upload: capabilities.uploadMedia, edit: capabilities.editMedia, approve: capabilities.approveMedia, remove: capabilities.deleteMedia }
  const collectionOptions = collections.rows.map(c => ({ id: c.id, name: c.name }))
  const tags = [...new Set(signed.table.flatMap(r => r.tags ?? []))].sort().slice(0, 40)
  const filterKeys = ['q', 'type', 'collection', 'status', 'tag', 'owner']
  const filtered = filterKeys.some(k => searchParams[k])
  const pct = (n: number) => (counts.total ? `${Math.round((n / counts.total) * 1000) / 10}% of total` : '0% of total')
  const quota = limits.storageBytes
  const usedPct = quota > 0 ? Math.min(100, Math.round((counts.storageBytes / quota) * 100)) : 0
  const collectionHref = (id: string | null) => {
    const next = new URLSearchParams(Object.entries(searchParams).filter(([k, v]) => typeof v === 'string' && k !== 'page' && k !== 'selected') as [string, string][])
    if (id) next.set('collection', id); else next.delete('collection')
    const qs = next.toString()
    return `${base}/media${qs ? `?${qs}` : ''}`
  }
  const allCount = collections.rows.reduce((s, c) => s + c.asset_count, 0)
  const chips = collections.rows.slice(0, 5)
  const moreChips = collections.rows.slice(5)
  const selected = signed.detail

  const kpis = [
    { key: 'total', label: 'Total assets', value: counts.total.toLocaleString('en-GB'), icon: <Images size={15} />, tile: 'bg-[#f1ebff] text-[#7c3aed]', foot: <Delta value={delta(counts.total, counts.totalPrev)} suffix="vs last month" className="text-[11px] lg:text-[8.5px]" />, href: `${base}/media` },
    { key: 'new', label: 'New uploads', value: counts.newUploads.toLocaleString('en-GB'), icon: <FolderSync size={15} />, tile: 'bg-[#e9f0ff] text-[#1a5cff]', foot: <Delta value={delta(counts.newUploads, counts.newUploadsPrev)} suffix="vs last month" className="text-[11px] lg:text-[8.5px]" />, href: `${base}/media?sort=created_desc` },
    { key: 'ready', label: 'Ready to use', value: counts.ready.toLocaleString('en-GB'), icon: <CheckCircle2 size={15} />, tile: 'bg-[#e8f7ee] text-[#16a34a]', foot: <span className="text-slate-500">{pct(counts.ready)}</span>, href: `${base}/media?status=ready` },
    { key: 'review', label: 'Needs review', value: counts.needsReview.toLocaleString('en-GB'), icon: <AlertCircle size={15} />, tile: 'bg-[#fff1e6] text-[#f97316]', foot: <span className="text-slate-500">{pct(counts.needsReview)}</span>, href: `${base}/media?status=needs_review` },
    { key: 'storage', label: 'Storage used', value: fmtBytes(counts.storageBytes), icon: <HardDrive size={15} />, tile: 'bg-[#e9f0ff] text-[#1a5cff]', foot: <span className="text-slate-500">{quota > 0 ? `${usedPct}% of ${fmtBytes(quota)}` : 'No storage limit'}</span>, href: '/app/settings/billing' },
    { key: 'linked', label: 'Linked assets', value: counts.linked.toLocaleString('en-GB'), icon: <Link2 size={15} />, tile: 'bg-[#e9f0ff] text-[#1a5cff]', foot: <Delta value={delta(counts.linked, counts.linkedPrev)} suffix="vs last month" className="text-[11px] lg:text-[8.5px]" />, href: `${base}/content` },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 lg:gap-[14px] xl:grid-cols-[minmax(0,1fr)_188px]">
      <div className="min-w-0">
        <StudioPageHeader layout="stacked" base={base} modules={modules} title="Media" titleClassName="lg:text-[23px]"
          description="Centralised hub for all your media assets and files." className="lg:mb-[10px]" />

        {counts.error ? <Card><ErrorBlock message={counts.error} /></Card> : (
          <ul className={cn(S_CARD, 'grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6')}>
            {kpis.map((k, i) => (
              <li key={k.key} className={cn('border-[#eef0f4] p-0', i > 0 && 'xl:border-l')}>
                <Link href={k.href} className="flex h-full gap-3 px-3.5 py-3 hover:bg-slate-50/70 lg:h-[82px] lg:gap-[12px] lg:px-[12px] lg:pt-[16px]">
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] lg:h-[26px] lg:w-[26px]', k.tile)} aria-hidden>{k.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] text-slate-600 lg:text-[9px]">{k.label}</span>
                    <span className="mt-0.5 block text-[19px] font-semibold text-slate-900 lg:mt-[3px] lg:text-[16px]">{k.value}</span>
                    <span className="mt-0.5 block break-words text-[11px] lg:text-[8.5px]">{k.foot}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <nav aria-label="Collections" className={cn(S_CARD, 'mt-3 flex items-stretch overflow-x-auto bg-[#f7f9fc] lg:mt-[12px] lg:h-[36px] lg:overflow-visible')}>
          {[{ id: null as string | null, name: 'All collections', count: allCount || counts.total }, ...chips.map(c => ({ id: c.id, name: c.name, count: c.asset_count }))].map((c, i) => {
            const active = (q.collection || null) === c.id
            return (
              <Link key={c.id ?? 'all'} href={collectionHref(c.id)} aria-current={active ? 'page' : undefined}
                className={cn('flex shrink-0 items-center justify-center gap-2 whitespace-nowrap px-3 text-[12px] lg:flex-1 lg:text-[10px]', i > 0 && 'border-l border-[#e6e9f0]',
                  active ? 'm-[2px] rounded-[6px] border border-[#c9d8ff] bg-[#eef3ff] font-medium text-[#1a5cff]' : 'text-slate-700 hover:bg-white')}>
                {c.name}<span className={cn('rounded-full px-1.5 text-[11px] lg:text-[8.5px]', active ? 'bg-white text-[#1a5cff]' : 'bg-[#eceff4] text-slate-600')}>{c.count.toLocaleString('en-GB')}</span>
              </Link>
            )
          })}
          <div className="flex shrink-0 items-center border-l border-[#e6e9f0]">
            {moreChips.length > 0 && (
              <MenuLink variant="ghost" label="More collections" icon={<span className="flex items-center gap-1 px-2 text-[12px] text-slate-700 lg:text-[10px]">More <ChevronDown size={11} aria-hidden /></span>} items={moreChips.map(c => ({ label: `${c.name} (${c.asset_count})`, href: collectionHref(c.id) }))} />
            )}
            <NewCollectionButton perms={perms} />
          </div>
        </nav>

        <div className="mt-3 flex flex-wrap items-center gap-2 lg:mt-[12px] lg:flex-nowrap lg:gap-[8px]">
          <SearchInput placeholder="Search media by name, tag or description…" className="w-full sm:w-auto lg:w-[246px] lg:shrink-0" inputClassName="lg:h-[32px] lg:text-[9.5px]" />
          <SelectFilter param="type" label="Type" dense className="lg:h-[32px]" options={MEDIA_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))} />
          <SelectFilter param="collection" label="Collection" dense className="lg:h-[32px]" options={collectionOptions.map(c => ({ value: c.id, label: c.name }))} />
          <SelectFilter param="status" label="Status" dense className="lg:h-[32px]" options={MEDIA_STATUSES.filter(s => s !== 'archived').map(s => ({ value: s, label: statusLabel(s) }))} />
          <SelectFilter param="tag" label="Tag" dense className="lg:h-[32px]" options={tags.map(t => ({ value: t, label: t }))} />
          <SelectFilter param="owner" label="Owner" dense className="lg:h-[32px]" options={people.map(p => ({ value: p.id, label: p.label }))} />
          <ClearFilters params={filterKeys} label="Clear filters" className="lg:text-[10px]" />
          <ViewToggle value={q.view} defaultValue="grid" iconOnly className="lg:ml-auto lg:h-[32px]" itemClassName="lg:h-[26px] lg:w-[30px] lg:justify-center"
            options={[{ id: 'grid', label: 'Grid', icon: <LayoutGrid size={13} /> }, { id: 'list', label: 'List', icon: <List size={13} /> }]} />
          <SortSelect value={q.sort} options={SORTS} />
        </div>

        {grid.error || table.error ? <Card className="mt-3"><ErrorBlock message={grid.error ?? table.error ?? ''} /></Card> : table.total === 0 ? (
          <Card className="mt-3">
            <EmptyBlock search={filtered} title={filtered ? 'No media matches these filters' : 'No media yet'}
              message={filtered ? 'Clear the filters to see every asset.' : 'Upload images, video and documents to use them across Studio.'} />
          </Card>
        ) : (
          <>
            {/* Desktop composition from the design: the detail panel sits beside the
                asset grid and overlaps the top of the table by exactly the table's
                title bar (46px), so no column header or row is ever covered. The
                overlap only applies when the grid is full (two rows, 284px). */}
            <div className={cn('mt-3 grid grid-cols-1 gap-3 lg:mt-[10px] lg:gap-x-[12px] lg:gap-y-0',
              q.view === 'grid' && selected && 'lg:grid-cols-[minmax(0,582fr)_minmax(0,432fr)]')}>
              {q.view === 'grid' && (
                <ul className={cn('grid grid-cols-2 content-start gap-2.5 sm:grid-cols-4 lg:col-start-1 lg:row-start-1 lg:gap-[10px]', !selected && 'lg:grid-cols-6')} aria-label="Assets">
                  {signed.grid.map(a => <li key={a.id}><MediaCard asset={a} selected={a.id === selected?.id} perms={perms} /></li>)}
                </ul>
              )}
              {q.view === 'grid' && selected && (
                <Card className="relative z-10 min-w-0 self-start shadow-[0_8px_24px_rgba(16,24,40,0.10)] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-[428px]">
                  <AssetDetail key={selected.id} asset={selected} versions={signed.versions} history={signed.history} collections={collectionOptions} perms={perms} now={now} />
                </Card>
              )}
              {q.view === 'grid' && !selected && detail.error && <ErrorBlock message={detail.error} />}

              <Card className={cn('min-w-0 overflow-hidden lg:col-span-2 lg:col-start-1 lg:row-start-2',
                q.view === 'grid' && selected && signed.grid.length > 4 ? 'lg:mt-[86px]' : q.view === 'grid' && selected ? 'lg:mt-[12px] lg:col-span-1' : 'lg:mt-[12px]')}
                aria-labelledby="all-assets-title">
                <h2 id="all-assets-title" className="flex items-center px-3.5 pb-2 pt-3 text-[14px] font-semibold text-slate-900 lg:h-[46px] lg:px-[12px] lg:py-0 lg:text-[11px]">All assets ({table.total.toLocaleString('en-GB')})</h2>
                <AssetsTable rows={signed.table} selectedId={selected?.id ?? null} collections={collectionOptions} perms={perms}>
                  <div className="flex flex-wrap items-center gap-2 border-t border-[#eef0f4] px-3.5 py-2.5 lg:px-[12px]">
                    <Pager page={q.page} size={q.size} total={table.total} noun="results" edges className="min-w-0 flex-1" />
                    <PageSizeSelect size={q.size} />
                  </div>
                </AssetsTable>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* ── Right rail ─────────────────────────────────────────────────── */}
      <aside className="flex min-w-0 flex-col gap-3 lg:gap-[12px]" aria-label="Upload, activity and asset picker">
        <Link href="/app/settings" className={btnClass('secondary', 'md', 'hidden self-end lg:inline-flex lg:h-[34px] lg:w-[88px] lg:text-[10.5px]')}><Settings size={13} /> Settings</Link>
        <Card className="px-3 pb-3 pt-3 lg:mt-[48px] lg:px-[12px] lg:pb-[12px] lg:pt-[14px]" aria-labelledby="upload-title">
          <h2 id="upload-title" className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-900 lg:text-[11px]"><Upload size={12} className="lg:hidden" aria-hidden />Upload assets</h2>
          <UploadRail collections={collectionOptions} perms={perms} storageNote={quota > 0 ? `Max file size 5 GB · ${fmtBytes(Math.max(0, quota - counts.storageBytes))} free` : 'Max file size 5 GB'} />
        </Card>

        <Card className="px-3 pb-3 pt-3 lg:px-[12px] lg:pb-[12px] lg:pt-[14px]" aria-labelledby="media-activity-title">
          <CardHeader id="media-activity-title" title="Activity" titleClassName="lg:text-[11px]" />
          {signed.activity.length === 0 ? <p className="py-3 text-[12px] text-slate-500 lg:text-[9.5px]">Uploads, approvals and changes appear here.</p> : (
            <ul className="mt-3 space-y-3 lg:mt-[14px] lg:space-y-[14px]">
              {signed.activity.map(a => (
                <li key={a.id} className="flex gap-2 lg:gap-[8px]">
                  <PersonAvatar person={a.actor} size={22} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-1 text-[12px] lg:text-[9px]"><span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{personName(a.actor)}</span><time className="shrink-0 text-slate-500 lg:text-[8px]" dateTime={a.created_at}>{fmtAgo(a.created_at, now)}</time></p>
                    {a.link
                      ? <Link href={a.link} scroll={false} className="line-clamp-2 text-[11px] text-slate-600 hover:text-[#1a5cff] lg:text-[8.5px]">{a.summary.charAt(0).toUpperCase() + a.summary.slice(1)}</Link>
                      : <p className="line-clamp-2 text-[11px] text-slate-600 lg:text-[8.5px]">{a.summary}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="px-3 pb-3 pt-3 lg:px-[12px] lg:pb-[12px] lg:pt-[14px]" aria-labelledby="picker-title">
          <CardHeader id="picker-title" title="Asset picker" titleClassName="lg:text-[11px]" />
          <AssetPickerRail assets={signed.picker} />
        </Card>
      </aside>
    </div>
  )
}
