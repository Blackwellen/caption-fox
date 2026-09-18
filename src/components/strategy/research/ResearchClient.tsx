'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronDown, CloudUpload, Download, FileSpreadsheet, FileText, MoreHorizontal, MoreVertical, Plus, PlusCircle, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  archiveResearch, createCollection, deleteResearch, getResearchFileUrl, moveResearchToCollection, registerResearchFile,
  restoreResearch, setResearchStatus, setResearchTags, toggleResearchFavourite,
} from '@/lib/strategy/actions/research'
import {
  IMPACT_LEVELS, IMPACT_SHORT, RESEARCH_FILE_MAX_BYTES, RESEARCH_FILE_TYPES, RESEARCH_METHOD_LABELS, RESEARCH_METHODS,
  RESEARCH_SOURCE_LABELS, RESEARCH_SOURCE_TYPES,
} from '@/lib/strategy/constants'
import { formatBytes } from '@/lib/strategy/format'
import type { ResearchRow } from '@/lib/strategy/types'
import { BUTTON, ICON } from '../buttons'
import { Menu, type MenuItem } from '../client/menu'
import { ConfirmDialog, Dialog, DialogButton } from '../client/dialog'
import { FormError, FormGrid, SelectField, TextArea, TextField } from '../client/fields'
import { useStrategyAction } from '../client/use-action'
import { useToast } from '../client/toast'
import { ResearchDialog } from '../forms/ResearchDialog'

interface Can { create: boolean; upload: boolean; approve: boolean; delete: boolean; export: boolean }
interface Option { id: string; name: string }

export function ResearchHeaderActions({ workspaceId, collections, can }: { workspaceId: string; collections: Option[]; can: Can }) {
  const params = useSearchParams()
  const [addOpen, setAddOpen] = useState(false)
  const [briefOpen, setBriefOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const exportHref = (format: string) => {
    const qs = new URLSearchParams(params.toString())
    qs.set('module', 'research'); qs.set('format', format)
    return `/api/strategy/export?${qs}`
  }
  return (
    <>
      {can.create && <button type="button" className={BUTTON.primary} onClick={() => setAddOpen(true)}><PlusCircle aria-hidden className={ICON} /> Add research</button>}
      {can.upload && <button type="button" className={BUTTON.secondary} onClick={() => setUploadOpen(true)}><CloudUpload aria-hidden className={ICON} /> Upload file</button>}
      {can.create && <button type="button" className={BUTTON.secondary} onClick={() => setBriefOpen(true)}><FileText aria-hidden className={ICON} /> Create brief</button>}
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
        { id: 'archived', label: 'View archived research', href: '?view=table&archived=1' },
        { id: 'review', label: 'Pending review', href: '?view=board' },
      ]} trigger={({ ref, toggle, ...aria }) => (
        <button ref={ref} type="button" onClick={toggle} {...aria} aria-label="More actions" className={BUTTON.icon}><MoreVertical aria-hidden className={ICON} /></button>
      )} />
      <ResearchDialog open={addOpen} onClose={() => setAddOpen(false)} collections={collections} />
      <ResearchDialog open={briefOpen} onClose={() => setBriefOpen(false)} collections={collections} brief />
      <UploadResearchDialog open={uploadOpen} onClose={() => setUploadOpen(false)} workspaceId={workspaceId} collections={collections} />
    </>
  )
}

function UploadResearchDialog({ open, onClose, workspaceId, collections }: { open: boolean; onClose: () => void; workspaceId: string; collections: Option[] }) {
  const { run, pending } = useStrategyAction()
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<'idle' | 'uploading' | 'checking'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const busy = pending || progress !== 'idle'

  function choose(next: File | null) {
    setError(null)
    if (!next) { setFile(null); return }
    if (!(RESEARCH_FILE_TYPES as readonly string[]).includes(next.type)) { setError('Upload a PDF, Word, PowerPoint, Excel, CSV, text, PNG or JPEG file.'); setFile(null); return }
    if (next.size > RESEARCH_FILE_MAX_BYTES) { setError('Files must be 25 MB or smaller.'); setFile(null); return }
    setFile(next)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file || busy) { if (!file) setError('Choose a file to upload.'); return }
    const form = new FormData(event.currentTarget)
    const safe = file.name.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(-80) || 'file'
    const path = `${workspaceId}/research/${crypto.randomUUID()}-${safe}`
    setProgress('uploading')
    const { error: uploadError } = await createClient().storage.from('strategy-research').upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) {
      setProgress('idle')
      setError(uploadError.message.includes('row-level security') ? 'Your role cannot upload research files.' : 'Upload failed. Check your connection and try again.')
      return
    }
    setProgress('checking')
    const result = await run(() => registerResearchFile({
      path, file_name: file.name, file_type: file.type,
      title: String(form.get('title') ?? ''), source_type: String(form.get('source_type') ?? ''), method: String(form.get('method') ?? ''),
      impact: String(form.get('impact') ?? ''), collection_id: String(form.get('collection_id') ?? '') || undefined,
      summary: String(form.get('summary') ?? ''),
    }))
    setProgress('idle')
    if (result.ok) { setFile(null); setFieldErrors({}); onClose() }
    else { setFieldErrors(result.fieldErrors ?? {}); setError(result.error ?? null) }
  }

  return (
    <Dialog open={open} onClose={onClose} busy={busy} size="lg" title="Upload research file"
      description="Files are stored privately in your workspace and shared only through short-lived links."
      footer={<><DialogButton onClick={onClose} disabled={busy}>Cancel</DialogButton><DialogButton variant="primary" type="submit" form="strategy-upload-research" disabled={busy || !file} aria-busy={busy}>{progress === 'uploading' ? 'Uploading…' : progress === 'checking' ? 'Checking file…' : 'Upload'}</DialogButton></>}>
      <FormError message={error} />
      <form id="strategy-upload-research" onSubmit={submit} noValidate>
        <label onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); choose(event.dataTransfer.files?.[0] ?? null) }}
          className="mb-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-sg-line bg-slate-50 px-4 py-7 text-center hover:border-sg-blue">
          <CloudUpload aria-hidden className="h-6 w-6 text-slate-400" />
          <span className="text-[13px] font-medium text-sg-ink">{file ? `${file.name} · ${formatBytes(file.size)}` : 'Drop a file or choose one'}</span>
          <span className="text-[12px] text-sg-muted">PDF, DOCX, PPTX, XLSX, CSV, TXT, PNG or JPEG · up to 25 MB</span>
          <input type="file" className="sr-only" accept={RESEARCH_FILE_TYPES.join(',')} onChange={event => choose(event.target.files?.[0] ?? null)} />
        </label>
        <FormGrid>
          <TextField className="sm:col-span-2" label="Title" name="title" required maxLength={160} defaultValue={file?.name.replace(/\.[^.]+$/, '') ?? ''} key={file?.name} error={fieldErrors.title} />
          <SelectField label="Source type" name="source_type" defaultValue="market_research" options={RESEARCH_SOURCE_TYPES.map(value => ({ value, label: RESEARCH_SOURCE_LABELS[value] }))} />
          <SelectField label="Method" name="method" defaultValue="report" options={RESEARCH_METHODS.map(value => ({ value, label: RESEARCH_METHOD_LABELS[value] }))} />
          <SelectField label="Impact" name="impact" defaultValue="medium" options={IMPACT_LEVELS.map(value => ({ value, label: IMPACT_SHORT[value] }))} />
          <SelectField label="Collection" name="collection_id" placeholder="No collection" options={collections.map(item => ({ value: item.id, label: item.name }))} />
          <TextArea className="sm:col-span-2" label="Summary" name="summary" maxLength={4000} />
        </FormGrid>
      </form>
    </Dialog>
  )
}

export function FavouriteToggle({ id, title, favourite, canEdit }: { id: string; title: string; favourite: boolean; canEdit: boolean }) {
  const { run } = useStrategyAction()
  const [on, setOn] = useState(favourite)
  return (
    <button type="button" aria-pressed={on} aria-label={on ? `Remove ${title} from favourites` : `Add ${title} to favourites`}
      disabled={!canEdit} title={canEdit ? undefined : 'Your role cannot change favourites'}
      onClick={async () => { const next = !on; setOn(next); const result = await run(() => toggleResearchFavourite(id, next), { quiet: true }); if (!result.ok) setOn(!next) }}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-slate-100 disabled:cursor-not-allowed lg:h-5 lg:w-5">
      <Star aria-hidden className={cn('h-4 w-4 lg:h-[14px] lg:w-[14px]', on ? 'fill-orange-400 text-orange-400' : 'text-slate-400')} />
    </button>
  )
}

export function ResearchMenu({ item, collections, can }: { item: ResearchRow; collections: Option[]; can: Can }) {
  const { run, pending } = useStrategyAction()
  const { notify } = useToast()
  const [revise, setRevise] = useState(false)
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null)
  const archived = Boolean(item.archived_at)

  const items: MenuItem[] = [
    ...(item.file_path ? [{ id: 'download', label: 'Download file', onSelect: async () => {
      const result = await getResearchFileUrl(item.id)
      if (result.ok && result.message) window.location.assign(result.message)
      else notify('error', result.error ?? 'Could not open the file.')
    } }] : []),
    ...(!archived && can.create && (item.status === 'draft' || item.status === 'needs_revision') ? [{ id: 'submit', label: 'Submit for review', onSelect: () => { void run(() => setResearchStatus(item.id, 'in_review')) } }] : []),
    ...(!archived && can.approve && item.status === 'in_review' ? [
      { id: 'approve', label: 'Approve', onSelect: () => { void run(() => setResearchStatus(item.id, 'approved')) } },
      { id: 'revise', label: 'Request revision…', onSelect: () => setRevise(true) },
    ] : []),
    ...(!archived && can.create ? collections.slice(0, 8).map((collection, index) => ({
      id: `move-${collection.id}`, label: `Move to ${collection.name}`, separatorBefore: index === 0, selected: item.collection_id === collection.id,
      onSelect: () => { void run(() => moveResearchToCollection(item.id, collection.id)) },
    })) : []),
    ...(can.create ? [archived
      ? { id: 'restore', label: 'Restore', separatorBefore: true, onSelect: () => { void run(() => restoreResearch(item.id)) } }
      : { id: 'archive', label: 'Archive', separatorBefore: true, onSelect: () => setConfirm('archive') }] : []),
    ...(can.delete && archived ? [{ id: 'delete', label: 'Delete permanently', danger: true, onSelect: () => setConfirm('delete') }] : []),
  ]

  return (
    <>
      <Menu label={`Actions for ${item.title}`} items={items} trigger={({ ref, toggle, ...aria }) => (
        <button ref={ref} type="button" onClick={toggle} {...aria} aria-label={`Actions for ${item.title}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 lg:h-5 lg:w-6">
          <MoreHorizontal aria-hidden className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
        </button>
      )} />
      <Dialog open={revise} onClose={() => setRevise(false)} busy={pending} size="sm" title="Request revision" description="Tell the author what needs to change. They are notified."
        footer={<><DialogButton onClick={() => setRevise(false)}>Cancel</DialogButton><DialogButton variant="primary" disabled={pending || !note.trim()}
          onClick={async () => { const result = await run(() => setResearchStatus(item.id, 'needs_revision', note)); if (result.ok) { setRevise(false); setNote('') } }}>Send back</DialogButton></>}>
        <TextArea label="Comment" name="comment" required maxLength={1000} value={note} onChange={event => setNote(event.target.value)} />
      </Dialog>
      <ConfirmDialog open={confirm !== null} onClose={() => setConfirm(null)} busy={pending} danger={confirm === 'delete'}
        title={confirm === 'delete' ? `Delete “${item.title}”?` : `Archive “${item.title}”?`}
        description={confirm === 'delete' ? 'This permanently deletes the record and its stored file.' : 'Archived research leaves the library but can be restored.'}
        confirmLabel={confirm === 'delete' ? 'Delete' : 'Archive'}
        onConfirm={async () => { const result = await run(() => (confirm === 'delete' ? deleteResearch(item.id) : archiveResearch(item.id))); if (result.ok) setConfirm(null) }} />
    </>
  )
}

export function NewCollectionButton({ canCreate }: { canCreate: boolean }) {
  const { run, pending } = useStrategyAction()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  if (!canCreate) return null
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="New collection" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 lg:h-5 lg:w-5">
        <Plus aria-hidden className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} busy={pending} size="sm" title="New collection"
        footer={<><DialogButton onClick={() => setOpen(false)}>Cancel</DialogButton><DialogButton variant="primary" disabled={pending || !name.trim()}
          onClick={async () => { const result = await run(() => createCollection(name)); if (result.ok) { setOpen(false); setName(''); setError(null) } else setError(result.error ?? null) }}>Create</DialogButton></>}>
        <TextField label="Collection name" name="collection" required maxLength={60} value={name} onChange={event => setName(event.target.value)} error={error ?? undefined} />
      </Dialog>
    </>
  )
}

/**
 * "+ Add tag" in the tag bar: applies one tag to the research items currently
 * listed. Tags live on each item, so this is a bulk edit of real records rather
 * than a workspace-level tag list.
 */
export function AddTagButton({ items, canEdit }: { items: Option[]; canEdit: boolean }) {
  const { run, pending } = useStrategyAction()
  const [open, setOpen] = useState(false)
  const [tag, setTag] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  if (!canEdit || items.length === 0) return null

  const close = () => { setOpen(false); setTag(''); setSelected([]); setError(null) }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1 rounded-md border border-dashed border-sg-line px-2.5 text-[12px] font-medium text-sg-blue hover:bg-sg-blue-soft lg:h-[17px] lg:px-[6px] lg:text-[8.5px]">
        <Plus aria-hidden className="h-3 w-3 lg:h-2.5 lg:w-2.5" /> Add tag
      </button>
      <Dialog open={open} onClose={close} busy={pending} size="md" title="Add a tag"
        description="Tags belong to research items. Pick the items on this page that should carry it."
        footer={(
          <>
            <DialogButton onClick={close} disabled={pending}>Cancel</DialogButton>
            <DialogButton variant="primary" disabled={pending || !tag.trim() || selected.length === 0}
              onClick={async () => {
                const result = await run(() => setResearchTags(selected, [tag]))
                if (result.ok) close(); else setError(result.error ?? null)
              }}>{pending ? 'Saving…' : `Tag ${selected.length || ''} item${selected.length === 1 ? '' : 's'}`}</DialogButton>
          </>
        )}>
        <FormError message={error} />
        <TextField label="Tag" name="tag" required maxLength={40} value={tag} placeholder="e.g. Gen Z"
          onChange={event => setTag(event.target.value)} />
        <fieldset className="mt-4">
          <legend className="mb-1.5 flex w-full items-center justify-between text-[12.5px] font-medium text-sg-body">
            Research on this page
            <button type="button" className="text-[12px] font-medium text-sg-blue"
              onClick={() => setSelected(selected.length === items.length ? [] : items.map(item => item.id))}>
              {selected.length === items.length ? 'Clear' : 'Select all'}
            </button>
          </legend>
          <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-sg-line p-2">
            {items.map(item => (
              <label key={item.id} className="flex min-h-9 items-center gap-2 rounded px-2 text-[13px] hover:bg-slate-50">
                <input type="checkbox" className="h-4 w-4 accent-[var(--color-sg-blue)]" checked={selected.includes(item.id)}
                  onChange={event => setSelected(list => event.target.checked ? [...list, item.id] : list.filter(id => id !== item.id))} />
                {item.name}
              </label>
            ))}
          </div>
        </fieldset>
      </Dialog>
    </>
  )
}