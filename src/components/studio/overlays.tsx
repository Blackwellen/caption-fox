'use client'

// Accessible overlay primitives for Studio: a dialog (focus trap, Escape,
// focus restore, labelled), an anchored popover and an action menu (arrow-key
// navigation). Every Studio dropdown, picker and modal composes these.

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { S_FOCUS } from './ui'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// ── Dialog ───────────────────────────────────────────────────────────────────
export function Dialog({ open, onClose, title, description, children, footer, size = 'md', className, bodyClassName }: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  className?: string
  bodyClassName?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose() }
      if (event.key !== 'Tab' || !panel) return
      const nodes = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(n => n.offsetParent !== null)
      if (nodes.length === 0) return
      const [head, tail] = [nodes[0]!, nodes[nodes.length - 1]!]
      if (event.shiftKey && document.activeElement === head) { event.preventDefault(); tail.focus() }
      else if (!event.shiftKey && document.activeElement === tail) { event.preventDefault(); head.focus() }
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

  if (!open || typeof document === 'undefined') return null
  const width = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl', full: 'sm:max-w-6xl' }[size]

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-[1px] sm:items-center sm:p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descId : undefined}
        className={cn('flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl', width, className)}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-start gap-3 border-b border-[#eef0f4] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[16px] font-semibold text-slate-900">{title}</h2>
            {description && <p id={descId} className="mt-0.5 text-[13px] text-slate-500">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog"
            className={cn('-mr-1 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600', S_FOCUS)}>
            <X size={16} />
          </button>
        </div>
        <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-[#eef0f4] px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

// ── Popover ──────────────────────────────────────────────────────────────────
interface PopoverCtx { open: boolean; setOpen: (v: boolean) => void; anchor: React.RefObject<HTMLElement | null>; setAnchor: (node: HTMLElement | null) => void; id: string }
const PopoverContext = createContext<PopoverCtx | null>(null)

export function Popover({ children, open: controlled, onOpenChange, className }: {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}) {
  const [uncontrolled, setUncontrolled] = useState(false)
  const open = controlled ?? uncontrolled
  const setOpen = useCallback((value: boolean) => { setUncontrolled(value); onOpenChange?.(value) }, [onOpenChange])
  const anchor = useRef<HTMLElement | null>(null)
  const setAnchor = useCallback((node: HTMLElement | null) => { anchor.current = node }, [])
  const id = useId()
  return (
    <PopoverContext.Provider value={{ open, setOpen, anchor, setAnchor, id }}>
      <span className={cn('relative inline-flex', className)}>{children}</span>
    </PopoverContext.Provider>
  )
}

function usePopover() {
  const ctx = useContext(PopoverContext)
  if (!ctx) throw new Error('Popover parts must be inside <Popover>')
  return ctx
}

/** Clones the trigger props onto a real button. */
export function PopoverTrigger({ children, className, label, haspopup = 'dialog', disabled }: {
  children: React.ReactNode
  className?: string
  label?: string
  haspopup?: 'dialog' | 'menu' | 'listbox'
  disabled?: boolean
}) {
  const { open, setOpen, setAnchor, id } = usePopover()
  return (
    <button type="button" ref={setAnchor} aria-label={label} aria-haspopup={haspopup}
      aria-expanded={open} aria-controls={open ? id : undefined} disabled={disabled}
      onClick={() => setOpen(!open)} className={className}>
      {children}
    </button>
  )
}

export function PopoverContent({ children, className, align = 'start', width, role = 'dialog', label }: {
  children: React.ReactNode | ((close: () => void) => React.ReactNode)
  className?: string
  align?: 'start' | 'end'
  width?: number
  role?: 'dialog' | 'menu' | 'listbox'
  label?: string
}) {
  const { open, setOpen, anchor, id } = usePopover()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchor.current) return
    const place = () => {
      const rect = anchor.current!.getBoundingClientRect()
      const panelWidth = ref.current?.offsetWidth ?? width ?? 220
      const panelHeight = ref.current?.offsetHeight ?? 200
      let left = align === 'end' ? rect.right - panelWidth : rect.left
      left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8))
      let top = rect.bottom + 6
      if (top + panelHeight > window.innerHeight - 8 && rect.top - panelHeight - 6 > 8) top = rect.top - panelHeight - 6
      setPos({ top, left })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, anchor, align, width])

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (ref.current?.contains(target) || anchor.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); anchor.current?.focus() }
      if (role === 'menu' && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [])]
        if (!items.length) return
        event.preventDefault()
        const index = items.indexOf(document.activeElement as HTMLElement)
        const next = event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length
        items[next]!.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    requestAnimationFrame(() => {
      const first = ref.current?.querySelector<HTMLElement>(role === 'menu' ? '[role="menuitem"]' : FOCUSABLE)
      first?.focus()
    })
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, setOpen, anchor, role])

  if (!open || typeof document === 'undefined') return null
  const close = () => setOpen(false)
  return createPortal(
    <div ref={ref} id={id} role={role} aria-label={label}
      className={cn('fixed z-[80] rounded-xl border border-[#e6e9f0] bg-white p-1 shadow-[0_12px_32px_rgba(15,23,42,0.14)]', className)}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width, visibility: pos ? 'visible' : 'hidden' }}>
      {typeof children === 'function' ? children(close) : children}
    </div>,
    document.body,
  )
}

export function MenuItem({ children, onSelect, icon, danger, disabled, hint, close }: {
  children: React.ReactNode
  onSelect: () => void
  icon?: React.ReactNode
  danger?: boolean
  disabled?: boolean
  hint?: string
  close?: () => void
}) {
  return (
    <button type="button" role="menuitem" aria-disabled={disabled || undefined} disabled={disabled}
      onClick={() => { if (disabled) return; onSelect(); close?.() }}
      title={disabled ? hint : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] outline-none transition-colors focus-visible:bg-slate-100 lg:py-1.5 lg:text-[12px]',
        danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50',
        disabled && 'cursor-not-allowed opacity-50',
      )}>
      {icon && <span className="flex h-4 w-4 items-center justify-center text-slate-400" aria-hidden>{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {disabled && hint && <span className="sr-only">({hint})</span>}
    </button>
  )
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-[#eef0f4]" />
}
