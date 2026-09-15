import { redirect } from 'next/navigation'
import { resolveBrandContext, type BrandContext } from '@/lib/brand-assets/context'
import {
  BRAND_MODULES, isModuleAvailable, labelFor, pathFor, visibleModules,
  can, type BrandModule,
} from '@/lib/brand-assets/entitlements'
import {
  parseAssetFilters, parseKitFilters, parseProductFilters, parseRightsFilters,
  type RawParams,
} from '@/lib/brand-assets/filters'
import {
  getAssetsPage, getKitsPage, getOverviewData, getProductsPage, getRightsPage,
} from '@/lib/brand-assets/queries'
import BrandAssetsShell from './shell/BrandAssetsShell'
import { BlockedState } from './ui/primitives'
import OverviewPage from './pages/OverviewPage'
import KitsPage from './pages/KitsPage'
import AssetsPage from './pages/AssetsPage'
import RightsPage from './pages/RightsPage'
import ProductsPage from './pages/ProductsPage'

/**
 * Server entry point for `/{type}/brand[/module]`.
 *
 * Resolves the module from the URL, checks entitlement before doing any work,
 * then loads only that page's data.
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
      <div className="min-h-screen bg-slate-100 p-10">
        <div className="mx-auto max-w-lg">
          <BlockedState
            title={result.kind === 'wrong_type' ? 'Workspace not available' : 'No access'}
            message={result.message}
            actionLabel="Back to workspace"
            actionHref={`/${workspaceType}`}
          />
        </div>
      </div>
    )
  }

  const ctx = result.context
  const base = `${ctx.basePath}/brand`

  // segments[0] is 'brand'; segments[1] is the module, if any.
  const requested = (segments[1] ?? 'overview') as BrandModule
  const module: BrandModule = BRAND_MODULES.includes(requested) ? requested : 'overview'

  // An unknown sub-path under /brand is a renamed or dead route — send it to the
  // module index rather than rendering a 404 inside a valid workspace.
  if (segments[1] && !BRAND_MODULES.includes(requested)) redirect(base)

  const modules = visibleModules(ctx.entitlements).map(m => ({
    module: m,
    label: labelFor(m),
    href: pathFor(m) ? `${base}/${pathFor(m)}` : base,
  }))

  const shellProps = {
    basePath: ctx.basePath,
    activeModule: module,
    modules,
    user: {
      name: ctx.workspace.name,
      role: ctx.role.charAt(0).toUpperCase() + ctx.role.slice(1),
      avatarUrl: null,
    },
    brands: ctx.brands.map(b => ({ id: b.id, name: b.name, logoUrl: b.logo_url })),
    activeBrandName: ctx.activeBrand?.name ?? ctx.workspace.name,
    counts: { notifications: 0, tasks: 0 },
    canUpload: can(ctx.entitlements, 'brand.assets.upload'),
  }

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

  const content = await renderModule(module, ctx, searchParams)
  return <BrandAssetsShell {...shellProps}>{content}</BrandAssetsShell>
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
      const data = await getOverviewData(ctx)
      return <OverviewPage ctx={ctx} data={data} />
    }
  }
}
