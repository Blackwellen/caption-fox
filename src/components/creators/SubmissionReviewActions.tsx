'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, MessageSquareWarning, PlayCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/campaigns/Toast'
import { reviewSubmission } from '@/app/app/creators/actions'
import { canTransitionSubmission, type SubmissionStatus } from '@/lib/creators/constants'

type Decision = 'started' | 'approved' | 'changes_requested' | 'rejected'

/**
 * The review action panel for one submission. Only offers actions the
 * submission's current status actually allows — approving a rejected
 * submission is not offered here because the backend lifecycle blocks it.
 */
export default function SubmissionReviewActions({
  submissionId, status, canReview, canApprove,
}: { submissionId: string; status: string; canReview: boolean; canApprove: boolean }) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState('')
  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null)

  if (!canReview) {
    return <p className="text-[12.5px] text-slate-400">Your role does not include reviewing submissions.</p>
  }

  const current = status as SubmissionStatus
  const canStart = current === 'waiting_review'
  const canApproveNow = canApprove && canTransitionSubmission(current, 'approved')
  const canRequestChanges = canApprove && canTransitionSubmission(current, 'changes_requested')
  const canReject = canApprove && canTransitionSubmission(current, 'rejected')

  function submit(decision: Decision) {
    if (pending) return
    setPendingDecision(decision)
    startTransition(async () => {
      const result = await reviewSubmission({ id: submissionId, decision, note: note.trim() || undefined })
      if (!result.ok) { notify('error', result.error ?? 'Could not update this submission.'); setPendingDecision(null); return }
      notify('success', result.message ?? 'Submission updated.')
      setNote('')
      setPendingDecision(null)
      router.refresh()
    })
  }

  if (!canApproveNow && !canRequestChanges && !canReject && !canStart) {
    return <p className="text-[12.5px] text-slate-400">This submission is not in a state that can be reviewed further from here.</p>
  }

  return (
    <div className="space-y-3">
      {canStart && (
        <Button variant="secondary" size="sm" icon={<PlayCircle size={14} />} loading={pending && pendingDecision === 'started'} onClick={() => submit('started')} className="w-full justify-center">
          Start review
        </Button>
      )}
      <Textarea
        label="Note (optional)" rows={2} value={note} onChange={e => setNote(e.target.value)}
        placeholder="Add context for the creator or your team…"
      />
      <div className="grid grid-cols-1 gap-2">
        {canApproveNow && (
          <Button size="sm" icon={<CheckCircle2 size={14} />} loading={pending && pendingDecision === 'approved'} onClick={() => submit('approved')} className="justify-center">
            Approve
          </Button>
        )}
        {canRequestChanges && (
          <Button variant="secondary" size="sm" icon={<MessageSquareWarning size={14} />} loading={pending && pendingDecision === 'changes_requested'} onClick={() => submit('changes_requested')} className="justify-center">
            Request changes
          </Button>
        )}
        {canReject && (
          <Button variant="danger" size="sm" icon={<XCircle size={14} />} loading={pending && pendingDecision === 'rejected'} onClick={() => submit('rejected')} className="justify-center">
            Reject
          </Button>
        )}
      </div>
    </div>
  )
}
