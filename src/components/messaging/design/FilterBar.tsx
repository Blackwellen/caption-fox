'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Bookmark, CalendarDays, ChevronDown, LayoutGrid, List, Search, SlidersHorizontal, Trash2, Columns3, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { deleteMessagingView, saveMessagingView } from '@/app/app/messaging/views-actions'

// URL-backed filter row from the Messaging designs. Every control writes to the
// query string, so refresh, back/forward and shared links restore the same
// view; the server re-queries with the same values.

export interface FilterOption { value: string; label: string }
export interface FilterDef { key: string; label: string; options: FilterOption[]; allLabel?: string; width?: string; advanced?: boolean }
export interface SavedView { id: string; name: string; params: Record<string, string>; shared: boolean; mine: boolean }

function useQuery() {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const [, startTransition] = useTransition()
  const apply = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(search.toString())
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k) }
    next.delete('page')
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false }))
  }
  return { search, apply }
}

function Popover({ open, onClose, children, className }: { open: boolean; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onDown = (e: MouseEvent) => { if (!ref.current?.parentElement?.contains(e.target as Node)) onClose() }
    document.addEventListener('keydown', onKey); document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown) }
  }, [open, onClose])
  if (!open) return null
  return <div ref={ref} className={cn('absolute left-0 top-full z-40 mt-1 rounded-lg border border-slate-200 bg-white p-2 text-left shadow-lg', className)}>{children}</div>
}

const CONTROL = 'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 text-[12.5px] text-slate-700 hover:bg-slate-50 lg:h-[24px] lg:gap-[6px] lg:rounded-[5px] lg:px-[9px] lg:text-[8.5px]'

export default function FilterBar({
  date, filters, surface, savedViews = [], views, search: searchDef, advancedCount, stacked, className, leading,
}: {
  date?: { label: string }
  filters: FilterDef[]
  surface: string
  savedViews?: SavedView[]
  views?: ('cards' | 'list' | 'board')[]
  search?: { placeholder: string }
  advancedCount?: number
  stacked?: boolean
  className?: string
  leading?: ReactNode
}) {
  const { search, apply } = useQuery()
  const [openKey, setOpenKey] = useState<string | null>(null)
  const inline = filters.filter(f => !f.advanced)
  const advanced = filters.filter(f => f.advanced)
  const activeAdvanced = advancedCount ?? filters.filter(f => search.get(f.key)).length
  const [q, setQ] = useState(search.get('q') ?? '')

  useEffect(() => {
    if (!searchDef) return
    const handle = setTimeout(() => { if ((search.get('q') ?? '') !== q) apply({ q: q || null }) }, 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const view = search.get('view') ?? 'list'

  return (
    <div className={cn('flex flex-wrap items-center gap-2 lg:flex-nowrap lg:gap-[8px]', className)} role="toolbar" aria-label="Filters">
      {leading}
      {date && (
        <div className="relative">
          <button type="button" className={CONTROL} aria-haspopup="dialog" aria-expanded={openKey === 'date'} onClick={() => setOpenKey(k => k === 'date' ? null : 'date')}>
            <CalendarDays className="h-3.5 w-3.5 text-slate-500 lg:h-[11px] lg:w-[11px]" aria-hidden />
            {date.label}
            <ChevronDown className="h-3 w-3 text-slate-500 lg:ml-[6px] lg:h-2.5 lg:w-2.5" aria-hidden />
          </button>
          <Popover open={openKey === 'date'} onClose={() => setOpenKey(null)} className="w-60">
            <DateRange from={search.get('from') ?? ''} to={search.get('to') ?? ''} onApply={(from, to) => { apply({ from, to }); setOpenKey(null) }} />
          </Popover>
        </div>
      )}

      {searchDef && (
        <label className={cn(CONTROL, 'w-full cursor-text sm:w-56 lg:w-[150px]')}>
          <Search className="h-3.5 w-3.5 text-slate-400 lg:h-[10px] lg:w-[10px]" aria-hidden />
          <span className="sr-only">Search</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={searchDef.placeholder} maxLength={120}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400" />
          {q && <button type="button" aria-label="Clear search" onClick={() => setQ('')}><X className="h-3 w-3 text-slate-400" /></button>}
        </label>
      )}

      {inline.map(f => (
        <Select key={f.key} def={f} value={search.get(f.key) ?? ''} stacked={stacked} onChange={v => apply({ [f.key]: v || null })} />
      ))}

      <div className="relative">
        <button type="button" className={cn(CONTROL, stacked && 'lg:h-[30px]')} aria-haspopup="dialog" aria-expanded={openKey === 'filters'} onClick={() => setOpenKey(k => k === 'filters' ? null : 'filters')}>
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500 lg:h-[10px] lg:w-[10px]" aria-hidden />
          {stacked ? 'Filters' : searchDef ? 'More filters' : 'Filters'}
          {activeAdvanced > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white lg:h-[11px] lg:min-w-[11px] lg:text-[7px]">{activeAdvanced}</span>}
        </button>
        <Popover open={openKey === 'filters'} onClose={() => setOpenKey(null)} className="w-64 space-y-2">
          {(advanced.length ? advanced : filters).map(f => (
            <label key={f.key} className="block text-[12px] text-slate-600">
              {f.label}
              <select value={search.get(f.key) ?? ''} onChange={e => apply({ [f.key]: e.target.value || null })}
                className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px] text-slate-700">
                <option value="">{f.allLabel ?? `All`}</option>
                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          ))}
          <button type="button" className="w-full rounded-md border border-slate-200 py-1.5 text-[12px] text-slate-600 hover:bg-slate-50"
            onClick={() => { apply(Object.fromEntries([...filters.map(f => [f.key, null]), ['from', null], ['to', null], ['q', null]])); setQ(''); setOpenKey(null) }}>
            Clear all filters
          </button>
        </Popover>
      </div>

      <div className="hidden flex-1 lg:block" />

      <div className="relative">
        <button type="button" className={cn(CONTROL, stacked && 'lg:h-[30px]', 'lg:px-[8px]')} aria-haspopup="dialog" aria-expanded={openKey === 'views'} onClick={() => setOpenKey(k => k === 'views' ? null : 'views')}>
          <Bookmark className="h-3.5 w-3.5 text-slate-500 lg:h-[10px] lg:w-[10px]" aria-hidden />
          Saved views
          {searchDef && <ChevronDown className="h-3 w-3 text-slate-500 lg:ml-[40px] lg:h-2.5 lg:w-2.5" aria-hidden />}
        </button>
        <Popover open={openKey === 'views'} onClose={() => setOpenKey(null)} className="right-0 left-auto w-64">
          <SavedViewsPanel surface={surface} views={savedViews} current={Object.fromEntries(search.entries())} onPick={params => { apply({ ...Object.fromEntries([...search.keys()].map(k => [k, null])), ...params }); setOpenKey(null) }} />
        </Popover>
      </div>

      {views && (
        <div className={cn('flex items-center gap-0.5 rounded-md lg:gap-[4px]')} role="radiogroup" aria-label="View">
          {views.map(v => {
            const Icon = v === 'cards' ? LayoutGrid : v === 'list' ? List : Columns3
            const active = view === v
            return (
              <button key={v} type="button" role="radio" aria-checked={active} aria-label={`${v} view`} onClick={() => apply({ view: v === 'list' ? null : v })}
                className={cn('flex h-9 w-9 items-center justify-center rounded-md lg:h-[20px] lg:w-[24px] lg:rounded-[4px]', active ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100')}>
                <Icon className="h-4 w-4 lg:h-[11px] lg:w-[11px]" aria-hidden />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Select({ def, value, onChange, stacked }: { def: FilterDef; value: string; onChange: (v: string) => void; stacked?: boolean }) {
  const selected = def.options.find(o => o.value === value)
  return (
    <label className={cn('relative', CONTROL, 'cursor-pointer pr-6 lg:pr-[18px]', stacked && 'flex-col items-start justify-center gap-0 lg:h-[30px] lg:gap-0', def.width)}>
      {stacked ? (
        <>
          <span className="text-[10px] text-slate-500 lg:text-[7px]">{def.label}</span>
          <span className="text-[12px] text-slate-700 lg:text-[8px]">{selected?.label ?? def.allLabel ?? 'All'}</span>
        </>
      ) : (
        <span className="truncate">{selected ? (def.allLabel === undefined ? `${def.label}: ${selected.label}` : selected.label) : def.label}</span>
      )}
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500 lg:right-[6px] lg:h-2.5 lg:w-2.5" aria-hidden />
      <select value={value} onChange={e => onChange(e.target.value)} aria-label={def.label} className="absolute inset-0 cursor-pointer opacity-0">
        <option value="">{def.allLabel ?? `All ${def.label.toLowerCase()}`}</option>
        {def.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}

function DateRange({ from, to, onApply }: { from: string; to: string; onApply: (from: string | null, to: string | null) => void }) {
  const [start, setStart] = useState(from)
  const [end, setEnd] = useState(to)
  const preset = (days: number) => {
    const today = new Date()
    const e = today.toISOString().slice(0, 10)
    const s = new Date(today.getTime() - (days - 1) * 86_400_000).toISOString().slice(0, 10)
    onApply(s, e)
  }
  return (
    <div className="space-y-2 text-[12px] text-slate-600">
      <div className="grid grid-cols-3 gap-1">
        {[7, 30, 90].map(d => <button key={d} type="button" onClick={() => preset(d)} className="rounded-md border border-slate-200 py-1 hover:bg-slate-50">{d} days</button>)}
      </div>
      <label className="block">From<input type="date" value={start} onChange={e => setStart(e.target.value)} className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2" /></label>
      <label className="block">To<input type="date" value={end} onChange={e => setEnd(e.target.value)} className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2" /></label>
      <div className="flex gap-1">
        <button type="button" onClick={() => onApply(null, null)} className="flex-1 rounded-md border border-slate-200 py-1.5 hover:bg-slate-50">Last 30 days</button>
        <button type="button" onClick={() => onApply(start || null, end || null)} className="flex-1 rounded-md bg-blue-600 py-1.5 font-medium text-white hover:bg-blue-700">Apply</button>
      </div>
    </div>
  )
}

function SavedViewsPanel({ surface, views, current, onPick }: { surface: string; views: SavedView[]; current: Record<string, string>; onPick: (params: Record<string, string>) => void }) {
  const [name, setName] = useState('')
  const [shared, setShared] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  return (
    <div className="space-y-2 text-[12px]">
      {views.length === 0 ? <p className="px-1 py-2 text-slate-400">No saved views yet.</p> : (
        <ul className="max-h-48 space-y-0.5 overflow-auto">
          {views.map(v => (
            <li key={v.id} className="flex items-center gap-1">
              <button type="button" onClick={() => onPick(v.params)} className="min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left text-slate-700 hover:bg-slate-50">
                {v.name}{v.shared && <span className="ml-1 text-[10px] text-slate-400">Shared</span>}
              </button>
              {v.mine && (
                <button type="button" aria-label={`Delete view ${v.name}`} disabled={pending}
                  onClick={() => startTransition(async () => { const r = await deleteMessagingView(v.id); if (!r.ok) setError(r.error ?? null); else router.refresh() })}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form className="space-y-1.5 border-t border-slate-100 pt-2" onSubmit={e => {
        e.preventDefault()
        setError(null)
        startTransition(async () => {
          const params = Object.fromEntries(Object.entries(current).filter(([k]) => k !== 'page' && k !== 'journey' && k !== 'step'))
          const r = await saveMessagingView(surface, name, params, shared)
          if (!r.ok) setError(r.error ?? 'Could not save.')
          else { setName(''); router.refresh() }
        })
      }}>
        <label className="block text-slate-600">Save current view
          <input value={name} onChange={e => setName(e.target.value)} maxLength={60} required className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2" placeholder="View name" />
        </label>
        <label className="flex items-center gap-1.5 text-slate-500"><input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} /> Share with workspace</label>
        {error && <p role="alert" className="text-red-600">{error}</p>}
        <button type="submit" disabled={pending} className="w-full rounded-md bg-blue-600 py-1.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60">{pending ? 'Saving…' : 'Save view'}</button>
      </form>
    </div>
  )
}
