'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STRATEGY_MODULE_META, strategyPath, type StrategyModule } from '@/lib/strategy/constants'
import { Menu } from './client/menu'

/**
 * The single Strategy tab strip shared by all seven surfaces.
 *
 * Active state derives from the URL, so deep links, refreshes and browser
 * back/forward always select the right tab. Only entitled modules are passed
 * in — hidden modules are never rendered as disabled or dead tabs.
 *
 *  - Desktop (lg+): underline tab row matching the approved design.
 *  - Tablet (sm–lg): sliding segmented tray that scrolls the active tab into view.
 *  - Phone / PWA (<sm): dropdown selector.
 */
export default function StrategySubNav({ kind, modules }: { kind: string; modules: StrategyModule[] }) {
  const pathname = usePathname()
  const trayRef = useRef<HTMLDivElement>(null)

  const hrefFor = (module: StrategyModule) => strategyPath(kind, module)
  const isActive = (module: StrategyModule) => {
    const href = hrefFor(module)
    return module === 'overview' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
  }
  const active = modules.find(isActive) ?? modules[0]

  useEffect(() => {
    const node = trayRef.current?.querySelector<HTMLElement>('[aria-current="page"]')
    node?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [pathname])

  if (!active) return null

  return (
    <nav aria-label="Strategy sections">
      {/* Phone / PWA */}
      <div className="sm:hidden">
        <Menu
          label="Strategy sections"
          align="start"
          className="w-full"
          panelClassName="w-full"
          items={modules.map(module => ({
            id: module, label: STRATEGY_MODULE_META[module].label, href: hrefFor(module), selected: module === active,
          }))}
          trigger={({ ref, toggle, open, ...aria }) => (
            <button ref={ref} type="button" onClick={toggle} {...aria}
              className="flex h-11 w-full items-center justify-between rounded-xl border border-sg-line bg-white px-3.5 text-[14px] font-medium text-sg-ink shadow-sg-card">
              <span><span className="sr-only">Section: </span>{STRATEGY_MODULE_META[active].label}</span>
              <ChevronDown aria-hidden className={cn('h-4 w-4 text-slate-400 transition-transform', open && 'rotate-180')} />
            </button>
          )}
        />
      </div>

      {/* Tablet: sliding segmented tray */}
      <div ref={trayRef} className="hidden overflow-x-auto overscroll-x-contain [scrollbar-width:none] sm:block lg:hidden">
        <ul className="flex w-max gap-1 rounded-xl border border-sg-line bg-white p-1 shadow-sg-card">
          {modules.map(module => (
            <li key={module}>
              <Link href={hrefFor(module)} aria-current={isActive(module) ? 'page' : undefined}
                className={cn(
                  'inline-flex h-10 items-center whitespace-nowrap rounded-lg px-4 text-[14px] font-medium transition-colors',
                  isActive(module) ? 'bg-sg-blue text-white' : 'text-sg-muted hover:bg-slate-50 hover:text-sg-ink',
                )}>
                {STRATEGY_MODULE_META[module].label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Desktop: underline row */}
      <ul className="hidden items-end gap-[9px] border-b border-sg-line lg:flex">
        {modules.map(module => (
          <li key={module}>
            <Link href={hrefFor(module)} aria-current={isActive(module) ? 'page' : undefined}
              className={cn(
                '-mb-px inline-flex h-[38px] items-center border-b-2 px-3 text-[12.5px] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sg-blue',
                isActive(module) ? 'border-sg-blue font-medium text-sg-blue' : 'border-transparent text-sg-muted hover:text-sg-ink',
              )}>
              {STRATEGY_MODULE_META[module].label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
