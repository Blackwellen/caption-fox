import type { ReactNode } from 'react'
import Link from 'next/link'
import type { ProgramRow } from '@/lib/messaging/dashboard'
import { fmtInt, fmtPct } from '@/lib/messaging/metrics'
import { OwnerCell, StatusPill } from './kit'
import { ChannelMix, NameCell, rates, detailHref } from './programs'

const LANES: { key: string; label: string; statuses: string[] }[] = [
  { key: 'draft', label: 'Draft & review', statuses: ['draft', 'pending_approval'] },
  { key: 'scheduled', label: 'Scheduled', statuses: ['scheduled'] },
  { key: 'active', label: 'Active', statuses: ['sending'] },
  { key: 'paused', label: 'Paused', statuses: ['paused'] },
  { key: 'done', label: 'Completed', statuses: ['sent', 'failed', 'cancelled'] },
]

/** Table (default), cards or status board for the same page of programmes. */
export default function ProgramViews({ rows, view, table }: { rows: ProgramRow[]; view: string; table: ReactNode }) {
  if (view === 'cards') {
    return (
      <ul className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map(r => <li key={r.id}><ProgramCard row={r} /></li>)}
        {rows.length === 0 && <li className="col-span-full py-8 text-center text-[12px] text-slate-400">No programs match these filters.</li>}
      </ul>
    )
  }
  if (view === 'board') {
    return (
      <div className="grid grid-cols-1 gap-2 overflow-x-auto p-3 md:grid-cols-5">
        {LANES.map(lane => {
          const items = rows.filter(r => lane.statuses.includes(r.status))
          return (
            <section key={lane.key} aria-label={lane.label} className="min-w-0 rounded-lg bg-slate-50 p-2">
              <h3 className="mb-2 text-[12px] font-semibold text-slate-700 lg:text-[9px]">{lane.label} <span className="text-slate-400">{items.length}</span></h3>
              <ul className="space-y-2">{items.map(r => <li key={r.id}><ProgramCard row={r} /></li>)}</ul>
            </section>
          )
        })}
      </div>
    )
  }
  return <>{table}</>
}

function ProgramCard({ row }: { row: ProgramRow }) {
  const x = rates(row)
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="flex items-start justify-between gap-2"><NameCell row={row} /><StatusPill status={row.status} /></div>
      <dl className="mt-2 grid grid-cols-3 gap-1 text-[11px] lg:text-[8px]">
        <div><dt className="text-slate-400">Sent</dt><dd className="text-slate-800">{fmtInt(row.sent_count)}</dd></div>
        <div><dt className="text-slate-400">Delivery</dt><dd className="text-slate-800">{fmtPct(x.delivery)}</dd></div>
        <div><dt className="text-slate-400">Click</dt><dd className="text-slate-800">{fmtPct(x.click)}</dd></div>
      </dl>
      <div className="mt-2 flex items-center justify-between"><ChannelMix channels={row.channel_mix} /><OwnerCell person={row.owner} /></div>
      <Link href={detailHref(row)} className="sr-only">Open {row.name}</Link>
    </article>
  )
}
