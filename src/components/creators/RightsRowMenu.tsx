'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, MoreVertical } from 'lucide-react'
import { useToast } from '@/components/campaigns/Toast'
import { renewRights, updateRightsStatus } from '@/lib/creators/actions'
import { RIGHTS_STATUS_LABELS, RIGHTS_TRANSITIONS, type RightsStatus } from '@/lib/creators/constants'

/**
 * Row menu for one rights record: open, renew (creates a linked renewal that
 * needs approval) and the status moves the rights lifecycle allows. Revoking
 * asks for confirmation because it immediately blocks further use.
 */
export default function RightsRowMenu({
  id, status, href, canManage, canApprove, expiryDate,
}: { id: string; status: string; href: string; canManage: boolean; canApprove: boolean; expiryDate: string | null }) {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [renewing, setRenewing] = useState(false)
  const [renewDate, setRenewDate] = useState('')
  const [pending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => { setOpen(false); setRenewing(false) }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, close])

  function run(action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    close()
    startTransition(async () => {
      const result = await action()
      notify(result.ok ? 'success' : 'error', result.ok ? result.message ?? 'Updated.' : result.error ?? 'Something went wrong.')
      router.refresh()
    })
  }

  const moves = canApprove ? (RIGHTS_TRANSITIONS[status as RightsStatus] ?? []).filter(s => s !== status) : []
  const canRenew = canManage && ['active', 'expired', 'renewal_pending'].includes(status)

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button type="button" aria-label="Rights record actions" aria-expanded={open} disabled={pending} onClick={() => setOpen(v => !v)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#667085] hover:bg-slate-100 disabled:opacity-50">
        {pending ? <Loader2 size={13} className="animate-spin" /> : <MoreVertical size={14} />}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1 text-[12.5px] shadow-lg">
          <Link role="menuitem" href={href} className="block rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-slate-50" onClick={close}>Open record</Link>
          {canRenew && !renewing && (
            <button type="button" role="menuitem" onClick={() => setRenewing(true)} className="block w-full rounded-lg px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-50">Renew licence…</button>
          )}
          {renewing && (
            <form className="space-y-2 px-2.5 py-2" onSubmit={e => { e.preventDefault(); if (renewDate) run(() => renewRights(id, { expiryDate: renewDate })) }}>
              <label className="block text-[11px] font-medium text-slate-500">New expiry date
                <input type="date" required min={expiryDate ?? undefined} value={renewDate} onChange={e => setRenewDate(e.target.value)} className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-[12px]" />
              </label>
              <button type="submit" className="w-full rounded-md bg-blue-600 py-1 text-[12px] font-medium text-white">Start renewal</button>
            </form>
          )}
          {moves.length > 0 && <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Change status</p>}
          {moves.map(next => (
            <button key={next} type="button" role="menuitem"
              onClick={() => {
                if (next === 'revoked' && !window.confirm('Revoke this licence? The asset can no longer be used under it.')) return
                run(() => updateRightsStatus(id, next))
              }}
              className={`block w-full rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-50 ${next === 'revoked' || next === 'rejected' ? 'text-red-600' : 'text-slate-700'}`}>
              Mark as {RIGHTS_STATUS_LABELS[next]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
