'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MenuItem {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
  onSelect?: () => void
  href?: string
  /** Opens in a new tab / triggers a download instead of client navigation. */
  download?: boolean
  danger?: boolean
  selected?: boolean
  disabled?: boolean
  /** Shown as the tooltip / accessible description when disabled. */
  disabledReason?: string
  separatorBefore?: boolean
}

/**
 * Dropdown menu with roving focus (Arrow keys, Home/End, Escape, Tab closes).
 * The panel flips to stay inside the viewport so it is never clipped on
 * tablets and phones.
 */
export function Menu({
  trigger, items, align = 'end', label, className, panelClassName, onOpenChange,
}: {
  trigger: (props: {
    ref: React.RefObject<HTMLButtonElement | null>
    open: boolean
    toggle: () => void
    'aria-haspopup': 'menu'
    'aria-expanded': boolean
    'aria-controls': string
  }) => React.ReactNode
  items: MenuItem[]
  align?: 'start' | 'end'
  label: string
  className?: string
  panelClassName?: string
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [flipUp, setFlipUp] = useState(false)
  const [shiftX, setShiftX] = useState(0)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  function setOpenState(next: boolean) {
    setOpen(next)
    onOpenChange?.(next)
  }

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpenState(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useLayoutEffect(() => {
    if (!open || !panelRef.current) return
    const rect = panelRef.current.getBoundingClientRect()
    setFlipUp(rect.bottom > window.innerHeight - 8 && rect.top > rect.height + 48)
    if (rect.left < 8) setShiftX(8 - rect.left)
    else if (rect.right > window.innerWidth - 8) setShiftX(window.innerWidth - 8 - rect.right)
    else setShiftX(0)
    panelRef.current.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"]),[role="menuitemradio"]')?.focus()
  }, [open])

  function focusItem(direction: 1 | -1 | 'first' | 'last') {
    const nodes = [...(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"],[role="menuitemradio"]') ?? [])]
    if (nodes.length === 0) return
    const index = nodes.indexOf(document.activeElement as HTMLElement)
    const next = direction === 'first' ? 0 : direction === 'last' ? nodes.length - 1
      : (index + direction + nodes.length) % nodes.length
    nodes[next]?.focus()
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') { event.preventDefault(); focusItem(1) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); focusItem(-1) }
    else if (event.key === 'Home') { event.preventDefault(); focusItem('first') }
    else if (event.key === 'End') { event.preventDefault(); focusItem('last') }
    else if (event.key === 'Escape') { event.preventDefault(); setOpenState(false); buttonRef.current?.focus() }
    else if (event.key === 'Tab') setOpenState(false)
  }

  const hasSelection = items.some(item => item.selected !== undefined)

  return (
    <div ref={wrapperRef} className={cn('relative inline-flex', className)}>
      {trigger({
        ref: buttonRef, open, toggle: () => setOpenState(!open),
        'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-controls': menuId,
      })}
      {open && (
        <div
          ref={panelRef} id={menuId} role="menu" aria-label={label} onKeyDown={onKeyDown}
          style={{ transform: shiftX ? `translateX(${shiftX}px)` : undefined }}
          className={cn(
            'absolute z-50 max-h-[min(360px,70vh)] min-w-[180px] overflow-y-auto rounded-xl border border-sg-line bg-white p-1 shadow-sg-pop',
            align === 'end' ? 'right-0' : 'left-0',
            flipUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
            panelClassName,
          )}
        >
          {items.map(item => {
            const content = (
              <>
                {hasSelection && (
                  <span className="flex w-4 shrink-0 justify-center">
                    {item.selected && <Check aria-hidden className="h-3.5 w-3.5 text-sg-blue" />}
                  </span>
                )}
                {item.icon && <span aria-hidden className="flex w-4 shrink-0 justify-center text-slate-400">{item.icon}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.label}</span>
                  {(item.description || (item.disabled && item.disabledReason)) && (
                    <span className="block text-[11px] font-normal text-sg-muted">{item.disabled ? item.disabledReason : item.description}</span>
                  )}
                </span>
              </>
            )
            const classes = cn(
              'flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] outline-none lg:min-h-8 lg:text-[12px]',
              item.disabled ? 'cursor-not-allowed text-slate-400' : item.danger
                ? 'text-red-600 hover:bg-red-50 focus:bg-red-50' : 'text-sg-body hover:bg-slate-50 focus:bg-slate-50',
              item.selected && 'font-medium text-sg-ink',
            )
            const role = item.selected !== undefined ? 'menuitemradio' : 'menuitem'
            return (
              <div key={item.id}>
                {item.separatorBefore && <div role="separator" className="my-1 h-px bg-sg-line-soft" />}
                {item.href && !item.disabled ? (
                  <a role={role} aria-checked={item.selected !== undefined ? item.selected : undefined}
                    href={item.href} download={item.download || undefined} className={classes} tabIndex={-1}
                    onClick={() => setOpenState(false)}>
                    {content}
                  </a>
                ) : (
                  <button type="button" role={role} tabIndex={-1}
                    aria-checked={item.selected !== undefined ? item.selected : undefined}
                    aria-disabled={item.disabled || undefined} title={item.disabled ? item.disabledReason : undefined}
                    className={classes}
                    onClick={() => {
                      if (item.disabled) return
                      setOpenState(false)
                      item.onSelect?.()
                    }}>
                    {content}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
