'use client'

import { useState, useTransition } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { refreshAudienceAction } from '@/lib/advertising/actions'

export default function RefreshAudienceButton({
  workspaceId, workspaceType, audienceId, iconOnly = false,
}: {
  workspaceId: string; workspaceType: string; audienceId: string
  /** Icon-only, chip-height variant for dense audience cards. */
  iconOnly?: boolean
}) {
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
        className={iconOnly
          ? 'flex h-[22px] w-[22px] items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50'
          : 'inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50'}
        aria-label="Refresh audience"
        title="Refresh audience"
      >
        {pending ? <Loader2 size={iconOnly ? 13 : 11} className="animate-spin" /> : <RefreshCw size={iconOnly ? 13 : 11} />}
        {!iconOnly && ' Refresh'}
      </button>
      {message && (
        <span role="status" className={`absolute right-0 top-full z-10 mt-1 w-40 whitespace-normal rounded-md px-2 py-1 text-[11px] font-medium shadow-lg ${message.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {message.text}
        </span>
      )}
    </span>
  )
}
