'use client'

import { useRef, useState, useTransition } from 'react'
import { Send } from 'lucide-react'
import { addKitComment } from '@/lib/brand-assets/actions'

/** Posts a comment on a brand kit. Disabled while sending; errors shown inline. */
export default function KitCommentForm({ workspaceType, kitId, kitName }: { workspaceType: string; kitId: string; kitName: string }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)

  return (
    <form
      className="mx-3.5 mb-3.5"
      onSubmit={e => {
        e.preventDefault()
        const body = ref.current?.value ?? ''
        setError(null)
        start(async () => {
          const res = await addKitComment(workspaceType, kitId, body)
          if (res.ok) { if (ref.current) ref.current.value = '' } else setError(res.error)
        })
      }}
    >
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
        <input
          ref={ref}
          name="body"
          maxLength={1000}
          placeholder="Add a comment..."
          aria-label={`Add a comment on ${kitName}`}
          aria-invalid={!!error}
          className="h-8 min-w-0 flex-1 bg-transparent text-[10.5px] text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
        <button type="submit" disabled={pending} aria-label="Post comment"
          className="text-slate-400 hover:text-blue-600 disabled:opacity-50">
          <Send size={13} />
        </button>
      </div>
      {error && <p role="alert" className="mt-1 text-[10px] text-rose-600">{error}</p>}
    </form>
  )
}
