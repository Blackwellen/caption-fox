'use client'

import { useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import { CalendarDays, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from './EventsShell'
import { createFollowUpTask, moveFollowUpTask } from '@/lib/events/actions'
import { formatEventDate } from '@/lib/events/format'
import type { FollowUpTaskStatus, FollowUpTaskWithRelations } from '@/lib/events/types'

/**
 * Follow-up task board.
 *
 * Drag-and-drop is the fast path; every card also carries a status menu so the
 * board is fully operable by keyboard and on touch. Moves are optimistic and
 * roll back if the server rejects them (permission, wrong workspace, gone).
 */

const COLUMNS: { id: FollowUpTaskStatus; label: string; accent: string }[] = [
  { id: 'not_started', label: 'Not Started', accent: 'text-slate-600' },
  { id: 'in_progress', label: 'In Progress', accent: 'text-blue-600' },
  { id: 'waiting', label: 'Waiting', accent: 'text-amber-600' },
  { id: 'completed', label: 'Completed', accent: 'text-emerald-600' },
]

export default function FollowUpBoard({
  tasks, routeSegment, basePath, timezone, canManage,
}: {
  tasks: FollowUpTaskWithRelations[]
  routeSegment: string
  basePath: string
  timezone: string
  canManage: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [optimistic, applyOptimistic] = useOptimistic(
    tasks,
    (state: FollowUpTaskWithRelations[], move: { id: string; status: FollowUpTaskStatus }) =>
      state.map(task => (task.id === move.id ? { ...task, status: move.status } : task)),
  )
  const [dragging, setDragging] = useState<string | null>(null)

  function move(taskId: string, status: FollowUpTaskStatus) {
    if (!canManage) {
      setError('Your role cannot change follow-up tasks.')
      return
    }
    setError(null)
    startTransition(async () => {
      applyOptimistic({ id: taskId, status })
      const result = await moveFollowUpTask(routeSegment, taskId, status)
      // A failure leaves the optimistic state to be discarded on the next render,
      // so the card visibly returns to its original column.
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-700">
          {error}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map(column => {
          const columnTasks = optimistic.filter(task => task.status === column.id)
          return (
            <section
              key={column.id}
              onDragOver={event => { if (dragging) event.preventDefault() }}
              onDrop={event => {
                event.preventDefault()
                if (dragging) { move(dragging, column.id); setDragging(null) }
              }}
              className="flex min-h-[220px] flex-col rounded-xl border border-slate-200 bg-white"
              aria-label={`${column.label}, ${columnTasks.length} tasks`}
            >
              <header className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2.5">
                <h3 className={cn('text-[12.5px] font-semibold', column.accent)}>{column.label}</h3>
                <span className="text-[11.5px] font-semibold text-slate-400">{columnTasks.length}</span>
              </header>

              <ul className="flex-1 space-y-2 p-2.5">
                {columnTasks.map(task => (
                  <li key={task.id}>
                    <article
                      draggable={canManage}
                      onDragStart={() => setDragging(task.id)}
                      onDragEnd={() => setDragging(null)}
                      className={cn(
                        'rounded-lg border border-slate-200 bg-white p-2.5',
                        canManage && 'cursor-grab active:cursor-grabbing',
                        dragging === task.id && 'opacity-50',
                      )}
                    >
                      <p className="text-[12.5px] font-semibold leading-snug text-slate-900">{task.title}</p>
                      {task.eventName && (
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">{task.eventName}</p>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className={cn(
                          'inline-flex items-center gap-1 text-[11px]',
                          task.due_at && new Date(task.due_at) < new Date() && task.status !== 'completed'
                            ? 'font-semibold text-rose-600' : 'text-slate-500',
                        )}>
                          <CalendarDays size={11} aria-hidden />
                          {formatEventDate(task.due_at, timezone)}
                        </span>
                        {task.ownerName
                          ? <Avatar name={task.ownerName} src={task.ownerAvatarUrl} size={22} />
                          : <span className="text-[11px] text-slate-400">Unassigned</span>}
                      </div>

                      {canManage && (
                        <div className="mt-2">
                          <label htmlFor={`task-status-${task.id}`} className="sr-only">
                            Status for {task.title}
                          </label>
                          <select
                            id={`task-status-${task.id}`}
                            value={task.status}
                            onChange={event => move(task.id, event.target.value as FollowUpTaskStatus)}
                            className="h-7 w-full rounded-md border border-slate-200 bg-white px-1.5 text-[11px] text-slate-600 focus:border-blue-500 focus:outline-none"
                          >
                            {COLUMNS.map(option => (
                              <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      )}
                    </article>
                  </li>
                ))}

                {columnTasks.length === 0 && (
                  <li className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-[11.5px] text-slate-400">
                    Nothing here yet
                  </li>
                )}
              </ul>

              {canManage && <AddTask status={column.id} routeSegment={routeSegment} />}
            </section>
          )
        })}
      </div>

      <p className="mt-3 text-[11.5px] text-slate-400">
        Drag a card between columns, or use the status menu on each card.{' '}
        <Link href={`${basePath}/follow-up?view=table`} className="font-semibold text-blue-600">
          Open the table view
        </Link>{' '}
        for bulk work.
      </p>
    </div>
  )
}

function AddTask({ status, routeSegment }: { status: FollowUpTaskStatus; routeSegment: string }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function submit() {
    if (!title.trim()) return
    startTransition(async () => {
      const result = await createFollowUpTask(routeSegment, { title, status })
      if (!result.ok) { setError(result.error); return }
      setTitle(''); setOpen(false); setError(null)
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-t border-slate-100 py-2.5 text-[12px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700"
      >
        <span className="inline-flex items-center gap-1"><Plus size={13} aria-hidden /> Add Task</span>
      </button>
    )
  }

  return (
    <div className="border-t border-slate-100 p-2.5">
      <label htmlFor={`new-task-${status}`} className="sr-only">New task title</label>
      <input
        id={`new-task-${status}`}
        autoFocus
        value={title}
        onChange={event => setTitle(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') submit()
          if (event.key === 'Escape') { setOpen(false); setTitle('') }
        }}
        placeholder="Follow up with…"
        className="h-8 w-full rounded-md border border-slate-200 px-2 text-[12px] focus:border-blue-500 focus:outline-none"
      />
      {error && <p role="alert" className="mt-1 text-[11px] text-rose-600">{error}</p>}
      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !title.trim()}
          className="rounded-md bg-blue-600 px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setTitle('') }}
          className="rounded-md px-2 py-1 text-[11.5px] text-slate-500 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
