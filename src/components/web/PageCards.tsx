import Link from 'next/link'
import { Globe2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { PAGE_STATUS_BADGE, PAGE_STATUS_LABELS, PAGE_TYPE_LABELS } from '@/lib/web/constants'
import { CARD, CARD_SHADOW, formatCompactNumber, formatPercentValue, formatShortDate } from './primitives'
import { WebEmpty } from './states'
import type { PageRow } from '@/lib/web/types'

export default function PageCards({ rows }: { rows: PageRow[] }) {
  if (rows.length === 0) {
    return <WebEmpty bare title="No pages yet" message="Create your first landing page or microsite to start tracking traffic and conversions here." />
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(row => (
        <Link key={row.id} href={`/app/web/pages/${row.id}`} className={cn(CARD, CARD_SHADOW, 'flex flex-col gap-3 p-3.5 transition-colors hover:border-blue-200')}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Globe2 size={14} /></span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-slate-900">{row.name}</p>
                <p className="truncate text-[11px] text-slate-400">/{row.slug}</p>
              </div>
            </div>
            <Badge variant={PAGE_STATUS_BADGE[row.status]}>{PAGE_STATUS_LABELS[row.status]}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-[15px] font-bold text-slate-900">{formatCompactNumber(row.sessions)}</p><p className="text-[10px] text-slate-400">Sessions</p></div>
            <div><p className="text-[15px] font-bold text-slate-900">{formatCompactNumber(row.conversions)}</p><p className="text-[10px] text-slate-400">Conversions</p></div>
            <div><p className="text-[15px] font-bold text-slate-900">{formatPercentValue(row.sessions > 0 ? (row.conversions / row.sessions) * 100 : 0)}</p><p className="text-[10px] text-slate-400">Conv. rate</p></div>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
            <span>{PAGE_TYPE_LABELS[row.page_type]} · {row.owner?.full_name ?? row.owner?.email ?? 'Unassigned'}</span>
            <span>{formatShortDate(row.updated_at)}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}
