'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from './Toast'
import { createMediaContact } from '@/app/app/reputation/actions'

const FIELD = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
const LABEL = 'mb-1 block text-[11px] font-medium text-slate-600'

const RELATIONSHIP_STAGES = ['new', 'contacted', 'engaged', 'warm', 'champion', 'cold', 'do_not_contact']

export function NewMediaContactButton({ className }: { className?: string }) {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<string | null>(null)
  const firstField = useRef<HTMLInputElement>(null)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await createMediaContact({
        name: String(form.get('name') ?? ''),
        email: String(form.get('email') ?? ''),
        role_title: String(form.get('role_title') ?? ''),
        beat: String(form.get('beat') ?? ''),
        region: String(form.get('region') ?? ''),
        relationship_stage: String(form.get('relationship_stage') ?? 'new'),
      })
      if (!result.ok) { setErrors(result.error ?? 'Could not add the contact.'); return }
      notify('success', result.message ?? 'Contact added.')
      setOpen(false); setErrors(null)
      router.refresh()
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white shadow-sm hover:bg-blue-700', className)}>
        <Plus size={15} />New Media Contact
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
          <div className="fixed inset-0" onClick={() => setOpen(false)} aria-hidden />
          <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
            <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-3.5">
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900">New media contact</h2>
                <p className="text-xs text-slate-500">Add a journalist or media contact to your CRM.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={16} /></button>
            </header>
            <form onSubmit={submit} className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
              {errors && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{errors}</p>}
              <label className="block"><span className={LABEL}>Name <span className="text-red-500">*</span></span><input ref={firstField} name="name" required maxLength={140} className={FIELD} placeholder="e.g. Amara Chen" /></label>
              <label className="block"><span className={LABEL}>Email</span><input type="email" name="email" className={FIELD} placeholder="name@outlet.com" /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className={LABEL}>Role / title</span><input name="role_title" className={FIELD} placeholder="Senior Reporter" /></label>
                <label className="block"><span className={LABEL}>Beat</span><input name="beat" className={FIELD} placeholder="SaaS & Marketing Tech" /></label>
                <label className="block"><span className={LABEL}>Region</span><input name="region" className={FIELD} placeholder="UK" /></label>
                <label className="block"><span className={LABEL}>Relationship stage</span>
                  <select name="relationship_stage" defaultValue="new" className={FIELD}>
                    {RELATIONSHIP_STAGES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </label>
              </div>
              <footer className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-slate-200 px-3.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                  {pending && <Loader2 size={14} className="animate-spin" />}Add contact
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
