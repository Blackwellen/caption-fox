'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { updatePartnerStatus } from '@/app/app/partnerships/actions'
import { useToast } from '@/components/campaigns/Toast'

export default function PartnerActionsMenu({
  partnerId, status, canEdit, canApprove, href,
}: { partnerId: string; status: string; canEdit: boolean; canApprove: boolean; href: string }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const { notify } = useToast()

  function setStatus(next: string) {
    setOpen(false)
    startTransition(async () => {
      const result = await updatePartnerStatus(partnerId, next)
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Partner updated.') : (result.error ?? 'Update failed.'))
      if (result.ok) router.refresh()
    })
  }

  return (
    <div className="relative inline-flex items-center gap-1">
      <Link href={href} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Open partner">
        <ExternalLink size={13} />
      </Link>
      {(canEdit || canApprove) && (
        <>
          <button
            type="button" onClick={() => setOpen(o => !o)} disabled={pending}
            aria-haspopup="menu" aria-expanded={open} aria-label="Partner actions"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <MoreHorizontal size={14} />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
              <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                {canApprove && status === 'applicant' && (
                  <button type="button" role="menuitem" onClick={() => setStatus('active')} className="block w-full px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50">Approve</button>
                )}
                {canEdit && status !== 'active' && (
                  <button type="button" role="menuitem" onClick={() => setStatus('active')} className="block w-full px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50">Mark active</button>
                )}
                {canEdit && status !== 'paused' && (
                  <button type="button" role="menuitem" onClick={() => setStatus('paused')} className="block w-full px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50">Pause</button>
                )}
                {canEdit && status !== 'suspended' && (
                  <button type="button" role="menuitem" onClick={() => setStatus('suspended')} className="block w-full px-3 py-2 text-left text-[13px] text-red-600 hover:bg-red-50">Suspend</button>
                )}
                {canEdit && status !== 'archived' && (
                  <button type="button" role="menuitem" onClick={() => setStatus('archived')} className="block w-full px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50">Archive</button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
