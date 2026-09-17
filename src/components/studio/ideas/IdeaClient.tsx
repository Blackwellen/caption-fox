'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays, Check, ChevronDown, CircleDashed, ExternalLink, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/campaigns/Toast'
import {
  ALLOWED_IDEA_TRANSITIONS, IDEA_SOURCES, IDEA_STAGE_LABELS, STUDIO_CHANNELS, CHANNEL_LABELS, type IdeaStage,
} from '@/lib/studio/constants'
import {
  addIdeaTask, archiveIdea, convertIdeaToContent, saveIdea, setIdeaStage, setIdeaTaskDone,
} from '@/lib/studio/actions/ideas'
import type { IdeaRow } from '@/lib/studio/types'
import type { IdeaTaskRow } from '@/lib/studio/data'
import { Dialog, MenuItem, Popover, PopoverContent, PopoverTrigger } from '../overlays'
import { Btn, S_FOCUS, btnClass } from '../ui'
import { STAGE_STYLE } from './stage-style'

/** The full-width stage bar on an idea card; opens the allowed next stages. */
export function IdeaStageButton({ id, stage, canEdit, className }: { id: string; stage: string; canEdit: boolean; className?: string }) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, start] = useTransition()
  const style = STAGE_STYLE[stage] ?? STAGE_STYLE.backlog!
  const next = (ALLOWED_IDEA_TRANSITIONS[stage as IdeaStage] ?? []).filter(s => s !== stage)
  const label = IDEA_STAGE_LABELS[stage as IdeaStage] ?? stage
  const bar = cn('flex h-9 w-full items-center justify-center gap-1.5 rounded-[6px] text-[12px] font-medium lg:h-[24px] lg:text-[9.5px]', style.bar, className)

  const move = (target: string) => start(async () => {
    const result = await setIdeaStage({ id, stage: target })
    notify(result.ok ? 'success' : 'error', result.ok ? `Moved to ${IDEA_STAGE_LABELS[target as IdeaStage]}.` : result.error ?? 'Could not move the idea.')
    if (result.ok) router.refresh()
  })

  if (!canEdit || next.length === 0) return <span className={bar}>{style.icon}{label}</span>
  return (
    <Popover className="flex w-full">
      <PopoverTrigger haspopup="menu" label={`Stage: ${label}. Change stage`} disabled={pending} className={cn(bar, S_FOCUS, 'hover:brightness-[0.98]')}>
        {style.icon}{label}
      </PopoverTrigger>
      <PopoverContent role="menu" label="Move to stage" width={190}>
        {close => next.map(s => (
          <MenuItem key={s} close={close} icon={STAGE_STYLE[s]?.icon} onSelect={() => move(s)}>{IDEA_STAGE_LABELS[s]}</MenuItem>
        ))}
      </PopoverContent>
    </Popover>
  )
}

/** Checkbox list of open idea tasks. */
export function NextActions({ rows, canEdit, base, now }: { rows: IdeaTaskRow[]; canEdit: boolean; base: string; now: number }) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, start] = useTransition()
  const [done, setDone] = useState<string[]>([])
  if (rows.length === 0) return <p className="py-3 text-[12px] text-slate-500 lg:text-[9.5px]">No open actions. Add tasks from an idea’s brief.</p>
  return (
    <ul className="mt-2 space-y-2 lg:mt-[10px] lg:space-y-[9px]">
      {rows.map(t => {
        const checked = done.includes(t.id)
        const overdue = t.due_on && new Date(`${t.due_on}T23:59:59`).getTime() < now
        return (
          <li key={t.id} className="flex items-center gap-2 lg:gap-[10px]">
            <button type="button" role="checkbox" aria-checked={checked} disabled={!canEdit || pending} aria-label={`Complete ${t.title}`}
              onClick={() => start(async () => {
                setDone(d => [...d, t.id])
                const result = await setIdeaTaskDone({ id: t.id, done: true })
                if (!result.ok) { setDone(d => d.filter(x => x !== t.id)); notify('error', result.error ?? 'Could not update.'); return }
                notify('success', 'Task completed.')
                router.refresh()
              })}
              className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border lg:h-[13px] lg:w-[13px]', checked ? 'border-[#1a5cff] bg-[#1a5cff] text-white' : 'border-slate-400', S_FOCUS)}>
              {checked && <Check size={9} strokeWidth={3} />}
            </button>
            <Link href={`${base}/ideas?selected=${t.idea_id}`} className={cn('min-w-0 flex-1 truncate text-[12px] text-slate-700 hover:text-[#1a5cff] lg:text-[9.5px]', checked && 'line-through text-slate-400')} title={t.idea_title ?? undefined}>{t.title}</Link>
            {t.due_on && (
              <span className={cn('flex shrink-0 items-center gap-1 text-[11px] lg:text-[9px]', overdue ? 'text-red-600' : 'text-slate-600')}>
                <CalendarDays size={10} aria-hidden /> Due {new Date(`${t.due_on}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function useSelection() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const set = (id: string | null) => {
    const next = new URLSearchParams(params.toString())
    if (id) next.set('selected', id); else next.delete('selected')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
  return set
}

/** Opens an idea's full brief (deep-linkable through ?selected). */
export function OpenIdeaButton({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const select = useSelection()
  return <button type="button" onClick={() => select(id)} className={className}>{children}</button>
}

interface Collections { id: string; name: string }

export interface IdeaPermissions { create: boolean; edit: boolean; convert: boolean }

/** Create or edit an idea, including its brief, tasks and conversion to content. */
export function IdeaEditor({ idea, tasks, collections, base, perms, open, onClose }: {
  idea: IdeaRow | null
  tasks: IdeaTaskRow[]
  collections: Collections[]
  base: string
  perms: IdeaPermissions
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, start] = useTransition()
  const meta = (idea?.metadata ?? {}) as Record<string, unknown>
  const canWrite = idea ? perms.edit : perms.create
  const [form, setForm] = useState({
    title: idea?.title ?? '', description: idea?.description ?? '', source: idea?.source ?? 'manual',
    sourceLabel: typeof meta.source_label === 'string' ? meta.source_label : '', score: idea?.score ?? 70,
    tags: (idea?.tags ?? []).join(', '), platforms: idea?.platforms ?? [], collectionId: idea?.collection_id ?? '',
    whyItWorks: (idea?.why_it_works ?? []).join('\n'), nextStep: idea?.next_step ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [task, setTask] = useState({ title: '', due: '' })
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(f => ({ ...f, [key]: value }))

  const save = () => start(async () => {
    const result = await saveIdea({
      id: idea?.id, title: form.title, description: form.description, source: form.source, sourceLabel: form.sourceLabel,
      score: Number(form.score), tags: form.tags.split(',').map(t => t.trim()).filter(Boolean), platforms: form.platforms,
      collectionId: form.collectionId || null, whyItWorks: form.whyItWorks.split('\n').map(t => t.trim()).filter(Boolean),
      nextStep: form.nextStep,
    })
    if (!result.ok) { setErrors(result.fieldErrors ?? {}); notify('error', result.error ?? 'Could not save.'); return }
    notify('success', result.message ?? 'Saved.')
    router.refresh()
    if (!idea) onClose()
  })

  const convert = () => start(async () => {
    if (!idea) return
    const result = await convertIdeaToContent({ id: idea.id })
    if (!result.ok || !result.id) { notify('error', result.error ?? 'Could not convert.'); return }
    notify('success', result.message ?? 'Draft created.')
    router.push(`${base}/compose?id=${result.id}`)
  })

  const archive = () => start(async () => {
    if (!idea || !confirm('Archive this idea? You can restore it from archived ideas.')) return
    const result = await archiveIdea({ id: idea.id })
    notify(result.ok ? 'success' : 'error', result.ok ? 'Idea archived.' : result.error ?? 'Could not archive.')
    if (result.ok) { onClose(); router.refresh() }
  })

  const addTask = () => start(async () => {
    if (!idea) return
    const result = await addIdeaTask({ ideaId: idea.id, title: task.title, dueOn: task.due || null })
    if (!result.ok) { notify('error', result.error ?? 'Could not add the task.'); return }
    setTask({ title: '', due: '' })
    router.refresh()
  })

  const input = 'mt-1 block w-full rounded-lg border border-[#dfe3ea] px-2.5 text-[13px] outline-none focus:border-blue-400 disabled:bg-slate-50'
  const lbl = 'block text-[12px] font-medium text-slate-700'

  return (
    <Dialog open={open} onClose={onClose} size="lg" title={idea ? idea.title : 'New idea'}
      description={idea ? `${IDEA_STAGE_LABELS[idea.stage as IdeaStage] ?? idea.stage}${idea.owner?.full_name ? ` · Owner ${idea.owner.full_name}` : ''}` : 'Capture the idea now; score and prioritise it with your team.'}
      footer={(
        <>
          {idea && perms.edit && idea.stage !== 'archived' && <Btn size="md" variant="danger" className="mr-auto" onClick={archive} disabled={pending}>Archive</Btn>}
          {idea?.converted_to_post_id && <Link href={`${base}/compose?id=${idea.converted_to_post_id}`} className={btnClass('secondary', 'md')}>Open draft <ExternalLink size={13} /></Link>}
          {idea && !idea.converted_to_post_id && perms.convert && <Btn size="md" onClick={convert} disabled={pending || !['ready_to_draft', 'approved', 'prioritised'].includes(idea.stage)} title="Available once the idea is prioritised or ready to draft">Convert to content</Btn>}
          <Btn size="md" onClick={onClose}>Close</Btn>
          {canWrite && <Btn size="md" variant="primary" onClick={save} disabled={pending}>{idea ? 'Save changes' : 'Add idea'}</Btn>}
        </>
      )}>
      <fieldset disabled={!canWrite} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={cn(lbl, 'sm:col-span-2')}>Title
          <input data-autofocus value={form.title} maxLength={200} onChange={e => set('title', e.target.value)} className={cn(input, 'h-9', errors.title && 'border-red-300')} aria-invalid={Boolean(errors.title) || undefined} />
          {errors.title && <span className="mt-1 block text-[11px] font-normal text-red-600">{errors.title}</span>}
        </label>
        <label className={cn(lbl, 'sm:col-span-2')}>Concept summary
          <textarea value={form.description} maxLength={4000} rows={3} onChange={e => set('description', e.target.value)} className={cn(input, 'resize-none py-2')} />
        </label>
        <label className={lbl}>Source type
          <select value={form.source} onChange={e => set('source', e.target.value)} className={cn(input, 'h-9')}>
            {IDEA_SOURCES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </label>
        <label className={lbl}>Source name
          <input value={form.sourceLabel} maxLength={80} placeholder="e.g. Google Trends" onChange={e => set('sourceLabel', e.target.value)} className={cn(input, 'h-9')} />
        </label>
        <label className={lbl}>Score <span className="font-normal text-slate-500">(0–100)</span>
          <input type="number" min={0} max={100} value={form.score} onChange={e => set('score', Number(e.target.value))} className={cn(input, 'h-9')} />
        </label>
        <label className={lbl}>Collection
          <select value={form.collectionId} onChange={e => set('collectionId', e.target.value)} className={cn(input, 'h-9')}>
            <option value="">No collection</option>
            {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className={cn(lbl, 'sm:col-span-2')}>Tags <span className="font-normal text-slate-500">(comma separated)</span>
          <input value={form.tags} onChange={e => set('tags', e.target.value)} className={cn(input, 'h-9')} />
        </label>
        <div className="sm:col-span-2">
          <span className={lbl}>Channels</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {STUDIO_CHANNELS.map(ch => {
              const on = form.platforms.includes(ch)
              return (
                <button key={ch} type="button" aria-pressed={on} onClick={() => set('platforms', on ? form.platforms.filter(p => p !== ch) : [...form.platforms, ch])}
                  className={cn('h-8 rounded-full border px-2.5 text-[12px]', S_FOCUS, on ? 'border-[#b9ccff] bg-[#eef3ff] text-[#1a5cff]' : 'border-[#e3e7ee] text-slate-600')}>
                  {CHANNEL_LABELS[ch]}
                </button>
              )
            })}
          </div>
        </div>
        <label className={lbl}>Why it works <span className="font-normal text-slate-500">(one per line)</span>
          <textarea value={form.whyItWorks} rows={3} onChange={e => set('whyItWorks', e.target.value)} className={cn(input, 'resize-none py-2')} />
        </label>
        <label className={lbl}>Suggested next step
          <textarea value={form.nextStep} maxLength={500} rows={3} onChange={e => set('nextStep', e.target.value)} className={cn(input, 'resize-none py-2')} />
        </label>
      </fieldset>

      {idea && (
        <section className="mt-5 border-t border-[#eef0f4] pt-4" aria-labelledby="idea-tasks-title">
          <h3 id="idea-tasks-title" className="text-[13px] font-semibold text-slate-900">Next actions</h3>
          {tasks.length === 0 ? <p className="mt-1 text-[12px] text-slate-500">No open tasks for this idea.</p> : (
            <ul className="mt-2 space-y-1.5">
              {tasks.map(t => (
                <li key={t.id} className="flex items-center gap-2 text-[13px] text-slate-700">
                  <CircleDashed size={13} className="text-slate-400" aria-hidden />{t.title}
                  {t.due_on && <span className="ml-auto text-[12px] text-slate-500">Due {new Date(`${t.due_on}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                </li>
              ))}
            </ul>
          )}
          {perms.edit && (
            <form onSubmit={e => { e.preventDefault(); addTask() }} className="mt-3 flex flex-wrap items-center gap-2">
              <input value={task.title} onChange={e => setTask(t => ({ ...t, title: e.target.value }))} maxLength={200} placeholder="Add a task…" aria-label="Task title" className={cn(input, 'mt-0 h-9 min-w-[180px] flex-1')} />
              <input type="date" value={task.due} onChange={e => setTask(t => ({ ...t, due: e.target.value }))} aria-label="Due date" className={cn(input, 'mt-0 h-9 w-[150px]')} />
              <Btn type="submit" size="md" disabled={pending || !task.title.trim()}><Plus size={13} /> Add</Btn>
            </form>
          )}
        </section>
      )}
    </Dialog>
  )
}

/** Renders the editor for ?selected and exposes the "New idea" trigger. */
export function IdeaDialogs({ selected, tasks, collections, base, perms }: {
  selected: IdeaRow | null
  tasks: IdeaTaskRow[]
  collections: Collections[]
  base: string
  perms: IdeaPermissions
}) {
  const select = useSelection()
  return <IdeaEditor key={selected?.id ?? 'none'} idea={selected} tasks={tasks} collections={collections} base={base} perms={perms} open={Boolean(selected)} onClose={() => select(null)} />
}

export function NewIdeaButton({ collections, base, perms }: { collections: Collections[]; base: string; perms: IdeaPermissions }) {
  const [open, setOpen] = useState(false)
  if (!perms.create) return null
  return (
    <>
      <Btn variant="primary" size="md" onClick={() => setOpen(true)} className="lg:h-[30px] lg:text-[11px]"><Plus size={14} /> New idea</Btn>
      {open && <IdeaEditor idea={null} tasks={[]} collections={collections} base={base} perms={perms} open onClose={() => setOpen(false)} />}
    </>
  )
}

export function SortSelect({ value, options }: { value: string; options: { id: string; label: string }[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const current = options.find(o => o.id === value) ?? options[0]!
  return (
    <Popover>
      <PopoverTrigger haspopup="listbox" label={`Sort: ${current.label}`} className={cn('inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-[7px] border border-[#e3e7ee] bg-white px-2.5 text-[13px] text-slate-700 hover:bg-slate-50 lg:h-[30px] lg:text-[9.5px]', S_FOCUS)}>
        Sort: {current.label} <ChevronDown size={11} className="text-slate-500" />
      </PopoverTrigger>
      <PopoverContent role="listbox" label="Sort" width={180} align="end">
        {close => options.map(o => (
          <button key={o.id} type="button" role="option" aria-selected={o.id === value}
            onClick={() => {
              const next = new URLSearchParams(params.toString())
              next.set('sort', o.id)
              next.delete('page')
              router.replace(`${pathname}?${next.toString()}`, { scroll: false })
              close()
            }}
            className={cn('flex w-full rounded-lg px-2.5 py-2 text-left text-[13px] lg:py-1.5 lg:text-[12px]', o.id === value ? 'bg-[#eef3ff] font-medium text-[#1a5cff]' : 'text-slate-700 hover:bg-slate-50')}>
            {o.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
