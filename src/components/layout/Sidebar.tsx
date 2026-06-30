'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  Home, Calendar, Megaphone, Wand2, Video, Inbox,
  BarChart2, Settings, LogOut, ChevronRight, Radio, Link2, Gift,
} from 'lucide-react'

// Grouped, enterprise IA (audit §21.3). Groups are visual headers only — routes unchanged.
const navGroups: { group: string | null; items: { label: string; href: string; icon: typeof Home }[] }[] = [
  { group: null, items: [
    { label: 'Home', href: '/app/home', icon: Home },
  ] },
  { group: 'Create', items: [
    { label: 'Studio',   href: '/app/studio',   icon: Wand2 },
    { label: 'Calendar', href: '/app/calendar', icon: Calendar },
  ] },
  { group: 'Promote', items: [
    { label: 'Campaigns',   href: '/app/campaigns', icon: Megaphone },
    { label: 'UGC',         href: '/app/ugc',       icon: Video },
    { label: 'Link in Bio', href: '/app/links',     icon: Link2 },
  ] },
  { group: 'Engage', items: [
    { label: 'Inbox', href: '/app/inbox', icon: Inbox },
  ] },
  { group: 'Measure', items: [
    { label: 'Analytics', href: '/app/analytics', icon: BarChart2 },
    { label: 'Listening', href: '/app/listening', icon: Radio },
  ] },
  { group: 'Manage', items: [
    { label: 'Affiliates', href: '/app/affiliates', icon: Gift },
    { label: 'Settings', href: '/app/settings', icon: Settings },
  ] },
]

interface SidebarProps {
  userEmail?: string | null
  userName?: string | null
  isAdmin?: boolean
}

export default function Sidebar({ userEmail, userName, isAdmin }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = userName
    ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : userEmail?.[0]?.toUpperCase() ?? '?'

  return (
    <aside className="hidden lg:flex w-[220px] shrink-0 h-screen bg-navy-900 flex-col border-r border-navy-800 overflow-hidden">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-navy-800">
        <Link href="/app/home" className="flex items-center gap-2.5">
          <Image
            src="/caption fox favicon.png"
            alt="Caption Fox"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="text-white font-bold text-[15px] tracking-tight">Caption Fox</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
        {navGroups.map(({ group, items }) => (
          <div key={group ?? 'top'} className={cn(group && 'pt-3')}>
            {group && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                {group}
              </p>
            )}
            {items.map(({ label, href, icon: Icon }) => {
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group',
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-navy-500 hover:bg-navy-800 hover:text-white',
                  )}
                  style={{ color: active ? undefined : '#94a3b8' }}
                >
                  <Icon size={16} className={cn('shrink-0', active ? 'text-white' : 'text-slate-400 group-hover:text-white')} />
                  {label}
                  {active && <ChevronRight size={12} className="ml-auto opacity-60" />}
                </Link>
              )
            })}
          </div>
        ))}

        {isAdmin && (
          <Link
            href="/admin"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 mt-2',
              pathname.startsWith('/admin')
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:bg-navy-800 hover:text-white',
            )}
          >
            <Settings size={16} className="shrink-0" />
            Admin
          </Link>
        )}
      </nav>

      {/* User */}
      <div className="px-2.5 pb-3 border-t border-navy-800 pt-3">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-fox-gradient flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            {userName && <p className="text-xs font-medium text-white truncate">{userName}</p>}
            {userEmail && <p className="text-xs text-slate-500 truncate">{userEmail}</p>}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-white hover:bg-navy-800 transition-colors mt-0.5"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
