'use client'

// URL-synced Studio controls. Every view mode, filter, search term, sort and
// page lives in the query string, so refresh, deep links and back/forward all
// restore the same screen. Changing a filter always resets to page 1.

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronLeft, ChevronRight, Filter, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from './overlays'
import { S_FOCUS } from './ui'

export function useQueryPatch() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, start] = useTransition()
  const patch = (values: Record<string, string | null | undefined>, opts: { keepPage?: boolean } = {}) => {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(values)) {
      if (value === null || value === undefined || value === '') next.delete(key)
      else next.set(key, value)
    }
    if (!opts.keepPage && !('page' in values)) next.delete('page')
    const qs = next.toString()
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }
  return { params, patch, pending }
}

// ── View toggle ──────────────────────────────────────────────────────────────
export interface ViewOption { id: string; label: string; icon: React.ReactNode }

export function ViewToggle({ options, value, defaultValue, param = 'view', iconOnly = false, className, itemClassName, activeClassName }: {
  options: ViewOption[]
  value: string
  defaultValue: string
  param?: string
  iconOnly?: boolean
  className?: string
  itemClassName?: string
  activeClassName?: string
}) {
  const { patch } = useQueryPatch()
  return (
    <div role="radiogroup" aria-label="View" className={cn('inline-flex items-center rounded-[7px] border border-[#e3e7ee] bg-white p-0.5', className)}>
      {options.map(option => {
        const active = option.id === value
        return (
          <button key={option.id} type="button" role="radio" aria-checked={active} aria-label={iconOnly ? `${option.label} view` : undefined}
            title={iconOnly ? option.label : undefined}
            onClick={() => patch({ [param]: option.id === defaultValue ? null : option.id }, { keepPage: true })}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-[5px] px-2.5 text-[13px] font-medium transition-colors lg:h-[24px] lg:px-2 lg:text-[10px]', S_FOCUS,
              active ? cn('bg-[#eef3ff] text-[#1a5cff] ring-1 ring-inset ring-[#c9d8ff]', activeClassName) : 'text-slate-500 hover:text-slate-800',
              itemClassName,
            )}>
            {option.icon}{!iconOnly && option.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Search ───────────────────────────────────────────────────────────────────
export function SearchInput({ placeholder, param = 'q', className, inputClassName, label }: {
  placeholder: string
  param?: string
  className?: string
  inputClassName?: string
  label?: string
}) {
  const { params, patch } = useQueryPatch()
  const [value, setValue] = useState(params.get(param) ?? '')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const current = params.get(param) ?? ''
  const [synced, setSynced] = useState(current)
  if (current !== synced) { setSynced(current); setValue(current) }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <label className={cn('relative flex items-center', className)}>
      <span className="sr-only">{label ?? placeholder}</span>
      <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-slate-400 lg:h-3.5 lg:w-3.5" aria-hidden />
      <input type="search" value={value} placeholder={placeholder} maxLength={120}
        onChange={e => {
          const next = e.target.value
          setValue(next)
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => patch({ [param]: next.trim() || null }), 300)
        }}
        className={cn('h-10 w-full rounded-[7px] border border-[#e3e7ee] bg-white pl-8 pr-2 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#9db8ff] lg:h-[30px] lg:pl-7 lg:text-[10.5px]', inputClassName)} />
    </label>
  )
}

// ── Select filter ────────────────────────────────────────────────────────────
export interface Option { value: string; label: string }

export function SelectFilter({ param, label, options, allLabel = 'All', className, display = 'inline', prefix, dense = false }: {
  param: string
  label: string
  options: Option[]
  allLabel?: string
  className?: string
  /** inline: "Status ▾" / "Status: All ▾" · stacked: small label above value. */
  display?: 'inline' | 'prefix' | 'stacked' | 'value'
  prefix?: string
  /** Compact desktop sizing for crowded filter bars. */
  dense?: boolean
}) {
  const { params, patch } = useQueryPatch()
  const value = params.get(param) ?? ''
  const selected = options.find(o => o.value === value)
  return (
    <Popover>
      <PopoverTrigger haspopup="listbox" label={`${label}: ${selected?.label ?? allLabel}`}
        className={cn('inline-flex h-10 items-center justify-between gap-1.5 whitespace-nowrap rounded-[7px] border bg-white px-2.5 text-left text-[13px] text-slate-700 hover:bg-slate-50 lg:h-[30px]', dense ? 'lg:gap-[6px] lg:px-[9px] lg:text-[9.5px]' : 'lg:text-[10.5px]', S_FOCUS,
          value ? 'border-[#b9ccff] text-[#1a5cff]' : 'border-[#e3e7ee]', className)}>
        {display === 'stacked' ? (
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="text-[10px] text-slate-500 lg:text-[8px]">{label}</span>
            <span className="truncate">{selected?.label ?? allLabel}</span>
          </span>
        ) : display === 'prefix' ? (
          <span className="truncate">{prefix ?? label}: <span className="font-medium">{selected?.label ?? allLabel}</span></span>
        ) : display === 'value' ? (
          <span className="truncate">{selected?.label ?? allLabel}</span>
        ) : (
          <span className="truncate">{selected?.label ?? label}</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 lg:h-3 lg:w-3" aria-hidden />
      </PopoverTrigger>
      <PopoverContent role="listbox" label={label} width={200} className="max-h-72 overflow-y-auto">
        {close => (
          <>
            {[{ value: '', label: allLabel }, ...options].map(option => (
              <button key={option.value || 'all'} type="button" role="option" aria-selected={option.value === value}
                onClick={() => { patch({ [param]: option.value || null }); close() }}
                className={cn('flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[13px] lg:py-1.5 lg:text-[12px]', S_FOCUS,
                  option.value === value ? 'bg-[#eef3ff] font-medium text-[#1a5cff]' : 'text-slate-700 hover:bg-slate-50')}>
                {option.label}
              </button>
            ))}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ── Filters popover (several fields + clear) ─────────────────────────────────
export function FiltersMenu({ fields, className, label = 'Filters', iconRight = false }: {
  fields: { param: string; label: string; options: Option[] }[]
  className?: string
  label?: string
  iconRight?: boolean
}) {
  const { params, patch } = useQueryPatch()
  const active = fields.filter(f => params.get(f.param)).length
  return (
    <Popover>
      <PopoverTrigger label={`${label}${active ? ` (${active} active)` : ''}`}
        className={cn('inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-[7px] border border-[#e3e7ee] bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50 lg:h-[28px] lg:px-2.5 lg:text-[10.5px]', S_FOCUS, className)}>
        {!iconRight && <Filter className="h-3.5 w-3.5 lg:h-3 lg:w-3" aria-hidden />}
        {label}{active > 0 && <span className="rounded-full bg-[#1a5cff] px-1.5 text-[10px] text-white lg:text-[8px]">{active}</span>}
        {iconRight && <Filter className="h-3.5 w-3.5 lg:h-3 lg:w-3" aria-hidden />}
      </PopoverTrigger>
      <PopoverContent label={label} width={260} align="end" className="p-3">
        {close => (
          <div className="space-y-2.5">
            {fields.map(field => (
              <label key={field.param} className="block text-[12px] font-medium text-slate-600">
                {field.label}
                <select value={params.get(field.param) ?? ''} onChange={e => patch({ [field.param]: e.target.value || null })}
                  className="mt-1 block h-9 w-full rounded-lg border border-[#dfe3ea] bg-white px-2 text-[13px] text-slate-700 outline-none focus:border-blue-400">
                  <option value="">All</option>
                  {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            ))}
            <div className="flex justify-between pt-1">
              <button type="button" onClick={() => { patch(Object.fromEntries(fields.map(f => [f.param, null]))); close() }}
                className={cn('inline-flex items-center gap-1 text-[12px] font-medium text-slate-500 hover:text-slate-800', S_FOCUS)}>
                <X size={12} /> Clear filters
              </button>
              <button type="button" onClick={close} className={cn('rounded-md bg-[#1a5cff] px-3 py-1.5 text-[12px] font-medium text-white', S_FOCUS)}>Done</button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function ClearFilters({ params: keys, className, label = 'Clear filters' }: { params: string[]; className?: string; label?: string }) {
  const { params, patch } = useQueryPatch()
  if (!keys.some(k => params.get(k))) return null
  return (
    <button type="button" onClick={() => patch(Object.fromEntries(keys.map(k => [k, null])))}
      className={cn('whitespace-nowrap text-[13px] font-medium text-[#1a5cff] hover:underline lg:text-[10.5px]', S_FOCUS, className)}>
      {label}
    </button>
  )
}

// ── Pagination ───────────────────────────────────────────────────────────────
function pageList(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(pages - 1, page + 1)
  if (start > 2) out.push('…')
  for (let i = start; i <= end; i++) out.push(i)
  if (end < pages - 1) out.push('…')
  out.push(pages)
  return out
}

export function Pager({ page, size, total, sizes, className, showSummary = true, noun = 'results', edges = false }: {
  page: number
  size: number
  total: number
  sizes?: number[]
  className?: string
  showSummary?: boolean
  noun?: string
  edges?: boolean
}) {
  const { patch } = useQueryPatch()
  const pages = Math.max(1, Math.ceil(total / size))
  const from = total === 0 ? 0 : (page - 1) * size + 1
  const to = Math.min(total, page * size)
  const go = (p: number) => patch({ page: p <= 1 ? null : String(p) })
  const cellBase = 'inline-flex h-9 min-w-9 items-center justify-center rounded-[6px] border px-2 text-[13px] disabled:opacity-40 lg:h-[26px] lg:min-w-[26px] lg:text-[10px]'
  const cell = `${cellBase} border-[#e3e7ee] bg-white text-slate-600 hover:bg-slate-50`
  const cellActive = `${cellBase} border-[#1a5cff] bg-[#1a5cff] font-medium text-white`
  return (
    <nav aria-label="Pagination" className={cn('flex flex-wrap items-center gap-3', className)}>
      {showSummary && (
        <p className="text-[12px] text-slate-500 lg:text-[10px]">
          Showing {from.toLocaleString('en-GB')} to {to.toLocaleString('en-GB')} of {total.toLocaleString('en-GB')} {noun}
        </p>
      )}
      <div className="ml-auto flex items-center gap-1.5">
        {edges && <button type="button" className={cn(cell, S_FOCUS)} disabled={page <= 1} onClick={() => go(1)} aria-label="First page">«</button>}
        <button type="button" className={cn(cell, S_FOCUS)} disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Previous page"><ChevronLeft size={13} /></button>
        {pageList(page, pages).map((p, i) => p === '…'
          ? <span key={`e${i}`} className="px-1 text-[12px] text-slate-400 lg:text-[10px]">…</span>
          : (
            <button key={p} type="button" onClick={() => go(p)} aria-current={p === page ? 'page' : undefined}
              className={cn(p === page ? cellActive : cell, S_FOCUS)}>
              {p}
            </button>
          ))}
        <button type="button" className={cn(cell, S_FOCUS)} disabled={page >= pages} onClick={() => go(page + 1)} aria-label="Next page"><ChevronRight size={13} /></button>
        {edges && <button type="button" className={cn(cell, S_FOCUS)} disabled={page >= pages} onClick={() => go(pages)} aria-label="Last page">»</button>}
        {sizes && (
          <label className="ml-2 flex items-center gap-1.5 text-[12px] text-slate-500 lg:text-[10px]">
            <span className="whitespace-nowrap">Rows per page:</span>
            <select value={size} onChange={e => patch({ size: e.target.value, page: null })}
              className="h-9 rounded-[6px] border border-[#e3e7ee] bg-white px-2 text-[13px] text-slate-700 lg:h-[26px] lg:text-[10px]">
              {sizes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
      </div>
    </nav>
  )
}
