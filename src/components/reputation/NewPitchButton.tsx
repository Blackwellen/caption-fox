'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Sparkles, X } from 'lucide-react'
import { useToast } from './Toast'
import { aiSuggestPitchAngles, createPitch } from '@/app/app/reputation/actions'

const FIELD = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
const LABEL = 'mb-1 block text-[11px] font-medium text-slate-600'

export function NewPitchButton({ lists }: { lists: { id: string; name: string }[] }) {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<string | null>(null)
  const [angles, setAngles] = useState<string | null>(null)
  const [aiPending, startAiTransition] = useTransition()

  function suggestAngles(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    const form = event.currentTarget.closest('form')
    const name = (form?.elements.namedItem('name') as HTMLInputElement | null)?.value ?? ''
    if (!name.trim()) { notify('error', 'Enter a pitch name/topic first.'); return }
    startAiTransition(async () => {
      const result = await aiSuggestPitchAngles(name)
      if (!result.ok) { notify('error', result.error ?? 'AI request failed.'); return }
      setAngles(result.text ?? null)
    })
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await createPitch({
        name: String(form.get('name') ?? ''),
        subject: String(form.get('subject') ?? ''),
        body: String(form.get('body') ?? ''),
        list_id: String(form.get('list_id') ?? '') || undefined,
      })
      if (!result.ok) { setErrors(result.error ?? 'Could not create the pitch.'); return }
      notify('success', result.message ?? 'Pitch created.')
      setOpen(false); setErrors(null)
      router.refresh()
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white shadow-sm hover:bg-blue-700">
        <Plus size={15} />New Pitch
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
          <div className="fixed inset-0" onClick={() => setOpen(false)} aria-hidden />
          <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl">
            <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-3.5">
              <div><h2 className="text-[15px] font-semibold text-slate-900">New pitch</h2><p className="text-xs text-slate-500">Draft a pitch and target it against a media list.</p></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={16} /></button>
            </header>
            <form onSubmit={submit} className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
              {errors && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{errors}</p>}
              <label className="block"><span className={LABEL}>Pitch name <span className="text-red-500">*</span></span><input name="name" required maxLength={140} className={FIELD} placeholder="e.g. Q3 Product Launch Pitch" /></label>
              <div>
                <button type="button" disabled={aiPending} onClick={suggestAngles} className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                  {aiPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}Suggest angles from name
                </button>
                {angles && <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700">{angles}</pre>}
              </div>
              <label className="block"><span className={LABEL}>Target media list</span>
                <select name="list_id" className={FIELD} defaultValue="">
                  <option value="">No list — add recipients later</option>
                  {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </label>
              <label className="block"><span className={LABEL}>Subject <span className="text-red-500">*</span></span><input name="subject" required maxLength={200} className={FIELD} placeholder="Email subject line" /></label>
              <label className="block"><span className={LABEL}>Body</span><textarea name="body" rows={5} className={FIELD.replace('h-9', 'h-auto py-2')} placeholder="Hi {{first_name}}, ..." /></label>
              <footer className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-slate-200 px-3.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                  {pending && <Loader2 size={14} className="animate-spin" />}Save draft
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
