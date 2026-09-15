'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, ExternalLink, Loader2, MoveRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScheduleEntry } from '@/lib/calendar/types'
import {
  formatDayLabel, formatTime, monthGridDays, weekdayLabels, zonedDateKey, zonedMinutes,
  formatMonthTitle, todayKey, startOfWeekUtc, formatShortDate,
} from '@/lib/calendar/dates'
import { rescheduleEntry } from '@/lib/calendar/actions'
import { Avatar, ChannelIcon, EmptyState, KindIcon, STATUS_TOKENS, StatusBadge, T } from './primitives'

export interface ViewProps {
  entries: ScheduleEntry[]
  anchorIso: string
  timezone: string
  locale: string
  weekStartsOn: 0 | 1
  basePath: string
  canReschedule: boolean
}

// ── Event block ─────────────────────────────────────────────────────────────

function EventBlock({
  entry, timezone, locale, onOpen, draggable, compact,
}: {
  entry: ScheduleEntry
  timezone: string
  locale: string
  onOpen: (entry: ScheduleEntry) => void
  draggable: boolean
  compact?: boolean
}) {
  const token = STATUS_TOKENS[entry.status] ?? STATUS_TOKENS.scheduled
  const time = entry.allDay ? 'All day' : formatTime(entry.startAt, timezone, locale)
  return (
    <button
      type="button"
      draggable={draggable && entry.editable}
      onDragStart={event => {
        event.dataTransfer.setData('text/calendar-entry', entry.id)
        event.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => onOpen(entry)}
      title={`${time} · ${entry.title} · ${token.label}`}
      className={cn(
        'group block w-full rounded-[5px] border px-1.5 py-1 text-left transition-shadow hover:shadow-sm',
        token.block, T.focus,
        entry.conflictIds.length > 0 && 'ring-1 ring-red-300',
        compact ? 'leading-tight' : '',
      )}
    >
      <span className="flex items-center gap-1">
        <span className="truncate text-[10px] font-semibold opacity-80">{time}</span>
        {entry.channel && <ChannelIcon channel={entry.channel} size={9} className="ml-auto !h-3.5 !w-3.5" />}
      </span>
      <span className="mt-0.5 flex items-center gap-1">
        <span className="truncate text-[11px] font-medium">{entry.title}</span>
      </span>
      <span className="sr-only">
        {entry.title}, {token.label}, {formatShortDate(entry.startAt, timezone, locale)} {time}
        {entry.conflictIds.length > 0 ? `, ${entry.conflictIds.length} conflict` : ''}
      </span>
    </button>
  )
}

// ── Detail drawer ───────────────────────────────────────────────────────────

function EntryDrawer({
  entry, onClose, timezone, locale, basePath, canReschedule,
}: {
  entry: ScheduleEntry
  onClose: () => void
  timezone: string
  locale: string
  basePath: string
  canReschedule: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [moveValue, setMoveValue] = useState(() => {
    const d = new Date(entry.startAt)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  })

  function move() {
    setError(null)
    startTransition(async () => {
      const result = await rescheduleEntry({ basePath, entryId: entry.id, startAt: new Date(moveValue).toISOString() })
      if (!result.ok) { setError(result.error ?? 'Could not move this item.'); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={entry.title}>
      <button type="button" className="absolute inset-0 bg-slate-900/30" aria-label="Close" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              <KindIcon kind={entry.kind} size={12} />{entry.kind}
            </p>
            <h2 className="mt-1 text-[17px] font-semibold text-slate-900">{entry.title}</h2>
            <p className="mt-1 text-[12.5px] text-slate-500">
              {entry.allDay ? 'All day' : formatTime(entry.startAt, timezone, locale)} · {formatShortDate(entry.startAt, timezone, locale)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={cn('rounded-lg p-1.5 text-slate-400 hover:bg-slate-100', T.focus)}>
            <X size={17} />
          </button>
        </header>

        <div className="flex-1 space-y-4 px-5 py-4">
          <dl className="grid grid-cols-2 gap-3 text-[13px]">
            <Field label="Status"><StatusBadge status={entry.status} /></Field>
            <Field label="Priority"><span className="capitalize text-slate-800">{entry.priority}</span></Field>
            <Field label="Channel">{entry.channel ? <span className="flex items-center gap-1.5"><ChannelIcon channel={entry.channel} size={12} /><span className="capitalize text-slate-800">{entry.channel}</span></span> : <span className="text-slate-400">—</span>}</Field>
            <Field label="Owner">{entry.ownerName ? <span className="flex items-center gap-1.5"><Avatar name={entry.ownerName} size={20} /><span className="truncate text-slate-800">{entry.ownerName}</span></span> : <span className="text-slate-400">Unassigned</span>}</Field>
            <Field label="Campaign"><span className="truncate text-slate-800">{entry.campaignName ?? '—'}</span></Field>
            <Field label="Timezone"><span className="text-slate-800">{entry.timezone}</span></Field>
          </dl>

          {entry.subtitle && (
            <div>
              <p className={T.label}>Details</p>
              <p className="mt-1 whitespace-pre-line text-[13px] leading-5 text-slate-600">{entry.subtitle}</p>
            </div>
          )}

          {entry.conflictIds.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-[12.5px] font-semibold text-red-800">
                {entry.conflictIds.length} scheduling conflict{entry.conflictIds.length === 1 ? '' : 's'}
              </p>
              <Link href={`${basePath}/calendar/conflicts`} className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-medium text-red-700 underline">
                Review in Conflicts <ExternalLink size={12} />
              </Link>
            </div>
          )}

          {canReschedule && entry.editable && (
            <div className="rounded-lg border border-slate-200 p-3">
              <label className="block text-[12px] font-medium text-slate-600">
                Move to
                <input
                  type="datetime-local"
                  value={moveValue}
                  onChange={e => setMoveValue(e.target.value)}
                  className={cn(T.control, T.focus, 'mt-1 w-full')}
                />
              </label>
              <p className="mt-1 text-[11px] text-slate-400">Times are shown in UTC and stored against {entry.timezone}.</p>
              <button
                type="button"
                onClick={move}
                disabled={pending}
                className={cn('mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60', T.focus)}
              >
                {pending ? <Loader2 size={14} className="animate-spin" /> : <MoveRight size={14} />}
                {pending ? 'Moving…' : 'Reschedule'}
              </button>
              {error && <p role="alert" className="mt-2 text-[12px] text-red-600">{error}</p>}
            </div>
          )}
        </div>

        {entry.href && (
          <footer className="border-t border-slate-200 px-5 py-3">
            <Link href={entry.href} className={cn('inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:bg-slate-50', T.focus)}>
              Open record <ExternalLink size={13} />
            </Link>
          </footer>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className={T.label}>{label}</dt>
      <dd className="mt-1 min-w-0">{children}</dd>
    </div>
  )
}

// ── Month ───────────────────────────────────────────────────────────────────

const MAX_PER_CELL = 1

export function MonthView(props: ViewProps) {
  const { entries, anchorIso, timezone, locale, weekStartsOn, basePath, canReschedule } = props
  const router = useRouter()
  const [selected, setSelected] = useState<ScheduleEntry | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const days = useMemo(() => monthGridDays(new Date(anchorIso), weekStartsOn, timezone), [anchorIso, weekStartsOn, timezone])
  const labels = useMemo(() => weekdayLabels(weekStartsOn, locale), [weekStartsOn, locale])

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>()
    for (const entry of entries) {
      const key = zonedDateKey(entry.startAt, timezone)
      const list = map.get(key) ?? []
      list.push(entry)
      map.set(key, list)
    }
    for (const list of map.values()) list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startAt.localeCompare(b.startAt))
    return map
  }, [entries, timezone])

  function drop(dayKey: string, event: React.DragEvent) {
    event.preventDefault()
    setDragOver(null)
    const entryId = event.dataTransfer.getData('text/calendar-entry')
    const entry = entries.find(e => e.id === entryId)
    if (!entry || !canReschedule) return
    const original = new Date(entry.startAt)
    const [y, m, d] = dayKey.split('-').map(Number)
    const next = new Date(Date.UTC(y, m - 1, d, original.getUTCHours(), original.getUTCMinutes()))
    startTransition(async () => {
      const result = await rescheduleEntry({ basePath, entryId: entry.id, startAt: next.toISOString() })
      if (result.ok) router.refresh()
    })
  }

  return (
    <>
      <div className={cn(T.card, 'overflow-hidden')}>
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80" role="row">
          {labels.map(label => (
            <div key={label} role="columnheader" className="px-3 py-2.5 text-center text-[12px] font-semibold text-slate-600">{label}</div>
          ))}
        </div>
        <div className="grid grid-cols-7" role="grid" aria-label={`${formatMonthTitle(anchorIso, timezone, locale)} calendar`}>
          {days.map(day => {
            const dayEntries = byDay.get(day.key) ?? []
            const isExpanded = expanded === day.key
            const visible = isExpanded ? dayEntries : dayEntries.slice(0, MAX_PER_CELL)
            const overflow = dayEntries.length - visible.length
            return (
              <div
                key={day.key}
                role="gridcell"
                aria-label={`${formatDayLabel(day.iso, timezone, locale)}, ${dayEntries.length} item${dayEntries.length === 1 ? '' : 's'}`}
                onDragOver={e => { if (canReschedule) { e.preventDefault(); setDragOver(day.key) } }}
                onDragLeave={() => setDragOver(current => current === day.key ? null : current)}
                onDrop={e => drop(day.key, e)}
                className={cn(
                  'min-h-[74px] border-b border-r border-slate-100 p-1.5 transition-colors last:border-r-0',
                  !day.inMonth && 'bg-slate-50/50',
                  dragOver === day.key && 'bg-blue-50 ring-1 ring-inset ring-blue-300',
                )}
              >
                <div className="mb-1 flex items-center justify-between px-0.5">
                  <span className={cn(
                    'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold',
                    day.isToday ? 'bg-blue-600 text-white' : day.inMonth ? 'text-slate-700' : 'text-slate-400',
                  )}>
                    {day.dayOfMonth}
                  </span>
                </div>
                <div className="space-y-1">
                  {visible.map(entry => (
                    <EventBlock key={entry.id} entry={entry} timezone={timezone} locale={locale} onOpen={setSelected} draggable={canReschedule} compact />
                  ))}
                  {overflow > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : day.key)}
                      className={cn('w-full rounded px-1 text-left text-[10.5px] font-medium text-slate-500 hover:text-blue-600', T.focus)}
                    >
                      +{overflow} more
                    </button>
                  )}
                  {isExpanded && (
                    <button type="button" onClick={() => setExpanded(null)}
                      className={cn('w-full rounded px-1 text-left text-[10.5px] font-medium text-blue-600', T.focus)}>
                      Show less
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {selected && (
        <EntryDrawer entry={selected} onClose={() => setSelected(null)} timezone={timezone} locale={locale} basePath={basePath} canReschedule={canReschedule} />
      )}
    </>
  )
}

// ── Week / Day timeline ─────────────────────────────────────────────────────

const DAY_START_HOUR = 7
const DAY_END_HOUR = 21
const HOUR_HEIGHT = 48

function TimelineColumn({
  dayKey, dayIso, entries, timezone, locale, onOpen, canReschedule, onDrop,
}: {
  dayKey: string
  dayIso: string
  entries: ScheduleEntry[]
  timezone: string
  locale: string
  onOpen: (entry: ScheduleEntry) => void
  canReschedule: boolean
  onDrop: (dayKey: string, minutes: number, event: React.DragEvent) => void
}) {
  const timed = entries.filter(e => !e.allDay)
  // Simple side-by-side layout for overlapping items.
  const lanes: ScheduleEntry[][] = []
  for (const entry of timed.sort((a, b) => a.startAt.localeCompare(b.startAt))) {
    const start = zonedMinutes(entry.startAt, timezone)
    const end = entry.endAt ? zonedMinutes(entry.endAt, timezone) : start + 30
    const lane = lanes.find(l => {
      const last = l[l.length - 1]
      const lastEnd = last.endAt ? zonedMinutes(last.endAt, timezone) : zonedMinutes(last.startAt, timezone) + 30
      return lastEnd <= start
    })
    void end
    if (lane) lane.push(entry); else lanes.push([entry])
  }

  return (
    <div
      className="relative border-r border-slate-100 last:border-r-0"
      style={{ height: (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT }}
      onDragOver={e => { if (canReschedule) e.preventDefault() }}
      onDrop={e => {
        const rect = e.currentTarget.getBoundingClientRect()
        const minutes = DAY_START_HOUR * 60 + Math.round(((e.clientY - rect.top) / HOUR_HEIGHT) * 60 / 15) * 15
        onDrop(dayKey, minutes, e)
      }}
      aria-label={formatDayLabel(dayIso, timezone, locale)}
    >
      {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }).map((_, i) => (
        <div key={i} className="border-b border-slate-100" style={{ height: HOUR_HEIGHT }} />
      ))}
      {lanes.map((lane, laneIndex) => lane.map(entry => {
        const start = zonedMinutes(entry.startAt, timezone)
        const end = entry.endAt ? zonedMinutes(entry.endAt, timezone) : start + 30
        const top = ((start - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT
        const height = Math.max(22, ((end - start) / 60) * HOUR_HEIGHT - 2)
        return (
          <div
            key={entry.id}
            className="absolute px-0.5"
            style={{
              top: Math.max(0, top),
              height,
              left: `${(laneIndex / lanes.length) * 100}%`,
              width: `${100 / lanes.length}%`,
            }}
          >
            <EventBlock entry={entry} timezone={timezone} locale={locale} onOpen={onOpen} draggable={canReschedule} compact />
          </div>
        )
      }))}
    </div>
  )
}

export function WeekView(props: ViewProps) {
  const { entries, anchorIso, timezone, locale, weekStartsOn, basePath, canReschedule } = props
  const router = useRouter()
  const [selected, setSelected] = useState<ScheduleEntry | null>(null)
  const [, startTransition] = useTransition()

  const weekStart = useMemo(() => startOfWeekUtc(new Date(anchorIso), weekStartsOn, timezone), [anchorIso, weekStartsOn, timezone])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const iso = new Date(weekStart.getTime() + i * 86400000).toISOString()
    return { iso, key: zonedDateKey(iso, timezone) }
  }), [weekStart, timezone])

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>()
    for (const entry of entries) {
      const key = zonedDateKey(entry.startAt, timezone)
      const list = map.get(key) ?? []
      list.push(entry)
      map.set(key, list)
    }
    return map
  }, [entries, timezone])

  function handleDrop(dayKey: string, minutes: number, event: React.DragEvent) {
    event.preventDefault()
    const entryId = event.dataTransfer.getData('text/calendar-entry')
    const entry = entries.find(e => e.id === entryId)
    if (!entry || !canReschedule) return
    const [y, m, d] = dayKey.split('-').map(Number)
    const next = new Date(Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60))
    startTransition(async () => {
      const result = await rescheduleEntry({ basePath, entryId: entry.id, startAt: next.toISOString() })
      if (result.ok) router.refresh()
    })
  }

  const today = todayKey(timezone)

  return (
    <>
      <div className={cn(T.card, 'overflow-hidden')}>
        <div className="grid" style={{ gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))' }}>
          <div className="border-b border-r border-slate-200 bg-slate-50/80" />
          {days.map(day => (
            <div key={day.key} className={cn('border-b border-r border-slate-200 bg-slate-50/80 px-2 py-2 text-center last:border-r-0', day.key === today && 'bg-blue-50')}>
              <p className="text-[11px] font-medium uppercase text-slate-500">{new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: timezone }).format(new Date(day.iso))}</p>
              <p className={cn('text-[15px] font-semibold', day.key === today ? 'text-blue-700' : 'text-slate-800')}>
                {new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: timezone }).format(new Date(day.iso))}
              </p>
            </div>
          ))}

          {/* All-day row */}
          <div className="border-b border-r border-slate-200 px-2 py-1.5 text-right text-[10px] font-medium uppercase text-slate-400">All day</div>
          {days.map(day => (
            <div key={`allday-${day.key}`} className="min-h-[34px] space-y-1 border-b border-r border-slate-200 p-1 last:border-r-0">
              {(byDay.get(day.key) ?? []).filter(e => e.allDay).map(entry => (
                <EventBlock key={entry.id} entry={entry} timezone={timezone} locale={locale} onOpen={setSelected} draggable={canReschedule} compact />
              ))}
            </div>
          ))}
        </div>

        <div className="grid overflow-x-auto" style={{ gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))' }}>
          <div>
            {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }).map((_, i) => (
              <div key={i} className="border-b border-r border-slate-100 pr-2 text-right text-[10.5px] text-slate-400" style={{ height: HOUR_HEIGHT }}>
                <span className="relative -top-1.5">{String(DAY_START_HOUR + i).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>
          {days.map(day => (
            <TimelineColumn
              key={day.key}
              dayKey={day.key}
              dayIso={day.iso}
              entries={byDay.get(day.key) ?? []}
              timezone={timezone}
              locale={locale}
              onOpen={setSelected}
              canReschedule={canReschedule}
              onDrop={handleDrop}
            />
          ))}
        </div>
      </div>
      {selected && <EntryDrawer entry={selected} onClose={() => setSelected(null)} timezone={timezone} locale={locale} basePath={basePath} canReschedule={canReschedule} />}
    </>
  )
}

export function DayView(props: ViewProps) {
  const { entries, anchorIso, timezone, locale, basePath, canReschedule } = props
  const router = useRouter()
  const [selected, setSelected] = useState<ScheduleEntry | null>(null)
  const [, startTransition] = useTransition()
  const dayKey = zonedDateKey(anchorIso, timezone)
  const dayEntries = entries.filter(e => zonedDateKey(e.startAt, timezone) === dayKey)

  function handleDrop(key: string, minutes: number, event: React.DragEvent) {
    event.preventDefault()
    const entryId = event.dataTransfer.getData('text/calendar-entry')
    const entry = entries.find(e => e.id === entryId)
    if (!entry || !canReschedule) return
    const [y, m, d] = key.split('-').map(Number)
    const next = new Date(Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60))
    startTransition(async () => {
      const result = await rescheduleEntry({ basePath, entryId: entry.id, startAt: next.toISOString() })
      if (result.ok) router.refresh()
    })
  }

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <div className={cn(T.card, 'overflow-hidden')}>
          <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-2.5">
            <p className="text-[13px] font-semibold text-slate-800">{formatDayLabel(anchorIso, timezone, locale)}</p>
          </div>
          <div className="border-b border-slate-200 p-2">
            <p className="mb-1 text-[10px] font-medium uppercase text-slate-400">All day</p>
            <div className="space-y-1">
              {dayEntries.filter(e => e.allDay).map(entry => (
                <EventBlock key={entry.id} entry={entry} timezone={timezone} locale={locale} onOpen={setSelected} draggable={canReschedule} />
              ))}
              {dayEntries.filter(e => e.allDay).length === 0 && <p className="px-1 text-[12px] text-slate-400">No all-day items</p>}
            </div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '56px minmax(0, 1fr)' }}>
            <div>
              {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }).map((_, i) => (
                <div key={i} className="border-b border-r border-slate-100 pr-2 text-right text-[10.5px] text-slate-400" style={{ height: HOUR_HEIGHT }}>
                  <span className="relative -top-1.5">{String(DAY_START_HOUR + i).padStart(2, '0')}:00</span>
                </div>
              ))}
            </div>
            <TimelineColumn
              dayKey={dayKey} dayIso={anchorIso} entries={dayEntries}
              timezone={timezone} locale={locale} onOpen={setSelected}
              canReschedule={canReschedule} onDrop={handleDrop}
            />
          </div>
        </div>
        <aside className={cn(T.card, 'h-fit p-5')}>
          <h2 className={T.sectionTitle}>Day summary</h2>
          <dl className="mt-3 space-y-2.5 text-[13px]">
            <SummaryRow label="Total items" value={dayEntries.length} />
            <SummaryRow label="Publishing" value={dayEntries.filter(e => e.kind === 'content' || e.kind === 'publishing').length} />
            <SummaryRow label="Meetings" value={dayEntries.filter(e => e.kind === 'meeting').length} />
            <SummaryRow label="Tasks due" value={dayEntries.filter(e => e.kind === 'task').length} />
            <SummaryRow label="Conflicts" value={dayEntries.filter(e => e.conflictIds.length > 0).length} />
          </dl>
        </aside>
      </div>
      {selected && <EntryDrawer entry={selected} onClose={() => setSelected(null)} timezone={timezone} locale={locale} basePath={basePath} canReschedule={canReschedule} />}
    </>
  )
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  )
}

// ── Agenda ──────────────────────────────────────────────────────────────────

export function AgendaView({
  days, timezone, locale, basePath, canReschedule, dense,
}: {
  days: { date: string; label: string; isToday: boolean; allDay: ScheduleEntry[]; timed: ScheduleEntry[]; count: number }[]
  timezone: string
  locale: string
  basePath: string
  canReschedule: boolean
  dense?: boolean
}) {
  const [selected, setSelected] = useState<ScheduleEntry | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  if (days.length === 0) {
    return (
      <div className={T.card}>
        <EmptyState
          title="Nothing scheduled in this period"
          body="Adjust the date range or filters, or add a new schedule item to start planning this week."
        />
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {days.map(day => {
          const isCollapsed = collapsed[day.date]
          const items = [...day.allDay, ...day.timed]
          return (
            <section key={day.date} className={cn(T.card, 'overflow-hidden')}>
              <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
                <h3 className="flex items-center gap-2 text-[14px] font-semibold text-slate-900">
                  {day.label}
                  {day.isToday && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">Today</span>}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-slate-500">{day.count} item{day.count === 1 ? '' : 's'}</span>
                  <button
                    type="button"
                    onClick={() => setCollapsed(c => ({ ...c, [day.date]: !isCollapsed }))}
                    aria-expanded={!isCollapsed}
                    aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${day.label}`}
                    className={cn('rounded-md p-1 text-slate-400 hover:bg-slate-100', T.focus)}
                  >
                    {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  </button>
                </div>
              </header>
              {!isCollapsed && (
                <ul className="divide-y divide-slate-100">
                  {items.map(entry => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(entry)}
                        className={cn('flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50', T.focus)}
                      >
                        <span className="w-[62px] shrink-0 text-[12px] font-medium text-slate-500">
                          {entry.allDay ? 'All day' : formatTime(entry.startAt, timezone, locale)}
                        </span>
                        <span className="hidden h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300 sm:block" aria-hidden />
                        <ChannelIcon channel={entry.channel} size={14} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[13.5px] font-medium text-slate-900">{entry.title}</span>
                            <StatusBadge status={entry.status} />
                          </span>
                          {entry.subtitle && <span className="mt-0.5 block truncate text-[12px] text-slate-500">{entry.subtitle}</span>}
                        </span>
                        {!dense && entry.campaignName && (
                          <span className="hidden min-w-0 max-w-[160px] items-center gap-1.5 lg:flex">
                            <span className="truncate text-[12.5px] text-slate-600">{entry.campaignName}</span>
                          </span>
                        )}
                        <span className="hidden shrink-0 items-center gap-2 sm:flex">
                          <Avatar name={entry.ownerName} size={22} />
                          <span className="hidden min-w-0 flex-col text-right lg:flex">
                            <span className="truncate text-[12.5px] font-medium text-slate-800">{entry.ownerName ?? 'Unassigned'}</span>
                            {entry.team && <span className="truncate text-[11px] text-slate-400">{entry.team}</span>}
                          </span>
                        </span>
                        {entry.conflictIds.length > 0 && (
                          <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">Conflict</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
      {selected && <EntryDrawer entry={selected} onClose={() => setSelected(null)} timezone={timezone} locale={locale} basePath={basePath} canReschedule={canReschedule} />}
    </>
  )
}

// ── Mini calendar ───────────────────────────────────────────────────────────

export function MiniCalendar({
  anchorIso, timezone, locale, weekStartsOn, markedDates, selectedDate, legend,
}: {
  anchorIso: string
  timezone: string
  locale: string
  weekStartsOn: 0 | 1
  markedDates: Record<string, 'scheduled' | 'conflict' | 'priority'>
  selectedDate?: string | null
  legend?: { label: string; className: string }[]
}) {
  const router = useRouter()
  const days = useMemo(() => monthGridDays(new Date(anchorIso), weekStartsOn, timezone), [anchorIso, weekStartsOn, timezone])
  const labels = useMemo(() => weekdayLabels(weekStartsOn, locale, 'narrow'), [weekStartsOn, locale])
  const [, startTransition] = useTransition()

  function select(key: string) {
    startTransition(() => {
      const params = new URLSearchParams(window.location.search)
      params.set('date', key)
      router.push(`${window.location.pathname}?${params}`, { scroll: false })
    })
  }

  return (
    <div>
      <p className="mb-2 text-center text-[13px] font-semibold text-slate-800">{formatMonthTitle(anchorIso, timezone, locale)}</p>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {labels.map((label, i) => (
          <div key={`${label}-${i}`} className="pb-1 text-[10.5px] font-medium text-slate-400">{label}</div>
        ))}
        {days.slice(0, 35).map(day => {
          const mark = markedDates[day.key]
          return (
            <button
              key={day.key}
              type="button"
              onClick={() => select(day.key)}
              aria-label={formatDayLabel(day.iso, timezone, locale)}
              aria-current={selectedDate === day.key ? 'date' : undefined}
              className={cn(
                'relative mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[11.5px] transition-colors',
                !day.inMonth && 'text-slate-300',
                day.inMonth && 'text-slate-700 hover:bg-slate-100',
                day.isToday && 'bg-blue-600 font-semibold text-white hover:bg-blue-700',
                selectedDate === day.key && !day.isToday && 'bg-blue-50 font-semibold text-blue-700',
                T.focus,
              )}
            >
              {day.dayOfMonth}
              {mark && !day.isToday && (
                <span className={cn(
                  'absolute -bottom-0.5 h-1 w-1 rounded-full',
                  mark === 'conflict' ? 'bg-red-500' : mark === 'priority' ? 'bg-amber-500' : 'bg-blue-500',
                )} aria-hidden />
              )}
            </button>
          )
        })}
      </div>
      {legend && (
        <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2.5">
          {legend.map(item => (
            <li key={item.label} className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className={cn('h-1.5 w-1.5 rounded-full', item.className)} aria-hidden />
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
