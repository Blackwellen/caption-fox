'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { Avatar } from './EventsShell'
import { StatusBadge } from './primitives'
import { updateRegistrationStatus } from '@/lib/events/actions'
import { formatEventDate } from '@/lib/events/format'
import type { EventRegistrationRecord, RegistrationStatus } from '@/lib/events/types'

const STATUSES: RegistrationStatus[] = [
  'invited', 'registered', 'confirmed', 'waitlisted', 'checked_in', 'attended', 'no_show', 'cancelled',
]

/**
 * Registration list with a working per-row status action — the same
 * check-in / mark-attended / cancel workflow the KPI cards and attendance
 * rate elsewhere on the site are computed from, so changing a row here
 * is immediately reflected across the module on next load.
 */
export default function RegistrationsTable({
  registrations, routeSegment, timezone, canManage,
}: {
  registrations: EventRegistrationRecord[]
  routeSegment: string
  timezone: string
  canManage: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [rows, applyOptimistic] = useOptimistic(
    registrations,
    (state: EventRegistrationRecord[], update: { id: string; status: RegistrationStatus }) =>
      state.map(row => (row.id === update.id ? { ...row, status: update.status, attended: update.status === 'attended' || update.status === 'checked_in' } : row)),
  )

  function changeStatus(id: string, status: RegistrationStatus) {
    setError(null)
    startTransition(async () => {
      applyOptimistic({ id, status })
      const result = await updateRegistrationStatus(routeSegment, id, status)
      if (!result.ok) setError(result.error)
    })
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center">
        <p className="text-[13px] text-slate-500">No registrations yet.</p>
      </div>
    )
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-700">
          {error}
        </p>
      )}
      <div className="relative overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <caption className="sr-only">Event registrations</caption>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-4 py-3">Contact</th>
              <th scope="col" className="px-3 py-3">Company</th>
              <th scope="col" className="px-3 py-3">Registered</th>
              <th scope="col" className="px-3 py-3">Follow-up</th>
              <th scope="col" className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(row => (
              <tr key={row.id} className="text-[13px] text-slate-700 hover:bg-slate-50/70">
                <th scope="row" className="px-4 py-2.5 text-left font-normal">
                  <span className="flex items-center gap-2.5">
                    <Avatar name={row.full_name} src={row.avatar_url} size={28} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-900">{row.full_name}</span>
                      <span className="block truncate text-[11.5px] text-slate-500">{row.email}</span>
                    </span>
                  </span>
                </th>
                <td className="px-3 py-2.5">{row.company ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{formatEventDate(row.registered_at, timezone)}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge
                    status={row.follow_up_status === 'not_contacted' ? 'not_started' : row.follow_up_status}
                    label={row.follow_up_status.replaceAll('_', ' ')}
                  />
                </td>
                <td className="px-3 py-2.5">
                  {canManage ? (
                    <>
                      <label htmlFor={`reg-status-${row.id}`} className="sr-only">Status for {row.full_name}</label>
                      <select
                        id={`reg-status-${row.id}`}
                        value={row.status}
                        onChange={event => changeStatus(row.id, event.target.value as RegistrationStatus)}
                        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[12px] text-slate-700 focus:border-blue-500 focus:outline-none"
                      >
                        {STATUSES.map(status => (
                          <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <StatusBadge status={row.status} label={row.status.replaceAll('_', ' ')} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
