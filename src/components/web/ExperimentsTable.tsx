import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { EXPERIMENT_STATUS_BADGE, EXPERIMENT_STATUS_LABELS, EXPERIMENT_TYPE_LABELS } from '@/lib/web/constants'
import { computeExperimentStats } from '@/lib/web/data'
import { OwnerChip, formatCompactNumber, formatShortDate, formatSignedPercent } from './primitives'
import { WebEmpty } from './states'
import type { ExperimentRow } from '@/lib/web/types'

export default function ExperimentsTable({ rows }: { rows: ExperimentRow[] }) {
  if (rows.length === 0) {
    return <WebEmpty bare title="No experiments yet" message="Create your first experiment to start running A/B tests here." />
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2.5 font-medium">Name</th>
            <th className="px-3 py-2.5 font-medium">Surface</th>
            <th className="px-3 py-2.5 font-medium">Owner</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Traffic</th>
            <th className="px-3 py-2.5 font-medium">Conversions</th>
            <th className="px-3 py-2.5 font-medium">Uplift</th>
            <th className="px-3 py-2.5 font-medium">Confidence</th>
            <th className="px-3 py-2.5 font-medium">Last updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const stats = computeExperimentStats(row.control_visitors, row.control_conversions, row.variant_visitors, row.variant_conversions)
            const traffic = row.control_visitors + row.variant_visitors
            const conversions = row.control_conversions + row.variant_conversions
            return (
              <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="px-3 py-2.5">
                  <Link href={`/app/web/experiments/${row.id}`} className="truncate font-medium text-slate-900 hover:text-blue-600">{row.name}</Link>
                </td>
                <td className="px-3 py-2.5 text-slate-600">{EXPERIMENT_TYPE_LABELS[row.experiment_type]}{row.surface_ref ? ` · ${row.surface_ref}` : ''}</td>
                <td className="px-3 py-2.5"><OwnerChip person={row.owner} /></td>
                <td className="px-3 py-2.5"><Badge variant={EXPERIMENT_STATUS_BADGE[row.status]}>{EXPERIMENT_STATUS_LABELS[row.status]}</Badge></td>
                <td className="px-3 py-2.5 font-medium text-slate-900">{formatCompactNumber(traffic)}</td>
                <td className="px-3 py-2.5 text-slate-600">{formatCompactNumber(conversions)}</td>
                <td className="px-3 py-2.5 text-slate-600">{formatSignedPercent(stats.upliftPercent)}</td>
                <td className="px-3 py-2.5 text-slate-600">{stats.hasEnoughData ? `${stats.confidencePercent.toFixed(0)}%` : '—'}</td>
                <td className="px-3 py-2.5 text-slate-500">{formatShortDate(row.updated_at)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
