'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MoreItem { label: string; href?: string; refresh?: boolean; disabledReason?: string }

/** Accessible "…" menu: links, a data refresh, or disabled items that explain why. */
export default function MoreMenu({ items, label, className, compact }: { items: MoreItem[]; label: string; className?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    const onClick = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick) }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}
        className={cn(
          compact
            ? 'inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 lg:h-[18px] lg:w-[22px]'
            : 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
          className,
        )}
      >
        <MoreHorizontal className="h-4 w-4 lg:h-3 lg:w-3" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg">
          {items.map(item => {
            const cls = 'block w-full px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 lg:text-[11px]'
            if (item.disabledReason) {
              return <span key={item.label} role="menuitem" aria-disabled title={item.disabledReason} className={cn(cls, 'cursor-not-allowed text-slate-400 hover:bg-white')}>{item.label}</span>
            }
            if (item.href) return <Link key={item.label} role="menuitem" href={item.href} className={cls} onClick={() => setOpen(false)}>{item.label}</Link>
            return <button key={item.label} type="button" role="menuitem" className={cls} onClick={() => { setOpen(false); if (item.refresh) router.refresh() }}>{item.label}</button>
          })}
        </div>
      )}
    </div>
  )
}
