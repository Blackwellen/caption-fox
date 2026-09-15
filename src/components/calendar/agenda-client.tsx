'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ListChecks, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CalendarContext } from '@/lib/calendar/entitlements'
import { canAccessCalendarCapability } from '@/lib/calendar/entitlements'
import type { CalendarLookups } from '@/lib/calendar/types'
import { createAgendaTask } from '@/lib/calendar/actions'
import { CalendarModal, DialogField, NewScheduleItemDialog, dialogInputClass } from './dialogs'
import { T } from './primitives'

function CreateTaskDialog({
  ctx, lookups, onClose,
}: { ctx: CalendarContext; lookups: CalendarLookups; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const requestId = useRef(crypto.randomUUID())

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    setErrors({}); setFormError(null)
    startTransition(async () => {
      const result = await createAgendaTask({
        basePath: ctx.basePath,
        title: String(form.get('title') ?? ''),
        description: String(form.get('description') ?? ''),
        campaignId: String(form.get('campaignId') ?? ''),
        dueDate: String(form.get('dueDate') ?? ''),
        dueTime: String(form.get('dueTime') ?? ''),
        priority: (String(form.get('priority') ?? 'medium') as 'low' | 'medium' | 'high' | 'urgent'),
        assignedTo: String(form.get('assignedTo') ?? ''),
        requestId: requestId.current,
      })
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        setFormError(result.error ?? 'Could not create this task.')
        return
      }
      router.refresh()
      onClose()
    })
  }

  const noCampaigns = lookups.campaigns.length === 0

  return (
    <CalendarModal
      title="Create task"
      description="Tasks appear on the agenda, the campaign they belong to, and in Work."
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cn('h-9 rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50', T.focus)}>Cancel</button>
          <button type="submit" form="create-task" disabled={pending || noCampaigns}
            className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60', T.focus)}>
            {pending && <Loader2 size={14} className="animate-spin" />}{pending ? 'Creating…' : 'Create task'}
          </button>
        </>
      }
    >
      {noCampaigns ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-800">
          Tasks belong to a campaign. Create a campaign first, then come back to add tasks to it.
        </p>
      ) : (
        <form id="create-task" onSubmit={submit} className="space-y-4">
          {formError && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />{formError}
            </p>
          )}
          <DialogField label="Task title" required error={errors.title}>
            <input name="title" required maxLength={180} className={dialogInputClass} placeholder="e.g. Review ad creative" />
          </DialogField>
          <DialogField label="Campaign" required error={errors.campaignId}>
            <select name="campaignId" required defaultValue="" className={dialogInputClass}>
              <option value="" disabled>Choose a campaign</option>
              {lookups.campaigns.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </DialogField>
          <div className="grid gap-4 sm:grid-cols-2">
            <DialogField label="Due date" required error={errors.dueDate}>
              <input type="date" name="dueDate" required className={dialogInputClass} />
            </DialogField>
            <DialogField label="Due time">
              <input type="time" name="dueTime" defaultValue="17:00" className={dialogInputClass} />
            </DialogField>
            <DialogField label="Priority">
              <select name="priority" defaultValue="medium" className={dialogInputClass}>
                <option value="low">Low</option><option value="medium">Medium</option>
                <option value="high">High</option><option value="urgent">Urgent</option>
              </select>
            </DialogField>
            <DialogField label="Assign to">
              <select name="assignedTo" defaultValue="" className={dialogInputClass}>
                <option value="">Me</option>
                {lookups.owners.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </DialogField>
          </div>
          <DialogField label="Description">
            <textarea name="description" rows={2} maxLength={2000} className={cn(dialogInputClass, 'h-auto py-2')} />
          </DialogField>
        </form>
      )}
    </CalendarModal>
  )
}

export function AgendaPrimaryActions({ ctx, lookups }: { ctx: CalendarContext; lookups: CalendarLookups }) {
  const [dialog, setDialog] = useState<'item' | 'task' | null>(null)
  const canCreateItem = canAccessCalendarCapability(ctx, 'calendar.create')
  const canCreateTask = canAccessCalendarCapability(ctx, 'agenda.create')

  return (
    <>
      {canCreateItem && (
        <button type="button" onClick={() => setDialog('item')}
          className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700', T.focus)}>
          <Plus size={15} />Add agenda item
        </button>
      )}
      {canCreateTask && (
        <button type="button" onClick={() => setDialog('task')}
          className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50', T.focus)}>
          <ListChecks size={14} />Create task
        </button>
      )}
      {dialog === 'item' && <NewScheduleItemDialog ctx={ctx} lookups={lookups} onClose={() => setDialog(null)} />}
      {dialog === 'task' && <CreateTaskDialog ctx={ctx} lookups={lookups} onClose={() => setDialog(null)} />}
    </>
  )
}
