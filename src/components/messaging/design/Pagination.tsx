'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

function pages(current: number, count: number): (number | '…')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '…', count]
  if (current >= count - 3) return [1, '…', count - 4, count - 3, count - 2, count - 1, count]
  return [1, '…', current - 1, current, current + 1, '…', count]
}

export default function Pagination({
  page, size, total, noun, sizes = [5, 10, 25, 50], className,
}: { page: number; size: number; total: number; noun: string; sizes?: number[]; className?: string }) {
  const pathname = usePathname()
  const search = useSearchParams()
  const router = useRouter()
  const count = Math.max(1, Math.ceil(total / size))
  const href = (p: number) => {
    const next = new URLSearchParams(search.toString())
    if (p <= 1) next.delete('page'); else next.set('page', String(p))
    return `${pathname}${next.size ? `?${next}` : ''}`
  }
  const start = total === 0 ? 0 : (page - 1) * size + 1
  const end = Math.min(total, page * size)
  const cell = 'flex h-8 min-w-8 items-center justify-center rounded-md px-1 text-[12px] lg:h-[20px] lg:min-w-[20px] lg:rounded-[4px] lg:text-[8.5px]'

  return (
    <nav aria-label="Pagination" className={cn('flex flex-wrap items-center gap-3 lg:gap-[10px]', className)}>
      <p className="text-[12px] text-slate-500 lg:text-[8px]">Showing {start} to {end} of {total.toLocaleString('en-GB')} {noun}</p>
      <div className="ml-auto flex items-center gap-1 lg:mr-[36px] lg:gap-[7px]">
        <PageLink href={page > 1 ? href(page - 1) : null} label="Previous page"><ChevronLeft className="h-3.5 w-3.5 lg:h-2.5 lg:w-2.5" /></PageLink>
        {pages(page, count).map((p, i) => p === '…'
          ? <span key={`gap-${i}`} className={cn(cell, 'text-slate-400')}>…</span>
          : <Link key={p} href={href(p)} scroll={false} aria-current={p === page ? 'page' : undefined}
              className={cn(cell, p === page ? 'bg-blue-600 font-medium text-white' : 'text-slate-600 hover:bg-slate-100')}>{p}</Link>)}
        <PageLink href={page < count ? href(page + 1) : null} label="Next page"><ChevronRight className="h-3.5 w-3.5 lg:h-2.5 lg:w-2.5" /></PageLink>
      </div>
      <label className="flex items-center gap-2 text-[12px] text-slate-500 lg:gap-[12px] lg:text-[8px]">
        <span className="relative">
          <select value={size} aria-label="Rows per page"
            onChange={e => { const next = new URLSearchParams(search.toString()); next.set('size', e.target.value); next.delete('page'); router.replace(`${pathname}?${next}`, { scroll: false }) }}
            className="h-8 appearance-none rounded-md border border-slate-200 bg-white pl-2 pr-6 text-[12px] text-slate-700 lg:h-[20px] lg:w-[44px] lg:rounded-[4px] lg:text-[8.5px]">
            {sizes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400 lg:h-2.5 lg:w-2.5" aria-hidden />
        </span>
        per page
      </label>
    </nav>
  )
}

function PageLink({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  const cls = 'flex h-8 w-8 items-center justify-center rounded-md text-slate-500 lg:h-[20px] lg:w-[16px]'
  if (!href) return <span aria-disabled className={cn(cls, 'opacity-40')} aria-label={label}>{children}</span>
  return <Link href={href} scroll={false} aria-label={label} className={cn(cls, 'hover:bg-slate-100')}>{children}</Link>
}
