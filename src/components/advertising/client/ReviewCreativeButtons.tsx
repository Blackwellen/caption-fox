'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { reviewCreativeAction } from '@/lib/advertising/actions'

// Internal approve / request-changes controls for the creative review queue.
// This never claims to change the PROVIDER's review state — only Caption
// Fox's own internal review record, which the copy on this control reflects.

export default function ReviewCreativeButtons({
  workspaceId, workspaceType, creativeId,
}: { workspaceId: string; workspaceType: string; creativeId: string }) {
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState<'approved' | 'changes_requested' | null>(null)

  function decide(decision: 'approved' | 'changes_requested') {
    startTransition(async () => {
      const result = await reviewCreativeAction({ workspaceId, workspaceType, creativeId, decision })
      if (result.ok) setDone(decision)
    })
  }

  if (done) {
    return <span className="shrink-0 text-[11px] font-medium text-emerald-600">{done === 'approved' ? 'Approved internally' : 'Changes requested'}</span>
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button" onClick={() => decide('approved')} disabled={pending}
        className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
      >
        {pending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Approve
      </button>
      <button
        type="button" onClick={() => decide('changes_requested')} disabled={pending}
        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        <X size={11} /> Request changes
      </button>
    </div>
  )
}
