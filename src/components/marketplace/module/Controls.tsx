'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutGrid, List, Table2, Rows3, ChevronLeft, ChevronRight, X, GitCompareArrows, ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildMarketplaceHref, activeFilterCount, type MarketplaceQuery, type ViewMode } from '@/lib/marketplace/query'
import { SORTS, PAGE_SIZES, type MarketplaceProfile } from '@/lib/marketplace/module'
import { ProfileAvatar } from './primitives'

const VIEW_ICONS: Record<ViewMode, typeof LayoutGrid> = {
  cards: LayoutGrid, list: List, table: Table2, grid: Rows3,
}
const VIEW_LABELS: Record<ViewMode, string> = {
  cards: 'Cards', list: 'List', table: 'Table', grid: 'Grid',
}

export function ViewSwitcher({
  query, pathname, views, withLabels,
}: {
  query: MarketplaceQuery
  pathname: string
  views: ViewMode[]
  withLabels?: boolean
}) {
  if (views.length < 2) return null
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="View mode">
      {views.map(view => {
        const Icon = VIEW_ICONS[view]
        const active = query.view === view
        return (
          <Link
            key={view}
            href={buildMarketplaceHref(pathname, query, { view, page: query.page })}
            aria-pressed={active}
            aria-label={`${VIEW_LABELS[view]} view`}
            scroll={false}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition',
              active ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
            )}
          >
            <Icon size={14} />
            {withLabels && VIEW_LABELS[view]}
          </Link>
        )
      })}
    </div>
  )
}

export function SortSelect({ query, pathname, options = SORTS }: {
  query: MarketplaceQuery
  pathname: string
  options?: readonly { id: string; label: string }[]
}) {
  const router = useRouter()
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
      <span className="text-xs text-slate-400">Sort by</span>
      <select
        value={query.sort}
        onChange={event => router.push(buildMarketplaceHref(pathname, query, { sort: event.target.value as MarketplaceQuery['sort'] }))}
        aria-label="Sort results"
        className="cursor-pointer border-0 bg-transparent p-0 text-xs font-medium text-slate-800 focus:outline-none focus:ring-0"
      >
        {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
  )
}

export function PageSizeSelect({ query, pathname }: { query: MarketplaceQuery; pathname: string }) {
  const router = useRouter()
  return (
    <label className="inline-flex items-center gap-2 text-xs text-slate-500">
      Show
      <select
        value={query.size}
        onChange={event => router.push(buildMarketplaceHref(pathname, query, { size: Number(event.target.value) }))}
        aria-label="Results per page"
        className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 focus:outline-none"
      >
        {PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
      </select>
      per page
    </label>
  )
}

export function Pagination({
  query, pathname, total,
}: {
  query: MarketplaceQuery
  pathname: string
  total: number
}) {
  const pages = Math.max(1, Math.ceil(total / query.size))
  if (pages <= 1) return null
  const current = Math.min(query.page, pages)

  const window: (number | 'gap')[] = []
  for (let page = 1; page <= pages; page += 1) {
    if (page === 1 || page === pages || Math.abs(page - current) <= 1) window.push(page)
    else if (window[window.length - 1] !== 'gap') window.push('gap')
  }

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
      <Link
        href={buildMarketplaceHref(pathname, query, { page: Math.max(1, current - 1) })}
        aria-label="Previous page" aria-disabled={current === 1} scroll={false}
        className={cn('rounded-md border border-slate-200 p-1.5 text-slate-500',
          current === 1 ? 'pointer-events-none opacity-40' : 'hover:bg-slate-50')}
      >
        <ChevronLeft size={14} />
      </Link>
      {window.map((page, index) => page === 'gap'
        ? <span key={`gap-${index}`} className="px-1.5 text-xs text-slate-400">…</span>
        : (
          <Link
            key={page}
            href={buildMarketplaceHref(pathname, query, { page })}
            aria-current={page === current ? 'page' : undefined}
            scroll={false}
            className={cn('min-w-8 rounded-md border px-2.5 py-1.5 text-center text-xs font-medium',
              page === current
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
          >
            {page}
          </Link>
        ))}
      <Link
        href={buildMarketplaceHref(pathname, query, { page: Math.min(pages, current + 1) })}
        aria-label="Next page" aria-disabled={current === pages} scroll={false}
        className={cn('rounded-md border border-slate-200 p-1.5 text-slate-500',
          current === pages ? 'pointer-events-none opacity-40' : 'hover:bg-slate-50')}
      >
        <ChevronRight size={14} />
      </Link>
    </nav>
  )
}

/** Active filter chips with individual and bulk clearing. */
export function FilterChips({
  query, pathname, labels,
}: {
  query: MarketplaceQuery
  pathname: string
  labels: Partial<Record<keyof MarketplaceQuery, string>>
}) {
  // A chip needs both an active value and a human label — an unnamed filter
  // would render as an empty, unremovable pill.
  const active = (Object.keys(labels) as (keyof MarketplaceQuery)[])
    .filter(key => Boolean(query[key]) && Boolean(labels[key]))
  if (!active.length && !query.q) return null

  const cleared = Object.fromEntries(active.map(key => [key, typeof query[key] === 'boolean' ? false : ''])) as Partial<MarketplaceQuery>

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {query.q && (
        <Link
          href={buildMarketplaceHref(pathname, query, { q: '' })}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          “{query.q}”<X size={11} />
        </Link>
      )}
      {active.map(key => (
        <Link
          key={String(key)}
          href={buildMarketplaceHref(pathname, query, { [key]: typeof query[key] === 'boolean' ? false : '' } as Partial<MarketplaceQuery>)}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          {labels[key]}<X size={11} />
        </Link>
      ))}
      <Link
        href={buildMarketplaceHref(pathname, query, { ...cleared, q: '' })}
        className="px-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
      >
        Clear all
      </Link>
    </div>
  )
}

export function FilterCountBadge({ query }: { query: MarketplaceQuery }) {
  const count = activeFilterCount(query)
  if (!count) return null
  return <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">{count}</span>
}

/**
 * Bottom comparison tray. Reads its members from the URL, so the selection
 * survives refresh, back/forward and sharing the link.
 */
export function CompareTray({
  profiles, query, pathname, limit,
}: {
  profiles: MarketplaceProfile[]
  query: MarketplaceQuery
  pathname: string
  limit: number
}) {
  const [open, setOpen] = useState(true)
  if (!profiles.length) return null

  return (
    <div className="sticky bottom-0 z-30 -mx-4 mt-6 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {profiles.length} supplier{profiles.length === 1 ? '' : 's'} selected for comparison
          </p>
          <p className="text-xs text-slate-500">Add up to {limit} to compare side by side</p>
        </div>

        {open && (
          <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {profiles.map(profile => (
              <li key={profile.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                <ProfileAvatar profile={profile} size={28} />
                <div className="min-w-0">
                  <p className="max-w-[9rem] truncate text-xs font-medium text-slate-900">{profile.display_name}</p>
                  <p className="max-w-[9rem] truncate text-[10px] text-slate-400">{profile.headline}</p>
                </div>
                <Link
                  href={buildMarketplaceHref(pathname, query, {
                    compare: query.compare.filter(id => id !== profile.id), page: query.page,
                  })}
                  scroll={false}
                  aria-label={`Remove ${profile.display_name} from comparison`}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={13} />
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Link
            href={buildMarketplaceHref(pathname, query, { compare: [], page: query.page })}
            scroll={false}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Clear all
          </Link>
          <Link
            href={`/app/marketplace/compare?ids=${query.compare.join(',')}`}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <GitCompareArrows size={15} />Compare {profiles.length} supplier{profiles.length === 1 ? '' : 's'}
          </Link>
          <button
            type="button" onClick={() => setOpen(value => !value)}
            aria-expanded={open} aria-label={open ? 'Collapse comparison tray' : 'Expand comparison tray'}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
          >
            <ChevronUp size={15} className={cn('transition', !open && 'rotate-180')} />
          </button>
        </div>
      </div>
    </div>
  )
}
