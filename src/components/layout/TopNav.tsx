'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Search, HelpCircle, Plus,
  FileText, Megaphone, CalendarPlus, Upload, Video, UserPlus, BarChart2,
} from 'lucide-react'
import CommandPalette from '@/components/command/CommandPalette'
import WorkspaceSwitcher from '@/components/layout/WorkspaceSwitcher'
import NotificationsBell, { type NotificationItem } from '@/components/layout/NotificationsBell'
import AvatarMenu from '@/components/layout/AvatarMenu'
import type { WorkspaceLite } from '@/lib/workspace-shared'

const quickCreateItems = [
  { label: 'New Post',             href: '/app/studio?action=new-post',     icon: FileText },
  { label: 'New Campaign',         href: '/app/campaigns?action=new',        icon: Megaphone },
  { label: 'Generate Content Plan',href: '/app/studio?action=plan',          icon: CalendarPlus },
  { label: 'Upload Media',         href: '/app/studio?tab=media&action=upload', icon: Upload },
  { label: 'New UGC Brief',        href: '/app/ugc?action=new-brief',        icon: Video },
  { label: 'Add Creator',          href: '/app/ugc?tab=creators&action=add', icon: UserPlus },
  { label: 'Invite Team Member',   href: '/app/settings?tab=team&action=invite', icon: UserPlus },
  { label: 'Create Report',        href: '/app/analytics?action=report',     icon: BarChart2 },
]

interface TopNavProps {
  workspaces?: WorkspaceLite[]
  activeWorkspaceId?: string | null
  supplier?: { display_name: string; verified?: boolean | null } | null
  userName?: string | null
  userEmail?: string | null
  isAdmin?: boolean
  notifications?: NotificationItem[]
}

export default function TopNav({
  workspaces = [],
  activeWorkspaceId,
  supplier,
  userName,
  userEmail,
  isAdmin,
  notifications = [],
}: TopNavProps) {
  const [quickOpen, setQuickOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Global ⌘K / Ctrl+K to open the command palette.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-5 gap-3 shrink-0 z-10 relative">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Workspace switcher */}
      <WorkspaceSwitcher workspaces={workspaces} activeId={activeWorkspaceId} supplier={supplier} />

      {/* Search → command palette */}
      <div className="flex-1 max-w-md">
        <button
          onClick={() => setPaletteOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors w-full"
        >
          <Search size={14} />
          <span>Search…</span>
          <kbd className="ml-auto text-xs text-slate-300 font-mono">⌘K</kbd>
        </button>
      </div>

      <div className="flex items-center gap-1 ml-auto">
        {/* Quick Create */}
        <div className="relative">
          <button
            onClick={() => setQuickOpen(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={15} />
            Create
          </button>
          {quickOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setQuickOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-40 py-1.5">
                {quickCreateItems.map(item => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setQuickOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <item.icon size={14} className="text-slate-400 shrink-0" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Notifications */}
        <NotificationsBell initial={notifications} />

        {/* Help */}
        <Link href="/help" className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <HelpCircle size={18} />
        </Link>

        {/* Account */}
        <div className="ml-1">
          <AvatarMenu userName={userName} userEmail={userEmail} isAdmin={isAdmin} />
        </div>
      </div>
    </header>
  )
}
