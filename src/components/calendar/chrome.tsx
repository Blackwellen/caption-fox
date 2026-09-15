import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { visibleCalendarTabs, type CalendarContext } from '@/lib/calendar/entitlements'
import type { CalendarTabId } from '@/lib/calendar/types'
import { T } from './primitives'

/**
 * Shared Calendar page chrome: breadcrumb, page header, header actions and the
 * entitlement-driven sub-navigation. One component for all four routes, so the
 * header rhythm cannot drift between pages.
 */
export function CalendarPageChrome({
  ctx, active, title, subtitle, actions,
}: {
  ctx: CalendarContext
  active: CalendarTabId
  title: string
  subtitle: string
  actions?: React.ReactNode
}) {
  const tabs = visibleCalendarTabs(ctx)
  const activeTab = tabs.find(tab => tab.id === active)

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="flex items-center gap-1.5 text-[12.5px] text-slate-500">
          <li><Link href={`${ctx.basePath}/home`} className={cn('hover:text-slate-800', T.focus)}>Campaign Manager</Link></li>
          <li aria-hidden><ChevronRight size={13} className="text-slate-300" /></li>
          <li><Link href={`${ctx.basePath}/calendar`} className={cn('hover:text-slate-800', T.focus)}>Calendar</Link></li>
          {activeTab && active !== 'calendar' && (
            <>
              <li aria-hidden><ChevronRight size={13} className="text-slate-300" /></li>
              <li><span aria-current="page" className="font-medium text-slate-800">{activeTab.label}</span></li>
            </>
          )}
          {active === 'calendar' && (
            <>
              <li aria-hidden><ChevronRight size={13} className="text-slate-300" /></li>
              <li><span aria-current="page" className="font-medium text-slate-800">Calendar</span></li>
            </>
          )}
        </ol>
      </nav>

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[30px] font-bold leading-9 tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1.5 max-w-3xl text-[13.5px] leading-5 text-slate-500">{subtitle}</p>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {tabs.length > 1 && (
        <nav aria-label="Calendar sections" className="mb-5 -mx-1 overflow-x-auto pb-0.5">
          <ul className="flex min-w-max items-center gap-1 px-1">
            {tabs.map(tab => (
              <li key={tab.id}>
                <Link
                  href={tab.href}
                  aria-current={tab.id === active ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-medium transition-colors',
                    tab.id === active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    T.focus,
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  )
}

/** Primary / secondary header buttons, matching the approved design. */
export function HeaderButton({
  href, children, variant = 'secondary', icon, disabled, title,
}: {
  href?: string
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
  icon?: React.ReactNode
  disabled?: boolean
  title?: string
}) {
  const className = cn(
    'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors',
    variant === 'primary'
      ? 'bg-blue-600 text-white hover:bg-blue-700'
      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    disabled && 'cursor-not-allowed opacity-50',
    T.focus,
  )
  if (disabled || !href) {
    return (
      <button type="button" className={className} disabled={disabled} title={title} aria-disabled={disabled}>
        {icon}{children}
      </button>
    )
  }
  return <Link href={href} className={className} title={title}>{icon}{children}</Link>
}
