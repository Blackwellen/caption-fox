'use client'

// Interactive Creators & UGC controls. Every control writes to the URL, so a
// refresh, back/forward, a shared link and a saved view all restore the same
// screen; the server re-parses and re-validates every value.

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  BookmarkPlus, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Download,
  LayoutGrid, List, Loader2, Search, SlidersHorizontal, Table2, Trash2, Columns3,
  GanttChartSquare, CalendarRange, Bookmark,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ResponsiveTabs from '@/components/ui/ResponsiveTabs'
import { useToast } from '@/components/campaigns/Toast'
import { deleteCreatorsView, saveCreatorsView } from '@/lib/creators/actions'
import { CARD } from './design'

// ── URL helpers ─────────────────────────────────────────────────────────────

/** Active /{type}/creators base, derived from the current route. */
export function useCreatorsBase(): string {
  const pathname = usePathname()
  const match = pathname.match(/^\/(creator|business|brand|agency)\/creators/)
  return match ? match[0] : '/app/creators'
}

export function useUrlState() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const push = useCallback((patch: Record<string, string | null>, opts: { keepPage?: boolean } = {}) => {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    if (!opts.keepPage && !('page' in patch)) next.delete('page')
    const qs = next.toString()
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }, [params, pathname, router])

  return { params, pathname, push, pending, router }
}

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) close() }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, close])
  return ref
}

const CONTROL = 'h-[34px] rounded-lg border border-[#dfe3ea] bg-white text-[11.5px] text-[#344054] transition-colors hover:border-[#cbd2dd] focus:outline-none focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100'

// ── Filter row ──────────────────────────────────────────────────────────────

export interface SelectSpec {
  key: string
  /** Placeholder when nothing is selected, e.g. "All Campaigns". */
  all: string
  /** Accessible name and the small label in the labelled variant. */
  label: string
  options: { value: string; label: string }[]
  width?: number
  /** Keep the width on phones too (e.g. selects inside panel headers). */
  fixedWidth?: boolean
}

export type ViewSpec = { id: string; label: string; icon: 'cards' | 'table' | 'board' | 'timeline' | 'gallery' | 'calendar' }

const VIEW_ICON = { cards: LayoutGrid, table: Table2, board: Columns3, timeline: GanttChartSquare, gallery: LayoutGrid, calendar: CalendarRange }

export function SearchBox({ placeholder, width, className, big }: { placeholder: string; width?: number; className?: string; big?: boolean }) {
  const { params, push, pending } = useUrlState()
  const [term, setTerm] = useState(params.get('q') ?? '')
  const [synced, setSynced] = useState(params.get('q') ?? '')
  const current = params.get('q') ?? ''
  if (current !== synced) { setSynced(current); setTerm(current) }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  return (
    <label className={cn('relative block min-w-0 max-sm:w-full', width && 'sm:w-[var(--cw)]', className)} style={width ? ({ '--cw': `${width}px` } as React.CSSProperties) : undefined}>
      <span className="sr-only">{placeholder}</span>
      <Search size={14} className="pointer-events-none absolute left-[11px] top-1/2 -translate-y-1/2 text-[#8a94a6]" aria-hidden />
      <input
        type="search" value={term} maxLength={120} placeholder={placeholder}
        onChange={event => {
          const value = event.target.value
          setTerm(value)
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => push({ q: value.trim() || null }), 350)
        }}
        onKeyDown={event => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          if (timer.current) clearTimeout(timer.current)
          push({ q: term.trim() || null })
        }}
        className={cn(CONTROL, 'w-full pl-[32px] pr-7 placeholder:text-[#8a94a6]', big && 'h-[36px] border-transparent text-[12px] hover:border-transparent')}
      />
      {pending && <Loader2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-slate-300" aria-hidden />}
    </label>
  )
}

export function SelectControl({ spec, labelled }: { spec: SelectSpec; labelled?: boolean }) {
  const { params, push } = useUrlState()
  const value = params.get(spec.key) ?? ''
  const select = (
    <span className={cn('relative block', spec.fixedWidth ? 'w-[var(--cw)]' : cn('max-sm:w-full', spec.width && 'sm:w-[var(--cw)]'))} style={spec.width ? ({ '--cw': `${spec.width}px` } as React.CSSProperties) : undefined}>
      <select
        value={value} aria-label={spec.label}
        onChange={event => push({ [spec.key]: event.target.value || null })}
        className={cn(CONTROL, 'w-full appearance-none truncate pl-[11px] pr-7', value && 'border-[#bcd0fb] bg-[#f5f8ff] text-[#1d4ed8]')}
      >
        <option value="">{spec.all}</option>
        {spec.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-[10px] top-1/2 -translate-y-1/2 text-[#667085]" aria-hidden />
    </span>
  )
  if (!labelled) return select
  return (
    <div className="min-w-0">
      <p className="mb-[6px] text-[9.5px] font-medium text-[#667085]">{spec.label}</p>
      {select}
    </div>
  )
}

/** Date range written to from/to; label shows the applied range. */
export function DateRangeControl({ width = 183, allLabel = 'Any date', fromKey = 'from', toKey = 'to', icon = true }: { width?: number; allLabel?: string; fromKey?: string; toKey?: string; icon?: boolean }) {
  const { params, push } = useUrlState()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss(open, close)
  const from = params.get(fromKey) ?? ''
  const to = params.get(toKey) ?? ''
  const fmt = (v: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${v}T00:00:00Z`))
  const label = from && to ? `${fmt(from).replace(/ \d{4}$/, '')} – ${fmt(to)}` : from ? `From ${fmt(from)}` : to ? `Until ${fmt(to)}` : allLabel

  const preset = (days: number) => {
    const end = new Date()
    const start = new Date(end.getTime() - (days - 1) * 86_400_000)
    push({ [fromKey]: start.toISOString().slice(0, 10), [toKey]: end.toISOString().slice(0, 10) })
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative max-sm:w-full sm:w-[var(--cw)]" style={{ '--cw': `${width}px` } as React.CSSProperties}>
      <button type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(v => !v)}
        className={cn(CONTROL, 'flex w-full items-center gap-[9px] pl-[11px] pr-[10px]', (from || to) && 'text-[#101828]')}>
        {icon && <CalendarDays size={14} className="shrink-0 text-[#667085]" aria-hidden />}
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <span className="h-4 border-l border-[#e4e7ec]" aria-hidden />
        <ChevronDown size={13} className="shrink-0 text-[#667085]" aria-hidden />
      </button>
      {open && (
        <div role="dialog" aria-label="Choose date range" className="absolute left-0 top-full z-40 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {[7, 30, 90].map(days => (
              <button key={days} type="button" onClick={() => preset(days)} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50">Last {days} days</button>
            ))}
          </div>
          <label className="block text-[11px] font-medium text-slate-500">From
            <input type="date" value={from} max={to || undefined} onChange={e => push({ [fromKey]: e.target.value || null })} className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 text-[12px]" />
          </label>
          <label className="mt-2 block text-[11px] font-medium text-slate-500">To
            <input type="date" value={to} min={from || undefined} onChange={e => push({ [toKey]: e.target.value || null })} className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 text-[12px]" />
          </label>
          <div className="mt-3 flex justify-between">
            <button type="button" onClick={() => { push({ [fromKey]: null, [toKey]: null }); setOpen(false) }} className="text-[12px] font-medium text-slate-500 hover:text-slate-800">Clear</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md bg-blue-600 px-2.5 py-1 text-[12px] font-medium text-white">Done</button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Preset-based select stored under a single key (e.g. due=30, expiry=90). */
export function PresetControl({ spec, icon, labelled }: { spec: SelectSpec; icon?: boolean; labelled?: boolean }) {
  const { params, push } = useUrlState()
  const value = params.get(spec.key) ?? ''
  const control = (
    <span className={cn('relative block max-sm:w-full', spec.width && 'sm:w-[var(--cw)]')} style={spec.width ? ({ '--cw': `${spec.width}px` } as React.CSSProperties) : undefined}>
      {icon && <CalendarDays size={13} className="pointer-events-none absolute left-[10px] top-1/2 -translate-y-1/2 text-[#667085]" aria-hidden />}
      <select value={value} aria-label={spec.label} onChange={e => push({ [spec.key]: e.target.value || null })}
        className={cn(CONTROL, 'w-full appearance-none pr-7', icon ? 'pl-[30px]' : 'pl-[11px]', value && 'text-[#101828]')}>
        <option value="">{spec.all}</option>
        {spec.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-[10px] top-1/2 -translate-y-1/2 text-[#667085]" aria-hidden />
    </span>
  )
  if (!labelled) return control
  return <div><p className="mb-[6px] text-[9.5px] font-medium text-[#667085]">{spec.label}</p>{control}</div>
}

/** Segmented view switcher ("Card View | Table View"). */
export function ViewToggle({ views, active, className, size = 'md' }: { views: ViewSpec[]; active: string; className?: string; size?: 'md' | 'sm' }) {
  const { push } = useUrlState()
  return (
    <div role="group" aria-label="Change view" className={cn('inline-flex h-[34px] items-center rounded-lg border border-[#dfe3ea] bg-white p-[3px]', className)}>
      {views.map(view => {
        const Icon = VIEW_ICON[view.icon]
        const selected = view.id === active
        return (
          <button key={view.id} type="button" aria-pressed={selected} onClick={() => push({ view: view.id }, { keepPage: false })}
            className={cn('inline-flex h-full items-center gap-[6px] whitespace-nowrap rounded-md px-[11px] text-[10.5px] font-medium transition-colors',
              size === 'sm' && 'gap-[5px] px-[7px] text-[10px]',
              selected ? 'bg-[#eef4ff] text-[#1d6bf3] ring-1 ring-inset ring-[#c9dafd]' : 'text-[#475467] hover:bg-slate-50')}>
            <Icon size={13} aria-hidden />
            <span className="hidden sm:inline">{view.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export interface MenuOption { value: string; label: string }

/**
 * The square "adjust" button at the end of each filter row: sort order, page
 * size, extra filters and reset, in one accessible popover.
 */
export function SettingsMenu({
  sorts, sortKey = 'sort', defaultSort, extra, pageSizes = [10, 25, 50, 100], showPageSize = true,
}: { sorts: MenuOption[]; sortKey?: string; defaultSort: string; extra?: SelectSpec[]; pageSizes?: number[]; showPageSize?: boolean }) {
  const { params, push, pathname, router } = useUrlState()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss(open, close)
  const activeFilters = [...params.keys()].filter(k => !['view', 'page', 'size', 'sort'].includes(k)).length

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="Sort, filters and display options" aria-expanded={open} onClick={() => setOpen(v => !v)}
        className={cn(CONTROL, 'relative flex w-[34px] items-center justify-center text-[#475467]')}>
        <SlidersHorizontal size={15} aria-hidden />
        {activeFilters > 0 && <span className="absolute -right-1 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#1d6bf3] px-1 text-[9px] font-semibold text-white">{activeFilters}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Display options" className="absolute right-0 top-full z-40 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <label className="block text-[11px] font-medium text-slate-500">Sort by
            <select value={params.get(sortKey) ?? defaultSort} onChange={e => push({ [sortKey]: e.target.value === defaultSort ? null : e.target.value })}
              className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 text-[12px] text-slate-700">
              {sorts.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          {showPageSize && (
            <label className="mt-2 block text-[11px] font-medium text-slate-500">Rows per page
              <select value={params.get('size') ?? String(pageSizes[0])} onChange={e => push({ size: e.target.value === String(pageSizes[0]) ? null : e.target.value })}
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 text-[12px] text-slate-700">
                {pageSizes.map(s => <option key={s} value={s}>{s} / page</option>)}
              </select>
            </label>
          )}
          {extra && extra.length > 0 && (
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
              <p className="text-[11px] font-semibold text-slate-700">More filters</p>
              {extra.map(spec => <SelectControl key={spec.key} spec={{ ...spec, width: undefined }} labelled />)}
            </div>
          )}
          <div className="mt-3 flex justify-between border-t border-slate-100 pt-3">
            <button type="button" onClick={() => { const view = params.get('view'); router.push(view ? `${pathname}?view=${view}` : pathname, { scroll: false }); setOpen(false) }}
              className="text-[12px] font-medium text-slate-500 hover:text-slate-800">Clear all filters</button>
            <button type="button" onClick={close} className="rounded-md bg-blue-600 px-2.5 py-1 text-[12px] font-medium text-white">Done</button>
          </div>
        </div>
      )}
    </div>
  )
}

/** "Reset" link used by the labelled filter panels. */
export function ResetFilters({ className, label = 'Reset' }: { className?: string; label?: string }) {
  const { params, pathname, router } = useUrlState()
  const active = [...params.keys()].some(k => !['view', 'page', 'size', 'sort'].includes(k))
  return (
    <button type="button" disabled={!active}
      onClick={() => { const view = params.get('view'); router.push(view ? `${pathname}?view=${view}` : pathname, { scroll: false }) }}
      className={cn('text-[11px] font-medium text-[#1d6bf3] hover:underline disabled:cursor-default disabled:text-[#98a2b3] disabled:no-underline', className)}>
      {label}
    </button>
  )
}

// ── Export ──────────────────────────────────────────────────────────────────

const SPLIT = 'inline-flex h-10 items-center rounded-[9px] border border-[#dfe3ea] bg-white text-[13px] font-semibold text-[#1f2937]'

/**
 * Export split button. The main action exports the current filtered view;
 * the menu offers the same entity without filters and related registers.
 * Every download re-applies workspace scope and permissions on the server.
 */
export function ExportMenu({
  entity, allowed, related = [],
}: { entity: string; allowed: boolean; related?: { entity: string; label: string }[] }) {
  const { params } = useUrlState()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss(open, close)
  const current = new URLSearchParams(params.toString())
  current.set('entity', entity)
  current.delete('page')

  if (!allowed) {
    return (
      <button type="button" disabled title="Your role does not include exporting data." className={cn(SPLIT, 'cursor-not-allowed gap-2 px-[18px] opacity-55')}>
        <Download size={16} aria-hidden />Export<span className="sr-only">. Unavailable: your role cannot export</span>
      </button>
    )
  }

  return (
    <div ref={ref} className={cn(SPLIT, 'relative')}>
      <a href={`/api/creators/export?${current.toString()}`} className="flex h-full items-center gap-[10px] rounded-l-[9px] pl-[18px] pr-[20px] hover:bg-slate-50">
        <Download size={16} aria-hidden />Export
      </a>
      <span className="h-full w-px bg-[#dfe3ea]" aria-hidden />
      <button type="button" aria-label="More export options" aria-expanded={open} onClick={() => setOpen(v => !v)}
        className="flex h-full w-[40px] items-center justify-center rounded-r-[9px] hover:bg-slate-50">
        <ChevronDown size={15} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-1 w-60 rounded-xl border border-slate-200 bg-white p-1 text-[12.5px] font-normal shadow-lg">
          <a role="menuitem" href={`/api/creators/export?${current.toString()}`} className="block rounded-lg px-2.5 py-2 hover:bg-slate-50">Current view (CSV)</a>
          <a role="menuitem" href={`/api/creators/export?entity=${entity}`} className="block rounded-lg px-2.5 py-2 hover:bg-slate-50">All records (CSV)</a>
          {related.map(r => (
            <a key={r.entity} role="menuitem" href={`/api/creators/export?entity=${r.entity}`} className="block rounded-lg px-2.5 py-2 hover:bg-slate-50">{r.label}</a>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Saved views ─────────────────────────────────────────────────────────────

export interface SavedViewLite { id: string; name: string; query: Record<string, string>; is_shared: boolean; mine: boolean }

export function SavedViewsMenu({ views, width = 128 }: { surface: string; views: SavedViewLite[]; width?: number }) {
  const { pathname, router } = useUrlState()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss(open, close)
  const [pending, startTransition] = useTransition()

  return (
    <div ref={ref} className="relative max-sm:w-full sm:w-[var(--cw)]" style={{ '--cw': `${width}px` } as React.CSSProperties}>
      <button type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(v => !v)}
        className={cn(CONTROL, 'flex w-full items-center gap-2 pl-[11px] pr-[10px] font-medium')}>
        <List size={14} className="text-[#475467]" aria-hidden />
        <span className="flex-1 truncate text-left">Saved Views</span>
        <ChevronDown size={13} className="text-[#667085]" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-40 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {views.length === 0 && <p className="px-2.5 py-3 text-[12px] text-slate-400">No saved views yet. Set filters, then use Save View.</p>}
          {views.map(view => (
            <div key={view.id} className="group flex items-center rounded-lg hover:bg-slate-50">
              <button type="button" role="menuitem"
                onClick={() => { const qs = new URLSearchParams(view.query).toString(); router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }); close() }}
                className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-[12.5px] text-slate-700">
                <Bookmark size={13} className="shrink-0 text-slate-400" aria-hidden />
                <span className="truncate">{view.name}</span>
                {view.is_shared && <span className="shrink-0 rounded bg-slate-100 px-1 text-[9.5px] text-slate-500">Shared</span>}
              </button>
              {view.mine && (
                <button type="button" aria-label={`Delete view ${view.name}`} disabled={pending}
                  onClick={() => startTransition(async () => {
                    const result = await deleteCreatorsView(view.id)
                    notify(result.ok ? 'success' : 'error', result.ok ? result.message ?? 'View deleted.' : result.error ?? 'Could not delete view.')
                    router.refresh()
                  })}
                  className="mr-1 rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SaveViewButton({ surface }: { surface: string }) {
  const { params, router } = useUrlState()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss(open, close)
  const [name, setName] = useState('')
  const [shared, setShared] = useState(false)
  const [pending, startTransition] = useTransition()

  function save() {
    if (!name.trim() || pending) return
    const query: Record<string, string> = {}
    params.forEach((value, key) => { if (key !== 'page') query[key] = value })
    startTransition(async () => {
      const result = await saveCreatorsView({ surface, name, query, shared })
      if (!result.ok) { notify('error', result.error ?? 'Could not save the view.'); return }
      notify('success', result.message ?? 'View saved.')
      setOpen(false); setName(''); setShared(false); router.refresh()
    })
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)}
        className="inline-flex h-[30px] items-center gap-[7px] rounded-lg bg-[#1d6bf3] px-[12px] text-[11px] font-medium text-white shadow-sm hover:bg-[#165ad6]">
        <BookmarkPlus size={13} aria-hidden />Save View
      </button>
      {open && (
        <form onSubmit={e => { e.preventDefault(); save() }} className="absolute left-0 top-full z-40 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <label className="block text-[11px] font-medium text-slate-500">View name
            <input autoFocus value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="UK beauty creators"
              className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 text-[12px]" />
          </label>
          <label className="mt-2 flex items-center gap-2 text-[12px] text-slate-600">
            <input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} className="rounded border-slate-300" />
            Share with this workspace
          </label>
          <p className="mt-2 text-[11px] text-slate-400">Saves the current search, filters, sort and view.</p>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={close} className="rounded-md px-2.5 py-1 text-[12px] text-slate-500 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={!name.trim() || pending} className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-50">
              {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}Save
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ── Pagination ──────────────────────────────────────────────────────────────

export function Pager({
  page, size, total, noun, className, sizes = [10, 25, 50, 100], compact,
}: { page: number; size: number; total: number; noun: string; className?: string; sizes?: number[]; compact?: boolean }) {
  const { push } = useUrlState()
  const pages = Math.max(1, Math.ceil(total / size))
  const first = total === 0 ? 0 : (page - 1) * size + 1
  const last = Math.min(page * size, total)
  const numbers: (number | 'gap')[] = []
  for (let i = 1; i <= pages; i += 1) {
    if (i === 1 || i === pages || (i >= page - 1 && i <= page + (page === 1 ? 2 : 1))) numbers.push(i)
    else if (numbers[numbers.length - 1] !== 'gap') numbers.push('gap')
  }
  const box = compact ? 'h-[26px] min-w-[26px] text-[10.5px]' : 'h-[32px] min-w-[32px] text-[11px]'

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <p className="text-[11px] text-[#667085]">
        {total === 0 ? `No ${noun}` : `Showing ${first}–${last} of ${total.toLocaleString('en-GB')} ${noun}`}
      </p>
      <nav aria-label="Pagination" className="mx-auto flex items-center gap-[10px]">
        <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => push({ page: page - 1 <= 1 ? null : String(page - 1) })}
          className={cn('inline-flex items-center justify-center rounded-md text-[#667085] hover:bg-slate-100 disabled:opacity-40', box, !compact && 'border border-[#e4e7ec]')}>
          <ChevronLeft size={14} />
        </button>
        {numbers.map((n, i) => n === 'gap'
          ? <span key={`gap-${i}`} className="text-[11px] text-[#98a2b3]" aria-hidden>…</span>
          : (
            <button key={n} type="button" aria-current={n === page ? 'page' : undefined} onClick={() => push({ page: n === 1 ? null : String(n) })}
              className={cn('inline-flex items-center justify-center rounded-md px-2 font-medium', box,
                n === page ? 'border border-[#1d6bf3] bg-white text-[#1d6bf3]' : cn('text-[#344054] hover:bg-slate-100', !compact && 'border border-[#e4e7ec]'))}>
              {n}
            </button>
          ))}
        <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => push({ page: String(page + 1) })}
          className={cn('inline-flex items-center justify-center rounded-md text-[#667085] hover:bg-slate-100 disabled:opacity-40', box, !compact && 'border border-[#e4e7ec]')}>
          <ChevronRight size={14} />
        </button>
      </nav>
      <label className="relative">
        <span className="sr-only">Rows per page</span>
        <select value={size} onChange={e => push({ size: e.target.value === String(sizes[0]) ? null : e.target.value, page: null })}
          className={cn('appearance-none rounded-lg border border-[#dfe3ea] bg-white pl-3 pr-8 text-[11px] text-[#344054]', compact ? 'h-[28px]' : 'h-[34px]')}>
          {sizes.map(s => <option key={s} value={s}>{s} / page</option>)}
        </select>
        <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#667085]" aria-hidden />
      </label>
    </div>
  )
}

// ── Section tabs ────────────────────────────────────────────────────────────

export function CreatorsTabs({ basePath, tabs }: { basePath: string; tabs: { id: string; label: string; badge?: number }[] }) {
  const pathname = usePathname()
  const items = tabs.map(tab => ({ id: tab.id, label: tab.label, href: tab.id === 'overview' ? basePath : `${basePath}/${tab.id}`, badge: tab.badge }))
  return (
    <ResponsiveTabs
      items={items}
      ariaLabel="Creators and UGC sections"
      isActive={item => (item.id === 'overview' ? pathname === basePath : pathname === item.href || pathname.startsWith(`${item.href}/`))}
    />
  )
}

/** Card container for the labelled filter panels (Creators, Rights). */
export function FilterCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(CARD, className)}>{children}</div>
}

export function LinkButton({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return <Link href={href} className={cn('flex h-[30px] items-center justify-center rounded-lg border border-[#dfe3ea] bg-white text-[10.5px] font-medium text-[#1d6bf3] hover:bg-[#f5f8ff]', className)}>{children}</Link>
}
