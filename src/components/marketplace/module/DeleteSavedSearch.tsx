'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { deleteSavedSearch } from '@/lib/marketplace/actions'

/** Removes a saved search preset with an inline confirm — no silent destruction. */
export default function DeleteSavedSearch({ id, canDelete }: { id: string; canDelete: boolean }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()

  if (!canDelete) return null

  if (confirming) {
    return (
      <span className="flex shrink-0 items-center gap-1">
        <button
          type="button" disabled={pending}
          onClick={() => start(async () => {
            await deleteSavedSearch(id)
            setConfirming(false)
            router.refresh()
          })}
          className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-medium text-white disabled:opacity-60"
        >
          {pending ? <Loader2 size={11} className="animate-spin" /> : 'Delete'}
        </button>
        <button
          type="button" onClick={() => setConfirming(false)}
          className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600"
        >
          Cancel
        </button>
      </span>
    )
  }

  return (
    <button
      type="button" onClick={() => setConfirming(true)}
      aria-label="Delete saved search"
      className="shrink-0 rounded p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
    >
      <Trash2 size={13} />
    </button>
  )
}
