'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Ban, Eye, FileUp, Loader2, MoreVertical, RefreshCcw, ShieldAlert, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { finaliseAgreement, renewLicense, requestAgreementUpload, setLicenseStatus } from '@/lib/brand-assets/actions'
import Dialog, { btn } from './Dialog'

/** Row actions for a licence: view, renew (with a new expiry), restrict, suspend, reactivate. */
export function LicenseRowActions({
  workspaceType, licenseId, name, status, expiresOn, href, canRenew, canRestrict, canEdit,
}: {
  workspaceType: string; licenseId: string; name: string; status: string; expiresOn: string | null; href: string
  canRenew: boolean; canRestrict: boolean; canEdit: boolean
}) {
  const [open, setOpen] = useState(false)
  const [renewing, setRenewing] = useState(false)
  const [date, setDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => {
    const res = await fn()
    if (res.ok) { setOpen(false); setRenewing(false); router.refresh() } else setError(res.error ?? 'Something went wrong')
  })
  const item = 'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50'

  return (
    <div className="flex items-center justify-end gap-0.5" ref={ref}>
      <Link href={href} aria-label={`View ${name}`} className="flex h-6 w-6 items-center justify-center rounded text-blue-600 hover:bg-blue-50"><Eye size={14} /></Link>
      <div className="relative">
        <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`More actions for ${name}`}
          onClick={() => { setOpen(o => !o); setError(null) }} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          {pending ? <Loader2 size={13} className="animate-spin" /> : <MoreVertical size={14} />}
        </button>
        {open && (
          <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1 text-left shadow-lg">
            {canRenew && status !== 'cancelled' && (renewing ? (
              <form className="space-y-1.5 p-2" onSubmit={e => { e.preventDefault(); run(() => renewLicense(workspaceType, licenseId, date)) }}>
                <label className="block text-[11px] font-medium text-slate-600">New expiry date
                  <input type="date" required value={date} min={expiresOn ?? undefined} onChange={e => setDate(e.target.value)} className={cn(btn.field, 'mt-1 h-8 text-[12px]')} />
                </label>
                <button type="submit" disabled={pending || !date} className={cn(btn.primary, 'h-8 w-full text-[12px]')}>Renew licence</button>
              </form>
            ) : (
              <button role="menuitem" type="button" className={item} onClick={() => setRenewing(true)}><RefreshCcw size={13} className="text-slate-400" />Renew…</button>
            ))}
            {canRestrict && status !== 'restricted' && (
              <button role="menuitem" type="button" className={item} onClick={() => run(() => setLicenseStatus(workspaceType, licenseId, 'restricted'))}>
                <ShieldAlert size={13} className="text-amber-500" />Restrict usage</button>
            )}
            {canRestrict && status !== 'suspended' && (
              <button role="menuitem" type="button" className={cn(item, 'text-rose-600')} onClick={() => {
                if (window.confirm(`Suspend ${name}? Linked assets will be flagged as restricted.`)) run(() => setLicenseStatus(workspaceType, licenseId, 'suspended'))
              }}><Ban size={13} />Suspend</button>
            )}
            {canEdit && ['restricted', 'suspended'].includes(status) && (
              <button role="menuitem" type="button" className={item} onClick={() => run(() => setLicenseStatus(workspaceType, licenseId, 'active'))}>
                <ShieldCheck size={13} className="text-emerald-600" />Reactivate</button>
            )}
            {error && <p role="alert" className="px-2.5 py-1.5 text-[11px] text-rose-600">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

/** Upload a signed agreement (PDF) to a licence. URL-driven: ?uploadAgreement=1. */
export function UploadAgreementDialog({ workspaceType, licences }: { workspaceType: string; licences: { id: string; name: string }[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const close = useCallback(() => {
    const next = new URLSearchParams(params.toString()); next.delete('uploadAgreement')
    router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false })
  }, [params, pathname, router])
  const [licenseId, setLicenseId] = useState(params.get('license') ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [signedOn, setSignedOn] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  if (params.get('uploadAgreement') !== '1') return null

  const submit = () => start(async () => {
    setError(null)
    if (!file) { setError('Choose a PDF agreement.'); return }
    const req = await requestAgreementUpload(workspaceType, { licenseId, fileName: file.name, contentType: file.type, size: file.size })
    if (!req.ok) { setError(req.error); return }
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', req.data.url); xhr.setRequestHeader('Content-Type', file.type)
        xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)) }
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Storage rejected the upload (${xhr.status}).`)))
        xhr.onerror = () => reject(new Error('Network error while uploading.'))
        xhr.send(file)
      })
    } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed.'); return }
    const res = await finaliseAgreement(workspaceType, { licenseId, storedPath: req.data.storedPath, fileName: file.name, title, signedOn: signedOn || undefined })
    if (!res.ok) { setError(res.error); return }
    setFile(null); setProgress(0); close(); router.refresh()
  })

  return (
    <Dialog title="Upload Agreement" description="Attach the signed agreement (PDF, up to 50 MB) that backs a licence. Stored privately and audit-logged."
      onClose={close}
      footer={<><button type="button" className={btn.secondary} onClick={close}>Cancel</button>
        <button type="button" className={btn.primary} disabled={pending || !file || !licenseId} onClick={submit}>
          {pending ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />}Upload agreement</button></>}>
      <div className="space-y-3">
        <label className="block"><span className={btn.label}>Licence</span>
          <select className={btn.field} value={licenseId} onChange={e => setLicenseId(e.target.value)} required>
            <option value="">Choose a licence…</option>{licences.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select></label>
        <label className="block"><span className={btn.label}>Agreement file (PDF)</span>
          <input type="file" accept="application/pdf,.pdf" onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-[12.5px] text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-blue-700" /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className={btn.label}>Title</span>
            <input className={btn.field} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Usage Agreement 2026" /></label>
          <label className="block"><span className={btn.label}>Signed on</span>
            <input type="date" className={btn.field} value={signedOn} onChange={e => setSignedOn(e.target.value)} /></label>
        </div>
        {pending && progress > 0 && (
          <div className="h-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Uploading agreement">
            <div className="h-full bg-blue-600" style={{ width: `${progress}%` }} />
          </div>
        )}
        {error && <p role="alert" className="text-[12px] text-rose-600">{error}</p>}
      </div>
    </Dialog>
  )
}
