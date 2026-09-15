'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from './Toast'
import { reviewGiveawayWinner } from '@/app/app/campaigns/actions'
import { WINNER_STATUS_BADGE, WINNER_STATUS_LABELS, type WinnerStatus } from '@/lib/campaigns/constants'
import { Badge } from '@/components/ui/Badge'

export interface WinnerCandidate {
  id: string
  giveawayId: string
  giveawayTitle: string
  handle: string | null
  email: string | null
  status: string
  enteredAt: string
}

const INTENTS: { intent: 'approve' | 'reject' | 'contact' | 'accept' | 'fulfil' | 'replace'; label: string; from: string[] }[] = [
  { intent: 'approve', label: 'Approve', from: ['candidate', 'rejected'] },
  { intent: 'reject', label: 'Reject', from: ['candidate', 'approved'] },
  { intent: 'contact', label: 'Mark contacted', from: ['approved'] },
  { intent: 'accept', label: 'Mark accepted', from: ['contacted'] },
  { intent: 'fulfil', label: 'Mark prize fulfilled', from: ['accepted', 'contacted'] },
  { intent: 'replace', label: 'Request replacement', from: ['approved', 'contacted', 'rejected'] },
]

/**
 * Winner review queue. Every action runs through the server, which re-checks
 * the reviewer's permission and the entry's current state before writing, and
 * records an audit entry.
 */
export default function WinnerReviewQueue({
  candidates, canReview,
}: { candidates: WinnerCandidate[]; canReview: boolean }) {
  const router = useRouter()
  const { notify } = useToast()
  const [openGiveaway, setOpenGiveaway] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  const grouped = new Map<string, WinnerCandidate[]>()
  for (const candidate of candidates) {
    const list = grouped.get(candidate.giveawayId) ?? []
    list.push(candidate)
    grouped.set(candidate.giveawayId, list)
  }

  if (grouped.size === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-slate-400">
        No winners are waiting for review.
      </p>
    )
  }

  function act(entryId: string, intent: typeof INTENTS[number]['intent']) {
    startTransition(async () => {
      const result = await reviewGiveawayWinner(entryId, intent, note || undefined)
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Updated.') : (result.error ?? 'Review failed.'))
      if (result.ok) { setNote(''); router.refresh() }
    })
  }

  const openList = openGiveaway ? grouped.get(openGiveaway) ?? [] : []

  return (
    <>
      <ul className="space-y-1.5">
        {[...grouped.entries()].map(([giveawayId, list]) => (
          <li key={giveawayId} className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-[11px] font-bold text-violet-600">
              {list.length}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium text-slate-900">{list[0].giveawayTitle}</span>
              <span className="block text-[11px] text-slate-400">
                {list.length} winner{list.length === 1 ? '' : 's'} awaiting review
              </span>
            </span>
            <button
              type="button" onClick={() => setOpenGiveaway(giveawayId)}
              className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-100"
            >
              Review
            </button>
          </li>
        ))}
      </ul>

      {openGiveaway && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
          <div className="fixed inset-0" onClick={() => setOpenGiveaway(null)} aria-hidden />
          <div
            role="dialog" aria-modal="true" aria-labelledby="winner-review-title"
            className="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-3.5">
              <div>
                <h2 id="winner-review-title" className="text-[15px] font-semibold text-slate-900">
                  Winner review — {openList[0]?.giveawayTitle}
                </h2>
                <p className="text-xs text-slate-500">
                  Check eligibility before approving. Every decision is recorded in the activity log.
                </p>
              </div>
              <button
                type="button" onClick={() => setOpenGiveaway(null)} aria-label="Close"
                className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </header>

            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              {!canReview && (
                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
                  Your role can view winner candidates but cannot approve or reject them.
                </p>
              )}

              {canReview && (
                <label className="mb-3 block">
                  <span className="mb-1 block text-[11px] font-medium text-slate-600">
                    Review note <span className="text-slate-400">(optional, stored with the decision)</span>
                  </span>
                  <input
                    value={note} onChange={e => setNote(e.target.value)} maxLength={500}
                    placeholder="e.g. Eligibility confirmed against entry rules"
                    className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              )}

              <ul className="divide-y divide-slate-100">
                {openList.map(candidate => (
                  <li key={candidate.id} className="flex flex-wrap items-center gap-2 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-900">
                        {candidate.handle ?? candidate.email ?? 'Anonymous entrant'}
                      </span>
                      <span className="block truncate text-[11px] text-slate-400">
                        {candidate.email ?? 'No email on record'} · entered{' '}
                        {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(candidate.enteredAt))}
                      </span>
                    </span>
                    <Badge variant={WINNER_STATUS_BADGE[candidate.status as WinnerStatus] ?? 'slate'}>
                      {WINNER_STATUS_LABELS[candidate.status as WinnerStatus] ?? candidate.status}
                    </Badge>
                    {canReview && (
                      <span className="flex flex-wrap items-center gap-1">
                        {INTENTS.filter(action => action.from.includes(candidate.status)).map(action => (
                          <button
                            key={action.intent} type="button" disabled={pending}
                            onClick={() => act(candidate.id, action.intent)}
                            className={cn(
                              'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50',
                              action.intent === 'reject'
                                ? 'border-red-200 text-red-600 hover:bg-red-50'
                                : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                            )}
                          >
                            {action.label}
                          </button>
                        ))}
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              {pending && (
                <p className="flex items-center gap-1.5 pt-2 text-[13px] text-slate-500">
                  <Loader2 size={13} className="animate-spin" /> Saving decision…
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
