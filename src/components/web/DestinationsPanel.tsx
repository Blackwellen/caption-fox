'use client'

import { useState, useTransition } from 'react'
import { Plug, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/campaigns/Toast'
import { connectDestination, disconnectDestination } from '@/app/app/web/actions'
import { Badge } from '@/components/ui/Badge'
import { DESTINATION_STATUS_BADGE, DESTINATION_STATUS_LABELS, TRACKING_DESTINATION_PROVIDERS, TRACKING_DESTINATION_LABELS } from '@/lib/web/constants'
import type { TrackingDestinationProvider } from '@/lib/web/constants'
import type { TrackingDestinationRow } from '@/lib/web/types'

export default function DestinationsPanel({ destinations, canManage }: { destinations: TrackingDestinationRow[]; canManage: boolean }) {
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [provider, setProvider] = useState<TrackingDestinationProvider>('ga4')
  const [name, setName] = useState('')

  function connect(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await connectDestination({ provider, name: name || TRACKING_DESTINATION_LABELS[provider] })
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Destination added.') : (result.error ?? 'Could not add destination.'))
      if (result.ok) { setAdding(false); setName('') }
    })
  }

  function disconnect(id: string, label: string) {
    if (!confirm(`Disconnect ${label}? Events will stop being forwarded there.`)) return
    startTransition(async () => {
      const result = await disconnectDestination(id)
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Disconnected.') : (result.error ?? 'Could not disconnect.'))
    })
  }

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {destinations.map(d => (
          <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium text-slate-900">{d.name}</p>
              <Badge variant={DESTINATION_STATUS_BADGE[d.status]}>{DESTINATION_STATUS_LABELS[d.status]}</Badge>
            </div>
            {canManage && (
              <button type="button" disabled={pending} onClick={() => disconnect(d.id, d.name)} className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      {canManage && (
        <div className="mt-3">
          {!adding ? (
            <button type="button" onClick={() => setAdding(true)} className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-50')}>
              <Plug size={13} /> Connect destination
            </button>
          ) : (
            <form onSubmit={connect} className="flex flex-wrap items-end gap-2">
              <label>
                <span className="mb-1 block text-[11px] font-medium text-slate-500">Provider</span>
                <select value={provider} onChange={e => setProvider(e.target.value as TrackingDestinationProvider)} className="h-8 rounded-lg border border-slate-200 px-2 text-[12px]">
                  {TRACKING_DESTINATION_PROVIDERS.map(p => <option key={p} value={p}>{TRACKING_DESTINATION_LABELS[p]}</option>)}
                </select>
              </label>
              <label className="min-w-[160px]">
                <span className="mb-1 block text-[11px] font-medium text-slate-500">Name (optional)</span>
                <input value={name} onChange={e => setName(e.target.value)} placeholder={TRACKING_DESTINATION_LABELS[provider]} className="h-8 w-full rounded-lg border border-slate-200 px-2 text-[12px]" />
              </label>
              <button type="submit" disabled={pending} className="inline-flex h-8 items-center rounded-lg bg-blue-600 px-3 text-[12px] font-medium text-white hover:bg-blue-700 disabled:opacity-50">Add</button>
              <button type="button" onClick={() => setAdding(false)} className="inline-flex h-8 items-center px-2 text-[12px] text-slate-500 hover:text-slate-700">Cancel</button>
            </form>
          )}
          <p className="mt-2 text-[11px] text-slate-400">
            Caption Fox records the destination here — you connect it with your own provider credentials directly with that provider. We don't set up third-party accounts on your behalf.
          </p>
        </div>
      )}
    </div>
  )
}
