'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { useToast } from '@/components/campaigns/Toast'
import { updateRightsStatus } from '@/lib/creators/actions'
import { RIGHTS_STATUS_BADGE, RIGHTS_STATUS_LABELS, type RightsStatus } from '@/lib/creators/constants'
import { Badge } from '@/components/ui/Badge'

const NEXT_STATUSES: Record<RightsStatus, RightsStatus[]> = {
  draft: ['requested', 'pending_approval'],
  requested: ['pending_approval', 'active', 'rejected'],
  pending_approval: ['active', 'rejected'],
  active: ['restricted', 'revoked', 'renewal_pending'],
  expired: ['renewal_pending', 'revoked'],
  restricted: ['active', 'revoked'],
  revoked: [],
  renewal_pending: ['active', 'expired'],
  rejected: ['requested'],
}

export default function RightsStatusMenu({ id, current }: { id: string; current: RightsStatus }) {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const options = NEXT_STATUSES[current] ?? []

  function change(status: RightsStatus) {
    setOpen(false)
    startTransition(async () => {
      const result = await updateRightsStatus(id, status)
      if (!result.ok) { notify('error', result.error ?? 'Could not update the rights status.'); return }
      notify('success', result.message ?? 'Rights status updated.')
      router.refresh()
    })
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button" onClick={() => setOpen(v => !v)} disabled={pending || options.length === 0}
        aria-expanded={open} aria-label="Change rights status" className="inline-flex items-center gap-1 disabled:opacity-60"
      >
        <Badge variant={RIGHTS_STATUS_BADGE[current]}>{RIGHTS_STATUS_LABELS[current]}</Badge>
        {options.length > 0 && <ChevronDown size={12} className="text-slate-400" />}
      </button>
      {open && options.length > 0 && (
        <>
          <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-30 mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
            {options.map(status => (
              <button key={status} type="button" onClick={() => change(status)} className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50">
                Move to {RIGHTS_STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
