'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircle, CheckCircle2, Download, FileUp, Loader2, MoreHorizontal, Plus, RefreshCw, Upload, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CalendarContext } from '@/lib/calendar/entitlements'
import { canAccessCalendarCapability } from '@/lib/calendar/entitlements'
import type { CalendarLookups } from '@/lib/calendar/types'
import {
  commitCalendarImport, detectConflictsNow, previewCalendarImport, saveScheduleItem,
  type ImportPreviewRow,
} from '@/lib/calendar/actions'
import { T } from './primitives'

// ── Modal shell ─────────────────────────────────────────────────────────────

export function CalendarModal({
  title, description, onClose, children, footer, wide,
}: {
  title: string
  description?: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); return }
      if (event.key !== 'Tab' || !ref.current) return
      // Focus trap.
      const focusable = ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')
      if (!focusable.length) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previous?.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={onClose} />
      <div ref={ref} className={cn('relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-[12.5px] text-slate-500">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={cn('rounded-lg p-1.5 text-slate-400 hover:bg-slate-100', T.focus)}>
            <X size={17} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5">{footer}</footer>}
      </div>
    </div>
  )
}

export function DialogField({ label, error, required, children, hint }: {
  label: string; error?: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  const id = useId()
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block text-[12px] font-medium text-slate-700">
        {label}{required ? <span className="text-red-500"> *</span> : <span className="text-slate-400"> (optional)</span>}
      </span>
      <span className="block [&>*]:w-full" id={id}>{children}</span>
      {hint && !error && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-[11.5px] text-red-600">{error}</span>}
    </label>
  )
}

export const dialogInputClass = 'h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'

// ── New schedule item ───────────────────────────────────────────────────────

export function NewScheduleItemDialog({
  ctx, lookups, onClose,
}: { ctx: CalendarContext; lookups: CalendarLookups; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [allDay, setAllDay] = useState(false)
  const [dirty, setDirty] = useState(false)
  // Stable per-dialog key so a double submit cannot create two records.
  const requestId = useRef(crypto.randomUUID())

  function close() {
    if (dirty && !window.confirm('Discard this schedule item? Your changes will not be saved.')) return
    onClose()
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    setErrors({}); setFormError(null)
    startTransition(async () => {
      const result = await saveScheduleItem({
        basePath: ctx.basePath,
        itemType: String(form.get('itemType') ?? 'event'),
        title: String(form.get('title') ?? ''),
        description: String(form.get('description') ?? ''),
        startDate: String(form.get('startDate') ?? ''),
        startTime: String(form.get('startTime') ?? ''),
        endDate: String(form.get('endDate') ?? ''),
        endTime: String(form.get('endTime') ?? ''),
        allDay,
        timezone: ctx.timezone,
        priority: String(form.get('priority') ?? 'medium'),
        status: String(form.get('status') ?? 'scheduled'),
        channel: String(form.get('channel') ?? ''),
        campaignId: String(form.get('campaignId') ?? ''),
        ownerId: String(form.get('ownerId') ?? ''),
        location: String(form.get('location') ?? ''),
        meetingUrl: String(form.get('meetingUrl') ?? ''),
        recurrenceRule: String(form.get('recurrence') ?? ''),
        requestId: requestId.current,
      })
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        setFormError(result.error ?? 'Could not save this item.')
        return
      }
      router.refresh()
      onClose()
    })
  }

  return (
    <CalendarModal
      title="New schedule item"
      description={`Times are saved against ${ctx.timezone}.`}
      onClose={close}
      wide
      footer={
        <>
          <button type="button" onClick={close} className={cn('h-9 rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50', T.focus)}>Cancel</button>
          <button type="submit" form="new-schedule-item" disabled={pending}
            className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[12.5px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60', T.focus)}>
            {pending && <Loader2 size={14} className="animate-spin" />}
            {pending ? 'Saving…' : 'Create item'}
          </button>
        </>
      }
    >
      <form id="new-schedule-item" onSubmit={submit} onChange={() => setDirty(true)} className="space-y-4">
        {formError && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />{formError}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <DialogField label="Item type" required>
            <select name="itemType" defaultValue="event" className={dialogInputClass}>
              <option value="event">Event</option>
              <option value="meeting">Meeting</option>
              <option value="reminder">Reminder</option>
              <option value="milestone">Milestone</option>
              <option value="launch">Launch</option>
              <option value="review">Review / approval checkpoint</option>
            </select>
          </DialogField>
          <DialogField label="Priority">
            <select name="priority" defaultValue="medium" className={dialogInputClass}>
              <option value="low">Low</option><option value="medium">Medium</option>
              <option value="high">High</option><option value="urgent">Urgent</option>
            </select>
          </DialogField>
        </div>

        <DialogField label="Title" required error={errors.title}>
          <input name="title" maxLength={180} required className={dialogInputClass} placeholder="e.g. Summer launch stand-up" />
        </DialogField>

        <DialogField label="Description">
          <textarea name="description" rows={2} maxLength={2000} className={cn(dialogInputClass, 'h-auto py-2')} placeholder="What is this for?" />
        </DialogField>

        <label className="flex items-center gap-2 text-[13px] text-slate-700">
          <input type="checkbox" checked={allDay} onChange={e => { setAllDay(e.target.checked); setDirty(true) }} className="h-4 w-4 rounded border-slate-300" />
          All-day item
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <DialogField label="Start date" required error={errors.startDate}>
            <input type="date" name="startDate" required className={dialogInputClass} />
          </DialogField>
          {!allDay && (
            <DialogField label="Start time" required>
              <input type="time" name="startTime" defaultValue="09:00" required className={dialogInputClass} />
            </DialogField>
          )}
          <DialogField label="End date" error={errors.endDate}>
            <input type="date" name="endDate" className={dialogInputClass} />
          </DialogField>
          {!allDay && (
            <DialogField label="End time">
              <input type="time" name="endTime" className={dialogInputClass} />
            </DialogField>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DialogField label="Owner">
            <select name="ownerId" defaultValue="" className={dialogInputClass}>
              <option value="">Me</option>
              {lookups.owners.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </DialogField>
          <DialogField label="Campaign">
            <select name="campaignId" defaultValue="" className={dialogInputClass}>
              <option value="">No campaign</option>
              {lookups.campaigns.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </DialogField>
          <DialogField label="Channel">
            <select name="channel" defaultValue="" className={dialogInputClass}>
              <option value="">No channel</option>
              {lookups.channels.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              <option value="internal">Internal</option>
            </select>
          </DialogField>
          <DialogField label="Status">
            <select name="status" defaultValue="scheduled" className={dialogInputClass}>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In progress</option>
            </select>
          </DialogField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DialogField label="Location">
            <input name="location" maxLength={200} className={dialogInputClass} placeholder="Room, city or venue" />
          </DialogField>
          <DialogField label="Meeting link" error={errors.meetingUrl}>
            <input name="meetingUrl" type="url" className={dialogInputClass} placeholder="https://…" />
          </DialogField>
        </div>

        <DialogField label="Repeat" hint="Uses the RFC 5545 recurrence standard, e.g. FREQ=WEEKLY;BYDAY=MO;COUNT=10">
          <select name="recurrence" defaultValue="" className={dialogInputClass}>
            <option value="">Does not repeat</option>
            <option value="FREQ=DAILY">Daily</option>
            <option value="FREQ=WEEKLY">Weekly</option>
            <option value="FREQ=WEEKLY;INTERVAL=2">Every 2 weeks</option>
            <option value="FREQ=MONTHLY">Monthly</option>
          </select>
        </DialogField>
      </form>
    </CalendarModal>
  )
}

// ── Import ──────────────────────────────────────────────────────────────────

function ImportDialog({ ctx, onClose }: { ctx: CalendarContext; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [preview, setPreview] = useState<{ rows: ImportPreviewRow[]; validCount: number; invalidCount: number; duplicateCount: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filename, setFilename] = useState<string | null>(null)
  const [done, setDone] = useState<number | null>(null)

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null); setPreview(null); setDone(null)
    if (file.size > 2 * 1024 * 1024) { setError('That file is larger than the 2 MB import limit.'); return }
    setFilename(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      startTransition(async () => {
        const result = await previewCalendarImport({
          basePath: ctx.basePath, filename: file.name,
          content: String(reader.result ?? ''), timezone: ctx.timezone,
        })
        if (!result.ok) { setError(result.error ?? 'Could not read that file.'); return }
        setPreview(result.data ?? null)
      })
    }
    reader.onerror = () => setError('That file could not be read.')
    reader.readAsText(file)
  }

  function commit() {
    if (!preview) return
    startTransition(async () => {
      const rows = preview.rows.filter(r => !r.error && !r.duplicate && r.startAt)
        .map(r => ({ title: r.title, startAt: r.startAt as string, endAt: r.endAt, allDay: r.allDay, itemType: r.itemType }))
      const result = await commitCalendarImport({ basePath: ctx.basePath, rows, timezone: ctx.timezone })
      if (!result.ok) { setError(result.error ?? 'Import failed.'); return }
      setDone(result.data?.imported ?? 0)
      router.refresh()
    })
  }

  return (
    <CalendarModal
      title="Import schedule"
      description="Accepts .ics calendar files and .csv exports up to 2 MB."
      onClose={onClose}
      wide
      footer={
        done === null ? (
          <>
            <button type="button" onClick={onClose} className={cn('h-9 rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50', T.focus)}>Cancel</button>
            <button type="button" onClick={commit} disabled={!preview || pending || preview.validCount === 0}
              className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[12.5px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50', T.focus)}>
              {pending && <Loader2 size={14} className="animate-spin" />}
              Import {preview ? `${preview.validCount} item${preview.validCount === 1 ? '' : 's'}` : ''}
            </button>
          </>
        ) : (
          <button type="button" onClick={onClose} className={cn('h-9 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700', T.focus)}>Done</button>
        )
      }
    >
      {done !== null ? (
        <div className="py-6 text-center">
          <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-500" />
          <p className="text-[14px] font-semibold text-slate-900">{done} item{done === 1 ? '' : 's'} imported</p>
          <p className="mt-1 text-[12.5px] text-slate-500">They now appear on your calendar and were checked for conflicts.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-5 text-center">
            <FileUp size={22} className="mx-auto mb-2 text-slate-400" />
            <label className={cn('inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3 text-[13px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50', T.focus)}>
              <Upload size={14} />Choose file
              <input type="file" accept=".ics,.csv,text/calendar,text/csv" className="sr-only" onChange={onFile} />
            </label>
            <p className="mt-2 text-[11.5px] text-slate-500">{filename ?? 'ICS or CSV · max 2 MB · 500 rows'}</p>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download (Content-Disposition: attachment), not a page navigation */}
            <a href="/api/calendar/export?format=template" className="mt-1 inline-block text-[11.5px] font-medium text-blue-600 hover:underline">
              Download the CSV template
            </a>
          </div>

          {pending && !preview && <p className="flex items-center gap-2 text-[12.5px] text-slate-500"><Loader2 size={14} className="animate-spin" />Reading file…</p>}

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />{error}
            </p>
          )}

          {preview && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <SummaryTile label="Ready to import" value={preview.validCount} tone="emerald" />
                <SummaryTile label="Duplicates skipped" value={preview.duplicateCount} tone="amber" />
                <SummaryTile label="Invalid rows" value={preview.invalidCount} tone="red" />
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-[12.5px]">
                  <caption className="sr-only">Import preview</caption>
                  <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr><th scope="col" className="px-3 py-2">Row</th><th scope="col" className="px-3 py-2">Title</th><th scope="col" className="px-3 py-2">Start</th><th scope="col" className="px-3 py-2">Result</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.rows.slice(0, 100).map(row => (
                      <tr key={`${row.index}-${row.title}`}>
                        <td className="px-3 py-1.5 text-slate-400">{row.index}</td>
                        <td className="max-w-[200px] truncate px-3 py-1.5 text-slate-800">{row.title}</td>
                        <td className="px-3 py-1.5 text-slate-600">{row.startAt ? new Date(row.startAt).toLocaleString(ctx.locale, { timeZone: ctx.timezone }) : '—'}</td>
                        <td className="px-3 py-1.5">
                          {row.error ? <span className="text-red-600">{row.error}</span>
                            : row.duplicate ? <span className="text-amber-600">Duplicate — skipped</span>
                            : <span className="text-emerald-600">Ready</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </CalendarModal>
  )
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'amber' | 'red' }) {
  const tones = { emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700' }
  return (
    <div className={cn('rounded-lg px-3 py-2', tones[tone])}>
      <p className="text-[18px] font-bold leading-6">{value}</p>
      <p className="text-[11px] font-medium">{label}</p>
    </div>
  )
}

// ── Header action cluster ───────────────────────────────────────────────────

export function CalendarHeaderActions({ ctx, lookups }: { ctx: CalendarContext; lookups: CalendarLookups }) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const [dialog, setDialog] = useState<'new' | 'import' | null>(searchParams.get('new') === '1' ? 'new' : null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const menuRef = useRef<HTMLDivElement>(null)

  const canCreate = canAccessCalendarCapability(ctx, 'calendar.create')
  const canImport = canAccessCalendarCapability(ctx, 'calendar.import')
  const canExport = canAccessCalendarCapability(ctx, 'calendar.export')
  const canConflicts = canAccessCalendarCapability(ctx, 'calendar.conflicts')

  useEffect(() => {
    if (!menuOpen) return
    function onDown(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  // Export runs server-side so it applies the same filters, scope and
  // permissions the page used — the browser only receives the finished file.
  const exportHref = (format: 'csv' | 'ics') => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('format', format)
    params.set('surface', 'calendar')
    params.set('basePath', ctx.basePath)
    return `/api/calendar/export?${params}`
  }

  function closeDialog() {
    setDialog(null)
    if (searchParams.get('new')) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('new')
      router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false })
    }
  }

  return (
    <>
      {canCreate && (
        <button type="button" onClick={() => setDialog('new')}
          className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[12.5px] font-semibold text-white shadow-sm hover:bg-blue-700', T.focus)}>
          <Plus size={15} />New schedule item
        </button>
      )}
      {canImport && (
        <button type="button" onClick={() => setDialog('import')}
          className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e3e7ed] bg-white px-3 text-[12.5px] font-semibold text-slate-800 shadow-[0_1px_1px_rgba(16,24,40,0.03)] hover:bg-slate-50', T.focus)}>
          <Upload size={14} />Import
        </button>
      )}
      {canExport && (
        <a href={exportHref('csv')}
          className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e3e7ed] bg-white px-3 text-[12.5px] font-semibold text-slate-800 shadow-[0_1px_1px_rgba(16,24,40,0.03)] hover:bg-slate-50', T.focus)}>
          <Download size={14} />Export
        </a>
      )}

      <div className="relative" ref={menuRef}>
        <button type="button" onClick={() => setMenuOpen(v => !v)} aria-label="More calendar actions" aria-expanded={menuOpen}
          className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e3e7ed] bg-white text-slate-600 shadow-[0_1px_1px_rgba(16,24,40,0.03)] hover:bg-slate-50', T.focus)}>
          <MoreHorizontal size={17} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-30 mt-1.5 w-60 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
            {canExport && (
              <a href={exportHref('ics')} onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
                <Download size={14} className="text-slate-400" />Export as calendar (.ics)
              </a>
            )}
            {canConflicts && (
              <button type="button" disabled={pending}
                onClick={() => startTransition(async () => {
                  await detectConflictsNow({ basePath: ctx.basePath })
                  setMenuOpen(false)
                  router.refresh()
                })}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {pending ? <Loader2 size={14} className="animate-spin text-slate-400" /> : <RefreshCw size={14} className="text-slate-400" />}
                Re-check for conflicts
              </button>
            )}
            <a href={`${ctx.basePath}/settings/workspace`} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
              <span className="w-3.5" />Calendar settings
            </a>
          </div>
        )}
      </div>

      {dialog === 'new' && canCreate && <NewScheduleItemDialog ctx={ctx} lookups={lookups} onClose={closeDialog} />}
      {dialog === 'import' && canImport && <ImportDialog ctx={ctx} onClose={closeDialog} />}
    </>
  )
}

/** Compact export/overflow cluster used by the Queue, Agenda and Conflicts pages. */
export function SecondaryHeaderActions({
  ctx, surface, primary,
}: {
  ctx: CalendarContext
  surface: 'queue' | 'agenda' | 'conflicts'
  primary?: React.ReactNode
}) {
  const searchParams = useSearchParams()
  const canExport = canAccessCalendarCapability(ctx, 'calendar.export')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!menuOpen) return
    function onDown(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  const exportHref = (format: 'csv' | 'ics') => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('format', format)
    params.set('surface', surface)
    params.set('basePath', ctx.basePath)
    return `/api/calendar/export?${params}`
  }

  return (
    <>
      {primary}
      {canExport && (
        <a href={exportHref('csv')}
          className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e3e7ed] bg-white px-3 text-[12.5px] font-semibold text-slate-800 shadow-[0_1px_1px_rgba(16,24,40,0.03)] hover:bg-slate-50', T.focus)}>
          <Download size={14} />Export
        </a>
      )}
      <div className="relative" ref={menuRef}>
        <button type="button" onClick={() => setMenuOpen(v => !v)} aria-label="More actions" aria-expanded={menuOpen}
          className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e3e7ed] bg-white text-slate-600 shadow-[0_1px_1px_rgba(16,24,40,0.03)] hover:bg-slate-50', T.focus)}>
          <MoreHorizontal size={17} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-30 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
            {canExport && (
              <a href={exportHref('ics')} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
                <Download size={14} className="text-slate-400" />Export as calendar (.ics)
              </a>
            )}
            {canAccessCalendarCapability(ctx, 'calendar.conflicts') && (
              <button type="button" disabled={pending}
                onClick={() => startTransition(async () => { await detectConflictsNow({ basePath: ctx.basePath }); setMenuOpen(false); router.refresh() })}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {pending ? <Loader2 size={14} className="animate-spin text-slate-400" /> : <RefreshCw size={14} className="text-slate-400" />}
                Re-check for conflicts
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
