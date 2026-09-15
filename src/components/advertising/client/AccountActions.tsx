'use client'

import { useState, useTransition } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { resolveIssueAction, syncNowAction } from '@/lib/advertising/actions'
import { cn } from '@/lib/utils'

// Header "Refresh Sync" and the Data Source Issues "Resolve" button.
// Both disable themselves while in flight so a double-click cannot queue a
// second run, and both surface the server's own result message.

function Toast({ message }: { message: { text: string; ok: boolean } | null }) {
  if (!message) return null
  return (
    <span role="status" className={cn(
      'absolute right-0 top-full z-20 mt-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium text-white shadow-lg',
      message.ok ? 'bg-emerald-600' : 'bg-red-600',
    )}>
      {message.text}
    </span>
  )
}

/** Syncs every live connection in turn. Failures are reported, not hidden. */
export function RefreshSyncButton({
  workspaceId, workspaceType, connectionIds, disabledReason,
}: { workspaceId: string; workspaceType: string; connectionIds: string[]; disabledReason?: string | null }) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const disabled = pending || !!disabledReason || connectionIds.length === 0

  function run() {
    setMessage(null)
    startTransition(async () => {
      let failed = 0
      for (const connectionId of connectionIds) {
        const result = await syncNowAction({ workspaceId, workspaceType, connectionId })
        if (!result.ok) failed += 1
      }
      setMessage(failed === 0
        ? { text: `Synced ${connectionIds.length} source${connectionIds.length === 1 ? '' : 's'}.`, ok: true }
        : { text: `${failed} of ${connectionIds.length} sources failed to sync. See Data Source Issues.`, ok: false })
      setTimeout(() => setMessage(null), 5000)
    })
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button" onClick={run} disabled={disabled}
        title={disabledReason ?? (connectionIds.length === 0 ? 'No connected sources to sync.' : undefined)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <RefreshCw size={15} aria-hidden />}
        {pending ? 'Syncing…' : 'Refresh Sync'}
      </button>
      <Toast message={message} />
    </span>
  )
}

export function ResolveIssueButton({ workspaceId, workspaceType, issueId }: { workspaceId: string; workspaceType: string; issueId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <span className="relative inline-flex">
      <button
        type="button" disabled={pending}
        onClick={() => startTransition(async () => {
          const result = await resolveIssueAction({ workspaceId, workspaceType, issueId })
          if (!result.ok) setError(result.error)
        })}
        className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
      >
        {pending ? 'Resolving…' : 'Resolve'}
      </button>
      <Toast message={error ? { text: error, ok: false } : null} />
    </span>
  )
}
