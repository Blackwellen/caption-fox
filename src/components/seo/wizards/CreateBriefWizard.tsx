'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { HeaderActionButton, type HeaderActionMenuItem } from '../HeaderActionButton'
import { WizardModal, FIELD, LABEL } from '../WizardModal'
import { createBrief } from '@/lib/seo/actions'

const CONTENT_TYPES = ['guide', 'how_to', 'checklist', 'listicle', 'comparison', 'landing_page', 'blog', 'case_study', 'faq']
const PRIORITIES = ['high', 'medium', 'low']

export function CreateBriefWizard({
  label = 'Create Brief', variant = 'button', menu,
}: { label?: string; variant?: 'button' | 'link'; menu?: HeaderActionMenuItem[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title') ?? '')
    const targetKeyword = String(form.get('target_keyword') ?? '')
    if (!title.trim()) { setError('Give the brief a title.'); return }
    if (!targetKeyword.trim()) { setError('Enter the target keyword.'); return }

    startTransition(async () => {
      const result = await createBrief({
        title,
        targetKeyword,
        contentType: String(form.get('content_type') ?? 'guide'),
        intent: String(form.get('intent') ?? 'informational'),
        priority: String(form.get('priority') ?? 'medium'),
        dueDate: String(form.get('due_date') ?? '') || undefined,
      })
      if (!result.ok) { setError(result.error ?? 'Could not create the brief.'); return }
      setError(null)
      setSuccess(result.message ?? 'Brief created.')
      router.refresh()
      if (result.id) {
        setTimeout(() => router.push(`/app/seo/briefs/${result.id}`), 700)
      } else {
        setTimeout(() => { setOpen(false); setSuccess(null) }, 900)
      }
    })
  }

  return (
    <>
      <HeaderActionButton label={label} onClick={() => setOpen(true)} variant={variant} menu={menu} />
      <WizardModal
        titleId="create-brief-title"
        title="Create content brief"
        open={open}
        onClose={() => { setOpen(false); setError(null); setSuccess(null) }}
        onSubmit={submit}
        error={error}
        pending={pending}
        submitLabel="Create brief"
      >
        {success ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">{success}</p>
        ) : (
          <>
            <label className="block">
              <span className={LABEL}>Brief title <span className="text-red-500">*</span></span>
              <input name="title" required maxLength={200} className={FIELD} placeholder="e.g. Ultimate Guide to Keyword Research" autoFocus />
            </label>

            <label className="block">
              <span className={LABEL}>Target keyword <span className="text-red-500">*</span></span>
              <input name="target_keyword" required maxLength={200} className={FIELD} placeholder="keyword research tools" />
              <span className="mt-1 block text-[11px] text-slate-400">Matched automatically to a tracked keyword if one exists.</span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={LABEL}>Content type</span>
                <select name="content_type" defaultValue="guide" className={FIELD}>
                  {CONTENT_TYPES.map(type => <option key={type} value={type}>{type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={LABEL}>Priority</span>
                <select name="priority" defaultValue="medium" className={FIELD}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
                </select>
              </label>
            </div>

            <label className="block">
              <span className={LABEL}>Due date</span>
              <input type="date" name="due_date" className={FIELD} />
            </label>
          </>
        )}
      </WizardModal>
    </>
  )
}
