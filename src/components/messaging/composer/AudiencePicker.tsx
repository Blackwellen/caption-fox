'use client'

import { useState, useTransition } from 'react'
import { Loader2, Plus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/campaigns/Toast'
import { createAudience } from '@/app/app/messaging/actions'
import { CHANNEL_LABELS, type MessagingChannel } from '@/lib/messaging/constants'
import type { AudienceRow } from '@/lib/messaging/types'

const FIELD = 'w-full rounded-lg border border-slate-200 px-3 text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'

export default function AudiencePicker({
  channel, audiences, value, onChange,
}: { channel: MessagingChannel; audiences: AudienceRow[]; value: string; onChange: (id: string) => void }) {
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [pasted, setPasted] = useState('')
  const [localAudiences, setLocalAudiences] = useState(audiences)

  const selected = localAudiences.find(a => a.id === value)
  const addressLabel = channel === 'email' ? 'email addresses' : 'phone numbers'

  function handleCreate() {
    startTransition(async () => {
      const res = await createAudience({ name, pastedContacts: pasted, channel })
      if (!res.ok || !res.id) { notify('error', res.error ?? 'Could not create audience.'); return }
      notify('success', res.message ?? 'Audience created.')
      setLocalAudiences(list => [{ id: res.id!, workspace_id: '', name, description: null, segment_type: 'static', filter_definition: {}, tags: [], contact_count: 0, owner_id: null, archived_at: null, created_at: '', updated_at: '' }, ...list])
      onChange(res.id)
      setCreating(false)
      setName(''); setPasted('')
    })
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Users size={14} /></span>
        <h3 className="text-[13px] font-semibold text-slate-900">Audience</h3>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-medium text-slate-500">Segment</label>
        <select className={cn(FIELD, 'h-9')} value={value} onChange={e => onChange(e.target.value)}>
          <option value="">Select audience</option>
          {localAudiences.map(a => <option key={a.id} value={a.id}>{a.name} ({a.contact_count})</option>)}
        </select>
      </div>

      {selected && (
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
          <p><span className="font-medium text-slate-900">{selected.contact_count}</span> contacts</p>
          {selected.description && <p className="mt-0.5 text-slate-500">{selected.description}</p>}
        </div>
      )}

      {!creating ? (
        <button
          type="button" onClick={() => setCreating(true)}
          className="inline-flex h-8 items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:text-blue-700"
        >
          <Plus size={13} />
          Create audience from a pasted list
        </button>
      ) : (
        <div className="space-y-2 rounded-lg border border-dashed border-slate-200 p-3">
          <input className={cn(FIELD, 'h-9')} value={name} onChange={e => setName(e.target.value)} placeholder="Audience name" />
          <textarea
            className={cn(FIELD, 'min-h-[90px] resize-y py-2')} value={pasted} onChange={e => setPasted(e.target.value)}
            placeholder={`Paste ${addressLabel}, one per line or comma-separated`}
          />
          <p className="text-[11px] text-slate-400">
            Consent for {CHANNEL_LABELS[channel]} is recorded as given by whoever pastes this list — confirm real opt-in before sending to it.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button" onClick={handleCreate} disabled={pending || !name || !pasted}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[12px] font-medium text-white disabled:opacity-50"
            >
              {pending && <Loader2 size={12} className="animate-spin" />}
              Create audience
            </button>
            <button type="button" onClick={() => setCreating(false)} className="text-[12px] font-medium text-slate-500 hover:text-slate-700">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
