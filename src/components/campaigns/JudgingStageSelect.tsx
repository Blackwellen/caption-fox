'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { useToast } from './Toast'
import { setCompetitionJudgingStage } from '@/app/app/campaigns/entity-actions'
import { JUDGING_STAGES, JUDGING_STAGE_BADGE, JUDGING_STAGE_LABELS, type JudgingStage } from '@/lib/campaigns/constants'

/**
 * Advances a competition's judging stage. Stages move in order — the server
 * rejects skips — and read-only roles see the badge without a control.
 */
export default function JudgingStageSelect({
  competitionId, stage, canJudge,
}: { competitionId: string; stage: string; canJudge: boolean }) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()

  if (!canJudge) {
    return (
      <Badge variant={JUDGING_STAGE_BADGE[stage as JudgingStage] ?? 'slate'}>
        {JUDGING_STAGE_LABELS[stage as JudgingStage] ?? stage}
      </Badge>
    )
  }

  const index = JUDGING_STAGES.indexOf(stage as JudgingStage)

  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        value={stage} disabled={pending}
        aria-label="Judging stage"
        onChange={event => {
          const next = event.target.value
          startTransition(async () => {
            const result = await setCompetitionJudgingStage(competitionId, next)
            notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Updated.') : (result.error ?? 'Could not change the judging stage.'))
            if (result.ok) router.refresh()
          })
        }}
        className="h-7 rounded-lg border border-slate-200 bg-white px-1.5 text-[12px] font-medium text-slate-700 disabled:opacity-50"
      >
        {JUDGING_STAGES.map((option, i) => (
          // Only the current stage and the next one are offered; going
          // backwards or skipping ahead is not a valid judging transition.
          <option key={option} value={option} disabled={i !== index && i !== index + 1}>
            {JUDGING_STAGE_LABELS[option]}
          </option>
        ))}
      </select>
      {pending && <Loader2 size={12} className="animate-spin text-slate-400" />}
    </span>
  )
}
