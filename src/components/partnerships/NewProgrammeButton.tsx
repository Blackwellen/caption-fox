'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/campaigns/Toast'
import { createProgramme } from '@/app/app/partnerships/actions'
import { PROGRAMME_TYPE_LABELS, PROGRAMME_TYPES, type ProgrammeType } from '@/lib/partnerships/constants'
import type { PersonLite } from '@/lib/partnerships/types'

const FIELD = 'h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
const LABEL = 'mb-1 block text-[11px] font-medium text-slate-600'

export default function NewProgrammeButton({
  members, defaultType, label = 'Create programme',
}: { members: PersonLite[]; defaultType?: ProgrammeType; label?: string }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { notify } = useToast()

  const [name, setName] = useState('')
  const [type, setType] = useState<ProgrammeType>(defaultType ?? 'affiliate')
  const [owner, setOwner] = useState('')
  const [rate, setRate] = useState('10')
  const [description, setDescription] = useState('')

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await createProgramme({
        name, programme_type: type, owner_id: owner || undefined,
        commission_rate: rate, description: description || undefined, status: 'active',
      })
      if (!result.ok) { setError(result.error ?? 'Could not create the programme.'); return }
      notify('success', result.message ?? 'Programme created.')
      setOpen(false)
      setName(''); setDescription('')
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
      >
        <Plus size={14} />
        {label}
      </button>

      <Modal
        open={open} onClose={() => setOpen(false)} title="Create programme"
        description="Set up a new partnership programme. It starts active and can be paused or archived at any time."
        footer={
          <>
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Cancel</button>
            <button
              onClick={submit} disabled={pending || !name.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? 'Creating…' : 'Create programme'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
          <label className="block">
            <span className={LABEL}>Programme name <span className="text-red-500">*</span></span>
            <input value={name} onChange={e => setName(e.target.value)} className={FIELD} placeholder="e.g. Creator Affiliate Program" maxLength={140} />
          </label>
          <label className="block">
            <span className={LABEL}>Programme type <span className="text-red-500">*</span></span>
            <select value={type} onChange={e => setType(e.target.value as ProgrammeType)} className={FIELD} disabled={Boolean(defaultType)}>
              {PROGRAMME_TYPES.map(t => <option key={t} value={t}>{PROGRAMME_TYPE_LABELS[t]}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={LABEL}>Owner</span>
              <select value={owner} onChange={e => setOwner(e.target.value)} className={FIELD}>
                <option value="">Assign to me</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name ?? m.email}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={LABEL}>Commission rate (%)</span>
              <input type="number" min={0} max={100} step={0.5} value={rate} onChange={e => setRate(e.target.value)} className={FIELD} />
            </label>
          </div>
          <label className="block">
            <span className={LABEL}>Description</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={`${FIELD} h-auto py-2`} maxLength={500} />
          </label>
        </div>
      </Modal>
    </>
  )
}
