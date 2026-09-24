import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import StrategySubNav from './StrategySubNav'
import { STRATEGY_MODULE_META, strategyPath, type StrategyModule } from '@/lib/strategy/constants'

/**
 * Shared Strategy frame: breadcrumb band → title, description and page
 * actions → entitled tab strip. Identical geometry on all seven routes; each
 * page passes only its own actions and content.
 */
export default function StrategyHeader({
  kind, module, modules, actions, title, crumb,
}: {
  kind: string
  module: StrategyModule
  modules: StrategyModule[]
  actions?: React.ReactNode
  /** Overrides for detail pages. */
  title?: string
  crumb?: { label: string; parentLabel?: string }
}) {
  const meta = STRATEGY_MODULE_META[module]
  const home = `/${kind}/home`

  return (
    <>
      <nav aria-label="Breadcrumb" className="-mx-4 mb-5 border-b border-sg-line-soft bg-white px-4 sm:-mx-6 sm:px-6 lg:-mx-[22px] lg:mb-[18px] lg:px-[23px]">
        <ol className="flex h-11 min-w-0 items-center gap-1.5 overflow-hidden text-[13px] text-sg-muted lg:h-9 lg:gap-2 lg:text-[11px]">
          <li className="shrink-0">
            <Link href={home} aria-label="Home" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:text-sg-ink lg:h-auto lg:w-auto">
              <Home aria-hidden className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
            </Link>
          </li>
          <li aria-hidden><ChevronRight className="h-3.5 w-3.5 text-slate-300 lg:h-3 lg:w-3" /></li>
          <li className="hidden shrink-0 sm:block"><Link href={home} className="inline-flex min-h-9 items-center hover:text-sg-ink lg:min-h-0">Campaign Manager</Link></li>
          <li aria-hidden className="hidden sm:block"><ChevronRight className="h-3.5 w-3.5 text-slate-300 lg:h-3 lg:w-3" /></li>
          <li className="shrink-0"><Link href={strategyPath(kind)} className="inline-flex min-h-9 items-center hover:text-sg-ink lg:min-h-0">Strategy</Link></li>
          <li aria-hidden><ChevronRight className="h-3.5 w-3.5 text-slate-300 lg:h-3 lg:w-3" /></li>
          {crumb?.parentLabel && (
            <>
              <li className="shrink-0"><Link href={strategyPath(kind, module)} className="inline-flex min-h-9 items-center hover:text-sg-ink lg:min-h-0">{crumb.parentLabel}</Link></li>
              <li aria-hidden><ChevronRight className="h-3.5 w-3.5 text-slate-300 lg:h-3 lg:w-3" /></li>
            </>
          )}
          <li aria-current="page" className="truncate font-medium text-sg-blue">{crumb?.label ?? meta.breadcrumb}</li>
        </ol>
      </nav>

      <header className="mb-4 flex flex-col gap-3 lg:mb-[10px] lg:flex-row lg:items-start lg:justify-between lg:gap-4">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.01em] text-sg-ink lg:text-[19.5px]">{title ?? meta.title}</h1>
          <p className="mt-1 text-[14px] text-sg-muted lg:mt-[3px] lg:text-[11px]">{meta.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:mt-[3px] lg:shrink-0 lg:gap-[10px]">
          {actions}
        </div>
      </header>

      <div className="mb-4 lg:mb-[15px]">
        <StrategySubNav kind={kind} modules={modules} />
      </div>
    </>
  )
}
