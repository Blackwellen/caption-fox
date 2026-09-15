'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { SentimentBadge, formatNumber, timeAgo } from './primitives'
import { EmptyState } from '@/components/ui/EmptyState'

interface Mention {
  id: string; publication: string; headline: string; url: string | null
  published_at: string; sentiment: string; estimated_reach: number | null
}

const SENTIMENTS = ['positive', 'neutral', 'negative', 'mixed']

export function CoverageTable({ mentions }: { mentions: Mention[] }) {
  const [query, setQuery] = useState('')
  const [sentiment, setSentiment] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return mentions.filter(m => {
      if (sentiment && m.sentiment !== sentiment) return false
      if (!q) return true
      return m.publication.toLowerCase().includes(q) || m.headline.toLowerCase().includes(q)
    })
  }, [mentions, query, sentiment])

  if (mentions.length === 0) {
    return <EmptyState compact title="No coverage tracked yet" description="Track a mention manually, or connect a media monitoring source." />
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query} onChange={e => setQuery(e.target.value)} placeholder="Search publication or headline"
            className="h-8 w-64 rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-xs text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <select value={sentiment} onChange={e => setSentiment(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600">
          <option value="">All sentiment</option>
          {SENTIMENTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(query || sentiment) && <button type="button" onClick={() => { setQuery(''); setSentiment('') }} className="text-xs font-medium text-blue-600">Clear filters</button>}
        <span className="ml-auto text-xs text-slate-400">{filtered.length} of {mentions.length}</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState compact title="No matching coverage" description="Try a different search term or clear your filters." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5">Publication</th>
                <th className="px-5 py-2.5">Headline</th>
                <th className="px-5 py-2.5">Sentiment</th>
                <th className="px-5 py-2.5">Reach</th>
                <th className="px-5 py-2.5">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(m => (
                <tr key={m.id}>
                  <td className="px-5 py-3 font-medium text-slate-900">{m.publication}</td>
                  <td className="px-5 py-3 max-w-xs truncate text-slate-600">
                    {m.url ? <a href={m.url} target="_blank" rel="noreferrer" className="hover:text-blue-600">{m.headline}</a> : m.headline}
                  </td>
                  <td className="px-5 py-3"><SentimentBadge sentiment={m.sentiment} /></td>
                  <td className="px-5 py-3 text-slate-600">{m.estimated_reach ? formatNumber(m.estimated_reach) : '—'}</td>
                  <td className="px-5 py-3 text-slate-500">{timeAgo(m.published_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
