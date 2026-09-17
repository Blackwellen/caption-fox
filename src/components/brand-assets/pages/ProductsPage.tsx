import Link from 'next/link'
import {
  ArrowRight, Boxes, ChevronRight, CircleCheck, Globe, ImageOff, Link2, Package, PackageOpen, Upload, Users,
  Image as ImageIcon, Film, FileText, Camera,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BrandContext } from '@/lib/brand-assets/context'
import type { ProductsPage as ProductsPageData } from '@/lib/brand-assets/queries'
import { buildHref, chipsFor, exportHref, type ProductFilters, type RawParams } from '@/lib/brand-assets/filters'
import { can } from '@/lib/brand-assets/entitlements'
import type { ProductCard } from '@/types/brand-assets'
import {
  ActionLink, EmptyPanel, ExportCsvLink, KpiStrip, PageHeading, Pagination, Panel, StatusBadge, type KpiSpec,
} from '../ui/primitives'
import { FilterBar, FilterChips, FilterSelect, MoreFiltersButton, SearchField, SortSelect, ViewSwitcher } from '../ui/controls'
import { Avatar } from '../shell/BrandAssetsShell'
import { AssetThumb } from './OverviewPage'
import { ImportProductsDialog, LinkAssetsDialog, ProductBookmark, ProductMenu } from '../client/ProductClient'
import { formatCount, formatRelativeShort, formatUkDate, humanise } from '../tokens'

/** Readiness colour bands follow the same thresholds as readiness_state. */
const readinessChip = (score: number) =>
  score >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : score >= 60 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'

const STATUS_PILL: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700', review: 'bg-amber-50 text-amber-700', draft: 'bg-slate-100 text-slate-600',
  inactive: 'bg-slate-100 text-slate-600', discontinued: 'bg-rose-50 text-rose-700', archived: 'bg-slate-100 text-slate-500',
}

const MISSING_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  primary_image: ImageIcon, lifestyle_image: Camera, packshot: Package, product_video: Film, description: FileText,
}

export default function ProductsPage({
  ctx, data, filters, params,
}: {
  ctx: BrandContext
  data: ProductsPageData
  filters: ProductFilters
  params: RawParams
}) {
  const base = `${ctx.basePath}/brand`
  const pathname = `${base}/products`
  const e = ctx.entitlements
  const k = data.kpis
  const workspaceType = ctx.basePath.slice(1)
  const perms = { edit: can(e, 'brand.products.edit'), approve: can(e, 'brand.products.approve'), archive: can(e, 'brand.products.archive') }

  const kpis: KpiSpec[] = [
    { key: 'products', label: 'Products', value: formatCount(k.products), icon: Users, tone: 'blue',
      delta: k.productsDelta, deltaSuffix: 'this month', riseIsGood: true, href: pathname, tooltip: 'All products in the catalogue' },
    { key: 'skus', label: 'Active SKUs', value: formatCount(k.activeSkus), icon: Boxes, tone: 'green',
      delta: k.activeSkusDelta, deltaSuffix: 'this month', riseIsGood: true, href: null, tooltip: 'Variants with an active status' },
    { key: 'draft', label: 'Draft Products', value: formatCount(k.draftProducts), icon: PackageOpen, tone: 'amber',
      delta: k.draftDelta, deltaSuffix: 'this month', riseIsGood: false, href: buildHref(pathname, {}, { status: 'draft' }), tooltip: 'Products not yet published' },
    { key: 'linked', label: 'Linked Assets', value: formatCount(k.linkedAssets), icon: Package, tone: 'purple',
      delta: k.linkedDelta, deltaSuffix: 'this month', riseIsGood: true, href: `${base}/assets`, tooltip: 'Asset links across all products' },
    { key: 'ready', label: 'Campaign Ready', value: `${k.campaignReady}%`, icon: CircleCheck, tone: 'emerald',
      delta: null, deltaSuffix: '', riseIsGood: true, href: buildHref(pathname, {}, { readiness: 'ready' }), ring: k.campaignReady,
      tooltip: 'Share of products passing every weighted readiness check' },
    { key: 'missing', label: 'Missing Assets', value: formatCount(k.missingAssets), icon: ImageOff, tone: 'red',
      delta: k.missingDelta, deltaSuffix: 'this month', riseIsGood: false, href: buildHref(pathname, {}, { readiness: 'not_ready' }), tooltip: 'Failed readiness checks across the catalogue' },
  ]

  const chips = chipsFor(
    {
      q: filters.q,
      category: filters.categoryId ? data.categories.find(c => c.id === filters.categoryId)?.name : null,
      collection: filters.collectionId ? data.collections.find(c => c.id === filters.collectionId)?.name : null,
      status: filters.status ? humanise(filters.status) : null, market: filters.market,
      owner: filters.ownerId ? data.owners.find(o => o.id === filters.ownerId)?.full_name : null,
      readiness: filters.readiness ? humanise(filters.readiness) : null,
      missing: filters.missingAsset ? data.missingBreakdown.find(m => m.key === filters.missingAsset)?.label ?? humanise(filters.missingAsset) : null,
    },
    { q: 'Search', category: 'Category', collection: 'Collection', status: 'Status', market: 'Region', owner: 'Owner', readiness: 'Readiness', missing: 'Missing' },
  )
  const filtered = chips.length > 0
  const r = data.readiness
  const rTotal = r.ready + r.review + r.notReady || 1

  return (
    <>
      <PageHeading
        title="Product Library"
        subtitle="Manage your product catalog, SKUs, linked assets, brand alignment and readiness for campaigns."
        actions={
          <>
            <ActionLink href={`${pathname}/new`} icon={Package}
              disabled={!can(e, 'brand.products.create')} title={can(e, 'brand.products.create') ? undefined : 'Your role does not permit adding products'}>
              Add Product
            </ActionLink>
            <ActionLink href={buildHref(pathname, params, { import: 1 })} icon={Upload}
              disabled={!can(e, 'brand.products.import')} title={can(e, 'brand.products.import') ? undefined : 'Your role does not permit importing products'}>
              Import Products
            </ActionLink>
            <ActionLink href={buildHref(pathname, params, { link: 1 })} icon={Link2} tone="primary"
              disabled={!perms.edit} title={perms.edit ? undefined : 'Your role does not permit linking assets'}>
              Link Assets
            </ActionLink>
          </>
        }
      />

      <KpiStrip items={kpis} />

      <div className="flex flex-col gap-2 xl:flex-row xl:items-stretch">
        <FilterBar className="mb-3.5 flex-1">
          <SearchField pathname={pathname} params={params} placeholder="Search products, SKUs, categories..." defaultValue={filters.q} className="w-full sm:w-[196px]" />
          <FilterSelect stacked pathname={pathname} params={params} name="category" label="Category" allLabel="All" value={filters.categoryId}
            options={data.categories.map(c => ({ value: c.id, label: c.name }))} className="w-[76px]" />
          <FilterSelect stacked pathname={pathname} params={params} name="collection" label="Collection" allLabel="All" value={filters.collectionId}
            options={data.collections.map(c => ({ value: c.id, label: c.name }))} className="w-[76px]" />
          <FilterSelect stacked pathname={pathname} params={params} name="status" label="Status" allLabel="All" value={filters.status} options={[
            { value: 'active', label: 'Active' }, { value: 'review', label: 'Review' }, { value: 'draft', label: 'Draft' },
            { value: 'inactive', label: 'Inactive' }, { value: 'discontinued', label: 'Discontinued' },
          ]} className="w-[76px]" />
          <FilterSelect stacked pathname={pathname} params={params} name="market" label="Region" allLabel="All" value={filters.market}
            options={data.markets.map(m => ({ value: m, label: m }))} className="w-[76px]" />
          <FilterSelect stacked pathname={pathname} params={params} name="owner" label="Owner" allLabel="All" value={filters.ownerId}
            options={data.owners.map(o => ({ value: o.id, label: o.full_name ?? 'Unnamed member' }))} className="w-[76px]" />
          <MoreFiltersButton pathname={pathname} params={params} activeCount={[filters.readiness, filters.missingAsset].filter(Boolean).length} />
        </FilterBar>
        <div className="mb-3.5 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <ViewSwitcher solid pathname={pathname} params={params} active={filters.view}
            views={[{ value: 'cards', label: 'Cards' }, { value: 'list', label: 'List' }, { value: 'table', label: 'Table' }]} />
          <SortSelect stacked pathname={pathname} params={params} value={filters.sort} className="w-[128px]" options={[
            { value: 'recently_updated', label: 'Recently Updated' }, { value: 'name_asc', label: 'Name A–Z' }, { value: 'sku_asc', label: 'SKU' },
            { value: 'readiness_desc', label: 'Most ready' }, { value: 'readiness_asc', label: 'Least ready' }, { value: 'created_desc', label: 'Newest' },
          ]} />
          <ExportCsvLink href={exportHref(pathname, params)} allowed={can(e, 'brand.products.export')}
            blockedReason="Your role or plan does not permit exporting the product catalogue." />
        </div>
      </div>

      {params.filters && (
        <div className="-mt-1.5 mb-3.5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <FilterSelect pathname={pathname} params={params} name="readiness" label="Readiness" allLabel="Any readiness" value={filters.readiness}
            options={[{ value: 'ready', label: 'Ready' }, { value: 'review', label: 'Review' }, { value: 'not_ready', label: 'Not ready' }]} className="w-[140px]" />
          <FilterSelect pathname={pathname} params={params} name="missing" label="Missing asset" allLabel="Any missing asset" value={filters.missingAsset}
            options={data.missingBreakdown.map(m => ({ value: m.key, label: m.label }))} className="w-[180px]" />
        </div>
      )}

      <FilterChips pathname={pathname} params={params} chips={chips} />

      <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_206px]">
        <div className="min-w-0">
          {data.products.length === 0 ? (
            <Panel>
              <EmptyPanel icon={Package}
                title={filtered ? 'No products match those filters' : 'No products yet'}
                body={filtered ? 'Try a different search term or clear the filters to see everything.' : 'Add products to link assets, track markets and measure campaign readiness.'}
                action={filtered ? 'Clear filters' : (can(e, 'brand.products.create') ? 'Add Product' : undefined)}
                actionHref={filtered ? pathname : `${pathname}/new`} />
            </Panel>
          ) : filters.view === 'list' ? (
            <ProductList products={data.products} base={base} />
          ) : filters.view === 'table' ? (
            <ProductTable products={data.products} base={base} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {data.products.map(p => <ProductTile key={p.id} p={p} base={base} workspaceType={workspaceType} perms={perms} />)}
              </div>
              {data.total > data.products.length && (
                <Link href={buildHref(pathname, params, { view: 'table', pageSize: 50 })} className="mt-2 flex items-center justify-center gap-1.5 py-1 text-[10.5px] font-medium text-blue-600 hover:underline lg:text-[8.5px]">
                  View all products <ArrowRight size={12} />
                </Link>
              )}
            </>
          )}
          {filters.view !== 'cards' && data.total > filters.pageSize && (
            <Panel className="mt-3"><Pagination page={filters.page} pageSize={filters.pageSize} total={data.total} hrefFor={patch => buildHref(pathname, params, patch)} /></Panel>
          )}
        </div>

        <div className="space-y-3.5">
          <Panel title="Missing Product Assets" action="View all" actionHref={buildHref(pathname, {}, { readiness: 'not_ready' })} dense>
            {data.missingBreakdown.length === 0 ? <EmptyPanel title="Nothing missing" body="Every product has its required assets." /> : (
              <ul className="px-1.5 pb-2">
                {data.missingBreakdown.map(m => {
                  const Icon = MISSING_ICON[m.key] ?? ImageOff
                  return (
                    <li key={m.key}>
                      <Link href={buildHref(pathname, params, { missing: m.key })} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                        <Icon size={12} className="shrink-0 text-slate-400" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate text-[9.5px] text-slate-700 lg:text-[8px]">{m.label}</span>
                        <span className="shrink-0 text-[9.5px] tabular-nums text-slate-600 lg:text-[8px]">{m.count}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Campaign Readiness" dense>
            <div className="flex items-center gap-2.5 px-3 pb-2">
              <ReadinessDonut ready={r.ready} review={r.review} notReady={r.notReady} percent={r.percent} />
              <ul className="min-w-0 flex-1 space-y-1.5 text-[8.5px]">
                {([['Ready', r.ready, 'bg-emerald-500', 'ready'], ['Review', r.review, 'bg-amber-500', 'review'], ['Not Ready', r.notReady, 'bg-rose-500', 'not_ready']] as const).map(([label, n, dot, key]) => (
                  <li key={label}>
                    <Link href={buildHref(pathname, {}, { readiness: key })} className="flex items-center gap-1 hover:underline">
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} aria-hidden="true" />
                      <span className="flex-1 text-slate-600">{label}</span>
                      <span className="tabular-nums text-slate-500">{n} ({Math.round((n / rTotal) * 100)}%)</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <Link href={buildHref(pathname, {}, { view: 'table', sort: 'readiness_asc' })}
              className="flex items-center justify-between px-3 pb-3 text-[9.5px] font-medium text-blue-600 hover:underline">
              View readiness details <ChevronRight size={11} />
            </Link>
          </Panel>
        </div>
      </div>

      {/* ---------------- Bottom row ---------------- */}
      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2 xl:grid-cols-[1.38fr_1.02fr_1fr]">
        <Panel title="Flagged Products" action="View all" actionHref={buildHref(pathname, {}, { readiness: 'not_ready' })} dense className="lg:col-span-2 xl:col-span-1">
          {data.flagged.length === 0 ? <p className="px-3.5 pb-3 text-[10.5px] text-slate-500">Nothing flagged — every product passes its readiness checks.</p> : (
            <div className="overflow-x-auto px-1.5 pb-1.5">
              <table className="w-full min-w-[440px] text-left">
                <thead><tr className="border-y border-slate-100 text-[8.5px] font-medium text-slate-500">{['Product', 'Issue', 'Status', 'Owner', 'Updated'].map(h => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.flagged.map(f => (
                    <tr key={f.id} className="hover:bg-slate-50/70">
                      <td className="px-2 py-1.5">
                        <Link href={`${pathname}/${f.id}?tab=readiness`} className="flex items-center gap-2">
                          <span className="h-7 w-7 shrink-0 overflow-hidden rounded-md bg-slate-100"><AssetThumb name={f.name} kind="image" url={f.thumbnail_path} /></span>
                          <span className="min-w-0"><span className="block truncate text-[9.5px] font-semibold text-slate-800 lg:text-[7.5px]">{f.name}</span><span className="block text-[8.5px] text-slate-400 lg:text-[7px]">{f.sku}</span></span>
                        </Link>
                      </td>
                      <td className="px-2 py-1.5 text-[9px] text-slate-600 lg:text-[7px]">{f.issue}</td>
                      <td className="px-2 py-1.5"><StatusBadge status={f.status === 'Not Ready' ? 'not_ready' : 'review'} label={f.status} size="xs" /></td>
                      <td className="px-2 py-1.5"><span className="flex items-center gap-1"><Avatar name={f.owner?.full_name ?? '—'} src={f.owner?.avatar_url} size={16} /><span className="truncate text-[9px] text-slate-600 lg:text-[7px]">{f.owner?.full_name ?? '—'}</span></span></td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-[8.5px] text-slate-500 lg:text-[7px]">{formatUkDate(f.updated_at)}<span className="block text-slate-400">{formatRelativeShort(f.updated_at)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Recent Product Updates" action="View all" actionHref={`${base}/activity?type=product`} dense>
          {data.recentUpdates.length === 0 ? <p className="px-3.5 pb-3 text-[10.5px] text-slate-500">Product changes appear here.</p> : (
            <ul className="px-1.5 pb-2">
              {data.recentUpdates.map(u => (
                <li key={u.id}>
                  <Link href={u.entity_id ? `${pathname}/${u.entity_id}` : pathname} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-50">
                    <span className="h-7 w-7 shrink-0 overflow-hidden rounded-md bg-slate-100"><AssetThumb name={u.product_name ?? u.summary} kind="image" url={u.thumbnail_path} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[9.5px] font-semibold text-slate-800 lg:text-[8px]">{u.product_name ?? u.summary}</span>
                      <span className="block truncate text-[8.5px] text-slate-400 lg:text-[7px]">{u.product_name ? u.summary.replace(u.product_name, '').trim() || humanise(u.action) : humanise(u.action)}</span>
                    </span>
                    <span className="hidden items-center gap-1 sm:flex"><Avatar name={u.actor?.full_name ?? 'System'} src={u.actor?.avatar_url} size={16} /><span className="max-w-[80px] truncate text-[9px] text-slate-600 lg:text-[7px]">{u.actor?.full_name ?? 'System'}</span></span>
                    <span className="shrink-0 text-[8.5px] text-slate-400 lg:text-[7px]">{formatRelativeShort(u.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Top Categories" action="View all" actionHref={buildHref(pathname, {}, { view: 'table', sort: 'name_asc' })} dense>
          {data.topCategories.length === 0 ? <p className="px-3.5 pb-3 text-[10.5px] text-slate-500">Assign categories to products to see this breakdown.</p> : (
            <ul className="space-y-2.5 px-3.5 pb-2">
              {data.topCategories.map(c => {
                const cat = data.categories.find(x => x.name === c.name)
                return (
                  <li key={c.name}>
                    <Link href={cat ? buildHref(pathname, {}, { category: cat.id }) : pathname} className="block hover:opacity-80">
                      <span className="mb-1 flex items-baseline justify-between text-[9.5px] lg:text-[8px]"><span className="text-slate-700">{c.name}</span><span className="tabular-nums text-slate-600">{c.count}</span></span>
                      <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-500" style={{ width: `${(c.count / Math.max(1, data.topCategories[0].count)) * 100}%` }} /></span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          <Link href={buildHref(pathname, {}, { filters: '1' })} className="flex items-center justify-between px-3.5 pb-3 text-[9.5px] font-medium text-blue-600 hover:underline">Browse all categories <ChevronRight size={11} /></Link>
        </Panel>
      </div>

      <LinkAssetsDialog workspaceType={workspaceType} products={data.products.map(p => ({ id: p.id, name: p.name, sku: p.sku }))} assets={data.linkable} />
      <ImportProductsDialog workspaceType={workspaceType} />
    </>
  )
}

// ---------------------------------------------------------------------------

type Perms = { edit: boolean; approve: boolean; archive: boolean }

function ProductTile({ p, base, workspaceType, perms }: { p: ProductCard; base: string; workspaceType: string; perms: Perms }) {
  const href = `${base}/products/${p.id}`
  const score = Math.round(Number(p.readiness_score))
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition-shadow hover:shadow-md">
      <div className="relative aspect-square overflow-hidden bg-slate-100 lg:aspect-[160/165]">
        <Link href={href} aria-label={`Open ${p.name}`} className="block h-full w-full"><AssetThumb name={p.name} kind="image" url={p.primary_asset?.thumbnail_path ?? null} /></Link>
        <ProductBookmark workspaceType={workspaceType} productId={p.id} initial={p.is_favourite} name={p.name} />
        <span className={cn('absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-px text-[9px] font-semibold lg:text-[7.5px]', STATUS_PILL[p.status] ?? STATUS_PILL.draft)}>{humanise(p.status)}</span>
      </div>
      <div className="flex flex-1 flex-col px-2.5 pb-2 pt-2 lg:pt-3 lg:leading-[18px]">
        <Link href={href} className="truncate text-[10.5px] font-semibold text-slate-800 hover:text-blue-600 lg:text-[9px]">{p.name}</Link>
        <p className="text-[9px] text-slate-400 lg:text-[8px]">{p.sku}</p>
        <p className="text-[9px] text-slate-500 lg:text-[8px]">{p.category_name ?? '—'}</p>
        <p className="mt-1 flex items-baseline justify-between text-[9px] lg:mt-0 lg:text-[8px]"><span className="text-slate-500">Linked Assets</span><span className="tabular-nums text-slate-700">{p.linked_asset_count}</span></p>
        <p className="mt-2 flex items-center justify-between gap-1 text-[9px] lg:border-t lg:border-slate-100 lg:pt-2.5 lg:text-[8px]">
          <span className="text-slate-500">Markets</span>
          <span className="flex min-w-0 items-center gap-0.5 truncate text-slate-700"><Globe size={9} className="shrink-0 text-slate-400" aria-hidden="true" />{p.markets.slice(0, 4).join(', ') || '—'}</span>
        </p>
        <div className="mt-2.5 flex items-center justify-between gap-1 lg:border-t lg:border-slate-100 lg:pt-2.5">
          <span className={cn('whitespace-nowrap rounded border px-1 py-0.5 text-[8px] font-semibold lg:leading-3 lg:text-[7.5px]', readinessChip(score))}>Campaign Ready <span className="ml-0.5">{score}%</span></span>
          <ProductMenu workspaceType={workspaceType} productId={p.id} name={p.name} status={p.status} href={href}
            canEdit={perms.edit} canApprove={perms.approve} canArchive={perms.archive} />
        </div>
      </div>
    </article>
  )
}

function ProductList({ products, base }: { products: ProductCard[]; base: string }) {
  return (
    <Panel>
      <ul className="divide-y divide-slate-100">
        {products.map(p => (
          <li key={p.id}>
            <Link href={`${base}/products/${p.id}`} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-50/70">
              <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100"><AssetThumb name={p.name} kind="image" url={p.primary_asset?.thumbnail_path ?? null} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold text-slate-800">{p.name}</span>
                <span className="block truncate text-[11px] text-slate-400">{p.sku} · {p.category_name ?? '—'} · {p.linked_asset_count} linked assets</span>
              </span>
              <span className="hidden w-32 shrink-0 truncate text-[11px] text-slate-500 md:block">{p.markets.join(', ') || '—'}</span>
              <StatusBadge status={p.status} size="xs" />
              <span className={cn('shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold', readinessChip(Number(p.readiness_score)))}>{Math.round(Number(p.readiness_score))}%</span>
              <ChevronRight size={15} className="shrink-0 text-slate-300" />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function ProductTable({ products, base }: { products: ProductCard[]; base: string }) {
  return (
    <Panel>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-medium text-slate-500">
              {['Product', 'SKU', 'Category', 'Brand', 'Markets', 'Linked', 'Status', 'Readiness', 'Owner'].map(h => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-slate-50/70">
                <td className="px-3 py-2">
                  <Link href={`${base}/products/${p.id}`} className="flex min-w-0 items-center gap-2">
                    <span className="h-8 w-8 shrink-0 overflow-hidden rounded bg-slate-100"><AssetThumb name={p.name} kind="image" url={p.primary_asset?.thumbnail_path ?? null} /></span>
                    <span className="truncate text-[12px] font-medium text-slate-800">{p.name}</span>
                  </Link>
                </td>
                <td className="px-3 py-2 text-[11px] text-slate-600">{p.sku}</td>
                <td className="px-3 py-2 text-[11px] text-slate-600">{p.category_name ?? '—'}</td>
                <td className="px-3 py-2 text-[11px] text-slate-600">{p.brand?.name ?? '—'}</td>
                <td className="px-3 py-2 text-[11px] text-slate-600">{p.markets.join(', ') || '—'}</td>
                <td className="px-3 py-2 text-[11px] tabular-nums text-slate-600">{p.linked_asset_count}</td>
                <td className="px-3 py-2"><StatusBadge status={p.status} size="xs" /></td>
                <td className="px-3 py-2"><span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-semibold', readinessChip(Number(p.readiness_score)))}>{Math.round(Number(p.readiness_score))}%</span></td>
                <td className="px-3 py-2"><span className="flex items-center gap-1.5"><Avatar name={p.owner?.full_name ?? '—'} src={p.owner?.avatar_url} size={20} /><span className="truncate text-[11px] text-slate-600">{p.owner?.full_name ?? '—'}</span></span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function ReadinessDonut({ ready, review, notReady, percent }: { ready: number; review: number; notReady: number; percent: number }) {
  const total = ready + review + notReady || 1
  const r = 34, c = 2 * Math.PI * r
  const segs = [[ready, '#10B981'], [review, '#F59E0B'], [notReady, '#EF4444']] as const
  let offset = 0
  return (
    <div className="relative shrink-0">
      <svg width="86" height="86" viewBox="0 0 86 86" className="-rotate-90" role="img" aria-label={`${percent}% campaign ready: ${ready} ready, ${review} in review, ${notReady} not ready`}>
        <circle cx="43" cy="43" r={r} fill="none" stroke="#E2E8F0" strokeWidth="8" />
        {segs.map(([n, col], i) => {
          const len = (n / total) * c
          const el = <circle key={i} cx="43" cy="43" r={r} fill="none" stroke={col} strokeWidth="8" strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-offset} strokeLinecap="round" />
          offset += len
          return el
        })}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[17px] font-bold leading-none text-slate-900">{percent}%</span>
        <span className="mt-0.5 text-[7px] text-slate-400">Campaign Ready</span>
      </span>
    </div>
  )
}
