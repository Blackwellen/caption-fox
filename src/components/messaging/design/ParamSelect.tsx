'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/** A select whose value lives in the URL (e.g. which audience a panel shows). */
export default function ParamSelect({
  param, value, options, label, className, placeholder,
}: { param: string; value: string; options: { value: string; label: string }[]; label: string; className?: string; placeholder?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  return (
    <span className={cn('relative block min-w-0', className)}>
      <select
        aria-label={label} value={value}
        onChange={e => {
          const next = new URLSearchParams(search.toString())
          if (e.target.value) next.set(param, e.target.value); else next.delete(param)
          router.replace(`${pathname}?${next}`, { scroll: false })
        }}
        className="h-9 w-full appearance-none truncate rounded-md border border-slate-200 bg-white pl-2.5 pr-7 text-[13px] text-slate-700 lg:h-[21px] lg:rounded-[4px] lg:pl-[7px] lg:pr-[18px] lg:text-[8.5px]"
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400 lg:right-[6px] lg:h-2.5 lg:w-2.5" aria-hidden />
    </span>
  )
}
