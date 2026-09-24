'use client'

import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ChevronDown, ChevronRight, Diamond, Download, FileSpreadsheet, Maximize2, Minimize2, Minus, MoreHorizontal, MoreVertical, Plus, PlusCircle,
  UserRound, CheckCircle2, Circle,
} from 'lucide-react'
import { openStrategyAssistant } from '../assistant/open'
import { cn } from '@/lib/utils'
import {
  addPlanDependency, addPlanItem, addPlanRisk, assignPlanOwner, createPlan, deletePlanItem, setPlanDates, setPlanStatus, setRiskStatus, updatePlanItem,
} from '@/lib/strategy/actions/plans'
import {
  PLAN_ITEM_STATUSES, PLAN_ITEM_STATUS_LABELS, PLAN_ITEM_TYPES, PLAN_ITEM_TYPE_LABELS, PLAN_STATUS_LABELS, PLAN_TRANSITIONS, PRIORITY_LABELS,
  RISK_LABELS, RISK_LEVELS, STRATEGY_PRIORITIES, type PlanStatus,
} from '@/lib/strategy/constants'
import { ganttOffset, ganttWindow, type GanttScaleId } from '@/lib/strategy/metrics'
import { formatDayMonth, shortName } from '@/lib/strategy/format'
import type { ActionResult } from '@/lib/strategy/action-types'
import type { PersonLite, PlanItemRow, PlanRow } from '@/lib/strategy/types'
import { BUTTON, ICON } from '../buttons'
import { Menu } from '../client/menu'
import { ConfirmDialog, Dialog, DialogButton } from '../client/dialog'
import { FormError, FormGrid, formValues, SelectField, TextArea, TextField } from '../client/fields'
import { useStrategyAction } from '../client/use-action'
import { useQueryPatch } from '../FilterBar'
import { Avatar } from '../primitives'

interface Can { create: boolean; edit: boolean; dependencies: boolean; export: boolean }
interface Option { id: string; name: string }

function useForm(action: (values: Record<string, string>) => Promise<ActionResult>, onDone: () => void) {
  const { run, pending } = useStrategyAction()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await run(() => action(formValues(event.currentTarget)))
    if (result.ok) { setFieldErrors({}); setFormError(null); onDone() }
    else { setFieldErrors(result.fieldErrors ?? {}); setFormError(result.fieldErrors ? null : result.error ?? null) }
  }
  return { submit, pending, fieldErrors, formError }
}

const personOptions = (people: PersonLite[]) => people.map(person => ({ value: person.id, label: person.full_name ?? person.email ?? 'Member' }))

export function PlansHeaderActions({ plans, strategies, people, can }: { plans: Option[]; strategies: Option[]; people: PersonLite[]; can: Can }) {
  const params = useSearchParams()
  const [open, setOpen] = useState<'plan' | 'milestone' | 'owner' | 'dependency' | 'risk' | null>(null)
  const close = () => setOpen(null)
  const plan = useForm(values => createPlan(values), close)
  const milestone = useForm(values => addPlanItem({ ...values, item_type: values.item_type ?? 'milestone' }), close)
  const dependency = useForm(values => addPlanDependency(values), close)
  const risk = useForm(values => addPlanRisk(values), close)
  const [ownerPlans, setOwnerPlans] = useState<string[]>([])
  const owner = useForm(values => assignPlanOwner(ownerPlans, values.owner_id ?? ''), () => { setOwnerPlans([]); close() })
  const exportHref = (format: string) => {
    const qs = new URLSearchParams(params.toString())
    qs.set('module', 'plans'); qs.set('format', format)
    return `/api/strategy/export?${qs}`
  }
  const planOptions = plans.map(item => ({ value: item.id, label: item.name }))

  return (
    <>
      {can.create && <button type="button" className={BUTTON.primary} onClick={() => setOpen('plan')}><PlusCircle aria-hidden className={ICON} /> New plan</button>}
      {can.edit && plans.length > 0 && <button type="button" className={BUTTON.secondary} onClick={() => setOpen('milestone')}><Plus aria-hidden className={ICON} /> Add milestone</button>}
      {can.edit && plans.length > 0 && <button type="button" className={BUTTON.secondary} onClick={() => setOpen('owner')}><UserRound aria-hidden className={ICON} /> Assign owner</button>}
      {can.export && (
        <Menu label="Export" items={[
          { id: 'csv', label: 'Export CSV', description: 'Plans and items in the current filters', icon: <FileSpreadsheet className="h-3.5 w-3.5" />, href: exportHref('csv'), download: true },
          { id: 'json', label: 'Export JSON', icon: <Download className="h-3.5 w-3.5" />, href: exportHref('json'), download: true },
        ]} trigger={({ ref, toggle, open: isOpen, ...aria }) => (
          <button ref={ref} type="button" onClick={toggle} {...aria} className={BUTTON.secondary}>
            <Download aria-hidden className={ICON} /> Export
            <ChevronDown aria-hidden className={cn(ICON, 'ml-2 text-slate-500 transition-transform lg:ml-[9px]', isOpen && 'rotate-180')} />
          </button>
        )} />
      )}
      <Menu label="More actions" items={[
        { id: 'fox-ai', label: 'Ask Fox AI about plans', onSelect: openStrategyAssistant },
        { id: 'dependency', label: 'Add dependency', disabled: !can.dependencies || plans.length < 2, disabledReason: can.dependencies ? 'Needs at least two plans' : 'Your role cannot manage dependencies', onSelect: () => setOpen('dependency') },
        { id: 'risk', label: 'Log a risk', disabled: !can.edit || plans.length === 0, disabledReason: 'Your role cannot log risks', onSelect: () => setOpen('risk') },
        { id: 'archived', label: 'View archived plans', href: '?view=table&archived=1', separatorBefore: true },
      ]} trigger={({ ref, toggle, ...aria }) => (
        <button ref={ref} type="button" onClick={toggle} {...aria} aria-label="More actions" className={BUTTON.icon}><MoreVertical aria-hidden className={ICON} /></button>
      )} />

      <Dialog open={open === 'plan'} onClose={close} busy={plan.pending} size="lg" title="New plan" description="Plans turn strategy into dated, owned delivery."
        footer={<><DialogButton onClick={close}>Cancel</DialogButton><DialogButton variant="primary" type="submit" form="sg-new-plan" disabled={plan.pending}>Create plan</DialogButton></>}>
        <FormError message={plan.formError} />
        <form id="sg-new-plan" onSubmit={plan.submit} noValidate>
          <FormGrid>
            <TextField className="sm:col-span-2" label="Plan name" name="name" required maxLength={140} error={plan.fieldErrors.name} />
            <SelectField label="Strategy" name="strategy_id" placeholder="None" options={strategies.map(item => ({ value: item.id, label: item.name }))} />
            <SelectField label="Owner" name="owner_id" placeholder="Me" options={personOptions(people)} error={plan.fieldErrors.owner_id} />
            <TextField label="Start date" name="start_date" type="date" error={plan.fieldErrors.start_date} />
            <TextField label="End date" name="end_date" type="date" error={plan.fieldErrors.end_date} />
            <SelectField label="Priority" name="priority" defaultValue="medium" options={STRATEGY_PRIORITIES.map(value => ({ value, label: PRIORITY_LABELS[value] }))} />
            <TextField label="Budget (£)" name="budget" inputMode="decimal" error={plan.fieldErrors.budget} />
            <TextField className="sm:col-span-2" label="Target" name="target_summary" maxLength={140} placeholder="e.g. +20% market share" />
            <TextArea className="sm:col-span-2" label="Description" name="description" maxLength={2000} />
          </FormGrid>
        </form>
      </Dialog>

      <Dialog open={open === 'milestone'} onClose={close} busy={milestone.pending} title="Add milestone or task"
        footer={<><DialogButton onClick={close}>Cancel</DialogButton><DialogButton variant="primary" type="submit" form="sg-new-item" disabled={milestone.pending}>Add</DialogButton></>}>
        <FormError message={milestone.formError} />
        <form id="sg-new-item" onSubmit={milestone.submit} noValidate>
          <FormGrid>
            <SelectField className="sm:col-span-2" label="Plan" name="plan_id" required options={planOptions} error={milestone.fieldErrors.plan_id} defaultValue={plans[0]?.id} />
            <TextField className="sm:col-span-2" label="Title" name="title" required maxLength={160} error={milestone.fieldErrors.title} />
            <SelectField label="Type" name="item_type" defaultValue="milestone" options={PLAN_ITEM_TYPES.map(value => ({ value, label: PLAN_ITEM_TYPE_LABELS[value] }))} />
            <SelectField label="Owner" name="owner_id" placeholder="Me" options={personOptions(people)} />
            <TextField label="Start date (tasks)" name="start_date" type="date" error={milestone.fieldErrors.start_date} />
            <TextField label="Due date" name="due_date" type="date" required error={milestone.fieldErrors.due_date} />
            <SelectField label="Priority" name="priority" defaultValue="medium" options={STRATEGY_PRIORITIES.map(value => ({ value, label: PRIORITY_LABELS[value] }))} />
          </FormGrid>
        </form>
      </Dialog>

      <Dialog open={open === 'owner'} onClose={close} busy={owner.pending} title="Assign owner" description="Reassign one or more plans to a workspace member."
        footer={<><DialogButton onClick={close}>Cancel</DialogButton><DialogButton variant="primary" type="submit" form="sg-assign-owner" disabled={owner.pending || ownerPlans.length === 0}>Assign</DialogButton></>}>
        <FormError message={owner.formError} />
        <form id="sg-assign-owner" onSubmit={owner.submit} noValidate className="space-y-3">
          <fieldset className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-sg-line p-2">
            <legend className="sr-only">Plans</legend>
            {plans.map(item => (
              <label key={item.id} className="flex min-h-9 items-center gap-2 rounded px-2 text-[13px] hover:bg-slate-50">
                <input type="checkbox" className="h-4 w-4" checked={ownerPlans.includes(item.id)} onChange={event => setOwnerPlans(list => event.target.checked ? [...list, item.id] : list.filter(id => id !== item.id))} />
                {item.name}
              </label>
            ))}
          </fieldset>
          <SelectField label="New owner" name="owner_id" required placeholder="Choose a member" options={personOptions(people)} error={owner.fieldErrors.owner_id} />
        </form>
      </Dialog>

      <Dialog open={open === 'dependency'} onClose={close} busy={dependency.pending} title="Add dependency" description="Circular chains are rejected."
        footer={<><DialogButton onClick={close}>Cancel</DialogButton><DialogButton variant="primary" type="submit" form="sg-new-dep" disabled={dependency.pending}>Add dependency</DialogButton></>}>
        <FormError message={dependency.formError} />
        <form id="sg-new-dep" onSubmit={dependency.submit} noValidate>
          <FormGrid>
            <SelectField className="sm:col-span-2" label="Plan" name="plan_id" required placeholder="Choose a plan" options={planOptions} error={dependency.fieldErrors.plan_id} />
            <SelectField className="sm:col-span-2" label="Depends on" name="depends_on_plan_id" required placeholder="Choose a plan" options={planOptions} error={dependency.fieldErrors.depends_on_plan_id} />
            <SelectField label="Risk" name="risk_level" defaultValue="low" options={RISK_LEVELS.map(value => ({ value, label: RISK_LABELS[value] }))} />
            <TextField label="Blocked items" name="blocked_items" type="number" min={0} max={999} defaultValue="0" error={dependency.fieldErrors.blocked_items} />
            <TextField className="sm:col-span-2" label="Description" name="label" maxLength={160} />
          </FormGrid>
        </form>
      </Dialog>

      <Dialog open={open === 'risk'} onClose={close} busy={risk.pending} title="Log a risk"
        footer={<><DialogButton onClick={close}>Cancel</DialogButton><DialogButton variant="primary" type="submit" form="sg-new-risk" disabled={risk.pending}>Log risk</DialogButton></>}>
        <FormError message={risk.formError} />
        <form id="sg-new-risk" onSubmit={risk.submit} noValidate>
          <FormGrid>
            <SelectField className="sm:col-span-2" label="Plan" name="plan_id" required placeholder="Choose a plan" options={planOptions} error={risk.fieldErrors.plan_id} />
            <TextField className="sm:col-span-2" label="Risk" name="title" required maxLength={140} error={risk.fieldErrors.title} />
            <SelectField label="Severity" name="severity" defaultValue="medium" options={RISK_LEVELS.map(value => ({ value, label: RISK_LABELS[value] }))} />
            <SelectField label="Owner" name="owner_id" placeholder="Me" options={personOptions(people)} />
            <TextArea className="sm:col-span-2" label="Detail" name="detail" maxLength={1000} />
          </FormGrid>
        </form>
      </Dialog>
    </>
  )
}

export function PlanItemMenu({ item, people, canEdit }: { item: PlanItemRow; people: PersonLite[]; canEdit: boolean }) {
  const { run, pending } = useStrategyAction()
  const [editOpen, setEditOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  if (!canEdit) return null
  return (
    <>
      <Menu label={`Actions for ${item.title}`} items={[
        { id: 'edit', label: 'Reschedule / update', onSelect: () => setEditOpen(true) },
        ...(item.status !== 'completed' ? [{ id: 'done', label: 'Mark completed', onSelect: () => { void run(() => updatePlanItem(item.id, { status: 'completed' })) } }] : []),
        ...(item.status !== 'blocked' ? [{ id: 'blocked', label: 'Mark blocked', onSelect: () => { void run(() => updatePlanItem(item.id, { status: 'blocked' })) } }] : []),
        { id: 'delete', label: 'Remove', danger: true, separatorBefore: true, onSelect: () => setConfirm(true) },
      ]} trigger={({ ref, toggle, ...aria }) => (
        <button ref={ref} type="button" onClick={toggle} {...aria} aria-label={`Actions for ${item.title}`}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-400 opacity-100 hover:bg-slate-100 group-hover:opacity-100 lg:h-4 lg:w-4 lg:opacity-0 lg:focus:opacity-100">
          <MoreHorizontal aria-hidden className="h-4 w-4 lg:h-3 lg:w-3" />
        </button>
      )} />
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} busy={pending} title={`Update “${item.title}”`}
        footer={<><DialogButton onClick={() => setEditOpen(false)}>Cancel</DialogButton><DialogButton variant="primary" type="submit" form={`sg-item-${item.id}`} disabled={pending}>Save</DialogButton></>}>
        <FormError message={formError} />
        <form id={`sg-item-${item.id}`} noValidate onSubmit={async event => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          const result = await run(() => updatePlanItem(item.id, {
            status: String(data.get('status')), progress: Number(data.get('progress')), owner_id: String(data.get('owner_id') || item.owner_id || ''),
            start_date: item.item_type === 'milestone' ? undefined : (String(data.get('start_date')) || null), due_date: String(data.get('due_date')) || null,
          }))
          if (result.ok) { setEditOpen(false); setFieldErrors({}); setFormError(null) }
          else { setFieldErrors(result.fieldErrors ?? {}); setFormError(result.fieldErrors ? null : result.error ?? null) }
        }}>
          <FormGrid>
            <SelectField label="Status" name="status" defaultValue={item.status} options={PLAN_ITEM_STATUSES.map(value => ({ value, label: PLAN_ITEM_STATUS_LABELS[value] }))} error={fieldErrors.status} />
            <TextField label="Progress (%)" name="progress" type="number" min={0} max={100} defaultValue={item.progress} error={fieldErrors.progress} />
            {item.item_type !== 'milestone' && <TextField label="Start date" name="start_date" type="date" defaultValue={item.start_date ?? ''} error={fieldErrors.start_date} />}
            <TextField label={item.item_type === 'milestone' ? 'Milestone date' : 'Due date'} name="due_date" type="date" defaultValue={item.due_date ?? ''} error={fieldErrors.due_date} />
            <SelectField className="sm:col-span-2" label="Owner" name="owner_id" defaultValue={item.owner_id ?? ''} options={personOptions(people)} error={fieldErrors.owner_id} />
          </FormGrid>
        </form>
      </Dialog>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} busy={pending} danger title={`Remove “${item.title}”?`} description="The item is removed from the plan and timeline."
        confirmLabel="Remove" onConfirm={async () => { const result = await run(() => deletePlanItem(item.id)); if (result.ok) setConfirm(false) }} />
    </>
  )
}

export function PlanStatusMenu({ plan, canEdit }: { plan: PlanRow; canEdit: boolean }) {
  const { run } = useStrategyAction()
  const moves = (PLAN_TRANSITIONS[plan.status as PlanStatus] ?? []).filter(status => status !== plan.status)
  if (!canEdit || moves.length === 0) return null
  return (
    <Menu label={`Change status of ${plan.name}`} items={moves.map(status => ({ id: status, label: `Mark ${PLAN_STATUS_LABELS[status].toLowerCase()}`, onSelect: () => { void run(() => setPlanStatus(plan.id, status)) } }))}
      trigger={({ ref, toggle, ...aria }) => (
        <button ref={ref} type="button" onClick={toggle} {...aria} aria-label={`Change status of ${plan.name}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 lg:h-4 lg:w-4"><MoreHorizontal aria-hidden className="h-4 w-4 lg:h-3 lg:w-3" /></button>
      )} />
  )
}

export function RiskStatusMenu({ id, title, canEdit }: { id: string; title: string; canEdit: boolean }) {
  const { run } = useStrategyAction()
  if (!canEdit) return null
  return (
    <Menu label={`Update risk ${title}`} items={[
      { id: 'mitigating', label: 'Mark mitigating', onSelect: () => { void run(() => setRiskStatus(id, 'mitigating')) } },
      { id: 'resolved', label: 'Mark resolved', onSelect: () => { void run(() => setRiskStatus(id, 'resolved')) } },
    ]} trigger={({ ref, toggle, ...aria }) => (
      <button ref={ref} type="button" onClick={toggle} {...aria} aria-label={`Update risk ${title}`} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 lg:h-4 lg:w-4">
        <MoreHorizontal aria-hidden className="h-4 w-4 lg:h-3 lg:w-3" />
      </button>
    )} />
  )
}

// ── Gantt ────────────────────────────────────────────────────────────────────

const BAR: Record<string, { bar: string; soft: string; text: string; dot: string }> = {
  on_track: { bar: 'bg-emerald-500', soft: 'bg-emerald-200', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  completed: { bar: 'bg-emerald-500', soft: 'bg-emerald-200', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  at_risk: { bar: 'bg-orange-500', soft: 'bg-orange-200', text: 'text-orange-500', dot: 'bg-orange-500' },
  off_track: { bar: 'bg-red-500', soft: 'bg-red-200', text: 'text-red-500', dot: 'bg-red-500' },
  blocked: { bar: 'bg-red-500', soft: 'bg-red-200', text: 'text-red-500', dot: 'bg-red-500' },
  not_started: { bar: 'bg-slate-300', soft: 'bg-slate-200', text: 'text-slate-500', dot: 'bg-slate-300' },
}
const SCALES: GanttScaleId[] = ['days', 'weeks', 'months']
const DAY_MS = 86_400_000

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * A draggable Gantt bar. Drag the body to move, drag either edge to resize.
 * Keyboard: ← → move one day, Shift+← → change the end date, Alt+← → the start.
 * The bar previews while dragging and commits once on release; if the server
 * rejects the change (e.g. a dependency) it snaps back and the reason is shown.
 */
function GanttBar({
  start, end, windowStart, windowEnd, canEdit, label, milestone = false, onCommit, children,
}: {
  start: string
  end: string
  windowStart: Date
  windowEnd: Date
  canEdit: boolean
  label: string
  milestone?: boolean
  onCommit: (start: string, end: string) => Promise<ActionResult>
  children: (preview: { start: string; end: string; dragging: boolean }) => React.ReactNode
}) {
  const [preview, setPreview] = useState<{ start: string; end: string } | null>(null)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ mode: 'move' | 'start' | 'end'; x: number; start: string; end: string; dayPx: number } | null>(null)
  const current = preview ?? { start, end }
  const span = windowEnd.getTime() - windowStart.getTime()
  const offset = (iso: string) => Math.max(0, Math.min(100, ((new Date(`${iso}T00:00:00`).getTime() - windowStart.getTime()) / span) * 100))
  const left = offset(current.start)
  const width = milestone ? 0 : Math.max(0.8, offset(current.end) - left)

  async function commit(next: { start: string; end: string }) {
    if (next.start === start && next.end === end) { setPreview(null); return }
    setPreview(next)
    const result = await onCommit(next.start, next.end)
    // On success the server refresh brings the new dates; on failure snap back.
    if (!result.ok) setPreview(null)
  }

  function onPointerDown(event: React.PointerEvent<HTMLElement>, mode: 'move' | 'start' | 'end') {
    if (!canEdit || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const track = (event.currentTarget.closest('[data-gantt-track]') as HTMLElement | null)?.getBoundingClientRect()
    if (!track) return
    const dayPx = track.width / (span / DAY_MS)
    drag.current = { mode, x: event.clientX, start: current.start, end: current.end, dayPx }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    setDragging(true)
  }

  function onPointerMove(event: React.PointerEvent<HTMLElement>) {
    const state = drag.current
    if (!state) return
    const days = Math.round((event.clientX - state.x) / state.dayPx)
    let nextStart = state.start
    let nextEnd = state.end
    if (state.mode === 'move') { nextStart = addDays(state.start, days); nextEnd = addDays(state.end, days) }
    if (state.mode === 'start') nextStart = addDays(state.start, days) > state.end ? state.end : addDays(state.start, days)
    if (state.mode === 'end') nextEnd = addDays(state.end, days) < state.start ? state.start : addDays(state.end, days)
    setPreview({ start: nextStart, end: milestone ? nextStart : nextEnd })
  }

  function onPointerUp() {
    const state = drag.current
    drag.current = null
    setDragging(false)
    if (state && preview) void commit(preview)
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!canEdit) return
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const base = current
    const next = milestone || (!event.shiftKey && !event.altKey)
      ? { start: addDays(base.start, step), end: milestone ? addDays(base.start, step) : addDays(base.end, step) }
      : event.shiftKey
        ? { start: base.start, end: addDays(base.end, step) < base.start ? base.start : addDays(base.end, step) }
        : { start: addDays(base.start, step) > base.end ? base.end : addDays(base.start, step), end: base.end }
    void commit(next)
  }

  const handle = 'absolute inset-y-[-4px] z-10 w-2 cursor-ew-resize touch-none'
  return (
    <span
      role={canEdit ? 'slider' : undefined}
      tabIndex={canEdit ? 0 : undefined}
      aria-label={canEdit ? `${label}. Use arrow keys to move; Shift for the end date, Alt for the start date.` : label}
      aria-valuetext={milestone ? current.start : `${current.start} to ${current.end}`}
      onKeyDown={onKeyDown}
      className={cn('absolute top-1/2 flex -translate-y-1/2 items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sg-blue/60',
        canEdit && 'cursor-grab touch-none', dragging && 'cursor-grabbing')}
      style={milestone ? { left: `calc(${left}% - 5px)` } : { left: `${left}%`, width: `${width}%` }}
      onPointerDown={event => onPointerDown(event, 'move')}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {children({ ...current, dragging })}
      {canEdit && !milestone && (
        <>
          <span aria-hidden className={cn(handle, '-left-1')} onPointerDown={event => onPointerDown(event, 'start')} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
          <span aria-hidden className={cn(handle, '-right-1')} onPointerDown={event => onPointerDown(event, 'end')} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
        </>
      )}
      {dragging && (
        <span className="pointer-events-none absolute -top-6 left-0 z-20 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">
          {milestone ? formatDayMonth(current.start) : `${formatDayMonth(current.start)} – ${formatDayMonth(current.end)}`}
        </span>
      )}
    </span>
  )
}

export function Gantt({
  plans, items, people, canEdit, dependencies, previewLimit,
}: {
  plans: PlanRow[]
  /** Dashboard shows this many plans; full screen always shows every plan. */
  previewLimit?: number
  items: PlanItemRow[]
  people: PersonLite[]
  canEdit: boolean
  dependencies: { plan_id: string; depends_on_plan_id: string }[]
}) {
  const { params, patch } = useQueryPatch()
  const { run } = useStrategyAction()
  const scale = (SCALES.find(value => value === params.get('scale')) ?? 'weeks') as GanttScaleId
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(plans.slice(0, 2).map(plan => plan.id)))
  const [full, setFull] = useState(false)
  const today = new Date()
  const visible = full || !previewLimit ? plans : plans.slice(0, previewLimit)

  const itemsByPlan = useMemo(() => {
    const map = new Map<string, PlanItemRow[]>()
    for (const item of items.filter(row => row.sort_order < 10)) map.set(item.plan_id, [...(map.get(item.plan_id) ?? []), item])
    return map
  }, [items])
  const window = useMemo(() => ganttWindow(plans.flatMap(plan => [plan.start_date, plan.end_date]), scale, today), [plans, scale]) // eslint-disable-line react-hooks/exhaustive-deps
  const pos = (date: string | null | undefined) => (date ? ganttOffset(date, window.start, window.end) * 100 : 0)
  const months = useMemo(() => {
    const list: { key: string; label: string; left: number }[] = []
    const cursor = new Date(window.start.getFullYear(), window.start.getMonth(), 1)
    while (cursor <= window.end) {
      list.push({ key: cursor.toISOString(), label: cursor.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }), left: Math.max(0, ganttOffset(cursor, window.start, window.end) * 100) })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return list
  }, [window])
  const todayLeft = pos(today.toISOString().slice(0, 10))
  const blockedBy = new Set(dependencies.map(dep => dep.plan_id))

  return (
    <div className={cn(full && 'fixed inset-0 z-[65] overflow-auto bg-white p-4')}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3 lg:px-[11px] lg:pt-[11px]">
        <h2 className="text-[14px] font-semibold text-sg-ink lg:text-[11px]">Plan timeline</h2>
        <ul className="flex flex-wrap items-center gap-3 text-[11.5px] text-sg-body lg:gap-[16px] lg:text-[8.5px]" aria-label="Legend">
          {([['On track', 'bg-emerald-500'], ['At risk', 'bg-orange-500'], ['Off track', 'bg-red-500'], ['Not started', 'bg-slate-300']] as const).map(([label, tone]) => (
            <li key={label} className="inline-flex items-center gap-1.5"><i aria-hidden className={cn('h-2 w-2 rounded-full', tone)} />{label}</li>
          ))}
          <li className="inline-flex items-center gap-1.5"><Diamond aria-hidden className="h-2.5 w-2.5" />Milestone</li>
        </ul>
        <div className="ml-auto flex items-center gap-2">
          {visible.length < plans.length && (
            <button type="button" onClick={() => setFull(true)} className="inline-flex min-h-10 items-center rounded-md px-2 text-[12px] text-sg-muted hover:text-sg-blue lg:mr-[6px] lg:min-h-0 lg:text-[9px]">
              {visible.length} of {plans.length} plans · <span className="ml-1 font-medium text-sg-blue">Show all</span>
            </button>
          )}
          <label className="sr-only" htmlFor="gantt-scale">Time scale</label>
          <select id="gantt-scale" value={scale} onChange={event => patch({ scale: event.target.value === 'weeks' ? null : event.target.value }, { replace: true })}
            className="h-10 rounded-lg border border-sg-line bg-white px-2 text-[13px] lg:h-[24px] lg:w-[74px] lg:rounded-[6px] lg:text-[9.5px]">
            <option value="days">Days</option><option value="weeks">Weeks</option><option value="months">Months</option>
          </select>
          <button type="button" aria-label="Zoom out" disabled={scale === 'months'} onClick={() => patch({ scale: SCALES[SCALES.indexOf(scale) + 1] }, { replace: true })}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-sg-line bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 lg:h-[24px] lg:w-[24px] lg:rounded-[6px]"><Minus aria-hidden className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></button>
          <button type="button" aria-label="Zoom in" disabled={scale === 'days'} onClick={() => patch({ scale: SCALES[SCALES.indexOf(scale) - 1] === 'weeks' ? null : SCALES[SCALES.indexOf(scale) - 1] }, { replace: true })}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-sg-line bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 lg:h-[24px] lg:w-[24px] lg:rounded-[6px]"><Plus aria-hidden className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></button>
          <button type="button" aria-label={full ? 'Exit full screen' : 'Full screen'} aria-pressed={full} onClick={() => setFull(value => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-sg-line bg-white text-slate-500 hover:bg-slate-50 lg:h-[24px] lg:w-[24px] lg:rounded-[6px]">
            {full ? <Minimize2 aria-hidden className="h-3.5 w-3.5 lg:h-3 lg:w-3" /> : <Maximize2 aria-hidden className="h-3.5 w-3.5 lg:h-3 lg:w-3" />}
          </button>
        </div>
      </div>

      <div className="mt-2 overflow-x-auto" role="region" aria-label="Plan timeline" tabIndex={0}>
        <div className="min-w-[920px]">
          <div className="flex border-b border-sg-line-soft">
            <div className="flex w-[340px] shrink-0 items-end gap-2 px-4 pb-1.5 text-[11px] text-sg-muted lg:w-[352px] lg:px-[11px] lg:text-[8.5px]">
              <ChevronRight aria-hidden className="h-3 w-3" /><span className="flex-1">Plan / Initiative</span><span className="w-[118px]">Owner</span>
            </div>
            <div className="relative h-10 flex-1 border-l border-sg-line-soft lg:h-[34px]">
              {months.filter((month, index) => !(index === 0 && months[1] && months[1].left < 9)).map(month => (
                <span key={month.key} className="absolute top-1 whitespace-nowrap text-[11px] font-medium text-sg-ink lg:top-[2px] lg:text-[8.5px]" style={{ left: `calc(${month.left}% + 4px)` }}>{month.label}</span>
              ))}
              {/* Thin tick labels so they never collide, whatever the span. */}
              {window.columns.filter((column, index) => index % Math.max(1, Math.ceil(window.columns.length / 14)) === 0
                && ganttOffset(column, window.start, window.end) < 0.97).map(column => (
                <span key={column.toISOString()} className="absolute bottom-1 text-[10px] text-sg-muted lg:bottom-[4px] lg:text-[8px]" style={{ left: `calc(${ganttOffset(column, window.start, window.end) * 100}% + 4px)` }}>
                  {scale === 'months' ? '' : scale === 'days' ? column.getDate() : `${column.toLocaleDateString('en-GB', { month: 'short' })} ${column.getDate()}`}
                </span>
              ))}
            </div>
          </div>
          <ul className="relative [--gantt-label:340px] lg:[--gantt-label:352px]">
            {months.map(month => (
              <span key={month.key} aria-hidden className="pointer-events-none absolute bottom-0 top-0 w-px bg-sg-line-soft" style={{ left: `calc(var(--gantt-label) + (100% - var(--gantt-label)) * ${month.left / 100})` }} />
            ))}
            <span aria-hidden className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-sg-blue" style={{ left: `calc(var(--gantt-label) + (100% - var(--gantt-label)) * ${todayLeft / 100})` }}>
              <span className="absolute -left-4 -top-2.5 rounded bg-sg-blue px-1 text-[9px] text-white lg:text-[7.5px]">Today</span>
            </span>
            {visible.map(plan => {
              const open = expanded.has(plan.id)
              const tone = BAR[plan.status] ?? BAR.not_started
              const children = itemsByPlan.get(plan.id) ?? []
              return (
                <li key={plan.id} className="border-b border-sg-line-soft">
                  <div className="group flex min-h-12 items-center lg:min-h-[32px]">
                    <div className="flex w-[340px] shrink-0 items-center gap-2 px-4 lg:w-[352px] lg:px-[11px]">
                      <button type="button" aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${plan.name}`} disabled={children.length === 0}
                        onClick={() => setExpanded(set => { const next = new Set(set); if (next.has(plan.id)) next.delete(plan.id); else next.add(plan.id); return next })}
                        className="inline-flex h-9 w-9 items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 lg:h-4 lg:w-4">
                        {open ? <ChevronDown aria-hidden className="h-3.5 w-3.5 lg:h-3 lg:w-3" /> : <ChevronRight aria-hidden className="h-3.5 w-3.5 lg:h-3 lg:w-3" />}
                      </button>
                      <span aria-hidden className={cn('h-5 w-1 rounded-full lg:h-[14px] lg:w-[3px]', tone.bar)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-sg-ink lg:text-[9.5px]">{plan.name}</span>
                        <span className={cn('flex items-center gap-1 text-[11px] lg:text-[8px]', tone.text)}><i aria-hidden className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />{PLAN_STATUS_LABELS[plan.status as PlanStatus]}{blockedBy.has(plan.id) ? ' · has dependency' : ''}</span>
                      </span>
                      <span className="flex w-[118px] items-center gap-1.5 text-[12px] text-sg-body lg:text-[9px]"><Avatar person={plan.owner} size={18} /><span className="truncate">{shortName(plan.owner?.full_name)}</span></span>
                      <span className="inline-flex lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:focus-within:opacity-100"><PlanStatusMenu plan={plan} canEdit={canEdit} /></span>
                    </div>
                    <div data-gantt-track className="relative h-12 flex-1 border-l border-sg-line-soft lg:h-[32px]">
                      {plan.start_date && plan.end_date && (
                        <GanttBar key={`${plan.start_date}-${plan.end_date}`} start={plan.start_date} end={plan.end_date} windowStart={window.start} windowEnd={window.end}
                          canEdit={canEdit} label={`${plan.name}, ${formatDayMonth(plan.start_date)} to ${formatDayMonth(plan.end_date)}, ${plan.progress}% complete`}
                          onCommit={(start, end) => run(() => setPlanDates(plan.id, start, end))}>
                          {({ dragging }) => (
                            <>
                              <span className={cn('relative block h-2 w-full overflow-hidden rounded-full lg:h-[6px]', tone.soft, dragging && 'ring-2 ring-sg-blue/40')}>
                                <span className={cn('absolute inset-y-0 left-0 rounded-full', tone.bar)} style={{ width: `${plan.progress}%` }} />
                              </span>
                              <span className="absolute left-full ml-2 whitespace-nowrap text-[11px] text-sg-body lg:text-[8.5px]">{plan.progress}%</span>
                            </>
                          )}
                        </GanttBar>
                      )}
                    </div>
                  </div>
                  {open && children.map(item => {
                    const itemTone = BAR[item.status] ?? BAR.not_started
                    const StatusIcon = item.status === 'completed' ? CheckCircle2 : item.item_type === 'milestone' ? Diamond : Circle
                    return (
                      <div key={item.id} className="group flex min-h-10 items-center lg:min-h-[17px]">
                        <div className="flex w-[340px] shrink-0 items-center gap-2 pl-14 pr-4 lg:w-[352px] lg:pl-[40px] lg:pr-[11px]">
                          <StatusIcon aria-hidden className={cn('h-3.5 w-3.5 shrink-0 lg:h-[10px] lg:w-[10px]', item.status === 'completed' ? 'text-emerald-500' : item.item_type === 'milestone' ? cn(itemTone.text, 'fill-current') : 'text-sg-blue')} />
                          <span className="min-w-0 flex-1 truncate text-[12px] text-sg-body lg:text-[8.5px]">{item.title}<span className="sr-only">, {PLAN_ITEM_STATUS_LABELS[item.status as keyof typeof PLAN_ITEM_STATUS_LABELS]}</span></span>
                          <span className="inline-flex lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:focus-within:opacity-100"><PlanItemMenu item={item} people={people} canEdit={canEdit} /></span>
                        </div>
                        <div data-gantt-track className="relative h-10 flex-1 border-l border-sg-line-soft lg:h-[17px]">
                          {item.item_type === 'milestone' ? (
                            item.due_date && (
                              <GanttBar key={item.due_date} milestone start={item.due_date} end={item.due_date} windowStart={window.start} windowEnd={window.end}
                                canEdit={canEdit} label={`Milestone ${item.title}, due ${formatDayMonth(item.due_date)}`}
                                onCommit={date => run(() => updatePlanItem(item.id, { due_date: date }))}>
                                {({ start }) => (
                                  <span className="flex items-center gap-1.5">
                                    <Diamond aria-hidden className={cn('h-3 w-3 fill-current lg:h-[10px] lg:w-[10px]', itemTone.text)} />
                                    <span className="whitespace-nowrap text-[11px] text-sg-body lg:text-[8.5px]">{formatDayMonth(start)}</span>
                                  </span>
                                )}
                              </GanttBar>
                            )
                          ) : item.start_date && item.due_date && (
                            <GanttBar key={`${item.start_date}-${item.due_date}`} start={item.start_date} end={item.due_date} windowStart={window.start} windowEnd={window.end}
                              canEdit={canEdit} label={`${item.title}, ${formatDayMonth(item.start_date)} to ${formatDayMonth(item.due_date)}`}
                              onCommit={(start, end) => run(() => updatePlanItem(item.id, { start_date: start, due_date: end }))}>
                              {() => (
                                <>
                                  <span className={cn('relative block h-2 w-full overflow-hidden rounded-full lg:h-[6px]', itemTone.soft)}>
                                    <span className={cn('absolute inset-y-0 left-0 rounded-full opacity-80', itemTone.bar)} style={{ width: `${item.progress}%` }} />
                                  </span>
                                  <span className="absolute left-full ml-2 whitespace-nowrap text-[11px] text-sg-body lg:text-[8.5px]">{item.progress}%</span>
                                </>
                              )}
                            </GanttBar>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
      {full && <p className="mt-3 text-center text-[12px] text-sg-muted">Press the minimise button to return.</p>}
    </div>
  )
}
