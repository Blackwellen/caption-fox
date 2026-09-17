'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { RANGE_PRESETS, GRANULARITIES, type Granularity, type RangePresetId } from '@/lib/seo/range'
import { buildHref, type SearchParams } from '@/lib/seo/url-state'

/**
 * In-card controls shared by every SEO panel in the approved references:
 * the chart range pills + granularity select, panel tab groups, panel selects
 * and the compact pager. All of them are URL-driven, so refresh, back/forward
 * and shared links restore exactly the same panel state.
 */

const RANGE_PILL_LABEL: Record<RangePresetId, string> = {
  '7d': '7D', '28d': '28D', '3m': '3M', '6m': '6M', '12m': '12M',
}

/** 7D · 28D · 3M · 6M · 12M segmented pills plus the granularity dropdown. */
export function ChartRangeControls({
  pathname, params, activePreset, granularity, granularityKey = 'granularity', size = 'md',
}: {
  pathname: string
  params: SearchParams
  activePreset: RangePresetId | 'custom'
  granularity: Granularity
  granularityKey?: string
  /** `sm` fits the controls into the header of a narrow card, as the references do. */
  size?: 'sm' | 'md'
}) {
  const small = size === 'sm'
  const router = useRouter()
  const searchParams = useSearchParams()

  return (
    <>
      <div className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label="Chart range">
        {RANGE_PRESETS.map(preset => {
          const current = preset.id === activePreset
          return (
            <a
              key={preset.id}
              href={buildHref(pathname, params, { range: preset.id, from: undefined, to: undefined, page: undefined })}
              aria-current={current ? 'true' : undefined}
              className={cn(
                'rounded-md font-medium transition-colors',
                small ? 'px-1.5 py-0.5 text-[10.5px]' : 'px-2 py-1 text-[11.5px]',
                current ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-200' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {RANGE_PILL_LABEL[preset.id]}
            </a>
          )
        })}
      </div>
      <select
        name={granularityKey}
        value={granularity}
        onChange={event => router.push(buildHref(pathname, searchParams, { [granularityKey]: event.target.value }))}
        aria-label="Chart granularity"
        className={cn(
          'rounded-lg border border-slate-200 bg-white font-medium text-slate-600 outline-none focus:border-blue-400',
          small ? 'h-6 px-1 text-[10.5px]' : 'h-7 px-2 text-[11.5px]',
        )}
      >
        {GRANULARITIES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
      </select>
    </>
  )
}

const TAB_TONE = {
  blue: { on: 'bg-blue-50 text-blue-700 ring-blue-200', off: 'text-slate-500 ring-transparent hover:bg-slate-50' },
  green: { on: 'bg-emerald-50 text-emerald-700 ring-emerald-200', off: 'bg-emerald-50/60 text-emerald-700 ring-transparent hover:bg-emerald-50' },
  red: { on: 'bg-rose-50 text-rose-700 ring-rose-200', off: 'bg-rose-50/60 text-rose-600 ring-transparent hover:bg-rose-50' },
} as const

/**
 * Tab group inside a card header. `pills` gives the tinted chips used for
 * All / Gainers / Losers; `segmented` gives the boxed control used for brief
 * statuses in the references.
 */
export function PanelTabs({
  pathname, params, paramKey, active, tabs, resetKeys = [], variant = 'pills',
}: {
  pathname: string
  params: SearchParams
  paramKey: string
  active: string
  tabs: readonly { id: string; label: string; tone?: keyof typeof TAB_TONE }[]
  resetKeys?: string[]
  variant?: 'pills' | 'segmented'
}) {
  return (
    <div
      className={cn(
        'inline-flex max-w-full items-center overflow-x-auto',
        variant === 'segmented' ? 'gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5' : 'gap-1',
      )}
      role="group"
      aria-label="Filter panel"
    >
      {tabs.map(tab => {
        const current = tab.id === active
        const overrides: Record<string, string | undefined> = { [paramKey]: tab.id === 'all' ? undefined : tab.id }
        for (const key of resetKeys) overrides[key] = undefined
        const tone = TAB_TONE[tab.tone ?? 'blue']
        return (
          <a
            key={tab.id}
            href={buildHref(pathname, params, overrides)}
            aria-current={current ? 'true' : undefined}
            className={cn(
              'whitespace-nowrap rounded-md px-2.5 py-1 text-[11.5px] font-medium ring-1 ring-inset transition-colors',
              variant === 'segmented'
                ? current ? 'bg-white text-blue-700 shadow-sm ring-blue-200' : 'text-slate-500 ring-transparent hover:text-slate-700'
                : current ? tone.on : tone.off,
            )}
          >
            {tab.label}
          </a>
        )
      })}
    </div>
  )
}

/** Compact select inside a card header ("All Intent", "All Engines"…). */
export function PanelSelect({
  pathname, params, paramKey, placeholder, options, label, resetKeys = [], size = 'panel',
}: {
  pathname: string
  params: SearchParams
  paramKey: string
  placeholder: string
  options: { value: string; label: string }[]
  label: string
  resetKeys?: string[]
  /** 'header' matches the h-9 SeoHeader control row. */
  size?: 'panel' | 'header'
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const raw = params[paramKey]
  const value = (Array.isArray(raw) ? raw[0] : raw) ?? ''

  return (
    <select
      name={paramKey}
      value={value}
      onChange={event => {
        const overrides: Record<string, string | undefined> = { [paramKey]: event.target.value || undefined }
        for (const key of resetKeys) overrides[key] = undefined
        router.push(buildHref(pathname, searchParams, overrides))
      }}
      aria-label={label}
      className={cn(
        size === 'header'
          ? 'h-9 max-w-[190px] truncate rounded-lg border bg-white pl-3 pr-8 text-[13px] font-medium outline-none focus:border-blue-400'
          : 'h-7 max-w-[128px] truncate rounded-lg border bg-white px-2 text-[11.5px] font-medium outline-none focus:border-blue-400',
        value ? 'border-blue-300 text-blue-700' : 'border-slate-200 text-slate-600',
      )}
    >
      <option value="">{placeholder}</option>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  )
}

/**
 * Card-footer pager used by in-panel tables ("Showing 1 to 5 of 25 keywords").
 * Uses its own page key so several panels on one route page independently.
 */
export function PanelPager({
  pathname, params, pageKey, page, pageCount, total, pageSize, noun,
}: {
  pathname: string
  params: SearchParams
  pageKey: string
  page: number
  pageCount: number
  total: number
  pageSize: number
  noun: string
}) {
  if (total === 0) return null
  const start = (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)
  const pages = pagerRange(page, pageCount)

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2">
      <p className="text-[11.5px] text-slate-500">
        Showing {start.toLocaleString('en-GB')} to {end.toLocaleString('en-GB')} of {total.toLocaleString('en-GB')} {noun}
      </p>
      {pageCount > 1 && (
        <nav className="flex items-center gap-1" aria-label={`${noun} pagination`}>
          <PagerLink pathname={pathname} params={params} pageKey={pageKey} to={Math.max(1, page - 1)} disabled={page === 1} label="Previous page">&lsaquo;</PagerLink>
          {pages.map((p, index) => p === null
            ? <span key={`gap-${index}`} className="px-1 text-[11px] text-slate-400" aria-hidden>…</span>
            : (
              <a
                key={p}
                href={buildHref(pathname, params, { [pageKey]: p === 1 ? undefined : p })}
                aria-current={p === page ? 'page' : undefined}
                className={cn(
                  'flex h-6 min-w-6 items-center justify-center rounded-md border px-1 text-[11px] font-medium',
                  p === page ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-transparent text-slate-600 hover:bg-slate-50',
                )}
              >
                {p}
              </a>
            ))}
          <PagerLink pathname={pathname} params={params} pageKey={pageKey} to={Math.min(pageCount, page + 1)} disabled={page === pageCount} label="Next page">&rsaquo;</PagerLink>
        </nav>
      )}
    </div>
  )
}

function PagerLink({
  pathname, params, pageKey, to, disabled, label, children,
}: {
  pathname: string
  params: SearchParams
  pageKey: string
  to: number
  disabled: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <a
      href={buildHref(pathname, params, { [pageKey]: to === 1 ? undefined : to })}
      aria-label={label}
      aria-disabled={disabled}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-md text-slate-500',
        disabled ? 'pointer-events-none opacity-40' : 'hover:bg-slate-50',
      )}
    >
      {children}
    </a>
  )
}

function pagerRange(current: number, total: number): (number | null)[] {
  if (total <= 6) return Array.from({ length: total }, (_, i) => i + 1)
  const range: (number | null)[] = [1]
  const left = Math.max(2, current - 1)
  const right = Math.min(total - 1, current + 1)
  if (left > 2) range.push(null)
  for (let i = left; i <= right; i += 1) range.push(i)
  if (right < total - 1) range.push(null)
  range.push(total)
  return range
}
