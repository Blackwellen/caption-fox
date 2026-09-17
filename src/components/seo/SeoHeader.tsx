'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Calendar, Check, ChevronDown, Download, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RANGE_PRESETS, type RangePresetId } from '@/lib/seo/range'
import { buildHref, readParam, type SearchParams } from '@/lib/seo/url-state'
import type { SelectFilter } from './FilterBar'
import { useSeoNav } from './SeoNavContext'
import { SEO_TAB_HREF, SEO_TAB_LABELS } from '@/lib/seo/entitlements'

/**
 * Shared header row for every SEO surface: title, subtitle, date range,
 * optional extra controls (source/country/device selectors), Filters, Export
 * and one primary action slot (typically a wizard-trigger Client Component).
 *
 * Control heights, gaps and order are fixed here so all seven routes line up
 * against the approved references without per-route spacing patches.
 */
export function SeoHeader({
  title, subtitle, note, pathname, activePreset, rangeLabel, extra, exportHref, primarySlot, filters, params, icon, badge,
}: {
  title: string
  subtitle: string
  /** Inline disclosure shown under the subtitle (demo data, stale source…). */
  note?: React.ReactNode
  pathname: string
  activePreset: RangePresetId | 'custom'
  /** Explicit "1 May – 31 May 2026" label shown inside the date chip. */
  rangeLabel?: string
  extra?: React.ReactNode
  exportHref?: string
  primarySlot?: React.ReactNode
  /** Surface filters surfaced through the header Filters popover. */
  filters?: SelectFilter[]
  params?: SearchParams
  icon?: React.ReactNode
  /** Small status pill beside the title (e.g. Demo data). */
  badge?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <SectionTitle title={title} icon={icon} />
          {badge && <span className="whitespace-nowrap">{badge}</span>}
        </div>
        <p className="mt-0.5 text-[12px] leading-snug text-slate-500">{subtitle}</p>
        {note && <p className="mt-1 flex items-center text-[11.5px] text-slate-500">{note}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 xl:shrink-0 xl:pt-1">
        <DateRangePicker pathname={pathname} activePreset={activePreset} rangeLabel={rangeLabel} />
        {extra}
        {filters && filters.length > 0 && <FiltersButton pathname={pathname} params={params ?? {}} filters={filters} />}
        {exportHref && (
          <a
            href={exportHref}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download size={14} aria-hidden />
            Export
          </a>
        )}
        {primarySlot}
      </div>
    </div>
  )
}

/**
 * Page title doubling as the SEO section switcher. The references show a bare
 * title, so the menu trigger is a quiet chevron; every entitled section is one
 * click away and the current one is marked.
 */
function SectionTitle({ title, icon }: { title: string; icon?: React.ReactNode }) {
  const nav = useSeoNav()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const heading = (
    <h1 className="flex items-center gap-2 text-[21px] font-bold leading-tight tracking-tight text-slate-900 sm:text-[25px]">
      {icon}
      {title}
    </h1>
  )
  if (!nav || nav.tabs.length <= 1) return heading

  return (
    <div className="relative flex items-center gap-1">
      {heading}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Switch SEO & Discovery section"
        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <ChevronDown size={16} aria-hidden />
      </button>
      {open && (
        <>
          <button aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <nav aria-label="SEO and Discovery sections" className="absolute left-0 top-full z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {nav.tabs.map(tab => {
              const current = tab === nav.active
              return (
                <Link
                  key={tab}
                  href={`${SEO_TAB_HREF[tab]}${nav.query ? `?${nav.query}` : ''}`}
                  aria-current={current ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50',
                    current ? 'font-semibold text-blue-600' : 'text-slate-700',
                  )}
                >
                  {SEO_TAB_LABELS[tab]}
                  {current && <Check size={14} aria-hidden />}
                </Link>
              )
            })}
          </nav>
        </>
      )}
    </div>
  )
}

function DateRangePicker({
  pathname, activePreset, rangeLabel,
}: { pathname: string; activePreset: RangePresetId | 'custom'; rangeLabel?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const current = RANGE_PRESETS.find(p => p.id === activePreset)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50"
      >
        <Calendar size={14} aria-hidden className="text-slate-400" />
        {rangeLabel ?? current?.label ?? 'Custom range'}
        <ChevronDown size={14} aria-hidden className="text-slate-400" />
      </button>
      {open && (
        <>
          <button aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {RANGE_PRESETS.map(preset => (
              <button
                key={preset.id}
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  router.push(buildHref(pathname, searchParams, { range: preset.id, from: undefined, to: undefined, page: undefined }))
                }}
                className={cn(
                  'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50',
                  preset.id === activePreset ? 'font-semibold text-blue-600' : 'text-slate-700',
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Header Filters popover. Holds the same URL-driven selects the surface's
 * inline filter bar uses, so the two never disagree; the badge shows how many
 * are active and "Clear all" removes exactly those keys.
 */
function FiltersButton({
  pathname, params, filters,
}: { pathname: string; params: SearchParams; filters: SelectFilter[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const activeCount = filters.filter(f => readParam(params, f.key)).length

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-medium hover:bg-slate-50',
          activeCount > 0 ? 'border-blue-300 bg-blue-50/60 text-blue-700' : 'border-slate-200 bg-white text-slate-700',
        )}
      >
        <SlidersHorizontal size={14} aria-hidden className={activeCount > 0 ? 'text-blue-500' : 'text-slate-400'} />
        Filters
        {activeCount > 0 && (
          <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">
            {activeCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <button aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div
            ref={panel}
            role="dialog"
            aria-label="Filters"
            className="absolute right-0 z-20 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Filters</p>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  router.push(buildHref(pathname, searchParams, Object.fromEntries(
                    filters.map(f => [f.key, undefined] as const).concat([['page', undefined]]),
                  )))
                }}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {filters.map(filter => (
                <label key={filter.key} className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">{filter.placeholder}</span>
                  <select
                    name={`filter-${filter.key}`}
                    value={readParam(params, filter.key) ?? ''}
                    onChange={event => router.push(buildHref(pathname, searchParams, { [filter.key]: event.target.value || undefined, page: undefined }))}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-blue-400"
                  >
                    <option value="">All</option>
                    {filter.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
