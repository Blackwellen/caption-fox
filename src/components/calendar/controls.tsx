'use client'

import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OptionItem } from '@/lib/calendar/types'
import { T } from './primitives'

/**
 * URL is the single source of view state, so refresh, deep links, browser
 * back/forward and sharing all behave. Invalid values are ignored by the server
 * parser rather than throwing.
 */
function useQueryState() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const setParams = useCallback((patch: Record<string, string | null>, opts?: { resetPage?: boolean }) => {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '' || value === 'all') next.delete(key)
      else next.set(key, value)
    }
    if (opts?.resetPage !== false) next.delete('page')
    startTransition(() => {
      router.push(next.size ? `${pathname}?${next}` : pathname, { scroll: false })
    })
  }, [params, pathname, router])

  return { params, setParams, pending }
}

// ── Select ──────────────────────────────────────────────────────────────────

export function FilterSelect({
  name, label, options, allLabel = 'All', icon,
}: {
  name: string
  label: string
  options: OptionItem[]
  allLabel?: string
  icon?: React.ReactNode
}) {
  const { params, setParams } = useQueryState()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()
  const current = params.get(name) ?? 'all'
  const selected = options.find(o => o.value === current)

  useEffect(() => {
    if (!open) return
    function onDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(T.control, T.controlHover, T.focus, 'inline-flex items-center gap-1.5', selected && 'border-blue-300 bg-blue-50/60 text-blue-800')}
      >
        {icon}
        <span className="text-slate-500">{label}</span>
        <span className="max-w-[110px] truncate font-medium text-slate-800">{selected?.label ?? allLabel}</span>
        <ChevronDown size={14} className="text-slate-400" aria-hidden />
      </button>
      {open && (
        <div
          role="listbox"
          aria-labelledby={id}
          className="absolute left-0 top-full z-30 mt-1.5 max-h-72 w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          <Option selected={current === 'all'} onSelect={() => { setParams({ [name]: null }); setOpen(false) }}>{allLabel}</Option>
          {options.length === 0 && <p className="px-3 py-2 text-[12px] text-slate-400">Nothing to filter by yet</p>}
          {options.map(option => (
            <Option key={option.value} selected={current === option.value} onSelect={() => { setParams({ [name]: option.value }); setOpen(false) }}>
              {option.label}
            </Option>
          ))}
        </div>
      )}
    </div>
  )
}

function Option({ children, selected, onSelect }: { children: React.ReactNode; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn('flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-slate-50', selected ? 'font-medium text-blue-700' : 'text-slate-700')}
    >
      <span className="truncate">{children}</span>
      {selected && <Check size={14} aria-hidden />}
    </button>
  )
}

// ── Search ──────────────────────────────────────────────────────────────────

export function FilterSearch({ placeholder = 'Search…', className }: { placeholder?: string; className?: string }) {
  const { params, setParams } = useQueryState()
  const urlValue = params.get('search') ?? ''
  const [value, setValue] = useState(urlValue)
  const [syncedUrlValue, setSyncedUrlValue] = useState(urlValue)

  // Reset local value when the search param changes externally (e.g. "Clear all" or
  // browser back/forward) — adjusted during render rather than in an effect, per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (urlValue !== syncedUrlValue) {
    setSyncedUrlValue(urlValue)
    setValue(urlValue)
  }

  // Debounced so typing does not push a history entry per keystroke.
  useEffect(() => {
    if (value === urlValue) return
    const timer = setTimeout(() => setParams({ search: value || null }), 350)
    return () => clearTimeout(timer)
  }, [value, urlValue, setParams])

  return (
    <div className={cn('relative', className)}>
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={event => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={120}
        className={cn(T.control, T.focus, 'w-full pl-8 pr-3 placeholder:text-slate-400')}
      />
    </div>
  )
}

// ── Date range ──────────────────────────────────────────────────────────────

export function DateRangeControl({ label }: { label: string }) {
  const { params, setParams } = useQueryState()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const start = params.get('start') ?? ''
  const end = params.get('end') ?? ''

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className={cn(T.control, T.controlHover, T.focus, 'inline-flex items-center gap-2 font-medium text-slate-800')}
      >
        <CalendarDays size={14} className="text-slate-400" aria-hidden />
        {label}
        <ChevronDown size={14} className="text-slate-400" aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-medium text-slate-500">
              From
              <input type="date" defaultValue={start} onChange={e => setParams({ start: e.target.value || null })}
                className={cn(T.control, T.focus, 'mt-1 w-full')} />
            </label>
            <label className="text-[11px] font-medium text-slate-500">
              To
              <input type="date" defaultValue={end} onChange={e => setParams({ end: e.target.value || null })}
                className={cn(T.control, T.focus, 'mt-1 w-full')} />
            </label>
          </div>
          <button
            type="button"
            onClick={() => { setParams({ start: null, end: null, date: null }); setOpen(false) }}
            className={cn('mt-3 w-full rounded-lg border border-slate-200 py-1.5 text-[12.5px] text-slate-600 hover:bg-slate-50', T.focus)}
          >
            Reset to this month
          </button>
        </div>
      )}
    </div>
  )
}

/** Previous / Today / Next stepper. `step` is applied by the server parser. */
export function PeriodStepper({ anchorKey = 'date' }: { anchorKey?: string }) {
  const { params, setParams } = useQueryState()
  const offset = Number(params.get('offset') ?? '0') || 0
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
      <button type="button" onClick={() => setParams({ offset: String(offset - 1) }, { resetPage: false })}
        aria-label="Previous period" className={cn('flex h-[34px] w-8 items-center justify-center text-slate-500 hover:bg-slate-50', T.focus)}>
        <ChevronLeft size={15} aria-hidden />
      </button>
      <button type="button" onClick={() => setParams({ offset: null, [anchorKey]: null, start: null, end: null }, { resetPage: false })}
        className={cn('h-[34px] border-x border-slate-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50', T.focus)}>
        Today
      </button>
      <button type="button" onClick={() => setParams({ offset: String(offset + 1) }, { resetPage: false })}
        aria-label="Next period" className={cn('flex h-[34px] w-8 items-center justify-center text-slate-500 hover:bg-slate-50', T.focus)}>
        <ChevronRight size={15} aria-hidden />
      </button>
    </div>
  )
}

// ── View switcher ───────────────────────────────────────────────────────────

export function ViewSwitcher({
  views, current, variant = 'solid', paramName = 'view',
}: {
  views: { id: string; label: string; icon?: React.ReactNode; disabledReason?: string | null }[]
  current: string
  variant?: 'solid' | 'soft'
  paramName?: string
}) {
  const { setParams } = useQueryState()
  return (
    <div role="tablist" aria-label="View" className={cn('inline-flex items-center gap-0.5 rounded-lg p-0.5', variant === 'soft' ? 'bg-slate-100' : 'border border-slate-200 bg-white')}>
      {views.map(view => {
        const active = view.id === current
        return (
          <button
            key={view.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={!!view.disabledReason}
            title={view.disabledReason ?? undefined}
            onClick={() => setParams({ [paramName]: view.id }, { resetPage: false })}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3 text-[13px] font-medium transition-colors',
              active
                ? variant === 'soft' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'bg-blue-600 text-white'
                : 'text-slate-600 hover:text-slate-900',
              view.disabledReason && 'cursor-not-allowed opacity-40',
              T.focus,
            )}
          >
            {view.icon}
            {view.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Advanced filters + clear ────────────────────────────────────────────────

const MANAGED_KEYS = ['owner', 'team', 'channel', 'status', 'priority', 'type', 'campaign', 'approval', 'conflict', 'search', 'severity', 'assignee', 'impact', 'lane', 'delivery', 'start', 'end', 'date']

export function AdvancedFilters({
  extra,
}: {
  extra: { name: string; label: string; options: OptionItem[] }[]
}) {
  const { params, setParams } = useQueryState()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const activeCount = MANAGED_KEYS.filter(key => params.get(key)).length

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          className={cn(T.control, T.controlHover, T.focus, 'inline-flex items-center gap-1.5 font-medium text-slate-700')}
        >
          <SlidersHorizontal size={14} className="text-slate-400" aria-hidden />
          Filters
          {activeCount > 0 && (
            <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-semibold text-white">
              {activeCount}
            </span>
          )}
        </button>
        {open && (
          <div className="absolute right-0 top-full z-30 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">More filters</p>
            <div className="space-y-2.5">
              {extra.map(field => (
                <label key={field.name} className="block text-[12px] font-medium text-slate-600">
                  {field.label}
                  <select
                    value={params.get(field.name) ?? 'all'}
                    onChange={e => setParams({ [field.name]: e.target.value })}
                    className={cn(T.control, T.focus, 'mt-1 w-full')}
                  >
                    <option value="all">All</option>
                    {field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => setParams(Object.fromEntries(MANAGED_KEYS.map(key => [key, null])))}
          className={cn('inline-flex h-9 items-center gap-1 px-1 text-[13px] font-medium text-blue-600 hover:text-blue-700', T.focus)}
        >
          <X size={13} aria-hidden />Clear all
        </button>
      )}
    </>
  )
}

/** Filter row wrapper — one shell width, one rhythm, on every page. */
export function FilterBar({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-wrap items-center gap-2">{left}</div>
      {right && <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div>}
    </div>
  )
}
