'use client'

import { useState, useTransition } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { refreshAudienceAction } from '@/lib/advertising/actions'

export default function RefreshAudienceButton({
  workspaceId, workspaceType, audienceId,
}: { workspaceId: string; workspaceType: string; audienceId: string }) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  function refresh() {
    setMessage(null)
    startTransition(async () => {
      const result = await refreshAudienceAction({ workspaceId, workspaceType, audienceId })
      setMessage(result.ok ? { text: result.message ?? 'Refresh requested.', ok: true } : { text: result.error, ok: false })
      setTimeout(() => setMessage(null), 4000)
    })
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button" onClick={refresh} disabled={pending}
        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        aria-label="Refresh audience"
      >
        {pending ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Refresh
      </button>
      {message && (
        <span role="status" className={`absolute right-0 top-full z-10 mt-1 w-40 whitespace-normal rounded-md px-2 py-1 text-[11px] font-medium shadow-lg ${message.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {message.text}
        </span>
      )}
    </span>
  )
}
