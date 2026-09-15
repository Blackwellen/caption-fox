import Link from 'next/link'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// Shared breadcrumb trail and the "back + breadcrumbs" row used at the top of
// sub-pages and detail pages. The last crumb is the current page and is not a
// link. Back is a real link to the parent, so it works from a deep link or a
// fresh tab rather than relying on browser history.

export type Crumb = { label: string; href?: string }

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-[12.5px] text-slate-500">
        {items.map((item, index) => {
          const last = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 && <ChevronRight size={13} className="shrink-0 text-slate-300" aria-hidden />}
              {item.href && !last ? (
                <Link href={item.href} className="truncate rounded hover:text-slate-800 hover:underline">{item.label}</Link>
              ) : (
                <span className={cn('truncate', last && 'font-medium text-slate-800')} aria-current={last ? 'page' : undefined}>{item.label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function PageTrail({ back, crumbs, className, compact = false, flush = false }: {
  back?: { href: string; label: string }; crumbs: Crumb[]; className?: string
  /** Tighter row for pages built to dense reference designs. */
  compact?: boolean
  /** No bottom margin, for placing the trail inline beside other controls. */
  flush?: boolean
}) {
  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5', flush ? null : compact ? 'mb-1' : 'mb-2.5', className)}>
      {back && (
        <>
          <Link
            href={back.href}
            className={cn(
              '-ml-2 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
              compact ? 'h-6 text-[12px]' : 'h-8 text-[13px]',
            )}
          >
            <ArrowLeft size={15} aria-hidden />
            {back.label}
          </Link>
          <span className="h-4 w-px shrink-0 bg-slate-200" aria-hidden />
        </>
      )}
      <Breadcrumbs items={crumbs} />
    </div>
  )
}
