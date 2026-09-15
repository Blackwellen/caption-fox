'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Filter, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildStrategyHref, type StrategyQuery } from '@/lib/strategy/query'
import type { StrategySort } from '@/lib/strategy/constants'

export interface FilterOption { value: string; label: string }
export interface FilterField {
  key: keyof StrategyQuery
  label: string
  options: FilterOption[]
  allLabel?: string
}

/**
 * Shared filter bar: a row of dropdown filters plus a "Filters" overflow chip,
 * all backed by the URL query string so state survives refresh, back/forward
 * and shared links. Each dropdown is a native <select> wrapped as a pill —
 * lightweight, fully keyboard operable, no extra listbox library needed.
 */
export default function FilterBar({
  query, fields, defaultSort = 'due_soonest', className,
}: { query: StrategyQuery; fields: FilterField[]; defaultSort?: StrategySort; className?: string }) {
  const pathname = usePathname()
  const params = useSearchParams()
  const active = fields.filter(field => Boolean(query[field.key]))
  const hasQuery = Boolean(query.q)

  function hrefFor(patch: Partial<StrategyQuery>): string {
    return buildStrategyHref(pathname, query, patch, defaultSort)
  }

  function onSelect(key: keyof StrategyQuery, value: string) {
    const target = hrefFor({ [key]: value } as Partial<StrategyQuery>)
    window.location.assign(target)
  }

  const clearHref = (() => {
    const next = new URLSearchParams(params.toString())
    next.delete('q')
    for (const field of fields) next.delete(field.key as string)
    next.delete('from'); next.delete('to'); next.delete('archived'); next.delete('favourites')
    next.delete('page')
    const qs = next.toString()
    return qs ? `${pathname}?${qs}` : pathname
  })()

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {fields.map(field => (
        <label key={String(field.key)} className="relative">
          <span className="sr-only">{field.label}</span>
          <select
            value={(query[field.key] as string) ?? ''}
            onChange={event => onSelect(field.key, event.target.value)}
            className="h-8 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-7 text-[12px] font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{field.allLabel ?? `All ${field.label.toLowerCase()}`}</option>
            {field.options.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      ))}

      <span
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-medium',
          active.length > 0 ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500',
        )}
      >
        <Filter size={13} />
        Filters{active.length > 0 ? ` (${active.length})` : ''}
      </span>

      {(active.length > 0 || hasQuery) && (
        <Link
          href={clearHref}
          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-slate-400 hover:text-slate-700"
        >
          <X size={13} />
          Clear all
        </Link>
      )}
    </div>
  )
}

/** Renders the active-filter chips as removable pills, shown below the bar. */
export function FilterChips({
  query, fields, defaultSort = 'due_soonest',
}: { query: StrategyQuery; fields: FilterField[]; defaultSort?: StrategySort }) {
  const pathname = usePathname()
  const active = fields
    .map(field => ({ field, value: query[field.key] as string }))
    .filter(entry => Boolean(entry.value))

  if (active.length === 0 && !query.q) return null

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {query.q && (
        <Chip
          label={`"${query.q}"`}
          href={buildStrategyHref(pathname, query, { q: '' }, defaultSort)}
        />
      )}
      {active.map(({ field, value }) => {
        const option = field.options.find(item => item.value === value)
        return (
          <Chip
            key={String(field.key)}
            label={`${field.label}: ${option?.label ?? value}`}
            href={buildStrategyHref(pathname, query, { [field.key]: '' } as Partial<StrategyQuery>, defaultSort)}
          />
        )
      })}
    </div>
  )
}

function Chip({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-6 items-center gap-1 rounded-full bg-slate-100 px-2.5 text-[11px] font-medium text-slate-600 hover:bg-slate-200"
    >
      {label}
      <X size={11} />
    </Link>
  )
}
