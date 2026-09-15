'use client'

import { useState, useTransition } from 'react'
import { Loader2, Pause, Play } from 'lucide-react'
import { pauseResumeCampaignAction } from '@/lib/advertising/actions'

// Pauses or resumes a campaign through the owning platform's API. The server
// action re-checks the provider's capability and the caller's role before
// touching anything, so this control is never the only line of defence.

export default function PauseResumeButton({
  workspaceId, workspaceType, campaignId, status,
}: { workspaceId: string; workspaceType: string; campaignId: string; status: 'active' | 'paused' }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const next = status === 'active' ? 'paused' : 'active'

  function toggle(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    setError(null)
    startTransition(async () => {
      const result = await pauseResumeCampaignAction({ workspaceId, workspaceType, campaignId, status: next })
      if (!result.ok) { setError(result.error); setTimeout(() => setError(null), 4000) }
    })
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button" onClick={toggle} disabled={pending}
        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11.5px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        aria-label={status === 'active' ? 'Pause campaign' : 'Resume campaign'}
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : status === 'active' ? <Pause size={12} /> : <Play size={12} />}
        {status === 'active' ? 'Pause' : 'Resume'}
      </button>
      {error && (
        <span role="alert" className="absolute right-0 top-full z-10 mt-1 w-52 rounded-md bg-red-600 px-2 py-1 text-[11px] font-medium text-white shadow-lg">
          {error}
        </span>
      )}
    </span>
  )
}
