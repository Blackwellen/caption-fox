import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/** URL-driven pagination: every page is a shareable link and survives refresh. */
export default function Pagination({
  pathname, params, page, size, total, label = 'records',
}: {
  pathname: string
  params: Record<string, string | undefined>
  page: number
  size: number
  total: number
  label?: string
}) {
  const pages = Math.max(1, Math.ceil(total / size))
  if (total === 0) return null
  const href = (target: number) => {
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) if (value && key !== 'page') qs.set(key, value)
    if (target > 1) qs.set('page', String(target))
    const s = qs.toString()
    return s ? `${pathname}?${s}` : pathname
  }
  const first = (page - 1) * size + 1
  const last = Math.min(total, page * size)
  const link = 'inline-flex h-10 min-w-10 items-center justify-center rounded-lg border border-sg-line bg-white px-2 text-[13px] text-sg-body hover:bg-slate-50 lg:h-7 lg:min-w-7 lg:text-[10.5px]'
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-2 pt-3">
      <p className="text-[12px] text-sg-muted lg:text-[10px]">Showing {first}–{last} of {total} {label}</p>
      <div className="flex items-center gap-1.5">
        {page > 1 ? <Link href={href(page - 1)} className={link} aria-label="Previous page"><ChevronLeft aria-hidden className="h-4 w-4" /></Link>
          : <span className={cn(link, 'pointer-events-none opacity-40')} aria-hidden><ChevronLeft className="h-4 w-4" /></span>}
        <span className="px-2 text-[12px] text-sg-body lg:text-[10px]" aria-current="page">Page {page} of {pages}</span>
        {page < pages ? <Link href={href(page + 1)} className={link} aria-label="Next page"><ChevronRight aria-hidden className="h-4 w-4" /></Link>
          : <span className={cn(link, 'pointer-events-none opacity-40')} aria-hidden><ChevronRight className="h-4 w-4" /></span>}
      </div>
    </nav>
  )
}
