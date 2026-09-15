import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from './primitives'

/**
 * Shared header for every Events detail route: breadcrumb back to the list,
 * record identity, status, and a query-param tab strip. One shell so Event,
 * Webinar, Podcast Episode and Sponsorship detail pages stay visually and
 * structurally identical.
 */

export interface DetailTab {
  id: string
  label: string
  /** Omit tabs the viewer's role/plan cannot see — never render them disabled. */
}

export function DetailBreadcrumb({
  parentLabel, parentHref, recordName,
}: { parentLabel: string; parentHref: string; recordName: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-[12.5px] text-slate-500">
      <Link href={parentHref} className="hover:text-blue-700">{parentLabel}</Link>
      <ChevronRight size={13} aria-hidden />
      <span className="truncate font-medium text-slate-700">{recordName}</span>
    </nav>
  )
}

export function DetailHeaderBar({
  title, subtitle, status, cover, actions,
}: {
  title: string
  subtitle?: string
  status?: string
  cover?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3.5">
        {cover}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-[24px] font-bold leading-tight tracking-tight text-slate-900">{title}</h1>
            {status && <StatusBadge status={status} dot={status === 'live'} />}
          </div>
          {subtitle && <p className="mt-1 text-[13px] text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function DetailTabStrip({
  tabs, active, basePath,
}: { tabs: DetailTab[]; active: string; basePath: string }) {
  return (
    <div className="mb-5 overflow-x-auto border-b border-slate-200">
      <nav role="tablist" aria-label="Record sections" className="flex min-w-max gap-1">
        {tabs.map(tab => {
          const selected = tab.id === active
          const href = tab.id === 'overview' ? basePath : `${basePath}?tab=${tab.id}`
          return (
            <Link
              key={tab.id}
              href={href}
              role="tab"
              aria-selected={selected}
              className={cn(
                'relative px-3.5 py-2.5 text-[13px] font-medium transition-colors',
                selected ? 'text-blue-700' : 'text-slate-500 hover:text-slate-800',
              )}
            >
              {tab.label}
              {selected && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-blue-600" aria-hidden />}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export function DetailNotFound({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-16 text-center">
      <h1 className="text-[17px] font-semibold text-slate-900">Not found</h1>
      <p className="mt-1.5 max-w-md text-[13px] text-slate-500">
        This record does not exist, has been removed, or belongs to a different workspace.
      </p>
      <Link href={backHref} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-blue-700">
        {backLabel}
      </Link>
    </div>
  )
}
