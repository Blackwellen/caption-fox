'use client'

import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Calendar, Check, ChevronDown, LayoutGrid, Loader2, Rows3,
  Search, SlidersHorizontal, Table2, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { RANGE_PRESETS } from '@/lib/advertising/range-presets'

// Every filter, search box, sort and view switcher in the Advertising module
// writes to the URL. That makes the state shareable, restorable on refresh and
// correct under browser back/forward, and it means the server components can do
// the filtering rather than shipping the whole dataset to the client.
//
// Changing any control resets the page number: staying on page 7 of a result
// set that now has two pages is the classic filter bug.

export function useUrlState() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const set = useCallback((updates: Record<string, string | null>, options?: { keepPage?: boolean }) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') params.delete(key)
      else params.set(key, value)
    }
    if (!options?.keepPage) params.delete('page')
    const query = params.toString()
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    })
  }, [router, pathname, searchParams])

  const clearAll = useCallback((keep: string[] = []) => {
    const params = new URLSearchParams()
    for (const key of keep) {
      const value = searchParams.get(key)
      if (value) params.set(key, value)
    }
    const query = params.toString()
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    })
  }, [router, pathname, searchParams])

  return { params: searchParams, set, clearAll, pending }
}

// ------------------------------------------------------------------ search

export function SearchInput({
  paramKey = 'q', placeholder, className, ariaLabel,
}: { paramKey?: string; placeholder: string; className?: string; ariaLabel?: string }) {
  const { params, set, pending } = useUrlState()
  const urlValue = params.get(paramKey) ?? ''
  const [value, setValue] = useState(urlValue)
  const [syncedValue, setSyncedValue] = useState(urlValue)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const id = useId()

  // Keeps the box in step when the URL changes elsewhere (Clear all, back).
  // Adjusted during render rather than in an effect, so there is no extra pass.
  if (syncedValue !== urlValue) {
    setSyncedValue(urlValue)
    setValue(urlValue)
  }

  const commit = useCallback((next: string) => {
    if (timer.current) clearTimeout(timer.current)
    // Debounced so typing does not fire a request per keystroke.
    timer.current = setTimeout(() => set({ [paramKey]: next || null }), 300)
  }, [paramKey, set])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <div className={cn('relative min-w-0', className)}>
      <label htmlFor={id} className="sr-only">{ariaLabel ?? placeholder}</label>
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={event => { setValue(event.target.value); commit(event.target.value) }}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault()
            if (timer.current) clearTimeout(timer.current)
            set({ [paramKey]: value || null })
          }
          if (event.key === 'Escape') { setValue(''); set({ [paramKey]: null }) }
        }}
        className={cn(
          'h-[30px] w-full rounded-lg border border-slate-200 bg-white pl-8.5 pr-8 text-[12.5px] text-slate-800 lg:text-[11px]',
          'placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15',
        )}
        style={{ paddingLeft: 32 }}
      />
      {pending && value
        ? <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" aria-hidden />
        : value && (
          <button
            type="button"
            onClick={() => { setValue(''); set({ [paramKey]: null }) }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X size={13} />
          </button>
        )}
    </div>
  )
}

// ----------------------------------------------------------------- selects

export type SelectOption = { value: string; label: string; disabled?: boolean; hint?: string }

/**
 * Native select styled to match the reference. Native is deliberate: it is
 * keyboard and screen-reader correct for free, and never renders off-viewport
 * on mobile the way a custom popover can.
 */
export function FilterSelect({
  paramKey, label, options, allLabel = 'All', className, compact,
}: {
  paramKey: string
  label: string
  options: SelectOption[]
  allLabel?: string
  className?: string
  compact?: boolean
}) {
  const { params, set } = useUrlState()
  const value = params.get(paramKey) ?? ''
  const id = useId()
  const active = value !== ''

  return (
    <div className={cn('relative min-w-0', className)}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <select
        id={id}
        value={value}
        onChange={event => set({ [paramKey]: event.target.value || null })}
        className={cn(
          'h-9 w-full appearance-none rounded-lg border bg-white pl-3 pr-8 text-[13px] text-slate-700',
          'focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15',
          active ? 'border-blue-300 bg-blue-50/40 font-medium text-blue-800' : 'border-slate-200',
        )}
      >
        <option value="">{compact ? allLabel : `${label}: ${allLabel}`}</option>
        {options.map(option => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {compact ? option.label : `${label}: ${option.label}`}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
    </div>
  )
}

/** Label-outside variant used by the Reports control bar. */
export function LabelledSelect({
  paramKey, label, options, allLabel = 'All', className,
}: { paramKey: string; label: string; options: SelectOption[]; allLabel?: string; className?: string }) {
  const { params, set } = useUrlState()
  const value = params.get(paramKey) ?? ''
  const id = useId()

  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className="mb-1 block text-[11px] font-medium text-slate-500">{label}</label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={event => set({ [paramKey]: event.target.value || null })}
          className="h-[30px] w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-[12.5px] text-slate-700 lg:text-[11px] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
        >
          <option value="">{allLabel}</option>
          {options.map(option => (
            <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
      </div>
    </div>
  )
}

// ---------------------------------------------------------- date controls

export { RANGE_PRESETS }

export function DateRangeSelect({ currentLabel, className }: { currentLabel: string; className?: string }) {
  const { params, set } = useUrlState()
  const value = params.get('range') ?? 'last_30'
  const id = useId()

  return (
    <div className={cn('relative min-w-0', className)}>
      <label htmlFor={id} className="sr-only">Date range, currently {currentLabel}</label>
      <Calendar size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
      <select
        id={id}
        value={value}
        onChange={event => set({ range: event.target.value })}
        className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-8 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
      >
        {RANGE_PRESETS.map(preset => (
          <option key={preset.value} value={preset.value}>{preset.label}</option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
    </div>
  )
}

/** Read-only comparison label; the compared window is always the prior period. */
export function ComparisonLabel({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-600',
        className,
      )}
      title="Comparison period: the equivalent window immediately before the selected range"
    >
      vs {label}
    </span>
  )
}

// ------------------------------------------------------------ view switch

export type ViewOption = { value: string; label: string; icon: 'table' | 'cards' | 'board' | 'grid' | 'review' | 'overlap' | 'dashboard' | 'breakdown' }

const VIEW_ICONS = {
  table: Table2, cards: LayoutGrid, board: Rows3, grid: LayoutGrid,
  review: Check, overlap: SlidersHorizontal, dashboard: LayoutGrid, breakdown: Rows3,
} as const

export function ViewSwitcher({
  views, paramKey = 'view', defaultView, className, solid = false, icons = true,
}: {
  views: ViewOption[]; paramKey?: string; defaultView: string; className?: string
  /** Solid blue active segment (Reports design) instead of the tinted one. */
  solid?: boolean
  icons?: boolean
}) {
  const { params, set } = useUrlState()
  const active = params.get(paramKey) ?? defaultView

  return (
    <div
      className={cn('inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5', className)}
      role="tablist"
      aria-label="View"
    >
      {views.map(view => {
        const Icon = VIEW_ICONS[view.icon]
        const selected = active === view.value
        return (
          <button
            key={view.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => set({ [paramKey]: view.value === defaultView ? null : view.value }, { keepPage: false })}
            className={cn(
              'inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[12.5px] font-medium transition-colors lg:text-[11px]',
              selected
                ? solid ? 'bg-blue-600 text-white shadow-sm' : 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800',
            )}
          >
            {icons && <Icon size={14} aria-hidden />}
            {view.label}
          </button>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------- sort + page

export function SortSelect({
  options, defaultValue, className,
}: { options: SelectOption[]; defaultValue: string; className?: string }) {
  const { params, set } = useUrlState()
  const value = params.get('sort') ?? defaultValue
  const id = useId()

  return (
    <div className={cn('relative min-w-0', className)}>
      <label htmlFor={id} className="sr-only">Sort by</label>
      <select
        id={id}
        value={value}
        onChange={event => set({ sort: event.target.value === defaultValue ? null : event.target.value })}
        className="h-[30px] w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-[12.5px] text-slate-600 lg:text-[11px] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>Sort: {option.label}</option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
    </div>
  )
}

export function ClearFiltersButton({ activeCount, keep = ['view'] }: { activeCount: number; keep?: string[] }) {
  const { clearAll } = useUrlState()
  if (activeCount === 0) return null
  return (
    <button
      type="button"
      onClick={() => clearAll(keep)}
      className="rounded text-[12.5px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
    >
      Clear all{activeCount > 0 ? ` (${activeCount})` : ''}
    </button>
  )
}

export function Pagination({
  page, pageSize, total, itemLabel = 'records',
}: { page: number; pageSize: number; total: number; itemLabel?: string }) {
  const { set } = useUrlState()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  // Windowed page list with ellipses, always including first and last.
  const numbers: (number | 'gap')[] = []
  for (let index = 1; index <= pages; index += 1) {
    if (index === 1 || index === pages || Math.abs(index - page) <= 1) numbers.push(index)
    else if (numbers[numbers.length - 1] !== 'gap') numbers.push('gap')
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <p className="text-[12.5px] text-slate-500" aria-live="polite">
        {total === 0
          ? `No ${itemLabel}`
          : `Show ${first}–${last} of ${total.toLocaleString('en-GB')} ${itemLabel}`}
      </p>
      {pages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => set({ page: String(page - 1) }, { keepPage: true })}
            className="rounded-md border border-slate-200 p-1.5 text-slate-500 disabled:opacity-40 disabled:hover:bg-transparent hover:bg-slate-50"
            aria-label="Previous page"
          >
            <ChevronDown size={14} className="rotate-90" aria-hidden />
          </button>
          {numbers.map((entry, index) => entry === 'gap' ? (
            <span key={`gap-${index}`} className="px-1 text-slate-400" aria-hidden>…</span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => set({ page: entry === 1 ? null : String(entry) }, { keepPage: true })}
              aria-current={entry === page ? 'page' : undefined}
              className={cn(
                'min-w-8 rounded-md px-2 py-1.5 text-[12.5px] font-medium',
                entry === page ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {entry}
            </button>
          ))}
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => set({ page: String(page + 1) }, { keepPage: true })}
            className="rounded-md border border-slate-200 p-1.5 text-slate-500 disabled:opacity-40 disabled:hover:bg-transparent hover:bg-slate-50"
            aria-label="Next page"
          >
            <ChevronDown size={14} className="-rotate-90" aria-hidden />
          </button>
        </nav>
      )}
    </div>
  )
}
