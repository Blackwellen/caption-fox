'use client'

import { useEffect, useRef } from 'react'
import { Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const FIELD = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
export const TEXTAREA = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
export const LABEL = 'mb-1 block text-[11px] font-medium text-slate-600'

/**
 * Shared wizard modal shell for every SEO create action. Handles focus trap
 * basics, Escape-to-close, backdrop click, inline error banner and a
 * pending-aware submit footer. Callers own the form fields and submit logic.
 */
export function WizardModal({
  titleId, title, open, onClose, onSubmit, error, pending, submitLabel, disableSubmit, children,
}: {
  titleId: string
  title: string
  open: boolean
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  error: string | null
  pending: boolean
  submitLabel: string
  disableSubmit?: boolean
  children: React.ReactNode
}) {
  const firstFieldRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = '' }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
      <button aria-hidden tabIndex={-1} className="fixed inset-0 cursor-default" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
        <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-3.5">
          <h2 id={titleId} className="text-[15px] font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={16} />
          </button>
        </header>

        <form onSubmit={onSubmit} className="max-h-[70vh] overflow-y-auto px-5 py-4">
          <div ref={firstFieldRef} className="space-y-3">
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
            {children}
          </div>

          <footer className="sticky bottom-0 -mx-5 mt-4 flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-5 pt-3">
            <button type="button" onClick={onClose} className="h-9 rounded-lg border border-slate-200 px-3.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || disableSubmit}
              className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60')}
            >
              {pending && <Loader2 size={14} className="animate-spin" />}
              {submitLabel}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
