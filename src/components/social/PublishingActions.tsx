'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'
import { cancelScheduledPost, retryFailedDeliveries, setApprovalDecision } from '@/lib/social/actions'

export function ApprovalActions({ postId }: { postId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function decide(decision: 'approve' | 'request_changes' | 'reject') {
    startTransition(async () => {
      const result = await setApprovalDecision(postId, decision)
      if (result.ok) router.refresh()
      else alert(result.message)
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      <button disabled={pending} onClick={() => decide('approve')} className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50">Approve</button>
      <button disabled={pending} onClick={() => decide('request_changes')} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 disabled:opacity-50">Changes</button>
      <button disabled={pending} onClick={() => decide('reject')} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-red-600 disabled:opacity-50">Reject</button>
    </div>
  )
}

export function PostRowMenu({ postId, status }: { postId: string; status: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function cancel() {
    if (!confirm('Cancel this scheduled post?')) return
    startTransition(async () => {
      const result = await cancelScheduledPost(postId)
      if (result.ok) router.refresh()
      else alert(result.message)
    })
  }

  function retry() {
    startTransition(async () => {
      const result = await retryFailedDeliveries(postId)
      if (result.ok) router.refresh()
      else alert(result.message)
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      {status === 'failed' && (
        <button disabled={pending} onClick={retry} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-blue-600 disabled:opacity-50">Retry</button>
      )}
      {['scheduled', 'queued', 'approved', 'pending_approval'].includes(status) && (
        <button disabled={pending} onClick={cancel} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 disabled:opacity-50">Cancel</button>
      )}
      <button className="rounded-md p-1 text-slate-400 hover:bg-slate-100" aria-label="More actions"><MoreHorizontal size={15} /></button>
    </div>
  )
}
