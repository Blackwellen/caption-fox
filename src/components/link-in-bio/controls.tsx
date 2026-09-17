'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, Loader2, Search, SlidersHorizontal, Table2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUrlState } from '@/components/advertising/Controls'
import { deleteSavedView, saveView } from '@/lib/link-in-bio/actions'

// Every control writes to the URL, so state is shareable, survives refresh and
// works with back/forward; server components do the filtering. Changing any
// filter resets the page number.

const control = 'h-9 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15'

export function SearchBox({ placeholder, className, paramKey = 'q' }: { placeholder: string; className?: string; paramKey?: string }) {
  const { params, set, pending } = useUrlState()
  const urlValue = params.get(paramKey) ?? ''
  const [value, setValue] = useState(urlValue)
  const [synced, setSynced] = useState(urlValue)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const id = useId()
  if (synced !== urlValue) { setSynced(urlValue); setValue(urlValue) }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <div className={cn('relative min-w-0', className)}>
      <label htmlFor={id} className="sr-only">{placeholder}</label>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
      <input
        id={id} type="search" value={value} placeholder={placeholder} maxLength={120}
        onChange={event => {
          setValue(event.target.value)
          if (timer.current) clearTimeout(timer.current)
          const next = event.target.value
          timer.current = setTimeout(() => set({ [paramKey]: next.trim() || null }), 300)
        }}
        onKeyDown={event => {
          if (event.key === 'Enter') { event.preventDefault(); if (timer.current) clearTimeout(timer.current); set({ [paramKey]: value.trim() || null }) }
          if (event.key === 'Escape') { setValue(''); set({ [paramKey]: null }) }
        }}
        className={cn(control, 'w-full pl-9 pr-8 placeholder:text-slate-500')}
      />
      {pending && value ? <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" aria-hidden />
        : value && (
          <button type="button" onClick={() => { setValue(''); set({ [paramKey]: null }) }} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100" aria-label="Clear search">
            <X size={13} />
          </button>
        )}
    </div>
  )
}

export type Option = { value: string; label: string }

/** Native select showing its label until a value is chosen (design: "Type ⌄"). */
export function FilterSelect({ paramKey, label, options, className, icon, allLabel }: {
  paramKey: string; label: string; options: Option[]; className?: string; icon?: 'calendar'; allLabel?: string
}) {
  const { params, set } = useUrlState()
  const value = params.get(paramKey) ?? ''
  const id = useId()
  const active = value !== ''
  return (
    <div className={cn('relative min-w-0', className)}>
      <label htmlFor={id} className="sr-only">{label}</label>
      {icon === 'calendar' && <Calendar size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />}
      <select
        id={id} value={value} onChange={event => set({ [paramKey]: event.target.value || null })}
        className={cn(control, 'w-full appearance-none pr-8', icon ? 'pl-8' : 'pl-3', active && 'border-blue-300 bg-blue-50/40 font-medium text-blue-800')}
      >
        <option value="">{allLabel ?? label}</option>
        {options.map(option => <option key={option.value} value={option.value}>{allLabel ? `${label}: ${option.label}` : option.label}</option>)}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
    </div>
  )
}

export function SortSelect({ options, defaultValue, className }: { options: Option[]; defaultValue: string; className?: string }) {
  const { params, set } = useUrlState()
  const value = params.get('sort') ?? defaultValue
  const id = useId()
  return (
    <div className={cn('relative min-w-0', className)}>
      <label htmlFor={id} className="sr-only">Sort by</label>
      <select id={id} value={value} onChange={event => set({ sort: event.target.value === defaultValue ? null : event.target.value })} className={cn(control, 'w-full appearance-none pl-3 pr-8')}>
        {options.map(option => <option key={option.value} value={option.value}>Sort by: {option.label}</option>)}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
    </div>
  )
}

export type SavedView = { id: string; name: string; params: Record<string, string>; mine: boolean }

/** Saved views: apply a stored filter set, save the current one, or delete your own. */
export function SavedViewsSelect({ scope, views, workspaceType, className }: { scope: 'library' | 'themes' | 'analytics'; views: SavedView[]; workspaceType: string; className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const id = useId()
  const current = views.find(view => {
    const entries = Object.entries(view.params)
    return entries.length > 0 && entries.every(([k, v]) => searchParams.get(k) === v) && [...searchParams.keys()].filter(k => k !== 'page').length === entries.length
  })

  const onChange = (value: string) => {
    setError(null)
    if (value === '__save') {
      const name = window.prompt('Name this view')?.trim()
      if (!name) return
      const params: Record<string, string> = {}
      searchParams.forEach((v, k) => { if (k !== 'page') params[k] = v })
      start(async () => {
        const result = await saveView({ workspaceType, scope, name, params })
        if (!result.ok) setError(result.error)
        router.refresh()
      })
      return
    }
    if (value === '__delete' && current) {
      if (!window.confirm(`Delete the saved view “${current.name}”?`)) return
      start(async () => { const result = await deleteSavedView({ workspaceType, id: current.id }); if (!result.ok) setError(result.error); router.push(pathname) })
      return
    }
    const view = views.find(v => v.id === value)
    if (!view) { router.push(pathname); return }
    const query = new URLSearchParams(view.params).toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <div className={cn('relative min-w-0', className)}>
      <label htmlFor={id} className="sr-only">Saved views</label>
      <select id={id} value={current?.id ?? ''} onChange={event => onChange(event.target.value)} disabled={pending} className={cn(control, 'w-full appearance-none pl-3 pr-8')}>
        <option value="">Saved views</option>
        {views.map(view => <option key={view.id} value={view.id}>{view.name}{view.mine ? '' : ' (shared)'}</option>)}
        <option value="__save">+ Save current view…</option>
        {current?.mine && <option value="__delete">Delete “{current.name}”</option>}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
      {error && <p role="alert" className="absolute left-0 top-full mt-1 whitespace-nowrap text-[11px] text-red-600">{error}</p>}
    </div>
  )
}

/** "Filters (n)" button opening a popover with secondary filters and Clear all. */
export function MoreFilters({ count, children, clearKeep = ['view', 'sort', 'pageSize'] }: { count: number; children: React.ReactNode; clearKeep?: string[] }) {
  const [open, setOpen] = useState(false)
  const { clearAll } = useUrlState()
  const panel = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} className={cn(control, 'inline-flex items-center gap-2 px-3 font-medium')}>
        <SlidersHorizontal size={14} aria-hidden /> Filters
        {count > 0 && <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#1a5cff] px-1 text-[10px] font-semibold text-white">{count}</span>}
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close filters" onClick={() => setOpen(false)} />
          <div ref={panel} role="dialog" aria-label="Filters" className="absolute left-0 top-full z-30 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
            <div className="space-y-2">{children}</div>
            <div className="mt-3 flex justify-between border-t border-slate-100 pt-3">
              <button type="button" onClick={() => { clearAll(clearKeep); setOpen(false) }} className="text-[12px] font-medium text-slate-600 hover:text-slate-900">Clear all</button>
              <button type="button" onClick={() => setOpen(false)} className="text-[12px] font-medium text-[#1a5cff]">Done</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function ViewToggle({ defaultView = 'cards' }: { defaultView?: 'cards' | 'table' }) {
  const { params, set } = useUrlState()
  const active = params.get('view') ?? defaultView
  const views = [{ value: 'cards', label: 'Cards', Icon: LayoutGrid }, { value: 'table', label: 'Table', Icon: Table2 }] as const
  return (
    <div className="inline-flex items-center gap-1.5" role="group" aria-label="View">
      {views.map(({ value, label, Icon }) => (
        <button
          key={value} type="button" aria-pressed={active === value}
          onClick={() => set({ view: value === defaultView ? null : value }, { keepPage: true })}
          className={cn('inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[12px] font-medium transition-colors',
            active === value ? 'bg-[#1a5cff] text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}
        >
          <Icon size={14} aria-hidden /> {label}
        </button>
      ))}
    </div>
  )
}

export function PaginationBar({ page, pageSize, total, sizes = [6, 12, 24, 48], noun = 'results', className }: {
  page: number; pageSize: number; total: number; sizes?: number[]; noun?: string; className?: string
}) {
  const { set } = useUrlState()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)
  const numbers: (number | 'gap')[] = []
  for (let i = 1; i <= pages; i++) {
    if (i <= 5 && page <= 4 || i === pages || Math.abs(i - page) <= 1 || i === 1) numbers.push(i)
    else if (numbers[numbers.length - 1] !== 'gap') numbers.push('gap')
  }
  const box = 'inline-flex h-[30px] min-w-[30px] items-center justify-center rounded-md border px-1.5 text-[12px] font-medium'
  const id = useId()
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <p className="text-[12px] text-slate-600" aria-live="polite">{total === 0 ? `No ${noun}` : `Showing ${first}–${last} of ${total.toLocaleString('en-GB')} ${noun}`}</p>
      <nav className="flex items-center gap-2" aria-label="Pagination">
        <button type="button" disabled={page <= 1} onClick={() => set({ page: page - 1 === 1 ? null : String(page - 1) }, { keepPage: true })} className={cn(box, 'border-slate-200 bg-white text-slate-600 disabled:opacity-40')} aria-label="Previous page"><ChevronLeft size={14} /></button>
        {numbers.map((n, i) => n === 'gap'
          ? <span key={`gap-${i}`} className="px-1 text-[12px] text-slate-400" aria-hidden>…</span>
          : (
            <button key={n} type="button" aria-current={n === page ? 'page' : undefined} onClick={() => set({ page: n === 1 ? null : String(n) }, { keepPage: true })}
              className={cn(box, n === page ? 'border-[#1a5cff] bg-[#1a5cff] text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
              {n}
            </button>
          ))}
        <button type="button" disabled={page >= pages} onClick={() => set({ page: String(page + 1) }, { keepPage: true })} className={cn(box, 'border-slate-200 bg-white text-slate-600 disabled:opacity-40')} aria-label="Next page"><ChevronRight size={14} /></button>
      </nav>
      <div className="flex items-center gap-2 text-[12px] text-slate-600">
        <label htmlFor={id}>Show</label>
        <div className="relative">
          <select id={id} value={pageSize} onChange={event => set({ pageSize: event.target.value === String(sizes[0]) ? null : event.target.value })} className={cn(control, 'h-[30px] w-[72px] appearance-none pl-3 pr-7')}>
            {sizes.map(size => <option key={size} value={size}>{size}</option>)}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
        </div>
        <span>per page</span>
      </div>
    </div>
  )
}
