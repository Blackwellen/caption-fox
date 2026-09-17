'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, CloudUpload, FolderUp, Loader2, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ALLOWED_UPLOAD_MIME, MAX_UPLOAD_BYTES } from '@/lib/studio/constants'
import { finaliseMediaUpload, requestMediaUpload } from '@/lib/studio/actions/media'
import { Dialog } from './overlays'
import { Btn, fmtBytes, S_FOCUS } from './ui'

type Status = 'queued' | 'uploading' | 'finalising' | 'done' | 'error' | 'cancelled' | 'duplicate'
interface UploadItem {
  key: string
  file: File
  status: Status
  progress: number
  error?: string
  duplicateOf?: string
  assetId?: string
  xhr?: XMLHttpRequest
}

async function sha256(file: File): Promise<string | undefined> {
  if (file.size > 200 * 1024 * 1024 || !crypto?.subtle) return undefined
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

function readDimensions(file: File): Promise<{ width: number; height: number; duration?: number } | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    if (file.type.startsWith('image/')) {
      const img = new Image()
      img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url) }
      img.onerror = () => { resolve(null); URL.revokeObjectURL(url) }
      img.src = url
    } else if (file.type.startsWith('video/')) {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => { resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration }); URL.revokeObjectURL(url) }
      video.onerror = () => { resolve(null); URL.revokeObjectURL(url) }
      video.src = url
    } else { URL.revokeObjectURL(url); resolve(null) }
  })
}

/**
 * Upload queue backed by signed R2 PUTs. Type and size are checked here for fast
 * feedback, then re-checked on the server against the stored object.
 */
export function useMediaUpload(opts: { collectionId?: string | null; replaceAssetId?: string | null; onComplete?: (ids: string[]) => void } = {}) {
  const router = useRouter()
  const [items, setItems] = useState<UploadItem[]>([])
  const itemsRef = useRef<UploadItem[]>([])
  const update = useCallback((key: string, patch: Partial<UploadItem>) => {
    itemsRef.current = itemsRef.current.map(i => (i.key === key ? { ...i, ...patch } : i))
    setItems(itemsRef.current)
  }, [])

  const run = useCallback(async (item: UploadItem, allowDuplicate = false): Promise<string | null> => {
    const { file, key } = item
    if (!ALLOWED_UPLOAD_MIME.includes(file.type)) { update(key, { status: 'error', error: 'File type not supported.' }); return null }
    if (file.size > MAX_UPLOAD_BYTES) { update(key, { status: 'error', error: 'Larger than the 5 GB limit.' }); return null }
    update(key, { status: 'uploading', progress: 0, error: undefined })
    const checksum = await sha256(file)
    const ticket = await requestMediaUpload({
      fileName: file.name, contentType: file.type, size: file.size, checksum, replaceAssetId: opts.replaceAssetId ?? null,
    })
    if (!ticket.ok || !ticket.data) { update(key, { status: 'error', error: ticket.error ?? 'Upload could not start.' }); return null }
    if (ticket.data.duplicateOf && !allowDuplicate) {
      update(key, { status: 'duplicate', duplicateOf: ticket.data.duplicateOf.file_name })
      return null
    }

    const ok = await new Promise<boolean>(resolve => {
      const xhr = new XMLHttpRequest()
      update(key, { xhr })
      xhr.open('PUT', ticket.data!.url)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.upload.onprogress = e => { if (e.lengthComputable) update(key, { progress: Math.round((e.loaded / e.total) * 100) }) }
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300)
      xhr.onerror = () => resolve(false)
      xhr.onabort = () => resolve(false)
      xhr.send(file)
    })
    const current = itemsRef.current.find(i => i.key === key)
    if (current?.status === 'cancelled') return null
    if (!ok) { update(key, { status: 'error', error: 'Upload failed. Check your connection and retry.', xhr: undefined }); return null }

    update(key, { status: 'finalising', progress: 100, xhr: undefined })
    const dims = await readDimensions(file)
    const saved = await finaliseMediaUpload({
      storedPath: ticket.data.storedPath, fileName: file.name, checksum,
      width: dims?.width ?? null, height: dims?.height ?? null, durationSeconds: dims?.duration ?? null,
      collectionId: opts.collectionId ?? null, replaceAssetId: opts.replaceAssetId ?? null,
    })
    if (!saved.ok || !saved.data) { update(key, { status: 'error', error: saved.error ?? 'The file could not be saved.' }); return null }
    update(key, { status: 'done', assetId: saved.data.id })
    return saved.data.id
  }, [opts.collectionId, opts.replaceAssetId, update])

  const add = useCallback(async (files: FileList | File[]) => {
    const next = [...files].map(file => ({ key: `${file.name}-${file.size}-${Math.random()}`, file, status: 'queued' as Status, progress: 0 }))
    itemsRef.current = [...itemsRef.current, ...next]
    setItems(itemsRef.current)
    const ids: string[] = []
    for (const item of next) {
      const id = await run(item)
      if (id) ids.push(id)
    }
    if (ids.length) { opts.onComplete?.(ids); router.refresh() }
  }, [run, opts, router])

  const cancel = useCallback((key: string) => {
    const item = itemsRef.current.find(i => i.key === key)
    update(key, { status: 'cancelled', error: 'Cancelled' })
    item?.xhr?.abort()
  }, [update])

  const retry = useCallback(async (key: string, allowDuplicate = false) => {
    const item = itemsRef.current.find(i => i.key === key)
    if (!item) return
    const id = await run(item, allowDuplicate)
    if (id) { opts.onComplete?.([id]); router.refresh() }
  }, [run, opts, router])

  const clear = useCallback(() => {
    itemsRef.current = itemsRef.current.filter(i => i.status === 'uploading' || i.status === 'finalising')
    setItems(itemsRef.current)
  }, [])

  return { items, add, cancel, retry, clear, busy: items.some(i => i.status === 'uploading' || i.status === 'finalising') }
}

export function DropZone({ onFiles, disabled, compact = false, className, storageNote }: {
  onFiles: (files: FileList) => void
  disabled?: boolean
  compact?: boolean
  className?: string
  storageNote?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const folder = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!disabled) setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); if (!disabled && e.dataTransfer.files.length) onFiles(e.dataTransfer.files) }}
      className={cn('rounded-[8px] border border-dashed text-center transition-colors', over ? 'border-[#1a5cff] bg-[#eef3ff]' : 'border-[#c9d6f2] bg-[#f8faff]', className)}
    >
      <input ref={input} type="file" multiple hidden accept={ALLOWED_UPLOAD_MIME.join(',')} onChange={e => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = '' }} />
      <input ref={folder} type="file" multiple hidden {...{ webkitdirectory: '', directory: '' }} onChange={e => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = '' }} />
      <div className={cn('flex flex-col items-center', compact ? 'px-3 py-4 lg:py-3' : 'px-4 py-8')}>
        <CloudUpload className={cn('text-[#1a5cff]', compact ? 'h-6 w-6 lg:h-5 lg:w-5' : 'h-8 w-8')} aria-hidden />
        <p className={cn('mt-1.5 text-slate-700', compact ? 'text-[12px] lg:text-[9.5px]' : 'text-[13px]')}>Drag and drop files here</p>
        <p className={cn('text-slate-600', compact ? 'text-[12px] lg:text-[9.5px]' : 'text-[13px]')}>
          or{' '}
          <button type="button" disabled={disabled} onClick={() => input.current?.click()} className={cn('font-medium text-[#1a5cff] hover:underline', S_FOCUS)}>browse files</button>
        </p>
        <p className={cn('mt-1.5 text-slate-500', compact ? 'text-[11px] lg:text-[8.5px]' : 'text-[12px]')}>{storageNote ?? 'Max file size 5 GB'}</p>
      </div>
      <span className="sr-only">
        <button type="button" onClick={() => folder.current?.click()}>Upload a folder</button>
      </span>
    </div>
  )
}

export function openFolderPicker(onFiles: (files: FileList) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.setAttribute('webkitdirectory', '')
  input.onchange = () => { if (input.files?.length) onFiles(input.files) }
  input.click()
}

export function UploadQueue({ items, onCancel, onRetry, className }: {
  items: UploadItem[]
  onCancel: (key: string) => void
  onRetry: (key: string, allowDuplicate?: boolean) => void
  className?: string
}) {
  if (items.length === 0) return null
  return (
    <ul className={cn('space-y-1.5', className)} aria-live="polite">
      {items.map(item => (
        <li key={item.key} className="rounded-lg border border-[#e6e9f0] px-2.5 py-2">
          <div className="flex items-center gap-2 text-[12px]">
            {item.status === 'done' ? <CheckCircle2 size={14} className="text-emerald-500" aria-hidden />
              : item.status === 'error' || item.status === 'duplicate' ? <AlertTriangle size={14} className="text-amber-500" aria-hidden />
                : item.status === 'cancelled' ? <X size={14} className="text-slate-400" aria-hidden />
                  : <Loader2 size={14} className="animate-spin text-[#1a5cff]" aria-hidden />}
            <span className="min-w-0 flex-1 truncate text-slate-700">{item.file.name}</span>
            <span className="shrink-0 text-slate-400">{fmtBytes(item.file.size)}</span>
            {(item.status === 'uploading') && (
              <button type="button" onClick={() => onCancel(item.key)} className={cn('rounded px-1.5 text-[11px] text-slate-500 hover:bg-slate-100', S_FOCUS)}>Cancel</button>
            )}
            {(item.status === 'error' || item.status === 'cancelled') && (
              <button type="button" onClick={() => onRetry(item.key)} className={cn('inline-flex items-center gap-1 rounded px-1.5 text-[11px] font-medium text-[#1a5cff] hover:bg-blue-50', S_FOCUS)}>
                <RotateCcw size={11} /> Retry
              </button>
            )}
          </div>
          {(item.status === 'uploading' || item.status === 'finalising') && (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${item.file.name}`}>
              <div className="h-full rounded-full bg-[#1a5cff] transition-[width]" style={{ width: `${item.progress}%` }} />
            </div>
          )}
          {item.status === 'error' && <p className="mt-1 text-[11px] text-red-600">{item.error}</p>}
          {item.status === 'duplicate' && (
            <p className="mt-1 text-[11px] text-amber-700">
              This file already exists as “{item.duplicateOf}”.{' '}
              <button type="button" onClick={() => onRetry(item.key, true)} className="font-medium underline">Upload anyway</button>
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Full upload dialog used by Media, the Overview assets rail and the asset picker. */
export function UploadDialog({ open, onClose, collectionId, collections, onComplete, replaceAssetId, title }: {
  open: boolean
  onClose: () => void
  collectionId?: string | null
  collections?: { id: string; name: string }[]
  onComplete?: (ids: string[]) => void
  replaceAssetId?: string | null
  title?: string
}) {
  const [collection, setCollection] = useState(collectionId ?? '')
  const upload = useMediaUpload({ collectionId: collection || null, replaceAssetId, onComplete })
  return (
    <Dialog open={open} onClose={onClose} title={title ?? (replaceAssetId ? 'Replace file' : 'Upload assets')}
      description={replaceAssetId ? 'The current file is kept as a previous version.' : 'Images, video, audio, PDF and Office files up to 5 GB. Files are stored privately in this workspace.'}
      footer={<Btn size="md" onClick={() => { upload.clear(); onClose() }} disabled={upload.busy}>{upload.busy ? 'Uploading…' : 'Done'}</Btn>}>
      {!replaceAssetId && collections && collections.length > 0 && (
        <label className="mb-3 block text-[12px] font-medium text-slate-700">
          Collection
          <select value={collection} onChange={e => setCollection(e.target.value)}
            className="mt-1 block h-9 w-full rounded-lg border border-[#dfe3ea] bg-white px-2 text-[13px] outline-none focus:border-blue-400">
            <option value="">No collection</option>
            {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}
      <DropZone onFiles={files => void upload.add(replaceAssetId ? [files[0]!] : files)} />
      {!replaceAssetId && (
        <button type="button" onClick={() => openFolderPicker(files => void upload.add(files))}
          className={cn('mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-600 hover:text-slate-900', S_FOCUS)}>
          <FolderUp size={13} /> Upload a folder
        </button>
      )}
      <UploadQueue items={upload.items} onCancel={upload.cancel} onRetry={(key, dup) => void upload.retry(key, dup)} className="mt-3" />
    </Dialog>
  )
}
