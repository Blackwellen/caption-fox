'use client'

import { Pencil } from 'lucide-react'
import type { FlowApi } from './useOnboardingFlow'

export interface ReviewRow { label: string; value: string }

// Summary block with a keyboard-accessible "Edit" that jumps back to a step.
export function ReviewSection({ api, title, step, rows }: { api: FlowApi; title: string; step: number; rows: ReviewRow[] }) {
  return (
    <section className="rounded-2xl border border-cf-line bg-cf-surface/50 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[16px] font-semibold text-cf-ink">{title}</h3>
        <button type="button" onClick={() => api.goTo(step)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-cf-line-strong bg-white px-3 text-[14px] font-medium text-cf-blue hover:border-cf-blue/50" aria-label={`Edit ${title}`}>
          <Pencil size={14} aria-hidden /> Edit
        </button>
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {rows.map(r => (
          <div key={r.label} className="min-w-0">
            <dt className="text-[12px] font-medium uppercase tracking-[0.06em] text-cf-muted">{r.label}</dt>
            <dd className="mt-0.5 break-words text-[15px] text-cf-ink">{r.value || <span className="text-cf-muted">Not added</span>}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
