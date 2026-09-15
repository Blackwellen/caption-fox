'use client'

import { useCallback, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, CheckCircle2, FileUp, Loader2, UploadCloud, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  createFolder, finaliseAssetUpload, requestAssetUpload, submitAssetsForApproval,
} from '@/lib/brand-assets/actions'
import Dialog, { btn } from './Dialog'

/** Opens/closes a URL-driven dialog (?upload=1 etc.) so it survives refresh and back. */
function useUrlDialog(key: string) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const close = useCallback(() => {
    const next = new URLSearchParams(params.toString())
    next.delete(key)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [key, params, pathname, router])
  return { open: params.get(key) === '1', close }
}

async function sha256(file: File): Promise<string | undefined> {
  // Hashing very large files in the browser is slow; duplicates of those are caught by name+size.
  if (file.size > 64 * 1024 * 1024 || !crypto?.subtle) return undefined
  const buf = await file.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('')
}

type Row = {
  file: File
  state: 'queued' | 'checking' | 'duplicate' | 'uploading' | 'saving' | 'done' | 'error'
  progress: number
  message?: string
  duplicateOf?: { id: string; file_name: string }
  pending?: { storedPath: string; checksum?: string }
}

function putWithProgress(url: string, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Storage rejected the upload (${xhr.status}).`)))
    xhr.onerror = () => reject(new Error('Network error while uploading.'))
    xhr.send(file)
  })
}

export function UploadDialog({
  workspaceType, brands, folders, canUpload, blockedReason,
}: {
  workspaceType: string
  brands: { id: string; name: string }[]
  folders: { id: string; name: string }[]
  canUpload: boolean
  blockedReason?: string
}) {
  const { open, close } = useUrlDialog('upload')
  const [rows, setRows] = useState<Row[]>([])
  const [brandId, setBrandId] = useState('')
  const [folderId, setFolderId] = useState('')
  const [rights, setRights] = useState('unspecified')
  const [tags, setTags] = useState('')
  const [submitForApproval, setSubmitForApproval] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const patch = (i: number, p: Partial<Row>) => setRows(r => r.map((row, j) => (j === i ? { ...row, ...p } : row)))
  const add = (files: FileList | File[]) => setRows(r => [...r, ...[...files].map(file => ({ file, state: 'queued' as const, progress: 0 }))].slice(0, 25))

  async function finalise(i: number, storedPath: string, checksum?: string) {
    patch(i, { state: 'saving', progress: 100 })
    const res = await finaliseAssetUpload(workspaceType, {
      storedPath, fileName: rows[i]?.file.name ?? '', checksum, brandId: brandId || null, folderId: folderId || null,
      rightsState: rights, submitForApproval, tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    })
    patch(i, res.ok ? { state: 'done', message: res.message } : { state: 'error', message: res.error })
  }

  async function uploadOne(i: number, row: Row, keepDuplicate = false) {
    try {
      patch(i, { state: 'checking', message: undefined })
      const checksum = row.pending?.checksum ?? await sha256(row.file)
      const req = row.pending && keepDuplicate
        ? null
        : await requestAssetUpload(workspaceType, { fileName: row.file.name, contentType: row.file.type || 'application/octet-stream', size: row.file.size, checksum })
      if (req && !req.ok) { patch(i, { state: 'error', message: req.error }); return }
      const target = req?.ok ? req.data : null
      if (target?.duplicateOf && !keepDuplicate) {
        // Pause: the user decides whether to keep both or cancel.
        patch(i, { state: 'duplicate', duplicateOf: target.duplicateOf, pending: { storedPath: target.storedPath, checksum }, message: undefined })
        ;(row as Row & { url?: string }).pending = { storedPath: target.storedPath, checksum }
        pendingUrls.current.set(i, target.url)
        return
      }
      const url = target?.url ?? pendingUrls.current.get(i)
      const storedPath = target?.storedPath ?? row.pending?.storedPath
      if (!url || !storedPath) { patch(i, { state: 'error', message: 'Upload link expired. Try again.' }); return }
      patch(i, { state: 'uploading', progress: 0 })
      await putWithProgress(url, row.file, p => patch(i, { progress: p }))
      await finalise(i, storedPath, checksum)
    } catch (err) {
      patch(i, { state: 'error', message: err instanceof Error ? err.message : 'Upload failed.' })
    }
  }
  const pendingUrls = useRef(new Map<number, string>())

  async function start() {
    setBusy(true)
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].state === 'queued' || rows[i].state === 'error') await uploadOne(i, rows[i])
    }
    setBusy(false)
    router.refresh()
  }

  if (!open) return null
  const done = rows.length > 0 && rows.every(r => r.state === 'done')

  return (
    <Dialog wide title="Upload Assets" description="Images, video, audio, PDF, Office, design files and ZIP — up to 250 MB each. Files are stored privately."
      onClose={() => { if (!busy) { setRows([]); close() } }}
      footer={<>
        <button type="button" className={btn.secondary} onClick={() => { setRows([]); close() }} disabled={busy}>{done ? 'Close' : 'Cancel'}</button>
        {!done && <button type="button" className={btn.primary} disabled={!canUpload || busy || rows.every(r => r.state !== 'queued' && r.state !== 'error')} onClick={start}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />} Upload {rows.length || ''} file{rows.length === 1 ? '' : 's'}
        </button>}
      </>}>
      {!canUpload && (
        <p role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />{blockedReason ?? 'Uploading is not available for your role or plan.'}
        </p>
      )}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); if (canUpload) add(e.dataTransfer.files) }}
        className={cn('mb-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors',
          dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50/60')}>
        <FileUp size={26} className="mb-2 text-blue-500" aria-hidden="true" />
        <p className="text-[13px] font-medium text-slate-700">Drag and drop files here</p>
        <p className="mb-3 text-[11.5px] text-slate-500">or choose them from your device</p>
        <button type="button" className={btn.secondary} disabled={!canUpload} onClick={() => input.current?.click()}>Browse files</button>
        <input ref={input} type="file" multiple className="sr-only" aria-label="Choose files to upload"
          onChange={e => { if (e.target.files) add(e.target.files); e.target.value = '' }} />
      </div>

      {rows.length > 0 && (
        <ul className="mb-4 divide-y divide-slate-100 rounded-lg border border-slate-200" aria-live="polite">
          {rows.map((r, i) => (
            <li key={`${r.file.name}-${i}`} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-slate-800">{r.file.name}</span>
                <span className="shrink-0 text-[11px] text-slate-400">{(r.file.size / 1048576).toFixed(1)} MB</span>
                {r.state === 'done' && <CheckCircle2 size={15} className="text-emerald-600" aria-label="Uploaded" />}
                {r.state === 'error' && <AlertTriangle size={15} className="text-rose-600" aria-label="Failed" />}
                {(r.state === 'queued' || r.state === 'error') && !busy && (
                  <button type="button" aria-label={`Remove ${r.file.name}`} onClick={() => setRows(rs => rs.filter((_, j) => j !== i))} className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><X size={13} /></button>
                )}
              </div>
              {['uploading', 'saving', 'checking'].includes(r.state) && (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={r.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${r.file.name}`}>
                  <div className="h-full bg-blue-600 transition-[width]" style={{ width: `${r.state === 'checking' ? 5 : r.progress}%` }} />
                </div>
              )}
              {r.message && <p className={cn('mt-1 text-[11px]', r.state === 'error' ? 'text-rose-600' : 'text-emerald-700')}>{r.message}</p>}
              {r.state === 'duplicate' && r.duplicateOf && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-amber-800">
                  <span>Looks identical to <strong>{r.duplicateOf.file_name}</strong>.</span>
                  <button type="button" className="font-semibold text-blue-600 hover:underline" onClick={() => uploadOne(i, r, true)}>Keep both</button>
                  <button type="button" className="font-semibold text-slate-600 hover:underline" onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}>Skip</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className={btn.label}>Brand</span>
          <select className={btn.field} value={brandId} onChange={e => setBrandId(e.target.value)}>
            <option value="">Unassigned</option>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select></label>
        <label className="block"><span className={btn.label}>Folder</span>
          <select className={btn.field} value={folderId} onChange={e => setFolderId(e.target.value)}>
            <option value="">No folder</option>{folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select></label>
        <label className="block"><span className={btn.label}>Usage rights</span>
          <select className={btn.field} value={rights} onChange={e => setRights(e.target.value)}>
            <option value="unspecified">Not yet specified</option><option value="all_media">All media</option>
            <option value="licensed">Licensed</option><option value="internal_use">Internal use only</option>
            <option value="public_use">Public use</option><option value="restricted">Restricted</option>
          </select></label>
        <label className="block"><span className={btn.label}>Tags <span className="font-normal text-slate-400">(comma separated)</span></span>
          <input className={btn.field} value={tags} onChange={e => setTags(e.target.value)} placeholder="spring, hero, social" /></label>
      </div>
      <label className="mt-3 flex items-center gap-2 text-[12.5px] text-slate-700">
        <input type="checkbox" checked={submitForApproval} onChange={e => setSubmitForApproval(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
        Send to the approval queue after upload
      </label>
    </Dialog>
  )
}

export function CreateFolderDialog({ workspaceType }: { workspaceType: string }) {
  const { open, close } = useUrlDialog('newFolder')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  if (!open) return null
  const submit = () => start(async () => {
    setError(null)
    const res = await createFolder(workspaceType, name)
    if (!res.ok) { setError(res.error); return }
    setName(''); close(); router.refresh()
  })
  return (
    <Dialog title="Create Folder" description="Folders organise where assets live. Use collections to group assets without moving them."
      onClose={close}
      footer={<><button type="button" className={btn.secondary} onClick={close}>Cancel</button>
        <button type="button" className={btn.primary} disabled={pending || name.trim().length < 2} onClick={submit}>
          {pending && <Loader2 size={15} className="animate-spin" />}Create folder</button></>}>
      <form onSubmit={e => { e.preventDefault(); submit() }}>
        <label className="block"><span className={btn.label}>Folder name</span>
          <input className={btn.field} value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder="e.g. Spring 2026 Campaign" aria-invalid={!!error} /></label>
        {error && <p role="alert" className="mt-1.5 text-[12px] text-rose-600">{error}</p>}
      </form>
    </Dialog>
  )
}

export function RequestApprovalDialog({ workspaceType, eligible }: { workspaceType: string; eligible: { id: string; file_name: string; approval_status: string }[] }) {
  const { open, close } = useUrlDialog('requestApproval')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  if (!open) return null
  const toggle = (id: string) => setPicked(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const submit = () => start(async () => {
    setError(null)
    const res = await submitAssetsForApproval(workspaceType, [...picked], priority, note)
    if (!res.ok) { setError(res.error); return }
    setPicked(new Set()); setNote(''); close(); router.refresh()
  })
  return (
    <Dialog wide title="Request Approval" description="Send draft or returned assets to reviewers. Assets already approved or in review are not listed."
      onClose={close}
      footer={<><button type="button" className={btn.secondary} onClick={close}>Cancel</button>
        <button type="button" className={btn.primary} disabled={pending || picked.size === 0} onClick={submit}>
          {pending && <Loader2 size={15} className="animate-spin" />}Send {picked.size || ''} for approval</button></>}>
      {eligible.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-[12.5px] text-slate-500">Every asset is already approved or awaiting review.</p>
      ) : (
        <fieldset>
          <legend className={btn.label}>Assets</legend>
          <ul className="mb-3 max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {eligible.map(a => (
              <li key={a.id}>
                <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-slate-50">
                  <input type="checkbox" checked={picked.has(a.id)} onChange={() => toggle(a.id)} className="h-4 w-4 rounded border-slate-300" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-800">{a.file_name}</span>
                  <span className="text-[11px] capitalize text-slate-400">{a.approval_status.replace('_', ' ')}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <label className="block"><span className={btn.label}>Priority</span>
          <select className={btn.field} value={priority} onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
          </select></label>
        <label className="block"><span className={btn.label}>Note for reviewers</span>
          <input className={btn.field} value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="Optional" /></label>
      </div>
      {error && <p role="alert" className="mt-2 text-[12px] text-rose-600">{error}</p>}
    </Dialog>
  )
}
