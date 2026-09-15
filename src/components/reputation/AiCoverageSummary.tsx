'use client'

import { useState, useTransition } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { useToast } from './Toast'
import { aiSummariseCoverage } from '@/app/app/reputation/actions'

export function AiCoverageSummary() {
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const [summary, setSummary] = useState<string | null>(null)

  function run() {
    if (pending) return
    startTransition(async () => {
      const result = await aiSummariseCoverage()
      if (!result.ok) { notify('error', result.error ?? 'AI request failed.'); return }
      setSummary(result.text ?? null)
    })
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">AI Coverage Summary</h2>
        <button type="button" disabled={pending} onClick={run} className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          {pending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}Summarise
        </button>
      </div>
      {summary ? (
        <p className="mt-2 text-sm text-slate-600">{summary}</p>
      ) : (
        <p className="mt-2 text-xs text-slate-400">Grounded only in the coverage already tracked in this workspace — nothing invented.</p>
      )}
    </div>
  )
}
