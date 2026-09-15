'use client'

/**
 * CAPTION FOX PERMANENT APPLICATION SHELL
 * ---------------------------------------
 * This shell is an approved global design primitive.
 *
 * Do not alter its visual architecture, geometry, colour system,
 * expanded/collapsed behaviour, top-bar structure or navigation
 * interaction patterns from individual feature work.
 *
 * Navigation contents may only change through the canonical
 * workspace navigation configuration.
 *
 * Main page content must render inside the shell without modifying it.
 *
 * Visual spec:  designs/Universal Sections/Platform Shell#/*.png
 * Design lock:  APP_SHELL_DESIGN_LOCK.md
 * Navigation:   src/lib/navigation/registers.ts + resolver.ts
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { findActiveNavItem } from '@/lib/navigation/match'
import { SHELL_NAV_COOKIE, navPreferenceKey } from '@/lib/shell/nav-preference-constants'
import ShellSidebar from './ShellSidebar'
import ShellTopbar from './ShellTopbar'
import ShellMobileDrawer from './ShellMobileDrawer'
import ShellSearchPalette from './ShellSearchPalette'
import type { AppShellProps } from './types'

function writeNavPreference(collapsed: boolean, userId: string) {
  document.cookie = `${SHELL_NAV_COOKIE}=${collapsed ? '1' : '0'}.${navPreferenceKey(userId)}; path=/; max-age=31536000; samesite=lax`
}

export default function CaptionFoxAppShell(props: AppShellProps) {
  const { nav, user, context, userId, children } = props
  const pathname = usePathname()
  const activeId = findActiveNavItem(nav.groups, props.qaPathname ?? pathname)

  const [collapsed, setCollapsed] = useState(props.initialCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const searchButtonRef = useRef<HTMLButtonElement>(null)
  const searchReturnRef = useRef<HTMLElement | null>(null)

  // Any navigation closes transient chrome (drawer, search).
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setDrawerOpen(false)
    setSearchOpen(false)
  }

  const openSearch = useCallback(() => {
    searchReturnRef.current = document.activeElement as HTMLElement | null
    setSearchOpen(true)
  }, [])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    // Opened by shortcut with nothing focused, the saved element is <body>;
    // return focus to the search trigger instead so keyboard users don't lose it.
    const saved = searchReturnRef.current
    const target = saved && saved !== document.body && document.contains(saved) ? saved : searchButtonRef.current
    target?.focus()
  }, [])

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    menuButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (searchOpen) closeSearch()
        else openSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [searchOpen, openSearch, closeSearch])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    writeNavPreference(next, userId)
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-shell-canvas text-shell-text" data-shell-context={nav.context}>
      <a
        href="#cf-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-lg focus:bg-shell-blue focus:px-3 focus:py-2 focus:text-[13px] focus:font-medium focus:text-white"
      >
        Skip to main content
      </a>

      <ShellSidebar nav={nav} activeId={activeId} collapsed={collapsed} user={user} context={context} onToggleCollapsed={toggleCollapsed} />

      <div className="flex min-w-0 flex-1 flex-col">
        <ShellTopbar
          {...props}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          onOpenDrawer={() => setDrawerOpen(true)}
          onOpenSearch={openSearch}
          menuButtonRef={menuButtonRef}
          searchButtonRef={searchButtonRef}
        />
        <main id="cf-main" tabIndex={-1} className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain focus:outline-none">
          {children}
        </main>
      </div>

      <ShellMobileDrawer open={drawerOpen} onClose={closeDrawer} nav={nav} activeId={activeId} user={user} context={context} />
      <ShellSearchPalette open={searchOpen} onClose={closeSearch} nav={nav} />
    </div>
  )
}
