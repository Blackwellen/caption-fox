import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { FUNNEL_STATUS_BADGE, FUNNEL_STATUS_LABELS, FUNNEL_TYPE_LABELS } from '@/lib/web/constants'
import { OwnerChip, formatCompactNumber, formatPercentValue, formatShortDate } from './primitives'
import { WebEmpty } from './states'
import type { FunnelRow } from '@/lib/web/types'

export default function FunnelsTable({ rows }: { rows: FunnelRow[] }) {
  if (rows.length === 0) {
    return <WebEmpty bare title="No funnels yet" message="Create your first funnel to start measuring step-by-step conversion here." />
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2.5 font-medium">Funnel</th>
            <th className="px-3 py-2.5 font-medium">Type</th>
            <th className="px-3 py-2.5 font-medium">Owner</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Entries</th>
            <th className="px-3 py-2.5 font-medium">Conversions</th>
            <th className="px-3 py-2.5 font-medium">Conversion rate</th>
            <th className="px-3 py-2.5 font-medium">Last updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-3 py-2.5">
                <Link href={`/app/web/funnels/${row.id}`} className="truncate font-medium text-slate-900 hover:text-blue-600">{row.name}</Link>
              </td>
              <td className="px-3 py-2.5 text-slate-600">{FUNNEL_TYPE_LABELS[row.funnel_type]}</td>
              <td className="px-3 py-2.5"><OwnerChip person={row.owner} /></td>
              <td className="px-3 py-2.5"><Badge variant={FUNNEL_STATUS_BADGE[row.status]}>{FUNNEL_STATUS_LABELS[row.status]}</Badge></td>
              <td className="px-3 py-2.5 font-medium text-slate-900">{formatCompactNumber(row.entries)}</td>
              <td className="px-3 py-2.5 text-slate-600">{formatCompactNumber(row.conversions)}</td>
              <td className="px-3 py-2.5 text-slate-600">{formatPercentValue(row.entries > 0 ? (row.conversions / row.entries) * 100 : 0)}</td>
              <td className="px-3 py-2.5 text-slate-500">{formatShortDate(row.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
