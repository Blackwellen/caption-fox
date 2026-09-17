'use client'

import { usePathname } from 'next/navigation'
import ResponsiveTabs, { type TabItem } from '@/components/ui/ResponsiveTabs'
import { STUDIO_MODULE_META, type StudioModule } from '@/lib/studio/constants'
import { studioHref } from '@/lib/studio/paths'
import { cn } from '@/lib/utils'

/**
 * The one Studio sub-navigation. Tabs come from the entitlement resolver
 * (`visibleStudioModules`), so a module the workspace, plan or role cannot open
 * is omitted entirely rather than shown disabled. The active tab derives from
 * the route, so deep links, refresh and back/forward always select correctly.
 * Desktop: underlined strip · tablet: sliding tray · mobile: dropdown.
 */
export default function StudioTabs({ base, modules, className, itemClassName }: {
  base: string
  modules: StudioModule[]
  className?: string
  itemClassName?: string
}) {
  const pathname = usePathname()
  const items: TabItem[] = modules.map(module => ({
    id: module, label: STUDIO_MODULE_META[module].label, href: studioHref(base, module),
  }))
  const isActive = (item: TabItem) =>
    item.id === 'overview' ? pathname === base : pathname === item.href || pathname.startsWith(`${item.href}/`)

  return (
    <ResponsiveTabs
      items={items} isActive={isActive} ariaLabel="Studio sections" desktop="underline"
      className={className}
      desktopItemClassName={cn('px-3 text-[12.5px] h-[38px]', itemClassName)}
    />
  )
}
