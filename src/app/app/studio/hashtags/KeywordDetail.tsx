'use client'

import { useState, useTransition } from 'react'
import { Copy, Plus, Ban, Star, X } from 'lucide-react'
import { CARD, Panel, formatNumber } from '@/components/studio/primitives'
import { StudioEmpty } from '@/components/studio/states'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/campaigns/Toast'
import { competitionBand, relevanceBand } from '@/lib/studio/constants'
import type { BlockedTermRow, KeywordSetRow, KeywordTermRow } from '@/lib/studio/types'
import type { StudioCapabilities } from '@/lib/studio/entitlements'
import { addKeywordTerms, blockTerm, removeKeywordTerm, toggleKeywordFavourite, unblockTerm } from './actions'

interface Recommendations {
  trending: KeywordTermRow[]
  lowCompetition: KeywordTermRow[]
  underused: KeywordTermRow[]
  error: string | null
}

export default function KeywordDetail({
  detail, recommendations, blocked, capabilities,
}: {
  detail: { row: KeywordSetRow | null; terms: KeywordTermRow[]; error: string | null } | null
  recommendations: Recommendations
  blocked: BlockedTermRow[]
  capabilities: StudioCapabilities
}) {
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const [newTerm, setNewTerm] = useState('')
  const [blockValue, setBlockValue] = useState('')

  const row = detail?.row ?? null
  const terms = detail?.terms ?? []

  function addTerm() {
    if (!row || !newTerm.trim()) return
    startTransition(async () => {
      const result = await addKeywordTerms({ setId: row.id, terms: [newTerm], kind: 'keyword' })
      if (!result.ok) { notify('error', result.error ?? 'Could not add term.'); return }
      notify('success', result.message ?? 'Added.')
      setNewTerm('')
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await removeKeywordTerm({ id })
      if (!result.ok) notify('error', result.error ?? 'Could not remove term.')
    })
  }

  function favourite() {
    if (!row) return
    startTransition(async () => {
      const result = await toggleKeywordFavourite({ id: row.id })
      if (!result.ok) notify('error', result.error ?? 'Could not update favourite.')
    })
  }

  function block() {
    if (!blockValue.trim()) return
    startTransition(async () => {
      const result = await blockTerm({ term: blockValue })
      if (!result.ok) { notify('error', result.error ?? 'Could not block term.'); return }
      notify('success', result.message ?? 'Blocked.')
      setBlockValue('')
    })
  }

  function unblock(id: string) {
    startTransition(async () => {
      const result = await unblockTerm({ id })
      if (!result.ok) notify('error', result.error ?? 'Could not unblock term.')
    })
  }

  const copyOutput = row ? row.hashtags.join(' ') : ''

  function copy() {
    navigator.clipboard.writeText(copyOutput).then(
      () => notify('success', 'Copied to clipboard.'),
      () => notify('error', 'Could not copy.'),
    )
  }

  return (
    <>
      <Panel title={row?.name ?? 'Select a group'} action={row && capabilities.editHashtags ? (
        <button type="button" onClick={favourite} className={row.favourite ? 'text-amber-500' : 'text-slate-300 hover:text-slate-500'}>
          <Star size={16} fill={row.favourite ? 'currentColor' : 'none'} />
        </button>
      ) : undefined}>
        {!row ? (
          <StudioEmpty bare title="No group selected" message="Pick a cluster or hashtag set from the list to see its detail." />
        ) : (
          <div>
            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Relevance" value={String(row.relevance_score ?? '—')} tone={relevanceBand(row.relevance_score).variant} />
              <Stat label="Avg. volume" value={row.avg_volume ? formatNumber(row.avg_volume) : '—'} />
              <Stat label="Competition" value={competitionBand(row.competition).label} tone={competitionBand(row.competition).variant} />
              <Stat label="Growth (30d)" value={row.growth_30d !== null ? `${row.growth_30d > 0 ? '+' : ''}${row.growth_30d}%` : '—'} tone={row.growth_30d && row.growth_30d > 0 ? 'green' : 'slate'} />
            </div>

            <p className="mb-2 text-xs font-medium text-slate-500">Top terms</p>
            {terms.length === 0 ? (
              <p className="mb-3 text-[13px] text-slate-400">No terms added yet.</p>
            ) : (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {terms.slice(0, 30).map(term => (
                  <span key={term.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {term.term}
                    {term.avg_volume ? <span className="text-slate-400">· {formatNumber(term.avg_volume)}</span> : null}
                    {capabilities.editHashtags && (
                      <button type="button" onClick={() => remove(term.id)} aria-label={`Remove ${term.term}`} className="text-slate-400 hover:text-red-500">
                        <X size={11} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}

            {capabilities.editHashtags && (
              <div className="mb-4 flex gap-2">
                <input
                  value={newTerm} onChange={e => setNewTerm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTerm()}
                  placeholder="Add a term…"
                  className="h-8 flex-1 rounded-lg border border-slate-200 px-2.5 text-[13px] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <button type="button" disabled={pending} onClick={addTerm} className="inline-flex h-8 items-center gap-1 rounded-lg bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  <Plus size={13} /> Add
                </button>
              </div>
            )}

            <p className="mb-2 text-xs font-medium text-slate-500">Copy-ready output</p>
            <div className={`${CARD} bg-slate-50 p-3`}>
              <p className="text-[13px] leading-relaxed text-slate-600">{copyOutput || 'No hashtags in this set yet.'}</p>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">{copyOutput.length} characters</span>
              <button type="button" onClick={copy} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                <Copy size={13} /> Copy
              </button>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Recommendations">
        <RecommendationGroup title="Trending now" items={recommendations.trending} />
        <RecommendationGroup title="Low competition" items={recommendations.lowCompetition} />
        <RecommendationGroup title="Underused terms" items={recommendations.underused} />
        {recommendations.trending.length === 0 && recommendations.lowCompetition.length === 0 && recommendations.underused.length === 0 && (
          <StudioEmpty bare title="No recommendations yet" message="Add terms with volume, competition and growth data to see estimates here." />
        )}
        <p className="mt-2 text-[11px] text-slate-400">Estimated from this workspace&apos;s own term data — not a live external search index.</p>
      </Panel>

      {capabilities.editHashtags && (
        <Panel title="Blocked terms">
          <div className="mb-2 flex gap-2">
            <input
              value={blockValue} onChange={e => setBlockValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && block()}
              placeholder="Block a term…"
              className="h-8 flex-1 rounded-lg border border-slate-200 px-2.5 text-[13px] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <button type="button" disabled={pending} onClick={block} className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 px-2.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
              <Ban size={13} /> Block
            </button>
          </div>
          {blocked.length === 0 ? (
            <p className="text-[13px] text-slate-400">No blocked terms.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {blocked.map(term => (
                <span key={term.id} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                  {term.term}
                  <button type="button" onClick={() => unblock(term.id)} aria-label={`Unblock ${term.term}`} className="text-red-400 hover:text-red-700">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </Panel>
      )}
    </>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'amber' | 'red' | 'slate' | 'blue' | 'violet' }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      {tone ? <Badge variant={tone}>{value}</Badge> : <p className="text-[15px] font-semibold text-slate-800">{value}</p>}
    </div>
  )
}

function RecommendationGroup({ title, items }: { title: string; items: KeywordTermRow[] }) {
  if (items.length === 0) return null
  return (
    <div className="mb-3">
      <p className="mb-1.5 text-xs font-semibold text-slate-600">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <span key={item.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">#{item.term.replace(/^#/, '')}</span>
        ))}
      </div>
    </div>
  )
}
