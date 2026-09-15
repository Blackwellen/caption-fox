import Link from 'next/link'
import { LayoutGrid, List, Rows3, Search, SlidersHorizontal, Table2, X, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildHref, type RawParams } from '@/lib/brand-assets/filters'

/**
 * Search box. Submits as a GET form so the term lands in the URL and the result
 * is shareable, refresh-safe and reusable by exports — no client state.
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
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        name="q"
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      />
    </form>
  )
}

export interface SelectOption { value: string; label: string }

/**
 * Filter select rendered as a labelled native control inside a GET form, so it
 * works without JavaScript and keeps every filter in the URL.
 */
export function FilterSelect({
  pathname, params, name, label, allLabel, options, value,
}: {
  pathname: string
  params: RawParams
  name: string
  label: string
  allLabel: string
  options: SelectOption[]
  value: string | null
}) {
  const hidden = Object.entries(params).filter(([k]) => k !== name && k !== 'page')
  return (
    <form action={pathname} className="shrink-0">
      {hidden.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={Array.isArray(v) ? v.join(',') : (v ?? '')} />
      ))}
      <label className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white pl-2.5 pr-1">
        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        <select
          name={name}
          defaultValue={value ?? ''}
          aria-label={label}
          className="max-w-[130px] cursor-pointer truncate border-0 bg-transparent py-0 pr-5 text-[13px] font-medium text-slate-700 focus:outline-none"
          // Native form submit on change keeps the control usable by keyboard.
          // Progressive enhancement: without JS the user submits with Enter.
        >
          <option value="">{allLabel}</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button type="submit" className="sr-only">Apply {label}</button>
      </label>
    </form>
  )
}

/** Sort control — same GET-form pattern as the filters. */
export function SortSelect({
  pathname, params, options, value,
}: { pathname: string; params: RawParams; options: SelectOption[]; value: string }) {
  return (
    <FilterSelect
      pathname={pathname} params={params} name="sort"
      label="Sort by" allLabel={options[0]?.label ?? 'Default'}
      options={options} value={value}
    />
  )
}

const VIEW_ICON: Record<string, React.ComponentType<{ size?: number }>> = {
  cards: LayoutGrid, grid: LayoutGrid, list: List, table: Table2,
  calendar: Calendar, board: Rows3,
}

/** View switcher. Each option is a link, so the choice persists in the URL. */
export function ViewSwitcher({
  pathname, params, views, active,
}: {
  pathname: string
  params: RawParams
  views: { value: string; label: string }[]
  active: string
}) {
  return (
    <div className="inline-flex shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white" role="group" aria-label="View">
      {views.map(v => {
        const Icon = VIEW_ICON[v.value] ?? LayoutGrid
        const on = v.value === active
        return (
          <Link
            key={v.value}
            href={buildHref(pathname, params, { view: v.value })}
            aria-current={on ? 'true' : undefined}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 px-3 text-[13px] font-medium transition-colors',
              on ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50',
            )}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{v.label}</span>
          </Link>
        )
      })}
    </div>
  )
}

/** "More Filters" affordance — links to the same page with the panel expanded. */
export function MoreFiltersButton({
  pathname, params, activeCount,
}: { pathname: string; params: RawParams; activeCount: number }) {
  return (
    <Link
      href={buildHref(pathname, params, { filters: params.filters ? null : '1' })}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
    >
      <SlidersHorizontal size={14} />
      More Filters
      {activeCount > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
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
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {chips.map(c => (
        <span key={c.key} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-1 pl-2.5 pr-1 text-[12px] font-medium text-blue-700">
          <span className="text-blue-500">{c.label}:</span> {c.value}
          <Link
            href={buildHref(pathname, params, { [c.key]: null })}
            aria-label={`Clear ${c.label} filter`}
            className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-blue-100"
          >
            <X size={11} />
          </Link>
        </span>
      ))}
      <Link href={pathname} className="text-[12px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline">
        Clear all
      </Link>
    </div>
  )
}

/** The filter row shared by Kits, Assets, Rights and Products. */
export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3', className)}>
      {children}
    </div>
  )
}
