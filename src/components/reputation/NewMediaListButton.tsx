'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, X } from 'lucide-react'
import { useToast } from './Toast'
import { createMediaList } from '@/app/app/reputation/actions'

const FIELD = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
const LABEL = 'mb-1 block text-[11px] font-medium text-slate-600'

export function NewMediaListButton() {
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
      const result = await createMediaList({
        name: String(form.get('name') ?? ''),
        description: String(form.get('description') ?? ''),
        beat: String(form.get('beat') ?? ''),
        region: String(form.get('region') ?? ''),
      })
      if (!result.ok) { setErrors(result.error ?? 'Could not create the list.'); return }
      notify('success', result.message ?? 'List created.')
      setOpen(false); setErrors(null)
      router.refresh()
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
        <Plus size={15} />New Media List
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
          <div className="fixed inset-0" onClick={() => setOpen(false)} aria-hidden />
          <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
            <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-3.5">
              <div><h2 className="text-[15px] font-semibold text-slate-900">New media list</h2><p className="text-xs text-slate-500">Group journalists by beat, region or campaign.</p></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={16} /></button>
            </header>
            <form onSubmit={submit} className="space-y-3 px-5 py-4">
              {errors && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{errors}</p>}
              <label className="block"><span className={LABEL}>List name <span className="text-red-500">*</span></span><input name="name" required maxLength={140} className={FIELD} placeholder="e.g. Tier 1 Tech & Business" /></label>
              <label className="block"><span className={LABEL}>Description</span><textarea name="description" rows={2} className={FIELD.replace('h-9', 'h-auto py-2')} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className={LABEL}>Beat</span><input name="beat" className={FIELD} /></label>
                <label className="block"><span className={LABEL}>Region</span><input name="region" className={FIELD} /></label>
              </div>
              <footer className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-slate-200 px-3.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                  {pending && <Loader2 size={14} className="animate-spin" />}Create list
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
