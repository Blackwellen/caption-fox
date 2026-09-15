'use client'

import { useState, useTransition } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { syncNowAction } from '@/lib/advertising/actions'

// Triggers an incremental sync for one connection/account. Disabled while a
// request is in flight so a double-click cannot queue two runs, and shows the
// server's own success/error message rather than a generic toast.

export default function SyncNowButton({
  workspaceId, workspaceType, connectionId, accountId,
}: { workspaceId: string; workspaceType: string; connectionId: string; accountId?: string }) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  function sync() {
    setMessage(null)
    startTransition(async () => {
      const result = await syncNowAction({ workspaceId, workspaceType, connectionId, accountId })
      setMessage(result.ok ? { text: result.message ?? 'Synced.', ok: true } : { text: result.error, ok: false })
      setTimeout(() => setMessage(null), 4000)
    })
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button" onClick={sync} disabled={pending}
        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11.5px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        aria-label="Sync now"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        Sync
      </button>
      {message && (
        <span
          role="status"
          className={`absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium shadow-lg ${message.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}
        >
          {message.text}
        </span>
      )}
    </span>
  )
}
