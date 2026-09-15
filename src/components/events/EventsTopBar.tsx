'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Bell, CalendarDays, HelpCircle, Menu, Search, X } from 'lucide-react'
import WorkspaceSwitcher from '@/components/layout/WorkspaceSwitcher'
import type { WorkspaceLite } from '@/lib/workspace-shared'
import type { EventsTabId } from '@/lib/events/types'
import { EVENTS_TAB_LABELS } from '@/lib/events/entitlements'
import { Avatar } from './EventsShell'
import { cn } from '@/lib/utils'

/**
 * Canonical Caption Fox top navigation for the Events module.
 * Global search submits to the module search param so results are real records,
 * never a decorative input.
 */
export default function EventsTopBar({
  searchPlaceholder, notificationCount, workspaces, activeWorkspace, user,
  basePath, workspaceRoot, visibleTabs, activeTab,
}: {
  searchPlaceholder: string
  notificationCount: number
  workspaces: WorkspaceLite[]
  activeWorkspace: { id: string; name: string; plan: string } | null
  user: { name: string; role: string; avatarUrl: string | null }
  basePath: string
  workspaceRoot: string
  visibleTabs: EventsTabId[]
  activeTab: EventsTabId
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [term, setTerm] = useState(params.get('q') ?? '')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Re-sync the input from the URL when navigation changes it externally
  // (back/forward, a cleared-filters link) — adjusted during render per
  // https://react.dev/learn/you-might-not-need-an-effect, not in an effect,
  // so this never triggers a cascading extra render.
  const [lastParamsQuery, setLastParamsQuery] = useState(params.get('q'))
  if (params.get('q') !== lastParamsQuery) {
    setLastParamsQuery(params.get('q'))
    setTerm(params.get('q') ?? '')
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const next = new URLSearchParams(params.toString())
    if (term.trim()) next.set('q', term.trim())
    else next.delete('q')
    next.delete('page')
    router.push(`?${next.toString()}`)
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>

        <form onSubmit={submit} className="min-w-0 flex-1" role="search">
          <label htmlFor="events-global-search" className="sr-only">{searchPlaceholder}</label>
          <div className="relative max-w-[712px]">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              ref={inputRef}
              id="events-global-search"
              value={term}
              onChange={event => setTerm(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 w-full rounded-[10px] border border-slate-200 bg-white pl-10 pr-4 text-[13.5px] text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </form>

        <div className="flex items-center gap-1">
          <Link
            href={`${workspaceRoot}/settings/help`}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Help and documentation"
          >
            <HelpCircle size={19} />
          </Link>
          <Link
            href={`${workspaceRoot}/notifications`}
            className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label={`Notifications${notificationCount ? `, ${notificationCount} unread` : ''}`}
          >
            <Bell size={19} />
            {notificationCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </Link>
          <Link
            href={`${workspaceRoot}/calendar`}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Open calendar"
          >
            <CalendarDays size={19} />
          </Link>

          <span className="mx-2 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden />

          <div className="hidden sm:block">
            <WorkspaceSwitcher workspaces={workspaces} activeId={activeWorkspace?.id ?? null} />
          </div>
          <Avatar name={user.name} src={user.avatarUrl} size={34} />
        </div>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-xs overflow-y-auto bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-base font-bold text-blue-600">Caption Fox</p>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close navigation"
              >
                <X size={18} />
              </button>
            </div>
            <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Events</p>
            <ul className="space-y-0.5">
              {visibleTabs.map(tab => (
                <li key={tab}>
                  <Link
                    href={tab === 'overview' ? basePath : `${basePath}/${tab}`}
                    onClick={() => setDrawerOpen(false)}
                    aria-current={tab === activeTab ? 'page' : undefined}
                    className={cn(
                      'block rounded-lg px-3 py-2.5 text-sm',
                      tab === activeTab ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    {EVENTS_TAB_LABELS[tab]}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <WorkspaceSwitcher workspaces={workspaces} activeId={activeWorkspace?.id ?? null} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
