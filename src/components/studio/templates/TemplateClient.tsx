'use client'

import { useId, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, ChevronDown, ChevronRight, Download, ExternalLink, FilePlus2, MoreHorizontal, Send, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/campaigns/Toast'
import { CHANNEL_LABELS, STUDIO_CHANNELS, TEMPLATE_CATEGORIES, TEMPLATE_STATUS_LABELS, type TemplateStatus } from '@/lib/studio/constants'
import {
  duplicateTemplate, saveTemplate, setTemplateStatus, toggleTemplateFavourite, useTemplate as createFromTemplate,
} from '@/lib/studio/actions/templates'
import type { TemplateRow } from '@/lib/studio/types'
import { Dialog, MenuItem, MenuSeparator, Popover, PopoverContent, PopoverTrigger } from '../overlays'
import { Btn, S_FOCUS, btnClass } from '../ui'
import SocialPreview, { type PreviewAccountLite } from '../SocialPreview'

export interface TemplatePerms { create: boolean; edit: boolean; approve: boolean; publish: boolean; useForContent: boolean }
export interface CoverOption { id: string; name: string; url: string | null }

function variableKeys(template: Pick<TemplateRow, 'variables' | 'caption_template'>): { key: string; label: string }[] {
  const listed = Array.isArray(template.variables) ? (template.variables as { key?: string; label?: string }[]).filter(v => typeof v.key === 'string') : []
  if (listed.length) return listed.map(v => ({ key: v.key!, label: v.label ?? v.key! }))
  const found = [...(template.caption_template ?? '').matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]!)
  return [...new Set(found)].map(key => ({ key, label: key.replace(/_/g, ' ') }))
}

function useSelect() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  return (id: string) => {
    const next = new URLSearchParams(params.toString())
    next.set('selected', id)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }
}

/** Opens the "Use template" flow: fill variables, then create a draft in Compose. */
export function UseTemplateButton({ template, base, perms, className, children }: {
  template: TemplateRow
  base: string
  perms: TemplatePerms
  className?: string
  children?: React.ReactNode
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const keys = variableKeys(template)
  const [values, setValues] = useState<Record<string, string>>({})
  const blocked = template.status === 'archived' || !perms.useForContent

  const create = () => start(async () => {
    const result = await createFromTemplate({ id: template.id, variables: values })
    if (!result.ok || !result.id) { notify('error', result.error ?? 'Could not create a draft.'); return }
    notify('success', 'Draft created from template.')
    router.push(`${base}/compose?id=${result.id}`)
  })

  return (
    <>
      <button type="button" disabled={blocked || pending} onClick={() => (keys.length ? setOpen(true) : create())}
        title={!perms.useForContent ? 'Your role cannot create content' : template.status === 'archived' ? 'Restore the template first' : undefined}
        className={className ?? btnClass('primary', 'xs', 'lg:h-[22px] lg:px-[9px] lg:text-[8.5px]')}>
        {children ?? 'Use template'}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Use “${template.name}”`} size="md"
        description="Fill in the placeholders. Anything left blank stays as {{placeholder}} so you can finish it in Compose."
        footer={<><Btn size="md" onClick={() => setOpen(false)}>Cancel</Btn><Btn size="md" variant="primary" onClick={create} disabled={pending}>Create draft</Btn></>}>
        <div className="space-y-3">
          {keys.map((v, i) => (
            <label key={v.key} className="block text-[13px] font-medium capitalize text-slate-700">{v.label}
              <input data-autofocus={i === 0 || undefined} value={values[v.key] ?? ''} maxLength={500}
                onChange={e => setValues(s => ({ ...s, [v.key]: e.target.value }))}
                className="mt-1 block h-9 w-full rounded-lg border border-[#dfe3ea] px-2.5 text-[13px] font-normal normal-case outline-none focus:border-blue-400" />
            </label>
          ))}
          <p className="whitespace-pre-line rounded-lg bg-[#f7f9fc] p-3 text-[12px] text-slate-600">
            {keys.reduce((text, v) => (values[v.key] ? text.replaceAll(`{{${v.key}}}`, values[v.key]!) : text), template.caption_template ?? '')}
          </p>
        </div>
      </Dialog>
    </>
  )
}

export function PreviewTemplateButton({ id, className }: { id: string; className?: string }) {
  const select = useSelect()
  return <button type="button" onClick={() => select(id)} className={className ?? btnClass('secondary', 'xs', 'lg:h-[22px] lg:px-[9px] lg:text-[8.5px]')}>Preview</button>
}

export function DuplicateTemplateButton({ id, canCreate, className }: { id: string; canCreate: boolean; className?: string }) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, start] = useTransition()
  return (
    <button type="button" disabled={!canCreate || pending} title={canCreate ? undefined : 'Your role cannot create templates'}
      onClick={() => start(async () => {
        const result = await duplicateTemplate({ id })
        notify(result.ok ? 'success' : 'error', result.ok ? 'Template duplicated as a draft.' : result.error ?? 'Could not duplicate.')
        if (result.ok) router.refresh()
      })}
      className={className ?? btnClass('secondary', 'xs', 'lg:h-[22px] lg:px-[9px] lg:text-[8.5px]')}>
      Duplicate
    </button>
  )
}

export function FavouriteButton({ id, favourite, className }: { id: string; favourite: boolean; className?: string }) {
  const router = useRouter()
  const { notify } = useToast()
  const [on, setOn] = useState(favourite)
  const [pending, start] = useTransition()
  return (
    <button type="button" aria-pressed={on} aria-label={on ? 'Remove from favourites' : 'Add to favourites'} disabled={pending}
      onClick={() => start(async () => {
        setOn(v => !v)
        const result = await toggleTemplateFavourite({ id })
        if (!result.ok) { setOn(favourite); notify('error', result.error ?? 'Could not update favourites.'); return }
        router.refresh()
      })}
      className={cn('rounded p-1 hover:bg-slate-100', S_FOCUS, className)}>
      <Star size={13} className={on ? 'fill-[#f5a524] text-[#f5a524]' : 'text-slate-500'} />
    </button>
  )
}

/** Status workflow menu: request review → approve / request changes → publish → archive. */
export function TemplateMenu({ template, perms, onEdit, icon, label = 'Template actions', className }: {
  template: TemplateRow
  perms: TemplatePerms
  onEdit?: () => void
  icon?: React.ReactNode
  label?: string
  className?: string
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, start] = useTransition()
  const [changesOpen, setChangesOpen] = useState(false)
  const [note, setNote] = useState('')
  const status = template.status as TemplateStatus

  const move = (target: TemplateStatus, message: string, extra?: string) => start(async () => {
    const result = await setTemplateStatus({ id: template.id, status: target, note: extra })
    notify(result.ok ? 'success' : 'error', result.ok ? message : result.error ?? 'Could not update the template.')
    if (result.ok) { setChangesOpen(false); setNote(''); router.refresh() }
  })

  return (
    <>
      <Popover>
        <PopoverTrigger haspopup="menu" label={label} disabled={pending} className={className ?? cn('rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800', S_FOCUS)}>
          {icon ?? <MoreHorizontal size={14} />}
        </PopoverTrigger>
        <PopoverContent role="menu" label={label} width={210} align="end">
          {close => (<>
            {onEdit && <MenuItem close={close} onSelect={onEdit} disabled={!perms.edit} hint="Your role cannot edit templates">Edit template</MenuItem>}
            {['draft', 'changes_requested'].includes(status) && <MenuItem close={close} disabled={!perms.edit} onSelect={() => move('in_review', 'Sent for brand review.')}>Request review</MenuItem>}
            {status === 'in_review' && <MenuItem close={close} disabled={!perms.approve} hint="Only approvers can approve" onSelect={() => move('approved', 'Template approved.')}>Approve</MenuItem>}
            {status === 'in_review' && <MenuItem close={close} disabled={!perms.approve} hint="Only approvers can request changes" onSelect={() => setChangesOpen(true)}>Request changes</MenuItem>}
            {status === 'approved' && <MenuItem close={close} disabled={!perms.publish} hint="Your role cannot publish templates" onSelect={() => move('published', 'Template published to the library.')}>Publish</MenuItem>}
            <MenuSeparator />
            {status !== 'archived'
              ? <MenuItem close={close} danger disabled={!perms.edit} onSelect={() => { if (confirm(`Archive “${template.name}”? It stops appearing in pickers.`)) move('archived', 'Template archived.') }}>Archive</MenuItem>
              : <MenuItem close={close} disabled={!perms.edit} onSelect={() => move('draft', 'Template restored as a draft.')}>Restore</MenuItem>}
          </>)}
        </PopoverContent>
      </Popover>
      <Dialog open={changesOpen} onClose={() => setChangesOpen(false)} title="Request changes" size="sm"
        description="The owner sees this note on the template."
        footer={<><Btn size="md" onClick={() => setChangesOpen(false)}>Cancel</Btn><Btn size="md" variant="primary" disabled={!note.trim() || pending} onClick={() => move('changes_requested', 'Changes requested.', note.trim())}>Send</Btn></>}>
        <textarea data-autofocus value={note} onChange={e => setNote(e.target.value.slice(0, 500))} rows={4} aria-label="What needs to change"
          className="block w-full resize-none rounded-lg border border-[#dfe3ea] p-2.5 text-[13px] outline-none focus:border-blue-400" />
      </Dialog>
    </>
  )
}

/** Create / edit a template. */
export function TemplateEditor({ template, covers, open, onClose }: {
  template: TemplateRow | null
  covers: CoverOption[]
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, start] = useTransition()
  const [form, setForm] = useState({
    name: template?.name ?? '', description: template?.description ?? '', caption: template?.caption_template ?? '',
    channel: template?.channel ?? 'linkedin', category: template?.category ?? 'social',
    platforms: template?.platforms ?? [], tags: (template?.tags ?? []).join(', '), hashtags: (template?.hashtags ?? []).join(' '),
    cover: undefined as string | null | undefined,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }))

  const save = () => start(async () => {
    const result = await saveTemplate({
      id: template?.id, name: form.name, description: form.description, captionTemplate: form.caption, channel: form.channel,
      category: form.category, platforms: form.platforms.length ? form.platforms : [form.channel],
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      hashtags: form.hashtags.split(/\s+/).map(t => t.trim()).filter(Boolean).map(t => (t.startsWith('#') ? t : `#${t}`)),
      coverAssetId: form.cover,
    })
    if (!result.ok) { setErrors(result.fieldErrors ?? {}); notify('error', result.error ?? 'Could not save.'); return }
    notify('success', result.message ?? 'Saved.')
    onClose()
    router.refresh()
  })

  const input = 'mt-1 block w-full rounded-lg border border-[#dfe3ea] px-2.5 text-[13px] font-normal outline-none focus:border-blue-400'
  return (
    <Dialog open={open} onClose={onClose} size="lg" title={template ? `Edit “${template.name}”` : 'New template'}
      description="Use {{placeholders}} for anything that changes each time, such as {{product}} or {{date}}."
      footer={<><Btn size="md" onClick={onClose}>Cancel</Btn><Btn size="md" variant="primary" onClick={save} disabled={pending}>{template ? 'Save changes' : 'Create template'}</Btn></>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-[12px] font-medium text-slate-700 sm:col-span-2">Name
          <input data-autofocus value={form.name} maxLength={160} onChange={e => set('name', e.target.value)} className={cn(input, 'h-9', errors.name && 'border-red-300')} />
          {errors.name && <span className="mt-1 block text-[11px] font-normal text-red-600">{errors.name}</span>}
        </label>
        <label className="block text-[12px] font-medium text-slate-700">Primary channel
          <select value={form.channel} onChange={e => set('channel', e.target.value)} className={cn(input, 'h-9')}>
            {STUDIO_CHANNELS.map(c => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
          </select>
        </label>
        <label className="block text-[12px] font-medium text-slate-700">Category
          <select value={form.category} onChange={e => set('category', e.target.value)} className={cn(input, 'h-9')}>
            {TEMPLATE_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </label>
        <label className="block text-[12px] font-medium text-slate-700 sm:col-span-2">Description
          <input value={form.description} maxLength={1000} onChange={e => set('description', e.target.value)} className={cn(input, 'h-9')} />
        </label>
        <label className="block text-[12px] font-medium text-slate-700 sm:col-span-2">Caption template
          <textarea value={form.caption} rows={5} maxLength={20000} onChange={e => set('caption', e.target.value)} className={cn(input, 'resize-none py-2')} />
        </label>
        <label className="block text-[12px] font-medium text-slate-700">Tags <span className="font-normal text-slate-500">(comma separated)</span>
          <input value={form.tags} onChange={e => set('tags', e.target.value)} className={cn(input, 'h-9')} />
        </label>
        <label className="block text-[12px] font-medium text-slate-700">Hashtags
          <input value={form.hashtags} onChange={e => set('hashtags', e.target.value)} placeholder="#Launch #Product" className={cn(input, 'h-9')} />
        </label>
        <div className="sm:col-span-2">
          <span className="block text-[12px] font-medium text-slate-700">Cover image</span>
          {covers.length === 0 ? <p className="mt-1 text-[12px] text-slate-500">Upload images in Media to use them as covers.</p> : (
            <ul className="mt-1 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {covers.map(c => {
                const on = form.cover === c.id
                return (
                  <li key={c.id}>
                    <button type="button" aria-pressed={on} aria-label={`Use ${c.name} as cover`} onClick={() => set('cover', on ? undefined : c.id)}
                      className={cn('block aspect-square w-full overflow-hidden rounded-md bg-slate-100', S_FOCUS, on && 'ring-2 ring-[#1a5cff] ring-offset-1')}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {c.url && <img src={c.url} alt="" className="h-full w-full object-cover" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {errors.cover && <span className="mt-1 block text-[11px] text-red-600">{errors.cover}</span>}
        </div>
      </div>
    </Dialog>
  )
}

interface ImportRow { name: string; caption?: string; channel?: string; category?: string; tags?: string[]; hashtags?: string[] }

function parseImport(text: string, fileName: string): ImportRow[] {
  if (fileName.toLowerCase().endsWith('.json')) {
    const data = JSON.parse(text) as unknown
    const list = Array.isArray(data) ? data : [data]
    return list.map(item => {
      const r = item as Record<string, unknown>
      return {
        name: String(r.name ?? ''), caption: typeof r.caption === 'string' ? r.caption : typeof r.caption_template === 'string' ? r.caption_template : '',
        channel: typeof r.channel === 'string' ? r.channel : undefined, category: typeof r.category === 'string' ? r.category : undefined,
        tags: Array.isArray(r.tags) ? r.tags.map(String) : [], hashtags: Array.isArray(r.hashtags) ? r.hashtags.map(String) : [],
      }
    })
  }
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  const split = (line: string) => [...line.matchAll(/("([^"]|"")*"|[^,]*)(,|$)/g)].map(m => m[1]!.replace(/^"|"$/g, '').replace(/""/g, '"')).slice(0, -1)
  const header = split(lines[0] ?? '').map(h => h.trim().toLowerCase())
  return lines.slice(1).map(line => {
    const cells = split(line)
    const get = (key: string) => cells[header.indexOf(key)]?.trim() ?? ''
    return {
      name: get('name'), caption: get('caption'), channel: get('channel') || undefined, category: get('category') || undefined,
      tags: get('tags').split(/[;|]/).map(t => t.trim()).filter(Boolean), hashtags: get('hashtags').split(/\s+/).filter(Boolean),
    }
  })
}

/** Quick actions rail: create, import, request review of the selected template, guidelines. */
export function TemplateQuickActions({ selected, covers, perms, guidelines }: {
  selected: TemplateRow | null
  covers: CoverOption[]
  perms: TemplatePerms
  guidelines: string[]
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, start] = useTransition()
  const [creating, setCreating] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const fileId = useId()

  const importFile = (f: File) => start(async () => {
    if (f.size > 1024 * 1024) { notify('error', 'Import files are limited to 1 MB.'); return }
    if (!/\.(json|csv)$/i.test(f.name)) { notify('error', 'Import a .json or .csv file.'); return }
    let rows: ImportRow[]
    try { rows = parseImport(await f.text(), f.name).filter(r => r.name.trim()).slice(0, 50) } catch { notify('error', 'That file could not be read. Check it is valid JSON or CSV.'); return }
    if (!rows.length) { notify('error', 'No templates with a name were found in that file.'); return }
    let created = 0
    const failures: string[] = []
    for (const r of rows) {
      const result = await saveTemplate({ name: r.name, captionTemplate: r.caption, channel: r.channel, category: r.category, tags: r.tags, hashtags: r.hashtags })
      if (result.ok) created += 1
      else failures.push(`${r.name}: ${result.error}`)
    }
    notify(failures.length ? 'error' : 'success', `${created} template${created === 1 ? '' : 's'} imported as drafts.${failures.length ? ` ${failures.length} skipped (${failures[0]}).` : ''}`)
    router.refresh()
  })

  const review = () => start(async () => {
    if (!selected) return
    const result = await setTemplateStatus({ id: selected.id, status: 'in_review' })
    notify(result.ok ? 'success' : 'error', result.ok ? `“${selected.name}” sent for review.` : result.error ?? 'Could not request review.')
    if (result.ok) router.refresh()
  })

  const reviewable = selected && ['draft', 'changes_requested'].includes(selected.status)
  const items = [
    { icon: <FilePlus2 size={13} />, title: 'Create new template', hint: 'Start from scratch', onClick: () => setCreating(true), disabled: !perms.create, reason: 'Your role cannot create templates' },
    { icon: <Download size={13} />, title: 'Import template', hint: 'Import from a JSON or CSV file', onClick: () => (document.getElementById(fileId) as HTMLInputElement | null)?.click(), disabled: !perms.create || pending, reason: 'Your role cannot create templates' },
    { icon: <Send size={13} />, title: 'Request review', hint: reviewable ? `Submit “${selected!.name}” for review` : 'Select a draft template to submit', onClick: review, disabled: !perms.edit || !reviewable || pending, reason: 'Select a draft template first' },
    { icon: <BookOpen size={13} />, title: 'Template guidelines', hint: 'Best practices & standards', onClick: () => setGuideOpen(true), disabled: false, reason: '' },
  ]

  return (
    <>
      <input id={fileId} type="file" accept=".json,.csv,application/json,text/csv" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = '' }} />
      <ul className="mt-3 space-y-1.5 lg:mt-[12px] lg:space-y-[5px]">
        {items.map(item => (
          <li key={item.title}>
            <button type="button" onClick={item.onClick} disabled={item.disabled} title={item.disabled ? item.reason : undefined}
              className={cn('flex w-full items-center gap-3 rounded-[8px] border border-[#eceff4] px-3 py-2 text-left hover:border-[#c9d8ff] hover:bg-[#fafbff] disabled:cursor-not-allowed disabled:opacity-60 lg:h-[36px] lg:gap-[12px] lg:px-[8px] lg:py-0', S_FOCUS)}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-[#eef3ff] text-[#2f62f5] lg:h-[24px] lg:w-[24px]" aria-hidden>{item.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-slate-800 lg:text-[9.5px]">{item.title}</span>
                <span className="block truncate text-[12px] text-slate-500 lg:text-[8.5px]">{item.hint}</span>
              </span>
              <ChevronRight size={13} className="shrink-0 text-slate-500" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {creating && <TemplateEditor template={null} covers={covers} open onClose={() => setCreating(false)} />}
      <Dialog open={guideOpen} onClose={() => setGuideOpen(false)} title="Template guidelines" size="md">
        <ul className="list-disc space-y-2 pl-5 text-[13px] text-slate-700">
          {guidelines.map(g => <li key={g}>{g}</li>)}
        </ul>
      </Dialog>
    </>
  )
}

/** Sticky footer actions for the selected template. */
export function SelectedTemplateActions({ template, covers, base, perms }: { template: TemplateRow; covers: CoverOption[]; base: string; perms: TemplatePerms }) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="flex gap-3 lg:gap-[16px]">
      <Btn size="lg" onClick={() => setEditing(true)} disabled={!perms.edit} title={perms.edit ? undefined : 'Your role cannot edit templates'}
        className="flex-1 border-[#b9ccff] text-[#1a5cff] lg:h-[34px] lg:text-[11px]">Edit template</Btn>
      <div className="inline-flex flex-[1.4]">
        <UseTemplateButton template={template} base={base} perms={perms} className={btnClass('primary', 'lg', 'flex-1 rounded-r-none lg:h-[34px] lg:text-[11px]')}>Use template</UseTemplateButton>
        <TemplateMenu template={template} perms={perms} onEdit={() => setEditing(true)} label="More template actions" icon={<ChevronDown size={14} />}
          className={btnClass('primary', 'lg', 'rounded-l-none border-l-white/25 px-2.5 lg:h-[34px] lg:w-[34px] lg:px-0')} />
      </div>
      {editing && <TemplateEditor template={template} covers={covers} open onClose={() => setEditing(false)} />}
    </div>
  )
}

/** "Full preview" link in the template preview card: the same channel preview at full size. */
export function FullTemplatePreview({ name, channel, account, caption, mediaUrl }: {
  name: string
  channel: string
  account: PreviewAccountLite
  caption: string
  mediaUrl: string | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn('inline-flex items-center gap-1 text-[12px] font-medium text-[#1a5cff] hover:underline lg:text-[9px]', S_FOCUS)}>
        Full preview <ExternalLink size={10} aria-hidden />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} size="md" title={name}
        description="Placeholders such as {{product}} are filled in when the template is used.">
        <SocialPreview channel={channel} account={account} content={{ caption, mediaUrl }} />
      </Dialog>
    </>
  )
}