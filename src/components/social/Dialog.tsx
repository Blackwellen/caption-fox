'use client'

import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

// Accessible dialog used by every Social workflow (compose, connect, alerts,
// reports). Traps focus, closes on Escape and backdrop click, restores focus to
// whatever opened it, and becomes a bottom sheet on phones.

export function Dialog({ open, onClose, title, description, children, footer, size = 'md' }: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const node = panel.current
    const focusables = () => [...(node?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])') ?? [])]
    ;(focusables().find(element => element.dataset.autofocus !== undefined) ?? focusables()[1] ?? focusables()[0])?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      if (event.key === 'Tab') {
        const items = focusables()
        if (items.length === 0) return
        const firstItem = items[0]
        const lastItem = items[items.length - 1]
        if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem.focus() }
        else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl',
          size === 'sm' && 'sm:max-w-md', size === 'md' && 'sm:max-w-xl', size === 'lg' && 'sm:max-w-3xl',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[15px] font-semibold text-slate-900">{title}</h2>
            {description && <p id={descriptionId} className="mt-0.5 text-[12.5px] text-slate-500">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={17} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  )
}

/** Opens when `?{param}` is present; closing removes it without adding history. */
export function useParamDialog(param: string) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const value = params.get(param)
  const close = useCallback(() => {
    const next = new URLSearchParams(params.toString())
    next.delete(param)
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [params, param, pathname, router])
  return { open: value !== null, value, close }
}

export const fieldLabel = 'mb-1.5 block text-[11.5px] font-semibold uppercase tracking-wide text-slate-500'
export const fieldInput = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13.5px] text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15'
export const primaryButton = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
export const secondaryButton = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'

export function FormError({ message, reference }: { message: string | null; reference?: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
      {message}
      {reference && <span className="mt-0.5 block font-mono text-[11px] text-red-600/80">Support reference: {reference}</span>}
    </div>
  )
}
