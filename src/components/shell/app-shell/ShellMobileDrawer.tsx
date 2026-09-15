'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ShellNavigation } from '@/lib/navigation/types'
import { NAV_ICONS } from './icons'
import { ShellAvatar, ShellWordmark } from './ShellLogo'
import type { ShellContextInfo, ShellUserInfo } from './types'

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Navigation drawer below 1024px. Never a horizontally compressed sidebar:
 * a full-height sheet with its own scrolling list, a focus trap, Escape and
 * overlay close, and focus restored to the menu button on close.
 */
export default function ShellMobileDrawer({
  open, onClose, nav, activeId, user, context,
}: {
  open: boolean
  onClose: () => void
  nav: ShellNavigation
  activeId: string | null
  user: ShellUserInfo
  context: ShellContextInfo
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const active = panel?.querySelector<HTMLElement>('[aria-current="page"]')
    active?.scrollIntoView({ block: 'nearest' })
    ;(active ?? panel?.querySelector<HTMLElement>(FOCUSABLE))?.focus()

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] lg:hidden">
      <button type="button" tabIndex={-1} aria-label="Close navigation" onClick={onClose} className="absolute inset-0 bg-[#0a1630]/35" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="cf-shell-drawer absolute inset-y-0 left-0 flex w-[300px] max-w-[86vw] flex-col bg-white pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-shell-pop"
      >
        <div className="flex h-[64px] shrink-0 items-center justify-between pl-5 pr-3">
          <Link href={nav.homeHref} onClick={onClose} aria-label="Caption Fox home" className="rounded-[10px]">
            <ShellWordmark badge={context.badge} />
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-shell-text-2 hover:bg-shell-canvas"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <nav aria-label="Navigation" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
          {nav.groups.map(group => (
            <div key={group.id}>
              {group.label && (
                <p className="px-3 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-shell-muted">{group.label}</p>
              )}
              <ul role="list" className="space-y-0.5">
                {group.items.map(item => {
                  const Icon = NAV_ICONS[item.icon]
                  const active = item.id === activeId
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex h-11 items-center gap-3 rounded-[10px] px-3 text-[14.5px] transition-colors duration-150',
                          active ? 'bg-shell-blue-soft font-semibold text-shell-blue' : 'font-medium text-shell-text-2 hover:bg-shell-canvas',
                        )}
                      >
                        <Icon size={18} aria-hidden className={active ? 'text-shell-blue' : 'text-shell-icon'} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-shell-border-soft p-3">
          <Link href={nav.profileHref} onClick={onClose} className="flex items-center gap-3 rounded-[10px] p-2 hover:bg-shell-canvas">
            <ShellAvatar initials={user.initials} size={36} />
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-semibold text-shell-text">{user.name}</span>
              <span className="block truncate text-[12px] text-shell-muted">{user.secondary}</span>
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
