'use client'

import { usePathname } from 'next/navigation'
import ResponsiveTabs, { type TabItem } from '@/components/ui/ResponsiveTabs'

// The Advertising section tabs: Overview, Accounts, Campaigns, Creatives,
// Audiences, Reports. Built on the shared ResponsiveTabs (desktop row, tablet
// sliding tray, mobile dropdown). The active tab derives from the route, so
// deep links, refresh and back/forward always select the right one, and a
// detail page (/campaigns/{id}) keeps its parent tab highlighted.

export type AdvertisingTab = { id: string; label: string }

export default function AdvertisingSubNav({ basePath, tabs }: { basePath: string; tabs: AdvertisingTab[] }) {
  const pathname = usePathname()

  const items: TabItem[] = tabs.map(tab => ({
    id: tab.id,
    label: tab.label,
    href: tab.id === 'overview' ? basePath : `${basePath}/${tab.id}`,
  }))

  const isActive = (item: TabItem) =>
    item.id === 'overview' ? pathname === basePath : pathname === item.href || pathname.startsWith(`${item.href}/`)

  return (
    <ResponsiveTabs
      items={items}
      isActive={isActive}
      ariaLabel="Advertising sections"
    />
  )
}
