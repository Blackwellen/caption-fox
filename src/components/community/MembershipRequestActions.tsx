'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { useToast } from '@/components/campaigns/Toast'
import { reviewMembershipRequest } from '@/app/app/community/actions'
import { cn } from '@/lib/utils'

/** Approve / reject pair for one pending community membership request. */
export default function MembershipRequestActions({ requestId, canApprove }: { requestId: string; canApprove: boolean }) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const [active, setActive] = useState<'approve' | 'reject' | null>(null)

  if (!canApprove) return null

  function submit(approve: boolean) {
    if (pending) return
    setActive(approve ? 'approve' : 'reject')
    startTransition(async () => {
      const result = await reviewMembershipRequest({ requestId, approve })
      if (!result.ok) { notify('error', result.error ?? 'Could not update this request.'); setActive(null); return }
      notify('success', result.message ?? 'Request updated.')
      setActive(null)
      router.refresh()
    })
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button" onClick={() => submit(true)} disabled={pending}
        aria-label="Approve request"
        className={cn(
          'inline-flex h-6 w-6 items-center justify-center rounded-md text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-40',
          pending && active === 'approve' && 'animate-pulse',
        )}
      >
        <Check size={13} />
      </button>
      <button
        type="button" onClick={() => submit(false)} disabled={pending}
        aria-label="Reject request"
        className={cn(
          'inline-flex h-6 w-6 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-50 disabled:opacity-40',
          pending && active === 'reject' && 'animate-pulse',
        )}
      >
        <X size={13} />
      </button>
    </div>
  )
}
