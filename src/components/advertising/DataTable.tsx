import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Shared table for the Advertising module.
//
// Server-rendered: sorting, filtering and paging all happen through URL state
// and the database, so a workspace with 200,000 campaigns loads one page rather
// than shipping the set to the browser. Wide tables scroll inside their own
// container so the page body never scrolls sideways.

export type Column<T> = {
  key: string
  header: string
  /** Right-aligned for numeric columns, as in the reference. */
  align?: 'left' | 'right' | 'center'
  /** Column is sortable; the key is written to ?sort=<key>_asc|_desc */
  sortable?: boolean
  width?: string
  /** Hides the column below the given breakpoint to keep mobile usable. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl'
  render: (row: T) => ReactNode
  /** Screen-reader text when the header is icon-only. */
  srHeader?: string
}

type Props<T> = {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  caption: string
  /** Rendered in place of rows when the set is empty. */
  empty?: ReactNode
  className?: string
  /** Renders a leading selection checkbox column. */
  selectable?: boolean
  footer?: ReactNode
  /** Applied to each row, e.g. to link the whole row. */
  rowClassName?: (row: T) => string | undefined
  dense?: boolean
}

const HIDE_BELOW = {
  sm: 'hidden sm:table-cell', md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell',
} as const

export default function DataTable<T>({
  columns, rows, rowKey, caption, empty, className,
  selectable, footer, rowClassName, dense,
}: Props<T>) {
  return (
    <div className={cn('min-w-0', className)}>
      {/* The only horizontal scroll on the page lives here, not on <body>. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-slate-200">
              {selectable && (
                <th scope="col" className="w-9 px-4 py-2.5">
                  <span className="sr-only">Select</span>
                </th>
              )}
              {columns.map(column => (
                <th
                  key={column.key}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  className={cn(
                    'whitespace-nowrap px-3 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-slate-500',
                    column.align === 'right' && 'text-right',
                    column.align === 'center' && 'text-center',
                    column.hideBelow && HIDE_BELOW[column.hideBelow],
                  )}
                >
                  {column.srHeader ? <span className="sr-only">{column.srHeader}</span> : column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-10">
                  {empty}
                </td>
              </tr>
            ) : rows.map(row => (
              <tr
                key={rowKey(row)}
                className={cn('group transition-colors hover:bg-slate-50/70', rowClassName?.(row))}
              >
                {selectable && (
                  <td className="px-4 py-2.5 align-middle">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                      aria-label="Select row"
                    />
                  </td>
                )}
                {columns.map(column => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-3 align-middle text-[13px] text-slate-700',
                      dense ? 'py-2' : 'py-2.5',
                      column.align === 'right' && 'text-right tabular-nums',
                      column.align === 'center' && 'text-center',
                      column.hideBelow && HIDE_BELOW[column.hideBelow],
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && (
            <tfoot className="border-t border-slate-200 bg-slate-50/60">
              {footer}
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

/** Sortable header link. Server-rendered so it works without JavaScript. */
export function SortLink({
  columnKey, label, currentSort, basePath, searchParams, align,
}: {
  columnKey: string
  label: string
  currentSort: string
  basePath: string
  searchParams: Record<string, string | string[] | undefined>
  align?: 'left' | 'right'
}) {
  const ascending = currentSort === `${columnKey}_asc`
  const active = currentSort.startsWith(`${columnKey}_`)
  const next = ascending ? `${columnKey}_desc` : `${columnKey}_asc`

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'sort' || key === 'page' || value === undefined) continue
    params.set(key, Array.isArray(value) ? value[0] : value)
  }
  params.set('sort', next)

  return (
    <a
      href={`${basePath}?${params.toString()}`}
      className={cn(
        'inline-flex items-center gap-1 rounded hover:text-slate-700',
        align === 'right' && 'flex-row-reverse',
        active && 'text-slate-800',
      )}
      aria-sort={active ? (ascending ? 'ascending' : 'descending') : 'none'}
    >
      {label}
      <span aria-hidden className={cn('text-[9px]', active ? 'opacity-90' : 'opacity-30')}>
        {active ? (ascending ? '▲' : '▼') : '▼'}
      </span>
    </a>
  )
}

/** Right-aligned numeric cell that renders an em dash for a null. */
export function NumericCell({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <span className={cn('tabular-nums', muted && 'text-slate-400')}>{children}</span>
}
