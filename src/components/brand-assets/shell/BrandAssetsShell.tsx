'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Bell, Boxes, ChevronDown, ChevronLeft, FileBarChart, FolderKanban, HelpCircle,
  Image as ImageIcon, LayoutGrid, Menu, Package, PanelsTopLeft, Search, Settings,
  ShieldCheck, SlidersHorizontal, Upload, Users, X, ClipboardCheck, ListChecks,
  Activity, BadgeCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { layout } from '../tokens'
import type { BrandModule } from '@/lib/brand-assets/entitlements'

export interface ShellUser {
  name: string
  role: string
  avatarUrl: string | null
}

export interface ShellBrand {
  id: string
  name: string
  logoUrl: string | null
}

export interface ShellNavCounts {
  tasks?: number
  notifications?: number
}

export interface BrandAssetsShellProps {
  basePath: string                    // '/brand', '/agency', …
  activeModule: BrandModule
  modules: { module: BrandModule; label: string; href: string }[]
  user: ShellUser
  brands: ShellBrand[]
  activeBrandName: string
  counts?: ShellNavCounts
  searchPlaceholder?: string
  canUpload: boolean
  children: React.ReactNode
}

const MODULE_ICON: Record<BrandModule, React.ComponentType<{ size?: number; className?: string }>> = {
  overview: LayoutGrid,
  kits: PanelsTopLeft,
  assets: ImageIcon,
  rights: ShieldCheck,
  products: Package,
}

export default function BrandAssetsShell({
  basePath, activeModule, modules, user, brands, activeBrandName,
  counts, searchPlaceholder = 'Search brands, assets, products, kits…',
  canUpload, children,
}: BrandAssetsShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [brandMenu, setBrandMenu] = useState(false)

  const brandManagement = modules.filter(m => m.module !== 'overview')
  const overview = modules.find(m => m.module === 'overview')
  // Search and Quick Upload both live in the Assets module; when it is gated
  // they must not offer a route the workspace cannot open.
  const assetsAvailable = modules.some(m => m.module === 'assets')
  const searchAction = assetsAvailable ? `${basePath}/brand/assets` : `${basePath}/brand`

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* ---------------- Sidebar ---------------- */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-slate-200 bg-white transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[68px]' : layout.sidebarWidth,
        )}
      >
        <SidebarBody
          basePath={basePath} activeModule={activeModule}
          overview={overview} brandManagement={brandManagement}
          collapsed={collapsed} counts={counts}
          brands={brands} activeBrandName={activeBrandName}
          brandMenu={brandMenu} setBrandMenu={setBrandMenu}
        />
        <button
          onClick={() => setCollapsed(v => !v)}
          className="flex items-center gap-2 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          <ChevronLeft size={16} className={cn('transition-transform', collapsed && 'rotate-180')} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </aside>

      {/* ---------------- Mobile drawer ---------------- */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close navigation"
          />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-xs flex-col bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <FoxLogo />
              <button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close navigation">
                <X size={18} />
              </button>
            </div>
            <SidebarBody
              basePath={basePath} activeModule={activeModule}
              overview={overview} brandManagement={brandManagement}
              collapsed={false} counts={counts}
              brands={brands} activeBrandName={activeBrandName}
              brandMenu={brandMenu} setBrandMenu={setBrandMenu}
              hideLogo
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ---------------- Main column ---------------- */}
      <div className={cn('flex min-h-screen flex-col', collapsed ? 'lg:pl-[68px]' : 'lg:pl-56')}>
        {/* Top bar */}
        <header className={cn(
          'sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-6',
          layout.topBarHeight,
        )}>
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>

          <form action={searchAction} className="hidden max-w-[420px] flex-1 sm:block" role="search">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                name="q"
                placeholder={searchPlaceholder}
                aria-label="Search Brand and Assets"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-2">
            {canUpload && assetsAvailable && (
              <div className="hidden items-center sm:flex">
                <Link
                  href={`${basePath}/brand/assets?upload=1`}
                  className="inline-flex h-9 items-center gap-2 rounded-l-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Upload size={15} />
                  Quick Upload
                </Link>
                <button
                  className="inline-flex h-9 items-center rounded-r-lg border border-l-0 border-slate-200 bg-white px-2 text-slate-500 hover:bg-slate-50"
                  aria-label="More upload options"
                >
                  <ChevronDown size={15} />
                </button>
              </div>
            )}

            <button className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={`Notifications${counts?.notifications ? `, ${counts.notifications} unread` : ''}`}>
              <Bell size={18} />
              {!!counts?.notifications && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">
                  {counts.notifications}
                </span>
              )}
            </button>

            <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Help">
              <HelpCircle size={18} />
            </button>

            <button className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-slate-100" aria-label="Account menu">
              <Avatar name={user.name} src={user.avatarUrl} size={32} />
              <span className="hidden text-left leading-tight md:block">
                <span className="block text-sm font-semibold text-slate-900">{user.name}</span>
                <span className="block text-xs text-slate-500">{user.role}</span>
              </span>
              <ChevronDown size={15} className="hidden text-slate-400 md:block" />
            </button>
          </div>
        </header>

        {/* Module tabs */}
        <nav
          className="sticky top-16 z-20 shrink-0 border-b border-slate-200 bg-white px-4 lg:px-6"
          aria-label="Brand and Assets sections"
        >
          <div className="flex gap-6 overflow-x-auto">
            {modules.map(m => (
              <Link
                key={m.module}
                href={m.href}
                aria-current={m.module === activeModule ? 'page' : undefined}
                className={cn(
                  'whitespace-nowrap border-b-2 px-0.5 py-3.5 text-sm transition-colors',
                  m.module === activeModule
                    ? 'border-blue-600 font-semibold text-blue-600'
                    : 'border-transparent font-medium text-slate-500 hover:text-slate-800',
                )}
              >
                {m.label}
              </Link>
            ))}
          </div>
        </nav>

        <main className="flex-1 px-4 pb-10 pt-5 lg:px-6">
          <div className={cn('mx-auto', layout.contentMaxWidth)}>{children}</div>
        </main>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function SidebarBody({
  basePath, activeModule, overview, brandManagement, collapsed, counts,
  brands, activeBrandName, brandMenu, setBrandMenu, hideLogo, onNavigate,
}: {
  basePath: string
  activeModule: BrandModule
  overview?: { module: BrandModule; label: string; href: string }
  brandManagement: { module: BrandModule; label: string; href: string }[]
  collapsed: boolean
  counts?: ShellNavCounts
  brands: ShellBrand[]
  activeBrandName: string
  brandMenu: boolean
  setBrandMenu: (v: boolean) => void
  hideLogo?: boolean
  onNavigate?: () => void
}) {
  const available = new Set(brandManagement.map(m => m.module))
  const hasAssets = available.has('assets')
  const hasRights = available.has('rights')
  const hasProducts = available.has('products')

  return (
    <>
      {!hideLogo && (
        <div className={cn('flex items-center border-b border-slate-200', collapsed ? 'justify-center px-3 py-4' : 'px-4 py-4')}>
          <FoxLogo compact={collapsed} />
        </div>
      )}

      {/* Brand / workspace switcher */}
      {!collapsed && (
        <div className="relative px-3 pb-1 pt-3">
          <button
            onClick={() => setBrandMenu(!brandMenu)}
            aria-expanded={brandMenu}
            aria-haspopup="listbox"
            className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left hover:bg-slate-50"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-500">
              <Boxes size={14} />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{activeBrandName}</span>
            <ChevronDown size={15} className="shrink-0 text-slate-400" />
          </button>
          {brandMenu && (
            <div role="listbox" className="absolute inset-x-3 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Brands</p>
              {brands.length === 0 && <p className="px-3 py-2 text-sm text-slate-500">No brands yet</p>}
              {brands.map(b => (
                <Link
                  key={b.id}
                  href={`${basePath}/brand?brand=${b.id}`}
                  onClick={() => { setBrandMenu(false); onNavigate?.() }}
                  className="block truncate px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  role="option"
                  aria-selected={b.name === activeBrandName}
                >
                  {b.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Brand and Assets navigation">
        {overview && (
          <NavLink
            href={overview.href} label="Overview" icon={LayoutGrid}
            active={activeModule === 'overview'} collapsed={collapsed} onNavigate={onNavigate}
          />
        )}

        <NavGroup label="Brand Management" collapsed={collapsed} />
        {brandManagement.map(m => (
          <NavLink
            key={m.module} href={m.href} label={m.label}
            icon={MODULE_ICON[m.module]}
            active={activeModule === m.module} collapsed={collapsed} onNavigate={onNavigate}
          />
        ))}

        {/* Workflow and Insights deep-link into module views, so each entry is
            shown only when that module is actually available to the workspace.
            An entitlement-blocked module must not be reachable from the nav. */}
        {(hasAssets || hasProducts) && <NavGroup label="Workflow" collapsed={collapsed} />}
        {hasAssets && <NavLink href={`${basePath}/brand/assets?status=pending`} label="Requests" icon={ClipboardCheck} collapsed={collapsed} onNavigate={onNavigate} />}
        {hasAssets && <NavLink href={`${basePath}/brand/assets?status=pending&view=table`} label="Approvals" icon={BadgeCheck} collapsed={collapsed} onNavigate={onNavigate} />}
        {hasProducts && <NavLink href={`${basePath}/brand/products?readiness=not_ready`} label="Tasks" icon={ListChecks} badge={counts?.tasks} collapsed={collapsed} onNavigate={onNavigate} />}

        {(hasAssets || hasRights || hasProducts) && <NavGroup label="Insights" collapsed={collapsed} />}
        {hasAssets && <NavLink href={`${basePath}/brand/assets?sort=downloads`} label="Usage" icon={Activity} collapsed={collapsed} onNavigate={onNavigate} />}
        {hasRights && <NavLink href={`${basePath}/brand/rights?status=expiring_soon`} label="Compliance" icon={ShieldCheck} collapsed={collapsed} onNavigate={onNavigate} />}
        {hasProducts && <NavLink href={`${basePath}/brand/products?view=table`} label="Reports" icon={FileBarChart} collapsed={collapsed} onNavigate={onNavigate} />}

        <NavGroup label="Admin" collapsed={collapsed} />
        <NavLink href={`${basePath}/settings/people`} label="Users & Teams" icon={Users} collapsed={collapsed} onNavigate={onNavigate} />
        <NavLink href={`${basePath}/settings/workspace`} label="Settings" icon={Settings} collapsed={collapsed} onNavigate={onNavigate} />
        <NavLink href={`${basePath}/settings/channels`} label="Integrations" icon={FolderKanban} collapsed={collapsed} onNavigate={onNavigate} />
      </nav>
    </>
  )
}

function NavGroup({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="my-2 border-t border-slate-200" />
  return (
    <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
      {label}
    </p>
  )
}

function NavLink({
  href, label, icon: Icon, active, collapsed, badge, onNavigate,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  active?: boolean
  collapsed: boolean
  badge?: number
  onNavigate?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
        collapsed && 'justify-center px-0',
        active
          ? 'bg-blue-50 font-semibold text-blue-700'
          : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900',
      )}
    >
      <Icon size={17} className={active ? 'text-blue-600' : 'text-slate-400'} />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && !!badge && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1.5 text-[11px] font-semibold text-blue-700">
          {badge}
        </span>
      )}
    </Link>
  )
}

function FoxLogo({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          {/* Fox mark: ears + muzzle, drawn rather than raster so it stays crisp. */}
          <path d="M3 4l3.2 2.4A9.6 9.6 0 0 1 12 5c2.1 0 4.1.5 5.8 1.4L21 4l-.6 4.6c.4 1 .6 2.1.6 3.2 0 4.6-4 8.2-9 8.2s-9-3.6-9-8.2c0-1.1.2-2.2.6-3.2L3 4z" fill="#fff"/>
          <circle cx="9" cy="11.5" r="1.15" fill="#2563EB"/>
          <circle cx="15" cy="11.5" r="1.15" fill="#2563EB"/>
          <path d="M12 14.6c.9 0 1.6.5 1.6 1.1 0 .7-.7 1.3-1.6 1.3s-1.6-.6-1.6-1.3c0-.6.7-1.1 1.6-1.1z" fill="#2563EB"/>
        </svg>
      </span>
      {!compact && <span className="text-[17px] font-bold tracking-tight text-blue-600">Caption Fox</span>}
    </span>
  )
}

export function Avatar({ name, src, size = 28 }: { name: string; src?: string | null; size?: number }) {
  const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-600"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials}
    </span>
  )
}

export { SlidersHorizontal }
