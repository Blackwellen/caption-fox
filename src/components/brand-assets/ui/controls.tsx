'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { ChevronDown, LayoutGrid, List, Rows3, Search, SlidersHorizontal, Table2, X, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildHref, type RawParams } from '@/lib/brand-assets/filters'

/**
 * Every control writes to the URL, so a view is shareable, refresh-safe,
 * back/forward-safe and reusable by exports. Controls apply immediately on
 * change; without JavaScript they still submit as plain GET forms.
 */

export function SearchField({
  pathname, params, placeholder, defaultValue, className,
}: {
  pathname: string
  params: RawParams
  placeholder: string
  defaultValue?: string | null
  className?: string
}) {
  const hidden = Object.entries(params).filter(([k]) => k !== 'q' && k !== 'page')
  return (
    <form action={pathname} className={cn('relative min-w-0', className)} role="search">
      {hidden.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={Array.isArray(v) ? v.join(',') : (v ?? '')} />
      ))}
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        name="q"
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[12px] text-slate-700 lg:h-7 lg:rounded-md lg:text-[9px] placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      />
    </form>
  )
}

export interface SelectOption { value: string; label: string }

/**
 * Labelled select. `stacked` renders the reference's two-line control (small
 * label above the value); `compact` is the 28px inline variant used in panel
 * headers. Changing the value navigates at once.
 */
export function FilterSelect({
  pathname, params, name, label, allLabel, options, value, compact, stacked, className,
}: {
  pathname: string
  params: RawParams
  name: string
  label: string
  allLabel: string
  options: SelectOption[]
  value: string | null
  compact?: boolean
  stacked?: boolean
  className?: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const hidden = Object.entries(params).filter(([k]) => k !== name && k !== 'page')
  return (
    <form action={pathname} className={cn('shrink-0', className)}>
      {hidden.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={Array.isArray(v) ? v.join(',') : (v ?? '')} />
      ))}
      <label className={cn(
        'relative flex cursor-pointer items-center rounded-lg border border-slate-200 bg-white text-slate-700 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/30',
        compact ? 'h-7 rounded-md pl-2 pr-6' : stacked ? 'h-10 flex-col items-start justify-center pl-2.5 pr-7 lg:h-[30px] lg:rounded-md' : 'h-9 pl-2.5 pr-7 lg:h-6 lg:rounded-md',
        pending && 'opacity-60',
      )}>
        <span className={cn(stacked ? 'text-[9px] leading-3 text-slate-400 lg:text-[7.5px] lg:leading-[10px]' : 'sr-only')}>{label}</span>
        <select
          name={name}
          defaultValue={value ?? ''}
          aria-label={label}
          onChange={e => start(() => router.push(buildHref(pathname, params, { [name]: e.target.value || null })))}
          className={cn(
            'w-full min-w-0 cursor-pointer appearance-none border-0 bg-transparent p-0 font-medium text-slate-700 focus:outline-none',
            compact ? 'max-w-[120px] text-[10.5px]' : stacked ? 'max-w-[120px] text-[11px] leading-4 lg:text-[9px] lg:leading-3' : 'max-w-[140px] text-[11.5px] lg:text-[9px]',
          )}
        >
          <option value="">{allLabel}</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={compact ? 12 : 13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <noscript><button type="submit" className="sr-only">Apply {label}</button></noscript>
      </label>
    </form>
  )
}

/** Sort control — same pattern as the filters. */
export function SortSelect({
  pathname, params, options, value, stacked, className,
}: { pathname: string; params: RawParams; options: SelectOption[]; value: string; stacked?: boolean; className?: string }) {
  const first = options[0]
  return (
    <FilterSelect
      pathname={pathname} params={params} name="sort" stacked={stacked} className={className}
      label="Sort by" allLabel={stacked ? first?.label ?? 'Default' : `Sort by: ${first?.label ?? 'Default'}`}
      options={options.slice(1)} value={value === first?.value ? null : value}
    />
  )
}

const VIEW_ICON: Record<string, React.ComponentType<{ size?: number }>> = {
  cards: LayoutGrid, grid: LayoutGrid, list: List, table: Table2,
  calendar: Calendar, board: Rows3,
}

/** View switcher. Each option is a link, so the choice persists in the URL. */
export function ViewSwitcher({
  pathname, params, views, active, solid,
}: {
  pathname: string
  params: RawParams
  views: { value: string; label: string }[]
  active: string
  /** Reference Rights/Products style: the active segment is solid blue. */
  solid?: boolean
}) {
  return (
    <div className="inline-flex shrink-0 gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="View">
      {views.map(v => {
        const Icon = VIEW_ICON[v.value] ?? LayoutGrid
        const on = v.value === active
        return (
          <Link
            key={v.value}
            href={buildHref(pathname, params, { view: v.value })}
            aria-current={on ? 'true' : undefined}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium transition-colors lg:h-[22px] lg:px-2 lg:text-[9px]',
              on ? (solid ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600') : 'text-slate-600 hover:bg-slate-50',
            )}
          >
            <Icon size={13} />
            <span className="hidden sm:inline">{v.label}</span>
          </Link>
        )
      })}
    </div>
  )
}

/** "More Filters" — toggles the advanced filter row, with the active count. */
export function MoreFiltersButton({
  pathname, params, activeCount, label = 'More Filters',
}: { pathname: string; params: RawParams; activeCount: number; label?: string }) {
  const open = !!params.filters
  return (
    <Link
      href={buildHref(pathname, params, { filters: open ? null : '1' })}
      aria-expanded={open}
      className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[11.5px] font-medium lg:h-6 lg:rounded-md lg:px-2.5 lg:text-[9px]',
        open ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
    >
      <SlidersHorizontal size={13} />
      {label}
      {activeCount > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-bold text-white">
          {activeCount}
        </span>
      )}
    </Link>
  )
}

/** Active-filter chips with individual and bulk clear. */
export function FilterChips({
  pathname, params, chips,
}: {
  pathname: string
  params: RawParams
  chips: { key: string; label: string; value: string }[]
}) {
  if (chips.length === 0) return null
  const keep = Object.fromEntries(Object.entries(params).filter(([k]) => k === 'view'))
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map(c => (
        <span key={c.key} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-0.5 pl-2.5 pr-1 text-[11px] font-medium text-blue-700">
          <span className="text-blue-500">{c.label}:</span> {c.value}
          <Link
            href={buildHref(pathname, params, { [c.key]: null })}
            aria-label={`Clear ${c.label} filter`}
            className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-blue-100"
          >
            <X size={10} />
          </Link>
        </span>
      ))}
      <Link href={buildHref(pathname, keep, {})} className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline">
        Clear all
      </Link>
    </div>
  )
}

/** The filter row shared by Kits, Assets, Rights and Products. */
export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3.5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:mb-2.5 lg:p-2', className)}>
      {children}
    </div>
  )
}
