'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Download, MoreHorizontal, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * Exports exactly what is on screen: the current workspace, filters, search and
 * sort are forwarded to the server, which re-applies permissions before writing
 * a row. Disabled with a reason when the role cannot export.
 */
export default function ExportButton({
  entity, allowed, className,
}: { entity: 'campaigns' | 'templates' | 'giveaways' | 'competitions'; allowed: boolean; className?: string }) {
  const params = useSearchParams()

  if (!allowed) {
    return (
      <button
        type="button" disabled
        title="Your role does not include exporting data. Ask a workspace owner or admin for access."
        className={cn('inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-400 shadow-sm', className)}
      >
        <Download size={14} />
        Export
      </button>
    )
  }

  const search = new URLSearchParams(params.toString())
  search.set('entity', entity)

  return (
    <a
      href={`/app/campaigns/export?${search.toString()}`}
      className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50', className)}
    >
      <Download size={14} />
      Export
    </a>
  )
}

export interface OverflowItem {
  label: string
  href?: string
  onSelect?: 'refresh'
  description?: string
}

/** The header "…" menu. Only ever contains links or a data refresh. */
export function HeaderOverflow({ items }: { items: OverflowItem[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button" onClick={() => setOpen(o => !o)}
        aria-haspopup="menu" aria-expanded={open} aria-label="More campaign actions"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {items.map(item => item.href ? (
              <Link
                key={item.label} href={item.href} role="menuitem" onClick={() => setOpen(false)}
                className="block px-3 py-2 text-[13px] text-slate-700 transition-colors hover:bg-slate-50"
              >
                {item.label}
                {item.description && <span className="block text-[11px] text-slate-400">{item.description}</span>}
              </Link>
            ) : (
              <button
                key={item.label} type="button" role="menuitem"
                onClick={() => { setOpen(false); router.refresh() }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-slate-700 transition-colors hover:bg-slate-50"
              >
                <RefreshCw size={13} className="text-slate-400" />
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
