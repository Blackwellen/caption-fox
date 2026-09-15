'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { COMMUNITY_MODULE_META, type CommunityModule } from '@/lib/community/constants'

/**
 * The single Community tab strip shared by all six surfaces. Active state
 * derives from the route, so deep links, refreshes and browser back/forward
 * all select the right tab. Modules the workspace is not entitled to are not
 * rendered at all. Mirrors src/components/creators/CreatorsSubNav.tsx.
 */
export default function CommunitySubNav({ modules }: { modules: CommunityModule[] }) {
  const pathname = usePathname()

  function isActive(module: CommunityModule): boolean {
    const href = COMMUNITY_MODULE_META[module].href
    return module === 'overview' ? pathname === href : pathname.startsWith(href)
  }

  return (
    <nav aria-label="Community sections" className="-mx-1 overflow-x-auto">
      <ul className="flex min-w-max items-center gap-1 px-1">
        {modules.map(module => {
          const meta = COMMUNITY_MODULE_META[module]
          const active = isActive(module)
          return (
            <li key={module}>
              <Link
                href={meta.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-medium transition-colors',
                  active
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
                )}
              >
                {meta.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
