'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { useToast } from './Toast'
import { aiDraftReviewResponse, draftReviewResponse, escalateReview, publishReviewResponse } from '@/app/app/reputation/actions'

interface ExistingResponse { id: string; status: string; draft_text?: string }

interface Props {
  reviewId: string
  status: string
  existingResponse?: ExistingResponse | null
  canRespond: boolean
  canEscalate: boolean
}

const BTN = 'inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50'

export function ReviewRowActions({ reviewId, status, existingResponse, canRespond, canEscalate }: Props) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const [composing, setComposing] = useState(false)
  const [draft, setDraft] = useState('')

  function submitDraft() {
    if (!draft.trim() || pending) return
    startTransition(async () => {
      const result = await draftReviewResponse(reviewId, draft)
      if (!result.ok) { notify('error', result.error ?? 'Could not save the response.'); return }
      notify('success', 'Response drafted.')
      setComposing(false); setDraft('')
      router.refresh()
    })
  }

  function publish(responseId: string) {
    if (pending) return
    startTransition(async () => {
      const result = await publishReviewResponse(responseId)
      if (!result.ok) { notify('error', result.error ?? 'Could not publish.'); return }
      notify('success', 'Response published.')
      router.refresh()
    })
  }

  function escalate() {
    if (pending) return
    startTransition(async () => {
      const result = await escalateReview(reviewId)
      if (!result.ok) { notify('error', result.error ?? 'Could not escalate.'); return }
      notify('success', 'Review escalated.')
      router.refresh()
    })
  }

  function aiDraft() {
    if (pending) return
    setComposing(true)
    startTransition(async () => {
      const result = await aiDraftReviewResponse(reviewId)
      if (!result.ok) { notify('error', result.error ?? 'AI draft failed.'); return }
      setDraft(result.text ?? '')
      notify('success', 'AI draft ready — review before saving.')
    })
  }

  if (existingResponse && existingResponse.status === 'published') {
    return <span className="text-xs text-emerald-600">Response published</span>
  }

  return (
    <div className="mt-2 space-y-2">
      {composing ? (
        <div className="space-y-1.5">
          <textarea
            value={draft} onChange={e => setDraft(e.target.value)} rows={2}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            placeholder="Write a response..."
          />
          <div className="flex items-center gap-1.5">
            {pending && <Loader2 size={13} className="animate-spin text-slate-400" />}
            <button type="button" disabled={pending} className={BTN} onClick={submitDraft}>Save draft</button>
            <button type="button" disabled={pending} className={BTN} onClick={aiDraft}><Sparkles size={12} />AI draft</button>
            <button type="button" className={BTN} onClick={() => setComposing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          {pending && <Loader2 size={13} className="animate-spin text-slate-400" />}
          {existingResponse && existingResponse.status === 'draft' ? (
            <button type="button" disabled={pending} className={BTN} onClick={() => publish(existingResponse.id)}>Publish response</button>
          ) : canRespond ? (
            <button type="button" className={BTN} onClick={() => setComposing(true)}>Respond</button>
          ) : null}
          {canEscalate && status !== 'escalated' && status !== 'resolved' && (
            <button type="button" disabled={pending} className={BTN} onClick={escalate}>Escalate</button>
          )}
        </div>
      )}
    </div>
  )
}
