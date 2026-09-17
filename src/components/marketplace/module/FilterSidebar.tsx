'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, SlidersHorizontal, Bookmark } from 'lucide-react'
import { buildMarketplaceHref, type MarketplaceQuery } from '@/lib/marketplace/query'
import {
  BUDGET_BANDS, RATING_BANDS, TURNAROUND_BANDS, PLATFORM_LABELS, REGIONS,
  type MarketplaceCategory,
} from '@/lib/marketplace/module'

/**
 * Discover's advanced filter rail. It edits a local draft and applies it in one
 * navigation, so a user can set several filters without a round trip per click.
 */
export default function FilterSidebar({
  query, pathname, categories,
}: {
  query: MarketplaceQuery
  pathname: string
  categories: MarketplaceCategory[]
}) {
  const router = useRouter()
  const [draft, setDraft] = useState({
    location: query.location,
    region: query.region,
    category: query.category,
    platform: query.platform,
    budget: query.budget,
    rating: query.rating,
    turnaround: query.turnaround,
    available: query.available,
    verified: query.verified,
  })

  function apply() {
    router.push(buildMarketplaceHref(pathname, query, draft))
  }

  function clearAll() {
    router.push(buildMarketplaceHref(pathname, query, {
      q: '', location: '', region: '', category: '', platform: '', budget: '',
      rating: '', turnaround: '', tag: '', available: false, verified: false,
    }))
  }

  const field = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 lg:rounded-md lg:px-2 lg:py-1 lg:text-[10px]'

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-4 lg:p-3" aria-label="Advanced filters">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 lg:text-[11.5px]">Filters</h2>
        <button type="button" onClick={clearAll} className="text-xs font-medium text-blue-600 hover:text-blue-700 lg:text-[9.5px]">
          Clear all
        </button>
      </div>

      <div className="mt-4 space-y-4 lg:mt-3 lg:space-y-2.5">
        <div>
          <label htmlFor="flt-location" className="mb-1.5 block text-xs font-semibold text-slate-700 lg:mb-1 lg:text-[10px]">Location</label>
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="flt-location" value={draft.location}
              onChange={event => setDraft({ ...draft, location: event.target.value })}
              onKeyDown={event => { if (event.key === 'Enter') apply() }}
              placeholder="Search locations"
              className={`${field} pl-7 lg:pl-7`}
            />
          </div>
          <select
            aria-label="Region" value={draft.region}
            onChange={event => setDraft({ ...draft, region: event.target.value })}
            className={`${field} mt-2`}
          >
            <option value="">Any region</option>
            {REGIONS.map(region => <option key={region} value={region}>{region}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="flt-category" className="mb-1.5 block text-xs font-semibold text-slate-700 lg:mb-1 lg:text-[10px]">Category</label>
          <select
            id="flt-category" value={draft.category}
            onChange={event => setDraft({ ...draft, category: event.target.value })}
            className={field}
          >
            <option value="">All categories</option>
            {categories.map(category => <option key={category.slug} value={category.slug}>{category.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="flt-platform" className="mb-1.5 block text-xs font-semibold text-slate-700 lg:mb-1 lg:text-[10px]">Platform</label>
          <select
            id="flt-platform" value={draft.platform}
            onChange={event => setDraft({ ...draft, platform: event.target.value })}
            className={field}
          >
            <option value="">All platforms</option>
            {Object.entries(PLATFORM_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="flt-budget" className="mb-1.5 block text-xs font-semibold text-slate-700 lg:mb-1 lg:text-[10px]">Budget range</label>
          <select
            id="flt-budget" value={draft.budget}
            onChange={event => setDraft({ ...draft, budget: event.target.value })}
            className={field}
          >
            {BUDGET_BANDS.map(bandItem => <option key={bandItem.id} value={bandItem.id}>{bandItem.label}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="flt-rating" className="mb-1.5 block text-xs font-semibold text-slate-700 lg:mb-1 lg:text-[10px]">Rating</label>
          <select
            id="flt-rating" value={draft.rating}
            onChange={event => setDraft({ ...draft, rating: event.target.value })}
            className={field}
          >
            {RATING_BANDS.map(bandItem => <option key={bandItem.id} value={bandItem.id}>{bandItem.label}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="flt-speed" className="mb-1.5 block text-xs font-semibold text-slate-700 lg:mb-1 lg:text-[10px]">Delivery speed</label>
          <select
            id="flt-speed" value={draft.turnaround}
            onChange={event => setDraft({ ...draft, turnaround: event.target.value })}
            className={field}
          >
            {TURNAROUND_BANDS.map(bandItem => <option key={bandItem.id} value={bandItem.id}>{bandItem.label}</option>)}
          </select>
        </div>

        <Toggle
          label="Available now" checked={draft.available}
          onChange={value => setDraft({ ...draft, available: value })}
        />
        <Toggle
          label="Verified only" checked={draft.verified}
          onChange={value => setDraft({ ...draft, verified: value })}
        />
      </div>

      <div className="mt-5 space-y-2 lg:mt-3 lg:space-y-1.5">
        <button
          type="button" onClick={apply}
          className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 lg:py-1.5 lg:text-[10.5px]"
        >
          Apply filters
        </button>
        <button
          type="button" onClick={() => router.push(buildMarketplaceHref(pathname, query, draft))}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 lg:py-1.5 lg:text-[10.5px]"
        >
          <SlidersHorizontal size={14} />Advanced filters
        </button>
      </div>
    </aside>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-slate-700 lg:text-[10px]">{label}</span>
      <button
        type="button" role="switch" aria-checked={checked} aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition lg:scale-90 ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${checked ? 'left-[1.125rem]' : 'left-0.5'}`} />
      </button>
    </div>
  )
}

/** Compact "save this search" control used beneath the filter rail. */
export function SaveSearchLink({ href }: { href: string }) {
  return (
    <a href={href} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
      <Bookmark size={14} />Save search
    </a>
  )
}
