'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { createAlertRule } from '@/lib/social/actions'

export function CreateAlertModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [keywords, setKeywords] = useState('')
  const [recipients, setRecipients] = useState('')
  const [frequency, setFrequency] = useState<'realtime' | 'hourly' | 'daily' | 'weekly'>('daily')
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium')
  const [error, setError] = useState<string | null>(null)

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await createAlertRule({
        name,
        keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
        recipients: recipients.split(',').map(r => r.trim()).filter(Boolean),
        frequency, severity,
      })
      if (!result.ok) { setError(result.message); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Create alert">
      <div className="w-full max-w-lg rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h2 className="font-semibold text-slate-900">Create Alert</h2>
          <button onClick={onClose} className="rounded p-2 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Alert name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. Negative sentiment spike" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Keywords (comma separated)</label>
            <input value={keywords} onChange={e => setKeywords(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="captionfox, ai captions" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Recipients (email, comma separated)</label>
            <input value={recipients} onChange={e => setRecipients(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="you@company.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Frequency</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value as never)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="realtime">Realtime</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Severity</label>
              <select value={severity} onChange={e => setSeverity(e.target.value as never)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 p-5">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Cancel</button>
          <button onClick={submit} disabled={pending || !name.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {pending ? 'Creating…' : 'Create Alert'}
          </button>
        </div>
      </div>
    </div>
  )
}
