'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ShellNavigation } from '@/lib/navigation/types'
import { NAV_ICONS } from './icons'
import { ShellAvatar, ShellFoxMark, ShellWordmark } from './ShellLogo'
import type { ShellContextInfo, ShellUserInfo } from './types'

/**
 * Desktop sidebar. Expanded 264px at ≥1024px; a 76px icon rail when the user
 * collapses it, and always at tablet widths (768–1023px). The header and the
 * profile block are fixed; only the navigation list scrolls (mouse wheel,
 * trackpad or touch), so long Brand and Agency menus never push the account
 * block off screen. On short viewports — including high browser zoom — the
 * header and footer compact so the list keeps most of the height.
 */
export default function ShellSidebar({
  nav, activeId, collapsed, user, context, onToggleCollapsed,
}: {
  nav: ShellNavigation
  activeId: string | null
  collapsed: boolean
  user: ShellUserInfo
  context: ShellContextInfo
  onToggleCollapsed: () => void
}) {
  const navRef = useRef<HTMLElement>(null)
  const timer = useRef<number | null>(null)
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null)

  // Runs after layout and again once web fonts settle, because row heights
  // measured at hydration can be short and leave the item just out of view.
  useEffect(() => {
    if (!activeId) return
    let cancelled = false
    const reveal = () => {
      const nav = navRef.current
      const item = nav?.querySelector<HTMLElement>(`[data-nav-id="${activeId}"]`)
      if (cancelled || !nav || !item) return
      // Leave a comfortable margin so the item never sits flush against the
      // logo header or the profile block; don't move a menu that's already fine.
      const margin = 24
      const box = nav.getBoundingClientRect()
      const rect = item.getBoundingClientRect()
      if (rect.top < box.top + margin || rect.bottom > box.bottom - margin) {
        item.scrollIntoView({ block: 'center' })
      }
    }
    const frame = window.requestAnimationFrame(reveal)
    document.fonts?.ready.then(reveal)
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [activeId])

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  function railMode() {
    return collapsed || !window.matchMedia('(min-width: 1024px)').matches
  }

  function showTip(label: string, element: HTMLElement, immediate: boolean) {
    if (!railMode()) return
    if (timer.current) window.clearTimeout(timer.current)
    const rect = element.getBoundingClientRect()
    const next = { label, top: rect.top + rect.height / 2 }
    if (immediate) setTip(next)
    else timer.current = window.setTimeout(() => setTip(next), 120)
  }

  function hideTip() {
    if (timer.current) window.clearTimeout(timer.current)
    setTip(null)
  }

  // Class sets for the two responsive modes. When not collapsed the rail is
  // still used between 768 and 1023px, so every expanded style is lg-scoped.
  const labelClass = collapsed ? 'sr-only' : 'sr-only lg:not-sr-only'
  const onlyExpanded = collapsed ? 'hidden' : 'hidden lg:block'
  const onlyRail = collapsed ? '' : 'lg:hidden'

  return (
    <aside
      aria-label="Sidebar"
      data-collapsed={collapsed ? 'true' : 'false'}
      className={cn(
        'hidden h-full shrink-0 flex-col border-r border-shell-border bg-white transition-[width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] md:flex',
        collapsed ? 'w-[76px]' : 'w-[76px] lg:w-[264px]',
      )}
    >
      <div className={cn('flex h-[72px] shrink-0 items-center justify-center', '[@media(max-height:700px)]:h-14', !collapsed && 'lg:justify-start lg:px-6')}>
        <Link href={nav.homeHref} aria-label="Caption Fox home" className="rounded-[10px]">
          <span className={cn('block', onlyRail)}><ShellFoxMark size={36} /></span>
          <span className={onlyExpanded}><ShellWordmark badge={context.badge} /></span>
        </Link>
      </div>

      <nav
        ref={navRef}
        aria-label={`${context.kind === 'workspace' ? 'Workspace' : context.label} navigation`}
        onScroll={hideTip}
        className={cn(
          'cf-shell-scroll relative min-h-0 flex-1 touch-pan-y overflow-y-auto overflow-x-hidden overscroll-contain pb-3 pt-1 [-webkit-overflow-scrolling:touch]',
          !collapsed && 'lg:px-3',
        )}
      >
        {nav.groups.map((group, index) => (
          <div key={group.id}>
            {index > 0 && <div aria-hidden className={cn('mx-auto my-2 h-px w-8 bg-shell-border-soft', onlyRail)} />}
            {group.label && (
              <p className={cn('px-3 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-shell-muted', '[@media(max-height:700px)]:pt-3', onlyExpanded)}>
                {group.label}
              </p>
            )}
            <ul role="list" className="space-y-0.5">
              {group.items.map(item => {
                const Icon = NAV_ICONS[item.icon]
                const active = item.id === activeId
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      data-nav-id={item.id}
                      aria-current={active ? 'page' : undefined}
                      onMouseEnter={event => showTip(item.label, event.currentTarget, false)}
                      onMouseLeave={hideTip}
                      onFocus={event => showTip(item.label, event.currentTarget, true)}
                      onBlur={hideTip}
                      className={cn(
                        'group flex items-center rounded-[10px] text-[14px] transition-colors duration-150',
                        collapsed
                          ? 'mx-auto h-11 w-11 justify-center'
                          : 'mx-auto h-11 w-11 justify-center lg:mx-0 lg:h-10 lg:w-full lg:justify-start lg:gap-3 lg:px-3',
                        active
                          ? 'bg-shell-blue-soft font-semibold text-shell-blue'
                          : 'font-medium text-shell-text-2 hover:bg-shell-canvas hover:text-shell-text',
                      )}
                    >
                      <Icon
                        size={18}
                        strokeWidth={active ? 2.1 : 1.85}
                        aria-hidden
                        className={cn('shrink-0', active ? 'text-shell-blue' : 'text-shell-icon group-hover:text-shell-text')}
                      />
                      <span className={cn('truncate', labelClass)}>{item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn('shrink-0 border-t border-shell-border-soft p-3', '[@media(max-height:700px)]:p-2')}>
        {/* Collapse / expand lives here as well as in the top bar. Desktop
            only: below 1024px the rail is forced and the drawer takes over. */}
        <button
          type="button"
          onClick={() => { hideTip(); onToggleCollapsed() }}
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          aria-pressed={collapsed}
          onMouseEnter={event => showTip('Expand menu', event.currentTarget, false)}
          onMouseLeave={hideTip}
          onFocus={event => showTip('Expand menu', event.currentTarget, true)}
          onBlur={hideTip}
          className={cn(
            'mb-1.5 hidden h-10 items-center [@media(max-height:700px)]:mb-1 [@media(max-height:700px)]:h-9 rounded-[10px] text-[13.5px] font-medium text-shell-text-2 transition-colors duration-150 hover:bg-shell-canvas hover:text-shell-text lg:flex',
            collapsed ? 'mx-auto w-11 justify-center' : 'w-full gap-3 px-3',
          )}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} aria-hidden className="text-shell-icon" />
          ) : (
            <>
              <PanelLeftClose size={18} aria-hidden className="shrink-0 text-shell-icon" />
              <span>Collapse menu</span>
            </>
          )}
        </button>

        <Link
          href={nav.profileHref}
          onMouseEnter={event => showTip(user.name, event.currentTarget, false)}
          onMouseLeave={hideTip}
          onFocus={event => showTip(user.name, event.currentTarget, true)}
          onBlur={hideTip}
          className={cn(
            'flex items-center justify-center rounded-[10px] p-1 transition-colors duration-150 hover:bg-shell-canvas',
            !collapsed && 'lg:justify-start lg:gap-3 lg:p-2',
          )}
        >
          <ShellAvatar initials={user.initials} size={36} />
          <span className={cn('min-w-0 flex-1', onlyExpanded)}>
            <span className="block truncate text-[13.5px] font-semibold text-shell-text">{user.name}</span>
            <span className="block truncate text-[12px] text-shell-muted">{user.secondary}</span>
          </span>
          <ChevronRight size={16} aria-hidden className={cn('shrink-0 text-shell-muted', onlyExpanded)} />
          <span className="sr-only">Your profile and account</span>
        </Link>
      </div>

      {tip && (
        <div
          role="tooltip"
          className="cf-shell-pop pointer-events-none fixed left-[84px] z-[80] -translate-y-1/2 whitespace-nowrap rounded-lg bg-shell-text px-2.5 py-1.5 text-[12.5px] font-medium text-white shadow-shell-pop"
          style={{ top: tip.top }}
        >
          {tip.label}
        </div>
      )}
    </aside>
  )
}
