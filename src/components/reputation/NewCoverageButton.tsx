'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, X } from 'lucide-react'
import { useToast } from './Toast'
import { createCoverageMention } from '@/app/app/reputation/actions'

const FIELD = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
const LABEL = 'mb-1 block text-[11px] font-medium text-slate-600'

export function NewCoverageButton() {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<string | null>(null)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    const reach = Number(form.get('estimated_reach'))
    startTransition(async () => {
      const result = await createCoverageMention({
        publication: String(form.get('publication') ?? ''),
        headline: String(form.get('headline') ?? ''),
        url: String(form.get('url') ?? ''),
        topic: String(form.get('topic') ?? ''),
        sentiment: (String(form.get('sentiment') ?? 'neutral')) as 'positive' | 'neutral' | 'negative' | 'mixed',
        estimated_reach: Number.isFinite(reach) && reach > 0 ? reach : undefined,
      })
      if (!result.ok) { setErrors(result.error ?? 'Could not track this mention.'); return }
      notify('success', result.message ?? 'Coverage tracked.')
      setOpen(false); setErrors(null)
      router.refresh()
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white shadow-sm hover:bg-blue-700">
        <Plus size={15} />Track Mention
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
          <div className="fixed inset-0" onClick={() => setOpen(false)} aria-hidden />
          <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
            <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-3.5">
              <div><h2 className="text-[15px] font-semibold text-slate-900">Track coverage</h2><p className="text-xs text-slate-500">Log an earned media mention manually.</p></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={16} /></button>
            </header>
            <form onSubmit={submit} className="space-y-3 px-5 py-4">
              {errors && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{errors}</p>}
              <label className="block"><span className={LABEL}>Publication <span className="text-red-500">*</span></span><input name="publication" required className={FIELD} placeholder="e.g. TechCrunch" /></label>
              <label className="block"><span className={LABEL}>Headline <span className="text-red-500">*</span></span><input name="headline" required className={FIELD} /></label>
              <label className="block"><span className={LABEL}>URL</span><input type="url" name="url" className={FIELD} placeholder="https://" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className={LABEL}>Topic</span><input name="topic" className={FIELD} /></label>
                <label className="block"><span className={LABEL}>Sentiment</span>
                  <select name="sentiment" defaultValue="neutral" className={FIELD}>
                    <option value="positive">Positive</option><option value="neutral">Neutral</option>
                    <option value="negative">Negative</option><option value="mixed">Mixed</option>
                  </select>
                </label>
                <label className="block col-span-2"><span className={LABEL}>Estimated reach</span><input type="number" name="estimated_reach" min="0" className={FIELD} placeholder="e.g. 50000" /></label>
              </div>
              <footer className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-slate-200 px-3.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                  {pending && <Loader2 size={14} className="animate-spin" />}Track
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
