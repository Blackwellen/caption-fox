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
  active, modules, counts, trailing,
}: {
  active: MarketplaceModule
  modules: MarketplaceModule[]
  counts?: Partial<Record<MarketplaceModule, number>>
  /** Desktop-only controls aligned to the right end of the tab row. */
  trailing?: React.ReactNode
}) {
  const visible = MARKETPLACE_TABS.filter(tab => modules.includes(tab.id))
  const activeTop: MarketplaceModule =
    active === 'influencers' || active === 'services' || active === 'ugc-creators' ? 'discover' : active

  return (
    <div className="flex items-center border-b border-slate-200">
    <nav className="-mx-1 min-w-0 flex-1 overflow-x-auto" aria-label="Marketplace sections">
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
                  'inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors lg:gap-1.5 lg:py-2 lg:text-[11px]',
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900',
                )}
              >
                <Icon size={14} className="lg:h-[13px] lg:w-[13px]" />
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
    {trailing && <div className="hidden shrink-0 lg:block">{trailing}</div>}
    </div>
  )
}

/**
 * Discover secondary navigation — the specialist search modes. The reference
 * has no separate row for these, so on desktop they sit at the right end of
 * the tab strip (`inline`); tablet and mobile keep a scrollable row beneath it.
 */
export function DiscoverModeNav({
  active, modules, inline = false,
}: {
  active: MarketplaceModule
  modules: MarketplaceModule[]
  inline?: boolean
}) {
  const pathname = usePathname()
  const visible = DISCOVER_MODES.filter(mode => modules.includes(mode.id))
  if (visible.length < 2) return null

  return (
    <nav className={cn('overflow-x-auto', inline ? '' : '-mx-1 lg:hidden')} aria-label="Discovery modes">
      <ul className={cn('flex min-w-max items-center gap-1 px-1', inline ? 'py-0' : 'py-2')}>
        {visible.map(mode => {
          const Icon = MODE_ICONS[mode.id] ?? PlayCircle
          const isActive = mode.id === active || MODULE_ROUTES[mode.id] === pathname
          return (
            <li key={mode.id}>
              <Link
                href={MODULE_ROUTES[mode.id]}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors lg:gap-1.5 lg:px-2.5 lg:py-[3px] lg:text-[10px] [&>svg]:lg:h-3 [&>svg]:lg:w-3',
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
