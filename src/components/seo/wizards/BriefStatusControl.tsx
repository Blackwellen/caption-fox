'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { updateBriefStatus } from '@/lib/seo/actions'

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
export function BriefStatusControl({ briefId, status }: { briefId: string; status: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function onChange(next: string) {
    if (next === status || pending) return
    startTransition(async () => {
      const result = await updateBriefStatus(briefId, next)
      if (result.ok) router.refresh()
      else alert(result.error ?? 'Could not update status.')
    })
  }

  return (
    <div className="relative inline-flex items-center">
      <select
        value={status}
        disabled={pending}
        onChange={event => onChange(event.target.value)}
        aria-label="Brief status"
        className="h-8 rounded-lg border border-slate-200 bg-white pl-2.5 pr-7 text-xs font-medium text-slate-700 outline-none focus:border-blue-400 disabled:opacity-60"
      >
        {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      {pending && <Loader2 size={12} className="absolute right-2 animate-spin text-slate-400" />}
    </div>
  )
}
