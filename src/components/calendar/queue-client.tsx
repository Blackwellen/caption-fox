'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircle, CalendarClock, Check, CheckCircle2, ChevronLeft, ChevronRight,
  ExternalLink, Loader2, MoreHorizontal, Pencil, Play, RefreshCw, Send, Trash2, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CalendarContext } from '@/lib/calendar/entitlements'
import { canAccessCalendarCapability } from '@/lib/calendar/entitlements'
import type { Priority, QueueItem } from '@/lib/calendar/types'
import { CHANNEL_LABELS } from '@/lib/calendar/constants'
import { formatDateTime, formatDuration, formatTime } from '@/lib/calendar/dates'
import {
  cancelQueueItems, publishNow, rescheduleQueueItems, retryQueueItem,
  setApprovalState, setQueuePriority,
} from '@/lib/calendar/actions'
import { Avatar, ChannelIcon, EmptyState, PriorityTag, T } from './primitives'

const APPROVAL_LABEL: Record<string, { label: string; className: string }> = {
  not_required: { label: 'Not required', className: 'bg-slate-100 text-slate-600' },
  awaiting_approval: { label: 'Awaiting approval', className: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-700' },
  changes_requested: { label: 'Changes requested', className: 'bg-orange-50 text-orange-700' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700' },
}

const DELIVERY_LABEL: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-slate-100 text-slate-600' },
  queued: { label: 'Queued', className: 'bg-sky-50 text-sky-700' },
  ready: { label: 'Ready', className: 'bg-emerald-50 text-emerald-700' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-50 text-blue-700' },
  processing: { label: 'Publishing', className: 'bg-violet-50 text-violet-700' },
  sent: { label: 'Published', className: 'bg-emerald-50 text-emerald-700' },
  published: { label: 'Published', className: 'bg-emerald-50 text-emerald-700' },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-700' },
  cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-500' },
}

function Chip({ map, value }: { map: Record<string, { label: string; className: string }>; value: string }) {
  const token = map[value] ?? { label: value, className: 'bg-slate-100 text-slate-600' }
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', token.className)}>{token.label}</span>
}

function Toast({ tone, children, onDismiss }: { tone: 'success' | 'error'; children: React.ReactNode; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 6000)
    return () => clearTimeout(timer)
  }, [onDismiss])
  return (
    <div role="status" aria-live="polite"
      className={cn('fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 items-start gap-2 rounded-xl px-4 py-3 text-[13px] shadow-lg',
        tone === 'success' ? 'bg-slate-900 text-white' : 'bg-red-600 text-white')}>
      {tone === 'success' ? <CheckCircle2 size={15} className="mt-0.5" /> : <AlertCircle size={15} className="mt-0.5" />}
      <span className="max-w-md">{children}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
    </div>
  )
}

// ── Lane strip ──────────────────────────────────────────────────────────────

const LANE_TONE: Record<string, string> = {
  draft: 'border-slate-200',
  awaiting_approval: 'border-amber-300',
  approved: 'border-blue-300',
  ready: 'border-emerald-300',
  scheduled: 'border-violet-300',
  failed: 'border-red-300',
}

export function QueueLanes({
  lanes, ctx,
}: {
  ctx: CalendarContext
  lanes: { id: string; label: string; count: number; preview: QueueItem[] }[]
}) {
  const params = useSearchParams()
  const pathname = usePathname()
  const active = params.get('lane')

  function laneHref(id: string) {
    const next = new URLSearchParams(params.toString())
    if (active === id) next.delete('lane'); else next.set('lane', id)
    next.delete('page')
    return next.size ? `${pathname}?${next}` : pathname
  }

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {lanes.map(lane => (
        <Link
          key={lane.id}
          href={laneHref(lane.id)}
          aria-pressed={active === lane.id}
          className={cn(
            'group rounded-xl border-t-[3px] bg-white p-3 ring-1 ring-slate-200 transition-shadow hover:shadow-sm',
            LANE_TONE[lane.id] ?? 'border-slate-200',
            active === lane.id && 'ring-2 ring-blue-400',
            T.focus,
          )}
        >
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-semibold text-slate-800">{lane.label}</p>
            <span className="text-[13px] font-bold text-slate-900">{lane.count}</span>
          </div>
          <ul className="mt-2.5 space-y-2">
            {lane.preview.length === 0 && <li className="text-[11.5px] text-slate-400">No items</li>}
            {lane.preview.map(item => (
              <li key={item.id} className="flex items-start gap-1.5">
                <ChannelIcon channel={item.channel} size={10} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] font-medium text-slate-700">{item.title}</span>
                  <span className="block truncate text-[10.5px] text-slate-400">
                    {CHANNEL_LABELS[item.channel ?? ''] ?? 'Unassigned'}
                    {item.scheduledAt ? ` · ${formatTime(item.scheduledAt, ctx.timezone, ctx.locale)}` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {lane.count > lane.preview.length && (
            <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] font-medium text-slate-500 group-hover:text-blue-600">
              + {lane.count - lane.preview.length} more
            </p>
          )}
        </Link>
      ))}
    </div>
  )
}

// ── Table ───────────────────────────────────────────────────────────────────

export function QueueTable({
  ctx, items, total, page, pageSize, sort, nowMs,
}: {
  ctx: CalendarContext
  items: QueueItem[]
  total: number
  page: number
  pageSize: number
  sort: string
  /** The request time from the server render — avoids calling Date.now() during render. */
  nowMs: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [selected, setSelected] = useState<string[]>([])
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [reschedule, setReschedule] = useState<string[] | null>(null)

  const canApprove = canAccessCalendarCapability(ctx, 'queue.approve')
  const canPublish = canAccessCalendarCapability(ctx, 'queue.publish')
  const canBulkPublish = canAccessCalendarCapability(ctx, 'queue.bulkPublish')
  const canEdit = canAccessCalendarCapability(ctx, 'queue.edit')
  const canCancel = canAccessCalendarCapability(ctx, 'queue.cancel')
  const canRetry = canAccessCalendarCapability(ctx, 'queue.retry')

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const allSelected = items.length > 0 && items.every(item => selected.includes(item.id))

  function setParam(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key); else next.set(key, value)
    }
    router.push(next.size ? `${pathname}?${next}` : pathname, { scroll: false })
  }

  function toggleSort(field: string) {
    const [current, dir] = sort.split(':')
    setParam({ sort: current === field && dir !== 'desc' ? `${field}:desc` : `${field}:asc`, page: null })
  }

  function run(label: string, fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>) {
    if (pending) return
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) { setToast({ tone: 'error', message: result.error ?? 'That action failed.' }); return }
      const blocked = (result.data as { blocked?: { reason: string }[] } | undefined)?.blocked ?? []
      setToast({
        tone: 'success',
        message: blocked.length
          ? `${label}. ${blocked.length} item${blocked.length === 1 ? ' was' : 's were'} skipped: ${[...new Set(blocked.map(b => b.reason))].join('; ')}.`
          : label,
      })
      setSelected([])
      setOpenMenu(null)
      router.refresh()
    })
  }

  return (
    <>
      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5">
          <p className="text-[13px] font-medium text-blue-900">{selected.length} selected</p>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {canApprove && (
              <BulkButton onClick={() => run('Approval updated', () => setApprovalState({ basePath: ctx.basePath, ids: selected, state: 'approved' }))} pending={pending}>
                <Check size={13} />Approve
              </BulkButton>
            )}
            {(selected.length > 1 ? canBulkPublish : canPublish) && (
              <BulkButton onClick={() => run('Handed to the publishing worker', () => publishNow({ basePath: ctx.basePath, ids: selected }))} pending={pending}>
                <Send size={13} />Publish
              </BulkButton>
            )}
            {canEdit && (
              <BulkButton onClick={() => setReschedule(selected)} pending={pending}>
                <CalendarClock size={13} />Reschedule
              </BulkButton>
            )}
            {canEdit && (
              <select
                aria-label="Set priority"
                defaultValue=""
                onChange={e => e.target.value && run('Priority updated', () => setQueuePriority({ basePath: ctx.basePath, ids: selected, priority: e.target.value as Priority }))}
                className={cn(T.control, T.focus, 'h-8')}
              >
                <option value="" disabled>Priority…</option>
                <option value="urgent">Urgent</option><option value="high">High</option>
                <option value="medium">Medium</option><option value="low">Low</option>
              </select>
            )}
            {canCancel && (
              <BulkButton
                destructive
                onClick={() => {
                  if (!window.confirm(`Cancel ${selected.length} queued item${selected.length === 1 ? '' : 's'}? This stops them publishing.`)) return
                  run('Items cancelled', () => cancelQueueItems({ basePath: ctx.basePath, ids: selected }))
                }}
                pending={pending}
              >
                <Trash2 size={13} />Cancel
              </BulkButton>
            )}
            <button type="button" onClick={() => setSelected([])} className={cn('px-2 text-[12.5px] font-medium text-blue-700 hover:underline', T.focus)}>Clear</button>
          </div>
        </div>
      )}

      <div className={cn(T.card, 'overflow-hidden')}>
        {items.length === 0 ? (
          <EmptyState
            icon={<Send size={18} />}
            title="No queue items match"
            body="Adjust the filters or lane selection, or queue content from Studio to see it here."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left">
                <caption className="sr-only">Publishing queue — {total} items</caption>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th scope="col" className="w-10 px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        aria-label="Select all rows on this page"
                        onChange={e => setSelected(e.target.checked ? items.map(i => i.id) : [])}
                        className="h-3.5 w-3.5 rounded border-slate-300"
                      />
                    </th>
                    <SortHeader field="title" sort={sort} onSort={toggleSort}>Item</SortHeader>
                    <SortHeader field="channel" sort={sort} onSort={toggleSort}>Channel</SortHeader>
                    <th scope="col" className="px-3 py-2.5">Campaign</th>
                    <SortHeader field="owner" sort={sort} onSort={toggleSort}>Owner</SortHeader>
                    <SortHeader field="scheduled_at" sort={sort} onSort={toggleSort}>Scheduled time</SortHeader>
                    <SortHeader field="approval" sort={sort} onSort={toggleSort}>Approval status</SortHeader>
                    <SortHeader field="delivery" sort={sort} onSort={toggleSort}>Delivery status</SortHeader>
                    <SortHeader field="priority" sort={sort} onSort={toggleSort}>Priority</SortHeader>
                    <th scope="col" className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map(item => (
                    <tr key={item.id} className={cn('hover:bg-slate-50', selected.includes(item.id) && 'bg-blue-50/40')}>
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={selected.includes(item.id)}
                          aria-label={`Select ${item.title}`}
                          onChange={e => setSelected(current => e.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))}
                          className="h-3.5 w-3.5 rounded border-slate-300"
                        />
                      </td>
                      <td className="max-w-[220px] px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100">
                            {item.thumbnailUrl
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                              : <ChannelIcon channel={item.channel} size={13} />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-medium text-slate-900">{item.title}</span>
                            <span className="block truncate text-[11.5px] text-slate-500">{item.subtitle ?? '—'}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><ChannelIcon channel={item.channel} size={13} /></td>
                      <td className="max-w-[150px] px-3 py-2.5">
                        {item.campaignId
                          ? <Link href={`${ctx.basePath}/campaigns/detail-${item.campaignId}`} className={cn('block truncate text-[12.5px] font-medium text-blue-600 hover:underline', T.focus)}>{item.campaignName}</Link>
                          : <span className="text-[12.5px] text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <Avatar name={item.ownerName} size={22} />
                          <span className="hidden max-w-[110px] truncate text-[12.5px] text-slate-700 xl:block">{item.ownerName ?? 'Unassigned'}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px] text-slate-700">
                        {item.scheduledAt ? formatDateTime(item.scheduledAt, ctx.timezone, ctx.locale) : '—'}
                        {item.slaDueAt && new Date(item.slaDueAt).getTime() < nowMs && !['published', 'sent', 'cancelled'].includes(item.deliveryStatus) && (
                          <span className="ml-1.5 rounded bg-red-50 px-1.5 py-0.5 text-[10.5px] font-medium text-red-700">
                            {formatDuration(nowMs - new Date(item.slaDueAt).getTime())} late
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5"><Chip map={APPROVAL_LABEL} value={item.approvalStatus} /></td>
                      <td className="px-3 py-2.5">
                        <Chip map={DELIVERY_LABEL} value={item.deliveryStatus} />
                        {item.failureCode && <span className="mt-0.5 block max-w-[140px] truncate text-[10.5px] text-red-600" title={item.failureMessage ?? item.failureCode}>{item.failureCode}</span>}
                      </td>
                      <td className="px-3 py-2.5"><PriorityTag priority={item.priority} /></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {canPublish && (
                            <IconButton
                              label={`Publish ${item.title} now`}
                              disabled={pending || ['published', 'sent', 'cancelled'].includes(item.deliveryStatus) || item.approvalStatus === 'awaiting_approval' || !item.providerConnected}
                              title={
                                !item.providerConnected ? 'Connect this channel in Settings › Channels first'
                                : item.approvalStatus === 'awaiting_approval' ? 'Waiting on approval'
                                : ['published', 'sent'].includes(item.deliveryStatus) ? 'Already published'
                                : 'Publish now'
                              }
                              onClick={() => run('Handed to the publishing worker', () => publishNow({ basePath: ctx.basePath, ids: [item.id] }))}
                            >
                              <Play size={14} />
                            </IconButton>
                          )}
                          {item.postId && (
                            <Link href={`${ctx.basePath}/studio/detail-${item.postId}`} aria-label={`Open ${item.title}`}
                              className={cn('flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700', T.focus)}>
                              <ExternalLink size={14} />
                            </Link>
                          )}
                          <div className="relative">
                            <IconButton label={`More actions for ${item.title}`} onClick={() => setOpenMenu(openMenu === item.id ? null : item.id)}>
                              <MoreHorizontal size={15} />
                            </IconButton>
                            {openMenu === item.id && (
                              <>
                                <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close menu" onClick={() => setOpenMenu(null)} />
                                <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1 text-left shadow-lg">
                                  {canApprove && item.approvalStatus !== 'approved' && (
                                    <MenuItem onClick={() => run('Approved', () => setApprovalState({ basePath: ctx.basePath, ids: [item.id], state: 'approved' }))}><Check size={13} />Approve</MenuItem>
                                  )}
                                  {canApprove && item.approvalStatus === 'awaiting_approval' && (
                                    <MenuItem onClick={() => run('Changes requested', () => setApprovalState({ basePath: ctx.basePath, ids: [item.id], state: 'changes_requested' }))}><Pencil size={13} />Request changes</MenuItem>
                                  )}
                                  {canEdit && <MenuItem onClick={() => { setReschedule([item.id]); setOpenMenu(null) }}><CalendarClock size={13} />Reschedule</MenuItem>}
                                  {canRetry && item.deliveryStatus === 'failed' && (
                                    <MenuItem onClick={() => run('Queued for retry', () => retryQueueItem({ basePath: ctx.basePath, id: item.id }))}><RefreshCw size={13} />Retry publish</MenuItem>
                                  )}
                                  {canCancel && !['published', 'sent', 'cancelled'].includes(item.deliveryStatus) && (
                                    <MenuItem destructive onClick={() => {
                                      if (!window.confirm(`Cancel "${item.title}"? It will not publish.`)) return
                                      run('Item cancelled', () => cancelQueueItems({ basePath: ctx.basePath, ids: [item.id] }))
                                    }}><Trash2 size={13} />Cancel item</MenuItem>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5">
              <p className="text-[12.5px] text-slate-500">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} items
              </p>
              <div className="flex items-center gap-2">
                <nav aria-label="Pagination" className="flex items-center gap-0.5">
                  <PageButton disabled={page <= 1} onClick={() => setParam({ page: String(page - 1) })} label="Previous page"><ChevronLeft size={14} /></PageButton>
                  {pageNumbers(page, pageCount).map((n, i) => n === '…' ? (
                    <span key={`gap-${i}`} className="px-1.5 text-[12.5px] text-slate-400">…</span>
                  ) : (
                    <button key={n} type="button" onClick={() => setParam({ page: String(n) })} aria-current={n === page ? 'page' : undefined}
                      className={cn('h-7 min-w-7 rounded-md px-2 text-[12.5px] font-medium', n === page ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100', T.focus)}>
                      {n}
                    </button>
                  ))}
                  <PageButton disabled={page >= pageCount} onClick={() => setParam({ page: String(page + 1) })} label="Next page"><ChevronRight size={14} /></PageButton>
                </nav>
                <select
                  aria-label="Rows per page"
                  value={String(pageSize)}
                  onChange={e => setParam({ pageSize: e.target.value, page: null })}
                  className={cn(T.control, T.focus, 'h-8')}
                >
                  {[10, 25, 50, 100].map(size => <option key={size} value={size}>{size} / page</option>)}
                </select>
              </div>
            </div>
          </>
        )}
      </div>

      {reschedule && (
        <RescheduleDialog
          count={reschedule.length}
          onClose={() => setReschedule(null)}
          onSubmit={(date, time) => {
            run('Rescheduled', () => rescheduleQueueItems({ basePath: ctx.basePath, ids: reschedule, date, time }))
            setReschedule(null)
          }}
        />
      )}
      {toast && <Toast tone={toast.tone} onDismiss={() => setToast(null)}>{toast.message}</Toast>}
    </>
  )
}

function pageNumbers(page: number, count: number): (number | '…')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  const start = Math.max(2, page - 1), end = Math.min(count - 1, page + 1)
  if (start > 2) out.push('…')
  for (let i = start; i <= end; i++) out.push(i)
  if (end < count - 1) out.push('…')
  out.push(count)
  return out
}

function SortHeader({ field, sort, onSort, children }: { field: string; sort: string; onSort: (field: string) => void; children: React.ReactNode }) {
  const [current, dir] = sort.split(':')
  const active = current === field
  return (
    <th scope="col" className="px-3 py-2.5" aria-sort={active ? (dir === 'desc' ? 'descending' : 'ascending') : 'none'}>
      <button type="button" onClick={() => onSort(field)} className={cn('inline-flex items-center gap-1 uppercase hover:text-slate-800', active && 'text-slate-800', T.focus)}>
        {children}
        <span aria-hidden className={cn('text-[9px]', !active && 'opacity-30')}>{active && dir === 'desc' ? '▼' : '▲'}</span>
      </button>
    </th>
  )
}

function IconButton({ label, children, onClick, disabled, title }: {
  label: string; children: React.ReactNode; onClick: () => void; disabled?: boolean; title?: string
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={title ?? label}
      className={cn('flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40', T.focus)}>
      {children}
    </button>
  )
}

function MenuItem({ children, onClick, destructive }: { children: React.ReactNode; onClick: () => void; destructive?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-slate-50', destructive ? 'text-red-600' : 'text-slate-700')}>
      {children}
    </button>
  )
}

function BulkButton({ children, onClick, pending, destructive }: {
  children: React.ReactNode; onClick: () => void; pending: boolean; destructive?: boolean
}) {
  return (
    <button type="button" onClick={onClick} disabled={pending}
      className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium disabled:opacity-50',
        destructive ? 'border-red-200 bg-white text-red-600 hover:bg-red-50' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50', T.focus)}>
      {pending ? <Loader2 size={13} className="animate-spin" /> : children}
    </button>
  )
}

function PageButton({ children, onClick, disabled, label }: { children: React.ReactNode; onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label}
      className={cn('flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30', T.focus)}>
      {children}
    </button>
  )
}

function RescheduleDialog({ count, onClose, onSubmit }: { count: number; onClose: () => void; onSubmit: (date: string, time: string) => void }) {
  const dateRef = useRef<HTMLInputElement>(null)
  const timeRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="Reschedule items">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="text-[15px] font-semibold text-slate-900">Reschedule {count} item{count === 1 ? '' : 's'}</h2>
        <p className="mt-1 text-[12.5px] text-slate-500">Published and cancelled items are left unchanged.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-[12px] font-medium text-slate-600">New date
            <input ref={dateRef} type="date" required className={cn(T.control, T.focus, 'mt-1 w-full')} />
          </label>
          <label className="text-[12px] font-medium text-slate-600">New time
            <input ref={timeRef} type="time" defaultValue="09:00" required className={cn(T.control, T.focus, 'mt-1 w-full')} />
          </label>
        </div>
        {error && <p role="alert" className="mt-2 text-[12px] text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={cn('h-9 rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50', T.focus)}>Cancel</button>
          <button type="button"
            onClick={() => {
              const date = dateRef.current?.value, time = timeRef.current?.value
              if (!date || !time) { setError('Choose both a date and a time.'); return }
              onSubmit(date, time)
            }}
            className={cn('h-9 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700', T.focus)}>
            Reschedule
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Header primary action ───────────────────────────────────────────────────

export function QueuePrimaryActions({ ctx, publishableIds }: { ctx: CalendarContext; publishableIds: string[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const canCreate = canAccessCalendarCapability(ctx, 'queue.create')
  const canBulk = canAccessCalendarCapability(ctx, 'queue.bulkPublish')

  return (
    <>
      {canCreate && (
        <Link href={`${ctx.basePath}/studio/compose`}
          className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700', T.focus)}>
          <Send size={14} />Queue item
        </Link>
      )}
      {canBulk && (
        <button
          type="button"
          disabled={pending || publishableIds.length === 0}
          title={publishableIds.length === 0 ? 'No approved items are ready to publish' : `Publish ${publishableIds.length} ready item${publishableIds.length === 1 ? '' : 's'}`}
          onClick={() => {
            if (!window.confirm(`Publish ${publishableIds.length} ready item${publishableIds.length === 1 ? '' : 's'} now?`)) return
            startTransition(async () => {
              const result = await publishNow({ basePath: ctx.basePath, ids: publishableIds })
              setToast(result.ok
                ? { tone: 'success', message: `${result.data?.queued ?? 0} item(s) handed to the publishing worker.` }
                : { tone: 'error', message: result.error ?? 'Bulk publish failed.' })
              router.refresh()
            })
          }}
          className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50', T.focus)}
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}Bulk publish
        </button>
      )}
      {toast && <Toast tone={toast.tone} onDismiss={() => setToast(null)}>{toast.message}</Toast>}
    </>
  )
}
