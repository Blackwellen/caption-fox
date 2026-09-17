'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  LayoutGrid, List, Table2, Rows3, ChevronLeft, ChevronRight, X, GitCompareArrows, ChevronUp, Columns3, Check,
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
        name="sort"
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
        name="size"
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
 * Previous / next buttons for a horizontally scrolling card row rendered on the
 * server. Scrolls the row by one visible page and disables at either end.
 */
export function CarouselArrows({ targetId, label }: { targetId: string; label: string }) {
  const [edges, setEdges] = useState({ start: true, end: false })

  useEffect(() => {
    const row = document.getElementById(targetId)
    if (!row) return
    const update = () => setEdges({
      start: row.scrollLeft <= 1,
      end: row.scrollLeft + row.clientWidth >= row.scrollWidth - 1,
    })
    update()
    row.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { row.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [targetId])

  function move(direction: 1 | -1) {
    const row = document.getElementById(targetId)
    row?.scrollBy({ left: direction * row.clientWidth, behavior: 'smooth' })
  }

  const button = 'flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 lg:h-6 lg:w-6'
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={label}>
      <button type="button" className={button} onClick={() => move(-1)} disabled={edges.start} aria-label={`Previous ${label.toLowerCase()}`}>
        <ChevronLeft size={14} />
      </button>
      <button type="button" className={button} onClick={() => move(1)} disabled={edges.end} aria-label={`Next ${label.toLowerCase()}`}>
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

const COLUMNS_EVENT = 'cf:marketplace-columns'

function subscribeColumns(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(COLUMNS_EVENT, onChange)
  return () => { window.removeEventListener('storage', onChange); window.removeEventListener(COLUMNS_EVENT, onChange) }
}

/**
 * "Columns" menu for server-rendered tables. Hidden columns persist per browser
 * and are applied with a scoped style rule on `data-col`, so the table itself
 * stays a server component. Read through useSyncExternalStore so the server
 * render (all columns) and the first client render never disagree.
 */
export function ColumnsMenu({
  tableId, columns,
}: {
  tableId: string
  columns: { id: string; label: string }[]
}) {
  const storageKey = `cf.marketplace.${tableId}.hiddenColumns`
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const stored = useSyncExternalStore(
    subscribeColumns,
    () => { try { return localStorage.getItem(storageKey) ?? '[]' } catch { return '[]' } },
    () => '[]',
  )
  const hidden = useMemo(() => {
    const known = new Set(columns.map(column => column.id))
    try { return new Set((JSON.parse(stored) as string[]).filter(id => known.has(id))) } catch { return new Set<string>() }
  }, [stored, columns])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [open])

  function toggle(id: string) {
    const next = new Set(hidden)
    if (next.has(id)) next.delete(id)
    // Keep at least one column visible so the table never collapses to nothing.
    else if (next.size < columns.length - 1) next.add(id)
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]))
      window.dispatchEvent(new Event(COLUMNS_EVENT))
    } catch { /* storage unavailable: nothing to persist */ }
  }

  // Column ids come from our own constants, never user input.
  const css = [...hidden].map(id => `[data-columns="${tableId}"] [data-col="${id}"]{display:none}`).join('')

  return (
    <div ref={rootRef} className="relative">
      {css && <style>{css}</style>}
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 lg:px-2.5 lg:py-1.5 lg:text-[10.5px]"
      >
        <Columns3 size={14} className="lg:h-3.5 lg:w-3.5" />Columns
        {hidden.size > 0 && <span className="rounded-full bg-blue-100 px-1.5 text-[10px] font-semibold text-blue-700 lg:text-[8.5px]">{columns.length - hidden.size}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.14)]">
          <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Show columns</p>
          <ul>
            {columns.map(column => {
              const visible = !hidden.has(column.id)
              return (
                <li key={column.id}>
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={visible}
                    onClick={() => toggle(column.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      visible ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white')}>
                      {visible && <Check size={11} strokeWidth={3} />}
                    </span>
                    {column.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Bottom comparison tray. Reads its members from the URL, so the selection
 * survives refresh, back/forward and sharing the link.
 */
export function CompareTray({
  profiles, query, pathname, limit, railWidth,
}: {
  profiles: MarketplaceProfile[]
  query: MarketplaceQuery
  pathname: string
  limit: number
  /** Width of the page's right rail; the tray stops short of it so the rail stays usable. */
  railWidth?: number
}) {
  const [open, setOpen] = useState(true)
  if (!profiles.length) return null

  return (
    <div
      style={railWidth ? ({ '--compare-rail': `${railWidth + 16}px` } as React.CSSProperties) : undefined}
      className={cn(
        'sticky bottom-3 z-30 mt-4 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-[0_8px_30px_rgba(15,23,42,0.12)] backdrop-blur lg:px-3.5 lg:py-2',
        railWidth && 'xl:mr-[var(--compare-rail)]',
      )}
    >
      <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap lg:gap-4">
        <div className="min-w-0 shrink-0">
          <p className="text-sm font-semibold text-slate-900 lg:text-[11px]">
            {profiles.length} supplier{profiles.length === 1 ? '' : 's'} selected for comparison
          </p>
          <p className="text-xs text-slate-500 lg:text-[9px]">Add up to {limit} to compare side by side</p>
        </div>

        {open && (
          <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:flex-nowrap lg:overflow-hidden">
            {profiles.map(profile => (
              <li key={profile.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 lg:py-1">
                <span className="shrink-0 [&_*]:lg:!h-6 [&_*]:lg:!w-6"><ProfileAvatar profile={profile} size={28} /></span>
                <div className="min-w-0">
                  <p className="max-w-[9rem] truncate text-xs font-medium text-slate-900 lg:text-[9.5px]">{profile.display_name}</p>
                  <p className="max-w-[9rem] truncate text-[10px] text-slate-400 lg:text-[8.5px]">{profile.headline}</p>
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

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link
            href={buildMarketplaceHref(pathname, query, { compare: [], page: query.page })}
            scroll={false}
            className="rounded-lg px-3 py-2 text-sm font-medium text-blue-600 hover:bg-slate-100 lg:py-1.5 lg:text-[10.5px]"
          >
            Clear all
          </Link>
          <Link
            href={`/app/marketplace/compare?ids=${query.compare.join(',')}`}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 lg:gap-1.5 lg:px-3.5 lg:py-1.5 lg:text-[10.5px]"
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
