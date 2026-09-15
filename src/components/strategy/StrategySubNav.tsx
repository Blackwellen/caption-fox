'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STRATEGY_MODULE_META, type StrategyModule } from '@/lib/strategy/constants'

/**
 * The single Strategy tab strip shared by all seven surfaces.
 *
 * Active state derives from the route, so deep links, refreshes and browser
 * back/forward all select the right tab without any local state. Modules the
 * workspace is not entitled to are not rendered at all — never as disabled or
 * dead links. On mobile the strip collapses into a dropdown selector; on tablet
 * it becomes a horizontally scrollable segmented strip.
 */
export default function StrategySubNav({ modules }: { modules: StrategyModule[] }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  function isActive(module: StrategyModule): boolean {
    const href = STRATEGY_MODULE_META[module].href
    return module === 'overview' ? pathname === href : pathname.startsWith(href)
  }

  const active = modules.find(isActive) ?? modules[0]
  if (!active) return null

  return (
    <>
      {/* Mobile / PWA: dropdown selector so many tabs never clip. */}
      <div className="relative sm:hidden">
        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          aria-expanded={open}
          aria-haspopup="menu"
          className="flex h-9 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700"
        >
          {STRATEGY_MODULE_META[active].label}
          <ChevronDown size={14} className={cn('text-slate-400 transition-transform', open && 'rotate-180')} />
        </button>
        {open && (
          <>
            <button
              type="button" aria-label="Close sections menu"
              className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)}
            />
            <ul role="menu" className="absolute inset-x-0 z-20 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {modules.map(module => {
                const meta = STRATEGY_MODULE_META[module]
                return (
                  <li key={module} role="none">
                    <Link
                      role="menuitem" href={meta.href} onClick={() => setOpen(false)}
                      aria-current={isActive(module) ? 'page' : undefined}
                      className={cn(
                        'block px-3 py-2 text-[13px]',
                        isActive(module) ? 'bg-blue-50 font-medium text-blue-600' : 'text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      {meta.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      {/* Tablet and desktop: sliding segmented strip. */}
      <nav aria-label="Strategy sections" className="-mx-1 hidden overflow-x-auto sm:block">
        <ul className="flex min-w-max items-center gap-1 border-b border-slate-200 px-1">
          {modules.map(module => {
            const meta = STRATEGY_MODULE_META[module]
            const current = isActive(module)
            return (
              <li key={module}>
                <Link
                  href={meta.href}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-9 items-center border-b-2 px-3 text-[13px] font-medium transition-colors',
                    current
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800',
                  )}
                >
                  {meta.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
