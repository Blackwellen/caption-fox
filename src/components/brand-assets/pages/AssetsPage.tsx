import Link from 'next/link'
import {
  AlertTriangle, CheckCircle2, ChevronRight, Clock, Download, Folder, FolderPlus,
  HardDrive, Image as ImageIcon, Layers, MoreVertical, Plus, ShieldCheck, Star,
  Upload, UserCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BrandContext } from '@/lib/brand-assets/context'
import type { AssetsPage as AssetsPageData } from '@/lib/brand-assets/queries'
import { buildHref, chipsFor, type AssetFilters, type RawParams } from '@/lib/brand-assets/filters'
import { can } from '@/lib/brand-assets/entitlements'
import {
  ActionLink, EmptyPanel, KpiStrip, PageHeading, Pagination, Panel, ProgressRing,
  StatusBadge, type KpiSpec,
} from '../ui/primitives'
import {
  FilterBar, FilterChips, FilterSelect, MoreFiltersButton, SearchField, SortSelect, ViewSwitcher,
} from '../ui/controls'
import { Avatar } from '../shell/BrandAssetsShell'
import { AssetThumb } from './OverviewPage'
import {
  assetKindChip, assetKindLabel, formatBytes, formatCount, formatRelativeShort, formatUkDate,
} from '../tokens'
import type { BrandAssetCard } from '@/types/brand-assets'

const KIND_OPTIONS = [
  'image', 'video', 'audio', 'pdf', 'presentation', 'document',
  'design', 'social', 'packaging', 'template', 'archive',
].map(v => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }))

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
  const storagePct = k.storageQuota > 0 ? Math.round((k.storageUsed / k.storageQuota) * 100) : 0

  const kpis: KpiSpec[] = [
    { key: 'total', label: 'Total Assets', value: formatCount(k.total), icon: Layers, tone: 'blue',
      delta: null, deltaSuffix: '', riseIsGood: true, href: pathname, tooltip: 'All non-archived assets' },
    { key: 'approved', label: 'Approved', value: formatCount(k.approved), icon: CheckCircle2, tone: 'green',
      delta: null, deltaSuffix: '', riseIsGood: true, href: buildHref(pathname, params, { status: 'approved' }),
      tooltip: 'Assets cleared for use' },
    { key: 'review', label: 'In Review', value: formatCount(k.inReview), icon: Clock, tone: 'amber',
      delta: null, deltaSuffix: '', riseIsGood: false, href: buildHref(pathname, params, { status: 'pending' }),
      tooltip: 'Assets awaiting approval' },
    { key: 'expiring', label: 'Expiring Soon', value: formatCount(k.expiringSoon), icon: AlertTriangle, tone: 'red',
      delta: null, deltaSuffix: '', riseIsGood: false, href: buildHref(pathname, params, { rights: 'expiring_soon' }),
      tooltip: 'Assets whose rights expire within 30 days' },
    { key: 'storage', label: 'Storage Used', value: formatBytes(k.storageUsed), icon: HardDrive, tone: 'indigo',
      delta: null, deltaSuffix: '', riseIsGood: false, href: null, ring: storagePct,
      tooltip: `${storagePct}% of ${formatBytes(k.storageQuota)}` },
    { key: 'downloads', label: 'Download Requests', value: formatCount(k.downloadRequests), icon: Download, tone: 'purple',
      delta: null, deltaSuffix: '', riseIsGood: true, href: buildHref(pathname, params, { sort: 'downloads' }),
      tooltip: 'Recorded asset downloads' },
  ]

  const chips = chipsFor(
    { q: filters.q, type: filters.kind, status: filters.status, rights: filters.rights, folder: filters.folderId },
    { q: 'Search', type: 'Type', status: 'Status', rights: 'Rights', folder: 'Folder' },
  )

  return (
    <>
      <PageHeading
        title="Assets"
        subtitle="Manage and discover approved media, documents, templates, and campaign-ready brand content."
        actions={
          <>
            <ActionLink href={buildHref(pathname, params, { upload: 1 })} icon={Upload} tone="primary"
              disabled={!can(e, 'brand.assets.upload')}
              title={can(e, 'brand.assets.upload') ? undefined : 'Upload is not available for your role, plan or storage quota'}>
              Upload Assets
            </ActionLink>
            <ActionLink href={buildHref(pathname, params, { newFolder: 1 })} icon={FolderPlus}
              disabled={!can(e, 'brand.assets.edit')}
              title={can(e, 'brand.assets.edit') ? undefined : 'Your role does not permit creating folders'}>
              Create Folder
            </ActionLink>
            <ActionLink href={buildHref(pathname, params, { requestApproval: 1 })} icon={UserCheck}
              disabled={!can(e, 'brand.usage_requests.create')}
              title={can(e, 'brand.usage_requests.create') ? undefined : 'Your role does not permit requesting approval'}>
              Request Approval
            </ActionLink>
          </>
        }
      />

      <KpiStrip items={kpis} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_288px]">
        <div className="min-w-0 space-y-4">
          <FilterBar className="mb-0">
            <SearchField pathname={pathname} params={params} placeholder="Search assets by name, keyword, or tag…"
              defaultValue={filters.q} className="w-full max-w-[290px]" />
            <FilterSelect pathname={pathname} params={params} name="type" label="Type" allLabel="Asset Type"
              value={filters.kind} options={KIND_OPTIONS} />
            <FilterSelect pathname={pathname} params={params} name="status" label="Status" allLabel="All Statuses"
              value={filters.status} options={[
                { value: 'approved', label: 'Approved' }, { value: 'pending', label: 'In Review' },
                { value: 'changes_requested', label: 'Changes requested' }, { value: 'rejected', label: 'Rejected' },
                { value: 'draft', label: 'Draft' },
              ]} />
            <FilterSelect pathname={pathname} params={params} name="rights" label="Rights" allLabel="Usage Rights"
              value={filters.rights} options={[
                { value: 'all_media', label: 'All Media' }, { value: 'licensed', label: 'Licensed' },
                { value: 'internal_use', label: 'Internal Use' }, { value: 'public_use', label: 'Public Use' },
                { value: 'restricted', label: 'Restricted' }, { value: 'expiring_soon', label: 'Expiring soon' },
                { value: 'expired', label: 'Expired' },
              ]} />
            <FilterSelect pathname={pathname} params={params} name="brand" label="Brand" allLabel="All Brands"
              value={filters.brandId} options={ctx.brands.map(b => ({ value: b.id, label: b.name }))} />
            <FilterSelect pathname={pathname} params={params} name="folder" label="Folder" allLabel="All Folders"
              value={filters.folderId} options={data.folders.map(f => ({ value: f.id, label: f.name }))} />
            <MoreFiltersButton pathname={pathname} params={params} activeCount={chips.length} />
            <div className="ml-auto flex items-center gap-2">
              <SortSelect pathname={pathname} params={params} value={filters.sort} options={[
                { value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' },
                { value: 'name_asc', label: 'Name A–Z' }, { value: 'size_desc', label: 'Largest' },
                { value: 'downloads', label: 'Most downloaded' },
              ]} />
              <ViewSwitcher pathname={pathname} params={params} active={filters.view}
                views={[{ value: 'grid', label: 'Grid' }, { value: 'list', label: 'List' }, { value: 'table', label: 'Table' }]} />
            </div>
          </FilterBar>

          <FilterChips pathname={pathname} params={params} chips={chips} />

          {data.assets.length === 0 ? (
            <Panel>
              <EmptyPanel
                icon={ImageIcon}
                title={chips.length ? 'No assets match those filters' : 'No assets yet'}
                body={chips.length
                  ? 'Try a different search term or clear the filters to see everything.'
                  : 'Upload images, video, documents and templates to build the governed brand library.'}
                action={chips.length ? 'Clear filters' : (can(e, 'brand.assets.upload') ? 'Upload Assets' : undefined)}
                actionHref={chips.length ? pathname : buildHref(pathname, params, { upload: 1 })}
              />
            </Panel>
          ) : filters.view === 'grid' ? (
            <AssetGrid assets={data.assets} base={base} />
          ) : filters.view === 'list' ? (
            <AssetList assets={data.assets} base={base} />
          ) : (
            <AssetTable assets={data.assets} base={base} />
          )}

          {data.total > filters.pageSize && (
            <Panel>
              <Pagination page={filters.page} pageSize={filters.pageSize} total={data.total}
                hrefFor={patch => buildHref(pathname, params, patch)} />
            </Panel>
          )}

          {/* Lower panels */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Recent Uploads" action="View all uploads" actionHref={buildHref(pathname, params, { sort: 'newest' })} dense>
              {data.recentUploads.length === 0
                ? <EmptyPanel title="Nothing uploaded yet" body="New uploads appear here." />
                : (
                  <ul className="divide-y divide-slate-50">
                    {data.recentUploads.map(a => (
                      <li key={a.id} className="flex items-center gap-2.5 px-4 py-2">
                        <span className="h-7 w-7 shrink-0 overflow-hidden rounded border border-slate-200">
                          <AssetThumb name={a.file_name} kind={a.asset_kind} url={a.thumbnail_path} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-medium text-slate-800">{a.file_name}</span>
                          <span className="block truncate text-[10px] text-slate-400">{a.brand?.name ?? '—'}</span>
                        </span>
                        <StatusBadge status={a.approval_status} />
                      </li>
                    ))}
                  </ul>
                )}
            </Panel>

            <Panel title="Approval Queue" action="View all requests" actionHref={buildHref(pathname, params, { status: 'pending' })} dense>
              {data.approvalQueue.length === 0
                ? <EmptyPanel title="Nothing awaiting approval" body="Assets submitted for review appear here." />
                : (
                  <ul className="divide-y divide-slate-50">
                    {data.approvalQueue.map(r => (
                      <li key={r.id} className="flex items-center gap-2.5 px-4 py-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-medium text-slate-800">{r.asset_name}</span>
                          <span className="block truncate text-[10px] text-slate-400">
                            {r.brand ?? '—'} · {formatRelativeShort(r.created_at)}
                          </span>
                        </span>
                        <StatusBadge status={r.priority} />
                      </li>
                    ))}
                  </ul>
                )}
            </Panel>

            <Panel title="Flagged Assets" dense>
              {data.flagged.length === 0
                ? <EmptyPanel title="No flagged assets" body="Rights conflicts appear here as they are detected." />
                : (
                  <ul className="divide-y divide-slate-50">
                    {data.flagged.map(f => (
                      <li key={f.id} className="flex items-center gap-2.5 px-4 py-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-medium text-slate-800">{f.asset_name}</span>
                          <span className="block truncate text-[10px] text-rose-600">{f.issue}</span>
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-400">{formatUkDate(f.detected_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
            </Panel>
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <Panel dense>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-[15px] font-semibold text-slate-900">Folders &amp; Collections</h2>
              <span className="flex items-center gap-2">
                <Link href={pathname} className="text-[12px] font-medium text-blue-600">View all</Link>
                <Link href={buildHref(pathname, params, { newFolder: 1 })}
                  className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50"
                  aria-label="Create folder">
                  <Plus size={12} />
                </Link>
              </span>
            </div>
            {data.folders.length === 0 && data.collections.length === 0 ? (
              <EmptyPanel title="No folders yet" body="Group assets into folders and collections." />
            ) : (
              <ul className="py-1">
                {data.folders.map(f => (
                  <li key={f.id}>
                    <Link href={buildHref(pathname, params, { folder: f.id })}
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50">
                      <Folder size={15} className="shrink-0 text-blue-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium text-slate-700">{f.name}</span>
                        <span className="block text-[10px] text-slate-400">{f.asset_count ?? 0} assets</span>
                      </span>
                    </Link>
                  </li>
                ))}
                {data.collections.map(c => (
                  <li key={c.id}>
                    <Link href={buildHref(pathname, params, { collection: c.id })}
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50">
                      <Layers size={15} className="shrink-0 text-purple-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium text-slate-700">{c.name}</span>
                        <span className="block text-[10px] text-slate-400">Collection</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Recently Used" action="View all" actionHref={pathname} dense>
            {data.recentlyUsed.length === 0
              ? <EmptyPanel title="Nothing used yet" body="Assets you open appear here." />
              : (
                <ul className="divide-y divide-slate-50">
                  {data.recentlyUsed.map(a => (
                    <li key={a.id}>
                      <Link href={`${pathname}?asset=${a.id}`} className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50">
                        <span className="h-7 w-7 shrink-0 overflow-hidden rounded border border-slate-200">
                          <AssetThumb name={a.file_name} kind={a.asset_kind} url={a.thumbnail_path} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12px] text-slate-700">{a.file_name}</span>
                        <span className="shrink-0 text-[10px] text-slate-400">{formatRelativeShort(a.updated_at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
          </Panel>

          <Panel title="Asset Insights" dense>
            <div className="px-4 py-3">
              <div className="flex items-center gap-4">
                <ProgressRing value={100} size={72} stroke={10} className="stroke-blue-500" />
                <ul className="min-w-0 flex-1 space-y-1">
                  {data.insights.map(i => (
                    <li key={i.kind} className="flex items-center gap-1.5 text-[11px]">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                      <span className="min-w-0 flex-1 truncate text-slate-600">{i.kind}</span>
                      <span className="shrink-0 font-semibold text-slate-700">{i.percent}%</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                {formatCount(k.total)} total assets
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------

function RightsChip({ asset }: { asset: BrandAssetCard }) {
  return (
    <span className="flex items-center gap-1 text-[10px] text-slate-500">
      <ShieldCheck size={10} className="shrink-0" />
      <span className="truncate">{asset.usage_scope ?? 'Unspecified'}</span>
    </span>
  )
}

function AssetGrid({ assets, base }: { assets: BrandAssetCard[]; base: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {assets.map(a => (
        <article key={a.id} className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-sm">
          <Link href={`${base}/assets?asset=${a.id}`} className="relative block aspect-[4/3] overflow-hidden bg-slate-100">
            <AssetThumb name={a.file_name} kind={a.asset_kind} url={a.thumbnail_path} />
            <span className={cn(
              'absolute bottom-2 left-2 rounded px-1.5 py-0.5 text-[9px] font-bold',
              assetKindChip[a.asset_kind] ?? assetKindChip.other,
            )}>
              {assetKindLabel[a.asset_kind] ?? 'FILE'}
            </span>
            <span className={cn(
              'absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/90',
              a.is_favourite ? 'text-amber-500' : 'text-slate-400',
            )}>
              <Star size={13} fill={a.is_favourite ? 'currentColor' : 'none'} />
            </span>
          </Link>
          <div className="flex flex-1 flex-col gap-1.5 p-3">
            <Link href={`${base}/assets?asset=${a.id}`} className="truncate text-[13px] font-semibold text-slate-800 hover:text-blue-600">
              {a.file_name}
            </Link>
            <p className="text-[10px] text-slate-400">{a.file_type?.toUpperCase()} · {formatBytes(a.file_size)}</p>
            <p className="flex items-center gap-1 truncate text-[10px] text-slate-500">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: a.brand?.primary_color ?? '#94a3b8' }} />
              {a.brand?.name ?? 'Unassigned'}
            </p>
            <div className="flex items-center justify-between gap-1">
              <StatusBadge status={a.approval_status} />
              <RightsChip asset={a} />
            </div>
            <div className="mt-auto flex items-center gap-1.5 border-t border-slate-100 pt-2">
              <Avatar name={a.owner?.full_name ?? '—'} src={a.owner?.avatar_url} size={18} />
              <span className="min-w-0 flex-1 truncate text-[10px] text-slate-500">{a.owner?.full_name ?? '—'}</span>
              <span className="shrink-0 text-[10px] text-slate-400">{formatUkDate(a.created_at)}</span>
              <MoreVertical size={13} className="shrink-0 text-slate-300" />
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

function AssetList({ assets, base }: { assets: BrandAssetCard[]; base: string }) {
  return (
    <Panel>
      <ul className="divide-y divide-slate-100">
        {assets.map(a => (
          <li key={a.id}>
            <Link href={`${base}/assets?asset=${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <span className="h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200">
                <AssetThumb name={a.file_name} kind={a.asset_kind} url={a.thumbnail_path} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-slate-800">{a.file_name}</span>
                <span className="block truncate text-[11px] text-slate-400">
                  {a.file_type?.toUpperCase()} · {formatBytes(a.file_size)} · {a.brand?.name ?? 'Unassigned'}
                </span>
              </span>
              <span className="hidden shrink-0 items-center gap-2 sm:flex">
                <StatusBadge status={a.approval_status} />
                <StatusBadge status={a.rights_state} />
              </span>
              <span className="hidden shrink-0 items-center gap-1.5 md:flex">
                <Avatar name={a.owner?.full_name ?? '—'} src={a.owner?.avatar_url} size={22} />
                <span className="w-24 truncate text-[11px] text-slate-500">{a.owner?.full_name ?? '—'}</span>
              </span>
              <span className="hidden w-24 shrink-0 text-right text-[11px] text-slate-400 lg:block">
                {formatUkDate(a.created_at)}
              </span>
              <ChevronRight size={15} className="shrink-0 text-slate-300" />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function AssetTable({ assets, base }: { assets: BrandAssetCard[]; base: string }) {
  return (
    <Panel>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5">Asset</th>
              <th className="px-3 py-2.5">Type</th>
              <th className="px-3 py-2.5">Size</th>
              <th className="px-3 py-2.5">Brand</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Rights</th>
              <th className="px-3 py-2.5">Owner</th>
              <th className="px-3 py-2.5">Added</th>
              <th className="px-3 py-2.5">Downloads</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {assets.map(a => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link href={`${base}/assets?asset=${a.id}`} className="flex min-w-0 items-center gap-2">
                    <span className="h-7 w-7 shrink-0 overflow-hidden rounded border border-slate-200">
                      <AssetThumb name={a.file_name} kind={a.asset_kind} url={a.thumbnail_path} />
                    </span>
                    <span className="truncate text-[13px] font-medium text-slate-800">{a.file_name}</span>
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-[12px] uppercase text-slate-500">{a.file_type}</td>
                <td className="px-3 py-2.5 text-[12px] text-slate-600">{formatBytes(a.file_size)}</td>
                <td className="px-3 py-2.5 text-[12px] text-slate-600">{a.brand?.name ?? '—'}</td>
                <td className="px-3 py-2.5"><StatusBadge status={a.approval_status} /></td>
                <td className="px-3 py-2.5"><StatusBadge status={a.rights_state} /></td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-1.5">
                    <Avatar name={a.owner?.full_name ?? '—'} src={a.owner?.avatar_url} size={20} />
                    <span className="truncate text-[12px] text-slate-600">{a.owner?.full_name ?? '—'}</span>
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[12px] text-slate-500">{formatUkDate(a.created_at)}</td>
                <td className="px-3 py-2.5 text-[12px] tabular-nums text-slate-600">{a.download_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
