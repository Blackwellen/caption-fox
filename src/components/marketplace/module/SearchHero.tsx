'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, SlidersHorizontal, Bookmark, Loader2, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildMarketplaceHref, queryToParams, type MarketplaceQuery } from '@/lib/marketplace/query'
import { saveSearch } from '@/lib/marketplace/actions'

/** URL state as a select value: booleans map to '' / 'true' so `false` never reads as an active filter. */
function filterValue(query: MarketplaceQuery, key: keyof MarketplaceQuery): string {
  const raw = query[key]
  if (raw === false || raw === null || raw === undefined) return ''
  if (raw === true) return 'true'
  return Array.isArray(raw) ? raw.join(',') : String(raw)
}

/**
 * "Save search" as a self-contained popover, so it can sit inside the hero or in
 * a page's results bar (the Discover reference puts it there).
 */
export function SaveSearchControl({
  mode, query, resultCount, variant = 'hero',
}: {
  mode: string
  query: MarketplaceQuery
  resultCount?: number
  /** hero: translucent on blue · solid: white on blue · outline: bordered on white. */
  variant?: 'hero' | 'solid' | 'outline'
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [state, setState] = useState<{ error?: string; done?: boolean }>({})
  const [saving, startSaving] = useTransition()
  const params = useMemo(() => queryToParams(query), [query])

  function onSave() {
    const trimmed = name.trim()
    if (!trimmed) { setState({ error: 'Give this search a name.' }); return }
    startSaving(async () => {
      const result = await saveSearch({ name: trimmed, mode, params, resultCount })
      if (result.ok) {
        setState({ done: true })
        setName('')
        setTimeout(() => { setOpen(false); setState({}) }, 1200)
        router.refresh()
      } else {
        setState({ error: result.error ?? result.fieldErrors?.name ?? 'Could not save that search.' })
      }
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition focus:outline-none focus:ring-2',
          variant === 'hero' && 'h-11 border border-white/40 bg-white/10 px-4 text-sm text-white hover:bg-white/20 focus:ring-white lg:h-10 lg:px-3.5 lg:text-[11.5px]',
          variant === 'solid' && 'h-9 bg-white px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus:ring-white lg:h-7 lg:gap-1.5 lg:px-2.5 lg:text-[10.5px]',
          variant === 'outline' && 'h-9 border border-slate-200 bg-white px-3 text-sm text-blue-700 hover:bg-slate-50 focus:ring-blue-200 lg:h-8 lg:gap-1.5 lg:px-3 lg:text-[11px]',
        )}
      >
        <Bookmark size={14} />Save search
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-2.5 text-slate-900 shadow-[0_12px_32px_rgba(15,23,42,0.16)]">
          <label htmlFor={`save-search-${mode}`} className="block text-xs font-medium text-slate-600">Name this search</label>
          <div className="mt-1.5 flex items-center gap-1.5">
            <input
              id={`save-search-${mode}`}
              name="saved-search-name"
              value={name}
              autoFocus
              onChange={event => setName(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') { event.preventDefault(); onSave() }
                if (event.key === 'Escape') setOpen(false)
              }}
              placeholder="e.g. Video editors in the UK"
              className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button" onClick={onSave} disabled={saving}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : state.done ? <Check size={14} /> : null}
              {state.done ? 'Saved' : 'Save'}
            </button>
          </div>
          {state.error && <p className="mt-1.5 text-xs text-red-600">{state.error}</p>}
        </div>
      )}
    </div>
  )
}

export interface HeroFilter {
  /** Query-state key this control writes to. */
  key: keyof MarketplaceQuery
  label: string
  icon: React.ReactNode
  options: { value: string; label: string }[]
}

/**
 * The premium Marketplace search card.
 *
 * One component backs every search surface so the treatment stays identical
 * across Overview, Discover, the three specialist searches, Categories, Saved,
 * Requests and Orders. Every control writes real URL query-state — nothing here
 * is decorative.
 */
export default function SearchHero({
  title,
  subtitle,
  placeholder,
  query,
  pathname,
  filters,
  popular = [],
  mode,
  resultCount,
  canSaveSearch = true,
  canSearch = true,
  searchLabel = 'Search',
  aside,
  extraRow,
  compact = false,
  inlineSearch = false,
  layout = 'standard',
  inputActions,
  segmentedFilters = false,
  saveInHero = true,
  searchInside = false,
  iconMoreFilters = false,
}: {
  title: string
  subtitle: string
  placeholder: string
  query: MarketplaceQuery
  pathname: string
  filters: HeroFilter[]
  popular?: string[]
  mode: string
  resultCount?: number
  canSaveSearch?: boolean
  canSearch?: boolean
  searchLabel?: string
  aside?: React.ReactNode
  extraRow?: React.ReactNode
  compact?: boolean
  /** Put the keyword input inside the filter row (the Orders reference layout). */
  inlineSearch?: boolean
  /**
   * standard — keyword row, then filter cards (Overview, Discover, UGC, Services).
   * filters  — no keyword row; one segmented filter bar whose choices are staged
   *            and applied by the primary button (Influencers reference).
   * saved    — keyword box with an in-field search icon, "Clear filters", and a
   *            removable chip per active filter (Saved reference).
   */
  layout?: 'standard' | 'filters' | 'saved' | 'requests'
  /** Extra controls beside the keyword box (requests: New request). */
  inputActions?: React.ReactNode
  /** Render the filters as one joined white bar (Services reference). */
  segmentedFilters?: boolean
  /** Show "Save search" in the hero; pages placing it in their results bar pass false. */
  saveInHero?: boolean
  /** Put the primary search button inside the keyword field (Discover / UGC references). */
  searchInside?: boolean
  /** Square, icon-only "More filters" button (Discover reference). */
  iconMoreFilters?: boolean
}) {
  const router = useRouter()
  const [term, setTerm] = useState(query.q)

  // Filters-layout choices are staged locally and only applied on search, so the
  // primary button does real work instead of re-running an already-applied query.
  const staged = layout === 'filters'
  // Only pending edits live here; everything else reads straight from the URL,
  // so Back/Forward and shared links always show the applied state.
  const [pending, setPending] = useState<Record<string, string>>({})
  const draft: Record<string, string> = Object.fromEntries(
    filters.map(filter => [String(filter.key), pending[String(filter.key)] ?? filterValue(query, filter.key)]),
  )
  const activeFilters = filters.filter(filter => filterValue(query, filter.key) !== '')

  function clearFilters() {
    const cleared = Object.fromEntries(filters.map(filter => [String(filter.key), '']))
    setPending({})
    go({ ...cleared, q: layout === 'filters' ? query.q : '' } as Partial<MarketplaceQuery>)
    if (layout !== 'filters') setTerm('')
  }

  function go(patch: Partial<MarketplaceQuery>) {
    router.push(buildMarketplaceHref(pathname, query, patch))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    go({ q: term })
  }

  const KeywordRow = layout === 'requests' ? 'div' : 'form'
  const InputShell = layout === 'requests' ? 'form' : 'div'

  const searchInput = (
    <div className={cn('relative flex-1', inlineSearch && 'lg:w-[268px] lg:flex-none', searchInside && 'lg:max-w-[81%]')}>
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={term}
        onChange={event => setTerm(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          'h-11 w-full rounded-lg border-0 bg-white pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/70 lg:h-10 lg:text-[11.5px]',
          searchInside && canSearch ? 'pr-36 lg:pr-32' : 'pr-3',
        )}
      />
      {searchInside && canSearch && (
        <button
          type="submit"
          className="absolute right-1 top-1/2 inline-flex h-9 -translate-y-1/2 items-center justify-center gap-2 rounded-md bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 lg:h-8 lg:gap-1.5 lg:px-6 lg:text-[11px]"
        >
          <Search size={14} />{searchLabel}
        </button>
      )}
    </div>
  )

  const searchButtons = (
    <>
      {canSearch && !searchInside && (
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white lg:h-10 lg:px-4 lg:text-[11.5px]"
        >
          <Search size={15} />{searchLabel}
        </button>
      )}
      {canSaveSearch && saveInHero && <SaveSearchControl mode={mode} query={{ ...query, q: term }} resultCount={resultCount} />}
    </>
  )

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-600 to-blue-700 text-white shadow-[0_2px_8px_rgba(37,99,235,0.25)]',
        compact ? 'p-5 lg:p-4' : 'p-5 sm:p-6 lg:p-5',
        // Requests reference: filter row first, keyword row underneath, in a
        // shorter band than the discovery heroes.
        layout === 'requests' && 'flex flex-col lg:py-3.5',
        // Orders reference: title, one control strip and quick filters in a tight band.
        inlineSearch && 'lg:py-3.5',
      )}
      aria-label={title}
    >
      {/* Decorative dotted world map, mirrors the approved reference. */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 opacity-[0.13] lg:block"
        aria-hidden="true"
        style={{
          backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
          backgroundSize: '10px 10px',
          maskImage: 'linear-gradient(to left, black, transparent)',
          WebkitMaskImage: 'linear-gradient(to left, black, transparent)',
        }}
      />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl lg:text-[15px] lg:leading-5">{title}</h2>
          <p className="mt-0.5 text-sm text-blue-100 lg:text-[10.5px] lg:leading-4">{subtitle}</p>
        </div>
        {(aside || (layout === 'filters' && canSaveSearch)) && (
          <div className="flex shrink-0 items-center gap-3">
            {aside}
            {layout === 'filters' && canSaveSearch && <SaveSearchControl mode={mode} query={query} resultCount={resultCount} variant="solid" />}
          </div>
        )}
      </div>

      <KeywordRow
        {...(layout === 'requests' ? {} : { onSubmit: submit })}
        className={cn(
          'relative mt-3 flex flex-col gap-2 sm:flex-row',
          inlineSearch && 'lg:hidden',
          layout === 'filters' && 'hidden',
          layout === 'requests' && 'order-2 lg:mt-2 [&_input]:lg:!h-9 [&>button]:lg:!h-9 [&>*>button]:lg:!h-9',
        )}
      >
        {layout === 'saved' || layout === 'requests' ? (
          <>
          {/* Requests keeps its own form around the input only, so the New
              request wizard beside it can never submit the search. */}
          <InputShell {...(layout === 'requests' ? { onSubmit: submit } : {})} className="relative flex-1">
            <input
              type="search"
              value={term}
              onChange={event => setTerm(event.target.value)}
              placeholder={placeholder}
              aria-label={placeholder}
              className="h-11 w-full rounded-lg border-0 bg-white pl-3.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/70 lg:h-10 lg:text-[11.5px]"
            />
            <button
              type="submit" aria-label="Search"
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <Search size={16} />
            </button>
          </InputShell>
          {layout === 'requests' && (
            <>
              <button
                type="button" onClick={clearFilters}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-white/40 bg-white/10 px-4 text-sm font-medium text-white transition hover:bg-white/20 lg:h-10 lg:px-3.5 lg:text-[11px]"
              >
                Clear all
              </button>
              {inputActions}
            </>
          )}
          </>
        ) : (
          <>
            {searchInput}
            {searchButtons}
          </>
        )}
      </KeywordRow>

      {filters.length > 0 && (
        // In inline mode the keyword input is the first cell of this row, which
        // is how the Orders reference lays its control strip out.
        <form
          onSubmit={submit}
          className={cn(
            'relative mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-nowrap lg:items-center lg:gap-2',
            inlineSearch && 'lg:mt-3',
            (layout === 'filters' || segmentedFilters) && 'mt-3 gap-0 overflow-hidden rounded-xl bg-white lg:gap-0 lg:divide-x lg:divide-slate-100',
            layout === 'requests' && 'order-1 lg:mt-2 [&>div]:lg:!h-9 [&>button]:lg:!h-9',
          )}
        >
          {inlineSearch && <div className="col-span-2 sm:col-span-3 lg:contents">{searchInput}</div>}
          {filters.map(filter => (
            <HeroSelect
              key={String(filter.key)}
              filter={filter}
              value={staged ? (draft[String(filter.key)] ?? '') : filterValue(query, filter.key)}
              onChange={value => staged
                ? setPending(current => ({ ...current, [String(filter.key)]: value }))
                : go({ [filter.key]: value } as Partial<MarketplaceQuery>)}
              segmented={staged || segmentedFilters}
            />
          ))}
          {layout === 'saved' ? (
            <button
              type="button"
              onClick={clearFilters}
              disabled={activeFilters.length === 0 && !query.q}
              className="flex h-[52px] shrink-0 items-center justify-center rounded-lg bg-white px-3.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-60 lg:h-10 lg:text-[10.5px]"
            >
              Clear filters
            </button>
          ) : !staged && (
            <button
              type="button"
              onClick={() => go({ view: query.view })}
              aria-label="More filters"
              title="More filters"
              className={cn(
                'flex h-[52px] shrink-0 items-center justify-center gap-2 px-3 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-white lg:px-3 lg:text-[10.5px]',
                segmentedFilters ? 'bg-white text-blue-700 hover:bg-blue-50 lg:h-[46px]'
                  : iconMoreFilters ? 'rounded-lg bg-white text-slate-600 hover:bg-blue-50 lg:h-10 lg:w-10 lg:px-0'
                    : 'rounded-lg bg-white/12 text-white hover:bg-white/20 lg:h-10',
              )}
            >
              <SlidersHorizontal size={14} />
              <span className={cn(iconMoreFilters && 'lg:sr-only')}>More filters</span>
            </button>
          )}
        </form>
      )}

      {layout === 'saved' && (activeFilters.length > 0 || query.q) && (
        <ul className="relative mt-2.5 flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          {query.q && (
            <li>
              <button
                type="button" onClick={() => { setTerm(''); go({ q: '' }) }}
                className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/25 lg:py-[3px] lg:text-[10px]"
                aria-label={`Remove search "${query.q}"`}
              >
                “{query.q}”<X size={11} />
              </button>
            </li>
          )}
          {activeFilters.map(filter => {
            const value = filterValue(query, filter.key)
            const option = filter.options.find(item => item.value === value)
            return (
              <li key={String(filter.key)}>
                <button
                  type="button" onClick={() => go({ [filter.key]: '' } as Partial<MarketplaceQuery>)}
                  className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/25 lg:py-[3px] lg:text-[10px]"
                  aria-label={`Remove ${filter.label} filter`}
                >
                  {option?.label ?? value}<X size={11} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {extraRow && <div className="relative mt-3">{extraRow}</div>}

      {(popular.length > 0 || staged) && (
        <div className="relative mt-2.5 flex flex-wrap items-center gap-1.5 lg:flex-nowrap">
          {popular.length > 0 && <span className="shrink-0 text-xs font-medium text-blue-100 lg:text-[10px]">{staged ? 'Popular searches:' : 'Popular:'}</span>}
          {/* Chips give way (clip) before the staged actions do. */}
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 lg:h-[21px] lg:flex-1 lg:overflow-hidden">
          {popular.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => { setTerm(item); go({ q: item }) }}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition lg:px-2.5 lg:py-[3px] lg:text-[10px]',
                query.q === item ? 'bg-white text-blue-700' : 'bg-white/15 text-white hover:bg-white/25',
              )}
            >
              {item}
            </button>
          ))}
          </div>
          {staged && (
            <div className="ml-auto flex shrink-0 items-center gap-3">
              <button
                type="button" onClick={clearFilters}
                className="text-xs font-medium text-white/90 underline-offset-2 hover:underline lg:text-[10.5px]"
              >
                Clear all
              </button>
              {canSearch && (
                <button
                  type="button"
                  onClick={() => { go({ ...draft, q: query.q } as Partial<MarketplaceQuery>); setPending({}) }}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-white px-5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white lg:h-8 lg:px-4 lg:text-[11px]"
                >
                  {searchLabel}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function HeroSelect({
  filter, value, onChange, segmented = false,
}: {
  filter: HeroFilter
  value: string
  onChange: (value: string) => void
  /** A cell of one joined white bar rather than its own card. */
  segmented?: boolean
}) {
  const id = `mkt-filter-${String(filter.key)}`
  return (
    <div
      className={cn(
        'relative flex h-[52px] min-w-0 items-center gap-2 bg-white px-3 lg:flex-1 lg:gap-1.5 lg:px-2.5',
        segmented ? 'lg:h-[46px] lg:gap-1 lg:px-2' : 'rounded-lg lg:h-10',
      )}
    >
      <span className={cn('shrink-0 [&>svg]:lg:h-[13px] [&>svg]:lg:w-[13px]', segmented ? 'text-blue-600' : 'text-slate-400')} aria-hidden="true">{filter.icon}</span>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className={cn('block truncate whitespace-nowrap text-[10px] font-medium leading-none text-slate-400', segmented ? 'lg:text-[7.5px]' : 'lg:text-[8.5px]')}>{filter.label}</label>
        <select
          id={id}
          value={value}
          onChange={event => onChange(event.target.value)}
          className={cn('-ml-0.5 w-full cursor-pointer truncate border-0 bg-transparent p-0 pt-0.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-0 lg:pt-[1px]', segmented ? 'lg:text-[9.5px]' : 'lg:text-[10.5px]')}
        >
          {filter.options.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
