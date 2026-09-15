'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { CARD, CARD_SHADOW, formatShortDate } from '@/components/studio/primitives'
import { Badge } from '@/components/ui/Badge'
import { competitionBand, relevanceBand } from '@/lib/studio/constants'
import type { KeywordSetRow } from '@/lib/studio/types'
import type { ViewMode } from '@/lib/studio/query'
import type { StudioCapabilities } from '@/lib/studio/entitlements'

export default function KeywordList({
  rows, view, selectedId,
}: { rows: KeywordSetRow[]; view: ViewMode; selectedId: string; capabilities: StudioCapabilities }) {
  const pathname = usePathname()
  const params = useSearchParams()

  function href(id: string): string {
    const next = new URLSearchParams(params.toString())
    next.set('selected', id)
    return `${pathname}?${next.toString()}`
  }

  if (view === 'table') {
    return (
      <div className={`${CARD} ${CARD_SHADOW} overflow-x-auto`}>
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Terms</th>
              <th className="px-4 py-2.5 font-medium">Relevance</th>
              <th className="px-4 py-2.5 font-medium">Competition</th>
              <th className="px-4 py-2.5 font-medium">Growth</th>
              <th className="px-4 py-2.5 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(row => {
              const relevance = relevanceBand(row.relevance_score)
              const competition = competitionBand(row.competition)
              return (
                <tr key={row.id} className={cn('cursor-pointer hover:bg-slate-50/60', selectedId === row.id && 'bg-blue-50/50')}>
                  <td className="px-4 py-2.5"><Link href={href(row.id)} className="font-medium text-slate-800 hover:text-blue-600">{row.name}</Link></td>
                  <td className="px-4 py-2.5 text-slate-500">{row.term_count ?? row.hashtags.length}</td>
                  <td className="px-4 py-2.5"><Badge variant={relevance.variant}>{row.relevance_score ?? '—'}</Badge></td>
                  <td className="px-4 py-2.5"><Badge variant={competition.variant}>{competition.label}</Badge></td>
                  <td className="px-4 py-2.5 text-slate-500">{row.growth_30d !== null ? `${row.growth_30d > 0 ? '+' : ''}${row.growth_30d}%` : '—'}</td>
                  <td className="px-4 py-2.5 text-slate-400">{formatShortDate(row.updated_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {rows.map(row => {
        const relevance = relevanceBand(row.relevance_score)
        return (
          <Link
            key={row.id} href={href(row.id)}
            className={cn(CARD, CARD_SHADOW, 'flex flex-col gap-1.5 p-3.5 transition-colors hover:border-blue-200', selectedId === row.id && 'border-blue-300 bg-blue-50/30')}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-slate-800">{row.name}</p>
              <Badge variant={relevance.variant}>{row.relevance_score ?? '—'}</Badge>
            </div>
            <p className="text-xs text-slate-400">{row.term_count ?? row.hashtags.length} terms · Updated {formatShortDate(row.updated_at)}</p>
          </Link>
        )
      })}
    </div>
  )
}
