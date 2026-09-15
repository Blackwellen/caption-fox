'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Send } from 'lucide-react'
import { addBriefComment } from '@/lib/seo/actions'

export function BriefCommentComposer({ briefId }: { briefId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const ref = useRef<HTMLTextAreaElement>(null)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const body = ref.current?.value ?? ''
    if (!body.trim()) { setError('Write a comment before posting.'); return }

    startTransition(async () => {
      const result = await addBriefComment(briefId, body)
      if (!result.ok) { setError(result.error ?? 'Could not post the comment.'); return }
      setError(null)
      if (ref.current) ref.current.value = ''
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="mt-4 border-t border-slate-100 pt-4">
      {error && <p role="alert" className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <textarea
        ref={ref}
        rows={2}
        maxLength={2000}
        placeholder="Add a comment…"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
      <div className="mt-2 flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          Post comment
        </button>
      </div>
    </form>
  )
}
