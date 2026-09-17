'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, Copy, Download, MoreVertical, PenLine, Plus, Search, Sparkles, Star, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/campaigns/Toast'
import { ChannelIcon } from '@/components/home/brand-icons'
import { CHANNEL_LABELS, STUDIO_CHANNELS } from '@/lib/studio/constants'
import {
  addKeywordTerms, addTermsToContent, archiveKeywordSet, blockTerm, logKeywordExport, removeKeywordTerm, saveKeywordSet,
  toggleKeywordFavourite,
} from '@/lib/studio/actions/hashtags'
import type { KeywordSetRow, KeywordTermRow } from '@/lib/studio/types'
import { Dialog, MenuItem, MenuSeparator, Popover, PopoverContent, PopoverTrigger } from '../overlays'
import { Btn, S_FOCUS, btnClass, fmtAgo, fmtCompact } from '../ui'
import { SetIcon } from './set-icon'

export interface KeywordPerms { create: boolean; edit: boolean; export: boolean; compose: boolean }
export interface DraftChoice { id: string; title: string }

function useSelect() {
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

// ── Left panel: clusters / sets list ─────────────────────────────────────────
export function GroupList({ clusters, sets, selectedId, tab, perms, now }: {
  clusters: KeywordSetRow[]
  sets: KeywordSetRow[]
  selectedId: string | null
  tab: 'clusters' | 'sets'
  perms: KeywordPerms
  now: number
}) {
  const select = useSelect()
  const [term, setTerm] = useState('')
  const [creating, setCreating] = useState(false)
  const source = tab === 'clusters' ? clusters : sets
  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return needle ? source.filter(r => r.name.toLowerCase().includes(needle) || (r.topic ?? '').toLowerCase().includes(needle)) : source
  }, [source, term])
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? rows : rows.slice(0, 5)

  return (
    <div className="flex h-full flex-col">
      <div role="tablist" aria-label="Group type" className="flex border-b border-[#eceff4] px-3 lg:px-[12px]">
        {(['clusters', 'sets'] as const).map(t => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => select({ tab: t === 'clusters' ? null : 'sets', selected: null })}
            className={cn('relative h-11 px-4 text-[13px] font-medium lg:h-[42px] lg:px-[20px] lg:text-[10.5px]', S_FOCUS,
              tab === t ? 'text-[#1a5cff] after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-[#1a5cff]' : 'text-slate-600 hover:text-slate-900')}>
            {t === 'clusters' ? 'Keyword Clusters' : 'Hashtag Sets'}
          </button>
        ))}
      </div>
      <div className="flex gap-2 px-3 pt-3 lg:gap-[8px] lg:px-[12px] lg:pt-[12px]">
        <label className="relative flex min-w-0 flex-1 items-center">
          <span className="sr-only">Search {tab === 'clusters' ? 'clusters' : 'sets'}</span>
          <Search size={13} className="pointer-events-none absolute left-2.5 text-slate-400" aria-hidden />
          <input type="search" value={term} onChange={e => setTerm(e.target.value)} maxLength={80} placeholder={`Search ${tab === 'clusters' ? 'clusters' : 'sets'}…`}
            className="h-10 w-full rounded-[7px] border border-[#e3e7ee] pl-8 pr-2 text-[13px] outline-none focus:border-[#9db8ff] lg:h-[31px] lg:text-[10px]" />
        </label>
        {perms.create && (
          <button type="button" onClick={() => setCreating(true)} className={btnClass('secondary', 'sm', 'lg:h-[31px] lg:w-[66px] lg:text-[10px]')}>
            <Plus size={12} /> New
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-[12px] text-slate-500">{term ? 'No groups match that search.' : `No ${tab === 'clusters' ? 'keyword clusters' : 'hashtag sets'} yet.`}</p>
      ) : (
        <ul className="mt-3 flex-1 space-y-2 overflow-y-auto px-3 lg:mt-[16px] lg:space-y-[10px] lg:px-[12px]">
          {visible.map(r => {
            const active = r.id === selectedId
            return (
              <li key={r.id}>
                <button type="button" onClick={() => select({ selected: r.id })} aria-current={active || undefined}
                  className={cn('flex w-full items-center gap-3 rounded-[8px] border px-3 py-2.5 text-left lg:h-[54px] lg:gap-[12px] lg:px-[10px] lg:py-0', S_FOCUS,
                    active ? 'border-[#9db8ff] bg-[#eef3ff]' : 'border-[#e6e9f0] bg-white hover:border-[#c9d8ff]')}>
                  <SetIcon icon={r.icon} className="h-7 w-7 lg:h-[26px] lg:w-[26px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-slate-900 lg:text-[10.5px]">{r.name}</span>
                    <span className="block truncate text-[11px] text-slate-500 lg:text-[9px]">{r.term_count ?? 0} terms · Updated {fmtAgo(r.updated_at, now).toLowerCase()}</span>
                  </span>
                  <span className="shrink-0 text-center">
                    <span className="block rounded-[4px] bg-[#e8efff] px-2 text-[12px] font-semibold text-[#1a5cff] lg:px-[8px] lg:text-[9.5px]">{r.relevance_score ?? '–'}</span>
                    <span className="block text-[10px] text-slate-500 lg:text-[8px]">Relevance</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {rows.length > 5 && (
        <div className="p-3 lg:px-[12px] lg:pb-[12px] lg:pt-[14px]">
          <button type="button" onClick={() => setShowAll(v => !v)}
            className={cn('h-10 w-full rounded-[7px] border border-[#e3e7ee] text-[12px] font-medium text-[#1a5cff] hover:bg-slate-50 lg:h-[31px] lg:text-[10px]', S_FOCUS)}>
            {showAll ? 'Show fewer' : `View all ${tab === 'clusters' ? 'clusters' : 'sets'} (${rows.length})`}
          </button>
        </div>
      )}
      {creating && <GroupEditor group={null} kind={tab === 'clusters' ? 'cluster' : 'set'} onClose={() => setCreating(false)} />}
    </div>
  )
}

// ── Create / edit dialog ─────────────────────────────────────────────────────
export function GroupEditor({ group, kind, onClose }: { group: KeywordSetRow | null; kind: 'cluster' | 'set'; onClose: () => void }) {
  const router = useRouter()
  const select = useSelect()
  const { notify } = useToast()
  const [pending, start] = useTransition()
  const [form, setForm] = useState({
    name: group?.name ?? '', description: group?.description ?? '', topic: group?.topic ?? '',
    platform: group?.platform ?? 'instagram', hashtags: (group?.hashtags ?? []).join(' '),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = () => start(async () => {
    const result = await saveKeywordSet({
      id: group?.id, name: form.name, kind: group?.kind ?? kind, description: form.description, topic: form.topic,
      platform: form.platform, hashtags: form.hashtags.split(/[\s,]+/).filter(Boolean),
    })
    if (!result.ok) { setErrors(result.fieldErrors ?? {}); notify('error', result.error ?? 'Could not save.'); return }
    notify('success', result.message ?? 'Saved.')
    onClose()
    if (!group && result.id) select({ selected: result.id })
    router.refresh()
  })
  const input = 'mt-1 block w-full rounded-lg border border-[#dfe3ea] px-2.5 text-[13px] font-normal outline-none focus:border-blue-400'
  return (
    <Dialog open onClose={onClose} size="md" title={group ? `Edit “${group.name}”` : kind === 'cluster' ? 'New keyword cluster' : 'New hashtag set'}
      description="Blocked terms are removed automatically when you save."
      footer={<><Btn size="md" onClick={onClose}>Cancel</Btn><Btn size="md" variant="primary" onClick={save} disabled={pending}>{group ? 'Save changes' : 'Create'}</Btn></>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-[12px] font-medium text-slate-700 sm:col-span-2">Name
          <input data-autofocus value={form.name} maxLength={160} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={cn(input, 'h-9', errors.name && 'border-red-300')} aria-invalid={Boolean(errors.name) || undefined} />
          {errors.name && <span className="mt-1 block text-[11px] font-normal text-red-600">{errors.name}</span>}
        </label>
        <label className="block text-[12px] font-medium text-slate-700">Topic
          <input value={form.topic} maxLength={60} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} className={cn(input, 'h-9')} />
        </label>
        <label className="block text-[12px] font-medium text-slate-700">Primary platform
          <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} className={cn(input, 'h-9')}>
            {STUDIO_CHANNELS.map(c => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
          </select>
        </label>
        <label className="block text-[12px] font-medium text-slate-700 sm:col-span-2">Description
          <input value={form.description} maxLength={1000} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={cn(input, 'h-9')} />
        </label>
        <label className="block text-[12px] font-medium text-slate-700 sm:col-span-2">Hashtags <span className="font-normal text-slate-500">(space separated)</span>
          <textarea value={form.hashtags} rows={3} onChange={e => setForm(f => ({ ...f, hashtags: e.target.value }))} placeholder="#productivity #focus" className={cn(input, 'resize-none py-2')} />
        </label>
      </div>
    </Dialog>
  )
}

// ── Detail header actions ────────────────────────────────────────────────────
export function FavouriteStar({ id, favourite, canEdit }: { id: string; favourite: boolean; canEdit: boolean }) {
  const router = useRouter()
  const { notify } = useToast()
  const [on, setOn] = useState(favourite)
  const [pending, start] = useTransition()
  return (
    <button type="button" aria-pressed={on} aria-label={on ? 'Remove from saved groups' : 'Save group'} disabled={!canEdit || pending}
      title={canEdit ? undefined : 'Your role cannot edit keyword groups'}
      onClick={() => start(async () => {
        setOn(v => !v)
        const result = await toggleKeywordFavourite({ id })
        if (!result.ok) { setOn(favourite); notify('error', result.error ?? 'Could not update.'); return }
        router.refresh()
      })}
      className={cn('rounded p-1 hover:bg-slate-100', S_FOCUS)}>
      <Star size={15} className={on ? 'fill-[#f5a524] text-[#f5a524]' : 'text-slate-500'} />
    </button>
  )
}

export function GroupMenu({ group, perms }: { group: KeywordSetRow; perms: KeywordPerms }) {
  const router = useRouter()
  const select = useSelect()
  const { notify } = useToast()
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState(false)
  const archive = () => start(async () => {
    if (!confirm(`Archive “${group.name}”? Its terms are kept and it can be restored.`)) return
    const result = await archiveKeywordSet({ id: group.id })
    notify(result.ok ? 'success' : 'error', result.ok ? result.message ?? 'Archived.' : result.error ?? 'Could not archive.')
    if (result.ok) { select({ selected: null }); router.refresh() }
  })
  return (
    <>
      <Popover>
        <PopoverTrigger haspopup="menu" label={`Actions for ${group.name}`} disabled={pending} className={cn('rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800', S_FOCUS)}>
          <MoreVertical size={15} />
        </PopoverTrigger>
        <PopoverContent role="menu" label="Group actions" width={190} align="end">
          {close => (<>
            <MenuItem close={close} icon={<PenLine size={12} />} disabled={!perms.edit} hint="Your role cannot edit keyword groups" onSelect={() => setEditing(true)}>Edit group</MenuItem>
            <MenuSeparator />
            <MenuItem close={close} danger icon={<Trash2 size={12} />} disabled={!perms.edit} hint="Your role cannot edit keyword groups" onSelect={archive}>Archive</MenuItem>
          </>)}
        </PopoverContent>
      </Popover>
      {editing && <GroupEditor group={group} kind={group.kind === 'cluster' ? 'cluster' : 'set'} onClose={() => setEditing(false)} />}
    </>
  )
}

// ── Terms dialog (view all, add, remove, block) ──────────────────────────────
export function AllTermsButton({ group, terms, perms }: { group: KeywordSetRow; terms: KeywordTermRow[]; perms: KeywordPerms }) {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => start(async () => {
    const result = await fn()
    notify(result.ok ? 'success' : 'error', result.ok ? result.message ?? 'Updated.' : result.error ?? 'Something went wrong.')
    if (result.ok) router.refresh()
  })
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btnClass('secondary', 'sm', 'w-full text-[#1a5cff] lg:h-[29px] lg:text-[10px]')}>View all terms</button>
      <Dialog open={open} onClose={() => setOpen(false)} size="lg" title={`Terms in “${group.name}”`}
        description="Volume, competition and growth are workspace estimates, not live search data.">
        {perms.edit && (
          <form className="mb-3 flex gap-2" onSubmit={e => { e.preventDefault(); const list = draft.split(/[\s,]+/).filter(Boolean); if (list.length) run(async () => { const r = await addKeywordTerms({ setId: group.id, terms: list, kind: list.every(t => t.startsWith('#')) ? 'hashtag' : 'keyword' }); if (r.ok) setDraft(''); return r }) }}>
            <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Add terms, separated by spaces or commas" aria-label="Add terms"
              className="h-9 min-w-0 flex-1 rounded-lg border border-[#dfe3ea] px-2.5 text-[13px] outline-none focus:border-blue-400" />
            <Btn type="submit" size="md" variant="primary" disabled={pending || !draft.trim()}><Plus size={13} /> Add</Btn>
          </form>
        )}
        {terms.length === 0 ? <p className="py-6 text-center text-[13px] text-slate-500">No terms yet.</p> : (
          <div className="max-h-[55vh] overflow-y-auto">
            <table className="w-full text-[13px]">
              <caption className="sr-only">Terms</caption>
              <thead><tr className="border-b border-[#eef0f4] text-left text-[12px] text-slate-500">
                <th scope="col" className="py-2 font-medium">Term</th><th scope="col" className="py-2 font-medium">Avg. volume</th>
                <th scope="col" className="py-2 font-medium">Competition</th><th scope="col" className="py-2 font-medium">Growth (30d)</th>
                <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>
              </tr></thead>
              <tbody>
                {terms.map(t => (
                  <tr key={t.id} className="border-b border-[#f3f4f7]">
                    <td className="py-2 text-slate-800">{t.term}</td>
                    <td className="py-2 tabular-nums">{t.avg_volume !== null ? fmtCompact(t.avg_volume) : '—'}</td>
                    <td className="py-2 tabular-nums">{t.competition !== null ? t.competition.toFixed(2) : '—'}</td>
                    <td className={cn('py-2 tabular-nums', (t.growth_30d ?? 0) >= 0 ? 'text-[#16a34a]' : 'text-red-600')}>{t.growth_30d !== null ? `${t.growth_30d > 0 ? '+' : ''}${t.growth_30d}%` : '—'}</td>
                    <td className="py-2 text-right">
                      {perms.edit && (
                        <span className="inline-flex gap-1">
                          <Btn size="xs" variant="ghost" onClick={() => { if (confirm(`Block “${t.term}” across the workspace? It will be stripped from future groups and drafts.`)) run(() => blockTerm({ term: t.term, reason: `Blocked from ${group.name}` })) }}>Block</Btn>
                          <Btn size="xs" variant="ghost" aria-label={`Remove ${t.term}`} onClick={() => run(() => removeKeywordTerm({ id: t.id }))}><X size={12} /></Btn>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Dialog>
    </>
  )
}

// ── Suggested combinations ───────────────────────────────────────────────────
export function Combinations({ combos }: { combos: { tags: string[]; volume: number }[] }) {
  const { notify } = useToast()
  const [count, setCount] = useState(5)
  if (combos.length === 0) return <p className="py-6 text-[12px] text-slate-500 lg:text-[9.5px]">Add at least two hashtags to see combinations.</p>
  return (
    <>
      <ul className="mt-2 flex-1 space-y-0 lg:mt-[14px]">
        {combos.slice(0, count).map(c => (
          <li key={c.tags.join(' ')} className="flex h-9 items-center gap-2 lg:h-[35px]">
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(c.tags.join(' ')); notify('success', 'Combination copied.') }}
              className={cn('min-w-0 flex-1 truncate text-left text-[12px] text-[#1a5cff] hover:underline lg:text-[9.5px]', S_FOCUS)} title="Copy combination">
              {c.tags.join(' ')}
            </button>
            <span className="shrink-0 text-[12px] tabular-nums text-slate-700 lg:text-[9.5px]" title="Estimated reach: the lower term volume in the pair">{fmtCompact(c.volume)}</span>
          </li>
        ))}
      </ul>
      <button type="button" disabled={count >= combos.length} onClick={() => setCount(n => n + 5)}
        className={btnClass('secondary', 'sm', 'mt-2 w-full text-[#1a5cff] lg:mt-[10px] lg:h-[29px] lg:text-[10px]')}
        title={count >= combos.length ? 'All combinations are shown' : undefined}>
        <Sparkles size={12} /> {count >= combos.length ? 'All combos shown' : 'Generate more combos'}
      </button>
    </>
  )
}

// ── Copy-ready output ────────────────────────────────────────────────────────
const PLATFORM_LIMITS: Record<string, number> = { instagram: 30, linkedin: 5, tiktok: 6, x: 2 }

export function CopyOutput({ hashtags, drafts, latestDraftId, perms, base }: {
  hashtags: string[]
  drafts: DraftChoice[]
  latestDraftId: string | null
  perms: KeywordPerms
  base: string
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [platform, setPlatform] = useState('instagram')
  const [pending, start] = useTransition()
  const tags = hashtags.slice(0, PLATFORM_LIMITS[platform] ?? 30)
  const text = tags.join(' ')

  const addTo = (id: string) => start(async () => {
    const result = await addTermsToContent({ contentId: id, terms: tags })
    if (!result.ok) { notify('error', result.error ?? 'Could not add to the draft.'); return }
    notify('success', result.message ?? 'Added to the draft.')
    router.push(`${base}/compose?id=${id}`)
  })

  const blockedReason = !perms.compose ? 'Your role cannot edit content' : !latestDraftId ? 'Save a draft in Compose first' : tags.length === 0 ? 'This group has no hashtags' : undefined

  return (
    <div className="flex h-full flex-col">
      <div role="tablist" aria-label="Platform" className="flex gap-3 overflow-x-auto border-b border-[#eceff4] [scrollbar-width:none] lg:mt-[12px] lg:gap-[4px] lg:overflow-visible">
        {(['instagram', 'linkedin', 'tiktok', 'x'] as const).map(p => (
          <button key={p} type="button" role="tab" aria-selected={platform === p} onClick={() => setPlatform(p)}
            className={cn('relative inline-flex h-9 items-center gap-1.5 whitespace-nowrap px-1.5 text-[12px] lg:h-[28px] lg:gap-[5px] lg:px-[6px] lg:text-[8.5px]', S_FOCUS,
              platform === p ? 'font-medium text-[#1a5cff] after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-[#1a5cff]' : 'text-slate-600')}>
            <ChannelIcon channel={p} size={11} />{p === 'x' ? 'X / Twitter' : CHANNEL_LABELS[p]}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-[8px] border border-[#e6e9f0] p-2.5 lg:mt-[10px] lg:p-[8px]">
        <p className="min-h-[88px] whitespace-pre-wrap break-words rounded-[6px] border border-[#eceff4] p-2.5 text-[12px] leading-relaxed text-slate-700 lg:min-h-[86px] lg:p-[10px] lg:text-[9.5px] lg:leading-[15px]" aria-live="polite">
          {text || <span className="text-slate-400">No hashtags in this group yet.</span>}
        </p>
        <div className="mt-2 flex items-center lg:mt-[8px]">
          <span className="text-[11px] text-slate-500 lg:text-[8.5px]">Characters: {text.length}{PLATFORM_LIMITS[platform] ? ` · ${tags.length}/${PLATFORM_LIMITS[platform]} tags` : ''}</span>
          <button type="button" disabled={!text} onClick={() => { void navigator.clipboard?.writeText(text); notify('success', 'Hashtags copied.') }}
            className={btnClass('secondary', 'sm', 'ml-auto lg:h-[29px] lg:w-[68px] lg:text-[10px]')}>
            <Copy size={12} /> Copy
          </button>
        </div>
      </div>
      <div className="mt-3 inline-flex lg:mt-[12px]">
        <button type="button" disabled={Boolean(blockedReason) || pending} title={blockedReason} onClick={() => latestDraftId && addTo(latestDraftId)}
          className={btnClass('primary', 'md', 'flex-1 rounded-r-none lg:h-[30px] lg:text-[10.5px]')}>
          <PenLine size={13} /> Add to composer
        </button>
        <Popover>
          <PopoverTrigger haspopup="menu" label="Choose a draft" disabled={!perms.compose || drafts.length === 0 || tags.length === 0 || pending}
            className={btnClass('primary', 'md', 'rounded-l-none border-l-white/25 px-2.5 lg:h-[30px] lg:w-[36px] lg:px-0')}>
            <ChevronDown size={13} />
          </PopoverTrigger>
          <PopoverContent role="menu" label="Add to draft" width={240} align="end">
            {close => (<>
              {drafts.map(d => <MenuItem key={d.id} close={close} onSelect={() => addTo(d.id)}>{d.title}</MenuItem>)}
              <MenuSeparator />
              <MenuItem close={close} onSelect={() => { void navigator.clipboard?.writeText(text); router.push(`${base}/compose?new=1`) }}>Copy and start a new post</MenuItem>
            </>)}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

// ── Header / table utilities ─────────────────────────────────────────────────
export function HowItWorks() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btnClass('secondary', 'md', 'lg:h-[33px] lg:px-[16px] lg:text-[11px]')}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M6.5 5.5 10.5 8l-4 2.5z" fill="currentColor" /></svg>
        How it works
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} size="md" title="How Hashtags & Keywords works">
        <ul className="list-disc space-y-2 pl-5 text-[13px] text-slate-700">
          <li><b>Keyword clusters</b> group related search terms around a topic. <b>Hashtag sets</b> are ready-to-paste groups for a channel.</li>
          <li><b>Relevance</b> (0–100), <b>average volume</b>, <b>competition</b> (0–1, lower is easier) and <b>30-day growth</b> are estimates stored with your workspace data. They are not live search-engine figures.</li>
          <li><b>Suggested combinations</b> pair your highest-volume hashtags. The estimate shown is the lower volume of the pair.</li>
          <li><b>Copy-ready output</b> trims the set to each platform’s recommended hashtag count.</li>
          <li><b>Audience favourites</b> are hashtags whose published posts beat your average engagement rate.</li>
          <li><b>Blocked terms</b> are stripped automatically from groups and drafts.</li>
        </ul>
      </Dialog>
    </>
  )
}

export function ExportSets({ rows, perms }: { rows: KeywordSetRow[]; perms: KeywordPerms }) {
  const { notify } = useToast()
  const [pending, start] = useTransition()
  const csv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const run = () => start(async () => {
    const logged = await logKeywordExport({ count: rows.length })
    if (!logged.ok) { notify('error', logged.error ?? 'Export is not allowed.'); return }
    const header = ['Name', 'Type', 'Terms', 'Avg volume', 'Competition', 'Growth 30d %', 'Relevance', 'Status', 'Last updated', 'Hashtags']
    const lines = rows.map(r => [r.name, r.kind, r.term_count ?? 0, r.avg_volume, r.competition, r.growth_30d, r.relevance_score, r.status, r.updated_at, r.hashtags.join(' ')].map(csv).join(','))
    const blob = new Blob([[header.map(csv).join(','), ...lines].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `keyword-sets-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    notify('success', `${rows.length} groups exported.`)
  })
  return (
    <button type="button" onClick={run} disabled={!perms.export || pending || rows.length === 0} title={perms.export ? undefined : 'Your role cannot export keyword data'}
      className={btnClass('secondary', 'md', 'lg:h-[31px] lg:px-[16px] lg:text-[10.5px]')}>
      <Download size={13} /> Export
    </button>
  )
}

export function SelectRowLink({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const params = useSearchParams()
  const pathname = usePathname()
  const next = new URLSearchParams(params.toString())
  next.set('selected', id)
  return <Link href={`${pathname}?${next.toString()}`} scroll={false} className={className}>{children}</Link>
}
