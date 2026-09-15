'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { useToast } from '@/components/campaigns/Toast'
import { updateBriefStatus } from '@/app/app/creators/actions'
import { cn } from '@/lib/utils'
import { BRIEF_STATUS_BADGE, BRIEF_STATUS_LABELS, BRIEF_TRANSITIONS, type BriefStatus } from '@/lib/creators/constants'
import { Badge } from '@/components/ui/Badge'

/**
 * Status changer for one brief. Only offers transitions the backend lifecycle
 * actually allows (`BRIEF_TRANSITIONS`), so the menu can never propose a move
 * the server action will reject.
 */
export default function BriefStatusMenu({
  id, current, compact,
}: { id: string; current: BriefStatus; compact?: boolean }) {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const options = (BRIEF_TRANSITIONS[current] ?? []).filter(status => status !== current)

  function change(status: BriefStatus) {
    setOpen(false)
    startTransition(async () => {
      const result = await updateBriefStatus(id, status)
      if (!result.ok) { notify('error', result.error ?? 'Could not update the status.'); return }
      notify('success', result.message ?? 'Status updated.')
      router.refresh()
    })
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button" onClick={() => setOpen(v => !v)} disabled={pending || options.length === 0}
        aria-expanded={open} aria-label="Change brief status"
        className={cn('inline-flex items-center gap-1 rounded-full transition-opacity disabled:opacity-60', compact ? '' : 'opacity-0 group-hover:opacity-100')}
      >
        <Badge variant={BRIEF_STATUS_BADGE[current]}>{BRIEF_STATUS_LABELS[current]}</Badge>
        {options.length > 0 && <ChevronDown size={12} className="text-slate-400" />}
      </button>
      {open && options.length > 0 && (
        <>
          <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
            {options.map(status => (
              <button
                key={status} type="button" onClick={() => change(status)}
                className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50"
              >
                Move to {BRIEF_STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
