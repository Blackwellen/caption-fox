'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Globe2, Plus, X } from 'lucide-react'
import { assignTerritory, unassignTerritory } from '@/app/app/partnerships/actions'
import { useToast } from '@/components/campaigns/Toast'
import { PartnershipsEmpty } from './states'
import type { PartnerRow, TerritoryRow } from '@/lib/partnerships/types'

export default function TerritoriesPanel({
  programmeId, territories, partners, canManage,
}: { programmeId: string; territories: TerritoryRow[]; partners: PartnerRow[]; canManage: boolean }) {
  const [region, setRegion] = useState('')
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? '')
  const [exclusive, setExclusive] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { notify } = useToast()

  function submit() {
    setError(null)
    if (!partnerId) { setError('Add a reseller partner first.'); return }
    startTransition(async () => {
      const result = await assignTerritory({ programme_id: programmeId, partner_id: partnerId, region, exclusive })
      if (!result.ok) { setError(result.error ?? 'Could not assign the territory.'); return }
      notify('success', result.message ?? 'Territory assigned.')
      setRegion('')
      router.refresh()
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await unassignTerritory(id)
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Removed.') : (result.error ?? 'Could not remove.'))
      if (result.ok) router.refresh()
    })
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_0_rgb(15_23_42/0.04)]">
      <h2 className="mb-2 text-[13px] font-semibold text-slate-900">Territories</h2>

      {canManage && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            value={region} onChange={e => setRegion(e.target.value)} placeholder="Region, e.g. North America"
            className="h-9 min-w-[180px] flex-1 rounded-lg border border-slate-200 px-2.5 text-[13px] text-slate-700"
          />
          <select value={partnerId} onChange={e => setPartnerId(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2.5 text-[13px] text-slate-700">
            {partners.length === 0 && <option value="">No resellers yet</option>}
            {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-[12px] text-slate-600">
            <input type="checkbox" checked={exclusive} onChange={e => setExclusive(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600" />
            Exclusive
          </label>
          <button
            type="button" onClick={submit} disabled={pending || !region.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={14} />
            Assign
          </button>
        </div>
      )}
      {error && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}

      {territories.length === 0 ? (
        <PartnershipsEmpty bare icon="search" title="No territories assigned" message="Assign a region to a reseller to prevent overlapping coverage." />
      ) : (
        <ul className="flex flex-wrap gap-2">
          {territories.map(t => (
            <li key={t.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px]">
              <Globe2 size={12} className="text-blue-500" />
              <span className="font-medium text-slate-800">{t.region}</span>
              {t.exclusive && <span className="text-amber-600">exclusive</span>}
              <span className="text-slate-400">· {t.partner?.name ?? 'Unassigned'}</span>
              {canManage && (
                <button type="button" onClick={() => remove(t.id)} disabled={pending} aria-label={`Remove ${t.region}`} className="text-slate-400 hover:text-red-600 disabled:opacity-50">
                  <X size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
