'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Loader2 } from 'lucide-react'
import { updateBriefStatus } from '@/lib/seo/actions'

/** Tinted pill styles for the compact list control, matching the brief status chips. */
const COMPACT_TONE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 ring-slate-200',
  in_progress: 'bg-blue-50 text-blue-700 ring-blue-100',
  awaiting_review: 'bg-violet-50 text-violet-700 ring-violet-100',
  changes_requested: 'bg-amber-50 text-amber-700 ring-amber-100',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  published: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  archived: 'bg-slate-100 text-slate-500 ring-slate-200',
}

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'awaiting_review', label: 'Awaiting Review' },
  { value: 'changes_requested', label: 'Changes Requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
]

/** Status dropdown on the brief detail page. Writes through a real server action. */
export function BriefStatusControl({
  briefId, status, compact = false,
}: { briefId: string; status: string; compact?: boolean }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onChange(next: string) {
    if (next === status || pending) return
    startTransition(async () => {
      const result = await updateBriefStatus(briefId, next)
      if (result.ok) { setError(null); router.refresh() }
      else setError(result.error ?? 'Could not update status.')
    })
  }

  return (
    <div className={compact ? 'relative flex w-full items-center' : 'relative inline-flex items-center'} title={error ?? undefined}>
      <select
        name={`status-${briefId}`}
        value={status}
        disabled={pending}
        onChange={event => onChange(event.target.value)}
        aria-label="Brief status"
        className={
          compact
            ? `h-[22px] w-full cursor-pointer appearance-none truncate rounded-md border-0 pl-2 pr-5 text-[10.5px] font-medium outline-none ring-1 ring-inset focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60 ${COMPACT_TONE[status] ?? 'bg-slate-100 text-slate-600 ring-slate-200'}`
            : 'h-8 rounded-lg border border-slate-200 bg-white pl-2.5 pr-7 text-xs font-medium text-slate-700 outline-none focus:border-blue-400 disabled:opacity-60'
        }
      >
        {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      {compact && !pending && <ChevronDown size={11} className="pointer-events-none absolute right-1.5 opacity-70" aria-hidden />}
      {pending && <Loader2 size={11} className="absolute right-1.5 animate-spin text-slate-400" aria-hidden />}
      {error && <span role="alert" className="sr-only">{error}</span>}
    </div>
  )
}
