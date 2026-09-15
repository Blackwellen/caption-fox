import Link from 'next/link'
import Image from 'next/image'
import {
  BadgeDollarSign, BarChart2, Bot, Calendar, FileSearch, Gift, Globe2, Home,
  Inbox, LibraryBig, Link2, Mail, Megaphone, Radio, Settings, ShieldCheck,
  Store, Target, Users, Video, Wand2, Workflow,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getShellItem, shellConfigs, type ShellSurface } from '@/lib/shell/caption-fox-shell'
import type { WorkspaceLite } from '@/lib/workspace-shared'
import type { NotificationItem } from '@/components/layout/NotificationsBell'
import { CampaignManagerTopBar, SidebarCollapseToggle, MobileShellNav } from './CampaignManagerShellClient'
import { readNavCollapsed } from '@/lib/shell/nav-preference'

/**
 * The premium Campaign Manager shell: light sidebar, single top bar, one content
 * width. Navigation is generated from the canonical shell registry, so the IA
 * cannot drift between this shell and the rest of Caption Fox — and anything a
 * workspace is not entitled to is simply absent rather than disabled.
 */

const ITEM_ICONS: Record<string, typeof Home> = {
  home: Home, clients: Users, campaigns: Megaphone, calendar: Calendar,
  strategy: Target, studio: Wand2, brand: LibraryBig, links: Link2,
  templates: LibraryBig, social: Radio, advertising: BadgeDollarSign,
  messaging: Mail, web: Globe2, seo: FileSearch, marketplace: Store,
  creators: Video, partnerships: Gift, reputation: Radio, community: Users,
  events: Calendar, inbox: Inbox, audiences: Users, 'client-approvals': ShieldCheck,
  analytics: BarChart2, finance: BadgeDollarSign, 'client-reports': BarChart2,
  automations: Workflow, 'agency-operations': Workflow, settings: Settings,
  'creator-profile': Users, 'fox-ai': Bot,
}

export interface CampaignManagerShellProps {
  surface: ShellSurface
  basePath: string
  activeItemId: string
  workspaces: WorkspaceLite[]
  activeWorkspaceId: string | null
  supplier?: { display_name: string; verified?: boolean | null } | null
  userName: string | null
  userEmail: string | null
  userRole: string
  isAdmin: boolean
  notifications: NotificationItem[]
  children: React.ReactNode
}

export default async function CampaignManagerShell({
  surface, basePath, activeItemId, workspaces, activeWorkspaceId, supplier,
  userName, userEmail, userRole, isAdmin, notifications, children,
}: CampaignManagerShellProps) {
  const collapsed = await readNavCollapsed()
  const config = shellConfigs[surface]
  const activeItem = getShellItem(config, activeItemId)

  const groups = config.groups.map(group => ({
    label: group.label,
    items: group.items.map(item => ({
      id: item.id,
      label: item.label,
      href: `${basePath}/${item.id}`,
      Icon: ITEM_ICONS[item.id] ?? Megaphone,
    })),
  }))

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <a href="#calendar-main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[80] focus:rounded-lg focus:bg-blue-600 focus:px-3 focus:py-2 focus:text-[13px] focus:font-medium focus:text-white">
        Skip to main content
      </a>

      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white lg:flex',
          collapsed ? 'w-[68px]' : 'w-[228px]',
        )}
        aria-label="Campaign Manager navigation"
      >
        <div className="flex h-[60px] shrink-0 items-center border-b border-slate-100 px-4">
          <Link href={`${basePath}/home`} className="flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            <Image src="/caption fox favicon.png" alt="" width={26} height={26} className="rounded-md" aria-hidden />
            {!collapsed && <span className="text-[15px] font-bold tracking-tight text-blue-600">Caption Fox</span>}
            <span className="sr-only">Caption Fox home</span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          {groups.map(group => (
            <div key={group.label} className="mb-3">
              {!collapsed && (
                <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{group.label}</p>
              )}
              <ul>
                {group.items.map(item => {
                  const active = item.id === activeItem.id
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors',
                          active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                          collapsed && 'justify-center px-0',
                          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
                        )}
                      >
                        <item.Icon size={16} className={cn('shrink-0', active ? 'text-blue-600' : 'text-slate-400')} aria-hidden />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {collapsed && <span className="sr-only">{item.label}</span>}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-slate-100 p-2.5">
          <SidebarCollapseToggle collapsed={collapsed} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <CampaignManagerTopBar
          basePath={basePath}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          supplier={supplier}
          userName={userName}
          userEmail={userEmail}
          userRole={userRole}
          isAdmin={isAdmin}
          notifications={notifications}
          navGroups={groups.map(group => ({ label: group.label, items: group.items.map(({ id, label, href }) => ({ id, label, href })) }))}
          activeItemId={activeItem.id}
        />
        <main id="calendar-main" className="min-w-0 flex-1 pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      <MobileShellNav
        basePath={basePath}
        activeItemId={activeItem.id}
        items={config.mobile.map(id => {
          const found = groups.flatMap(g => g.items).find(item => item.id === id)
          return found ? { id: found.id, label: found.label, href: found.href } : null
        }).filter(Boolean) as { id: string; label: string; href: string }[]}
      />
    </div>
  )
}
