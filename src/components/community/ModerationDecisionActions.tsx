'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, Check, MessageSquareWarning, ShieldAlert, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/campaigns/Toast'
import { decideModerationReport } from '@/app/app/community/actions'
import type { ModerationDecision } from '@/lib/community/constants'

/**
 * The decision panel for one selected moderation report. Only the actions the
 * signed-in moderator actually has permission for are rendered — a read-only
 * moderator sees the report but no destructive controls.
 */
export default function ModerationDecisionActions({
  reportId, status, canApprove, canRemove, canWarn, canSuspend, canBan,
}: {
  reportId: string
  status: string
  canApprove: boolean
  canRemove: boolean
  canWarn: boolean
  canSuspend: boolean
  canBan: boolean
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const [notes, setNotes] = useState('')
  const [active, setActive] = useState<ModerationDecision | null>(null)

  const resolved = status === 'resolved' || status === 'dismissed' || status === 'archived'
  if (resolved) {
    return <p className="text-[12.5px] text-slate-400">This report has already been resolved.</p>
  }
  if (!canApprove && !canRemove && !canWarn && !canSuspend && !canBan) {
    return <p className="text-[12.5px] text-slate-400">Your role does not include moderation decisions.</p>
  }

  function submit(decision: ModerationDecision) {
    if (pending) return
    setActive(decision)
    startTransition(async () => {
      const result = await decideModerationReport({ reportId, decision, notes: notes.trim() || undefined })
      if (!result.ok) { notify('error', result.error ?? 'Could not record this decision.'); setActive(null); return }
      notify('success', result.message ?? 'Decision recorded.')
      setNotes('')
      setActive(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <Textarea
        label="Notes (optional)" rows={2} value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="Add context for the audit log…"
      />
      <div className="grid grid-cols-2 gap-2">
        {canApprove && (
          <Button size="sm" icon={<Check size={14} />} loading={pending && active === 'approve'} onClick={() => submit('approve')} className="justify-center">
            Approve
          </Button>
        )}
        {canRemove && (
          <Button variant="secondary" size="sm" icon={<Trash2 size={14} />} loading={pending && active === 'remove_content'} onClick={() => submit('remove_content')} className="justify-center">
            Remove
          </Button>
        )}
        {canWarn && (
          <Button variant="secondary" size="sm" icon={<MessageSquareWarning size={14} />} loading={pending && active === 'warn_user'} onClick={() => submit('warn_user')} className="justify-center">
            Warn user
          </Button>
        )}
        {canSuspend && (
          <Button variant="secondary" size="sm" icon={<ShieldAlert size={14} />} loading={pending && active === 'suspend_user'} onClick={() => submit('suspend_user')} className="justify-center">
            Suspend
          </Button>
        )}
        {canBan && (
          <Button variant="danger" size="sm" icon={<Ban size={14} />} loading={pending && active === 'ban_user'} onClick={() => submit('ban_user')} className="col-span-2 justify-center">
            Ban user
          </Button>
        )}
      </div>
    </div>
  )
}
