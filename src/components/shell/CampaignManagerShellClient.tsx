'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  CalendarPlus, ChevronLeft, ChevronRight, FileText, Grid3x3, HelpCircle,
  Megaphone, Menu, Plus, Search, Upload, UserPlus, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import CommandPalette from '@/components/command/CommandPalette'
import WorkspaceSwitcher from '@/components/layout/WorkspaceSwitcher'
import NotificationsBell, { type NotificationItem } from '@/components/layout/NotificationsBell'
import AvatarMenu from '@/components/layout/AvatarMenu'
import type { WorkspaceLite } from '@/lib/workspace-shared'
import { toggleNavCollapsed } from '@/lib/shell/nav-preference'

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'

interface NavItem { id: string; label: string; href: string }
interface NavGroup { label: string; items: NavItem[] }

export function CampaignManagerTopBar({
  basePath, workspaces, activeWorkspaceId, supplier, userName, userEmail, userRole,
  isAdmin, notifications, navGroups, activeItemId,
}: {
  basePath: string
  workspaces: WorkspaceLite[]
  activeWorkspaceId: string | null
  supplier?: { display_name: string; verified?: boolean | null } | null
  userName: string | null
  userEmail: string | null
  userRole: string
  isAdmin: boolean
  notifications: NotificationItem[]
  navGroups: NavGroup[]
  activeItemId: string
}) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [appsOpen, setAppsOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const createRef = useRef<HTMLDivElement>(null)
  const appsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(open => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useCloseOnOutside(createRef, createOpen, () => setCreateOpen(false))
  useCloseOnOutside(appsRef, appsOpen, () => setAppsOpen(false))

  const createItems = [
    { label: 'New schedule item', href: `${basePath}/calendar?new=1`, icon: CalendarPlus },
    { label: 'New campaign', href: `${basePath}/campaigns/new`, icon: Megaphone },
    { label: 'New post', href: `${basePath}/studio/compose`, icon: FileText },
    { label: 'Upload media', href: `${basePath}/studio/media-library`, icon: Upload },
    { label: 'Invite team member', href: `${basePath}/settings/people`, icon: UserPlus },
  ]

  return (
    <>
      <header className="sticky top-0 z-40 flex h-[60px] shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-6">
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

        <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open navigation"
          className={cn('rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden', FOCUS)}>
          <Menu size={20} />
        </button>
        <Link href={`${basePath}/home`} className="flex items-center gap-2 lg:hidden">
          <Image src="/caption fox favicon.png" alt="" width={24} height={24} className="rounded-md" aria-hidden />
          <span className="sr-only">Caption Fox home</span>
        </Link>

        <WorkspaceSwitcher workspaces={workspaces} activeId={activeWorkspaceId} supplier={supplier} />

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className={cn('hidden h-9 max-w-lg flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-400 hover:bg-slate-100 md:flex', FOCUS)}
        >
          <Search size={15} aria-hidden />
          <span>Search campaigns, templates, assets…</span>
          <kbd className="ml-auto rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-400">⌘ K</kbd>
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="relative" ref={createRef}>
            <button
              type="button"
              onClick={() => setCreateOpen(open => !open)}
              aria-expanded={createOpen}
              className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700', FOCUS)}
            >
              <Plus size={15} aria-hidden />New
            </button>
            {createOpen && (
              <div className="absolute right-0 top-full z-40 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                {createItems.map(item => (
                  <Link key={item.label} href={item.href} onClick={() => setCreateOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
                    <item.icon size={14} className="text-slate-400" aria-hidden />{item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <NotificationsBell initial={notifications} />

          <Link href="/help" aria-label="Help and documentation"
            className={cn('rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700', FOCUS)}>
            <HelpCircle size={18} aria-hidden />
          </Link>

          <div className="relative hidden sm:block" ref={appsRef}>
            <button type="button" onClick={() => setAppsOpen(open => !open)} aria-expanded={appsOpen} aria-label="Switch workspace area"
              className={cn('rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700', FOCUS)}>
              <Grid3x3 size={18} aria-hidden />
            </button>
            {appsOpen && (
              <div className="absolute right-0 top-full z-40 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                <p className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Areas</p>
                {navGroups.flatMap(group => group.items).slice(0, 8).map(item => (
                  <Link key={item.id} href={item.href} onClick={() => setAppsOpen(false)}
                    className={cn('block rounded-lg px-2.5 py-1.5 text-[13px] hover:bg-slate-50', item.id === activeItemId ? 'font-medium text-blue-700' : 'text-slate-700')}>
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pl-1">
            <div className="hidden text-right leading-tight xl:block">
              <p className="text-[12.5px] font-semibold text-slate-800">{userName ?? 'Your account'}</p>
              <p className="text-[11px] text-slate-400">{userRole}</p>
            </div>
            <AvatarMenu userName={userName} userEmail={userEmail} isAdmin={isAdmin} />
          </div>
        </div>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[84%] max-w-xs overflow-y-auto bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[15px] font-bold text-blue-600">Caption Fox</span>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close navigation"
                className={cn('rounded-lg p-1.5 text-slate-400 hover:bg-slate-100', FOCUS)}>
                <X size={18} />
              </button>
            </div>
            {navGroups.map(group => (
              <div key={group.label} className="mb-3">
                <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{group.label}</p>
                {group.items.map(item => (
                  <Link key={item.id} href={item.href} onClick={() => setDrawerOpen(false)}
                    className={cn('block rounded-lg px-2.5 py-2 text-[13px] font-medium',
                      item.id === activeItemId ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100')}>
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function useCloseOnOutside(ref: React.RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    function onDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) close()
    }
    function onKey(event: KeyboardEvent) { if (event.key === 'Escape') close() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, ref, close])
}

/**
 * Collapse state is a stored preference rather than local component state, so it
 * survives refresh, deep links and navigation between sections.
 */
export function SidebarCollapseToggle({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => { await toggleNavCollapsed(pathname) })}
      className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-60', collapsed && 'justify-center px-0', FOCUS)}
      aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
      aria-pressed={collapsed}
    >
      {collapsed ? <ChevronRight size={15} aria-hidden /> : <><ChevronLeft size={15} aria-hidden />Collapse</>}
    </button>
  )
}

export function MobileShellNav({
  basePath, activeItemId, items,
}: { basePath: string; activeItemId: string; items: NavItem[] }) {
  if (items.length === 0) return null
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {items.slice(0, 4).map(item => (
        <Link
          key={item.id}
          href={item.href}
          aria-current={item.id === activeItemId ? 'page' : undefined}
          className={cn('flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-medium',
            item.id === activeItemId ? 'text-blue-600' : 'text-slate-500', FOCUS)}
        >
          <span className={cn('h-1 w-6 rounded-full', item.id === activeItemId ? 'bg-blue-600' : 'bg-transparent')} aria-hidden />
          {item.label}
        </Link>
      ))}
      <Link href={`${basePath}/settings`} className={cn('flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-medium text-slate-500', FOCUS)}>
        <span className="h-1 w-6 rounded-full bg-transparent" aria-hidden />More
      </Link>
    </nav>
  )
}
