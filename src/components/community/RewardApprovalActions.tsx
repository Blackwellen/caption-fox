'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/campaigns/Toast'
import { reviewReward } from '@/app/app/community/actions'
import { cn } from '@/lib/utils'

/** Approve / reject pair for one pending advocacy reward. */
export default function RewardApprovalActions({ rewardId, canApprove }: { rewardId: string; canApprove: boolean }) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const [active, setActive] = useState<'approve' | 'reject' | null>(null)

  if (!canApprove) return null

  function submit(approve: boolean) {
    if (pending) return
    setActive(approve ? 'approve' : 'reject')
    startTransition(async () => {
      const result = await reviewReward({ rewardId, approve })
      if (!result.ok) { notify('error', result.error ?? 'Could not update this reward.'); setActive(null); return }
      notify('success', result.message ?? 'Reward updated.')
      setActive(null)
      router.refresh()
    })
  }

  return (
    <div className="flex shrink-0 items-center gap-2 text-[11px] font-medium">
      <button
        type="button" onClick={() => submit(true)} disabled={pending}
        className={cn('text-emerald-600 hover:underline disabled:opacity-40', pending && active === 'approve' && 'animate-pulse')}
      >
        Approve
      </button>
      <button
        type="button" onClick={() => submit(false)} disabled={pending}
        className={cn('text-red-500 hover:underline disabled:opacity-40', pending && active === 'reject' && 'animate-pulse')}
      >
        Reject
      </button>
    </div>
  )
}
