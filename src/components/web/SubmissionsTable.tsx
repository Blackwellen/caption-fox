import { formatShortDate } from './primitives'
import { WebEmpty } from './states'
import type { FormField, FormSubmissionRow } from '@/lib/web/types'

export default function SubmissionsTable({ rows, fields }: { rows: FormSubmissionRow[]; fields: FormField[] }) {
  if (rows.length === 0) {
    return <WebEmpty bare title="No submissions yet" message="Once this form is published and someone submits it, entries will appear here." />
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
            {fields.map(f => <th key={f.id} className="px-3 py-2.5 font-medium">{f.label}</th>)}
            <th className="px-3 py-2.5 font-medium">Submitted</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              {fields.map(f => (
                <td key={f.id} className="px-3 py-2.5 text-slate-700">
                  {f.type === 'checkbox' ? (row.data[f.id] ? 'Yes' : 'No') : String(row.data[f.id] ?? '—')}
                </td>
              ))}
              <td className="px-3 py-2.5 text-slate-500">{formatShortDate(row.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
