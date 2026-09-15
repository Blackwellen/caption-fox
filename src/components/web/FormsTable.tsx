import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { FORM_STATUS_BADGE, FORM_STATUS_LABELS, FORM_TYPE_LABELS } from '@/lib/web/constants'
import { OwnerChip, formatCompactNumber, formatPercentValue, formatShortDate } from './primitives'
import { WebEmpty } from './states'
import type { FormRow } from '@/lib/web/types'

export default function FormsTable({ rows }: { rows: FormRow[] }) {
  if (rows.length === 0) {
    return <WebEmpty bare title="No forms yet" message="Create your first form to start capturing submissions here." />
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2.5 font-medium">Name</th>
            <th className="px-3 py-2.5 font-medium">Type</th>
            <th className="px-3 py-2.5 font-medium">Owner</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Submissions</th>
            <th className="px-3 py-2.5 font-medium">Completion rate</th>
            <th className="px-3 py-2.5 font-medium">Destination</th>
            <th className="px-3 py-2.5 font-medium">Last updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-3 py-2.5">
                <Link href={`/app/web/forms/${row.id}`} className="truncate font-medium text-slate-900 hover:text-blue-600">{row.name}</Link>
              </td>
              <td className="px-3 py-2.5 text-slate-600">{FORM_TYPE_LABELS[row.form_type]}</td>
              <td className="px-3 py-2.5"><OwnerChip person={row.owner} /></td>
              <td className="px-3 py-2.5"><Badge variant={FORM_STATUS_BADGE[row.status]}>{FORM_STATUS_LABELS[row.status]}</Badge></td>
              <td className="px-3 py-2.5 font-medium text-slate-900">{formatCompactNumber(row.submissions_count)}</td>
              <td className="px-3 py-2.5 text-slate-600">{formatPercentValue(row.submissions_count > 0 ? (row.completed_count / row.submissions_count) * 100 : 0)}</td>
              <td className="px-3 py-2.5 text-slate-500">{row.destination_label ?? '—'}</td>
              <td className="px-3 py-2.5 text-slate-500">{formatShortDate(row.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
