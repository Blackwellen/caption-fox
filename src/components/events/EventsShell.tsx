import Link from 'next/link'
import Image from 'next/image'
import {
  BarChart3, CalendarDays, CheckCircle2, FileText, Home, LayoutGrid, Megaphone,
  Mic, Plug, Settings, Sparkles, Star, Users, Video, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EventsTabId } from '@/lib/events/types'
import { EVENTS_TAB_LABELS } from '@/lib/events/entitlements'
import EventsTopBar from './EventsTopBar'
import EventsMobileNav from './EventsMobileNav'
import type { WorkspaceLite } from '@/lib/workspace-shared'

/**
 * The canonical Caption Fox shell for the Events module.
 *
 * One shell, every eligible workspace type. Navigation is entitlement-driven:
 * `visibleTabs` is resolved server-side, so a tab a workspace cannot use is
 * never rendered — not as a disabled link, not as an empty route.
 */

const PRIMARY_NAV = [
  { id: 'home', label: 'Home', icon: Home, href: '' },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid, href: '/home' },
  { id: 'contacts', label: 'Contacts', icon: Users, href: '/audiences' },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone, href: '/campaigns', hasChildren: true },
] as const

const SECONDARY_NAV = [
  { id: 'content', label: 'Content', icon: FileText, href: '/studio', hasChildren: true },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, href: '/analytics', hasChildren: true },
  { id: 'automations', label: 'Automations', icon: Zap, href: '/automations' },
  { id: 'integrations', label: 'Integrations', icon: Plug, href: '/integrations' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
] as const

const TAB_ICONS: Record<EventsTabId, typeof CalendarDays> = {
  overview: LayoutGrid,
  events: Users,
  webinars: Video,
  podcasts: Mic,
  sponsorships: Star,
  'follow-up': CheckCircle2,
}

export interface EventsShellProps {
  basePath: string
  activeTab: EventsTabId
  visibleTabs: EventsTabId[]
  workspaces: WorkspaceLite[]
  activeWorkspace: { id: string; name: string; plan: string } | null
  user: { name: string; role: string; avatarUrl: string | null }
  searchPlaceholder?: string
  notificationCount?: number
  planUsage?: { label: string; used: number; limit: number } | null
  children: React.ReactNode
}

export default function EventsShell({
  basePath, activeTab, visibleTabs, workspaces, activeWorkspace, user,
  searchPlaceholder = 'Search events, sessions, contacts...',
  notificationCount = 0, planUsage = null, children,
}: EventsShellProps) {
  const workspaceRoot = basePath.replace(/\/events$/, '')

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <a
        href="#events-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>

      {/* ---------------------------------------------------------- sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-[218px] flex-col border-r border-slate-200 bg-white lg:flex"
        aria-label="Primary"
      >
        <div className="flex h-[68px] shrink-0 items-center gap-2.5 px-5">
          <Link href={workspaceRoot} className="flex items-center gap-2.5" aria-label="Caption Fox home">
            <Image
              src="/caption-fox-logo-transparent.png"
              alt=""
              width={34}
              height={34}
              className="h-[34px] w-[34px] rounded-lg object-contain"
              priority
            />
            <span className="text-[17px] font-bold tracking-tight text-blue-600">Caption Fox</span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Sections">
          <ul className="space-y-0.5">
            {PRIMARY_NAV.map(item => (
              <NavRow key={item.id} href={`${workspaceRoot}${item.href}`} icon={item.icon} label={item.label} hasChildren={'hasChildren' in item && item.hasChildren} />
            ))}
          </ul>

          {/* Events — the active module, always expanded on these routes */}
          <div className="mt-0.5">
            <div className="relative flex items-center gap-3 rounded-lg bg-blue-50 px-3 py-2.5 text-[14px] font-semibold text-blue-700">
              <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-blue-600" aria-hidden />
              <CalendarDays size={17} aria-hidden />
              <span>Events</span>
              <svg className="ml-auto" width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                <path d="M2.5 7.5 6 4l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <ul className="mt-0.5 space-y-0.5 pl-3">
              {visibleTabs.map(tab => {
                const Icon = TAB_ICONS[tab]
                const href = tab === 'overview' ? basePath : `${basePath}/${tab}`
                const active = tab === activeTab
                return (
                  <li key={tab}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors',
                        active
                          ? 'bg-blue-50 font-semibold text-blue-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                      )}
                    >
                      <Icon size={15} aria-hidden />
                      {EVENTS_TAB_LABELS[tab]}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>

          <ul className="mt-3 space-y-0.5">
            {SECONDARY_NAV.map(item => (
              <NavRow key={item.id} href={`${workspaceRoot}${item.href}`} icon={item.icon} label={item.label} hasChildren={'hasChildren' in item && item.hasChildren} />
            ))}
          </ul>
        </nav>

        {planUsage && (
          <div className="mx-3 mb-3 rounded-xl border border-slate-200 bg-white p-3.5">
            <p className="text-[13px] font-semibold text-slate-900">{planUsage.label}</p>
            <p className="mt-1 text-[11.5px] text-slate-500">
              {planUsage.used.toLocaleString('en-GB')} / {planUsage.limit.toLocaleString('en-GB')} contacts
            </p>
            <div
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={planUsage.used}
              aria-valuemin={0}
              aria-valuemax={planUsage.limit}
              aria-label={`${planUsage.label} contact usage`}
            >
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${Math.min(100, (planUsage.used / Math.max(1, planUsage.limit)) * 100)}%` }}
              />
            </div>
            <Link
              href={`${workspaceRoot}/settings/billing`}
              className="mt-3 block rounded-lg border border-slate-200 py-1.5 text-center text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Upgrade Plan
            </Link>
          </div>
        )}

        <div className="flex items-center gap-2.5 border-t border-slate-100 px-4 py-3.5">
          <Avatar name={user.name} src={user.avatarUrl} size={34} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-slate-900">{user.name}</p>
            <p className="truncate text-[11.5px] text-slate-500">{user.role}</p>
          </div>
        </div>
      </aside>

      {/* ---------------------------------------------------------- main */}
      <div className="lg:pl-[218px]">
        <EventsTopBar
          searchPlaceholder={searchPlaceholder}
          notificationCount={notificationCount}
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          user={user}
          basePath={basePath}
          workspaceRoot={workspaceRoot}
          visibleTabs={visibleTabs}
          activeTab={activeTab}
        />

        <main id="events-main" className="mx-auto w-full max-w-[1215px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      <EventsMobileNav
        basePath={basePath}
        visibleTabs={visibleTabs}
        activeTab={activeTab}
      />
    </div>
  )
}

function NavRow({
  href, icon: Icon, label, hasChildren,
}: { href: string; icon: typeof Home; label: string; hasChildren?: boolean }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
      >
        <Icon size={17} aria-hidden />
        <span>{label}</span>
        {hasChildren && (
          <svg className="ml-auto text-slate-400" width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </Link>
    </li>
  )
}

export function Avatar({
  name, src, size = 32,
}: { name: string; src?: string | null; size?: number }) {
  const label = name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?'
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700"
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
    >
      {label}
    </span>
  )
}

export function ShellIcon() {
  return <Sparkles size={16} />
}
