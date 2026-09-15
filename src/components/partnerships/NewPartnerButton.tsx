'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/campaigns/Toast'
import { createPartner } from '@/app/app/partnerships/actions'
import type { PersonLite, ProgrammeRow } from '@/lib/partnerships/types'

const FIELD = 'h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
const LABEL = 'mb-1 block text-[11px] font-medium text-slate-600'

export default function NewPartnerButton({
  programmes, members, partnerType, label,
}: { programmes: ProgrammeRow[]; members: PersonLite[]; partnerType: string; label: string }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { notify } = useToast()

  const [name, setName] = useState('')
  const [programmeId, setProgrammeId] = useState(programmes[0]?.id ?? '')
  const [email, setEmail] = useState('')
  const [handle, setHandle] = useState('')
  const [owner, setOwner] = useState('')

  function submit() {
    setError(null)
    if (!programmeId) { setError('Create a programme first — a partner must belong to one.'); return }
    startTransition(async () => {
      const result = await createPartner({
        programme_id: programmeId, partner_type: partnerType, name,
        email: email || undefined, handle: handle || undefined, owner_id: owner || undefined, status: 'active',
      })
      if (!result.ok) { setError(result.error ?? 'Could not add the partner.'); return }
      notify('success', result.message ?? 'Partner added.')
      setOpen(false)
      setName(''); setEmail(''); setHandle('')
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
      >
        <Plus size={14} />
        {label}
      </button>

      <Modal
        open={open} onClose={() => setOpen(false)} title={label}
        description="Add a partner directly, or review applications instead if they should go through approval."
        footer={
          <>
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Cancel</button>
            <button
              onClick={submit} disabled={pending || !name.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? 'Adding…' : 'Add partner'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
          <label className="block">
            <span className={LABEL}>Name <span className="text-red-500">*</span></span>
            <input value={name} onChange={e => setName(e.target.value)} className={FIELD} maxLength={140} />
          </label>
          <label className="block">
            <span className={LABEL}>Programme <span className="text-red-500">*</span></span>
            <select value={programmeId} onChange={e => setProgrammeId(e.target.value)} className={FIELD}>
              {programmes.length === 0 && <option value="">No programmes yet</option>}
              {programmes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={LABEL}>Handle / username</span>
              <input value={handle} onChange={e => setHandle(e.target.value)} className={FIELD} placeholder="@handle" />
            </label>
            <label className="block">
              <span className={LABEL}>Email</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={FIELD} />
            </label>
          </div>
          <label className="block">
            <span className={LABEL}>Owner</span>
            <select value={owner} onChange={e => setOwner(e.target.value)} className={FIELD}>
              <option value="">Assign to me</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.full_name ?? m.email}</option>)}
            </select>
          </label>
        </div>
      </Modal>
    </>
  )
}
