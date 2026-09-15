import Link from 'next/link'
import { CheckCircle2, LayoutGrid, Mic, Sparkles, Star, Users, Video, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EventsTabId } from '@/lib/events/types'
import { EVENTS_TAB_LABELS } from '@/lib/events/entitlements'
import EventsMobileNav from './EventsMobileNav'
import type { WorkspaceLite } from '@/lib/workspace-shared'

/**
 * Events module frame. The global sidebar, top bar and search come from the
 * permanent Caption Fox shell (app/[workspaceType]/layout.tsx); this renders
 * only the module's LOCAL navigation — a sliding tab row on desktop/tablet and
 * a dropdown selector on mobile — plus the module content.
 *
 * Tabs are entitlement-driven: `visibleTabs` is resolved server-side, so a tab
 * a workspace cannot use is never rendered.
 */

const TAB_ICONS: Record<EventsTabId, LucideIcon> = {
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
  /** Kept for call-site compatibility; the shell owns workspace switching. */
  workspaces?: WorkspaceLite[]
  activeWorkspace?: { id: string; name: string; plan: string } | null
  user?: { name: string; role: string; avatarUrl: string | null }
  searchPlaceholder?: string
  notificationCount?: number
  planUsage?: { label: string; used: number; limit: number } | null
  children: React.ReactNode
}

export default function EventsShell({ basePath, activeTab, visibleTabs, planUsage = null, children }: EventsShellProps) {
  const workspaceRoot = basePath.replace(/\/events$/, '')

  return (
    <>
      <div className="mx-auto w-full max-w-[1215px] px-4 pb-24 pt-6 sm:px-6 md:pb-16 lg:px-8">
        <div className="mb-6 hidden items-end justify-between gap-4 border-b border-shell-border md:flex">
          <nav aria-label="Events sections" className="cf-hide-scrollbar -mb-px flex min-w-0 overflow-x-auto">
            {visibleTabs.map(tab => {
              const Icon = TAB_ICONS[tab]
              const active = tab === activeTab
              return (
                <Link
                  key={tab}
                  href={tab === 'overview' ? basePath : `${basePath}/${tab}`}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-3 text-[13.5px] transition-colors',
                    active ? 'border-shell-blue font-semibold text-shell-blue' : 'border-transparent font-medium text-shell-text-2 hover:text-shell-text',
                  )}
                >
                  <Icon size={15} aria-hidden />
                  {EVENTS_TAB_LABELS[tab]}
                </Link>
              )
            })}
          </nav>
          {planUsage && (
            <div className="mb-2 hidden shrink-0 items-center gap-3 lg:flex">
              <span className="text-[12px] text-shell-muted">
                {planUsage.label} · {planUsage.used.toLocaleString('en-GB')} / {planUsage.limit.toLocaleString('en-GB')} contacts
              </span>
              <Link href={`${workspaceRoot}/settings/billing`} className="rounded-lg border border-shell-border px-2.5 py-1 text-[12px] font-semibold text-shell-text-2 hover:bg-shell-canvas">
                Upgrade plan
              </Link>
            </div>
          )}
        </div>
        {children}
      </div>
      <EventsMobileNav basePath={basePath} visibleTabs={visibleTabs} activeTab={activeTab} />
    </>
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
