'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { reviewApplication } from '@/app/app/partnerships/actions'
import { useToast } from '@/components/campaigns/Toast'

export default function ApplicationActions({ applicationId, canApprove }: { applicationId: string; canApprove: boolean }) {
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const router = useRouter()
  const { notify } = useToast()

  if (!canApprove) return <span className="text-[11px] text-slate-400">Read only</span>

  function decide(decision: 'approved' | 'rejected' | 'changes_requested') {
    setBusy(decision)
    startTransition(async () => {
      const result = await reviewApplication(applicationId, decision)
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Application updated.') : (result.error ?? 'Update failed.'))
      setBusy(null)
      if (result.ok) router.refresh()
    })
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button" onClick={() => decide('rejected')} disabled={pending}
        className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        {busy === 'rejected' ? 'Rejecting…' : 'Reject'}
      </button>
      <button
        type="button" onClick={() => decide('changes_requested')} disabled={pending}
        className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        {busy === 'changes_requested' ? 'Requesting…' : 'Request changes'}
      </button>
      <button
        type="button" onClick={() => decide('approved')} disabled={pending}
        className="rounded-lg bg-blue-600 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy === 'approved' ? 'Approving…' : 'Approve'}
      </button>
    </div>
  )
}
