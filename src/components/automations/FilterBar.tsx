'use client'

import { useCallback, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  CalendarDays, Check, ChevronDown, LayoutGrid, List, Columns3, CalendarRange,
  GalleryVerticalEnd, Loader2, Search, SlidersHorizontal, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CARD, CARD_SHADOW } from './primitives'

export interface FilterOption { value: string; label: string }

export interface FilterSpec {
  key: string
  label: string
  allLabel: string
  options: FilterOption[]
  advanced?: boolean
}

export type ViewId = 'cards' | 'table' | 'board' | 'timeline' | 'gallery' | 'calendar'

const VIEW_META: Record<ViewId, { label: string; icon: typeof LayoutGrid }> = {
  cards: { label: 'Cards', icon: LayoutGrid },
  table: { label: 'Table', icon: List },
  board: { label: 'Board', icon: Columns3 },
  timeline: { label: 'Timeline', icon: GalleryVerticalEnd },
  gallery: { label: 'Gallery', icon: LayoutGrid },
  calendar: { label: 'Calendar', icon: CalendarRange },
}

interface FilterBarProps {
  searchPlaceholder: string
  filters: FilterSpec[]
  views?: ViewId[]
  activeView?: string
  values: object
  showDateRange?: boolean
  dateRangeLabel?: string
  trailing?: React.ReactNode
  className?: string
}

/** The URL-driven filter bar shared by the Automations surfaces. Mirrors
 * src/components/community/FilterBar.tsx. */
export default function FilterBar({
  searchPlaceholder, filters, views, activeView, values: rawValues,
  showDateRange, dateRangeLabel = 'Any date', trailing, className,
}: FilterBarProps) {
  const values = rawValues as Record<string, string | number | boolean | null>
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const urlTerm = String(values.q ?? '')
  const [term, setTerm] = useState(urlTerm)
  const [syncedTerm, setSyncedTerm] = useState(urlTerm)
  if (syncedTerm !== urlTerm) {
    setSyncedTerm(urlTerm)
    setTerm(urlTerm)
  }
  const [showAdvanced, setShowAdvanced] = useState(
    () => filters.some(f => f.advanced && values[f.key]),
  )
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const push = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    if (!('page' in patch)) next.delete('page')
    const qs = next.toString()
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }, [params, pathname, router])

  function onSearch(value: string) {
    setTerm(value)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => push({ q: value.trim() || null }), 350)
  }

  const { basic, advanced } = useMemo(() => ({
    basic: filters.filter(f => !f.advanced),
    advanced: filters.filter(f => f.advanced),
  }), [filters])

  const activeCount = useMemo(() => {
    let count = 0
    let dateCounted = false
    for (const [key, value] of Object.entries(values)) {
      if (['q', 'view', 'sort', 'page', 'size'].includes(key)) continue
      if (value === '' || value === null || value === undefined || value === false) continue
      if (key === 'from' || key === 'to') {
        if (!dateCounted) { count += 1; dateCounted = true }
        continue
      }
      count += 1
    }
    return count
  }, [values])

  function clearAll() {
    const next = new URLSearchParams()
    if (activeView) next.set('view', activeView)
    const qs = next.toString()
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }

  return (
    <div className={cn(CARD, CARD_SHADOW, 'p-2.5', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[200px] flex-1">
          <span className="sr-only">{searchPlaceholder}</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={term}
            onChange={event => onSearch(event.target.value)}
            onKeyDown={event => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              if (debounce.current) clearTimeout(debounce.current)
              push({ q: term.trim() || null })
            }}
            placeholder={searchPlaceholder}
            maxLength={120}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          {pending && (
            <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-300" aria-hidden />
          )}
        </label>

        {showDateRange && (
          <DateRange
            from={String(values.from ?? '')} to={String(values.to ?? '')}
            label={dateRangeLabel} onChange={(from, to) => push({ from: from || null, to: to || null })}
          />
        )}

        {basic.map(filter => (
          <SelectFilter
            key={filter.key} spec={filter}
            value={String(values[filter.key] ?? '')}
            onChange={value => push({ [filter.key]: value || null })}
          />
        ))}

        {advanced.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAdvanced(open => !open)}
            aria-expanded={showAdvanced}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors',
              showAdvanced ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            <SlidersHorizontal size={14} />
            More Filters
          </button>
        )}

        {activeCount > 0 && (
          <button
            type="button" onClick={clearAll}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium text-blue-600 hover:bg-blue-50"
          >
            <X size={13} />
            Reset ({activeCount})
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {trailing}
          {views && views.length > 1 && activeView && (
            <ViewSwitcher views={views} active={activeView} onChange={view => push({ view })} />
          )}
        </div>
      </div>

      {showAdvanced && advanced.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
          {advanced.map(filter => (
            <SelectFilter
              key={filter.key} spec={filter} labelled
              value={String(values[filter.key] ?? '')}
              onChange={value => push({ [filter.key]: value || null })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SelectFilter({
  spec, value, onChange, labelled,
}: { spec: FilterSpec; value: string; onChange: (value: string) => void; labelled?: boolean }) {
  const control = (
    <div className="relative">
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        aria-label={spec.label}
        className={cn(
          'h-9 min-w-[132px] appearance-none rounded-lg border bg-white pl-3 pr-8 text-[13px] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100',
          value ? 'border-blue-200 bg-blue-50/60 font-medium text-blue-700' : 'border-slate-200 text-slate-600',
        )}
      >
        <option value="">{spec.allLabel}</option>
        {spec.options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
    </div>
  )
  if (!labelled) return control
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-slate-500">{spec.label}</p>
      {control}
    </div>
  )
}

function DateRange({
  from, to, label, onChange,
}: { from: string; to: string; label: string; onChange: (from: string, to: string) => void }) {
  const [open, setOpen] = useState(false)
  const summary = from || to ? `${from || '…'} → ${to || '…'}` : label

  return (
    <div className="relative">
      <button
        type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px]',
          from || to ? 'border-blue-200 bg-blue-50/60 font-medium text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
        )}
      >
        <CalendarDays size={14} className="text-slate-400" aria-hidden />
        <span className="max-w-[170px] truncate">{summary}</span>
        <ChevronDown size={14} className="text-slate-400" aria-hidden />
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close date range" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
            <label className="block text-[11px] font-medium text-slate-500">
              From
              <input
                type="date" value={from} max={to || undefined}
                onChange={event => onChange(event.target.value, to)}
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-[13px] text-slate-700"
              />
            </label>
            <label className="mt-2 block text-[11px] font-medium text-slate-500">
              To
              <input
                type="date" value={to} min={from || undefined}
                onChange={event => onChange(from, event.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-[13px] text-slate-700"
              />
            </label>
            <div className="mt-3 flex justify-between">
              <button
                type="button" onClick={() => { onChange('', ''); setOpen(false) }}
                className="text-[12px] font-medium text-slate-500 hover:text-slate-800"
              >
                Clear
              </button>
              <button
                type="button" onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[12px] font-medium text-white"
              >
                <Check size={12} />Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function ViewSwitcher({
  views, active, onChange,
}: { views: ViewId[]; active: string; onChange: (view: ViewId) => void }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Change view">
      {views.map(view => {
        const meta = VIEW_META[view]
        const Icon = meta.icon
        const selected = view === active
        return (
          <button
            key={view} type="button" onClick={() => onChange(view)} aria-pressed={selected}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors',
              selected ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
            )}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{meta.label}</span>
          </button>
        )
      })}
    </div>
  )
}
