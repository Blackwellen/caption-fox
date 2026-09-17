'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/** URL-backed sort control. Changing the sort resets pagination. */
export default function SortSelect({
  options, paramKey = 'sort', label = 'Sort by', className,
}: {
  options: readonly { id: string; label: string }[]
  paramKey?: string
  label?: string
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const value = params.get(paramKey) ?? options[0]?.id ?? ''

  function change(next: string) {
    const search = new URLSearchParams(params.toString())
    search.set(paramKey, next)
    search.delete('page')
    router.push(`${pathname}?${search.toString()}`, { scroll: false })
  }

  return (
    <div className={cn('relative flex items-center gap-1.5', className)}>
      <span className="text-[13px] text-slate-500">{label}:</span>
      <div className="relative">
        <select
          value={value} onChange={e => change(e.target.value)} aria-label={label}
          className="h-8 cursor-pointer appearance-none rounded-lg border border-transparent bg-transparent pl-1 pr-6 text-[13px] font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <ChevronDown size={13} className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  )
}

/**
 * Compact URL-backed select used inside panel headers (e.g. the budget chart's
 * grouping and period controls). Like SortSelect, the value lives in the query
 * string so the view is shareable and survives refresh.
 */
export function PanelSelect({
  options, paramKey, ariaLabel, className,
}: {
  options: readonly { id: string; label: string }[]
  paramKey: string
  ariaLabel: string
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const value = params.get(paramKey) ?? options[0]?.id ?? ''

  function change(next: string) {
    const search = new URLSearchParams(params.toString())
    if (next === options[0]?.id) search.delete(paramKey)
    else search.set(paramKey, next)
    const qs = search.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div className={cn('relative', className)}>
      <select
        value={value} onChange={e => change(e.target.value)} aria-label={ariaLabel}
        className="h-7 lg:h-6 cursor-pointer appearance-none rounded-md border border-slate-200 bg-white pl-1.5 pr-4 lg:pl-1 lg:pr-2.5 text-[11px] lg:text-[8px] font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100"
      >
        {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
      <ChevronDown size={11} className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
  )
}
