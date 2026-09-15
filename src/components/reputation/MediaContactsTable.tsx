'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Search } from 'lucide-react'
import { timeAgo } from './primitives'
import { EmptyState } from '@/components/ui/EmptyState'
import { EditMediaContactButton } from './EditMediaContactButton'

interface Contact {
  id: string; name: string; beat: string | null; region: string | null
  relationship_stage: string; verified: boolean; last_reply_at: string | null
  media_outlets?: { name: string } | null
}

const STAGES = ['new', 'contacted', 'engaged', 'warm', 'champion', 'cold', 'do_not_contact']

export function MediaContactsTable({ contacts, canManage = false }: { contacts: Contact[]; canManage?: boolean }) {
  const [query, setQuery] = useState('')
  const [stage, setStage] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return contacts.filter(c => {
      if (stage && c.relationship_stage !== stage) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q) || (c.media_outlets?.name ?? '').toLowerCase().includes(q) || (c.beat ?? '').toLowerCase().includes(q)
    })
  }, [contacts, query, stage])

  if (contacts.length === 0) {
    return <EmptyState compact title="No media contacts yet" description="Add journalists to start tracking relationships." />
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, outlet or beat"
            className="h-8 w-64 rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-xs text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <select value={stage} onChange={e => setStage(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600">
          <option value="">All relationship stages</option>
          {STAGES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        {(query || stage) && (
          <button type="button" onClick={() => { setQuery(''); setStage('') }} className="text-xs font-medium text-blue-600">Clear filters</button>
        )}
        <span className="ml-auto text-xs text-slate-400">{filtered.length} of {contacts.length}</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState compact title="No matching contacts" description="Try a different search term or clear your filters." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5">Journalist</th>
                <th className="px-5 py-2.5">Outlet</th>
                <th className="px-5 py-2.5">Beat</th>
                <th className="px-5 py-2.5">Region</th>
                <th className="px-5 py-2.5">Relationship</th>
                <th className="px-5 py-2.5">Last Reply</th>
                <th className="px-5 py-2.5">Verified</th>
                {canManage && <th className="px-5 py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(c => (
                <tr key={c.id}>
                  <td className="px-5 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-5 py-3 text-slate-600">{c.media_outlets?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-600">{c.beat ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-600">{c.region ?? '—'}</td>
                  <td className="px-5 py-3 capitalize text-slate-600">{c.relationship_stage.replace(/_/g, ' ')}</td>
                  <td className="px-5 py-3 text-slate-500">{timeAgo(c.last_reply_at)}</td>
                  <td className="px-5 py-3">{c.verified && <CheckCircle2 size={14} className="text-emerald-500" />}</td>
                  {canManage && <td className="px-5 py-3"><EditMediaContactButton contact={c} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
