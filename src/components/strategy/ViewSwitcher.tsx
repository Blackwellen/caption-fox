'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  BarChart3, CalendarDays, Columns3, GitCompare, Kanban, LayoutGrid, LayoutList,
  Library, Map as MapIcon, Rows3, Table2, GanttChartSquare, Layers3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ViewMode } from '@/lib/strategy/query'

const VIEW_META: Record<ViewMode, { label: string; icon: typeof Table2 }> = {
  dashboard: { label: 'Dashboard', icon: LayoutGrid },
  cards: { label: 'Cards', icon: LayoutGrid },
  table: { label: 'Table', icon: Table2 },
  timeline: { label: 'Timeline', icon: Rows3 },
  kanban: { label: 'Kanban', icon: Kanban },
  map: { label: 'Map', icon: MapIcon },
  compare: { label: 'Compare', icon: GitCompare },
  library: { label: 'Library', icon: Library },
  board: { label: 'Board', icon: Columns3 },
  framework: { label: 'Framework', icon: LayoutGrid },
  matrix: { label: 'Matrix', icon: Layers3 },
  gantt: { label: 'Gantt', icon: GanttChartSquare },
  calendar: { label: 'Calendar', icon: CalendarDays },
  charts: { label: 'Charts', icon: BarChart3 },
  scenarios: { label: 'Scenarios', icon: LayoutList },
}

/**
 * Route-backed view switcher. The mode lives in `?view=`, so a refresh, a
 * shared link and browser back/forward all restore the same view — no local
 * state, and every button is a real navigation rather than a decorative toggle.
 * Filters and search in the current query string are preserved on switch.
 */
export default function ViewSwitcher({
  views, active, label = 'View',
}: { views: ViewMode[]; active: ViewMode; label?: string }) {
  const pathname = usePathname()
  const params = useSearchParams()

  function hrefFor(view: ViewMode): string {
    const next = new URLSearchParams(params.toString())
    next.set('view', view)
    // Switching view resets pagination — page 4 of cards is rarely page 4 of a board.
    next.delete('page')
    const qs = next.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs font-medium text-slate-500 sm:inline">{label}</span>
      <div
        role="tablist" aria-label={`${label} mode`}
        className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5"
      >
        {views.map(view => {
          const meta = VIEW_META[view]
          const Icon = meta.icon
          const current = view === active
          return (
            <Link
              key={view} href={hrefFor(view)} role="tab" aria-selected={current}
              scroll={false}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors',
                current ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700',
              )}
            >
              <Icon size={13} aria-hidden />
              <span className="hidden md:inline">{meta.label}</span>
              <span className="sr-only md:hidden">{meta.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
