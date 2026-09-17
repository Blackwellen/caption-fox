'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, Loader2 } from 'lucide-react'
import { useToast } from '@/components/campaigns/Toast'
import { reviewSubmission } from '@/lib/creators/actions'
import { canTransitionSubmission } from '@/lib/creators/constants'

/**
 * "Review ▾" split button for one queued submission. The main action opens the
 * review workspace; the menu offers quick decisions allowed by the lifecycle
 * and the caller's role. Every decision is re-validated on the server.
 */
export default function QueueActions({
  id, status, href, canReview, canApprove,
}: { id: string; status: string; href: string; canReview: boolean; canApprove: boolean }) {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, close])

  function decide(decision: 'started' | 'approved' | 'changes_requested') {
    close()
    startTransition(async () => {
      const result = await reviewSubmission({ id, decision })
      notify(result.ok ? 'success' : 'error', result.ok ? result.message ?? 'Updated.' : result.error ?? 'Could not update the submission.')
      router.refresh()
    })
  }

  const options = [
    canReview && status === 'waiting_review' ? { key: 'started' as const, label: 'Start review' } : null,
    canApprove && canTransitionSubmission(status, 'approved') ? { key: 'approved' as const, label: 'Approve' } : null,
    canApprove && canTransitionSubmission(status, 'changes_requested') ? { key: 'changes_requested' as const, label: 'Request changes' } : null,
  ].filter((o): o is { key: 'started' | 'approved' | 'changes_requested'; label: string } => o !== null)

  return (
    <div ref={ref} className="relative inline-flex h-[28px] items-stretch rounded-md border border-[#dfe3ea] bg-white text-[10.5px] font-medium">
      <Link href={href} className="flex items-center rounded-l-md px-[16px] text-[#1d6bf3] hover:bg-[#f5f8ff]">
        {pending ? <Loader2 size={12} className="animate-spin" aria-hidden /> : 'Review'}
      </Link>
      <span className="w-px bg-[#dfe3ea]" aria-hidden />
      <button type="button" aria-label="Quick review actions" aria-expanded={open} disabled={options.length === 0 || pending}
        onClick={() => setOpen(v => !v)} className="flex w-[26px] items-center justify-center rounded-r-md text-[#475467] hover:bg-slate-50 disabled:opacity-40">
        <ChevronDown size={13} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-1 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {options.map(option => (
            <button key={option.key} type="button" role="menuitem" onClick={() => decide(option.key)}
              className="block w-full rounded-md px-2.5 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50">
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
