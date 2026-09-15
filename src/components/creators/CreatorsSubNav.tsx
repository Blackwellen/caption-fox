'use client'

import { usePathname } from 'next/navigation'
import ResponsiveTabs from '@/components/ui/ResponsiveTabs'
import { CREATOR_MODULE_META, type CreatorModule } from '@/lib/creators/constants'

/**
 * The single Creators & UGC tab strip shared by all six surfaces. Active
 * state derives from the route, so deep links, refreshes and browser
 * back/forward all select the right tab. Modules the workspace is not
 * entitled to are not rendered at all — never as disabled or dead links.
 *
 * Layout follows the project-wide responsive tab rule: a normal row on
 * desktop, a sliding segmented tray on tablet, a dropdown on mobile.
 */
export default function CreatorsSubNav({ modules }: { modules: CreatorModule[] }) {
  const pathname = usePathname()

  function isActive(module: CreatorModule): boolean {
    const href = CREATOR_MODULE_META[module].href
    return module === 'overview' ? pathname === href : pathname.startsWith(href)
  }

  const items = modules.map(module => ({ id: module, label: CREATOR_MODULE_META[module].label, href: CREATOR_MODULE_META[module].href }))

  return (
    <ResponsiveTabs
      items={items}
      isActive={item => isActive(item.id as CreatorModule)}
      ariaLabel="Creators and UGC sections"
    />
  )
}
