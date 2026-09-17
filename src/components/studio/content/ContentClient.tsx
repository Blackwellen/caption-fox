'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { BarChart3, ChevronDown, Columns3, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/campaigns/Toast'
import { ChannelIcon } from '@/components/home/brand-icons'
import {
  ALLOWED_CONTENT_TRANSITIONS, CHANNEL_LABELS, STUDIO_CHANNELS, type ContentStatus,
} from '@/lib/studio/constants'
import { archiveContent, bulkContentAction, deleteContent, repurposeContent, setContentStatus } from '@/lib/studio/actions/content'
import type { ContentRow } from '@/lib/studio/types'
import { ContentStatus as StatusPill } from '../records'
import { Dialog, MenuItem, MenuSeparator, Popover, PopoverContent, PopoverTrigger } from '../overlays'
import { Btn, PersonAvatar, S_FOCUS, btnClass, fmtCompact, fmtDate, fmtDateTime, personName } from '../ui'

export interface ContentPerms { edit: boolean; approve: boolean; publish: boolean; schedule: boolean; remove: boolean; repurpose: boolean; compose: boolean }

const STATUS_ACTION: Partial<Record<ContentStatus, { label: string; perm: keyof ContentPerms }>> = {
  pending_approval: { label: 'Submit for review', perm: 'edit' },
  approved: { label: 'Approve', perm: 'approve' },
  draft: { label: 'Move back to draft', perm: 'edit' },
  published: { label: 'Mark as published', perm: 'publish' },
}

function useQuery() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  return (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k) }
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
}

export function ContentMenu({ row, base, perms, className }: { row: ContentRow; base: string; perms: ContentPerms; className?: string }) {
  const router = useRouter()
  const set = useQuery()
  const { notify } = useToast()
  const [pending, start] = useTransition()
  const [repurpose, setRepurpose] = useState(false)
  const [channels, setChannels] = useState<string[]>([])
  const status = row.status as ContentStatus
  const moves = (ALLOWED_CONTENT_TRANSITIONS[status] ?? []).filter(s => s !== status && STATUS_ACTION[s])
  const title = row.internal_title || row.title || 'Untitled'

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) => start(async () => {
    const result = await fn()
    notify(result.ok ? 'success' : 'error', result.ok ? result.message ?? 'Updated.' : result.error ?? 'Something went wrong.')
    if (result.ok) { after?.(); router.refresh() }
  })

  return (
    <>
      <Popover>
        <PopoverTrigger haspopup="menu" label={`Actions for ${title}`} disabled={pending}
          className={className ?? cn('rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800', S_FOCUS)}>
          <MoreVertical size={14} />
        </PopoverTrigger>
        <PopoverContent role="menu" label="Content actions" width={210} align="end">
          {close => (<>
            <MenuItem close={close} onSelect={() => set({ selected: row.id })}>Preview</MenuItem>
            <MenuItem close={close} disabled={!perms.compose || status === 'archived'} hint={status === 'archived' ? 'Restore it first' : 'Your role cannot edit content'} onSelect={() => router.push(`${base}/compose?id=${row.id}`)}>Open in Compose</MenuItem>
            <MenuItem close={close} disabled={!perms.repurpose} hint="Your role cannot repurpose content" onSelect={() => setRepurpose(true)}>Repurpose to other channels</MenuItem>
            {moves.length > 0 && <MenuSeparator />}
            {moves.map(s => {
              const action = STATUS_ACTION[s]!
              return <MenuItem key={s} close={close} disabled={!perms[action.perm]} hint="Your role cannot make this change" onSelect={() => run(() => setContentStatus({ id: row.id, status: s }))}>{action.label}</MenuItem>
            })}
            <MenuSeparator />
            {status === 'archived'
              ? <MenuItem close={close} disabled={!perms.edit} onSelect={() => run(() => archiveContent({ id: row.id, restore: true }))}>Restore as draft</MenuItem>
              : <MenuItem close={close} disabled={!perms.edit} hint="Your role cannot edit content" onSelect={() => { if (confirm(`Archive “${title}”? You can restore it later.`)) run(() => archiveContent({ id: row.id })) }}>Archive</MenuItem>}
            <MenuItem close={close} danger disabled={!perms.remove || status === 'published'} hint={status === 'published' ? 'Published content is archived, not deleted' : 'Your role cannot delete content'}
              onSelect={() => { if (confirm(`Delete “${title}” permanently? Its versions and comments are removed too.`)) run(() => deleteContent({ id: row.id }), () => set({ selected: null })) }}>
              Delete
            </MenuItem>
          </>)}
        </PopoverContent>
      </Popover>
      <Dialog open={repurpose} onClose={() => setRepurpose(false)} size="sm" title="Repurpose content"
        description="Creates a draft per channel, with the caption trimmed to each channel’s limit."
        footer={<><Btn size="md" onClick={() => setRepurpose(false)}>Cancel</Btn><Btn size="md" variant="primary" disabled={!channels.length || pending}
          onClick={() => run(() => repurposeContent({ id: row.id, channels }), () => { setRepurpose(false); setChannels([]) })}>Create {channels.length || ''} draft{channels.length === 1 ? '' : 's'}</Btn></>}>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Target channels</legend>
          {STUDIO_CHANNELS.filter(c => !(row.platforms ?? []).includes(c)).map(c => {
            const on = channels.includes(c)
            return (
              <button key={c} type="button" aria-pressed={on} onClick={() => setChannels(list => (on ? list.filter(x => x !== c) : [...list, c]))}
                className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px]', S_FOCUS, on ? 'border-[#b9ccff] bg-[#eef3ff] text-[#1a5cff]' : 'border-[#e3e7ee] text-slate-700')}>
                <ChannelIcon channel={c} size={13} />{CHANNEL_LABELS[c]}
              </button>
            )
          })}
        </fieldset>
      </Dialog>
    </>
  )
}

export function PreviewButton({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const set = useQuery()
  return <button type="button" onClick={() => set({ selected: id })} className={className}>{children}</button>
}

export function ReadMore({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const long = text.length > 170
  return (
    <>
      <p className={cn('mt-1 whitespace-pre-line break-words text-[13px] leading-relaxed text-slate-700 lg:text-[10.5px] lg:leading-[16px]', !open && long && 'line-clamp-3')}>{text || <span className="text-slate-400">No caption yet.</span>}</p>
      {long && <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)} className={cn('mt-0.5 text-[12px] font-medium text-[#1a5cff] hover:underline lg:text-[10px]', S_FOCUS)}>{open ? 'Show less' : 'Read more'}</button>}
    </>
  )
}

// ── Records table ────────────────────────────────────────────────────────────
const COLUMNS = [
  { id: 'channel', label: 'Channel' }, { id: 'status', label: 'Status' }, { id: 'owner', label: 'Owner' },
  { id: 'updated', label: 'Updated' }, { id: 'scheduled', label: 'Scheduled' }, { id: 'engagement', label: 'Engagement' },
] as const
type ColumnId = typeof COLUMNS[number]['id']
const COLUMN_KEY = 'cf.studio.content.columns'

export function RecordsTable({ rows, base, perms, selectedId, controls, children }: {
  rows: ContentRow[]
  base: string
  perms: ContentPerms
  selectedId: string | null
  /** Server-built filter controls shown beside the columns toggle. */
  controls?: React.ReactNode
  children?: React.ReactNode
}) {
  const router = useRouter()
  const set = useQuery()
  const { notify } = useToast()
  const [hidden, setHidden] = useState<ColumnId[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [pending, start] = useTransition()

  // Column visibility is a per-device convenience.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLUMN_KEY) ?? '[]') as ColumnId[]
      if (Array.isArray(saved) && saved.length) queueMicrotask(() => setHidden(saved.filter(c => COLUMNS.some(x => x.id === c))))
    } catch { /* storage unavailable */ }
  }, [])
  const toggle = (id: ColumnId) => setHidden(list => {
    const next = list.includes(id) ? list.filter(x => x !== id) : [...list, id]
    try { localStorage.setItem(COLUMN_KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
    return next
  })
  const show = (id: ColumnId) => !hidden.includes(id)

  const bulk = (action: 'archive' | 'status', status?: string) => start(async () => {
    if (action === 'archive' && !confirm(`Archive ${picked.length} record${picked.length === 1 ? '' : 's'}?`)) return
    const result = await bulkContentAction({ ids: picked, action, status })
    notify(result.ok ? 'success' : 'error', result.ok ? result.message ?? 'Updated.' : result.error ?? 'Could not update.')
    if (result.ok) { setPicked([]); router.refresh() }
  })

  const th = 'h-9 whitespace-nowrap px-2 text-left text-[12px] font-medium text-slate-600 lg:h-[30px] lg:text-[9.5px]'
  const td = 'px-2 text-[12px] text-slate-700 lg:text-[9.5px]'

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-3.5 py-3 lg:h-[58px] lg:flex-nowrap lg:gap-[12px] lg:px-[16px] lg:py-0">
        <h2 id="records-title" className="mr-auto text-[15px] font-semibold text-slate-900 lg:text-[12.5px]">Content Records</h2>
        {controls}
        <ColumnsControl hidden={hidden} toggle={toggle} />
      </div>
      {picked.length > 0 && (
        <div role="region" aria-label="Bulk actions" className="flex flex-wrap items-center gap-2 border-y border-[#dbe5ff] bg-[#f5f8ff] px-3 py-2 text-[12px]">
          <span className="font-medium text-slate-800">{picked.length} selected</span>
          <Btn size="xs" disabled={!perms.edit || pending} onClick={() => bulk('status', 'pending_approval')}>Submit for review</Btn>
          <Btn size="xs" disabled={!perms.approve || pending} onClick={() => bulk('status', 'approved')}>Approve</Btn>
          <Btn size="xs" variant="danger" disabled={!perms.edit || pending} onClick={() => bulk('archive')}>Archive</Btn>
          <button type="button" onClick={() => setPicked([])} className={cn('ml-auto text-slate-500 hover:text-slate-800', S_FOCUS)}>Clear selection</button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <caption className="sr-only">Content records</caption>
          <thead><tr className="border-y border-[#eef0f4] bg-[#fbfcfd]">
            <th scope="col" className={cn(th, 'w-10 pl-3 lg:pl-[12px]')}>
              <input type="checkbox" checked={rows.length > 0 && picked.length === rows.length} onChange={e => setPicked(e.target.checked ? rows.map(r => r.id) : [])} aria-label="Select all records on this page" className="h-3.5 w-3.5 accent-[#1a5cff]" />
            </th>
            <th scope="col" className={cn(th, 'lg:w-[230px]')}>Title</th>
            {COLUMNS.filter(c => show(c.id)).map(c => <th key={c.id} scope="col" className={th}>{c.label}</th>)}
            <th scope="col" className={th}><span className="sr-only">Actions</span></th>
          </tr></thead>
          <tbody>
            {rows.map(r => {
              const views = Number(r.engagement?.views ?? 0)
              const title = r.internal_title || r.title || 'Untitled'
              return (
                <tr key={r.id} className={cn('border-b border-[#f0f2f5] last:border-0 hover:bg-slate-50/60', r.id === selectedId && 'bg-[#f7f9ff]')}>
                  <td className={cn(td, 'pl-3 lg:pl-[12px]')}><input type="checkbox" checked={picked.includes(r.id)} onChange={e => setPicked(p => (e.target.checked ? [...p, r.id] : p.filter(x => x !== r.id)))} aria-label={`Select ${title}`} className="h-3.5 w-3.5 accent-[#1a5cff]" /></td>
                  <td className={cn(td, 'h-12 lg:h-[36px]')}>
                    <button type="button" onClick={() => set({ selected: r.id })} className={cn('flex max-w-full items-center gap-2.5 text-left text-slate-800 hover:text-[#1a5cff] lg:gap-[10px]', S_FOCUS)}>
                      <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-[4px] bg-[#eef1f6] lg:h-[27px] lg:w-[27px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {r.thumbnail_url && <img src={r.thumbnail_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
                      </span>
                      <span className="truncate">{title}</span>
                    </button>
                  </td>
                  {show('channel') && <td className={td}><span className="flex items-center gap-1.5 whitespace-nowrap">{(r.platforms ?? []).slice(0, 1).map(p => <ChannelIcon key={p} channel={p} size={13} />)}{CHANNEL_LABELS[r.platforms?.[0] ?? ''] ?? '—'}{(r.platforms?.length ?? 0) > 1 && <span className="text-slate-400">+{r.platforms!.length - 1}</span>}</span></td>}
                  {show('status') && <td className={td}><StatusPill status={r.status} /></td>}
                  {show('owner') && <td className={td}><span className="flex items-center gap-1.5 whitespace-nowrap"><PersonAvatar person={r.owner} size={16} />{personName(r.owner)}</span></td>}
                  {show('updated') && <td className={cn(td, 'whitespace-nowrap')}>{fmtDate(r.updated_at)}</td>}
                  {show('scheduled') && <td className={cn(td, 'whitespace-nowrap')}>{r.scheduled_at ? fmtDateTime(r.scheduled_at) : '—'}</td>}
                  {show('engagement') && <td className={cn(td, 'whitespace-nowrap')}>{views > 0 ? <span className="inline-flex items-center gap-1.5">{fmtCompact(views)}<BarChart3 size={11} className="text-[#1a5cff]" aria-label="views" /></span> : '—'}</td>}
                  <td className={cn(td, 'pr-3 text-right')}><ContentMenu row={r} base={base} perms={perms} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {children}
    </>
  )
}

function ColumnsControl({ hidden, toggle }: { hidden: ColumnId[]; toggle: (id: ColumnId) => void }) {
  return (
    <Popover>
      <PopoverTrigger haspopup="dialog" label="Show or hide columns" className={btnClass('secondary', 'md', 'gap-3 px-2.5 lg:h-[31px] lg:w-[66px] lg:gap-[14px] lg:px-[10px]')}>
        <Columns3 size={14} /><ChevronDown size={12} />
      </PopoverTrigger>
      <PopoverContent label="Columns" width={190} align="end" className="p-2">
        {COLUMNS.map(col => (
          <label key={col.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50">
            <input type="checkbox" checked={!hidden.includes(col.id)} onChange={() => toggle(col.id)} className="h-3.5 w-3.5 accent-[#1a5cff]" />{col.label}
          </label>
        ))}
      </PopoverContent>
    </Popover>
  )
}

export function RowsPerPage({ size }: { size: number }) {
  const set = useQuery()
  return (
    <label className="flex items-center gap-2 text-[12px] text-slate-600 lg:gap-[12px] lg:text-[9.5px]">
      Rows per page:
      <span className="relative inline-flex items-center">
        <select value={size} onChange={e => set({ size: e.target.value, page: null })}
          className="h-9 appearance-none rounded-[7px] border border-[#e3e7ee] bg-white pl-3 pr-8 text-[12px] text-slate-700 outline-none focus:border-[#9db8ff] lg:h-[29px] lg:w-[56px] lg:text-[10px]">
          {[10, 24, 48, 96].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <ChevronDown size={12} className="pointer-events-none absolute right-2.5 text-slate-500" aria-hidden />
      </span>
    </label>
  )
}
