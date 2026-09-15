'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Download, Loader2, RotateCcw, Send, Unlink, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  decideAssetApproval, decideKitApproval, downloadAsset, requestAssetUsage, setKitArchived,
  setProductStatus, unlinkProductAsset,
} from '@/lib/brand-assets/actions'
import { btn } from './Dialog'

type Res = { ok: boolean; error?: string; message?: string }

/** Shared runner: disables while pending, shows the server's message, refreshes on success. */
function useAction() {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const router = useRouter()
  const run = (fn: () => Promise<Res>) => start(async () => {
    const r = await fn()
    setMsg(r.ok ? { ok: true, text: r.message ?? 'Saved' } : { ok: false, text: r.error ?? 'Something went wrong' })
    if (r.ok) router.refresh()
  })
  const note = msg && <p role={msg.ok ? 'status' : 'alert'} className={cn('mt-2 text-[12px]', msg.ok ? 'text-emerald-700' : 'text-rose-600')}>{msg.text}</p>
  return { pending, run, note }
}

export function KitApprovalActions({ workspaceType, kitId, approval, archived, canSubmit, canApprove, canArchive }: {
  workspaceType: string; kitId: string; approval: string; archived: boolean; canSubmit: boolean; canApprove: boolean; canArchive: boolean
}) {
  const { pending, run, note } = useAction()
  const [comment, setComment] = useState('')
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {canSubmit && ['none', 'changes_requested', 'rejected'].includes(approval) && (
          <button type="button" disabled={pending} className={btn.primary} onClick={() => run(() => decideKitApproval(workspaceType, kitId, 'submit', comment))}>
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}Submit for approval</button>
        )}
        {canApprove && approval === 'pending' && <>
          <button type="button" disabled={pending} className={btn.primary} onClick={() => run(() => decideKitApproval(workspaceType, kitId, 'approve', comment))}>
            <CheckCircle2 size={14} />Approve &amp; publish</button>
          <button type="button" disabled={pending} className={btn.secondary} onClick={() => run(() => decideKitApproval(workspaceType, kitId, 'request_changes', comment))}>
            <RotateCcw size={14} />Request changes</button>
        </>}
        {canArchive && (
          <button type="button" disabled={pending} className={btn.secondary} onClick={() => {
            if (archived || window.confirm('Archive this brand kit? It can be restored later.')) run(() => setKitArchived(workspaceType, kitId, !archived))
          }}>{archived ? 'Restore kit' : 'Archive kit'}</button>
        )}
      </div>
      {(canSubmit || canApprove) && (
        <label className="mt-2 block"><span className="sr-only">Note for the approval record</span>
          <input value={comment} onChange={e => setComment(e.target.value)} maxLength={1000} placeholder="Optional note — saved as a comment on the kit" className={btn.field} /></label>
      )}
      {note}
    </div>
  )
}

export function AssetApprovalActions({ workspaceType, approvalId }: { workspaceType: string; approvalId: string }) {
  const { pending, run, note } = useAction()
  const [comment, setComment] = useState('')
  return (
    <div className="mt-2">
      <input value={comment} onChange={e => setComment(e.target.value)} maxLength={500} placeholder="Reviewer note (optional)" aria-label="Reviewer note" className={cn(btn.field, 'mb-2')} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} className={btn.primary} onClick={() => run(() => decideAssetApproval(workspaceType, approvalId, 'approved', comment))}><CheckCircle2 size={14} />Approve</button>
        <button type="button" disabled={pending} className={btn.secondary} onClick={() => run(() => decideAssetApproval(workspaceType, approvalId, 'changes_requested', comment))}><RotateCcw size={14} />Request changes</button>
        <button type="button" disabled={pending} className={cn(btn.secondary, 'text-rose-600')} onClick={() => run(() => decideAssetApproval(workspaceType, approvalId, 'rejected', comment))}><XCircle size={14} />Reject</button>
      </div>
      {note}
    </div>
  )
}

export function DownloadButton({ workspaceType, assetId }: { workspaceType: string; assetId: string }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <div>
      <button type="button" disabled={pending} className={btn.primary} onClick={() => start(async () => {
        setError(null)
        try {
          const r = await downloadAsset(workspaceType, assetId)
          if (r.ok) window.location.assign(r.data.url); else setError(r.error)
        } catch {
          setError('The download could not be started. Please try again.')
        }
      })}>{pending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}Download</button>
      {error && <p role="alert" className="mt-2 max-w-xs text-[12px] text-rose-600">{error}</p>}
    </div>
  )
}

export function UsageRequestForm({ workspaceType, assetId, territories, channels }: {
  workspaceType: string; assetId: string; territories: { code: string; name: string }[]; channels: { code: string; name: string }[]
}) {
  const { pending, run, note } = useAction()
  const today = new Date().toISOString().slice(0, 10)
  const [f, setF] = useState({ purpose: '', startsOn: today, endsOn: '', channels: [] as string[], territories: [] as string[], modification: false })
  const toggle = (key: 'channels' | 'territories', v: string) => setF(s => ({ ...s, [key]: s[key].includes(v) ? s[key].filter(x => x !== v) : [...s[key], v] }))
  return (
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); run(() => requestAssetUsage(workspaceType, { assetId, ...f })) }}>
      <label className="block"><span className={btn.label}>How will it be used?</span>
        <textarea required minLength={5} maxLength={500} value={f.purpose} onChange={e => setF({ ...f, purpose: e.target.value })} className={cn(btn.field, 'h-20 py-2')} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className={btn.label}>From</span><input type="date" required value={f.startsOn} onChange={e => setF({ ...f, startsOn: e.target.value })} className={btn.field} /></label>
        <label className="block"><span className={btn.label}>Until</span><input type="date" required min={f.startsOn} value={f.endsOn} onChange={e => setF({ ...f, endsOn: e.target.value })} className={btn.field} /></label>
      </div>
      <fieldset><legend className={btn.label}>Channels</legend>
        <div className="flex flex-wrap gap-1.5">{channels.map(c => (
          <button key={c.code} type="button" aria-pressed={f.channels.includes(c.code)} onClick={() => toggle('channels', c.code)}
            className={cn('rounded-full border px-2.5 py-1 text-[11.5px]', f.channels.includes(c.code) ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600')}>{c.name}</button>
        ))}</div></fieldset>
      <fieldset><legend className={btn.label}>Territories</legend>
        <div className="flex flex-wrap gap-1.5">{territories.map(t => (
          <button key={t.code} type="button" aria-pressed={f.territories.includes(t.code)} onClick={() => toggle('territories', t.code)}
            className={cn('rounded-full border px-2.5 py-1 text-[11.5px]', f.territories.includes(t.code) ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600')}>{t.name}</button>
        ))}</div></fieldset>
      <label className="flex items-center gap-2 text-[12.5px] text-slate-700"><input type="checkbox" checked={f.modification} onChange={e => setF({ ...f, modification: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />I need to modify the asset (crop, recolour, overlay)</label>
      <button type="submit" disabled={pending} className={btn.primary}>{pending && <Loader2 size={14} className="animate-spin" />}Submit usage request</button>
      {note}
    </form>
  )
}

export function ProductStatusActions({ workspaceType, productId, status, canEdit, canApprove, canArchive }: {
  workspaceType: string; productId: string; status: string; canEdit: boolean; canApprove: boolean; canArchive: boolean
}) {
  const { pending, run, note } = useAction()
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {canEdit && ['draft', 'inactive'].includes(status) && <button type="button" disabled={pending} className={btn.primary} onClick={() => run(() => setProductStatus(workspaceType, productId, 'review'))}><Send size={14} />Submit for review</button>}
        {canApprove && status === 'review' && <button type="button" disabled={pending} className={btn.primary} onClick={() => run(() => setProductStatus(workspaceType, productId, 'active'))}><CheckCircle2 size={14} />Approve &amp; activate</button>}
        {canEdit && status === 'active' && <button type="button" disabled={pending} className={btn.secondary} onClick={() => run(() => setProductStatus(workspaceType, productId, 'inactive'))}>Deactivate</button>}
        {canArchive && status !== 'archived' && <button type="button" disabled={pending} className={cn(btn.secondary, 'text-rose-600')} onClick={() => { if (window.confirm('Archive this product?')) run(() => setProductStatus(workspaceType, productId, 'archived')) }}>Archive</button>}
      </div>
      {note}
    </div>
  )
}

export function UnlinkButton({ workspaceType, productId, assetId, name }: { workspaceType: string; productId: string; assetId: string; name: string }) {
  const { pending, run } = useAction()
  return (
    <button type="button" disabled={pending} aria-label={`Unlink ${name}`} onClick={() => { if (window.confirm(`Unlink ${name} from this product?`)) run(() => unlinkProductAsset(workspaceType, productId, assetId)) }}
      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600">
      {pending ? <Loader2 size={13} className="animate-spin" /> : <Unlink size={13} />}
    </button>
  )
}
