'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { HeaderActionButton, type HeaderActionMenuItem } from '../HeaderActionButton'
import { WizardModal, FIELD, LABEL, TEXTAREA } from '../WizardModal'
import { addKeywords } from '@/lib/seo/actions'

const INTENTS = [
  { value: 'informational', label: 'Informational' },
  { value: 'transactional', label: 'Transactional' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'navigational', label: 'Navigational' },
]

export function AddKeywordsWizard({
  clusters, label = 'Add Keywords', menu,
}: { clusters: { id: string; name: string }[]; label?: string; menu?: HeaderActionMenuItem[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    const keywords = String(form.get('keywords') ?? '')
    if (!keywords.trim()) { setError('Enter at least one keyword.'); return }

    startTransition(async () => {
      const result = await addKeywords({
        keywords,
        intent: String(form.get('intent') ?? 'informational'),
        clusterId: String(form.get('cluster_id') ?? '') || undefined,
        newClusterName: String(form.get('new_cluster') ?? '') || undefined,
        country: 'gb',
        device: 'desktop',
        searchEngine: 'google',
        landingPage: String(form.get('landing_page') ?? '') || undefined,
      })
      if (!result.ok) { setError(result.error ?? 'Could not add keywords.'); return }
      setError(null)
      setSuccess(result.message ?? 'Keywords added.')
      router.refresh()
      setTimeout(() => { setOpen(false); setSuccess(null) }, 900)
    })
  }

  return (
    <>
      <HeaderActionButton label={label} onClick={() => setOpen(true)} menu={menu} />
      <WizardModal
        titleId="add-keywords-title"
        title="Add keywords"
        open={open}
        onClose={() => { setOpen(false); setError(null); setSuccess(null) }}
        onSubmit={submit}
        error={error}
        pending={pending}
        submitLabel="Add keywords"
      >
        {success ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">{success}</p>
        ) : (
          <>
            <label className="block">
              <span className={LABEL}>Keywords <span className="text-red-500">*</span></span>
              <textarea name="keywords" rows={4} required maxLength={4000} className={TEXTAREA} placeholder={'One keyword per line, e.g.\nai content generator\ncaption generator online'} autoFocus />
              <span className="mt-1 block text-[11px] text-slate-400">One per line or comma-separated. Duplicates already tracked are skipped automatically.</span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={LABEL}>Search intent</span>
                <select name="intent" defaultValue="informational" className={FIELD}>
                  {INTENTS.map(intent => <option key={intent.value} value={intent.value}>{intent.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={LABEL}>Cluster</span>
                <select name="cluster_id" defaultValue="" className={FIELD}>
                  <option value="">No cluster</option>
                  {clusters.map(cluster => <option key={cluster.id} value={cluster.id}>{cluster.name}</option>)}
                </select>
              </label>
            </div>

            <label className="block">
              <span className={LABEL}>Or create a new cluster</span>
              <input name="new_cluster" maxLength={80} className={FIELD} placeholder="e.g. Video Captioning" />
            </label>

            <label className="block">
              <span className={LABEL}>Landing page (optional)</span>
              <input name="landing_page" maxLength={300} className={FIELD} placeholder="/caption-generator" />
            </label>
          </>
        )}
      </WizardModal>
    </>
  )
}
