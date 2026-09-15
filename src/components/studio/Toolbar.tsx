'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { LayoutGrid, List, Rows3, Search, SlidersHorizontal, Kanban, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ViewMode } from '@/lib/studio/query'

const VIEW_ICONS: Record<ViewMode, React.ComponentType<{ size?: number }>> = {
  cards: LayoutGrid, table: Rows3, list: List, board: Kanban, grid: LayoutGrid,
}

/**
 * Search input + view switcher shared by every Studio list surface. Reads and
 * writes the `q` and `view` query params directly, so state survives a
 * refresh and a shared link reproduces the same screen.
 */
export function StudioToolbar({
  placeholder = 'Search…',
  views,
  filtersOpen,
  onToggleFilters,
  activeFilterCount = 0,
  children,
}: {
  placeholder?: string
  views?: ViewMode[]
  filtersOpen?: boolean
  onToggleFilters?: () => void
  activeFilterCount?: number
  children?: React.ReactNode
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [term, setTerm] = useState(params.get('q') ?? '')
  const [, startTransition] = useTransition()

  // The URL is the external system this state mirrors — e.g. a "Clear filters"
  // navigation elsewhere on the page removes `q`, and the box must reflect that.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setTerm(params.get('q') ?? ''), [params])

  useEffect(() => {
    const handle = setTimeout(() => {
      const current = params.get('q') ?? ''
      if (term === current) return
      const next = new URLSearchParams(params.toString())
      if (term) next.set('q', term); else next.delete('q')
      next.delete('page')
      startTransition(() => router.push(`?${next.toString()}`, { scroll: false }))
    }, 350)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term])

  function setView(view: ViewMode) {
    const next = new URLSearchParams(params.toString())
    next.set('view', view)
    router.push(`?${next.toString()}`, { scroll: false })
  }

  const activeView = (params.get('view') as ViewMode) || views?.[0]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={term}
          onChange={e => setTerm(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-8 text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        {term && (
          <button
            type="button" aria-label="Clear search" onClick={() => setTerm('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {children}

      {onToggleFilters && (
        <button
          type="button"
          onClick={onToggleFilters}
          aria-pressed={filtersOpen}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors',
            filtersOpen || activeFilterCount > 0
              ? 'border-blue-200 bg-blue-50 text-blue-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
          )}
        >
          <SlidersHorizontal size={14} />
          Filters
          {activeFilterCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      )}

      {views && views.length > 1 && (
        <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5">
          {views.map(view => {
            const Icon = VIEW_ICONS[view]
            return (
              <button
                key={view}
                type="button"
                aria-pressed={activeView === view}
                aria-label={`${view} view`}
                onClick={() => setView(view)}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                  activeView === view ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600',
                )}
              >
                <Icon size={15} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** A single select-based filter bound to a query param. */
export function FilterSelect({
  param, label, options,
}: { param: string; label: string; options: { value: string; label: string }[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const value = params.get(param) ?? ''

  function onChange(next: string) {
    const search = new URLSearchParams(params.toString())
    if (next) search.set(param, next); else search.delete(param)
    search.delete('page')
    router.push(`?${search.toString()}`, { scroll: false })
  }

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
      {label}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-9 min-w-[140px] rounded-lg border border-slate-200 bg-white px-2 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
      >
        <option value="">All</option>
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </label>
  )
}

export function ClearFiltersButton({ hasFilters }: { hasFilters: boolean }) {
  const router = useRouter()
  if (!hasFilters) return null
  return (
    <button
      type="button"
      onClick={() => router.push(location.pathname)}
      className="inline-flex h-9 items-center rounded-lg px-2 text-[13px] font-medium text-slate-500 hover:text-slate-700"
    >
      Clear filters
    </button>
  )
}
