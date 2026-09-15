'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircle, ArrowUpRight, Check, CheckCircle2, Loader2, MoreVertical,
  RotateCcw, ShieldCheck, UserPlus, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CalendarContext } from '@/lib/calendar/entitlements'
import { canAccessCalendarCapability } from '@/lib/calendar/entitlements'
import type { CalendarConflict, CalendarLookups } from '@/lib/calendar/types'
import { CONFLICT_TYPE_LABELS } from '@/lib/calendar/constants'
import { formatShortDate, formatTime } from '@/lib/calendar/dates'
import { applyConflictRecommendation, updateConflict } from '@/lib/calendar/actions'
import { CalendarModal, DialogField, dialogInputClass } from './dialogs'
import { Avatar, ChannelIcon, EmptyState, SeverityBadge, T } from './primitives'

const STATUS_CHIP: Record<string, string> = {
  open: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-50 text-blue-700',
  reopened: 'bg-amber-50 text-amber-700',
  resolved: 'bg-emerald-50 text-emerald-700',
  dismissed: 'bg-slate-100 text-slate-500',
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Open', in_progress: 'In progress', reopened: 'Reopened',
  resolved: 'Resolved', dismissed: 'Dismissed',
}

/** Reference linked-record type pills. */
const RECORD_PILL: Record<string, string> = {
  campaign: 'bg-blue-50 text-blue-700',
  content_post: 'bg-violet-50 text-violet-700',
  publishing_job: 'bg-emerald-50 text-emerald-700',
  calendar_item: 'bg-sky-50 text-sky-700',
  task: 'bg-amber-50 text-amber-700',
  approval: 'bg-orange-50 text-orange-700',
  profile: 'bg-slate-100 text-slate-600',
}
const RECORD_LABEL: Record<string, string> = {
  campaign: 'Campaign', content_post: 'Content', publishing_job: 'Queue',
  calendar_item: 'Event', task: 'Task', approval: 'Approval', profile: 'Person',
}

function Toast({ tone, children, onDismiss }: { tone: 'success' | 'error'; children: React.ReactNode; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 6000); return () => clearTimeout(t) }, [onDismiss])
  return (
    <div role="status" aria-live="polite"
      className={cn('fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 items-start gap-2 rounded-xl px-4 py-3 text-[13px] lg:text-[11.5px] shadow-lg',
        tone === 'success' ? 'bg-slate-900 text-white' : 'bg-red-600 text-white')}>
      {tone === 'success' ? <CheckCircle2 size={15} className="mt-0.5" /> : <AlertCircle size={15} className="mt-0.5" />}
      <span className="max-w-md">{children}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
    </div>
  )
}

// ── Cards ───────────────────────────────────────────────────────────────────

export function ConflictCards({
  ctx, conflicts, total, page, pageSize, selectedId,
}: {
  ctx: CalendarContext
  conflicts: CalendarConflict[]
  total: number
  page: number
  pageSize: number
  selectedId: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const canAssign = canAccessCalendarCapability(ctx, 'conflicts.assign')

  function select(id: string) {
    const next = new URLSearchParams(params.toString())
    next.set('selected', id)
    router.push(`${pathname}?${next}`, { scroll: false })
  }

  function goToPage(target: number) {
    const next = new URLSearchParams(params.toString())
    next.set('page', String(target))
    router.push(`${pathname}?${next}`, { scroll: false })
  }

  if (conflicts.length === 0) {
    return (
      <div className={cn(T.card)}>
        <EmptyState
          icon={<ShieldCheck size={18} />}
          title="No conflicts match"
          body="Nothing in this period matches the current filters. Clear them, or widen the date range, to see resolved and dismissed conflicts."
        />
      </div>
    )
  }

  return (
    <div className={cn(T.card, 'overflow-hidden')}>
      {/* Reference: dividerless 36px header, cards on an 11px grid. */}
      <header className="flex h-9 items-center px-3.5 pt-0.5">
        <h2 className="text-[13px] lg:text-[11.5px] font-semibold text-slate-900">Active conflicts</h2>
      </header>
      <div className="grid gap-[11px] px-3.5 pb-2 md:grid-cols-2 xl:grid-cols-3">
        {conflicts.map(conflict => (
          <article
            key={conflict.id}
            className={cn(
              // Reference card: severity pill, title, one-line description, 3 facts, hairline, owner/due footer.
              'relative flex flex-col rounded-[10px] border bg-white px-3 pt-2.5 transition-shadow hover:shadow-sm',
              selectedId === conflict.id ? 'border-blue-400 ring-1 ring-blue-200' : 'border-[#e8ebf0]',
            )}
          >
            <div className="mb-2 flex items-start">
              <SeverityBadge severity={conflict.severity} />
              <span className="sr-only">Status: {STATUS_LABEL[conflict.status]}</span>
            </div>
            <button type="button" onClick={() => select(conflict.id)} className={cn('block w-full text-left', T.focus)}>
              <h3 className="truncate text-[11.5px] lg:text-[10px] font-semibold leading-[14px] text-slate-900">{conflict.title}</h3>
              <p className="mt-0.5 truncate text-[10.5px] lg:text-[9px] leading-[13px] text-slate-600">{conflict.description}</p>
            </button>

            <dl className="mt-2.5 grid grid-cols-[48px_minmax(0,1.6fr)_minmax(0,1fr)] gap-2 text-[10.5px] lg:text-[9px]">
              <div>
                <dt className="text-[10px] lg:text-[9px] text-slate-400">Channels</dt>
                <dd className="mt-1 flex gap-1">
                  {conflict.channels.length === 0 ? <span className="text-slate-400">—</span>
                    : conflict.channels.slice(0, 3).map(channel => <ChannelIcon key={channel} channel={channel} size={11} />)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] lg:text-[9px] text-slate-400">Date</dt>
                <dd className="mt-1 text-[10.5px] lg:text-[9px] leading-[13px] font-medium text-slate-700">
                  {conflict.startAt ? <>{formatShortDate(conflict.startAt, ctx.timezone, ctx.locale)}<br />{formatTime(conflict.startAt, ctx.timezone, ctx.locale)}</> : formatShortDate(conflict.detectedAt, ctx.timezone, ctx.locale)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] lg:text-[9px] text-slate-400">Impact</dt>
                <dd className={cn('mt-1 font-semibold capitalize',
                  conflict.impact === 'high' ? 'text-red-600' : conflict.impact === 'medium' ? 'text-amber-600' : 'text-emerald-600')}>
                  {conflict.impact}
                </dd>
              </div>
            </dl>

            <div className="-mx-3 mt-2.5 flex items-center justify-between gap-2 border-t border-[#eef0f4] px-3 py-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <Avatar name={conflict.assigneeName ?? conflict.ownerName} size={20} />
                <span className="min-w-0">
                  <span className="block text-[10px] lg:text-[9px] text-slate-400">Owner</span>
                  <span className="block truncate text-[11px] lg:text-[9.5px] font-medium text-slate-700">{conflict.assigneeName ?? conflict.ownerName ?? 'Unassigned'}</span>
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[10px] lg:text-[9px] text-slate-400">Due</span>
                <span className="block text-[11px] lg:text-[9.5px] font-medium text-slate-700">
                  {conflict.dueAt ? formatShortDate(conflict.dueAt, ctx.timezone, ctx.locale) : '—'}
                </span>
              </span>
              <div className="relative">
                <button type="button" aria-label={`Actions for ${conflict.reference}`} aria-expanded={openMenu === conflict.id}
                  onClick={() => setOpenMenu(openMenu === conflict.id ? null : conflict.id)}
                  className={cn('flex h-[26px] w-[26px] items-center justify-center rounded-md border border-[#e3e7ed] text-slate-500 hover:bg-slate-50', T.focus)}>
                  <MoreVertical size={14} />
                </button>
                {openMenu === conflict.id && (
                  <>
                    <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close menu" onClick={() => setOpenMenu(null)} />
                    <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                      <button type="button" onClick={() => { select(conflict.id); setOpenMenu(null) }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] lg:text-[11.5px] text-slate-700 hover:bg-slate-50">
                        <ArrowUpRight size={13} />Open in panel
                      </button>
                      {canAssign && (
                        <button type="button" onClick={() => { select(conflict.id); setOpenMenu(null) }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] lg:text-[11.5px] text-slate-700 hover:bg-slate-50">
                          <UserPlus size={13} />Assign owner
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Reference: count on the left, pagination centred, no divider. */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-3.5 pb-3 pt-1">
        <p className="text-[11px] lg:text-[9.5px] text-slate-500">
          Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} conflicts
        </p>
        <nav aria-label="Pagination" className="flex items-center gap-0.5">
          <button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)} aria-label="Previous page"
            className={cn('h-7 w-7 rounded-md text-[12.5px] lg:text-[11px] text-slate-500 hover:bg-slate-100 disabled:opacity-30', T.focus)}>‹</button>
          {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => i + 1).map(n => (
            <button key={n} type="button" onClick={() => goToPage(n)} aria-current={n === page ? 'page' : undefined}
              className={cn('h-6 min-w-6 rounded-md px-1.5 text-[11.5px] lg:text-[10px] font-medium', n === page ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100', T.focus)}>
              {n}
            </button>
          ))}
          {pageCount > 5 && <span className="px-1 text-[12.5px] lg:text-[11px] text-slate-400">… {pageCount}</span>}
          <button type="button" disabled={page >= pageCount} onClick={() => goToPage(page + 1)} aria-label="Next page"
            className={cn('h-7 w-7 rounded-md text-[12.5px] lg:text-[11px] text-slate-500 hover:bg-slate-100 disabled:opacity-30', T.focus)}>›</button>
        </nav>
        <span aria-hidden />
      </div>
    </div>
  )
}

// ── Resolution panel ────────────────────────────────────────────────────────

export function ResolutionPanel({
  ctx, conflict, lookups,
}: {
  ctx: CalendarContext
  conflict: CalendarConflict | null
  lookups: CalendarLookups
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [notes, setNotes] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)
  const [applying, setApplying] = useState<{ action: string; label: string } | null>(null)
  // Reference panel lists three linked records; the rest sit behind a toggle.
  const [showAllRecords, setShowAllRecords] = useState(false)

  const canResolve = canAccessCalendarCapability(ctx, 'conflicts.resolve')
  const canAssign = canAccessCalendarCapability(ctx, 'conflicts.assign')
  const canReopen = canAccessCalendarCapability(ctx, 'conflicts.reopen')
  const canDismiss = canAccessCalendarCapability(ctx, 'conflicts.dismiss')

  function hide() {
    const next = new URLSearchParams(params.toString())
    next.delete('selected')
    router.push(next.size ? `${pathname}?${next}` : pathname, { scroll: false })
  }

  function run(label: string, fn: () => Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string> }>) {
    if (pending) return
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) {
        setNoteError(result.fieldErrors?.resolutionNotes ?? null)
        setToast({ tone: 'error', message: result.error ?? result.fieldErrors?.resolutionNotes ?? 'That action failed.' })
        return
      }
      setNoteError(null)
      setToast({ tone: 'success', message: label })
      router.refresh()
    })
  }

  if (!conflict) {
    return (
      <section className={cn(T.card, 'p-5')}>
        <h2 className="text-[14px] font-semibold text-slate-900">Resolution panel</h2>
        <EmptyState
          icon={<ShieldCheck size={18} />}
          title="Select a conflict"
          body="Choose a conflict card to see its recommended actions, linked records and resolution controls."
        />
      </section>
    )
  }

  const resolved = conflict.status === 'resolved' || conflict.status === 'dismissed'

  return (
    <section className={cn(T.card, 'overflow-hidden')}>
      <header className="flex h-9 items-center justify-between gap-2 px-3.5 pt-0.5">
        <h2 className="text-[13px] lg:text-[11.5px] font-semibold text-slate-900">Resolution panel</h2>
        <button type="button" onClick={hide} className={cn('text-[11.5px] lg:text-[10px] font-medium text-blue-600 hover:text-blue-700', T.focus)}>Hide</button>
      </header>

      {/* Reference: the selected conflict sits in an inner bordered card. */}
      <div className="px-3.5 pb-3.5">
      <div className="space-y-3 rounded-[10px] border border-[#eef0f4] p-3">
        <div>
          <div className="flex items-center gap-2">
            <SeverityBadge severity={conflict.severity} />
            <span className="text-[12.5px] lg:text-[11px] font-semibold text-slate-900">{conflict.title}</span>
          </div>
          <p className="mt-1 text-[10.5px] lg:text-[9px] leading-[14px] text-slate-500">{conflict.description}</p>
          {/* Not shown in the reference panel; kept for assistive tech and support references. */}
          <p className="sr-only">
            {conflict.reference} · {CONFLICT_TYPE_LABELS[conflict.type]} · detected {formatShortDate(conflict.detectedAt, ctx.timezone, ctx.locale)}
          </p>
        </div>

        {conflict.recommendations.length > 0 && (
          <div>
            <p className="text-[11px] lg:text-[9.5px] font-medium text-slate-600">Recommended actions</p>
            <ul className="mt-1.5 space-y-1.5">
              {conflict.recommendations.map(recommendation => (
                <li key={recommendation.id} className="flex items-start gap-2">
                  <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white" aria-hidden>
                    <Check size={10} strokeWidth={3} />
                  </span>
                  <span className="min-w-0 flex-1 text-[11px] lg:text-[9.5px] leading-[14px] text-slate-700">
                    {recommendation.label}
                    {recommendation.advisory && <span className="ml-1 text-[10.5px] lg:text-[9px] text-slate-400">(suggestion — review before applying)</span>}
                  </span>
                  {recommendation.action && canResolve && !resolved && (
                    <button
                      type="button"
                      onClick={() => setApplying({ action: recommendation.action as string, label: recommendation.label })}
                      className={cn('shrink-0 rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] lg:text-[9.5px] font-medium text-slate-600 hover:bg-slate-50', T.focus)}
                    >
                      Apply
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="text-[11px] lg:text-[9.5px] font-medium text-slate-600">
            Assignee
            <select
              defaultValue={conflict.assigneeId ?? ''}
              disabled={!canAssign || pending}
              onChange={e => run('Assignee updated', () => updateConflict({ basePath: ctx.basePath, id: conflict.id, assigneeId: e.target.value || null }))}
              className={cn(dialogInputClass, 'mt-1 !h-8 w-full text-[11px] lg:text-[9.5px] normal-case')}
            >
              <option value="">Unassigned</option>
              {lookups.owners.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="text-[11px] lg:text-[9.5px] font-medium text-slate-600">
            Due date
            <input
              type="date"
              defaultValue={conflict.dueAt ? conflict.dueAt.slice(0, 10) : ''}
              disabled={!canAssign || pending}
              onChange={e => run('Due date updated', () => updateConflict({ basePath: ctx.basePath, id: conflict.id, dueDate: e.target.value || null }))}
              className={cn(dialogInputClass, 'mt-1 !h-8 w-full text-[11px] lg:text-[9.5px]')}
            />
          </label>
        </div>

        <label className="block text-[11px] lg:text-[9.5px] font-medium text-slate-600">
          Status
          <select
            value={conflict.status}
            disabled={!canAssign || pending}
            onChange={e => {
              const value = e.target.value as 'open' | 'in_progress' | 'reopened'
              run('Status updated', () => updateConflict({ basePath: ctx.basePath, id: conflict.id, status: value }))
            }}
            className={cn(dialogInputClass, 'mt-1 !h-8 w-full text-[11px] lg:text-[9.5px] normal-case')}
          >
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            {conflict.status === 'reopened' && <option value="reopened">Reopened</option>}
            {resolved && <option value={conflict.status}>{STATUS_LABEL[conflict.status]}</option>}
          </select>
        </label>

        {conflict.linkedRecords.length > 0 && (
          <div>
            <p className="text-[11px] lg:text-[9.5px] font-medium text-slate-600">Linked records</p>
            <ul className="mt-1.5 divide-y divide-[#eef0f4] overflow-hidden rounded-lg border border-[#eef0f4]">
              {(showAllRecords ? conflict.linkedRecords : conflict.linkedRecords.slice(0, 3)).map(record => (
                <li key={`${record.kind}-${record.id}`} className="flex items-center justify-between gap-2 px-2.5 py-[5px]">
                  {record.href
                    ? <Link href={record.href} className={cn('min-w-0 flex-1 truncate text-[11px] lg:text-[9.5px] font-medium text-slate-800 hover:text-blue-700 hover:underline', T.focus)}>{record.label}</Link>
                    : <span className="min-w-0 flex-1 truncate text-[11px] lg:text-[9.5px] text-slate-700">{record.label}</span>}
                  <span className={cn('shrink-0 rounded-md px-1.5 py-px text-[10px] lg:text-[9px] font-medium', RECORD_PILL[record.kind] ?? RECORD_PILL.profile)}>
                    {RECORD_LABEL[record.kind] ?? record.kind.replace('_', ' ')}
                  </span>
                </li>
              ))}
            </ul>
            {conflict.linkedRecords.length > 3 && (
              <button type="button" onClick={() => setShowAllRecords(v => !v)} aria-expanded={showAllRecords}
                className={cn('mt-1 text-[10.5px] lg:text-[9px] font-medium text-blue-600 hover:text-blue-700', T.focus)}>
                {showAllRecords ? 'Show fewer' : `Show ${conflict.linkedRecords.length - 3} more`}
              </button>
            )}
          </div>
        )}

        {resolved ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-[12.5px] lg:text-[11px] font-semibold text-emerald-800">
              {STATUS_LABEL[conflict.status]}{conflict.resolvedByName ? ` by ${conflict.resolvedByName}` : ''}
            </p>
            {conflict.resolutionNotes && <p className="mt-1 text-[12px] lg:text-[10.5px] text-emerald-900">{conflict.resolutionNotes}</p>}
            {canReopen && (
              <button type="button" disabled={pending}
                onClick={() => run('Conflict reopened', () => updateConflict({ basePath: ctx.basePath, id: conflict.id, status: 'reopened' }))}
                className={cn('mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-2.5 text-[12.5px] lg:text-[11px] font-medium text-emerald-800 hover:bg-emerald-100', T.focus)}>
                <RotateCcw size={13} />Reopen
              </button>
            )}
          </div>
        ) : (canResolve || canDismiss) && (
          <div>
            <label className="block">
              <span className="sr-only">Resolution note</span>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={1}
                maxLength={2000}
                placeholder="What did you change to resolve this?"
                className={cn(dialogInputClass, 'h-auto min-h-8 w-full py-1.5 text-[11px] lg:text-[9.5px] normal-case')}
              />
            </label>
            {noteError && <p role="alert" className="mt-1 text-[11.5px] lg:text-[10px] text-red-600">{noteError}</p>}
            <div className="mt-2 flex gap-2">
              {canResolve && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run('Conflict marked as resolved', () => updateConflict({ basePath: ctx.basePath, id: conflict.id, status: 'resolved', resolutionNotes: notes }))}
                  className={cn('inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 text-[12.5px] lg:text-[11px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60', T.focus)}
                >
                  {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}Mark as resolved
                </button>
              )}
              {canDismiss && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm('Dismiss this conflict as a false positive? It will stop appearing in active conflicts.')) return
                    run('Conflict dismissed', () => updateConflict({ basePath: ctx.basePath, id: conflict.id, status: 'dismissed', resolutionNotes: notes || 'Dismissed as a false positive.' }))
                  }}
                  className={cn('inline-flex h-8 items-center justify-center rounded-lg border border-[#e3e7ed] px-3 text-[12.5px] lg:text-[11px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60', T.focus)}
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      </div>

      {applying && (
        <ApplyRecommendationDialog
          ctx={ctx}
          conflict={conflict}
          lookups={lookups}
          action={applying}
          onClose={() => setApplying(null)}
          onDone={message => { setApplying(null); setToast({ tone: 'success', message }); router.refresh() }}
        />
      )}
      {toast && <Toast tone={toast.tone} onDismiss={() => setToast(null)}>{toast.message}</Toast>}
    </section>
  )
}

function ApplyRecommendationDialog({
  ctx, conflict, lookups, action, onClose, onDone,
}: {
  ctx: CalendarContext
  conflict: CalendarConflict
  lookups: CalendarLookups
  action: { action: string; label: string }
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const needsTime = action.action === 'reschedule' || action.action === 'space_posts' || action.action === 'extend_deadline'
  const needsOwner = action.action === 'reassign'

  const actionableRecords = conflict.linkedRecords.filter(record => record.kind !== 'profile')

  return (
    <CalendarModal
      title="Apply recommended action"
      description={action.label}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cn('h-9 rounded-lg border border-slate-200 px-3 text-[13px] lg:text-[11.5px] font-medium text-slate-700 hover:bg-slate-50', T.focus)}>Cancel</button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const form = new FormData(formRef.current ?? undefined)
              const newStart = String(form.get('newStart') ?? '')
              startTransition(async () => {
                const result = await applyConflictRecommendation({
                  basePath: ctx.basePath,
                  conflictId: conflict.id,
                  action: action.action as 'reschedule' | 'reassign' | 'extend_deadline' | 'cancel_duplicate' | 'space_posts',
                  targetRecordId: String(form.get('targetRecordId') ?? '') || undefined,
                  newStartAt: newStart ? new Date(newStart).toISOString() : undefined,
                  newOwnerId: String(form.get('newOwnerId') ?? '') || undefined,
                })
                if (!result.ok) { setError(result.error ?? 'Could not apply that action.'); return }
                onDone('Recommended action applied')
              })
            }}
            className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[12.5px] lg:text-[11px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60', T.focus)}
          >
            {pending && <Loader2 size={14} className="animate-spin" />}Apply
          </button>
        </>
      }
    >
      <form ref={formRef} className="space-y-4" onSubmit={e => e.preventDefault()}>
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] lg:text-[11px] text-red-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />{error}
          </p>
        )}
        <DialogField label="Record to change" required>
          <select name="targetRecordId" defaultValue={actionableRecords[0]?.id ?? ''} className={dialogInputClass}>
            {actionableRecords.length === 0 && <option value="">No actionable record</option>}
            {actionableRecords.map(record => (
              <option key={record.id} value={record.id}>{record.label} ({record.kind.replace('_', ' ')})</option>
            ))}
          </select>
        </DialogField>
        {needsTime && (
          <DialogField
            label={action.action === 'extend_deadline' ? 'New deadline' : 'New date and time'}
            required
            hint={`Saved against ${ctx.timezone}.`}
          >
            <input type="datetime-local" name="newStart" required className={dialogInputClass} />
          </DialogField>
        )}
        {needsOwner && (
          <DialogField label="New owner" required>
            <select name="newOwnerId" defaultValue="" className={dialogInputClass}>
              <option value="" disabled>Choose a team member</option>
              {lookups.owners.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </DialogField>
        )}
        {action.action === 'cancel_duplicate' && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] lg:text-[11px] text-amber-800">
            The selected record will be cancelled and will not publish. This is recorded in the audit log.
          </p>
        )}
      </form>
    </CalendarModal>
  )
}

// ── Header actions ──────────────────────────────────────────────────────────

export function ConflictPrimaryActions({
  ctx, conflicts, lookups,
}: {
  ctx: CalendarContext
  conflicts: CalendarConflict[]
  lookups: CalendarLookups
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [assignOpen, setAssignOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const canResolve = canAccessCalendarCapability(ctx, 'conflicts.resolve')
  const canAssign = canAccessCalendarCapability(ctx, 'conflicts.assign')

  const firstUnresolved = conflicts.find(c => c.status !== 'resolved' && c.status !== 'dismissed')

  return (
    <>
      {canResolve && (
        <button
          type="button"
          disabled={!firstUnresolved}
          title={firstUnresolved ? `Open ${firstUnresolved.reference} in the resolution panel` : 'There are no open conflicts to resolve'}
          onClick={() => {
            if (!firstUnresolved) return
            const next = new URLSearchParams(params.toString())
            next.set('selected', firstUnresolved.id)
            router.push(`${pathname}?${next}`, { scroll: false })
          }}
          className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[11.5px] lg:text-[10px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50', T.focus)}
        >
          <ShieldCheck size={15} />Resolve conflict
        </button>
      )}
      {canAssign && (
        <button type="button" onClick={() => setAssignOpen(true)} disabled={!firstUnresolved}
          className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e3e7ed] bg-white px-3 text-[11.5px] lg:text-[10px] font-semibold text-slate-800 shadow-[0_1px_1px_rgba(16,24,40,0.03)] hover:bg-slate-50 disabled:opacity-50', T.focus)}>
          <UserPlus size={14} />Assign owner
        </button>
      )}

      {assignOpen && (
        <CalendarModal
          title="Assign conflicts"
          description="Assign every conflict currently shown to one owner."
          onClose={() => setAssignOpen(false)}
          footer={
            <>
              <button type="button" onClick={() => setAssignOpen(false)} className={cn('h-9 rounded-lg border border-slate-200 px-3 text-[13px] lg:text-[11.5px] font-medium text-slate-700 hover:bg-slate-50', T.focus)}>Cancel</button>
              <button type="submit" form="assign-conflicts" disabled={pending}
                className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[12.5px] lg:text-[11px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60', T.focus)}>
                {pending && <Loader2 size={14} className="animate-spin" />}Assign
              </button>
            </>
          }
        >
          <form
            id="assign-conflicts"
            onSubmit={event => {
              event.preventDefault()
              const assigneeId = String(new FormData(event.currentTarget).get('assigneeId') ?? '')
              const targets = conflicts.filter(c => c.status !== 'resolved' && c.status !== 'dismissed')
              startTransition(async () => {
                let failed = 0
                for (const conflict of targets) {
                  const result = await updateConflict({ basePath: ctx.basePath, id: conflict.id, assigneeId: assigneeId || null })
                  if (!result.ok) failed += 1
                }
                setAssignOpen(false)
                setToast(failed
                  ? { tone: 'error', message: `${failed} of ${targets.length} could not be assigned.` }
                  : { tone: 'success', message: `${targets.length} conflict${targets.length === 1 ? '' : 's'} assigned.` })
                router.refresh()
              })
            }}
            className="space-y-4"
          >
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-[12.5px] lg:text-[11px] text-slate-600">
              This applies to the {conflicts.filter(c => c.status !== 'resolved' && c.status !== 'dismissed').length} unresolved
              conflict(s) matching your current filters — not the whole workspace.
            </p>
            <DialogField label="Assign to" required>
              <select name="assigneeId" defaultValue="" required className={dialogInputClass}>
                <option value="" disabled>Choose a team member</option>
                {lookups.owners.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </DialogField>
          </form>
        </CalendarModal>
      )}
      {toast && <Toast tone={toast.tone} onDismiss={() => setToast(null)}>{toast.message}</Toast>}
    </>
  )
}

export { STATUS_CHIP, STATUS_LABEL }
