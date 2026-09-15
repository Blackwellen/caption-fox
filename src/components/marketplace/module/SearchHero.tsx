'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, SlidersHorizontal, Bookmark, Loader2, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildMarketplaceHref, queryToParams, type MarketplaceQuery } from '@/lib/marketplace/query'
import { saveSearch } from '@/lib/marketplace/actions'

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
}) {
  const router = useRouter()
  const [term, setTerm] = useState(query.q)
  const [saving, startSaving] = useTransition()
  const [savePanel, setSavePanel] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveState, setSaveState] = useState<{ error?: string; done?: boolean }>({})

  const params = useMemo(() => queryToParams({ ...query, q: term }), [query, term])

  function go(patch: Partial<MarketplaceQuery>) {
    router.push(buildMarketplaceHref(pathname, query, patch))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    go({ q: term })
  }

  function onSave() {
    const name = saveName.trim()
    if (!name) { setSaveState({ error: 'Give this search a name.' }); return }
    startSaving(async () => {
      const result = await saveSearch({ name, mode, params, resultCount })
      if (result.ok) {
        setSaveState({ done: true })
        setSaveName('')
        setTimeout(() => { setSavePanel(false); setSaveState({}) }, 1200)
        router.refresh()
      } else {
        setSaveState({ error: result.error ?? result.fieldErrors?.name ?? 'Could not save that search.' })
      }
    })
  }

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-600 to-blue-700 text-white shadow-[0_2px_8px_rgba(37,99,235,0.25)]',
        compact ? 'p-5' : 'p-5 sm:p-6',
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
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
          <p className="mt-1 text-sm text-blue-100">{subtitle}</p>
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>

      <form onSubmit={submit} className="relative mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={term}
            onChange={event => setTerm(event.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="h-11 w-full rounded-lg border-0 bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/70"
          />
        </div>
        {canSearch && (
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <Search size={15} />{searchLabel}
          </button>
        )}
        {canSaveSearch && (
          <button
            type="button"
            onClick={() => setSavePanel(value => !value)}
            aria-expanded={savePanel}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/40 bg-white/10 px-4 text-sm font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <Bookmark size={15} />Save search
          </button>
        )}
      </form>

      {savePanel && (
        <div className="relative mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-white/12 p-2">
          <input
            value={saveName}
            onChange={event => setSaveName(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); onSave() } }}
            placeholder="Name this search, e.g. Video editors in the UK"
            aria-label="Saved search name"
            className="h-9 min-w-0 flex-1 rounded-md border-0 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/70"
          />
          <button
            type="button" onClick={onSave} disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-white px-3 text-sm font-semibold text-blue-700 disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saveState.done ? <Check size={14} /> : null}
            {saveState.done ? 'Saved' : 'Save'}
          </button>
          <button
            type="button" onClick={() => { setSavePanel(false); setSaveState({}) }}
            aria-label="Close save search"
            className="rounded-md p-2 text-white/80 hover:bg-white/15"
          >
            <X size={14} />
          </button>
          {saveState.error && <p className="w-full text-xs text-amber-100">{saveState.error}</p>}
        </div>
      )}

      {filters.length > 0 && (
        <div className="relative mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
          {filters.map(filter => (
            <HeroSelect
              key={String(filter.key)}
              filter={filter}
              value={String(query[filter.key] ?? '')}
              onChange={value => go({ [filter.key]: value } as Partial<MarketplaceQuery>)}
            />
          ))}
          <button
            type="button"
            onClick={() => go({ view: query.view })}
            className="flex h-[52px] items-center justify-center gap-2 rounded-lg bg-white/12 px-3 text-sm font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <SlidersHorizontal size={15} />More filters
          </button>
        </div>
      )}

      {extraRow && <div className="relative mt-3">{extraRow}</div>}

      {popular.length > 0 && (
        <div className="relative mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-blue-100">Popular:</span>
          {popular.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => { setTerm(item); go({ q: item }) }}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition',
                query.q === item ? 'bg-white text-blue-700' : 'bg-white/15 text-white hover:bg-white/25',
              )}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function HeroSelect({
  filter, value, onChange,
}: {
  filter: HeroFilter
  value: string
  onChange: (value: string) => void
}) {
  const id = `mkt-filter-${String(filter.key)}`
  return (
    <div className="relative flex h-[52px] items-center gap-2 rounded-lg bg-white px-3">
      <span className="shrink-0 text-slate-400" aria-hidden="true">{filter.icon}</span>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-[10px] font-medium leading-none text-slate-400">{filter.label}</label>
        <select
          id={id}
          value={value}
          onChange={event => onChange(event.target.value)}
          className="-ml-0.5 w-full cursor-pointer truncate border-0 bg-transparent p-0 pt-0.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-0"
        >
          {filter.options.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
