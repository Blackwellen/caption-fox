'use client'

import { useState, useTransition } from 'react'
import { useCreatorsBase } from './controls'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/campaigns/Toast'
import { createCreator } from '@/lib/creators/actions'
import { CREATOR_NICHES, CREATOR_REGIONS, NICHE_LABELS } from '@/lib/creators/constants'

export default function CreateCreatorButton({ label = 'Add Creator', className }: { label?: string; className?: string }) {
  const router = useRouter()
  const base = useCreatorsBase()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', email: '', handle: '', niche: '', region: '',
    audience_size: '', engagement_rate: '', avg_rate: '', bio: '',
  })

  function reset() { setForm({ name: '', email: '', handle: '', niche: '', region: '', audience_size: '', engagement_rate: '', avg_rate: '', bio: '' }); setError(null) }

  function submit() {
    if (pending) return
    if (!form.name.trim()) { setError('Creator name is required.'); return }
    startTransition(async () => {
      const result = await createCreator(form)
      if (!result.ok) { setError(result.error ?? 'Could not add the creator.'); return }
      notify('success', result.message ?? 'Creator added.')
      setOpen(false); reset(); router.refresh()
      if (result.id) router.push(`${base}/creators/${result.id}`)
    })
  }

  return (
    <>
      <Button variant="secondary" size="sm" icon={<Plus size={15} />} onClick={() => setOpen(true)} className={className}>
        {label}
      </Button>
      <Modal
        open={open} onClose={() => { setOpen(false); reset() }} size="lg"
        title="Add a creator" description="Manually record a creator you already know or have sourced elsewhere."
        footer={(
          <div className="flex w-full justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setOpen(false); reset() }}>Cancel</Button>
            <Button size="sm" loading={pending} onClick={submit}>Add creator</Button>
          </div>
        )}
      >
        <form onSubmit={event => { event.preventDefault(); submit() }} className="space-y-3">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="Handle" value={form.handle} onChange={e => setForm(f => ({ ...f, handle: e.target.value }))} placeholder="@handle" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Select
              label="Niche" value={form.niche} onChange={e => setForm(f => ({ ...f, niche: e.target.value }))}
              options={[{ value: '', label: 'Select a niche' }, ...CREATOR_NICHES.map(n => ({ value: n, label: NICHE_LABELS[n] }))]}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Select
              label="Region" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
              options={[{ value: '', label: 'Select' }, ...CREATOR_REGIONS.map(r => ({ value: r, label: r }))]}
            />
            <Input label="Audience size" type="number" min={0} value={form.audience_size} onChange={e => setForm(f => ({ ...f, audience_size: e.target.value }))} />
            <Input label="Engagement %" type="number" min={0} step={0.1} value={form.engagement_rate} onChange={e => setForm(f => ({ ...f, engagement_rate: e.target.value }))} />
          </div>
          <Input label="Average rate (GBP)" type="number" min={0} value={form.avg_rate} onChange={e => setForm(f => ({ ...f, avg_rate: e.target.value }))} />
          <Textarea label="Bio (optional)" rows={2} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
        </form>
      </Modal>
    </>
  )
}
