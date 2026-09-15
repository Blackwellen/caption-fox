'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { CalendarRange, LayoutGrid, ListFilter, Rows3, Search, SlidersHorizontal, Table2, Workflow } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EventViewMode } from '@/lib/events/types'

/**
 * Search, filters, sorting and view mode all live in the URL.
 *
 * That makes every control shareable, refresh-safe and back/forward-safe, and
 * it means the server component re-queries real records rather than the client
 * hiding rows it already downloaded.
 */

export interface FilterDefinition {
  /** URL parameter name. */
  key: string
  label: string
  options: { value: string; label: string }[]
  /** Label for the "no filter applied" option. Defaults to naive "All {label}s" pluralisation, which reads wrong for words like "Status" — always pass this explicitly for anything but a regular plural noun. */
  allLabel?: string
}

function useUrlState() {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  function set(updates: Record<string, string | null>, resetPage = true) {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '' || value === 'all') next.delete(key)
      else next.set(key, value)
    }
    if (resetPage) next.delete('page')
    startTransition(() => router.push(`?${next.toString()}`, { scroll: false }))
  }

  return { params, set, pending }
}

export function EventsFilterBar({
  searchPlaceholder, filters, dateRangeLabel, showMoreFilters = true, extraCount = 0,
}: {
  searchPlaceholder: string
  filters: FilterDefinition[]
  dateRangeLabel?: string
  showMoreFilters?: boolean
  extraCount?: number
}) {
  const { params, set, pending } = useUrlState()
  const [term, setTerm] = useState(params.get('q') ?? '')
  const [moreOpen, setMoreOpen] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Re-sync from the URL when it changes externally (Clear Filters, back/
  // forward) — adjusted during render, not in an effect, so a user's own
  // keystroke never gets clobbered by a redundant extra render.
  const [lastParamsQuery, setLastParamsQuery] = useState(params.get('q'))
  if (params.get('q') !== lastParamsQuery) {
    setLastParamsQuery(params.get('q'))
    setTerm(params.get('q') ?? '')
  }

  function onSearchChange(value: string) {
    setTerm(value)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => set({ q: value.trim() || null }), 350)
  }

  const activeFilters = filters.filter(filter => params.get(filter.key))
  const hasDates = params.get('dateFrom') || params.get('dateTo')
  const anyActive = activeFilters.length > 0 || hasDates || Boolean(params.get('q'))

  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-3', pending && 'opacity-70')}>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <label htmlFor="events-filter-search" className="sr-only">{searchPlaceholder}</label>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            id="events-filter-search"
            value={term}
            onChange={event => onSearchChange(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') set({ q: term.trim() || null }) }}
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {filters.map(filter => (
          <Select
            key={filter.key}
            label={filter.label}
            allLabel={filter.allLabel}
            value={params.get(filter.key) ?? 'all'}
            options={filter.options}
            onChange={value => set({ [filter.key]: value })}
          />
        ))}

        {dateRangeLabel && (
          <DateRange
            label={dateRangeLabel}
            from={params.get('dateFrom')}
            to={params.get('dateTo')}
            onChange={(from, to) => set({ dateFrom: from, dateTo: to })}
          />
        )}

        {showMoreFilters && (
          <button
            type="button"
            onClick={() => setMoreOpen(open => !open)}
            aria-expanded={moreOpen}
            className="relative inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
          >
            <SlidersHorizontal size={14} aria-hidden />
            More Filters
            {extraCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                {extraCount}
              </span>
            )}
          </button>
        )}

        {anyActive && (
          <button
            type="button"
            onClick={() => {
              setTerm('')
              set(Object.fromEntries([
                ...filters.map(f => [f.key, null]),
                ['q', null], ['dateFrom', null], ['dateTo', null],
              ]))
            }}
            className="text-[13px] font-semibold text-blue-600 hover:text-blue-700"
          >
            Clear Filters
          </button>
        )}
      </div>

      {moreOpen && (
        <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Sort by"
            hideAllOption
            value={params.get('sort') ?? 'date-desc'}
            options={[
              { value: 'date-desc', label: 'Date (newest first)' },
              { value: 'date-asc', label: 'Date (oldest first)' },
              { value: 'name-asc', label: 'Name (A–Z)' },
              { value: 'name-desc', label: 'Name (Z–A)' },
              { value: 'created-desc', label: 'Recently created' },
            ]}
            onChange={value => set({ sort: value })}
            block
          />
          <Select
            label="Results per page"
            hideAllOption
            value={params.get('pageSize') ?? '10'}
            options={[
              { value: '10', label: '10 per page' },
              { value: '25', label: '25 per page' },
              { value: '50', label: '50 per page' },
            ]}
            onChange={value => set({ pageSize: value })}
            block
          />
        </div>
      )}

      {anyActive && (
        <ul className="mt-3 flex flex-wrap items-center gap-1.5">
          {params.get('q') && <Chip label={`Search: ${params.get('q')}`} onRemove={() => { setTerm(''); set({ q: null }) }} />}
          {activeFilters.map(filter => (
            <Chip
              key={filter.key}
              label={`${filter.label}: ${filter.options.find(o => o.value === params.get(filter.key))?.label ?? params.get(filter.key)}`}
              onRemove={() => set({ [filter.key]: null })}
            />
          ))}
          {hasDates && (
            <Chip
              label={`Dates: ${params.get('dateFrom') ?? 'any'} – ${params.get('dateTo') ?? 'any'}`}
              onRemove={() => set({ dateFrom: null, dateTo: null })}
            />
          )}
        </ul>
      )}
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11.5px] font-medium text-blue-700 hover:bg-blue-100"
      >
        {label}
        <span aria-hidden>×</span>
        <span className="sr-only">Remove filter</span>
      </button>
    </li>
  )
}

function Select({
  label, value, options, onChange, block = false, allLabel, hideAllOption = false,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  block?: boolean
  allLabel?: string
  /** True for selects like Sort/Page size where every value is concrete — there is no "no filter" state to offer. */
  hideAllOption?: boolean
}) {
  const id = `events-filter-${label.toLowerCase().replaceAll(/\s+/g, '-')}`
  return (
    <div className={cn('relative', block ? 'w-full' : 'min-w-[132px]')}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <span className="pointer-events-none absolute left-3 top-1 text-[9.5px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <select
        id={id}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-[46px] w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 pt-3.5 text-[13px] font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
      >
        {!hideAllOption && <option value="all">{allLabel ?? `All ${label}s`}</option>}
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-3 top-1/2 translate-y-0 text-slate-400" width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function DateRange({
  label, from, to, onChange,
}: { label: string; from: string | null; to: string | null; onChange: (from: string | null, to: string | null) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        className="inline-flex h-[46px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-800"
      >
        <CalendarRange size={14} className="text-slate-400" aria-hidden />
        <span className="flex flex-col items-start leading-none">
          <span className="text-[9.5px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
          <span className="mt-1">{from || to ? `${from ?? 'Any'} – ${to ?? 'Any'}` : 'Any dates'}</span>
        </span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <label className="block text-[11.5px] font-medium text-slate-600" htmlFor="events-date-from">From</label>
          <input
            id="events-date-from" type="date" defaultValue={from ?? ''}
            onChange={event => onChange(event.target.value || null, to)}
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[13px]"
          />
          <label className="mt-2.5 block text-[11.5px] font-medium text-slate-600" htmlFor="events-date-to">To</label>
          <input
            id="events-date-to" type="date" defaultValue={to ?? ''}
            onChange={event => onChange(from, event.target.value || null)}
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[13px]"
          />
          <div className="mt-3 flex justify-between">
            <button type="button" onClick={() => { onChange(null, null); setOpen(false) }} className="text-[12.5px] font-medium text-slate-500 hover:text-slate-700">
              Clear
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-[12.5px] font-semibold text-white">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ view switcher */

const VIEW_ICONS: Record<EventViewMode, typeof LayoutGrid> = {
  cards: LayoutGrid,
  table: Table2,
  calendar: CalendarRange,
  timeline: ListFilter,
  board: Rows3,
  pipeline: Workflow,
}

const VIEW_LABELS: Record<EventViewMode, string> = {
  cards: 'Cards', table: 'Table', calendar: 'Calendar',
  timeline: 'Timeline', board: 'Board', pipeline: 'Pipeline',
}

export function ViewSwitcher({
  views, active,
}: { views: EventViewMode[]; active: EventViewMode }) {
  const { set } = useUrlState()
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1" role="tablist" aria-label="View mode">
      {views.map(view => {
        const Icon = VIEW_ICONS[view]
        const selected = view === active
        return (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => set({ view }, false)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
              selected ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50',
            )}
          >
            <Icon size={14} aria-hidden />
            {VIEW_LABELS[view]}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------- range picker */

export function RangePicker({
  value, options = [7, 30, 90],
}: { value: number; options?: number[] }) {
  const { set } = useUrlState()
  return (
    <div className="relative">
      <label htmlFor="events-range" className="sr-only">Comparison period</label>
      <select
        id="events-range"
        value={String(value)}
        onChange={event => set({ range: event.target.value }, false)}
        className="h-8 appearance-none rounded-lg border border-slate-200 bg-white pl-2.5 pr-7 text-[12px] font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
      >
        {options.map(days => (
          <option key={days} value={days}>Last {days} days</option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" width="11" height="11" viewBox="0 0 12 12" aria-hidden>
        <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

/* --------------------------------------------------------------- pagination */

export function Pagination({
  page, pageSize, total,
}: { page: number; pageSize: number; total: number }) {
  const { set } = useUrlState()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null

  const numbers: (number | '…')[] = []
  for (let index = 1; index <= pages; index += 1) {
    if (index <= 5 || index === pages) numbers.push(index)
    else if (numbers[numbers.length - 1] !== '…') numbers.push('…')
  }

  const first = (page - 1) * pageSize + 1
  const last = Math.min(total, page * pageSize)

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3" aria-label="Pagination">
      <p className="text-[12.5px] text-slate-500">
        Showing {first} to {last} of {total} {total === 1 ? 'record' : 'records'}
      </p>
      <div className="flex items-center gap-1">
        <PageButton disabled={page <= 1} onClick={() => set({ page: String(page - 1) }, false)} label="Previous page">‹</PageButton>
        {numbers.map((number, index) =>
          number === '…' ? (
            <span key={`gap-${index}`} className="px-1.5 text-[12.5px] text-slate-400">…</span>
          ) : (
            <button
              key={number}
              type="button"
              onClick={() => set({ page: String(number) }, false)}
              aria-current={number === page ? 'page' : undefined}
              className={cn(
                'h-8 min-w-8 rounded-lg px-2 text-[12.5px] font-semibold',
                number === page ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {number}
            </button>
          ),
        )}
        <PageButton disabled={page >= pages} onClick={() => set({ page: String(page + 1) }, false)} label="Next page">›</PageButton>
      </div>
      <div>
        <label htmlFor="events-page-size" className="sr-only">Results per page</label>
        <select
          id="events-page-size"
          value={String(pageSize)}
          onChange={event => set({ pageSize: event.target.value })}
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12.5px] text-slate-700"
        >
          {[10, 25, 50].map(size => <option key={size} value={size}>{size} per page</option>)}
        </select>
      </div>
    </nav>
  )
}

function PageButton({
  disabled, onClick, label, children,
}: { disabled: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className="h-8 w-8 rounded-lg text-[14px] text-slate-500 hover:bg-slate-100 disabled:opacity-35 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}
