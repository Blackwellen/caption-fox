import Link from 'next/link'
import {
  CheckCircle2, ChevronRight, Clock, Download, Folder, FolderPlus, Globe, Heart, Image as ImageIcon,
  Layers, Lock, Plus, ShieldCheck, TimerReset, Upload, UserCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BrandContext } from '@/lib/brand-assets/context'
import type { AssetsPage as AssetsPageData } from '@/lib/brand-assets/queries'
import { ADDED_PRESETS, buildHref, chipsFor, type AssetFilters, type RawParams } from '@/lib/brand-assets/filters'
import { can, canAccessBrandCapability } from '@/lib/brand-assets/entitlements'
import type { BrandAssetCard } from '@/types/brand-assets'
import {
  ActionLink, EmptyPanel, KpiStrip, PageHeading, Pagination, Panel, ProgressRing, StatusBadge, type KpiSpec,
} from '../ui/primitives'
import { FilterChips, FilterSelect, MoreFiltersButton, SearchField, SortSelect, ViewSwitcher } from '../ui/controls'
import { Avatar } from '../shell/BrandAssetsShell'
import { AssetThumb, KindChip, VideoOverlay } from './OverviewPage'
import { AssetMenu, FavouriteButton } from '../client/AssetCardActions'
import { CreateFolderDialog, RequestApprovalDialog, UploadDialog } from '../client/AssetDialogs'
import { formatBytes, formatCount, formatRelativeShort, formatUkDate, humanise } from '../tokens'

const KIND_OPTIONS = ['image', 'video', 'audio', 'pdf', 'presentation', 'document', 'design', 'social', 'packaging', 'template', 'archive']
  .map(v => ({ value: v, label: humanise(v) }))

/** Usage scope as the reference shows it: an icon plus the scope label. */
function ScopeLabel({ asset }: { asset: BrandAssetCard }) {
  const state = asset.rights_state
  const Icon = state === 'public_use' ? Globe : state === 'internal_use' || state === 'restricted' ? Lock : ShieldCheck
  const label = asset.usage_scope ?? humanise(state)
  return <span className="flex min-w-0 items-center gap-1 text-[9.5px] text-slate-500 lg:text-[7.5px]"><Icon size={9} className="shrink-0" aria-hidden="true" /><span className="truncate">{label}</span></span>
}

/** Approval / rights status, as the card's coloured dot-label. */
function CardStatus({ asset }: { asset: BrandAssetCard }) {
  const expiring = asset.rights_state === 'expiring_soon' || (asset.expires_at && new Date(asset.expires_at).getTime() - Date.now() < 30 * 86_400_000 && new Date(asset.expires_at).getTime() > Date.now())
  const [label, tone] = expiring ? ['Expiring Soon', 'text-amber-600']
    : asset.approval_status === 'approved' ? ['Approved', 'text-emerald-600']
      : asset.approval_status === 'pending' ? ['In Review', 'text-amber-600']
        : asset.approval_status === 'rejected' ? ['Rejected', 'text-rose-600']
          : [humanise(asset.approval_status), 'text-slate-500']
  return (
    <span className={cn('flex items-center gap-1 text-[9.5px] font-medium lg:text-[7.5px]', tone)}>
      <CheckCircle2 size={10} aria-hidden="true" />{label}
    </span>
  )
}

export default function AssetsPage({
  ctx, data, filters, params,
}: {
  ctx: BrandContext
  data: AssetsPageData
  filters: AssetFilters
  params: RawParams
}) {
  const base = `${ctx.basePath}/brand`
  const pathname = `${base}/assets`
  const e = ctx.entitlements
  const k = data.kpis
  const workspaceType = ctx.basePath.slice(1)
  const storagePct = k.storageQuota > 0 ? Math.round((k.storageUsed / k.storageQuota) * 100) : 0
  const upload = canAccessBrandCapability(e, 'brand.assets.upload')
  const perms = { download: can(e, 'brand.assets.download'), submit: can(e, 'brand.usage_requests.create'), archive: can(e, 'brand.assets.archive') }

  const kpis: KpiSpec[] = [
    { key: 'total', label: 'Total Assets', value: formatCount(k.total), icon: Layers, tone: 'blue',
      delta: k.totalDelta, deltaSuffix: 'this month', riseIsGood: true, href: pathname, tooltip: 'All non-archived assets' },
    { key: 'approved', label: 'Approved', value: formatCount(k.approved), icon: ImageIcon, tone: 'green',
      delta: k.approvedDelta, deltaSuffix: 'this month', riseIsGood: true, href: buildHref(pathname, {}, { status: 'approved' }),
      tooltip: 'Assets cleared for use' },
    { key: 'review', label: 'In Review', value: formatCount(k.inReview), icon: ShieldCheck, tone: 'amber',
      delta: k.inReviewDelta, deltaSuffix: 'this month', riseIsGood: false, href: buildHref(pathname, {}, { status: 'pending' }),
      tooltip: 'Assets awaiting approval' },
    { key: 'expiring', label: 'Expiring Soon', value: formatCount(k.expiringSoon), icon: TimerReset, tone: 'amber',
      delta: null, deltaSuffix: '', riseIsGood: false, href: buildHref(pathname, {}, { rights: 'expiring_soon' }),
      tooltip: 'Assets whose usage rights end within 30 days' },
    { key: 'storage', label: 'Storage Used', value: formatBytes(k.storageUsed), icon: Layers, tone: 'blue',
      delta: null, deltaSuffix: '', riseIsGood: false, href: `${ctx.basePath}/settings/billing`, ring: Math.max(storagePct, k.storageUsed > 0 ? 1 : 0),
      tooltip: `${storagePct}% of ${formatBytes(k.storageQuota)}` },
    { key: 'downloads', label: 'Download Requests', value: formatCount(k.downloadRequests), icon: Download, tone: 'blue',
      delta: k.downloadsDelta, deltaSuffix: 'this month', riseIsGood: true, href: buildHref(pathname, {}, { sort: 'downloads' }),
      tooltip: 'Audited asset downloads' },
  ]

  const addedValue = typeof params.added === 'string' ? params.added : null
  const chips = chipsFor(
    {
      q: filters.q, type: filters.kind ? humanise(filters.kind) : null, status: filters.status ? humanise(filters.status) : null,
      rights: filters.rights ? humanise(filters.rights) : null,
      brand: filters.brandId ? ctx.brands.find(b => b.id === filters.brandId)?.name : null,
      owner: filters.ownerId ? data.members.find(m => m.id === filters.ownerId)?.full_name : null,
      folder: filters.folderId ? data.folders.find(f => f.id === filters.folderId)?.name : null,
      collection: filters.collectionId ? data.collections.find(c => c.id === filters.collectionId)?.name : null,
      added: addedValue ? ADDED_PRESETS[addedValue as keyof typeof ADDED_PRESETS] : null,
      favourites: filters.favouritesOnly ? 'Only' : null,
    },
    { q: 'Search', type: 'Type', status: 'Status', rights: 'Rights', brand: 'Brand', owner: 'Owner', folder: 'Folder', collection: 'Collection', added: 'Added', favourites: 'Favourites' },
  )
  const filtered = chips.length > 0
  const advancedCount = [filters.folderId, filters.collectionId, filters.favouritesOnly || null].filter(Boolean).length

  return (
    <>
      <PageHeading
        title="Assets"
        subtitle="Manage and discover approved media, documents, templates, and campaign-ready brand content."
        actions={
          <>
            <ActionLink href={buildHref(pathname, params, { upload: 1 })} icon={Upload} tone="primary"
              disabled={!upload.allowed} title={upload.allowed ? undefined : upload.message ?? undefined}>
              Upload Assets
            </ActionLink>
            <ActionLink href={buildHref(pathname, params, { newFolder: 1 })} icon={FolderPlus}
              disabled={!can(e, 'brand.assets.edit')}
              title={can(e, 'brand.assets.edit') ? undefined : 'Your role does not permit creating folders'}>
              Create Folder
            </ActionLink>
            <ActionLink href={buildHref(pathname, params, { requestApproval: 1 })} icon={UserCheck}
              disabled={!perms.submit} title={perms.submit ? undefined : 'Your role does not permit requesting approval'}>
              Request Approval
            </ActionLink>
          </>
        }
      />

      <KpiStrip items={kpis} />

      <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_246px]">
        <div className="min-w-0">
          <Panel className="p-3">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <SearchField pathname={pathname} params={params} placeholder="Search assets by name, keyword, or tag..."
                defaultValue={filters.q} className="w-full sm:w-[270px]" />
              <div className="ml-auto">
                <ViewSwitcher pathname={pathname} params={params} active={filters.view}
                  views={[{ value: 'grid', label: 'Grid' }, { value: 'list', label: 'List' }, { value: 'table', label: 'Table' }]} />
              </div>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <FilterSelect pathname={pathname} params={params} name="type" label="Asset Type" allLabel="Asset Type" value={filters.kind} options={KIND_OPTIONS} className="w-[102px]" />
              <FilterSelect pathname={pathname} params={params} name="status" label="Status" allLabel="Status" value={filters.status} options={[
                { value: 'approved', label: 'Approved' }, { value: 'pending', label: 'In Review' },
                { value: 'changes_requested', label: 'Changes requested' }, { value: 'rejected', label: 'Rejected' }, { value: 'draft', label: 'Draft' },
              ]} className="w-[88px]" />
              <FilterSelect pathname={pathname} params={params} name="rights" label="Usage Rights" allLabel="Usage Rights" value={filters.rights} options={[
                { value: 'all_media', label: 'All Media' }, { value: 'licensed', label: 'Licensed' }, { value: 'internal_use', label: 'Internal Use' },
                { value: 'public_use', label: 'Public Use' }, { value: 'restricted', label: 'Restricted' }, { value: 'expiring_soon', label: 'Expiring soon' }, { value: 'expired', label: 'Expired' },
              ]} className="w-[112px]" />
              <FilterSelect pathname={pathname} params={params} name="brand" label="Brand" allLabel="Brand" value={filters.brandId}
                options={ctx.brands.map(b => ({ value: b.id, label: b.name }))} className="w-[88px]" />
              <FilterSelect pathname={pathname} params={params} name="owner" label="Owner" allLabel="Owner" value={filters.ownerId}
                options={data.members.map(m => ({ value: m.id, label: m.full_name ?? 'Unnamed member' }))} className="w-[104px]" />
              <FilterSelect pathname={pathname} params={params} name="added" label="Date Added" allLabel="Date Added" value={addedValue}
                options={Object.entries(ADDED_PRESETS).map(([value, label]) => ({ value, label }))} className="w-[104px]" />
              <MoreFiltersButton pathname={pathname} params={params} activeCount={advancedCount} label="Filters" />
              <SortSelect pathname={pathname} params={params} value={filters.sort} className="ml-auto w-[132px]" options={[
                { value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' }, { value: 'name_asc', label: 'Name A–Z' },
                { value: 'size_desc', label: 'Largest' }, { value: 'downloads', label: 'Most downloaded' },
              ]} />
            </div>

            {params.filters && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2.5">
                <FilterSelect pathname={pathname} params={params} name="folder" label="Folder" allLabel="Any folder" value={filters.folderId}
                  options={data.folders.map(f => ({ value: f.id, label: f.name }))} className="w-[140px]" />
                <FilterSelect pathname={pathname} params={params} name="collection" label="Collection" allLabel="Any collection" value={filters.collectionId}
                  options={data.collections.map(c => ({ value: c.id, label: c.name }))} className="w-[150px]" />
                <Link href={buildHref(pathname, params, { favourites: filters.favouritesOnly ? null : '1' })}
                  aria-pressed={filters.favouritesOnly}
                  className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[11.5px] font-medium',
                    filters.favouritesOnly ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600')}>
                  ★ Favourites only
                </Link>
              </div>
            )}

            <FilterChips pathname={pathname} params={params} chips={chips} />

            {data.assets.length === 0 ? (
              <EmptyPanel
                icon={ImageIcon}
                title={filtered ? 'No assets match those filters' : 'No assets yet'}
                body={filtered ? 'Try a different search term or clear the filters to see everything.'
                  : 'Upload images, video, documents and templates to build the governed brand library.'}
                action={filtered ? 'Clear filters' : (upload.allowed ? 'Upload Assets' : undefined)}
                actionHref={filtered ? pathname : buildHref(pathname, params, { upload: 1 })}
              />
            ) : filters.view === 'list' ? (
              <AssetList assets={data.assets} base={base} workspaceType={workspaceType} perms={perms} />
            ) : filters.view === 'table' ? (
              <AssetTable assets={data.assets} base={base} workspaceType={workspaceType} perms={perms} />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {data.assets.map(a => <AssetCard key={a.id} asset={a} base={base} workspaceType={workspaceType} perms={perms} />)}
              </div>
            )}

            {data.total > filters.pageSize && (
              <div className="-mx-3 -mb-3 mt-3 lg:mt-2">
                <Pagination page={filters.page} pageSize={filters.pageSize} total={data.total}
                  hrefFor={patch => buildHref(pathname, params, patch)} />
              </div>
            )}
          </Panel>
        </div>

        {/* ---------------- Right rail ---------------- */}
        <div className="space-y-3.5 lg:space-y-2.5">
          <Panel dense>
            <div className="flex items-center justify-between px-3.5 pb-2 pt-3">
              <h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900 lg:text-[11px]">Folders &amp; Collections</h2>
              <span className="flex items-center gap-2">
                <Link href={buildHref(pathname, params, { filters: '1' })} className="text-[11px] font-medium text-blue-600 lg:text-[9.5px]">View all</Link>
                {can(e, 'brand.assets.edit') && (
                  <Link href={buildHref(pathname, params, { newFolder: 1 })} aria-label="Create folder"
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"><Plus size={11} /></Link>
                )}
              </span>
            </div>
            {data.folders.length === 0 && data.collections.length === 0 ? (
              <EmptyPanel title="No folders yet" body="Group assets into folders and collections." />
            ) : (
              <ul className="px-1.5 pb-2">
                {data.folders.slice(0, 5).map(f => (
                  <li key={f.id}>
                    <Link href={buildHref(pathname, params, { folder: f.id })} aria-current={filters.folderId === f.id ? 'true' : undefined}
                      className={cn('flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50 lg:py-[5.5px]', filters.folderId === f.id && 'bg-blue-50')}>
                      <Folder size={17} className="shrink-0 text-blue-500" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[10.5px] font-semibold text-slate-800 lg:text-[8.5px] lg:leading-3">{f.name}</span>
                        <span className="block text-[9px] text-slate-400 lg:text-[7px] lg:leading-[10px]">{formatCount(f.asset_count ?? 0)} assets</span>
                      </span>
                    </Link>
                  </li>
                ))}
                {data.folders.length > 5 || data.collections.length > 0 ? (
                  <li><Link href={buildHref(pathname, params, { filters: '1' })} className="block px-2 pt-1 text-[10px] font-medium text-blue-600 hover:underline">Show more</Link></li>
                ) : null}
              </ul>
            )}
          </Panel>

          <Panel title="Recently Used" action="View all" actionHref={buildHref(pathname, {}, { sort: 'downloads' })} dense>
            {data.recentlyUsed.length === 0
              ? <EmptyPanel title="Nothing used yet" body="Assets downloaded by your team appear here." />
              : (
                <ul className="px-1.5 pb-2">
                  {data.recentlyUsed.map(a => (
                    <li key={a.id}>
                      <Link href={`${pathname}/${a.id}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1 hover:bg-slate-50 lg:py-[3px]">
                        <span className="h-6 w-8 shrink-0 overflow-hidden rounded bg-slate-100 lg:h-[22px] lg:w-7"><AssetThumb name={a.file_name} kind={a.asset_kind} url={a.thumbnail_path} /></span>
                        <span className="min-w-0 flex-1 truncate text-[9.5px] text-slate-600 lg:text-[7.5px]">{a.file_name}</span>
                        <span className="shrink-0 text-[9px] text-slate-400 lg:text-[7px]">{formatRelativeShort(a.updated_at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
          </Panel>

          <Panel dense>
            <div className="flex items-center justify-between px-3.5 pb-1 pt-3">
              <h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900 lg:text-[11px]">Asset Insights</h2>
              <span className="text-[10px] text-slate-500">All time</span>
            </div>
            <div className="px-3.5 pb-3">
              {data.insights.length === 0 ? <p className="py-3 text-[10.5px] text-slate-500">No assets to analyse yet.</p> : (
                <>
                  <div className="flex items-center gap-3">
                    <Donut segments={data.insights.map(i => ({ label: i.kind, value: i.count }))} />
                    <ul className="min-w-0 flex-1 space-y-1">
                      {data.insights.map((i, n) => (
                        <li key={i.kind} className="flex items-center gap-1.5 text-[9px]">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: DONUT[n % DONUT.length] }} aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate text-slate-600">{i.kind}</span>
                          <span className="shrink-0 tabular-nums text-slate-500">{i.percent}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[9.5px]">
                    <span className="text-slate-500">{formatCount(k.total)} total assets</span>
                    <Link href={buildHref(pathname, {}, { view: 'table' })} className="font-medium text-blue-600 hover:underline">View full insights</Link>
                  </div>
                </>
              )}
            </div>
          </Panel>
        </div>
      </div>

      {/* ---------------- Lower tables (full width) ---------------- */}
      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2 xl:grid-cols-[1.16fr_1fr_0.92fr]">
        <Panel title="Recent Uploads" action="View all uploads" actionHref={buildHref(pathname, {}, { sort: 'newest', view: 'table' })} dense>
          <MiniTable head={['Asset Name', 'Type', 'Brand', 'Added By', 'Added On', 'Status']}
            empty="Nothing uploaded yet."
            rows={data.recentUploads.map(a => ({
              key: a.id, href: `${pathname}/${a.id}`,
              cells: [
                <NameCell key="n" name={a.file_name} kind={a.asset_kind} url={a.thumbnail_path} />,
                (a.file_type ?? '').toUpperCase(), a.brand?.name ?? '—',
                <Person key="p" name={a.owner?.full_name} src={a.owner?.avatar_url} />,
                formatUkDate(a.created_at),
                <StatusBadge key="s" status={a.approval_status} label={a.approval_status === 'pending' ? 'In Review' : undefined} size="xs" />,
              ],
            }))} />
        </Panel>

        <Panel title="Approval Queue" action="View all requests" actionHref={buildHref(pathname, {}, { status: 'pending' })} dense>
          <MiniTable head={['Asset Name', 'Requested By', 'Brand', 'Requested On', 'Priority']}
            empty="Nothing is awaiting approval."
            rows={data.approvalQueue.map(r => ({
              key: r.id, href: r.asset_id ? `${pathname}/${r.asset_id}?tab=approvals` : pathname,
              cells: [
                <NameCell key="n" name={r.asset_name} kind={r.asset_kind} url={r.thumbnail_path} />,
                <Person key="p" name={r.requester?.full_name} src={r.requester?.avatar_url} />,
                r.brand ?? '—', formatUkDate(r.created_at),
                <StatusBadge key="s" status={r.priority} label={humanise(r.priority)} size="xs" />,
              ],
            }))} />
        </Panel>

        <Panel title="Flagged Assets" dense className="lg:col-span-2 xl:col-span-1">
          <MiniTable head={['Asset', 'Issue', 'Date']}
            empty="No flagged assets — rights conflicts appear here as they are detected."
            rows={data.flagged.map(f => ({
              key: f.id, href: f.asset_id ? `${pathname}/${f.asset_id}?tab=rights` : pathname,
              cells: [<NameCell key="n" name={f.asset_name} kind={f.asset_kind} url={f.thumbnail_path} />, f.issue, formatUkDate(f.detected_at)],
            }))} />
        </Panel>
      </div>

      <UploadDialog workspaceType={workspaceType} canUpload={upload.allowed} blockedReason={upload.message ?? undefined}
        brands={ctx.brands.map(b => ({ id: b.id, name: b.name }))} folders={data.folders.map(f => ({ id: f.id, name: f.name }))} />
      <CreateFolderDialog workspaceType={workspaceType} />
      <RequestApprovalDialog workspaceType={workspaceType} eligible={data.eligibleForApproval} />
    </>
  )
}

// ---------------------------------------------------------------------------

type Perms = { download: boolean; submit: boolean; archive: boolean }

function AssetCard({ asset: a, base, workspaceType, perms }: { asset: BrandAssetCard; base: string; workspaceType: string; perms: Perms }) {
  const href = `${base}/assets/${a.id}`
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition-shadow hover:shadow-md">
      <div className="relative aspect-[168/102] overflow-hidden bg-slate-100">
        <Link href={href} className="block h-full w-full" aria-label={`Open ${a.file_name}`}>
          <AssetThumb name={a.file_name} kind={a.asset_kind} url={a.thumbnail_path} />
        </Link>
        <KindChip kind={a.asset_kind} />
        {a.asset_kind === 'video' && <VideoOverlay seconds={a.duration_seconds} />}
        <FavouriteButton workspaceType={workspaceType} assetId={a.id} initial={a.is_favourite} name={a.file_name} />
      </div>
      <div className="flex flex-1 flex-col gap-1 px-2 pb-1.5 pt-2 lg:gap-[3px] lg:pb-1 lg:pt-1.5">
        <Link href={href} className="truncate text-[10.5px] font-semibold text-slate-800 hover:text-blue-600 lg:text-[8.5px]">{a.file_name}</Link>
        <p className="-mt-0.5 text-[9px] text-slate-400 lg:text-[7.5px]">{(a.file_type ?? '').toUpperCase()} · {formatBytes(a.file_size)}</p>
        <p className="flex items-center gap-1 truncate text-[9.5px] text-slate-500 lg:text-[7.5px]">
          <Heart size={9} className="shrink-0 text-blue-500" aria-hidden="true" />{a.brand?.name ?? 'Unassigned'}
        </p>
        <div className="flex items-center justify-between gap-1">
          <CardStatus asset={a} />
          <ScopeLabel asset={a} />
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 border-t border-slate-100 pt-1.5 lg:pt-1">
          <Avatar name={a.owner?.full_name ?? '—'} src={a.owner?.avatar_url} size={14} />
          <span className="min-w-0 flex-1 truncate text-[9px] text-slate-500 lg:text-[7.5px]">{a.owner?.full_name ?? '—'}</span>
          <span className="flex shrink-0 items-center gap-0.5 text-[8.5px] text-slate-400 lg:text-[7px]"><Clock size={8} aria-hidden="true" />{formatUkDate(a.created_at)}</span>
          <AssetMenu workspaceType={workspaceType} assetId={a.id} name={a.file_name} href={href} status={a.approval_status}
            canDownload={perms.download} canSubmit={perms.submit} canArchive={perms.archive} />
        </div>
      </div>
    </article>
  )
}

function AssetList({ assets, base, workspaceType, perms }: { assets: BrandAssetCard[]; base: string; workspaceType: string; perms: Perms }) {
  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
      {assets.map(a => (
        <li key={a.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50/70">
          <Link href={`${base}/assets/${a.id}`} className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100">
            <AssetThumb name={a.file_name} kind={a.asset_kind} url={a.thumbnail_path} />
          </Link>
          <Link href={`${base}/assets/${a.id}`} className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-semibold text-slate-800">{a.file_name}</span>
            <span className="block truncate text-[11px] text-slate-400">{(a.file_type ?? '').toUpperCase()} · {formatBytes(a.file_size)} · {a.brand?.name ?? 'Unassigned'}</span>
          </Link>
          <span className="hidden shrink-0 items-center gap-2 sm:flex"><CardStatus asset={a} /><ScopeLabel asset={a} /></span>
          <span className="hidden w-32 shrink-0 items-center gap-1.5 md:flex">
            <Avatar name={a.owner?.full_name ?? '—'} src={a.owner?.avatar_url} size={20} />
            <span className="truncate text-[11px] text-slate-500">{a.owner?.full_name ?? '—'}</span>
          </span>
          <span className="hidden w-24 shrink-0 text-right text-[11px] text-slate-400 lg:block">{formatUkDate(a.created_at)}</span>
          <AssetMenu workspaceType={workspaceType} assetId={a.id} name={a.file_name} href={`${base}/assets/${a.id}`} status={a.approval_status}
            canDownload={perms.download} canSubmit={perms.submit} canArchive={perms.archive} />
        </li>
      ))}
    </ul>
  )
}

function AssetTable({ assets, base, workspaceType, perms }: { assets: BrandAssetCard[]; base: string; workspaceType: string; perms: Perms }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[900px] text-left">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-medium text-slate-500">
            {['Asset', 'Type', 'Size', 'Brand', 'Status', 'Rights', 'Owner', 'Added', 'Downloads', ''].map(h => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {assets.map(a => (
            <tr key={a.id} className="hover:bg-slate-50/70">
              <td className="px-3 py-2"><Link href={`${base}/assets/${a.id}`}><NameCell name={a.file_name} kind={a.asset_kind} url={a.thumbnail_path} /></Link></td>
              <td className="px-3 py-2 text-[11px] uppercase text-slate-500">{a.file_type}</td>
              <td className="px-3 py-2 text-[11px] text-slate-600">{formatBytes(a.file_size)}</td>
              <td className="px-3 py-2 text-[11px] text-slate-600">{a.brand?.name ?? '—'}</td>
              <td className="px-3 py-2"><StatusBadge status={a.approval_status} size="xs" /></td>
              <td className="px-3 py-2"><StatusBadge status={a.rights_state} size="xs" /></td>
              <td className="px-3 py-2"><Person name={a.owner?.full_name} src={a.owner?.avatar_url} /></td>
              <td className="px-3 py-2 text-[11px] text-slate-500">{formatUkDate(a.created_at)}</td>
              <td className="px-3 py-2 text-[11px] tabular-nums text-slate-600">{a.download_count}</td>
              <td className="px-2 py-2"><AssetMenu workspaceType={workspaceType} assetId={a.id} name={a.file_name} href={`${base}/assets/${a.id}`} status={a.approval_status}
                canDownload={perms.download} canSubmit={perms.submit} canArchive={perms.archive} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function NameCell({ name, kind, url }: { name: string; kind: string; url: string | null }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="h-5 w-5 shrink-0 overflow-hidden rounded bg-slate-100 lg:h-4 lg:w-4"><AssetThumb name={name} kind={kind} url={url} /></span>
      <span className="truncate text-[9.5px] font-medium text-slate-700 lg:text-[7.5px]">{name}</span>
    </span>
  )
}

function Person({ name, src }: { name?: string | null; src?: string | null }) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <Avatar name={name ?? '—'} src={src} size={12} />
      <span className="truncate text-[9px] text-slate-600 lg:text-[7.5px]">{name ?? '—'}</span>
    </span>
  )
}

function MiniTable({ head, rows, empty }: { head: string[]; rows: { key: string; href: string; cells: React.ReactNode[] }[]; empty: string }) {
  if (rows.length === 0) return <p className="px-3.5 pb-3 text-[10.5px] text-slate-500">{empty}</p>
  return (
    <div className="overflow-x-auto px-1.5 pb-1.5">
      <table className="w-full min-w-[360px] text-left">
        <thead>
          <tr className="border-y border-slate-100 text-[8.5px] font-medium text-slate-500 lg:text-[7px]">
            {head.map(h => <th key={h} className="whitespace-nowrap px-2 py-1.5 font-medium lg:py-1">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(r => (
            <tr key={r.key} className="relative hover:bg-slate-50/70">
              {r.cells.map((c, i) => (
                <td key={i} className="max-w-[150px] truncate px-2 py-[7px] text-[9px] text-slate-600 lg:py-[5px] lg:text-[7.5px]">
                  {i === 0 ? <Link href={r.href} className="block min-w-0 after:absolute after:inset-0">{c}</Link> : c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const DONUT = ['#2563EB', '#10B981', '#8B5CF6', '#F59E0B', '#94A3B8', '#EC4899']

function Donut({ segments }: { segments: { label: string; value: number }[] }) {
  const total = segments.reduce((n, s) => n + s.value, 0) || 1
  const r = 26, c = 2 * Math.PI * r
  let offset = 0
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0 -rotate-90" role="img"
      aria-label={segments.map(s => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(', ')}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="#E2E8F0" strokeWidth="9" />
      {segments.map((s, i) => {
        const len = (s.value / total) * c
        const el = <circle key={s.label} cx="36" cy="36" r={r} fill="none" stroke={DONUT[i % DONUT.length]} strokeWidth="9"
          strokeDasharray={`${Math.max(0, len - 1.5)} ${c}`} strokeDashoffset={-offset} />
        offset += len
        return el
      })}
    </svg>
  )
}

export { ChevronRight, ProgressRing }
