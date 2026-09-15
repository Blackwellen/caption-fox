'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid, Search, Boxes, Bookmark, FileText, Receipt, Users, Briefcase, Video, PlayCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  MARKETPLACE_TABS, DISCOVER_MODES, MODULE_ROUTES, type MarketplaceModule,
} from '@/lib/marketplace/module'

const TAB_ICONS: Partial<Record<MarketplaceModule, typeof LayoutGrid>> = {
  overview: LayoutGrid,
  discover: Search,
  categories: Boxes,
  saved: Bookmark,
  requests: FileText,
  orders: Receipt,
}

const MODE_ICONS: Partial<Record<MarketplaceModule, typeof LayoutGrid>> = {
  discover: Search,
  influencers: Users,
  services: Briefcase,
  'ugc-creators': Video,
}

/**
 * Primary Marketplace tab strip. Entitlement-driven: modules the workspace
 * cannot open are removed rather than shown disabled. The active tab is derived
 * from the route, so deep links and browser back/forward stay correct.
 */
export function MarketplaceTabs({
  active, modules, counts,
}: {
  active: MarketplaceModule
  modules: MarketplaceModule[]
  counts?: Partial<Record<MarketplaceModule, number>>
}) {
  const visible = MARKETPLACE_TABS.filter(tab => modules.includes(tab.id))
  const activeTop: MarketplaceModule =
    active === 'influencers' || active === 'services' || active === 'ugc-creators' ? 'discover' : active

  return (
    <nav className="-mx-1 overflow-x-auto border-b border-slate-200" aria-label="Marketplace sections">
      <ul className="flex min-w-max items-center gap-1 px-1">
        {visible.map(tab => {
          const Icon = TAB_ICONS[tab.id] ?? LayoutGrid
          const isActive = tab.id === activeTop
          return (
            <li key={tab.id}>
              <Link
                href={MODULE_ROUTES[tab.id]}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900',
                )}
              >
                <Icon size={15} />
                {tab.label}
                {counts?.[tab.id] !== undefined && (
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                    isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600',
                  )}>
                    {counts[tab.id]}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Discover secondary navigation — the specialist search modes. */
export function DiscoverModeNav({ active, modules }: { active: MarketplaceModule; modules: MarketplaceModule[] }) {
  const pathname = usePathname()
  const visible = DISCOVER_MODES.filter(mode => modules.includes(mode.id))
  if (visible.length < 2) return null

  return (
    <nav className="-mx-1 overflow-x-auto" aria-label="Discovery modes">
      <ul className="flex min-w-max items-center gap-1 px-1 py-2">
        {visible.map(mode => {
          const Icon = MODE_ICONS[mode.id] ?? PlayCircle
          const isActive = mode.id === active || MODULE_ROUTES[mode.id] === pathname
          return (
            <li key={mode.id}>
              <Link
                href={MODULE_ROUTES[mode.id]}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                <Icon size={14} />
                {mode.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
