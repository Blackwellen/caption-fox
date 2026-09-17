'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserCheck } from 'lucide-react'
import { BUTTON_SECONDARY } from './design'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/campaigns/Toast'
import { bulkApproveSubmissions } from '@/lib/creators/actions'

/**
 * Bulk-approves the submissions currently eligible for review on this page
 * (waiting review or in review). Requires explicit confirmation because it is
 * a destructive, multi-record action — each affected submission becomes
 * payment-eligible immediately.
 */
export default function BulkApproveButton({ ids }: { ids: string[] }) {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit() {
    if (pending) return
    startTransition(async () => {
      const result = await bulkApproveSubmissions(ids)
      if (!result.ok) { notify('error', result.error ?? 'Could not approve submissions.'); return }
      notify('success', result.message ?? 'Submissions approved.')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button" className={BUTTON_SECONDARY}
        disabled={ids.length === 0} onClick={() => setOpen(true)}
        title={ids.length === 0 ? 'No submissions on this page are waiting for or in review.' : undefined}
      >
        <UserCheck size={16} aria-hidden />Bulk Approve
      </button>
      <Modal
        open={open} onClose={() => setOpen(false)}
        title="Bulk approve submissions" description={`This will approve ${ids.length} submission(s) currently waiting or in review, and mark each as payment-eligible.`}
        footer={(
          <div className="flex w-full justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" loading={pending} onClick={submit}>Approve {ids.length}</Button>
          </div>
        )}
      >
        <p className="text-[13px] text-slate-500">This action cannot be undone in bulk — approved submissions must be individually re-opened for further review. Only submissions in a reviewable status on this page are affected.</p>
      </Modal>
    </>
  )
}
