'use client'

import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Accessible modal dialog: focus moves in on open, is trapped while open,
 * Escape closes (unless busy), and focus returns to the opener on close.
 * Full-screen sheet on phones, centred panel from `sm`.
 */
export function Dialog({
  open, onClose, title, description, children, footer, size = 'md', busy = false, initialFocusRef,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  busy?: boolean
  initialFocusRef?: React.RefObject<HTMLElement | null>
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<Element | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return
    openerRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => {
      const target = initialFocusRef?.current ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panelRef.current
      target?.focus()
    })
    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus()
    }
  }, [open, initialFocusRef])

  if (!open || typeof document === 'undefined') return null

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape' && !busy) {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !panelRef.current) return
    const nodes = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(node => node.offsetParent !== null)
    if (nodes.length === 0) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" onKeyDown={onKeyDown}>
      <button type="button" aria-hidden tabIndex={-1} className="absolute inset-0 cursor-default bg-slate-900/40"
        onClick={() => { if (!busy) onClose() }} />
      <div
        ref={panelRef}
        role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-sg-pop outline-none sm:rounded-2xl',
          { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }[size],
        )}
      >
        <header className="flex items-start gap-3 border-b border-sg-line-soft px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[16px] font-semibold text-sg-ink">{title}</h2>
            {description && <p id={descriptionId} className="mt-0.5 text-[13px] text-sg-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close dialog"
            className="-mr-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40">
            <X aria-hidden className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-sg-line-soft px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}

export function DialogButton({
  children, variant = 'secondary', className, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-sg-blue text-white hover:bg-sg-blue-hover',
        variant === 'secondary' && 'border border-sg-line bg-white text-sg-body hover:bg-slate-50',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, description, confirmLabel = 'Confirm', danger, busy,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; description: string
  confirmLabel?: string; danger?: boolean; busy?: boolean
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} size="sm" busy={busy}
      footer={(
        <>
          <DialogButton onClick={onClose} disabled={busy}>Cancel</DialogButton>
          <DialogButton variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy} aria-busy={busy}>
            {busy ? 'Working…' : confirmLabel}
          </DialogButton>
        </>
      )}>
      <p className="text-[13px] text-sg-muted">This action is recorded in the workspace activity log.</p>
    </Dialog>
  )
}
