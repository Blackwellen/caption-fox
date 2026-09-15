'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Archive, Download, Eye, Loader2, MoreVertical, Send, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { downloadAsset, setAssetArchived, submitAssetsForApproval, toggleFavourite } from '@/lib/brand-assets/actions'

/** Favourite star with optimistic toggle that rolls back if the save fails. */
export function FavouriteButton({ workspaceType, assetId, initial, name }: { workspaceType: string; assetId: string; initial: boolean; name: string }) {
  const [on, setOn] = useState(initial)
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from favourites` : `Add ${name} to favourites`}
      disabled={pending}
      onClick={e => {
        e.preventDefault()
        const prev = on
        setOn(!prev)
        start(async () => { const res = await toggleFavourite(workspaceType, assetId); if (!res.ok) setOn(prev) })
      }}
      className={cn('absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full transition-colors',
        on ? 'text-amber-400' : 'text-white drop-shadow hover:text-amber-300')}
    >
      <Star size={16} fill={on ? 'currentColor' : 'none'} strokeWidth={2} />
    </button>
  )
}

/** Row/card action menu. Each item is a real action; unavailable ones are omitted. */
export function AssetMenu({
  workspaceType, assetId, name, href, canDownload, canSubmit, canArchive, status,
}: {
  workspaceType: string; assetId: string; name: string; href: string
  canDownload: boolean; canSubmit: boolean; canArchive: boolean; status: string
}) {
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
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

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => start(async () => {
    const res = await fn()
    setOpen(false)
    setMsg(res.ok ? { ok: true, text: res.message ?? 'Done' } : { ok: false, text: res.error ?? 'Something went wrong' })
    if (res.ok) router.refresh()
    setTimeout(() => setMsg(null), 4000)
  })

  const item = 'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50'
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`Actions for ${name}`}
        onClick={() => setOpen(o => !o)} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600">
        {pending ? <Loader2 size={13} className="animate-spin" /> : <MoreVertical size={14} />}
      </button>
      {open && (
        <div role="menu" className="absolute bottom-full right-0 z-30 mb-1 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          <Link role="menuitem" href={href} className={item}><Eye size={13} className="text-slate-400" />Open details</Link>
          {canDownload && <button role="menuitem" type="button" className={item} onClick={() => start(async () => {
            const res = await downloadAsset(workspaceType, assetId)
            setOpen(false)
            if (res.ok) window.location.assign(res.data.url)
            else { setMsg({ ok: false, text: res.error }); setTimeout(() => setMsg(null), 5000) }
          })}><Download size={13} className="text-slate-400" />Download</button>}
          {canSubmit && ['draft', 'changes_requested', 'rejected'].includes(status) && (
            <button role="menuitem" type="button" className={item} onClick={() => run(() => submitAssetsForApproval(workspaceType, [assetId], 'medium'))}>
              <Send size={13} className="text-slate-400" />Send for approval</button>
          )}
          {canArchive && <button role="menuitem" type="button" className={cn(item, 'text-rose-600')} onClick={() => {
            if (window.confirm(`Archive ${name}? It will be hidden from the library and can be restored later.`)) run(() => setAssetArchived(workspaceType, assetId, true))
          }}><Archive size={13} />Archive</button>}
        </div>
      )}
      {msg && (
        <p role="status" className={cn('absolute bottom-full right-0 z-30 mb-1 w-56 rounded-md px-2.5 py-1.5 text-[11px] shadow-lg',
          msg.ok ? 'bg-slate-900 text-white' : 'bg-rose-600 text-white')}>{msg.text}</p>
      )}
    </div>
  )
}
