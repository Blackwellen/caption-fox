'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  CalendarDays, ChevronDown, LayoutGrid, Loader2, Rows3, Search, SlidersHorizontal, X,
  Columns3, GanttChartSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterOption { value: string; label: string }

export interface FilterDef {
  /** Query-string key, e.g. `type`. */
  key: string
  label: string
  options: FilterOption[]
  /** Filters marked advanced live inside the "Filters" popover. */
  advanced?: boolean
}

export type ViewOption = 'cards' | 'table' | 'board' | 'timeline'

const VIEW_META: Record<ViewOption, { label: string; Icon: typeof LayoutGrid }> = {
  cards: { label: 'Cards', Icon: LayoutGrid },
  table: { label: 'Table', Icon: Rows3 },
  board: { label: 'Board', Icon: Columns3 },
  timeline: { label: 'Timeline', Icon: GanttChartSquare },
}

const CONTROL = 'inline-flex h-9 lg:h-[30px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 lg:px-2.5 text-[13px] lg:text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600'

/**
 * URL-driven filter bar shared by the Campaigns surfaces.
 *
 * Nothing here holds list state locally: every control writes to the query
 * string, so refresh, back/forward, deep links and shared URLs all restore the
 * exact same result set. Page always resets to 1 when a filter changes.
 */
export default function CampaignFilters({
  filters, views, searchPlaceholder, showDateRange = true, className,
}: {
  filters: FilterDef[]
  views?: ViewOption[]
  searchPlaceholder?: string
  showDateRange?: boolean
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const get = useCallback((key: string) => params.get(key) ?? '', [params])

  const push = useCallback((patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    // Any filter change invalidates the current page offset.
    if (!('page' in patch)) next.delete('page')
    const qs = next.toString()
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }, [params, pathname, router])

  // ── Search (debounced, but immediately reflected in the input) ─────────────
  const [term, setTerm] = useState(get('q'))
  const typed = useRef(false)
  useEffect(() => { if (!typed.current) setTerm(get('q')) }, [get])
  useEffect(() => {
    if (!typed.current) return
    const id = setTimeout(() => { push({ q: term }); typed.current = false }, 350)
    return () => clearTimeout(id)
  }, [term, push])

  const [moreOpen, setMoreOpen] = useState(false)
  const inline = filters.filter(f => !f.advanced)
  const advanced = filters.filter(f => f.advanced)

  const activeCount = filters.reduce((n, f) => n + (get(f.key) ? 1 : 0), 0)
    + ((get('from') || get('to')) ? 1 : 0)
    + (get('archived') === '1' ? 1 : 0)
  const advancedCount = advanced.reduce((n, f) => n + (get(f.key) ? 1 : 0), 0)
    + (get('archived') === '1' ? 1 : 0)
  const dirty = activeCount > 0 || get('q').length > 0

  function clearAll() {
    const next = new URLSearchParams()
    const view = get('view')
    if (view) next.set('view', view)
    setTerm('')
    typed.current = false
    const qs = next.toString()
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {searchPlaceholder && (
        <div className="relative min-w-[200px] flex-1 sm:max-w-[292px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={term}
            onChange={e => { typed.current = true; setTerm(e.target.value) }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-9 lg:h-[30px] w-full rounded-lg border border-slate-200 bg-white pl-8 pr-8 text-[13px] lg:text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          {term && (
            <button
              type="button" aria-label="Clear search"
              onClick={() => { typed.current = true; setTerm('') }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {showDateRange && (
        <DateRangeControl
          from={get('from')} to={get('to')}
          onChange={(from, to) => push({ from, to })}
        />
      )}

      {inline.map(filter => (
        <SelectControl
          key={filter.key}
          label={filter.label}
          value={get(filter.key)}
          options={filter.options}
          onChange={value => push({ [filter.key]: value })}
        />
      ))}

      {advanced.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMoreOpen(open => !open)}
            aria-expanded={moreOpen}
            className={cn(CONTROL, advancedCount > 0 && 'border-blue-200 bg-blue-50/60 text-blue-700')}
          >
            <SlidersHorizontal size={13} />
            Filters
            {advancedCount > 0 && (
              <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">
                {advancedCount}
              </span>
            )}
          </button>
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)} aria-hidden />
              <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                <p className="mb-2 text-xs font-semibold text-slate-900">More filters</p>
                <div className="space-y-2.5">
                  {advanced.map(filter => (
                    <label key={filter.key} className="block">
                      <span className="mb-1 block text-[11px] font-medium text-slate-500">{filter.label}</span>
                      <select
                        value={get(filter.key)}
                        onChange={e => push({ [filter.key]: e.target.value })}
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="">All {filter.label.toLowerCase()}</option>
                        {filter.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                  ))}
                  <label className="flex items-center gap-2 pt-1 text-[13px] text-slate-600">
                    <input
                      type="checkbox" checked={get('archived') === '1'}
                      onChange={e => push({ archived: e.target.checked ? '1' : '' })}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Show archived records
                  </label>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {dirty && (
        <button
          type="button" onClick={clearAll}
          className="inline-flex h-9 items-center px-1 text-[13px] font-medium text-blue-600 hover:text-blue-700"
        >
          Clear all
        </button>
      )}

      {pending && <Loader2 size={14} className="animate-spin text-slate-400" aria-label="Updating results" />}

      {views && views.length > 1 && (
        <div className="ml-auto flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white" role="group" aria-label="View mode">
          {views.map(view => {
            const { label, Icon } = VIEW_META[view]
            const active = (get('view') || views[0]) === view
            return (
              <button
                key={view} type="button"
                onClick={() => push({ view })}
                aria-pressed={active}
                className={cn(
                  'inline-flex h-[34px] lg:h-[28px] items-center gap-1.5 px-3 lg:px-2.5 text-[13px] lg:text-[11px] font-medium transition-colors',
                  active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SelectControl({
  label, value, options, onChange,
}: { label: string; value: string; options: FilterOption[]; onChange: (value: string) => void }) {
  const selected = options.find(o => o.value === value)
  return (
    <div className={cn('relative', value && 'text-blue-700')}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={label}
        className={cn(
          'h-9 lg:h-[30px] cursor-pointer appearance-none rounded-lg border bg-white pl-3 lg:pl-2.5 pr-7 text-[13px] lg:text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-100',
          value ? 'border-blue-200 bg-blue-50/60 text-blue-700' : 'border-slate-200 text-slate-600',
        )}
      >
        <option value="">{label}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
      <span className="sr-only">{selected ? `${label}: ${selected.label}` : `${label}: all`}</span>
    </div>
  )
}

function DateRangeControl({
  from, to, onChange,
}: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const [open, setOpen] = useState(false)
  const label = from || to
    ? `${from ? formatDay(from) : 'Any'} – ${to ? formatDay(to) : 'Any'}`
    : 'Date range'

  return (
    <div className="relative">
      <button
        type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className={cn(CONTROL, (from || to) && 'border-blue-200 bg-blue-50/60 text-blue-700')}
      >
        <CalendarDays size={13} />
        {label}
        <ChevronDown size={13} className="text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 top-full z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
            <label className="mb-2 block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">From</span>
              <input
                type="date" value={from} max={to || undefined}
                onChange={e => onChange(e.target.value, to)}
                className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">To</span>
              <input
                type="date" value={to} min={from || undefined}
                onChange={e => onChange(from, e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            {(from || to) && (
              <button
                type="button" onClick={() => { onChange('', ''); setOpen(false) }}
                className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Clear dates
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function formatDay(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value))
}
