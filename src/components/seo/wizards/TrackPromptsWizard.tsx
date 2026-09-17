'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { HeaderActionButton, type HeaderActionMenuItem } from '../HeaderActionButton'
import { WizardModal, FIELD, LABEL, TEXTAREA } from '../WizardModal'
import { trackPrompt } from '@/lib/seo/actions'

const ENGINES = [
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'perplexity', label: 'Perplexity' },
  { value: 'google_sge', label: 'Google AI Overviews' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude' },
  { value: 'bing_copilot', label: 'Bing Copilot' },
]

export function TrackPromptsWizard({ menu }: { menu?: HeaderActionMenuItem[] } = {}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    const prompt = String(form.get('prompt') ?? '')
    if (!prompt.trim()) { setError('Enter a prompt to track.'); return }

    startTransition(async () => {
      const result = await trackPrompt({
        prompt,
        engine: String(form.get('engine') ?? 'chatgpt'),
        region: 'gb',
        frequency: String(form.get('frequency') ?? 'weekly'),
        linkedPage: String(form.get('linked_page') ?? '') || undefined,
      })
      if (!result.ok) { setError(result.error ?? 'Could not track the prompt.'); return }
      setError(null)
      setSuccess(result.message ?? 'Prompt tracked.')
      router.refresh()
      setTimeout(() => { setOpen(false); setSuccess(null) }, 1100)
    })
  }

  return (
    <>
      <HeaderActionButton label="Track Prompts" onClick={() => setOpen(true)} menu={menu} />
      <WizardModal
        titleId="track-prompts-title"
        title="Track an AI search prompt"
        open={open}
        onClose={() => { setOpen(false); setError(null); setSuccess(null) }}
        onSubmit={submit}
        error={error}
        pending={pending}
        submitLabel="Track prompt"
      >
        {success ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">{success}</p>
        ) : (
          <>
            <label className="block">
              <span className={LABEL}>Prompt <span className="text-red-500">*</span></span>
              <textarea name="prompt" rows={2} required maxLength={300} className={TEXTAREA} placeholder="e.g. best AI caption generator for social media" autoFocus />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={LABEL}>Answer engine</span>
                <select name="engine" defaultValue="chatgpt" className={FIELD}>
                  {ENGINES.map(engine => <option key={engine.value} value={engine.value}>{engine.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={LABEL}>Check frequency</span>
                <select name="frequency" defaultValue="weekly" className={FIELD}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="manual">Manual only</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className={LABEL}>Linked page (optional)</span>
              <input name="linked_page" maxLength={300} className={FIELD} placeholder="/ai-content-generator" />
            </label>

            <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
              Prompts are checked on a periodic sample, not live monitoring of the answer engine. The collection method is shown against each result once checked.
            </p>
          </>
        )}
      </WizardModal>
    </>
  )
}
