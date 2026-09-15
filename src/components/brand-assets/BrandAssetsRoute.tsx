import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { resolveBrandContext, type BrandContext } from '@/lib/brand-assets/context'
import {
  BRAND_MODULES, can, isModuleAvailable, labelFor, pathFor, visibleModules,
  type BrandCapability, type BrandModule,
} from '@/lib/brand-assets/entitlements'
import {
  parseAssetFilters, parseKitFilters, parseProductFilters, parseRightsFilters,
  type RawParams,
} from '@/lib/brand-assets/filters'
import {
  getAssetsPage, getKitsPage, getOverviewData, getProductsPage, getRightsPage,
} from '@/lib/brand-assets/queries'
import {
  getActivityPage, getAssetDetail, getCreateLookups, getKitDetail, getLicenseDetail, getProductDetail, isUuid,
} from '@/lib/brand-assets/detail-queries'
import BrandAssetsShell from './shell/BrandAssetsShell'
import { BlockedState } from './ui/primitives'
import OverviewPage from './pages/OverviewPage'
import KitsPage from './pages/KitsPage'
import AssetsPage from './pages/AssetsPage'
import RightsPage from './pages/RightsPage'
import ProductsPage from './pages/ProductsPage'
import {
  ActivityPage, AssetDetailPage, KitDetailPage, LicenseDetailPage, ProductDetailPage,
} from './pages/DetailPages'
import { CreateKitForm, CreateLicenseForm, CreateProductForm } from './client/CreateForms'
import { ImportKitForm } from './client/KitTransfer'

/**
 * Server entry point for `/{type}/brand[/module[/new|/{id}]]` and `/{type}/brand/activity`.
 *
 * Resolves the module from the URL, checks entitlement before doing any work,
 * then loads only that page's data. Record ids are validated and workspace-
 * scoped; an unknown id renders not-found rather than a list page.
 */
export default async function BrandAssetsRoute({
  workspaceType, segments, searchParams,
}: {
  workspaceType: string
  segments: string[]
  searchParams: RawParams
}) {
  const result = await resolveBrandContext(workspaceType)

  if (!result.ok) {
    if (result.kind === 'unauthenticated') redirect(`/login?next=/${workspaceType}/brand`)
    return (
      <div className="mx-auto max-w-lg py-10">
        <BlockedState
          title={result.kind === 'wrong_type' ? 'Workspace not available' : 'No access'}
          message={result.message}
          actionLabel="Back to workspace"
          actionHref={`/${workspaceType}/home`}
        />
      </div>
    )
  }

  const ctx = result.context
  const base = `${ctx.basePath}/brand`

  // segments: ['brand', module?, sub?]. 'activity' is a module-level log, not a tab.
  const isActivity = segments[1] === 'activity'
  const requested = (isActivity ? 'overview' : segments[1] ?? 'overview') as BrandModule
  if (segments[1] && !isActivity && !BRAND_MODULES.includes(requested)) redirect(base)
  const module: BrandModule = BRAND_MODULES.includes(requested) ? requested : 'overview'
  const sub = segments[2]
  if (segments.length > 3) redirect(`${base}/${segments[1]}/${sub}`)

  const modules = visibleModules(ctx.entitlements).map(m => ({
    module: m,
    label: labelFor(m),
    href: pathFor(m) ? `${base}/${pathFor(m)}` : base,
  }))
  const shellProps = { activeModule: module, modules }

  // Gate before querying: an unentitled module must not run its queries at all.
  const availability = isModuleAvailable(ctx.entitlements, module)
  if (!availability.allowed) {
    return (
      <BrandAssetsShell {...shellProps}>
        <BlockedState
          title={availability.reason === 'plan' ? 'Upgrade required' : 'Not available'}
          message={availability.message ?? 'This section is not available for this workspace.'}
          actionLabel={availability.reason === 'plan' ? 'View plans' : undefined}
          actionHref={availability.reason === 'plan' ? `${ctx.basePath}/settings/billing` : undefined}
        />
      </BrandAssetsShell>
    )
  }

  const tab = typeof searchParams.tab === 'string' ? searchParams.tab : undefined
  let content: React.ReactNode
  if (isActivity) {
    const type = typeof searchParams.type === 'string' ? searchParams.type : null
    const page = Math.max(1, Math.min(10_000, Number.parseInt(String(searchParams.page ?? '1'), 10) || 1))
    content = <ActivityPage ctx={ctx} data={await getActivityPage(ctx, type, page)} type={type} page={page} />
  } else if (sub === 'import' && module === 'kits') {
    content = renderImport(ctx, base)
  } else if (sub === 'new') {
    content = await renderCreate(module, ctx, base)
  } else if (sub) {
    content = await renderDetail(module, ctx, base, sub, tab)
  } else {
    content = await renderModule(module, ctx, searchParams)
  }
  return <BrandAssetsShell {...shellProps}>{content}</BrandAssetsShell>
}

function NotFound({ back, label, what }: { back: string; label: string; what: string }) {
  return (
    <div className="mx-auto max-w-lg py-10">
      <BlockedState title={`${what} not found`} message={`This ${what.toLowerCase()} does not exist in this workspace, or it has been removed.`} actionLabel={`Back to ${label}`} actionHref={back} />
    </div>
  )
}

async function renderDetail(module: BrandModule, ctx: BrandContext, base: string, id: string, tab?: string) {
  if (!isUuid(id)) return <NotFound back={base} label="Brand & Assets" what="Record" />
  switch (module) {
    case 'kits': {
      const data = await getKitDetail(ctx, id)
      return data ? <KitDetailPage ctx={ctx} data={data} tab={tab} /> : <NotFound back={`${base}/kits`} label="Brand Kits" what="Brand kit" />
    }
    case 'assets': {
      const data = await getAssetDetail(ctx, id)
      return data ? <AssetDetailPage ctx={ctx} data={data} tab={tab} /> : <NotFound back={`${base}/assets`} label="Assets" what="Asset" />
    }
    case 'rights': {
      const data = await getLicenseDetail(ctx, id)
      return data ? <LicenseDetailPage ctx={ctx} data={data} tab={tab} /> : <NotFound back={`${base}/rights`} label="Rights" what="Licence" />
    }
    case 'products': {
      const data = await getProductDetail(ctx, id)
      return data ? <ProductDetailPage ctx={ctx} data={data} tab={tab} /> : <NotFound back={`${base}/products`} label="Product Library" what="Product" />
    }
    default:
      return <NotFound back={base} label="Brand & Assets" what="Record" />
  }
}

const CREATE_CAP: Partial<Record<BrandModule, [BrandCapability, string]>> = {
  kits: ['brand.kits.create', 'Create Brand Kit'],
  rights: ['brand.rights.create', 'Add License'],
  products: ['brand.products.create', 'Add Product'],
}

async function renderCreate(module: BrandModule, ctx: BrandContext, base: string) {
  const spec = CREATE_CAP[module]
  if (!spec) redirect(`${base}/${pathFor(module)}`)
  const [capability, title] = spec
  const back = `${base}/${pathFor(module)}`
  if (!can(ctx.entitlements, capability)) {
    return <div className="mx-auto max-w-lg py-10"><BlockedState title="Not permitted" message="Your role or plan does not allow creating this record." actionLabel="Go back" actionHref={back} /></div>
  }
  const workspaceType = ctx.basePath.slice(1)
  const brands = ctx.brands.map(b => ({ id: b.id, name: b.name }))
  const lookups = module === 'kits' ? null : await getCreateLookups(ctx)
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={back} className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-800"><ArrowLeft size={14} />{labelFor(module)}</Link>
      <h1 className="mb-1 text-[26px] font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="mb-5 text-[13px] text-slate-500">Saved records are workspace-scoped, audit-logged and appear across Brand &amp; Assets immediately.</p>
      {module === 'kits' && <CreateKitForm workspaceType={workspaceType} brands={brands} base={base} />}
      {module === 'rights' && lookups && <CreateLicenseForm workspaceType={workspaceType} base={base} brands={brands} assets={lookups.assets} products={lookups.products}
        territories={lookups.territories.map(t => ({ id: t.id, name: t.name }))} channels={lookups.channels.map(c => ({ id: c.id, name: c.name }))} />}
      {module === 'products' && lookups && <CreateProductForm workspaceType={workspaceType} base={base} brands={brands} categories={lookups.categories} />}
    </div>
  )
}

function renderImport(ctx: BrandContext, base: string) {
  const back = `${base}/kits`
  if (!can(ctx.entitlements, 'brand.kits.create')) {
    return <div className="mx-auto max-w-lg py-10"><BlockedState title="Not permitted" message="Importing a brand kit requires permission to create brand kits." actionLabel="Go back" actionHref={back} /></div>
  }
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={back} className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-800"><ArrowLeft size={14} />Brand Kits</Link>
      <h1 className="mb-1 text-[26px] font-bold tracking-tight text-slate-900">Import Brand Kit</h1>
      <p className="mb-5 text-[13px] text-slate-500">Bring in a brand system exported from Caption Fox. The new kit is workspace-scoped, audit-logged and starts at version 1.</p>
      <ImportKitForm workspaceType={ctx.basePath.slice(1)} brands={ctx.brands.map(b => ({ id: b.id, name: b.name }))} base={base} />
    </div>
  )
}

async function renderModule(
  module: BrandModule,
  ctx: BrandContext,
  searchParams: RawParams,
) {
  switch (module) {
    case 'kits': {
      const filters = parseKitFilters(searchParams)
      const data = await getKitsPage(ctx, filters)
      return <KitsPage ctx={ctx} data={data} filters={filters} params={searchParams} />
    }
    case 'assets': {
      const filters = parseAssetFilters(searchParams)
      const data = await getAssetsPage(ctx, filters)
      return <AssetsPage ctx={ctx} data={data} filters={filters} params={searchParams} />
    }
    case 'rights': {
      const filters = parseRightsFilters(searchParams)
      const data = await getRightsPage(ctx, filters)
      return <RightsPage ctx={ctx} data={data} filters={filters} params={searchParams} />
    }
    case 'products': {
      const filters = parseProductFilters(searchParams)
      const data = await getProductsPage(ctx, filters)
      return <ProductsPage ctx={ctx} data={data} filters={filters} params={searchParams} />
    }
    default: {
      const rtype = typeof searchParams.rtype === 'string' ? searchParams.rtype : null
      const rsort = searchParams.rsort === 'name_asc' || searchParams.rsort === 'size_desc' ? searchParams.rsort : 'newest'
      const KINDS = ['image', 'video', 'audio', 'pdf', 'presentation', 'document', 'design', 'social', 'packaging', 'template', 'archive']
      const data = await getOverviewData(ctx, { recentKind: rtype && KINDS.includes(rtype) ? rtype : null, recentSort: rsort })
      return <OverviewPage ctx={ctx} data={data} params={searchParams} />
    }
  }
}
