'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { HeaderActionButton } from '../HeaderActionButton'
import { WizardModal, FIELD, LABEL } from '../WizardModal'
import { addLocation } from '@/lib/seo/actions'

export function AddLocationWizard() {
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
    const addressLine = String(form.get('address_line') ?? '')
    if (!name.trim()) { setError('Give the location a name.'); return }
    if (!addressLine.trim()) { setError('Enter an address for this location.'); return }

    startTransition(async () => {
      const result = await addLocation({
        name,
        addressLine,
        city: String(form.get('city') ?? '') || undefined,
        region: String(form.get('region') ?? '') || undefined,
        postcode: String(form.get('postcode') ?? '') || undefined,
        country: 'gb',
        phone: String(form.get('phone') ?? '') || undefined,
        website: String(form.get('website') ?? '') || undefined,
        primaryCategory: String(form.get('primary_category') ?? '') || undefined,
      })
      if (!result.ok) { setError(result.error ?? 'Could not add the location.'); return }
      setError(null)
      setSuccess(result.message ?? 'Location added.')
      router.refresh()
      setTimeout(() => { setOpen(false); setSuccess(null) }, 900)
    })
  }

  return (
    <>
      <HeaderActionButton label="Add Location" onClick={() => setOpen(true)} />
      <WizardModal
        titleId="add-location-title"
        title="Add location"
        open={open}
        onClose={() => { setOpen(false); setError(null); setSuccess(null) }}
        onSubmit={submit}
        error={error}
        pending={pending}
        submitLabel="Add location"
      >
        {success ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">{success}</p>
        ) : (
          <>
            <label className="block">
              <span className={LABEL}>Location name <span className="text-red-500">*</span></span>
              <input name="name" required maxLength={160} className={FIELD} placeholder="e.g. Caption Fox — Shoreditch" autoFocus />
            </label>
            <label className="block">
              <span className={LABEL}>Address <span className="text-red-500">*</span></span>
              <input name="address_line" required maxLength={200} className={FIELD} placeholder="42 Rivington Street" />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className={LABEL}>City</span>
                <input name="city" maxLength={80} className={FIELD} />
              </label>
              <label className="block">
                <span className={LABEL}>Region</span>
                <input name="region" maxLength={80} className={FIELD} />
              </label>
              <label className="block">
                <span className={LABEL}>Postcode</span>
                <input name="postcode" maxLength={20} className={FIELD} />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={LABEL}>Phone</span>
                <input name="phone" maxLength={40} className={FIELD} />
              </label>
              <label className="block">
                <span className={LABEL}>Website</span>
                <input name="website" maxLength={200} className={FIELD} placeholder="https://" />
              </label>
            </div>
            <label className="block">
              <span className={LABEL}>Primary category</span>
              <input name="primary_category" maxLength={100} className={FIELD} placeholder="Software company" />
            </label>
          </>
        )}
      </WizardModal>
    </>
  )
}
