'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PAGE_SIZES } from '@/lib/creators/constants'

/**
 * Shared pager. Page and page size live in the URL, so paging survives a
 * refresh and a shared link — and the server always re-clamps the page, so an
 * out-of-range value renders an empty page rather than failing.
 */
export default function Pagination({
  page, size, total, label, className,
}: { page: number; size: number; total: number; label: string; className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const pages = Math.max(1, Math.ceil(total / size))
  const first = total === 0 ? 0 : (page - 1) * size + 1
  const last = Math.min(page * size, total)

  function go(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // Windowed page numbers with ellipsis, always including first and last.
  const numbers: (number | 'gap')[] = []
  const window = 1
  for (let i = 1; i <= pages; i += 1) {
    if (i === 1 || i === pages || (i >= page - window && i <= page + window)) numbers.push(i)
    else if (numbers[numbers.length - 1] !== 'gap') numbers.push('gap')
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3', className)}>
      <p className="text-[12px] text-slate-500">
        {total === 0 ? `No ${label}` : `Showing ${first}–${last} of ${total.toLocaleString('en-GB')} ${label}`}
      </p>

      <nav className="ml-auto flex items-center gap-1" aria-label="Pagination">
        <button
          type="button" disabled={page <= 1} onClick={() => go({ page: String(page - 1) })}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>
        {numbers.map((number, index) => (
          number === 'gap'
            ? <span key={`gap-${index}`} className="px-1 text-[12px] text-slate-400" aria-hidden>…</span>
            : (
              <button
                key={number} type="button"
                onClick={() => go({ page: number === 1 ? null : String(number) })}
                aria-current={number === page ? 'page' : undefined}
                className={cn(
                  'inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-[12px] font-medium transition-colors',
                  number === page
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                )}
              >
                {number}
              </button>
            )
        ))}
        <button
          type="button" disabled={page >= pages} onClick={() => go({ page: String(page + 1) })}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>
      </nav>

      <label className="flex items-center gap-1.5 text-[12px] text-slate-500">
        <span className="sr-only">Rows per page</span>
        <select
          value={size}
          onChange={event => go({ size: event.target.value, page: null })}
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-600 focus:border-blue-400 focus:outline-none"
        >
          {PAGE_SIZES.map(option => <option key={option} value={option}>{option} / page</option>)}
        </select>
      </label>
    </div>
  )
}
