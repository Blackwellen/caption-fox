'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildHref, readParam, type SearchParams } from '@/lib/seo/url-state'

export interface SelectFilter {
  key: string
  placeholder: string
  options: { value: string; label: string }[]
}

/**
 * Search box + a row of select filters, all reflected in the URL. Debounces
 * the search box; selects navigate immediately. Works from server-rendered
 * pages — no external form state library needed.
 */
export function FilterBar({
  pathname, params, searchPlaceholder, selects = [], resultCount, resultNoun = 'results',
}: {
  pathname: string
  params: SearchParams
  searchPlaceholder: string
  selects?: SelectFilter[]
  resultCount?: number
  resultNoun?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(readParam(params, 'q') ?? '')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setValue(readParam(params, 'q') ?? ''), [params])

  function pushSearch(next: string) {
    router.push(buildHref(pathname, searchParams, { q: next || undefined, page: undefined }))
  }

  function onChange(next: string) {
    setValue(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => pushSearch(next), 350)
  }

  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={value}
            onChange={event => onChange(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') { if (timer.current) clearTimeout(timer.current); pushSearch(value) } }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-8 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          {value && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => { onChange(''); pushSearch('') }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {selects.map(select => (
          <select
            key={select.key}
            value={readParam(params, select.key) ?? ''}
            onChange={event => router.push(buildHref(pathname, searchParams, { [select.key]: event.target.value || undefined, page: undefined }))}
            aria-label={select.placeholder}
            className={cn(
              'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-blue-400',
              readParam(params, select.key) && 'border-blue-300 bg-blue-50/50 font-medium text-blue-700',
            )}
          >
            <option value="">{select.placeholder}</option>
            {select.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        ))}
        {selects.some(select => readParam(params, select.key)) && (
          <button
            type="button"
            onClick={() => router.push(buildHref(pathname, searchParams, Object.fromEntries(selects.map(s => [s.key, undefined]).concat([['page', undefined]]))))}
            className="text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            Clear all
          </button>
        )}
      </div>
      {resultCount != null && (
        <p className="shrink-0 text-xs text-slate-500">{resultCount.toLocaleString('en-GB')} {resultNoun}</p>
      )}
    </div>
  )
}

/** Segmented view switcher (Cards / Table / Board / Map ...), URL-driven. */
export function ViewSwitcher({
  pathname, params, views, active,
}: { pathname: string; params: SearchParams; views: { id: string; label: string; icon?: React.ReactNode }[]; active: string }) {
  if (views.length <= 1) return null
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="tablist" aria-label="Change view">
      {views.map(view => {
        const current = view.id === active
        return (
          <a
            key={view.id}
            href={buildHref(pathname, params, { view: view.id, page: undefined })}
            role="tab"
            aria-selected={current}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
              current ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {view.icon}
            {view.label}
          </a>
        )
      })}
    </div>
  )
}

export function Pagination({
  pathname, params, page, pageCount, total, pageSize,
}: { pathname: string; params: SearchParams; page: number; pageCount: number; total: number; pageSize: number }) {
  if (pageCount <= 1) return null
  const start = (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)
  const pages = paginationRange(page, pageCount)

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-500">
        Showing {start.toLocaleString('en-GB')} to {end.toLocaleString('en-GB')} of {total.toLocaleString('en-GB')}
      </p>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <a
          href={buildHref(pathname, params, { page: Math.max(1, page - 1) })}
          aria-disabled={page === 1}
          className={cn('flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500', page === 1 ? 'pointer-events-none opacity-40' : 'hover:bg-slate-50')}
        >
          ‹
        </a>
        {pages.map((p, i) => p === '…'
          ? <span key={`gap-${i}`} className="px-1 text-xs text-slate-400">…</span>
          : (
            <a
              key={p}
              href={buildHref(pathname, params, { page: p })}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md border text-xs font-medium',
                p === page ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
              )}
            >
              {p}
            </a>
          ))}
        <a
          href={buildHref(pathname, params, { page: Math.min(pageCount, page + 1) })}
          aria-disabled={page === pageCount}
          className={cn('flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500', page === pageCount ? 'pointer-events-none opacity-40' : 'hover:bg-slate-50')}
        >
          ›
        </a>
      </nav>
    </div>
  )
}

/** URL-driven sort dropdown shared by every SEO list surface. */
export function SortSelect({
  pathname, params, options,
}: { pathname: string; params: SearchParams; options: { value: string; label: string }[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = readParam(params, 'sort') ?? options[0]?.value

  return (
    <select
      value={current}
      onChange={event => router.push(buildHref(pathname, searchParams, { sort: event.target.value, page: undefined }))}
      aria-label="Sort by"
      className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600 outline-none focus:border-blue-400"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function paginationRange(current: number, total: number): (number | '…')[] {
  const delta = 1
  const range: (number | '…')[] = []
  const left = Math.max(2, current - delta)
  const right = Math.min(total - 1, current + delta)
  range.push(1)
  if (left > 2) range.push('…')
  for (let i = left; i <= right; i += 1) range.push(i)
  if (right < total - 1) range.push('…')
  if (total > 1) range.push(total)
  return range
}
