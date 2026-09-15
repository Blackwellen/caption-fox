'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Download, MoreHorizontal, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Exports exactly what is on screen: the current workspace, filters, search
 * and sort are forwarded to the server, which re-applies permissions before
 * writing a row. Disabled with a reason when the role cannot export.
 */
export default function ExportButton({
  entity, allowed, className,
}: { entity: 'creators' | 'briefs' | 'submissions' | 'rights' | 'payments'; allowed: boolean; className?: string }) {
  const params = useSearchParams()

  if (!allowed) {
    return (
      <button
        type="button" disabled
        title="Your role does not include exporting data. Ask a workspace owner or admin for access."
        className={cn('inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-400 shadow-sm', className)}
      >
        <Download size={14} />Export
      </button>
    )
  }

  const search = new URLSearchParams(params.toString())
  search.set('entity', entity)

  return (
    <a
      href={`/app/creators/export?${search.toString()}`}
      className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50', className)}
    >
      <Download size={14} />Export
    </a>
  )
}

export interface OverflowItem { label: string; href?: string; onSelect?: 'refresh'; description?: string }

/** The header "…" menu. Only ever contains links or a data refresh. */
export function HeaderOverflow({ items }: { items: OverflowItem[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-label="More actions"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
            {items.map(item => (
              <button
                key={item.label} type="button"
                onClick={() => { setOpen(false); if (item.onSelect === 'refresh') router.refresh(); else if (item.href) router.push(item.href) }}
                className="flex w-full flex-col rounded-lg px-2.5 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">{item.onSelect === 'refresh' && <RefreshCw size={13} />}{item.label}</span>
                {item.description && <span className="mt-0.5 text-[11px] text-slate-400">{item.description}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
