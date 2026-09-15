'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, X } from 'lucide-react'
import { useToast } from './Toast'
import { createCrisisIncident } from '@/app/app/reputation/actions'

const FIELD = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
const LABEL = 'mb-1 block text-[11px] font-medium text-slate-600'
const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info']

export function NewCrisisIncidentButton() {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<string | null>(null)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await createCrisisIncident({
        title: String(form.get('title') ?? ''),
        description: String(form.get('description') ?? ''),
        severity: String(form.get('severity') ?? 'medium'),
        region: String(form.get('region') ?? ''),
      })
      if (!result.ok) { setErrors(result.error ?? 'Could not log the incident.'); return }
      notify('success', result.message ?? 'Incident logged.')
      setOpen(false); setErrors(null)
      router.refresh()
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white shadow-sm hover:bg-blue-700">
        <Plus size={15} />New Incident
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
          <div className="fixed inset-0" onClick={() => setOpen(false)} aria-hidden />
          <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
            <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-3.5">
              <div><h2 className="text-[15px] font-semibold text-slate-900">Log a reputation incident</h2><p className="text-xs text-slate-500">Start crisis response tracking.</p></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={16} /></button>
            </header>
            <form onSubmit={submit} className="space-y-3 px-5 py-4">
              {errors && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{errors}</p>}
              <label className="block"><span className={LABEL}>Title <span className="text-red-500">*</span></span><input name="title" required maxLength={200} className={FIELD} /></label>
              <label className="block"><span className={LABEL}>Description</span><textarea name="description" rows={3} className={FIELD.replace('h-9', 'h-auto py-2')} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className={LABEL}>Severity</span>
                  <select name="severity" defaultValue="medium" className={FIELD}>
                    {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className="block"><span className={LABEL}>Region</span><input name="region" className={FIELD} /></label>
              </div>
              <footer className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-slate-200 px-3.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                  {pending && <Loader2 size={14} className="animate-spin" />}Log incident
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
