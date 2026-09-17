'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/campaigns/Toast'
import { createCreatorList } from '@/lib/creators/actions'
import { BUTTON_SECONDARY } from './design'
import { useCreatorsBase } from './controls'

/** Creates a creator list or campaign shortlist, then opens it filtered. */
export default function CreateListButton() {
  const router = useRouter()
  const base = useCreatorsBase()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', listType: 'list' })

  function close() { setOpen(false); setError(null); setForm({ name: '', description: '', listType: 'list' }) }

  function submit() {
    if (pending) return
    if (!form.name.trim()) { setError('Give the list a name.'); return }
    startTransition(async () => {
      const result = await createCreatorList(form)
      if (!result.ok) { setError(result.error ?? 'Could not create the list.'); return }
      notify('success', result.message ?? 'List created.')
      close()
      router.push(`${base}/creators?list=${result.id}`)
      router.refresh()
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={BUTTON_SECONDARY}>
        <Users size={16} aria-hidden />Create List
      </button>
      <Modal
        open={open} onClose={close}
        title="Create a creator list" description="Group creators for a campaign, a shortlist or a recurring roster. Add creators from the table's bulk actions."
        footer={(
          <div className="flex w-full justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={close}>Cancel</Button>
            <Button size="sm" loading={pending} onClick={submit}>Create list</Button>
          </div>
        )}
      >
        <form onSubmit={event => { event.preventDefault(); submit() }} className="space-y-3">
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <Input label="List name" required maxLength={80} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Summer skincare shortlist" />
          <Select
            label="Type" value={form.listType} onChange={e => setForm(f => ({ ...f, listType: e.target.value }))}
            options={[{ value: 'list', label: 'Creator list' }, { value: 'shortlist', label: 'Campaign shortlist' }, { value: 'featured', label: 'Featured creators' }]}
          />
          <Textarea label="Description (optional)" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </form>
      </Modal>
    </>
  )
}
