'use client'

import { useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  CalendarDays, ChevronDown, LayoutGrid, List, Map as MapIcon, Columns3, GitCompareArrows, BookOpen, Kanban,
  Grid3x3, GanttChart, CalendarRange, BarChart3, Layers, Search, SlidersHorizontal, Clock3, X, UserRound, Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Menu } from './client/menu'
import { Dialog, DialogButton } from './client/dialog'
import { TextField } from './client/fields'

// ── URL state ────────────────────────────────────────────────────────────────

/** Patches the current query string. Any change except `page` resets pagination. */
export function useQueryPatch() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  function patch(values: Record<string, string | null | undefined>, opts: { replace?: boolean } = {}) {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(values)) {
      if (value === null || value === undefined || value === '') next.delete(key)
      else next.set(key, value)
    }
    if (!('page' in values)) next.delete('page')
    const qs = next.toString()
    const href = qs ? `${pathname}?${qs}` : pathname
    startTransition(() => {
      if (opts.replace) router.replace(href, { scroll: false })
      else router.push(href, { scroll: false })
    })
  }

  return { params, patch, pending, pathname }
}

// ── Shared control chrome ────────────────────────────────────────────────────

export const CONTROL = 'inline-flex h-11 min-w-0 items-center gap-2 rounded-lg border border-sg-line bg-white px-3 text-[13px] text-sg-ink transition-colors hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-sg-blue lg:h-[30px] lg:gap-[9px] lg:rounded-[7px] lg:px-[10px] lg:text-[11px]'

const FILTER_ICONS = { calendar: CalendarDays, user: UserRound, target: Target, layers: Layers, clock: Clock3 } as const

export interface Option { value: string; label: string }

/** Single-select filter bound to one query parameter. */
export function SelectFilter({
  param, options, allLabel, prefix, icon, className, labelText,
}: {
  param: string
  options: Option[]
  /** Label shown when nothing is selected, e.g. "All owners". */
  allLabel: string
  /** "Status: All" style prefix. */
  prefix?: string
  icon?: keyof typeof FILTER_ICONS
  className?: string
  /** Accessible name for the control. */
  labelText: string
}) {
  const { params, patch } = useQueryPatch()
  const current = params.get(param) ?? ''
  const selected = options.find(option => option.value === current)
  const Icon = icon ? FILTER_ICONS[icon] : null
  const text = prefix ? `${prefix}: ${selected?.label ?? 'All'}` : (selected?.label ?? allLabel)

  return (
    <Menu
      label={labelText}
      align="start"
      className={className}
      panelClassName="min-w-[200px]"
      items={[
        { id: '__all', label: allLabel, selected: !current, onSelect: () => patch({ [param]: null }) },
        ...options.map(option => ({
          id: option.value, label: option.label, selected: option.value === current,
          onSelect: () => patch({ [param]: option.value }),
        })),
      ]}
      trigger={({ ref, toggle, open, ...aria }) => (
        <button ref={ref} type="button" onClick={toggle} {...aria} aria-label={`${labelText}: ${selected?.label ?? 'All'}`}
          className={cn(CONTROL, 'w-full justify-between', current && 'border-sg-blue/40 bg-sg-blue-soft/40')}>
          <span className="flex min-w-0 items-center gap-2 lg:gap-[9px]">
            {Icon && <Icon aria-hidden className="h-4 w-4 shrink-0 text-slate-500 lg:h-[13px] lg:w-[13px]" />}
            <span className="truncate">{text}</span>
          </span>
          <ChevronDown aria-hidden className={cn('h-4 w-4 shrink-0 text-slate-500 transition-transform lg:h-3 lg:w-3', open && 'rotate-180')} />
        </button>
      )}
    />
  )
}

/** Date range presets plus a custom from/to dialog, bound to range/from/to. */
export function RangeFilter({
  presets, fallbackLabel, className,
}: { presets: { value: string; label: string }[]; fallbackLabel: string; className?: string }) {
  const { params, patch } = useQueryPatch()
  const [customOpen, setCustomOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const range = params.get('range') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const selected = presets.find(preset => preset.value === range)
  const label = range === 'custom' && from && to
    ? `${new Date(`${from}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(`${to}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : selected?.label ?? fallbackLabel

  return (
    <>
      <Menu
        label="Date range"
        align="start"
        className={className}
        panelClassName="min-w-[240px]"
        items={[
          ...presets.map((preset, index) => ({
            id: preset.value, label: preset.label,
            selected: range ? preset.value === range : index === 0,
            onSelect: () => patch({ range: index === 0 ? null : preset.value, from: null, to: null }),
          })),
          { id: 'custom', label: 'Custom range…', selected: range === 'custom', separatorBefore: true, onSelect: () => setCustomOpen(true) },
        ]}
        trigger={({ ref, toggle, open, ...aria }) => (
          <button ref={ref} type="button" onClick={toggle} {...aria} aria-label={`Date range: ${label}`}
            className={cn(CONTROL, 'w-full justify-between')}>
            <span className="flex min-w-0 items-center gap-2 lg:gap-[9px]">
              <CalendarDays aria-hidden className="h-4 w-4 shrink-0 text-slate-500 lg:h-[13px] lg:w-[13px]" />
              <span className="truncate">{label}</span>
            </span>
            <ChevronDown aria-hidden className={cn('h-4 w-4 shrink-0 text-slate-500 transition-transform lg:h-3 lg:w-3', open && 'rotate-180')} />
          </button>
        )}
      />
      <Dialog open={customOpen} onClose={() => setCustomOpen(false)} title="Custom date range" size="sm"
        description="Show records active between these dates."
        footer={(
          <>
            <DialogButton onClick={() => setCustomOpen(false)}>Cancel</DialogButton>
            <DialogButton variant="primary" type="submit" form="strategy-custom-range">Apply range</DialogButton>
          </>
        )}>
        <form id="strategy-custom-range" className="grid grid-cols-2 gap-3" onSubmit={event => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          const nextFrom = String(data.get('from') ?? '')
          const nextTo = String(data.get('to') ?? '')
          if (!nextFrom || !nextTo) { setError('Choose both a start and an end date.'); return }
          if (nextTo < nextFrom) { setError('The end date must be on or after the start date.'); return }
          setError(null)
          setCustomOpen(false)
          patch({ range: 'custom', from: nextFrom, to: nextTo })
        }}>
          <TextField label="From" name="from" type="date" defaultValue={from} required />
          <TextField label="To" name="to" type="date" defaultValue={to} required error={error ?? undefined} />
        </form>
      </Dialog>
    </>
  )
}

/** Debounced search bound to `q`. Replaces history entries while typing. */
export function SearchFilter({ placeholder, className, label }: { placeholder: string; className?: string; label: string }) {
  const { params, patch } = useQueryPatch()
  const external = params.get('q') ?? ''
  const [value, setValue] = useState(external)
  const [synced, setSynced] = useState(external)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Browser back/forward and "Clear all" change the URL — adopt it during
  // render (React's recommended alternative to syncing state in an effect).
  if (external !== synced) {
    setSynced(external)
    setValue(external)
  }

  return (
    <div className={cn('relative min-w-0', className)} role="search">
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 lg:left-[10px] lg:h-[13px] lg:w-[13px]" />
      <input
        type="search" value={value} placeholder={placeholder} aria-label={label} maxLength={120}
        onChange={event => {
          const next = event.target.value
          setValue(next)
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => patch({ q: next.trim() || null }, { replace: true }), 300)
        }}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            if (timer.current) clearTimeout(timer.current)
            patch({ q: value.trim() || null }, { replace: true })
          }
        }}
        className="h-11 w-full rounded-lg border border-sg-line bg-white pl-9 pr-3 text-[14px] text-sg-ink placeholder:text-slate-400 focus:border-sg-blue focus:outline-none focus:ring-2 focus:ring-sg-blue/20 lg:h-[30px] lg:rounded-[7px] lg:pl-[31px] lg:text-[10.5px]"
      />
    </div>
  )
}

/** "Clear all" — removes every filter key but keeps the current view. */
export function ClearFilters({ keys, className, label = 'Clear all', alwaysVisible }: { keys: string[]; className?: string; label?: string; /** Keep the button on screen (disabled) when nothing is filtered. */ alwaysVisible?: boolean }) {
  const { params, patch } = useQueryPatch()
  const active = keys.some(key => params.get(key))
  if (!active && !alwaysVisible) return null
  return (
    <button type="button" disabled={!active} onClick={() => patch(Object.fromEntries(keys.map(key => [key, null])))}
      className={cn('inline-flex h-11 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-sg-blue hover:bg-sg-blue-soft disabled:cursor-default disabled:hover:bg-transparent lg:h-[30px] lg:text-[10px]', className)}>
      <X aria-hidden className="h-3.5 w-3.5 lg:hidden" />
      {label}
    </button>
  )
}

/**
 * "Filters" / "More filters" dialog: secondary filters the toolbar has no room
 * for. Applies all at once so the list only re-queries a single time.
 */
export function MoreFilters({
  fields, label = 'Filters', className, search,
}: {
  fields: { param: string; label: string; options: Option[] }[]
  label?: string
  className?: string
  /** Adds a keyword field bound to `q` for pages whose toolbar has no search box. */
  search?: { label: string; placeholder?: string }
}) {
  const { params, patch } = useQueryPatch()
  const [open, setOpen] = useState(false)
  const count = fields.filter(field => params.get(field.param)).length + (search && params.get('q') ? 1 : 0)
  const keys = [...fields.map(field => field.param), ...(search ? ['q'] : [])]

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
        className={cn(CONTROL, count > 0 && 'border-sg-blue/40 bg-sg-blue-soft/40', className)}>
        <SlidersHorizontal aria-hidden className="h-4 w-4 shrink-0 text-slate-500 lg:h-[13px] lg:w-[13px]" />
        <span>{label}{count > 0 && <span className="ml-1 rounded bg-sg-blue px-1 text-[10px] font-semibold text-white lg:text-[9px]">{count}</span>}</span>
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={label} description="Narrow the records on this page." size="md"
        footer={(
          <>
            <DialogButton onClick={() => { patch(Object.fromEntries(keys.map(key => [key, null]))); setOpen(false) }}>Reset</DialogButton>
            <DialogButton variant="primary" type="submit" form="strategy-more-filters">Apply filters</DialogButton>
          </>
        )}>
        <form id="strategy-more-filters" className="grid grid-cols-1 gap-3.5 sm:grid-cols-2" onSubmit={event => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          patch(Object.fromEntries(keys.map(key => [key, String(data.get(key) ?? '').trim().slice(0, 120) || null])))
          setOpen(false)
        }}>
          {search && (
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[12.5px] font-medium text-sg-body">{search.label}</span>
              <input type="search" name="q" maxLength={120} defaultValue={params.get('q') ?? ''} placeholder={search.placeholder}
                className="h-10 w-full rounded-lg border border-sg-line bg-white px-3 text-[13px] text-sg-ink placeholder:text-slate-400 focus:border-sg-blue focus:outline-none focus:ring-2 focus:ring-sg-blue/20" />
            </label>
          )}
          {fields.map(field => (
            <label key={field.param} className="block">
              <span className="mb-1 block text-[12.5px] font-medium text-sg-body">{field.label}</span>
              <select name={field.param} defaultValue={params.get(field.param) ?? ''}
                className="h-10 w-full rounded-lg border border-sg-line bg-white px-3 text-[13px] text-sg-ink focus:border-sg-blue focus:outline-none focus:ring-2 focus:ring-sg-blue/20">
                <option value="">Any</option>
                {field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          ))}
        </form>
      </Dialog>
    </>
  )
}

// ── View switcher ────────────────────────────────────────────────────────────

const VIEW_ICONS = {
  dashboard: LayoutGrid, cards: LayoutGrid, library: LayoutGrid, framework: Layers,
  table: List, timeline: GanttChart, kanban: Kanban, board: Columns3, map: MapIcon, compare: GitCompareArrows,
  matrix: Grid3x3, gantt: GanttChart, calendar: CalendarRange, charts: BarChart3, scenarios: BookOpen,
} as const
export type ViewId = keyof typeof VIEW_ICONS

export function ViewSwitcher({
  views, current, defaultView, showLabel = true, className,
}: {
  views: { id: ViewId; label: string }[]
  current: ViewId
  defaultView: ViewId
  showLabel?: boolean
  className?: string
}) {
  const { patch } = useQueryPatch()
  return (
    <div className={cn('flex min-w-0 items-center gap-2 lg:gap-[13px]', className)}>
      {showLabel && <span className="hidden text-[10.5px] text-sg-body lg:inline" id="strategy-view-label">View</span>}
      <div role="radiogroup" aria-label="Page view" className="flex min-w-0 overflow-x-auto rounded-lg border border-sg-line bg-white [scrollbar-width:none] lg:rounded-[7px]">
        {views.map((view, index) => {
          const Icon = VIEW_ICONS[view.id]
          const active = view.id === current
          return (
            <button key={view.id} type="button" role="radio" aria-checked={active}
              onClick={() => { if (!active) patch({ view: view.id === defaultView ? null : view.id, compare: null }) }}
              className={cn(
                'relative inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap px-3.5 text-[13px] transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-sg-blue lg:h-[30px] lg:gap-[7px] lg:px-[12px] lg:text-[11px]',
                index > 0 && 'border-l border-sg-line',
                active ? 'bg-sg-blue-soft/60 font-medium text-sg-blue shadow-[inset_0_0_0_1px_var(--color-sg-blue)] lg:rounded-[6px]' : 'text-sg-body hover:bg-slate-50',
              )}>
              <Icon aria-hidden className="h-4 w-4 lg:h-[13px] lg:w-[13px]" />
              {view.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
