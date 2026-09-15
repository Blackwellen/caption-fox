'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { HeaderActionButton } from '../HeaderActionButton'
import { WizardModal, FIELD, LABEL, TEXTAREA } from '../WizardModal'
import { createOutreachList } from '@/lib/seo/actions'

export function AddOutreachListWizard() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '')
    if (!name.trim()) { setError('Give the outreach list a name.'); return }

    startTransition(async () => {
      const result = await createOutreachList({
        name,
        description: String(form.get('description') ?? '') || undefined,
      })
      if (!result.ok) { setError(result.error ?? 'Could not create the outreach list.'); return }
      setError(null)
      setSuccess(result.message ?? 'Outreach list created.')
      router.refresh()
      setTimeout(() => { setOpen(false); setSuccess(null) }, 900)
    })
  }

  return (
    <>
      <HeaderActionButton label="Add Outreach List" onClick={() => setOpen(true)} />
      <WizardModal
        titleId="add-outreach-list-title"
        title="Create outreach list"
        open={open}
        onClose={() => { setOpen(false); setError(null); setSuccess(null) }}
        onSubmit={submit}
        error={error}
        pending={pending}
        submitLabel="Create list"
      >
        {success ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">{success}</p>
        ) : (
          <>
            <label className="block">
              <span className={LABEL}>List name <span className="text-red-500">*</span></span>
              <input name="name" required maxLength={120} className={FIELD} placeholder="e.g. Q3 link building targets" autoFocus />
            </label>
            <label className="block">
              <span className={LABEL}>Description</span>
              <textarea name="description" rows={3} maxLength={500} className={TEXTAREA} />
            </label>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
              Add link opportunities to this list from the Opportunities view once it is created.
            </p>
          </>
        )}
      </WizardModal>
    </>
  )
}
