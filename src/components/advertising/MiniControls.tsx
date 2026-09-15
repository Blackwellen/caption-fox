'use client'

import { useId, useRef, type ReactNode } from 'react'
import { Calendar, ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RANGE_PRESETS, useUrlState, type SelectOption } from './Controls'

// Compact controls matching the reference designs: pill filter selects
// ("All Platforms ▾"), a two-way segmented toggle, the header date / compare
// selectors that display real dates, a Filters popover, and a horizontal
// scroll row with its round "next" arrow. All state lives in the URL.

/** Small pill select used inside panels, e.g. "Objective: All ▾". */
export function ChipSelect({
  paramKey, label, options, allLabel, prefix, className,
}: {
  paramKey: string
  label: string
  options: SelectOption[]
  /** Text shown when nothing is selected, e.g. "All Platforms". */
  allLabel: string
  /** Optional "Objective:" style prefix shown before the selected value. */
  prefix?: string
  className?: string
}) {
  const { params, set } = useUrlState()
  const value = params.get(paramKey) ?? ''
  const id = useId()
  const selected = options.find(option => option.value === value)
  const display = selected ? `${prefix ? `${prefix} ` : ''}${selected.label}` : allLabel

  return (
    <div className={cn('relative inline-flex', className)}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <span
        className={cn(
          'pointer-events-none inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-lg border bg-white pl-2.5 pr-2 text-[12px] lg:text-[11px]',
          selected ? 'border-blue-200 bg-blue-50/50 font-medium text-blue-700' : 'border-slate-200 text-slate-700',
        )}
        aria-hidden
      >
        {display}
        <ChevronDown size={13} className="text-slate-400" />
      </span>
      <select
        id={id}
        value={value}
        onChange={event => set({ [paramKey]: event.target.value || null })}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        <option value="">{allLabel}</option>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  )
}

/** Bordered select with its label inside, e.g. "Platform     All ▾" on the Campaigns filter bar. */
export function InlineLabelSelect({
  paramKey, label, options, allLabel = 'All', className,
}: { paramKey: string; label: string; options: SelectOption[]; allLabel?: string; className?: string }) {
  const { params, set } = useUrlState()
  const value = params.get(paramKey) ?? ''
  const id = useId()
  const selected = options.find(option => option.value === value)
  return (
    <div className={cn('relative inline-flex', className)}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <span className={cn(
        'pointer-events-none inline-flex h-[30px] w-full items-center justify-between gap-2.5 whitespace-nowrap rounded-lg border bg-white pl-3 pr-2.5 text-[12.5px] lg:text-[11px]',
        selected ? 'border-blue-200' : 'border-slate-200',
      )} aria-hidden>
        <span className="text-slate-700">{label}</span>
        <span className="flex items-center gap-1.5 border-l border-slate-200 pl-2.5"><span className={cn('max-w-[120px] truncate', selected ? 'font-medium text-blue-700' : 'text-slate-800')}>{selected?.label ?? allLabel}</span><ChevronDown size={13} className="text-slate-400" /></span>
      </span>
      <select id={id} value={value} onChange={event => set({ [paramKey]: event.target.value || null })} className="absolute inset-0 cursor-pointer appearance-none opacity-0">
        <option value="">{allLabel}</option>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  )
}

/** Two-to-four option segmented toggle bound to one URL param. */
export function SegmentedParam({
  paramKey, options, defaultValue, ariaLabel, className, badgeTone = 'red',
}: {
  paramKey: string; options: { value: string; label: string; badge?: number }[]; defaultValue: string; ariaLabel: string; className?: string
  /** Red for problems (Needs Attention), blue for neutral queues (Review Queue). */
  badgeTone?: 'red' | 'blue'
}) {
  const { params, set } = useUrlState()
  const active = params.get(paramKey) ?? defaultValue
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5', className)}>
      {options.map(option => {
        const selected = option.value === active
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => set({ [paramKey]: option.value === defaultValue ? null : option.value })}
            className={cn(
              'inline-flex h-[26px] items-center justify-center gap-1.5 rounded-md px-3.5 text-[12.5px] font-medium transition-colors lg:text-[11px]',
              selected ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50',
            )}
          >
            {option.label}
            {!!option.badge && (
              <span className={cn('flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white', badgeTone === 'blue' ? 'bg-blue-600' : 'bg-red-500')}>{option.badge}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Header date-range control that shows the actual dates, e.g. "18 Jul – 16 Aug 2026". */
export function DateRangeButton({ label, className }: { label: string; className?: string }) {
  const { params, set } = useUrlState()
  const id = useId()
  return (
    <div className={cn('relative inline-flex', className)}>
      <label htmlFor={id} className="sr-only">Date range, currently {label}</label>
      <span className="pointer-events-none inline-flex h-[30px] w-full items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white pl-3 pr-2.5 text-[12.5px] font-medium text-slate-700 lg:text-[11px]" aria-hidden>
        <Calendar size={14} className="text-slate-500" />
        <span className="flex-1">{label}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </span>
      <select
        id={id}
        value={params.get('range') ?? 'last_30'}
        onChange={event => set({ range: event.target.value === 'last_30' ? null : event.target.value })}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {RANGE_PRESETS.map(preset => <option key={preset.value} value={preset.value}>{preset.label}</option>)}
      </select>
    </div>
  )
}

/** Comparison selector: previous period or the same dates last year. */
export function CompareButton({ label, className }: { label: string; className?: string }) {
  const { params, set } = useUrlState()
  const id = useId()
  return (
    <div className={cn('relative inline-flex', className)}>
      <label htmlFor={id} className="sr-only">Compare to, currently {label}</label>
      <span className="pointer-events-none inline-flex h-[30px] w-full items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white pl-3 pr-2.5 text-[12.5px] font-medium text-slate-700 lg:text-[11px]" aria-hidden>
        <span className="flex-1">vs {label}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </span>
      <select
        id={id}
        value={params.get('compare') ?? 'previous'}
        onChange={event => set({ compare: event.target.value === 'previous' ? null : event.target.value })}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        <option value="previous">Previous period</option>
        <option value="year">Same period last year</option>
      </select>
    </div>
  )
}

/** "Filters ▾" popover. Children are the filter controls it contains. */
export function FiltersPopover({ activeCount, children }: { activeCount: number; children: ReactNode }) {
  const { clearAll } = useUrlState()
  return (
    <details className="group relative">
      <summary className="inline-flex h-[30px] cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-700 lg:text-[11px] hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal size={14} className="text-slate-500" aria-hidden />
        Filters
        {activeCount > 0 && <span className="rounded-full bg-blue-600 px-1.5 text-[10.5px] font-semibold text-white">{activeCount}</span>}
        <span className="ml-0.5 border-l border-slate-200 pl-2"><ChevronDown size={14} className="text-slate-400 transition-transform group-open:rotate-180" aria-hidden /></span>
      </summary>
      <div className="absolute right-0 top-full z-30 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
        <div className="space-y-2.5">{children}</div>
        {activeCount > 0 && (
          <button type="button" onClick={() => clearAll(['range', 'compare'])} className="mt-3 text-[12.5px] font-medium text-blue-600 hover:underline">
            Clear filters
          </button>
        )}
      </div>
    </details>
  )
}

/** Horizontal card row with the round "next" arrow from the reference. */
export function ScrollRow({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div className="relative">
      <div ref={ref} className={cn('flex snap-x gap-2 overflow-x-auto scroll-smooth pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)} role="region" aria-label={label} tabIndex={0}>
        {children}
      </div>
      <button
        type="button"
        aria-label={`Scroll ${label}`}
        onClick={() => ref.current?.scrollBy({ left: ref.current.clientWidth * 0.8, behavior: 'smooth' })}
        className="absolute -right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-slate-800"
      >
        <ChevronRight size={15} aria-hidden />
      </button>
    </div>
  )
}

/** "20 / page" selector for paginated tables. */
export function PageSizeSelect({ value, options = [10, 20, 50, 100] }: { value: number; options?: number[] }) {
  const { set } = useUrlState()
  const id = useId()
  return (
    <div className="relative inline-flex">
      <label htmlFor={id} className="sr-only">Rows per page</label>
      <span className="pointer-events-none inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white pl-3 pr-2 text-[12.5px] text-slate-700" aria-hidden>
        {value} / page <ChevronDown size={13} className="text-slate-400" />
      </span>
      <select
        id={id} value={value}
        onChange={event => set({ pageSize: event.target.value === '20' ? null : event.target.value })}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {options.map(option => <option key={option} value={option}>{option} / page</option>)}
      </select>
    </div>
  )
}

/** Row "⋮" menu. Items are links or buttons rendered by the caller. */
export function KebabMenu({ label, children, size = 'md' }: { label: string; children: ReactNode; size?: 'sm' | 'md' }) {
  return (
    <details className="relative">
      <summary aria-label={label} className={cn(
        'flex cursor-pointer list-none items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 [&::-webkit-details-marker]:hidden',
        // Dense tables use the small hit area so rows stay at design height.
        size === 'sm' ? 'h-5 w-5' : 'h-6 w-6',
      )}>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="5" r="1.8" fill="currentColor" /><circle cx="12" cy="12" r="1.8" fill="currentColor" /><circle cx="12" cy="19" r="1.8" fill="currentColor" /></svg>
      </summary>
      <div className="absolute right-0 top-full z-30 mt-1 min-w-44 rounded-lg border border-slate-200 bg-white p-1 text-[12.5px] shadow-lg [&>a]:block [&>a]:rounded-md [&>a]:px-2.5 [&>a]:py-1.5 [&>a]:text-slate-700 [&>a:hover]:bg-slate-50">
        {children}
      </div>
    </details>
  )
}
