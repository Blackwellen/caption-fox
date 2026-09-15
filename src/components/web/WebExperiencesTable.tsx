import Link from 'next/link'
import { FileEdit, FlaskConical, Globe2, LineChart, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { formatCompactNumber, formatPercentValue, formatShortDate } from './primitives'
import { WebEmpty } from './states'
import type { WebExperienceRow } from '@/lib/web/types'

const KIND_ICON: Record<WebExperienceRow['kind'], typeof Globe2> = {
  page: Globe2, form: FileEdit, funnel: TrendingUp, experiment: FlaskConical, tracking_event: LineChart,
}
const KIND_TINT: Record<WebExperienceRow['kind'], string> = {
  page: 'bg-blue-50 text-blue-600', form: 'bg-violet-50 text-violet-600', funnel: 'bg-emerald-50 text-emerald-600',
  experiment: 'bg-amber-50 text-amber-600', tracking_event: 'bg-sky-50 text-sky-600',
}

/**
 * The mixed pages/forms/funnels/experiments/tracking-events table shown on
 * Overview. Each row's "Type" chip shows which entity it is; detail routes
 * for pages/forms/funnels/experiments/tracking are later Web & Conversion
 * phases, so rows link to the entity's list page rather than a route that
 * does not exist yet.
 */
export default function WebExperiencesTable({
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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2.5 font-medium">Name</th>
            <th className="px-3 py-2.5 font-medium">Type</th>
            <th className="px-3 py-2.5 font-medium">Owner</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Traffic</th>
            <th className="px-3 py-2.5 font-medium">Conversions</th>
            <th className="px-3 py-2.5 font-medium">Conversion rate</th>
            <th className="px-3 py-2.5 font-medium">Last updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const Icon = KIND_ICON[row.kind]
            return (
              <tr key={`${row.kind}-${row.id}`} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="px-3 py-2.5">
                  <Link href={row.href} className="flex items-center gap-2 group">
                    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', KIND_TINT[row.kind])}>
                      <Icon size={13} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900 group-hover:text-blue-600">{row.name}</p>
                      <p className="truncate text-[11px] text-slate-400">{row.subLabel}</p>
                    </div>
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-slate-600">{row.typeLabel}</td>
                <td className="px-3 py-2.5 text-slate-600">{row.ownerName ?? '—'}</td>
                <td className="px-3 py-2.5">
                  <Badge variant={row.statusBadge}>{row.statusLabel}</Badge>
                </td>
                <td className="px-3 py-2.5 font-medium text-slate-900">{formatCompactNumber(row.traffic)}</td>
                <td className="px-3 py-2.5 text-slate-600">{formatCompactNumber(row.conversions)}</td>
                <td className="px-3 py-2.5 text-slate-600">{formatPercentValue(row.conversionRate)}</td>
                <td className="px-3 py-2.5 text-slate-500">{formatShortDate(row.updatedAt)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
