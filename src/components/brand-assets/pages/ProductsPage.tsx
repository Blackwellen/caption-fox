import Link from 'next/link'
import {
  Bookmark, Boxes, ChevronRight, CircleCheck, FileWarning, Globe, Link2,
  MoreHorizontal, Package, PackageOpen, Plus, Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BrandContext } from '@/lib/brand-assets/context'
import type { ProductsPage as ProductsPageData } from '@/lib/brand-assets/queries'
import { buildHref, chipsFor, type ProductFilters, type RawParams } from '@/lib/brand-assets/filters'
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
import { formatCount, formatRelativeShort } from '../tokens'
import type { ProductCard } from '@/types/brand-assets'

/** Readiness colour follows the same thresholds the badge text states. */
function readinessTone(score: number): string {
  if (score >= 90) return 'text-emerald-600'
  if (score >= 70) return 'text-amber-600'
  return 'text-rose-600'
}

function readinessChip(score: number): string {
  if (score >= 90) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (score >= 70) return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-rose-50 text-rose-700 border-rose-200'
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

  const kpis: KpiSpec[] = [
    { key: 'products', label: 'Products', value: formatCount(k.products), icon: Package, tone: 'blue',
      delta: null, deltaSuffix: '', riseIsGood: true, href: pathname, tooltip: 'All products in the catalogue' },
    { key: 'skus', label: 'Active SKUs', value: formatCount(k.activeSkus), icon: Boxes, tone: 'green',
      delta: null, deltaSuffix: '', riseIsGood: true, href: null, tooltip: 'Variants with an active status' },
    { key: 'draft', label: 'Draft Products', value: formatCount(k.draftProducts), icon: PackageOpen, tone: 'amber',
      delta: null, deltaSuffix: '', riseIsGood: false, href: buildHref(pathname, params, { status: 'draft' }),
      tooltip: 'Products not yet published' },
    { key: 'linked', label: 'Linked Assets', value: formatCount(k.linkedAssets), icon: Link2, tone: 'purple',
      delta: null, deltaSuffix: '', riseIsGood: true, href: `${base}/assets`, tooltip: 'Asset links across all products' },
    { key: 'ready', label: 'Campaign Ready', value: `${k.campaignReady}%`, icon: CircleCheck, tone: 'emerald',
      delta: null, deltaSuffix: '', riseIsGood: true, href: buildHref(pathname, params, { readiness: 'ready' }),
      ring: k.campaignReady, tooltip: 'Share of products passing every readiness check' },
    { key: 'missing', label: 'Missing Assets', value: formatCount(k.missingAssets), icon: FileWarning, tone: 'red',
      delta: null, deltaSuffix: '', riseIsGood: false, href: buildHref(pathname, params, { readiness: 'not_ready' }),
      tooltip: 'Failed readiness checks across the catalogue' },
  ]

  const chips = chipsFor(
    { q: filters.q, category: filters.categoryId, status: filters.status, market: filters.market, readiness: filters.readiness },
    { q: 'Search', category: 'Category', status: 'Status', market: 'Market', readiness: 'Readiness' },
  )

  return (
    <>
      <PageHeading
        title="Product Library"
        subtitle="Manage your product catalog, SKUs, linked assets, brand alignment and readiness for campaigns."
        actions={
          <>
            <ActionLink href={buildHref(pathname, params, { create: 1 })} icon={Plus}
              disabled={!can(e, 'brand.products.create')}
              title={can(e, 'brand.products.create') ? undefined : 'Your role does not permit adding products'}>
              Add Product
            </ActionLink>
            <ActionLink href={buildHref(pathname, params, { import: 1 })} icon={Upload}
              disabled={!can(e, 'brand.products.import')}
              title={can(e, 'brand.products.import') ? undefined : 'Your role does not permit importing products'}>
              Import Products
            </ActionLink>
            <ActionLink href={buildHref(pathname, params, { link: 1 })} icon={Link2} tone="primary"
              disabled={!can(e, 'brand.products.edit')}
              title={can(e, 'brand.products.edit') ? undefined : 'Your role does not permit linking assets'}>
              Link Assets
            </ActionLink>
          </>
        }
      />

      <KpiStrip items={kpis} />

      <FilterBar>
        <SearchField pathname={pathname} params={params} placeholder="Search products, SKUs, categories…"
          defaultValue={filters.q} className="w-full max-w-[280px]" />
        <FilterSelect pathname={pathname} params={params} name="category" label="Category" allLabel="All"
          value={filters.categoryId} options={data.categories.map(c => ({ value: c.id, label: c.name }))} />
        <FilterSelect pathname={pathname} params={params} name="collection" label="Collection" allLabel="All"
          value={filters.collectionId} options={data.collections.map(c => ({ value: c.id, label: c.name }))} />
        <FilterSelect pathname={pathname} params={params} name="status" label="Status" allLabel="All"
          value={filters.status} options={[
            { value: 'active', label: 'Active' }, { value: 'review', label: 'Review' },
            { value: 'draft', label: 'Draft' }, { value: 'inactive', label: 'Inactive' },
            { value: 'discontinued', label: 'Discontinued' },
          ]} />
        <FilterSelect pathname={pathname} params={params} name="readiness" label="Readiness" allLabel="All"
          value={filters.readiness} options={[
            { value: 'ready', label: 'Ready' }, { value: 'review', label: 'Review' }, { value: 'not_ready', label: 'Not ready' },
          ]} />
        <FilterSelect pathname={pathname} params={params} name="brand" label="Brand" allLabel="All Brands"
          value={filters.brandId} options={ctx.brands.map(b => ({ value: b.id, label: b.name }))} />
        <MoreFiltersButton pathname={pathname} params={params} activeCount={chips.length} />
        <div className="ml-auto flex items-center gap-2">
          <ViewSwitcher pathname={pathname} params={params} active={filters.view}
            views={[{ value: 'cards', label: 'Cards' }, { value: 'list', label: 'List' }, { value: 'table', label: 'Table' }]} />
          <SortSelect pathname={pathname} params={params} value={filters.sort} options={[
            { value: 'recently_updated', label: 'Recently Updated' },
            { value: 'name_asc', label: 'Name A–Z' }, { value: 'sku_asc', label: 'SKU' },
            { value: 'readiness_desc', label: 'Most ready' }, { value: 'readiness_asc', label: 'Least ready' },
          ]} />
        </div>
      </FilterBar>

      <FilterChips pathname={pathname} params={params} chips={chips} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_288px]">
        <div className="min-w-0 space-y-4">
          {data.products.length === 0 ? (
            <Panel>
              <EmptyPanel
                icon={Package}
                title={chips.length ? 'No products match those filters' : 'No products yet'}
                body={chips.length
                  ? 'Try a different search term or clear the filters to see everything.'
                  : 'Add products to link assets, track markets and measure campaign readiness.'}
                action={chips.length ? 'Clear filters' : (can(e, 'brand.products.create') ? 'Add Product' : undefined)}
                actionHref={chips.length ? pathname : buildHref(pathname, params, { create: 1 })}
              />
            </Panel>
          ) : filters.view === 'list' ? (
            <ProductList products={data.products} base={base} />
          ) : filters.view === 'table' ? (
            <ProductTable products={data.products} base={base} />
          ) : (
            <>
              <ProductCards products={data.products} base={base} />
              <Link href={buildHref(pathname, params, { pageSize: 100 })}
                className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white py-2.5 text-[13px] font-semibold text-blue-600 hover:bg-slate-50">
                View all products <ChevronRight size={14} />
              </Link>
            </>
          )}

          {data.total > filters.pageSize && (
            <Panel>
              <Pagination page={filters.page} pageSize={filters.pageSize} total={data.total}
                hrefFor={patch => buildHref(pathname, params, patch)} />
            </Panel>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Flagged Products" action="View all" actionHref={buildHref(pathname, params, { readiness: 'not_ready' })} dense>
              {data.flagged.length === 0
                ? <EmptyPanel title="Nothing flagged" body="Products failing readiness checks appear here." />
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          <th className="px-4 py-2">Product</th>
                          <th className="px-2 py-2">Issue</th>
                          <th className="px-2 py-2">Status</th>
                          <th className="px-2 py-2">Owner</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {data.flagged.map(f => (
                          <tr key={f.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2">
                              <Link href={`${base}/products?product=${f.id}`} className="block min-w-0">
                                <span className="block truncate text-[12px] font-medium text-slate-800">{f.name}</span>
                                <span className="block text-[10px] text-slate-400">{f.sku}</span>
                              </Link>
                            </td>
                            <td className="px-2 py-2 text-[11px] text-slate-600">{f.issue}</td>
                            <td className="px-2 py-2"><StatusBadge status={f.status === 'Not Ready' ? 'not_ready' : 'review'} label={f.status} /></td>
                            <td className="px-2 py-2">
                              <span className="flex items-center gap-1.5">
                                <Avatar name={f.owner?.full_name ?? '—'} src={f.owner?.avatar_url} size={18} />
                                <span className="truncate text-[11px] text-slate-600">{f.owner?.full_name ?? '—'}</span>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </Panel>

            <Panel title="Recent Product Updates" action="View all" actionHref={pathname} dense>
              {data.recentUpdates.length === 0
                ? <EmptyPanel title="No recent updates" body="Product changes appear here." />
                : (
                  <ul className="divide-y divide-slate-50">
                    {data.recentUpdates.map(u => (
                      <li key={u.id} className="flex items-center gap-2.5 px-4 py-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-slate-100">
                          <Package size={13} className="text-slate-500" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-medium text-slate-800">{u.summary}</span>
                          <span className="block truncate text-[10px] text-slate-400">{u.actor?.full_name ?? 'System'}</span>
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-400">{formatRelativeShort(u.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
            </Panel>

            <Panel title="Top Categories" action="Browse all categories" actionHref={pathname} dense>
              {data.topCategories.length === 0
                ? <EmptyPanel title="No categories" body="Assign categories to products to see this breakdown." />
                : (
                  <ul className="space-y-2.5 px-4 py-3">
                    {data.topCategories.map(c => (
                      <li key={c.name}>
                        <div className="mb-1 flex items-baseline justify-between text-[11px]">
                          <Link href={pathname} className="truncate font-medium text-slate-700 hover:text-blue-600">{c.name}</Link>
                          <span className="shrink-0 tabular-nums font-semibold text-slate-700">{c.count}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-blue-500"
                            style={{ width: `${Math.min(100, (c.count / Math.max(1, data.topCategories[0].count)) * 100)}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
            </Panel>
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <Panel title="Missing Product Assets" action="View all" actionHref={buildHref(pathname, params, { readiness: 'not_ready' })} dense>
            {data.missingBreakdown.length === 0
              ? <EmptyPanel title="Nothing missing" body="Every product has its required assets." />
              : (
                <ul className="divide-y divide-slate-50">
                  {data.missingBreakdown.map(m => (
                    <li key={m.key}>
                      <Link href={buildHref(pathname, params, { missing: m.key })}
                        className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50">
                        <FileWarning size={13} className="shrink-0 text-amber-500" />
                        <span className="min-w-0 flex-1 truncate text-[12px] text-slate-700">{m.label}</span>
                        <span className="shrink-0 text-[12px] font-semibold tabular-nums text-slate-700">{m.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
          </Panel>

          <Panel title="Campaign Readiness" dense>
            <div className="px-4 py-3">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <ProgressRing value={data.readiness.percent} size={82} stroke={11} className="stroke-emerald-500" />
                  <span className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold leading-none text-slate-900">{data.readiness.percent}%</span>
                    <span className="mt-0.5 text-[8px] text-slate-400">Campaign Ready</span>
                  </span>
                </div>
                <ul className="min-w-0 flex-1 space-y-1.5 text-[11px]">
                  <li className="flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <span className="flex-1 text-slate-600">Ready</span>
                    <span className="shrink-0 tabular-nums font-semibold text-slate-700">{data.readiness.ready}</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                    <span className="flex-1 text-slate-600">Review</span>
                    <span className="shrink-0 tabular-nums font-semibold text-slate-700">{data.readiness.review}</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                    <span className="flex-1 text-slate-600">Not Ready</span>
                    <span className="shrink-0 tabular-nums font-semibold text-slate-700">{data.readiness.notReady}</span>
                  </li>
                </ul>
              </div>
              <Link href={buildHref(pathname, params, { view: 'table', sort: 'readiness_asc' })}
                className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[12px] font-medium text-blue-600 hover:text-blue-700">
                View readiness details <ChevronRight size={13} />
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------

function ProductCards({ products, base }: { products: ProductCard[]; base: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
      {products.map(p => (
        <article key={p.id} className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-sm">
          <Link href={`${base}/products?product=${p.id}`} className="relative block aspect-square overflow-hidden bg-slate-100">
            <AssetThumb name={p.name} kind="image" url={p.primary_asset?.thumbnail_path ?? null} />
            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-slate-400">
              <Bookmark size={12} fill={p.is_favourite ? 'currentColor' : 'none'} />
            </span>
            <span className="absolute bottom-2 left-2"><StatusBadge status={p.status} /></span>
          </Link>
          <div className="flex flex-1 flex-col gap-1 p-3">
            <Link href={`${base}/products?product=${p.id}`} className="truncate text-[13px] font-semibold text-slate-800 hover:text-blue-600">
              {p.name}
            </Link>
            <p className="text-[10px] text-slate-400">{p.sku}</p>
            <p className="truncate text-[10px] text-slate-500">{p.category_name ?? '—'}</p>
            <p className="mt-1 flex items-baseline justify-between text-[10px]">
              <span className="text-slate-400">Linked Assets</span>
              <span className="font-semibold text-slate-700">{p.linked_asset_count}</span>
            </p>
            <p className="flex items-center gap-1 truncate text-[10px] text-slate-500">
              <Globe size={9} className="shrink-0" />
              {p.markets.length ? p.markets.slice(0, 4).join(', ') : '—'}
            </p>
            <div className="mt-auto flex items-center justify-between gap-1 border-t border-slate-100 pt-2">
              <span className={cn('rounded border px-1.5 py-0.5 text-[9px] font-semibold', readinessChip(p.readiness_score))}>
                Campaign Ready {Math.round(p.readiness_score)}%
              </span>
              <MoreHorizontal size={13} className="shrink-0 text-slate-300" />
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

function ProductList({ products, base }: { products: ProductCard[]; base: string }) {
  return (
    <Panel>
      <ul className="divide-y divide-slate-100">
        {products.map(p => (
          <li key={p.id}>
            <Link href={`${base}/products?product=${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200">
                <AssetThumb name={p.name} kind="image" url={p.primary_asset?.thumbnail_path ?? null} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-slate-800">{p.name}</span>
                <span className="block truncate text-[11px] text-slate-400">
                  {p.sku} · {p.category_name ?? '—'} · {p.linked_asset_count} linked assets
                </span>
              </span>
              <span className="hidden w-32 shrink-0 truncate text-[11px] text-slate-500 md:block">
                {p.markets.slice(0, 3).join(', ') || '—'}
              </span>
              <StatusBadge status={p.status} />
              <span className={cn('shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold', readinessChip(p.readiness_score))}>
                {Math.round(p.readiness_score)}%
              </span>
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
            <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5">Product</th>
              <th className="px-3 py-2.5">SKU</th>
              <th className="px-3 py-2.5">Category</th>
              <th className="px-3 py-2.5">Brand</th>
              <th className="px-3 py-2.5">Markets</th>
              <th className="px-3 py-2.5">Linked</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Readiness</th>
              <th className="px-3 py-2.5">Owner</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link href={`${base}/products?product=${p.id}`} className="flex min-w-0 items-center gap-2">
                    <span className="h-8 w-8 shrink-0 overflow-hidden rounded border border-slate-200">
                      <AssetThumb name={p.name} kind="image" url={p.primary_asset?.thumbnail_path ?? null} />
                    </span>
                    <span className="truncate text-[13px] font-medium text-slate-800">{p.name}</span>
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-[12px] text-slate-600">{p.sku}</td>
                <td className="px-3 py-2.5 text-[12px] text-slate-600">{p.category_name ?? '—'}</td>
                <td className="px-3 py-2.5 text-[12px] text-slate-600">{p.brand?.name ?? '—'}</td>
                <td className="px-3 py-2.5 text-[12px] text-slate-600">{p.markets.slice(0, 3).join(', ') || '—'}</td>
                <td className="px-3 py-2.5 text-[12px] tabular-nums text-slate-600">{p.linked_asset_count}</td>
                <td className="px-3 py-2.5"><StatusBadge status={p.status} /></td>
                <td className="px-3 py-2.5">
                  <span className={cn('text-[12px] font-semibold tabular-nums', readinessTone(p.readiness_score))}>
                    {Math.round(p.readiness_score)}%
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-1.5">
                    <Avatar name={p.owner?.full_name ?? '—'} src={p.owner?.avatar_url} size={20} />
                    <span className="truncate text-[12px] text-slate-600">{p.owner?.full_name ?? '—'}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
