'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, RotateCcw, Upload, X, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/campaigns/Toast'
import { createClient } from '@/lib/supabase/client'
import { addSubmissionVersion, createSubmission, uploadSubmissionPath } from '@/lib/creators/actions'
import { ASSET_TYPE_LABELS, ASSET_TYPES, UPLOAD_LIMITS, mediaTypeForMime } from '@/lib/creators/constants'
import { BUTTON_SECONDARY } from './design'
import { useCreatorsBase } from './controls'

type FileState = { key: string; file: File; status: 'queued' | 'uploading' | 'done' | 'error'; path?: string; error?: string }

const MB = 1024 * 1024

/**
 * Upload queue backed by the private `ugc-submissions` bucket. The server
 * issues the workspace-scoped path, the browser uploads under RLS, and the
 * server action re-verifies every object before any record is written.
 */
function useUploadQueue() {
  const [files, setFiles] = useState<FileState[]>([])
  const patch = (key: string, next: Partial<FileState>) => setFiles(list => list.map(f => (f.key === key ? { ...f, ...next } : f)))

  function add(list: FileList | null): string | null {
    if (!list) return null
    const incoming = [...list]
    if (files.length + incoming.length > UPLOAD_LIMITS.maxFiles) return `Upload at most ${UPLOAD_LIMITS.maxFiles} files at a time.`
    for (const file of incoming) {
      if (!UPLOAD_LIMITS.mimeTypes.includes(file.type as never)) return `${file.name}: unsupported file type. Use images, MP4/MOV/WebM video, MP3/M4A audio or PDF.`
      if (file.size <= 0 || file.size > UPLOAD_LIMITS.maxBytes) return `${file.name}: files must be under ${UPLOAD_LIMITS.maxBytes / MB} MB.`
    }
    setFiles(list => [...list, ...incoming.map(file => ({ key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`, file, status: 'queued' as const }))])
    return null
  }

  async function uploadOne(item: FileState): Promise<FileState> {
    patch(item.key, { status: 'uploading', error: undefined })
    const target = await uploadSubmissionPath(item.file.type, item.file.name)
    if (!target.ok || !target.path) {
      const failed = { ...item, status: 'error' as const, error: target.error ?? 'Could not prepare the upload.' }
      patch(item.key, failed)
      return failed
    }
    const { error } = await createClient().storage.from(UPLOAD_LIMITS.bucket).upload(target.path, item.file, { contentType: item.file.type, upsert: false })
    const result = error
      ? { ...item, status: 'error' as const, error: error.message }
      : { ...item, status: 'done' as const, path: target.path }
    patch(item.key, result)
    return result
  }

  async function uploadAll(): Promise<FileState[]> {
    const results: FileState[] = []
    for (const item of files) results.push(item.status === 'done' ? item : await uploadOne(item))
    return results
  }

  return { files, setFiles, add, uploadAll, uploadOne, remove: (key: string) => setFiles(list => list.filter(f => f.key !== key)) }
}

function FileQueue({ queue, onRetry }: { queue: ReturnType<typeof useUploadQueue>; onRetry: (item: FileState) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [pickError, setPickError] = useState<string | null>(null)
  return (
    <div className="space-y-2">
      {pickError && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{pickError}</p>}
      <button type="button" onClick={() => input.current?.click()}
        className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-[13px] text-slate-500 hover:border-blue-400 hover:bg-blue-50/40">
        <Upload size={18} className="text-slate-400" aria-hidden />
        <span className="font-medium text-slate-700">Choose files to upload</span>
        <span className="text-[11px]">Images, video, audio or PDF · up to {UPLOAD_LIMITS.maxBytes / MB} MB each · max {UPLOAD_LIMITS.maxFiles} files</span>
      </button>
      <input ref={input} type="file" multiple hidden accept={UPLOAD_LIMITS.mimeTypes.join(',')} onChange={e => { setPickError(queue.add(e.target.files)); e.target.value = '' }} />
      {queue.files.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200" aria-live="polite">
          {queue.files.map(item => (
            <li key={item.key} className="flex items-center gap-2 px-3 py-2 text-[12.5px]">
              {item.status === 'done' ? <CheckCircle2 size={14} className="text-emerald-500" aria-label="Uploaded" />
                : item.status === 'uploading' ? <Loader2 size={14} className="animate-spin text-blue-500" aria-label="Uploading" />
                  : item.status === 'error' ? <XCircle size={14} className="text-red-500" aria-label="Failed" />
                    : <span className="h-3.5 w-3.5 rounded-full border border-slate-300" aria-label="Queued" />}
              <span className="min-w-0 flex-1 truncate text-slate-700">{item.file.name}</span>
              <span className="text-[11px] text-slate-400">{(item.file.size / MB).toFixed(1)} MB</span>
              {item.status === 'error' && (
                <button type="button" onClick={() => onRetry(item)} className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600" title={item.error}>
                  <RotateCcw size={11} />Retry
                </button>
              )}
              {item.status !== 'uploading' && (
                <button type="button" onClick={() => queue.remove(item.key)} aria-label={`Remove ${item.file.name}`} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                  <X size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {queue.files.some(f => f.status === 'error') && (
        <p role="alert" className="text-[11.5px] text-red-600">{queue.files.find(f => f.status === 'error')?.error}</p>
      )}
    </div>
  )
}

/** Brief detail: upload a creator's deliverable against this brief. */
export function UploadSubmissionButton({
  briefId, creators, deliverables,
}: {
  briefId: string
  creators: { id: string; name: string }[]
  deliverables: { id: string; title: string; asset_type: string }[]
}) {
  const base = useCreatorsBase()
  const { notify } = useToast()
  const queue = useUploadQueue()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ creatorId: '', deliverableId: '', title: '', assetType: '', notes: '' })

  function close() { if (busy) return; setOpen(false); setError(null); queue.setFiles([]); setForm({ creatorId: '', deliverableId: '', title: '', assetType: '', notes: '' }) }

  async function submit() {
    if (busy) return
    if (!form.creatorId) { setError('Choose the creator who delivered this.'); return }
    if (queue.files.length === 0) { setError('Add at least one file.'); return }
    setBusy(true); setError(null)
    const uploaded = await queue.uploadAll()
    if (uploaded.some(f => f.status !== 'done')) { setBusy(false); setError('Some files failed to upload. Retry or remove them, then submit again.'); return }
    const result = await createSubmission({
      briefId, creatorId: form.creatorId, deliverableId: form.deliverableId || undefined, title: form.title || undefined,
      assetType: form.assetType || undefined, notes: form.notes || undefined,
      files: uploaded.map(f => ({ path: f.path!, mediaType: mediaTypeForMime(f.file.type), mimeType: f.file.type, sizeBytes: f.file.size, originalName: f.file.name })),
    })
    setBusy(false)
    if (!result.ok) { setError(result.error ?? 'Could not create the submission.'); return }
    notify('success', result.message ?? 'Submission uploaded.')
    setOpen(false); queue.setFiles([])
    // The action's revalidation refresh can swallow a soft push that races it,
    // so hand off with a hard navigation to the new submission.
    window.location.assign(`${base}/submissions/${result.id}`)
  }

  return (
    <>
      <button type="button" className={BUTTON_SECONDARY} onClick={() => setOpen(true)} disabled={creators.length === 0}
        title={creators.length === 0 ? 'Assign a creator to this brief before uploading their work.' : undefined}>
        <Upload size={16} aria-hidden />Upload submission
      </button>
      <Modal open={open} onClose={close} size="lg" title="Upload a submission" description="Deliverables are stored privately and reviewed before any use."
        footer={<div className="flex w-full justify-end gap-2"><Button variant="secondary" size="sm" onClick={close} disabled={busy}>Cancel</Button><Button size="sm" loading={busy} onClick={submit}>Upload & submit for review</Button></div>}>
        <div className="space-y-3">
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Creator" required value={form.creatorId} onChange={e => setForm(f => ({ ...f, creatorId: e.target.value }))}
              options={[{ value: '', label: 'Select a creator' }, ...creators.map(c => ({ value: c.id, label: c.name }))]} />
            <Select label="Deliverable" value={form.deliverableId}
              onChange={e => { const d = deliverables.find(x => x.id === e.target.value); setForm(f => ({ ...f, deliverableId: e.target.value, assetType: d?.asset_type ?? f.assetType })) }}
              options={[{ value: '', label: 'Not linked' }, ...deliverables.map(d => ({ value: d.id, label: d.title }))]} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Title" maxLength={160} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Summer Glow Skincare Reel" />
            <Select label="Asset type" value={form.assetType} onChange={e => setForm(f => ({ ...f, assetType: e.target.value }))}
              options={[{ value: '', label: 'Detect from file' }, ...ASSET_TYPES.map(t => ({ value: t, label: ASSET_TYPE_LABELS[t] }))]} />
          </div>
          <FileQueue queue={queue} onRetry={item => { void queue.uploadOne(item) }} />
          <Textarea label="Notes for the reviewer (optional)" rows={2} maxLength={2000} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </Modal>
    </>
  )
}

/** Submission detail: upload a new version after changes were requested. */
export function UploadVersionButton({ submissionId, disabledReason }: { submissionId: string; disabledReason?: string | null }) {
  const router = useRouter()
  const { notify } = useToast()
  const queue = useUploadQueue()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function close() { if (busy) return; setOpen(false); setError(null); setNote(''); queue.setFiles([]) }

  async function submit() {
    if (busy) return
    if (queue.files.length === 0) { setError('Add at least one file.'); return }
    setBusy(true); setError(null)
    const uploaded = await queue.uploadAll()
    if (uploaded.some(f => f.status !== 'done')) { setBusy(false); setError('Some files failed to upload. Retry or remove them.'); return }
    const result = await addSubmissionVersion({
      submissionId, note,
      files: uploaded.map(f => ({ path: f.path!, mediaType: mediaTypeForMime(f.file.type), mimeType: f.file.type, sizeBytes: f.file.size, originalName: f.file.name })),
    })
    setBusy(false)
    if (!result.ok) { setError(result.error ?? 'Could not upload the new version.'); return }
    notify('success', result.message ?? 'New version uploaded.')
    setOpen(false); queue.setFiles([]); router.refresh()
  }

  return (
    <>
      <Button variant="secondary" size="sm" icon={<Upload size={14} />} className="w-full justify-center" disabled={!!disabledReason} title={disabledReason ?? undefined} onClick={() => setOpen(true)}>
        Upload new version
      </Button>
      <Modal open={open} onClose={close} title="Upload a new version" description="Previous versions and their review history are kept. The new version starts a fresh review."
        footer={<div className="flex w-full justify-end gap-2"><Button variant="secondary" size="sm" onClick={close} disabled={busy}>Cancel</Button><Button size="sm" loading={busy} onClick={submit}>Upload version</Button></div>}>
        <div className="space-y-3">
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <FileQueue queue={queue} onRetry={item => { void queue.uploadOne(item) }} />
          <Textarea label="What changed? (optional)" rows={2} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} />
        </div>
      </Modal>
    </>
  )
}
