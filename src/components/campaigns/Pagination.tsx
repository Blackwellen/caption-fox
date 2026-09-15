'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PAGE_SIZES } from '@/lib/campaigns/constants'

/** Builds the 1 … n page window shown in the design's pager. */
function pageWindow(current: number, last: number): (number | '…')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)
  const pages: (number | '…')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(last - 1, current + 1)
  if (start > 2) pages.push(start === 3 ? 2 : '…')
  for (let page = start; page <= end; page++) pages.push(page)
  if (end < last - 1) pages.push('…')
  pages.push(last)
  return pages
}

export default function Pagination({
  page, size, total,
}: { page: number; size: number; total: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const last = Math.max(1, Math.ceil(total / size))

  function href(next: number): string {
    const search = new URLSearchParams(params.toString())
    if (next <= 1) search.delete('page')
    else search.set('page', String(next))
    const qs = search.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  function setSize(next: number) {
    const search = new URLSearchParams(params.toString())
    search.set('size', String(next))
    search.delete('page')
    router.push(`${pathname}?${search.toString()}`, { scroll: false })
  }

  const btn = 'inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50'

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 py-1">
      <nav aria-label="Pagination" className="flex items-center gap-1">
        {page > 1
          ? <Link href={href(page - 1)} scroll={false} aria-label="Previous page" className={btn}><ChevronLeft size={14} /></Link>
          : <span aria-hidden className={cn(btn, 'opacity-40')}><ChevronLeft size={14} /></span>}

        {pageWindow(page, last).map((entry, index) =>
          entry === '…'
            ? <span key={`gap-${index}`} className="px-1 text-[13px] text-slate-400">…</span>
            : (
              <Link
                key={entry} href={href(entry)} scroll={false}
                aria-current={entry === page ? 'page' : undefined}
                className={cn(btn, entry === page && 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700')}
              >
                {entry}
              </Link>
            ))}

        {page < last
          ? <Link href={href(page + 1)} scroll={false} aria-label="Next page" className={btn}><ChevronRight size={14} /></Link>
          : <span aria-hidden className={cn(btn, 'opacity-40')}><ChevronRight size={14} /></span>}
      </nav>

      <label className="ml-auto flex items-center gap-2 text-[13px] text-slate-500">
        Rows per page:
        <select
          value={size} onChange={e => setSize(Number(e.target.value))}
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[13px] font-medium text-slate-700"
        >
          {PAGE_SIZES.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    </div>
  )
}
