import Link from 'next/link'
import { FileEdit, FlaskConical, Globe2, LineChart, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { CARD, CARD_SHADOW, formatCompactNumber, formatPercentValue, formatShortDate } from './primitives'
import { WebEmpty } from './states'
import type { WebExperienceRow } from '@/lib/web/types'

const KIND_ICON: Record<WebExperienceRow['kind'], typeof Globe2> = {
  page: Globe2, form: FileEdit, funnel: TrendingUp, experiment: FlaskConical, tracking_event: LineChart,
}
const KIND_TINT: Record<WebExperienceRow['kind'], string> = {
  page: 'bg-blue-50 text-blue-600', form: 'bg-violet-50 text-violet-600', funnel: 'bg-emerald-50 text-emerald-600',
  experiment: 'bg-amber-50 text-amber-600', tracking_event: 'bg-sky-50 text-sky-600',
}

/** Card-view counterpart to WebExperiencesTable — same rows, grid layout. */
export default function WebExperienceCards({
  rows, emptyMessage,
}: { rows: WebExperienceRow[]; emptyMessage?: string }) {
  if (rows.length === 0) {
    return (
      <WebEmpty
        bare
        title="No web experiences yet"
        message={emptyMessage ?? 'Create your first page, form or funnel to start tracking traffic, conversions and experiments here.'}
      />
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(row => {
        const Icon = KIND_ICON[row.kind]
        return (
          <Link
            key={`${row.kind}-${row.id}`} href={row.href}
            className={cn(CARD, CARD_SHADOW, 'flex flex-col gap-3 p-3.5 transition-colors hover:border-blue-200')}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', KIND_TINT[row.kind])}>
                  <Icon size={14} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-slate-900">{row.name}</p>
                  <p className="truncate text-[11px] text-slate-400">{row.subLabel}</p>
                </div>
              </div>
              <Badge variant={row.statusBadge}>{row.statusLabel}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[15px] font-bold text-slate-900">{formatCompactNumber(row.traffic)}</p>
                <p className="text-[10px] text-slate-400">Traffic</p>
              </div>
              <div>
                <p className="text-[15px] font-bold text-slate-900">{formatCompactNumber(row.conversions)}</p>
                <p className="text-[10px] text-slate-400">Conversions</p>
              </div>
              <div>
                <p className="text-[15px] font-bold text-slate-900">{formatPercentValue(row.conversionRate)}</p>
                <p className="text-[10px] text-slate-400">Conv. rate</p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
              <span>{row.typeLabel} · {row.ownerName ?? 'Unassigned'}</span>
              <span>{formatShortDate(row.updatedAt)}</span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
