'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createCreativeUploadAction, discardCreativeUploadAction, registerUploadedCreativeAction } from '@/lib/advertising/actions'
import { cn } from '@/lib/utils'

// "Upload Creative" and "Create Ad" (a draft ad = a creative on a campaign).
// The file goes straight from the browser into the private `ad-creatives`
// bucket under this workspace's folder (the storage policy refuses anything
// else); the server action then re-validates and records the creative. If the
// record cannot be saved, the uploaded object is removed so nothing is orphaned.

type AccountOption = { id: string; name: string; providerName: string }
type CampaignOption = { id: string; name: string; accountId: string }

const ACCEPT: Record<string, 'image' | 'video'> = {
  'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image', 'image/gif': 'image',
  'video/mp4': 'video', 'video/quicktime': 'video', 'video/webm': 'video',
}
const MAX_BYTES = 200 * 1024 * 1024

function safeName(name: string) {
  const dot = name.lastIndexOf('.')
  const base = (dot > 0 ? name.slice(0, dot) : name).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'creative'
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) : ''
  return ext ? `${base}.${ext}` : base
}

/** PUTs a file to a signed URL with real progress. Resolves false on any failure. */
function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<boolean> {
  return new Promise(resolve => {
    const request = new XMLHttpRequest()
    request.open('PUT', url)
    request.setRequestHeader('Content-Type', file.type)
    request.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)) }
    request.onload = () => resolve(request.status >= 200 && request.status < 300)
    request.onerror = () => resolve(false)
    request.onabort = () => resolve(false)
    request.send(file)
  })
}

function readMedia(file: File): Promise<{ width: number | null; height: number | null; duration: number | null }> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const done = (value: { width: number | null; height: number | null; duration: number | null }) => { URL.revokeObjectURL(url); resolve(value) }
    if (ACCEPT[file.type] === 'image') {
      const image = new Image()
      image.onload = () => done({ width: image.naturalWidth, height: image.naturalHeight, duration: null })
      image.onerror = () => done({ width: null, height: null, duration: null })
      image.src = url
    } else {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => done({ width: video.videoWidth || null, height: video.videoHeight || null, duration: Number.isFinite(video.duration) ? Math.round(video.duration * 100) / 100 : null })
      video.onerror = () => done({ width: null, height: null, duration: null })
      video.src = url
    }
  })
}

export default function UploadCreative({
  workspaceId, workspaceType, basePath, accounts, campaigns, mode = 'upload', disabledReason,
}: {
  workspaceId: string; workspaceType: string; basePath: string
  accounts: AccountOption[]; campaigns: CampaignOption[]; mode?: 'upload' | 'ad'; disabledReason?: string | null
}) {
  const [open, setOpen] = useState(false)
  const primary = mode === 'ad'
  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)} disabled={!!disabledReason} title={disabledReason ?? undefined}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-[12.5px] font-medium disabled:cursor-not-allowed disabled:opacity-55',
          primary ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700' : 'border border-slate-200 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-slate-50',
        )}
      >
        {primary ? <Plus size={15} aria-hidden /> : <Upload size={15} aria-hidden />}
        {primary ? 'Create Ad' : 'Upload Creative'}
      </button>
      {open && (
        <Dialog workspaceId={workspaceId} workspaceType={workspaceType} basePath={basePath} accounts={accounts} campaigns={campaigns} mode={mode} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

function Dialog({ workspaceId, workspaceType, basePath, accounts, campaigns, mode, onClose }: {
  workspaceId: string; workspaceType: string; basePath: string; accounts: AccountOption[]; campaigns: CampaignOption[]
  mode: 'upload' | 'ad'; onClose: () => void
}) {
  const router = useRouter()
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [campaignId, setCampaignId] = useState('')
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<'idle' | 'uploading' | 'saving'>('idle')
  const [progress, setProgress] = useState(0)
  const [, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const busy = stage !== 'idle'
  const accountCampaigns = campaigns.filter(campaign => campaign.accountId === accountId)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  function pick(selected: File | null) {
    setError(null)
    if (!selected) { setFile(null); return }
    if (!ACCEPT[selected.type]) { setError('Upload a JPG, PNG, WebP, GIF, MP4, MOV or WebM file.'); return }
    if (selected.size > MAX_BYTES) { setError('Files must be 200 MB or smaller.'); return }
    setFile(selected)
    if (!name) setName(selected.name.replace(/\.[^.]+$/, '').slice(0, 120))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!file) { setError('Choose a file to upload.'); return }
    if (!accountId) { setError('Choose an ad account.'); return }
    if (mode === 'ad' && !campaignId) { setError('Choose the campaign this ad belongs to.'); return }
    if (!name.trim()) { setError('Name the creative.'); return }
    setError(null)

    startTransition(async () => {
      setStage('uploading')
      setProgress(0)
      const media = await readMedia(file)

      // Ask the server where to upload: a signed R2 URL, or the Supabase bucket.
      const target = await createCreativeUploadAction({ workspaceId, workspaceType, fileName: file.name, mimeType: file.type, sizeBytes: file.size })
      if (!target.ok) { setStage('idle'); setError(target.error); return }

      let storagePath: string
      let cleanup: () => Promise<unknown>
      if (target.provider === 'r2') {
        const uploaded = await putWithProgress(target.url, file, setProgress)
        if (!uploaded) { setStage('idle'); setError('Upload failed. Check your connection and try again.'); return }
        storagePath = target.storedPath
        cleanup = () => discardCreativeUploadAction({ workspaceId, storedPath: target.storedPath })
      } else {
        const supabase = createClient()
        storagePath = `${workspaceId}/${crypto.randomUUID()}/${safeName(file.name)}`
        const { error: uploadError } = await supabase.storage.from('ad-creatives').upload(storagePath, file, { contentType: file.type, upsert: false })
        if (uploadError) { setStage('idle'); setError('Upload failed. Check your connection and try again.'); return }
        setProgress(100)
        cleanup = () => supabase.storage.from('ad-creatives').remove([storagePath])
      }

      setStage('saving')
      const result = await registerUploadedCreativeAction({
        workspaceId, workspaceType, accountId, campaignId: campaignId || null, name,
        storagePath, mimeType: file.type, sizeBytes: file.size,
        width: media.width, height: media.height, durationSeconds: media.duration,
      })
      if (!result.ok) {
        await cleanup()
        setStage('idle')
        setError(result.error)
        return
      }
      router.push(`${basePath}/creatives/${result.id}`)
    })
  }

  const field = 'mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15'

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="upload-creative-title">
      <form onSubmit={submit} className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl" noValidate>
        <div className="flex items-start justify-between border-b border-slate-100 p-4">
          <div>
            <h2 id="upload-creative-title" className="text-[15px] font-semibold text-slate-900">{mode === 'ad' ? 'Create ad' : 'Upload creative'}</h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {mode === 'ad' ? 'Creates a draft ad on a campaign. It is not published to the platform until you publish it.' : 'Stored privately in this workspace. Images and video up to 200 MB.'}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={16} /></button>
        </div>

        {accounts.length === 0 ? (
          <p className="p-4 text-[13px] text-slate-600">Connect an ad account first — creatives belong to an account.</p>
        ) : (
          <div className="space-y-3 p-4">
            <button
              type="button" onClick={() => inputRef.current?.click()} disabled={busy}
              onDragOver={event => event.preventDefault()}
              onDrop={event => { event.preventDefault(); pick(event.dataTransfer.files?.[0] ?? null) }}
              className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-4 py-7 text-center hover:border-blue-300 hover:bg-blue-50/40"
            >
              <Upload size={22} className="text-slate-400" aria-hidden />
              <span className="mt-2 text-[13px] font-medium text-slate-700">{file ? file.name : 'Choose a file or drop it here'}</span>
              <span className="mt-0.5 text-[11.5px] text-slate-500">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · ${file.type}` : 'JPG, PNG, WebP, GIF, MP4, MOV, WebM · max 200 MB'}</span>
            </button>
            <input ref={inputRef} type="file" accept={Object.keys(ACCEPT).join(',')} className="sr-only" onChange={event => pick(event.target.files?.[0] ?? null)} aria-label="Creative file" />

            <label className="block text-[12px] font-medium text-slate-600">Name
              <input value={name} onChange={event => setName(event.target.value)} maxLength={120} className={field} />
            </label>
            <label className="block text-[12px] font-medium text-slate-600">Ad account
              <select value={accountId} onChange={event => { setAccountId(event.target.value); setCampaignId('') }} className={field}>
                {accounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.providerName}</option>)}
              </select>
            </label>
            <label className="block text-[12px] font-medium text-slate-600">Campaign {mode === 'upload' && <span className="font-normal text-slate-400">(optional)</span>}
              <select value={campaignId} onChange={event => setCampaignId(event.target.value)} className={field}>
                <option value="">{accountCampaigns.length ? 'No campaign' : 'No campaigns on this account'}</option>
                {accountCampaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
              </select>
            </label>
            {stage === 'uploading' && (
              <div role="progressbar" aria-label="Upload progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="flex justify-between text-[11.5px] text-slate-500"><span>Uploading securely…</span><span>{progress}%</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-[width]" style={{ width: `${progress}%` }} /></div>
              </div>
            )}
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p>}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
          <button type="button" onClick={onClose} disabled={busy} className="h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-600 hover:bg-slate-50">Cancel</button>
          {accounts.length > 0 && (
            <button type="submit" disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
              {stage === 'uploading' ? 'Uploading…' : stage === 'saving' ? 'Saving…' : mode === 'ad' ? 'Create draft ad' : 'Upload'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
