'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { SentimentBadge, StatusPill, timeAgo } from './primitives'
import { ReviewRowActions } from './ReviewRowActions'
import { EmptyState } from '@/components/ui/EmptyState'

const SOURCE_LABELS: Record<string, string> = {
  google: 'Google', trustpilot: 'Trustpilot', app_store: 'App Store', play_store: 'Play Store',
  facebook: 'Facebook', manual: 'Manual', other: 'Other',
}

interface Review {
  id: string; source: string; reviewer_name: string | null; rating: number
  review_text: string | null; sentiment: string; status: string; reviewed_at: string
  review_responses?: { id: string; status: string }[]
}

const STATUSES = ['new', 'in_progress', 'responded', 'escalated', 'resolved', 'ignored']
const SENTIMENTS = ['positive', 'neutral', 'negative', 'mixed']

export function ReviewsList({ reviews, canRespond, canEscalate }: { reviews: Review[]; canRespond: boolean; canEscalate: boolean }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [sentiment, setSentiment] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return reviews.filter(r => {
      if (status && r.status !== status) return false
      if (sentiment && r.sentiment !== sentiment) return false
      if (!q) return true
      return (r.reviewer_name ?? '').toLowerCase().includes(q) || (r.review_text ?? '').toLowerCase().includes(q)
    })
  }, [reviews, query, status, sentiment])

  if (reviews.length === 0) {
    return <EmptyState compact title="No reviews yet" description="Connect a review source or add reviews manually to start tracking sentiment." />
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query} onChange={e => setQuery(e.target.value)} placeholder="Search reviewer or text"
            className="h-8 w-56 rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-xs text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600">
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={sentiment} onChange={e => setSentiment(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600">
          <option value="">All sentiment</option>
          {SENTIMENTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(query || status || sentiment) && (
          <button type="button" onClick={() => { setQuery(''); setStatus(''); setSentiment('') }} className="text-xs font-medium text-blue-600">Clear filters</button>
        )}
        <span className="ml-auto text-xs text-slate-400">{filtered.length} of {reviews.length}</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState compact title="No matching reviews" description="Try a different search term or clear your filters." />
      ) : (
        <div className="divide-y divide-slate-100">
          {filtered.map(r => (
            <div key={r.id} className="px-5 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{r.reviewer_name ?? 'Anonymous'}</span>
                  <span className="text-xs text-slate-400">{SOURCE_LABELS[r.source] ?? r.source}</span>
                  <span className="text-xs font-medium text-amber-600">{'★'.repeat(Math.round(Number(r.rating)))}{'☆'.repeat(5 - Math.round(Number(r.rating)))}</span>
                </div>
                <div className="flex items-center gap-2">
                  <SentimentBadge sentiment={r.sentiment} />
                  <StatusPill status={r.status} />
                </div>
              </div>
              {r.review_text && <p className="mt-1.5 text-sm text-slate-600">{r.review_text}</p>}
              <p className="mt-1 text-xs text-slate-400">{timeAgo(r.reviewed_at)}</p>
              <ReviewRowActions
                reviewId={r.id} status={r.status}
                existingResponse={(r.review_responses ?? [])[0] ?? null}
                canRespond={canRespond} canEscalate={canEscalate}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
