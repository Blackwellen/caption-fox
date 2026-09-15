'use client'

import { useSearchParams } from 'next/navigation'
import { Download } from 'lucide-react'
import { cn } from '@/lib/utils'

export { HeaderOverflow } from '@/components/campaigns/ExportButton'
export type { OverflowItem } from '@/components/campaigns/ExportButton'

export default function ExportButton({
  entity, module, allowed, className,
}: { entity: 'partners' | 'programmes'; module: string; allowed: boolean; className?: string }) {
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
  search.set('module', module)

  return (
    <a
      href={`/app/partnerships/export?${search.toString()}`}
      className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50', className)}
    >
      <Download size={14} />
      Export
    </a>
  )
}
