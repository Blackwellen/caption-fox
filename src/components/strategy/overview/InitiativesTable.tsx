import Link from 'next/link'
import { MoreHorizontal, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { initiativeHealth } from '@/lib/strategy/overview'
import { formatDate, shortName } from '@/lib/strategy/format'
import { strategyPath } from '@/lib/strategy/constants'
import type { PlanRow } from '@/lib/strategy/types'
import { Avatar, TableScroll } from '../primitives'

const STATUS: Record<string, { label: string; tone: string; bar: string }> = {
  on_track: { label: 'On track', tone: 'bg-emerald-100/70 text-emerald-700', bar: 'bg-emerald-500' },
  at_risk: { label: 'At risk', tone: 'bg-orange-100/70 text-orange-600', bar: 'bg-emerald-500' },
  off_track: { label: 'Off track', tone: 'bg-red-100/70 text-red-600', bar: 'bg-red-500' },
  not_started: { label: 'Not started', tone: 'bg-slate-100 text-slate-500', bar: 'bg-slate-300' },
  completed: { label: 'Completed', tone: 'bg-sg-blue-soft text-sg-blue', bar: 'bg-sg-blue' },
}
const HEALTH = {
  good: { label: 'Good', tone: 'bg-emerald-100/70 text-emerald-700' },
  fair: { label: 'Fair', tone: 'bg-orange-100/70 text-orange-600' },
  poor: { label: 'Poor', tone: 'bg-red-100/70 text-red-600' },
  none: { label: 'Not started', tone: 'bg-slate-100 text-slate-500' },
}

const TH = 'whitespace-nowrap py-2 pr-3 text-left text-[11px] font-normal text-sg-body lg:py-[7px] lg:text-[9.5px]'
const TD = 'whitespace-nowrap py-2.5 pr-3 text-[12.5px] text-sg-body lg:py-0 lg:text-[10px]'

/** Plans are the initiatives that deliver strategy; every row links into Plans. */
export default function InitiativesTable({ kind, rows }: { kind: string; rows: PlanRow[] }) {
  return (
    <TableScroll label="Priority initiatives">
      <table className="w-full min-w-[860px] table-fixed border-collapse">
        <caption className="sr-only">Priority initiatives</caption>
        <colgroup>
          <col className="w-[21%]" /><col className="w-[14%]" /><col className="w-[11%]" /><col className="w-[8.5%]" />
          <col className="w-[13.5%]" /><col className="w-[7%]" /><col className="w-[14%]" /><col className="w-[9%]" /><col className="w-[2%]" />
        </colgroup>
        <thead>
          <tr>
            {['Initiative', 'Strategy', 'Owner', 'Status', 'Progress', 'Health', 'Target', 'Due date'].map(label => (
              <th key={label} scope="col" className={TH}>{label}</th>
            ))}
            <th scope="col" className={TH}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const status = STATUS[row.status] ?? STATUS.not_started
            const health = HEALTH[initiativeHealth(row)]
            const href = strategyPath(kind, 'plans', row.id)
            return (
              <tr key={row.id} className="h-12 border-t border-sg-line-soft first:border-t-0 lg:h-9">
                <td className={TD}>
                  <Link href={href} className="flex min-w-0 items-center gap-2 font-medium text-sg-ink hover:underline lg:gap-[13px] lg:font-normal">
                    <Target aria-hidden className="h-3.5 w-3.5 shrink-0 text-sg-blue lg:h-3 lg:w-3" />
                    <span className="truncate">{row.name}</span>
                  </Link>
                </td>
                <td className={cn(TD, 'truncate')}>{row.strategy?.name ?? '—'}</td>
                <td className={TD}>
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar person={row.owner} size={20} />
                    <span className="truncate">{shortName(row.owner?.full_name ?? row.owner?.email)}</span>
                  </span>
                </td>
                <td className={TD}><span className={cn('inline-flex h-5 items-center rounded px-1.5 text-[11px] font-medium lg:h-[20px] lg:px-[7px] lg:text-[9px]', status.tone)}>{status.label}</span></td>
                <td className={TD}>
                  <span className="flex items-center gap-2.5 lg:gap-[12px]">
                    <span className="h-1.5 w-[72px] overflow-hidden rounded-full bg-slate-100 lg:h-[5px] lg:w-[88px]" role="progressbar" aria-valuenow={row.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${row.name} progress`}>
                      <span className={cn('block h-full rounded-full', status.bar)} style={{ width: `${row.progress}%` }} />
                    </span>
                    <span className="tabular-nums">{row.progress}%</span>
                  </span>
                </td>
                <td className={TD}><span className={cn('inline-flex h-5 items-center rounded px-1.5 text-[11px] font-medium lg:h-[20px] lg:px-[7px] lg:text-[9px]', health.tone)}>{health.label}</span></td>
                <td className={cn(TD, 'truncate')} title={row.target_summary ?? undefined}>{row.target_summary ?? '—'}</td>
                <td className={TD}>{formatDate(row.end_date)}</td>
                <td className={cn(TD, 'pr-0 text-right')}>
                  <Link href={href} aria-label={`Open ${row.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-100 lg:h-5 lg:w-5">
                    <MoreHorizontal aria-hidden className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </TableScroll>
  )
}
