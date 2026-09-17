import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Dense data table from the Messaging designs: light header row, 39px rows,
// hairline separators, horizontal scroll contained inside the card on small screens.

export interface Column<Row> {
  key: string
  header: ReactNode
  cell: (row: Row) => ReactNode
  className?: string
  headClassName?: string
}

export function DataTable<Row extends { id: string }>({
  caption, columns, rows, empty, rowClassName, minWidth = 860,
}: {
  caption: string
  columns: Column<Row>[]
  rows: Row[]
  empty: ReactNode
  rowClassName?: string
  minWidth?: number
}) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-left" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-slate-50/70">
            {columns.map(col => (
              <th key={col.key} scope="col" className={cn('h-8 whitespace-nowrap px-2 text-[11px] font-normal text-slate-400 first:pl-3 last:pr-3 lg:h-[22px] lg:px-[6px] lg:text-[7.5px] lg:first:pl-[10px]', col.headClassName)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-3 py-10 text-center">{empty}</td></tr>
          ) : rows.map(row => (
            <tr key={row.id} className={cn('h-12 hover:bg-slate-50/60 lg:h-[39px]', rowClassName)}>
              {columns.map(col => (
                <td key={col.key} className={cn('px-2 align-middle text-[12px] text-slate-700 first:pl-3 last:pr-3 lg:px-[6px] lg:text-[9px] lg:first:pl-[10px]', col.className)}>{col.cell(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function EmptyRows({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mx-auto max-w-sm">
      <p className="text-[13px] font-semibold text-slate-700 lg:text-[10px]">{title}</p>
      <p className="mt-1 text-[12px] text-slate-500 lg:text-[9px]">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
