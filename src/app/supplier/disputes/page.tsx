'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DISPUTE_STAGE_META, type DisputeRow } from '@/lib/marketplace/supplier'
import { Scale, Loader2, Check } from 'lucide-react'

export default function SupplierDisputesPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [disputes, setDisputes] = useState<DisputeRow[]>([])
  const [responding, setResponding] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    // RLS scopes disputes to orders the user is party to.
    const { data } = await supabase.from('marketplace_disputes').select('*').order('created_at', { ascending: false })
    setDisputes((data ?? []) as DisputeRow[])
    setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  async function submit(d: DisputeRow) {
    if (!text.trim()) return
    setBusy(true)
    await supabase.from('marketplace_disputes').update({
      resolution: text.trim(),
      stage: d.stage === 'opened' ? 'evidence' : 'mediation',
    }).eq('id', d.id)
    setBusy(false)
    setResponding(null)
    setText('')
    load()
  }

  if (loading) return <div className="p-8 max-w-3xl mx-auto"><div className="h-8 w-40 bg-slate-100 rounded animate-pulse mb-6" /><div className="h-32 bg-slate-100 rounded-2xl animate-pulse" /></div>

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div><h1 className="text-xl font-bold text-slate-900">Disputes</h1><p className="text-sm text-slate-500">Respond to disputes and submit your evidence. Mediation is handled by Caption Fox support.</p></div>

      {disputes.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3"><Scale size={22} className="text-emerald-500" /></div>
          <p className="text-sm text-slate-500">No disputes — keep up the great work.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map(d => (
            <div key={d.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-900">Order #{d.order_id.slice(0, 8)}</p>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${DISPUTE_STAGE_META[d.stage].cls}`}>{DISPUTE_STAGE_META[d.stage].label}</span>
              </div>
              {d.reason && <p className="text-sm text-slate-600 mb-1"><span className="text-slate-400">Reason:</span> {d.reason}</p>}
              {d.resolution && <p className="text-sm text-slate-600 mb-2"><span className="text-slate-400">Your response:</span> {d.resolution}</p>}

              {['opened', 'evidence', 'mediation'].includes(d.stage) && (
                responding === d.id ? (
                  <div className="mt-2 space-y-2">
                    <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="Explain your side and reference any delivered work…" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <div className="flex gap-2">
                      <button onClick={() => submit(d)} disabled={busy || !text.trim()} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5">{busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Submit response</button>
                      <button onClick={() => { setResponding(null); setText('') }} className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setResponding(d.id); setText(d.resolution ?? '') }} className="mt-1 text-xs font-medium text-blue-600 hover:underline">Respond / add evidence</button>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
