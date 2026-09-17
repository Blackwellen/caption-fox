'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download, MoreVertical, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  eventLocationLabel, eventTypeLabel, formatEventDate, formatNumber, formatRate,
} from '@/lib/events/format'
import type { EventWithStats } from '@/lib/events/types'
import { StatusBadge } from './primitives'
import { Avatar } from './EventsShell'

/**
 * Events table with row selection.
 *
 * Selection exists to drive a real action — "Export selected" hits the same
 * permission-gated export endpoint with the chosen ids, which the server
 * applies *on top of* workspace scope. There is no decorative checkbox here:
 * if a role cannot export, the bulk bar does not offer it.
 */
export default function EventsTableSelect({
  events, basePath, timezone, routeSegment, canExport,
}: {
  events: EventWithStats[]
  basePath: string
  timezone: string
  routeSegment: string
  canExport: boolean
}) {
  const params = useSearchParams()
  const [selected, setSelected] = useState<string[]>([])

  const allOnPage = useMemo(() => events.map(event => event.id), [events])
  const allSelected = allOnPage.length > 0 && allOnPage.every(id => selected.includes(id))

  function toggle(id: string) {
    setSelected(current => current.includes(id) ? current.filter(v => v !== id) : [...current, id])
  }

  function toggleAll() {
    setSelected(allSelected ? [] : allOnPage)
  }

  const exportHref = `/api/events/export?resource=events&workspaceType=${routeSegment}`
    + `&${params.toString()}&ids=${selected.join(',')}`

  return (
    <div>
      {selected.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-3 border-b border-blue-100 bg-blue-50/70 px-4 py-2.5"
          role="status"
        >
          <span className="text-[11.5px] font-semibold text-blue-900">
            {selected.length} selected
          </span>
          {canExport && (
            <a
              href={exportHref}
              download
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
            >
              <Download size={13} aria-hidden />
              Export selected
            </a>
          )}
          <button
            type="button"
            onClick={() => setSelected([])}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-800 hover:text-blue-950"
          >
            <X size={13} aria-hidden />
            Clear selection
          </button>
        </div>
      )}

      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[700px] table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[38px]" />
            <col />
            <col className="w-[68px]" />
            <col className="w-[76px]" />
            <col className="w-[96px]" />
            <col className="w-[80px]" />
            <col className="w-[80px]" />
            <col className="w-[76px]" />
            <col className="w-[44px]" />
            <col className="w-[34px]" />
          </colgroup>
          <caption className="sr-only">Events in this workspace</caption>
          <thead>
            <tr className="border-b border-slate-100 text-[10px] font-medium text-slate-500">
              <th scope="col" className="py-3 pl-3.5 pr-1">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label={allSelected ? 'Clear selection' : 'Select all events on this page'}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th scope="col" className="px-2 py-3 font-medium">Event Name</th>
              <th scope="col" className="px-2 py-3 font-medium">Type</th>
              <th scope="col" className="px-2 py-3 font-medium">Date</th>
              <th scope="col" className="px-2 py-3 font-medium">Location</th>
              <th scope="col" className="px-2 py-3 font-medium">Status</th>
              <th scope="col" className="px-2 py-3 font-medium">Registrations</th>
              <th scope="col" className="px-2 py-3 font-medium">Attendance</th>
              <th scope="col" className="px-2 py-3 font-medium">Owner</th>
              <th scope="col" className="py-3 pr-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.map(event => {
              const checked = selected.includes(event.id)
              const href = `${basePath}/events/${event.id}`
              return (
                <tr
                  key={event.id}
                  className={cn('h-[41px] text-[10.5px] text-slate-700 hover:bg-slate-50/70', checked && 'bg-blue-50/40')}
                >
                  <td className="py-2 pl-3.5 pr-1">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(event.id)}
                      aria-label={`Select ${event.name}`}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <th scope="row" className="px-2 py-2 text-left font-normal">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Link href={href} className="truncate text-slate-800 hover:text-blue-700" title={event.name}>
                        {event.name}
                      </Link>
                      {event.galaDockLinked && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" title="Linked to Gala Dock">
                          <span className="sr-only">Linked to Gala Dock</span>
                        </span>
                      )}
                    </span>
                  </th>
                  <td className="truncate px-2 py-2">{eventTypeLabel(event.event_type)}</td>
                  <td className="whitespace-nowrap px-2 py-2">
                    {formatEventDate(event.start_at, event.timezone || timezone)}
                  </td>
                  <td className="truncate px-2 py-2" title={eventLocationLabel(event)}>{eventLocationLabel(event)}</td>
                  <td className="px-2 py-2">
                    <StatusBadge status={event.status} dot={event.status === 'live'} className="px-1.5 py-[2px] text-[10px]" />
                  </td>
                  <td className="px-2 py-2 tabular-nums">{formatNumber(event.registrations)}</td>
                  <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                    {event.attended
                      ? `${formatNumber(event.attended)} (${formatRate(event.attendanceRate, 0)})`
                      : '—'}
                  </td>
                  <td className="px-2 py-2">
                    <Avatar name={event.ownerName ?? 'Unassigned'} src={event.ownerAvatarUrl} size={24} />
                    <span className="sr-only">{event.ownerName ?? 'Unassigned'}</span>
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <Link
                      href={`${href}#actions`}
                      className="inline-flex rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      aria-label={`Actions for ${event.name}`}
                    >
                      <MoreVertical size={14} />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
