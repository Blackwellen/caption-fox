'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/campaigns/Toast'
import { submitMessageForApproval, reviewMessageApproval } from '@/app/app/messaging/actions'

/**
 * Row-level approval controls for the messaging programs table. A draft can
 * be submitted; a pending message can be approved / rejected / sent back for
 * changes by anyone with the `approve` capability. Every transition is
 * enforced again server-side in `actions.ts` — this is not a cosmetic gate.
 */
export default function MessageApprovalActions({
  id, status, approvalStatus, canEdit, canApprove,
}: { id: string; status: string; approvalStatus: string; canEdit: boolean; canApprove: boolean }) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const [noteFor, setNoteFor] = useState<'reject' | 'request_changes' | null>(null)
  const [note, setNote] = useState('')

  function submit() {
    startTransition(async () => {
      const res = await submitMessageForApproval(id)
      notify(res.ok ? 'success' : 'error', res.ok ? (res.message ?? 'Submitted.') : (res.error ?? 'Could not submit.'))
      if (res.ok) router.refresh()
    })
  }

  function decide(decision: 'approve' | 'reject' | 'request_changes') {
    startTransition(async () => {
      const res = await reviewMessageApproval(id, decision, note || undefined)
      notify(res.ok ? 'success' : 'error', res.ok ? (res.message ?? 'Updated.') : (res.error ?? 'Could not update.'))
      if (res.ok) { setNoteFor(null); setNote(''); router.refresh() }
    })
  }

  if (approvalStatus === 'pending' && canApprove) {
    if (noteFor) {
      return (
        <div className="flex items-center gap-1">
          <input
            autoFocus value={note} onChange={e => setNote(e.target.value)} placeholder="Reason (optional)"
            className="h-7 w-32 rounded border border-slate-200 px-2 text-[11px]"
          />
          <button type="button" onClick={() => decide(noteFor)} disabled={pending} className="text-[11px] font-medium text-red-600 hover:text-red-700 disabled:opacity-50">Confirm</button>
          <button type="button" onClick={() => setNoteFor(null)} className="text-[11px] text-slate-400 hover:text-slate-600">Cancel</button>
        </div>
      )
    }
    return (
      <div className="flex items-center justify-end gap-2">
        {pending && <Loader2 size={12} className="animate-spin text-slate-400" />}
        <button type="button" onClick={() => decide('approve')} disabled={pending} className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50">Approve</button>
        <button type="button" onClick={() => setNoteFor('request_changes')} disabled={pending} className="text-[11px] font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50">Request changes</button>
        <button type="button" onClick={() => setNoteFor('reject')} disabled={pending} className="text-[11px] font-medium text-red-500 hover:text-red-600 disabled:opacity-50">Reject</button>
      </div>
    )
  }

  if (status === 'draft' && canEdit) {
    return (
      <button type="button" onClick={submit} disabled={pending} className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50">
        {pending && <Loader2 size={11} className="animate-spin" />}
        Submit for approval
      </button>
    )
  }

  return null
}
