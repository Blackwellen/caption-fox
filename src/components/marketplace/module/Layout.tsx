import Link from 'next/link'
import { Lock, ShieldAlert, PlayCircle, SearchX } from 'lucide-react'
import { MARKETPLACE_BASE, type MarketplaceModule } from '@/lib/marketplace/module'
import type { ModuleAccess } from '@/lib/marketplace/entitlements'
import { MarketplaceTabs, DiscoverModeNav } from './MarketplaceNav'

/**
 * Shared page chrome for every Marketplace surface: breadcrumb, title, tab strip
 * and (on the Discover family) the specialist search-mode nav. Keeping this in
 * one component is what holds the nine pages to a single shell width and header
 * rhythm.
 */
export function MarketplacePage({
  module, modules, title, subtitle, breadcrumb, actions, showDiscoverNav, children,
}: {
  module: MarketplaceModule
  modules: MarketplaceModule[]
  title: string
  subtitle: string
  breadcrumb?: { label: string; href?: string }[]
  actions?: React.ReactNode
  showDiscoverNav?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
          {breadcrumb.map((crumb, index) => (
            <span key={crumb.label} className="flex items-center gap-1.5">
              {index > 0 && <span aria-hidden="true">/</span>}
              {crumb.href
                ? <Link href={crumb.href} className="transition-colors hover:text-slate-600">{crumb.label}</Link>
                : <span className="font-medium text-slate-600">{crumb.label}</span>}
            </span>
          ))}
        </nav>
      )}

      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <Link
            href="/help/marketplace"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <PlayCircle size={15} />How it works
          </Link>
        </div>
      </header>

      <MarketplaceTabs active={module} modules={modules} />
      {showDiscoverNav && <DiscoverModeNav active={module} modules={modules} />}

      <div className="mt-5 space-y-5">{children}</div>
    </div>
  )
}

/** Canonical blocked / upgrade state rendered inside the Marketplace shell. */
export function AccessBlocked({ access, title }: { access: Exclude<ModuleAccess, { allowed: true }>; title: string }) {
  const upgrade = access.upgrade
  const Icon = upgrade ? Lock : ShieldAlert
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
      <span className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${upgrade ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
        <Icon size={22} />
      </span>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{access.message}</p>
      {upgrade && (
        <div className="mt-5 flex items-center justify-center gap-2">
          <Link href="/app/settings/billing" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            View plans and upgrade
          </Link>
          <Link href={MARKETPLACE_BASE} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Back to Marketplace
          </Link>
        </div>
      )}
      {!upgrade && (
        <Link href={MARKETPLACE_BASE} className="mt-5 inline-block rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Back to Marketplace
        </Link>
      )}
    </div>
  )
}

/** Empty state for a search that legitimately returned nothing. */
export function NoResults({
  title = 'No matches for these filters',
  description = 'Try widening your budget, removing a filter, or searching a broader term.',
  action,
}: {
  title?: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <SearchX size={22} />
      </span>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">{description}</p>
      {action && <div className="mt-5 flex justify-center gap-2">{action}</div>}
    </div>
  )
}
