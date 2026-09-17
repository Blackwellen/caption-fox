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

/** Cards rendered per column before the "+N more" link. */
const VISIBLE_PER_COLUMN = 4

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
        <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[11.5px] font-medium text-rose-700">
          {error}
        </p>
      )}

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map(column => {
          const columnTasks = optimistic.filter(task => task.status === column.id)
          // The board is a working surface, not an archive: show the top of each
          // column and send bulk work to the table view. Rendering every task
          // made the page ~9,000px tall.
          const visible = columnTasks.slice(0, VISIBLE_PER_COLUMN)
          const hidden = columnTasks.length - visible.length
          return (
            <section
              key={column.id}
              onDragOver={event => { if (dragging) event.preventDefault() }}
              onDrop={event => {
                event.preventDefault()
                if (dragging) { move(dragging, column.id); setDragging(null) }
              }}
              className="flex min-h-[220px] min-w-0 flex-col rounded-lg border border-slate-100 bg-slate-50/60"
              aria-label={`${column.label}, ${columnTasks.length} tasks`}
            >
              <header className="flex items-center justify-between px-2.5 py-2">
                <h3 className={cn('truncate text-[10px] font-semibold', column.accent)}>{column.label}</h3>
                <span className="text-[10px] font-medium text-slate-600">{columnTasks.length}</span>
              </header>

              <ul className="flex-1 space-y-1.5 px-1.5 pb-1.5">
                {visible.map(task => (
                  <li key={task.id}>
                    <article
                      draggable={canManage}
                      onDragStart={() => setDragging(task.id)}
                      onDragEnd={() => setDragging(null)}
                      className={cn(
                        'rounded-md border border-slate-200 bg-white px-2 py-1.5',
                        canManage && 'cursor-grab active:cursor-grabbing',
                        dragging === task.id && 'opacity-50',
                      )}
                    >
                      <p className="line-clamp-2 text-[10px] font-medium leading-snug text-slate-900" title={task.title}>{task.title}</p>
                      {task.eventName && (
                        <p className="mt-0.5 truncate text-[9.5px] text-slate-500">{task.eventName}</p>
                      )}
                      <div className="mt-1.5 flex items-center justify-between gap-1">
                        <span className={cn(
                          'inline-flex items-center gap-1 whitespace-nowrap text-[9.5px]',
                          task.due_at && new Date(task.due_at) < new Date() && task.status !== 'completed'
                            ? 'font-semibold text-rose-600' : 'text-slate-500',
                        )}>
                          <CalendarDays size={10} aria-hidden />
                          {formatEventDate(task.due_at, timezone)}
                        </span>
                        {task.ownerName
                          ? <Avatar name={task.ownerName} src={task.ownerAvatarUrl} size={18} />
                          : <span className="text-[10px] text-slate-400">Unassigned</span>}
                      </div>

                      {canManage && (
                        <div className="mt-1.5">
                          <label htmlFor={`task-status-${task.id}`} className="sr-only">
                            Status for {task.title}
                          </label>
                          <select
                            id={`task-status-${task.id}`}
                            value={task.status}
                            onChange={event => move(task.id, event.target.value as FollowUpTaskStatus)}
                            className="-ml-1 h-6 w-full cursor-pointer rounded-md border border-transparent bg-transparent px-1 text-[10px] font-medium text-slate-400 hover:border-slate-200 hover:text-slate-600 focus:border-blue-500 focus:text-slate-700 focus:outline-none"
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
                  <li className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-[10.5px] text-slate-400">
                    Nothing here yet
                  </li>
                )}

                {hidden > 0 && (
                  <li>
                    <Link
                      href={`${basePath}/follow-up?view=table&status=${column.id}`}
                      className="block rounded-md border border-dashed border-slate-200 px-2 py-1.5 text-center text-[10px] font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700"
                    >
                      +{hidden} more
                    </Link>
                  </li>
                )}
              </ul>

              {canManage && <AddTask status={column.id} routeSegment={routeSegment} />}
            </section>
          )
        })}
      </div>

      <p className="mt-3 text-[10.5px] text-slate-400">
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
        className="py-2 text-[10px] font-semibold text-blue-600 hover:bg-white hover:text-blue-700"
      >
        <span className="inline-flex items-center gap-1"><Plus size={11} aria-hidden /> Add Task</span>
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
        className="h-8 w-full rounded-md border border-slate-200 px-2 text-[11px] focus:border-blue-500 focus:outline-none"
      />
      {error && <p role="alert" className="mt-1 text-[10px] text-rose-600">{error}</p>}
      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !title.trim()}
          className="rounded-md bg-blue-600 px-2.5 py-1 text-[10.5px] font-semibold text-white disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setTitle('') }}
          className="rounded-md px-2 py-1 text-[10.5px] text-slate-500 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
