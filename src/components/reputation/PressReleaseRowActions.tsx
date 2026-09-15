'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, X } from 'lucide-react'
import { useToast } from './Toast'
import { setPressReleaseStatus, updatePressReleaseContent } from '@/app/app/reputation/actions'

interface Props {
  id: string
  title: string
  subtitle: string | null
  body: string
  category: string | null
  status: string
  canPublish: boolean
}

const BTN = 'inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50'
const FIELD = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
const LABEL = 'mb-1 block text-[11px] font-medium text-slate-600'

export function PressReleaseRowActions({ id, title, subtitle, body, category, status, canPublish }: Props) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)

  function run(next: 'in_review' | 'published') {
    if (pending) return
    startTransition(async () => {
      const result = await setPressReleaseStatus(id, next)
      if (!result.ok) { notify('error', result.error ?? 'Action failed.'); return }
      notify('success', result.message ?? 'Updated.')
      router.refresh()
    })
  }

  function submitEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await updatePressReleaseContent(id, {
        title: String(form.get('title') ?? ''), subtitle: String(form.get('subtitle') ?? ''),
        body: String(form.get('body') ?? ''), category: String(form.get('category') ?? ''),
      })
      if (!result.ok) { notify('error', result.error ?? 'Could not save changes.'); return }
      notify('success', 'Press release updated.')
      setEditOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      {pending && <Loader2 size={13} className="animate-spin text-slate-400" />}
      {status !== 'published' && <button type="button" disabled={pending} className={BTN} onClick={() => setEditOpen(true)}><Pencil size={12} />Edit</button>}
      {status === 'draft' && <button type="button" disabled={pending} className={BTN} onClick={() => run('in_review')}>Send for review</button>}
      {status === 'in_review' && canPublish && <button type="button" disabled={pending} className={BTN} onClick={() => run('published')}>Publish</button>}

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
          <div className="fixed inset-0" onClick={() => setEditOpen(false)} aria-hidden />
          <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl">
            <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-3.5">
              <h2 className="text-[15px] font-semibold text-slate-900">Edit press release</h2>
              <button type="button" onClick={() => setEditOpen(false)} aria-label="Close" className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={16} /></button>
            </header>
            <form onSubmit={submitEdit} className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
              <label className="block"><span className={LABEL}>Title</span><input name="title" defaultValue={title} required maxLength={200} className={FIELD} /></label>
              <label className="block"><span className={LABEL}>Subtitle</span><input name="subtitle" defaultValue={subtitle ?? ''} maxLength={300} className={FIELD} /></label>
              <label className="block"><span className={LABEL}>Category</span><input name="category" defaultValue={category ?? ''} className={FIELD} /></label>
              <label className="block"><span className={LABEL}>Body</span><textarea name="body" defaultValue={body} rows={6} className={FIELD.replace('h-9', 'h-auto py-2')} /></label>
              <footer className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setEditOpen(false)} className="h-9 rounded-lg border border-slate-200 px-3.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                  {pending && <Loader2 size={14} className="animate-spin" />}Save changes
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
