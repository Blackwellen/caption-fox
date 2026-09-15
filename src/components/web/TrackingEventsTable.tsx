import { Badge } from '@/components/ui/Badge'
import { TRACKING_HEALTH_BADGE, TRACKING_HEALTH_LABELS } from '@/lib/web/constants'
import { OwnerChip, formatCompactNumber, formatShortDate } from './primitives'
import { WebEmpty } from './states'
import type { TrackingEventRow } from '@/lib/web/types'

export default function TrackingEventsTable({ rows }: { rows: TrackingEventRow[] }) {
  if (rows.length === 0) {
    return <WebEmpty bare title="No tracking events yet" message="Create an event, or send one to /api/web/tracking/collect, to see it here." />
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2.5 font-medium">Event name</th>
            <th className="px-3 py-2.5 font-medium">Source</th>
            <th className="px-3 py-2.5 font-medium">Owner</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Volume</th>
            <th className="px-3 py-2.5 font-medium">Last received</th>
            <th className="px-3 py-2.5 font-medium">Coverage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-3 py-2.5">
                <p className="font-medium text-slate-900">{row.event_name}</p>
                <p className="text-[11px] text-slate-400 capitalize">{row.event_category}</p>
              </td>
              <td className="px-3 py-2.5 text-slate-600 capitalize">{row.source}</td>
              <td className="px-3 py-2.5"><OwnerChip person={row.owner} /></td>
              <td className="px-3 py-2.5"><Badge variant={TRACKING_HEALTH_BADGE[row.status]}>{TRACKING_HEALTH_LABELS[row.status]}</Badge></td>
              <td className="px-3 py-2.5 font-medium text-slate-900">{formatCompactNumber(row.volume)}</td>
              <td className="px-3 py-2.5 text-slate-500">{row.last_received_at ? formatShortDate(row.last_received_at) : 'Never'}</td>
              <td className="px-3 py-2.5">
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, row.coverage_percent)}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
