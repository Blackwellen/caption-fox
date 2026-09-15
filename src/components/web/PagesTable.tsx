import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { PAGE_STATUS_BADGE, PAGE_STATUS_LABELS, PAGE_TYPE_LABELS } from '@/lib/web/constants'
import { OwnerChip, formatCompactNumber, formatPercentValue, formatShortDate } from './primitives'
import { WebEmpty } from './states'
import type { PageRow } from '@/lib/web/types'

export default function PagesTable({ rows }: { rows: PageRow[] }) {
  if (rows.length === 0) {
    return <WebEmpty bare title="No pages yet" message="Create your first landing page or microsite to start tracking traffic and conversions here." />
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
            <th className="px-3 py-2.5 font-medium">Traffic</th>
            <th className="px-3 py-2.5 font-medium">Conversions</th>
            <th className="px-3 py-2.5 font-medium">Conversion rate</th>
            <th className="px-3 py-2.5 font-medium">Last updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-3 py-2.5">
                <Link href={`/app/web/pages/${row.id}`} className="group">
                  <p className="truncate font-medium text-slate-900 group-hover:text-blue-600">{row.name}</p>
                  <p className="truncate text-[11px] text-slate-400">/{row.slug}</p>
                </Link>
              </td>
              <td className="px-3 py-2.5 text-slate-600">{PAGE_TYPE_LABELS[row.page_type]}</td>
              <td className="px-3 py-2.5"><OwnerChip person={row.owner} /></td>
              <td className="px-3 py-2.5"><Badge variant={PAGE_STATUS_BADGE[row.status]}>{PAGE_STATUS_LABELS[row.status]}</Badge></td>
              <td className="px-3 py-2.5 font-medium text-slate-900">{formatCompactNumber(row.sessions)}</td>
              <td className="px-3 py-2.5 text-slate-600">{formatCompactNumber(row.conversions)}</td>
              <td className="px-3 py-2.5 text-slate-600">{formatPercentValue(row.sessions > 0 ? (row.conversions / row.sessions) * 100 : 0)}</td>
              <td className="px-3 py-2.5 text-slate-500">{formatShortDate(row.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
