'use client'

import { useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronDown, Download, FileSpreadsheet, MoreHorizontal, MoreVertical, PencilLine, PlusCircle, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  archiveObjective, bulkUpdateObjectives, deleteObjective, importObjectives, restoreObjective, updateObjectiveStatus,
} from '@/lib/strategy/actions/objectives'
import {
  OBJECTIVE_BOARD_STATUSES, OBJECTIVE_STATUS_LABELS, OBJECTIVE_TRANSITIONS, PRIORITY_LABELS, STRATEGY_PRIORITIES,
  type ObjectiveStatus,
} from '@/lib/strategy/constants'
import type { ObjectiveRow, PersonLite } from '@/lib/strategy/types'
import { BUTTON, ICON } from '../buttons'
import { Menu, type MenuItem } from '../client/menu'
import { ConfirmDialog, Dialog, DialogButton } from '../client/dialog'
import { FormError, SelectField } from '../client/fields'
import { useStrategyAction } from '../client/use-action'
import { ObjectiveDialog, type Option } from '../forms/ObjectiveDialog'

interface Can { create: boolean; edit: boolean; delete: boolean; export: boolean }

// ── Header actions ───────────────────────────────────────────────────────────

export function ObjectivesHeaderActions({
  people, strategies, objectives, can,
}: { people: PersonLite[]; strategies: Option[]; objectives: { id: string; name: string }[]; can: Can }) {
  const params = useSearchParams()
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const exportHref = (format: string) => {
    const qs = new URLSearchParams(params.toString())
    qs.set('module', 'objectives'); qs.set('format', format)
    return `/api/strategy/export?${qs}`
  }
  return (
    <>
      {can.create && <button type="button" className={BUTTON.primary} onClick={() => setCreateOpen(true)}><PlusCircle aria-hidden className={ICON} /> New objective</button>}
      {can.create && <button type="button" className={BUTTON.secondary} onClick={() => setImportOpen(true)}><Upload aria-hidden className={ICON} /> Import</button>}
      {can.edit && <button type="button" className={BUTTON.secondary} onClick={() => setBulkOpen(true)}><PencilLine aria-hidden className={ICON} /> Bulk update</button>}
      {can.export && (
        <Menu label="Export" items={[
          { id: 'csv', label: 'Export CSV', description: 'Uses the current filters', icon: <FileSpreadsheet className="h-3.5 w-3.5" />, href: exportHref('csv'), download: true },
          { id: 'json', label: 'Export JSON', icon: <Download className="h-3.5 w-3.5" />, href: exportHref('json'), download: true },
        ]} trigger={({ ref, toggle, open, ...aria }) => (
          <button ref={ref} type="button" onClick={toggle} {...aria} className={BUTTON.secondary}>
            <Download aria-hidden className={ICON} /> Export
            <ChevronDown aria-hidden className={cn(ICON, 'ml-2 text-slate-500 transition-transform lg:ml-[9px]', open && 'rotate-180')} />
          </button>
        )} />
      )}
      <Menu label="More actions" items={[
        { id: 'archived', label: 'View archived objectives', href: '?archived=1' },
        { id: 'print', label: 'Print', onSelect: () => window.print() },
      ]} trigger={({ ref, toggle, ...aria }) => (
        <button ref={ref} type="button" onClick={toggle} {...aria} aria-label="More actions" className={BUTTON.icon}><MoreVertical aria-hidden className={ICON} /></button>
      )} />
      <ObjectiveDialog open={createOpen} onClose={() => setCreateOpen(false)} people={people} strategies={strategies} />
      <ImportObjectivesDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <BulkUpdateDialog open={bulkOpen} onClose={() => setBulkOpen(false)} people={people} objectives={objectives} />
    </>
  )
}

function ImportObjectivesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { run, pending } = useStrategyAction()
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)

  async function submit() {
    if (!file) { setError('Choose a CSV file.'); return }
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') { setError('Only .csv files can be imported.'); return }
    if (file.size > 500_000) { setError('Import files must be under 500 KB.'); return }
    const text = await file.text()
    const result = await run(() => importObjectives(text))
    if (result.ok) { setFile(null); setError(null); onClose() } else setError(result.error ?? null)
  }

  return (
    <Dialog open={open} onClose={onClose} busy={pending} title="Import objectives" size="md"
      description="Upload a CSV with a header row. Required: name. Optional: type, priority, status, due_date, target, next_action, progress, confidence."
      footer={<><DialogButton onClick={onClose} disabled={pending}>Cancel</DialogButton><DialogButton variant="primary" onClick={submit} disabled={pending || !file}>{pending ? 'Importing…' : 'Import'}</DialogButton></>}>
      <FormError message={error} />
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-sg-line bg-slate-50 px-4 py-8 text-center hover:border-sg-blue">
        <Upload aria-hidden className="h-5 w-5 text-slate-400" />
        <span className="text-[13px] font-medium text-sg-ink">{file ? file.name : 'Choose a CSV file'}</span>
        <span className="text-[12px] text-sg-muted">Up to 500 objectives · nothing is saved if any row fails</span>
        <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" onChange={event => { setFile(event.target.files?.[0] ?? null); setError(null) }} />
      </label>
      <a className="mt-3 inline-block text-[12px] font-medium text-sg-blue hover:underline" download="objectives-template.csv"
        href={`data:text/csv;charset=utf-8,${encodeURIComponent('name,type,priority,status,due_date,target,next_action,progress,confidence\nIncrease Brand Awareness,awareness,high,on_track,2026-12-31,Awareness to 70%,Launch campaign,10,70\n')}`}>
        Download CSV template
      </a>
    </Dialog>
  )
}

function BulkUpdateDialog({ open, onClose, people, objectives }: {
  open: boolean; onClose: () => void; people: PersonLite[]; objectives: { id: string; name: string }[]
}) {
  const { run, pending } = useStrategyAction()
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const result = await run(() => bulkUpdateObjectives(selected, {
      status: String(data.get('status') ?? '') || undefined,
      priority: String(data.get('priority') ?? '') || undefined,
      owner_id: String(data.get('owner_id') ?? '') || undefined,
    }))
    if (result.ok) { setSelected([]); setError(null); onClose() } else setError(result.error ?? null)
  }

  return (
    <Dialog open={open} onClose={onClose} busy={pending} size="lg" title="Bulk update objectives"
      description="Apply one change to several objectives. Status changes that are not allowed are skipped and reported."
      footer={<><DialogButton onClick={onClose} disabled={pending}>Cancel</DialogButton><DialogButton variant="primary" type="submit" form="strategy-bulk-objectives" disabled={pending || selected.length === 0}>{pending ? 'Updating…' : `Update ${selected.length || ''} objective${selected.length === 1 ? '' : 's'}`}</DialogButton></>}>
      <FormError message={error} />
      <form id="strategy-bulk-objectives" onSubmit={submit} className="space-y-4">
        <fieldset>
          <legend className="mb-1.5 flex w-full items-center justify-between text-[12.5px] font-medium text-sg-body">
            Objectives on this page
            <button type="button" className="text-[12px] font-medium text-sg-blue" onClick={() => setSelected(selected.length === objectives.length ? [] : objectives.map(o => o.id))}>
              {selected.length === objectives.length ? 'Clear' : 'Select all'}
            </button>
          </legend>
          <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-sg-line p-2">
            {objectives.map(objective => (
              <label key={objective.id} className="flex min-h-9 items-center gap-2 rounded px-2 text-[13px] hover:bg-slate-50">
                <input type="checkbox" className="h-4 w-4 accent-[var(--color-sg-blue)]" checked={selected.includes(objective.id)}
                  onChange={event => setSelected(list => event.target.checked ? [...list, objective.id] : list.filter(id => id !== objective.id))} />
                {objective.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SelectField label="Status" name="status" placeholder="No change" options={OBJECTIVE_BOARD_STATUSES.map(value => ({ value, label: OBJECTIVE_STATUS_LABELS[value] }))} />
          <SelectField label="Priority" name="priority" placeholder="No change" options={STRATEGY_PRIORITIES.map(value => ({ value, label: PRIORITY_LABELS[value] }))} />
          <SelectField label="Owner" name="owner_id" placeholder="No change" options={people.map(person => ({ value: person.id, label: person.full_name ?? person.email ?? 'Member' }))} />
        </div>
      </form>
    </Dialog>
  )
}

// ── Row / card menu ──────────────────────────────────────────────────────────

export function ObjectiveMenu({
  objective, people, strategies, can, horizontal,
}: { objective: ObjectiveRow; people: PersonLite[]; strategies: Option[]; can: Can; horizontal?: boolean }) {
  const { run, pending } = useStrategyAction()
  const [editOpen, setEditOpen] = useState(false)
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null)
  const archived = Boolean(objective.archived_at)
  const moves = (OBJECTIVE_TRANSITIONS[objective.status as ObjectiveStatus] ?? []).filter(status => status !== objective.status && status !== 'archived')

  const items: MenuItem[] = [
    ...(can.edit && !archived ? [{ id: 'edit', label: 'Edit objective', onSelect: () => setEditOpen(true) }] : []),
    ...(can.edit && !archived ? moves.map((status, index) => ({
      id: `move-${status}`, label: `Mark ${OBJECTIVE_STATUS_LABELS[status].toLowerCase()}`, separatorBefore: index === 0,
      onSelect: () => { void run(() => updateObjectiveStatus(objective.id, status)) },
    })) : []),
    ...(can.edit ? [archived
      ? { id: 'restore', label: 'Restore', separatorBefore: true, onSelect: () => { void run(() => restoreObjective(objective.id)) } }
      : { id: 'archive', label: 'Archive', separatorBefore: true, onSelect: () => setConfirm('archive') }] : []),
    ...(can.delete && archived ? [{ id: 'delete', label: 'Delete permanently', danger: true, onSelect: () => setConfirm('delete') }] : []),
  ]
  if (items.length === 0) return null
  const Icon = horizontal ? MoreHorizontal : MoreHorizontal

  return (
    <>
      <Menu label={`Actions for ${objective.name}`} items={items} trigger={({ ref, toggle, ...aria }) => (
        <button ref={ref} type="button" onClick={toggle} {...aria} aria-label={`Actions for ${objective.name}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 lg:h-5 lg:w-6">
          <Icon aria-hidden className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
        </button>
      )} />
      {editOpen && <ObjectiveDialog open onClose={() => setEditOpen(false)} people={people} strategies={strategies} objective={objective} />}
      <ConfirmDialog open={confirm !== null} onClose={() => setConfirm(null)} busy={pending} danger={confirm === 'delete'}
        title={confirm === 'delete' ? `Delete “${objective.name}”?` : `Archive “${objective.name}”?`}
        description={confirm === 'delete' ? 'This permanently removes the objective and its links. It cannot be undone.' : 'Archived objectives leave KPIs and views but can be restored.'}
        confirmLabel={confirm === 'delete' ? 'Delete' : 'Archive'}
        onConfirm={async () => {
          const result = await run(() => (confirm === 'delete' ? deleteObjective(objective.id) : archiveObjective(objective.id)))
          if (result.ok) setConfirm(null)
        }} />
    </>
  )
}

// ── Kanban ───────────────────────────────────────────────────────────────────

export function ObjectiveKanban({
  columns, can, children,
}: {
  columns: { status: string; label: string; count: number; items: { id: string; status: string; node: React.ReactNode }[] }[]
  can: Can
  children?: React.ReactNode
}) {
  const { run } = useStrategyAction()
  const [dragging, setDragging] = useState<{ id: string; status: string } | null>(null)
  const [over, setOver] = useState<string | null>(null)

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0" role="region" aria-label="Objectives board" tabIndex={0}>
      <div className="flex min-w-max gap-3 lg:grid lg:min-w-0 lg:grid-cols-6 lg:gap-[13px]">
        {columns.map(column => {
          const allowed = dragging ? OBJECTIVE_TRANSITIONS[dragging.status as ObjectiveStatus]?.includes(column.status as ObjectiveStatus) : false
          return (
            <section key={column.status} aria-label={`${column.label}, ${column.count} objectives`}
              onDragOver={event => { if (can.edit && allowed) { event.preventDefault(); setOver(column.status) } }}
              onDragLeave={() => setOver(null)}
              onDrop={event => {
                event.preventDefault(); setOver(null)
                if (dragging && allowed && dragging.status !== column.status) void run(() => updateObjectiveStatus(dragging.id, column.status))
                setDragging(null)
              }}
              className={cn('w-[260px] shrink-0 rounded-xl border bg-slate-50/70 p-2 lg:w-auto',
                over === column.status ? 'border-sg-blue bg-sg-blue-soft/40' : 'border-sg-line',
                dragging && !allowed && 'opacity-60')}>
              <h3 className="mb-2 flex items-center justify-between px-1 text-[12.5px] font-semibold text-sg-ink lg:text-[11px]">
                {column.label}<span className="rounded bg-white px-1.5 text-[11px] font-medium text-sg-muted ring-1 ring-sg-line lg:text-[9.5px]">{column.count}</span>
              </h3>
              <ul className="space-y-2">
                {column.items.map(item => (
                  <li key={item.id} draggable={can.edit}
                    onDragStart={() => setDragging({ id: item.id, status: item.status })} onDragEnd={() => { setDragging(null); setOver(null) }}
                    className={cn(can.edit && 'cursor-grab active:cursor-grabbing')}>
                    {item.node}
                  </li>
                ))}
                {column.items.length === 0 && <li className="rounded-lg border border-dashed border-sg-line px-2 py-6 text-center text-[11px] text-sg-subtle">No objectives</li>}
              </ul>
            </section>
          )
        })}
      </div>
      {children}
      <p className="mt-2 text-[11.5px] text-sg-muted lg:text-[10px]">Drag a card to change status, or use its menu. Only allowed transitions accept a drop.</p>
    </div>
  )
}
