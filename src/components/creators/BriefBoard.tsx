'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, CheckCircle2, ChevronRight, Copy, Loader2, Users, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/campaigns/Toast'
import { duplicateBrief, updateBriefStatus } from '@/lib/creators/actions'
import {
  BRIEF_BOARD_STAGES, BRIEF_STATUS_LABELS, BRIEF_TRANSITIONS, canTransitionBrief, type BriefStatus,
} from '@/lib/creators/constants'
import type { BriefRow } from '@/lib/creators/types'
import { cn } from '@/lib/utils'
import { Avatar, BUTTON_SECONDARY, MediaChip, Thumb, type Tone } from './design'
import { useCreatorsBase } from './controls'

const STAGE_DOT: Record<string, string> = {
  draft: '#94a3b8', open: '#3b82f6', in_progress: '#f59e0b', submitted: '#22c55e', completed: '#22c55e', on_hold: '#94a3b8', cancelled: '#ef4444',
}
const CATEGORY_TONE: Tone[] = ['blue', 'green', 'orange', 'violet', 'amber']

const fmtDate = (value: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
const fmtMoney = (value: number | null, currency: string | null) => value === null ? '—'
  : new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP', maximumFractionDigits: 0 }).format(value)

/**
 * Briefs board. Cards can be dragged between lifecycle columns; each drop is
 * validated against BRIEF_TRANSITIONS on the client and again on the server,
 * applied optimistically, and rolled back with an error toast if the save
 * fails. The per-card status menu is the keyboard / touch alternative.
 */
export default function BriefBoard({ briefs, counts, canEdit }: { briefs: BriefRow[]; counts: Record<string, number>; canEdit: boolean }) {
  const router = useRouter()
  const base = useCreatorsBase()
  const { notify } = useToast()
  const [items, setItems] = useState(briefs)
  const [synced, setSynced] = useState(briefs)
  if (briefs !== synced) { setSynced(briefs); setItems(briefs) }
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [offset, setOffset] = useState(0)

  function move(id: string, to: BriefStatus) {
    const brief = items.find(b => b.id === id)
    if (!brief || brief.status === to) return
    if (!canTransitionBrief(brief.status, to)) {
      notify('error', `A ${BRIEF_STATUS_LABELS[brief.status as BriefStatus]} brief cannot move straight to ${BRIEF_STATUS_LABELS[to]}.`)
      return
    }
    const previous = items
    setItems(list => list.map(b => (b.id === id ? { ...b, status: to } : b)))
    startTransition(async () => {
      const result = await updateBriefStatus(id, to)
      if (!result.ok) {
        setItems(previous)
        notify('error', result.error ?? 'Could not move the brief.')
        return
      }
      notify('success', `"${brief.title}" moved to ${BRIEF_STATUS_LABELS[to]}.`)
      router.refresh()
    })
  }

  const stages = BRIEF_BOARD_STAGES
  const visibleStages = stages.slice(offset, offset + 5)

  return (
    <div className="relative">
      <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2 lg:grid-cols-5">
        {visibleStages.map(stage => {
          const column = items.filter(b => b.status === stage)
          return (
            <section
              key={stage} aria-label={`${BRIEF_STATUS_LABELS[stage]} briefs`}
              onDragOver={event => { if (canEdit && dragId) { event.preventDefault(); setOver(stage) } }}
              onDragLeave={() => setOver(current => (current === stage ? null : current))}
              onDrop={event => { event.preventDefault(); setOver(null); if (dragId) move(dragId, stage); setDragId(null) }}
              className={cn('min-w-0 rounded-[10px] border border-[#eef0f4] bg-[#fbfcfd] p-[6px] transition-colors', over === stage && 'border-[#93b4fb] bg-[#f5f8ff]')}
            >
              <header className="flex h-[26px] items-center gap-[7px] px-[5px]">
                <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: STAGE_DOT[stage] }} aria-hidden />
                <h3 className="flex-1 text-[11px] font-medium text-[#101828]">{BRIEF_STATUS_LABELS[stage]}</h3>
                <span className="rounded-md border border-[#e4e7ec] bg-white px-[6px] text-[9.5px] tabular-nums text-[#475467]">{counts[stage] ?? column.length}</span>
              </header>
              <ul className="mt-[5px] max-h-[216px] snap-y snap-mandatory space-y-[8px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" tabIndex={0} aria-label="Scroll for more briefs">
                {column.length === 0 && <li className="flex h-[210px] items-center justify-center rounded-lg border border-dashed border-[#e4e7ec] text-center text-[10px] text-[#98a2b3]">No {BRIEF_STATUS_LABELS[stage].toLowerCase()} briefs</li>}
                {column.map((brief, index) => (
                  <li key={brief.id}
                    draggable={canEdit} onDragStart={() => setDragId(brief.id)} onDragEnd={() => { setDragId(null); setOver(null) }}
                    className={cn('snap-start rounded-[9px] border border-[#e8ebf0] bg-white p-[6px] shadow-[0_1px_2px_rgba(16,24,40,0.04)]', canEdit && 'cursor-grab active:cursor-grabbing', dragId === brief.id && 'opacity-50')}>
                    <Link href={`${base}/briefs/${brief.id}`} className="block rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                      <span className="relative block aspect-[142/73] overflow-hidden rounded-[6px]">
                        <Thumb src={brief.cover_url} alt={`${brief.title} cover`} className="h-full w-full" />
                        {brief.category && <span className="absolute bottom-[5px] left-[5px]"><MediaChip tone={CATEGORY_TONE[index % CATEGORY_TONE.length]}>{brief.category}</MediaChip></span>}
                      </span>
                      <span className="mt-[8px] block truncate px-[3px] text-[10px] font-semibold text-[#101828]">{brief.title}</span>
                    </Link>
                    <ul className="mt-[6px] space-y-[5px] px-[3px] text-[9.5px] text-[#475467]">
                      <li className="flex items-center gap-[5px]"><Users size={11} aria-hidden />{brief.creators_assigned} creators</li>
                      <li className={cn('flex items-center gap-[5px]', brief.status === 'completed' && 'text-[#16a34a]')}>
                        {brief.status === 'completed' ? <CheckCircle2 size={11} aria-hidden /> : <CalendarDays size={11} aria-hidden />}
                        {brief.status === 'completed' && brief.completed_at ? `Completed ${fmtDate(brief.completed_at.slice(0, 10))}` : brief.deadline ? `Due ${fmtDate(brief.deadline)}` : 'No deadline'}
                      </li>
                      <li className="flex items-center gap-[5px]"><Wallet size={11} aria-hidden /><span className="font-semibold text-[#101828]">{fmtMoney(brief.budget, brief.currency)}</span> Budget</li>
                    </ul>
                    <div className="mt-[8px] flex items-center gap-[6px] border-t border-[#f1f3f6] px-[3px] pt-[7px]">
                      <Avatar name={brief.owner?.full_name} src={brief.owner?.avatar_url} size={20} />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-[9.5px] font-medium text-[#101828]">{brief.owner?.full_name ?? 'Unassigned'}</span>
                        <span className="block text-[8.5px] text-[#8a94a6]">Owner</span>
                      </span>
                      {canEdit && (
                        <label className="relative">
                          <span className="sr-only">Move {brief.title} to another status</span>
                          <select value="" disabled={pending} onChange={e => { if (e.target.value) move(brief.id, e.target.value as BriefStatus) }}
                            className="h-[20px] w-[20px] cursor-pointer appearance-none rounded border border-transparent bg-transparent text-transparent hover:border-[#e4e7ec]">
                            <option value="">Move to…</option>
                            {(BRIEF_TRANSITIONS[brief.status as BriefStatus] ?? []).filter(s => s !== brief.status).map(s => <option key={s} value={s}>{BRIEF_STATUS_LABELS[s]}</option>)}
                          </select>
                          <ChevronRight size={11} className="pointer-events-none absolute left-[4px] top-[4px] text-[#98a2b3]" aria-hidden />
                        </label>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
      {pending && <Loader2 size={14} className="absolute -top-7 right-0 animate-spin text-slate-400" aria-hidden />}
      {stages.length > 5 && (
        <button type="button" onClick={() => setOffset(o => (o + 5 >= stages.length ? 0 : o + 1))} aria-label="Show more board columns"
          className="absolute -right-[13px] top-1/2 hidden h-[26px] w-[26px] -translate-y-1/2 items-center justify-center rounded-full border border-[#e4e7ec] bg-white shadow-sm lg:flex">
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  )
}

/** "Duplicate Template": pick an existing brief and create a draft copy. */
export function DuplicateTemplateButton({ briefs }: { briefs: Pick<BriefRow, 'id' | 'title' | 'status'>[] }) {
  const router = useRouter()
  const base = useCreatorsBase()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [sourceId, setSourceId] = useState('')
  const [title, setTitle] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const matches = briefs.filter(b => b.title.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 50)

  function close() { setOpen(false); setSourceId(''); setTitle(''); setSearch(''); setError(null) }
  function submit() {
    if (pending) return
    if (!sourceId) { setError('Choose a brief to use as the template.'); return }
    startTransition(async () => {
      const result = await duplicateBrief(sourceId, title)
      if (!result.ok) { setError(result.error ?? 'Could not duplicate the brief.'); return }
      notify('success', result.message ?? 'Draft created.')
      close()
      if (result.id) router.push(`${base}/briefs/${result.id}`)
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={BUTTON_SECONDARY} disabled={briefs.length === 0}
        title={briefs.length === 0 ? 'Create a brief first to use it as a template.' : undefined}>
        <Copy size={16} aria-hidden />Duplicate Template
      </button>
      <Modal open={open} onClose={close} title="Duplicate a brief as a template"
        description="Copies the brief, requirements and deliverables into a new draft. Creators, submissions and deadlines are not copied."
        footer={<div className="flex w-full justify-end gap-2"><Button variant="secondary" size="sm" onClick={close}>Cancel</Button><Button size="sm" loading={pending} onClick={submit}>Create draft</Button></div>}>
        <div className="space-y-3">
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <Input label="Find a brief" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search briefs…" />
          <div role="radiogroup" aria-label="Template brief" className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-1.5">
            {matches.length === 0 && <p className="px-2 py-4 text-center text-xs text-slate-400">No briefs match.</p>}
            {matches.map(brief => (
              <label key={brief.id} className={cn('flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-slate-50', sourceId === brief.id && 'bg-blue-50')}>
                <input type="radio" name="template" checked={sourceId === brief.id} onChange={() => { setSourceId(brief.id); setTitle(`Copy of ${brief.title}`) }} />
                <span className="flex-1 truncate">{brief.title}</span>
                <span className="text-[11px] text-slate-400">{BRIEF_STATUS_LABELS[brief.status as BriefStatus] ?? brief.status}</span>
              </label>
            ))}
          </div>
          <Input label="New draft title" value={title} maxLength={160} onChange={e => setTitle(e.target.value)} />
        </div>
      </Modal>
    </>
  )
}
