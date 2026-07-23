'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  Home, Calendar, Megaphone, Wand2, Video, Inbox, BarChart2, Settings,
  LogOut, ChevronRight, Radio, Link2, Gift, Store, Target, BadgeDollarSign,
  Workflow, Users, Globe2, Mail, FileSearch, LibraryBig,
} from 'lucide-react'

type NavItem = { label: string; href: string; icon: typeof Home }
type NavGroup = { group: string | null; items: NavItem[] }

const workspaceNavAllowlist: Record<string, string[]> = {
  creator: ['/app/home', '/app/campaigns', '/app/calendar', '/app/studio', '/app/links', '/app/social', '/app/marketplace', '/app/inbox', '/app/analytics', '/app/settings'],
  small_business: ['/app/home', '/app/strategy', '/app/campaigns', '/app/calendar', '/app/studio', '/app/brand', '/app/links', '/app/social', '/app/messaging', '/app/web', '/app/marketplace', '/app/inbox', '/app/audiences', '/app/analytics', '/app/settings'],
  brand: [],
  agency: [],
}

// Existing mature routes and newly route-backed structural shells live in one
// information architecture. Shell routes are clearly labelled by their page header
// until their individual data/integration release gates are complete.
const navGroups: NavGroup[] = [
  { group: null, items: [{ label: 'Home', href: '/app/home', icon: Home }] },
  { group: 'Plan', items: [
    { label: 'Strategy', href: '/app/strategy', icon: Target },
    { label: 'Campaigns', href: '/app/campaigns', icon: Megaphone },
    { label: 'Calendar', href: '/app/calendar', icon: Calendar },
  ] },
  { group: 'Create', items: [
    { label: 'Studio', href: '/app/studio', icon: Wand2 },
    { label: 'Brand & Assets', href: '/app/brand', icon: LibraryBig },
    { label: 'Link in Bio', href: '/app/links', icon: Link2 },
  ] },
  { group: 'Promote', items: [
    { label: 'Social', href: '/app/social', icon: Radio },
    { label: 'Advertising', href: '/app/advertising', icon: BadgeDollarSign },
    { label: 'Messaging', href: '/app/messaging', icon: Mail },
    { label: 'Web & Conversion', href: '/app/web', icon: Globe2 },
    { label: 'SEO & Discovery', href: '/app/seo', icon: FileSearch },
  ] },
  { group: 'Collaborate', items: [
    { label: 'Creators & UGC', href: '/app/creators', icon: Video },
    { label: 'Marketplace', href: '/app/marketplace', icon: Store },
    { label: 'Partnerships', href: '/app/partnerships', icon: Gift },
    { label: 'PR & Reputation', href: '/app/reputation', icon: Radio },
    { label: 'Community', href: '/app/community', icon: Users },
    { label: 'Events', href: '/app/events', icon: Calendar },
  ] },
  { group: 'Engage', items: [
    { label: 'Inbox', href: '/app/inbox', icon: Inbox },
    { label: 'Leads & Audiences', href: '/app/audiences', icon: Users },
  ] },
  { group: 'Measure', items: [
    { label: 'Analytics', href: '/app/analytics', icon: BarChart2 },
    { label: 'Finance', href: '/app/finance', icon: BadgeDollarSign },
  ] },
  { group: 'Operate', items: [{ label: 'Automations', href: '/app/automations', icon: Workflow }] },
  { group: 'Manage', items: [{ label: 'Settings', href: '/app/settings', icon: Settings }] },
]

interface SidebarProps { userEmail?: string | null; userName?: string | null; isAdmin?: boolean; workspaceType?: string | null }

export default function Sidebar({ userEmail, userName, isAdmin, workspaceType }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const initials = userName ? userName.split(' ').map(name => name[0]).join('').toUpperCase().slice(0, 2) : userEmail?.[0]?.toUpperCase() ?? '?'

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const allowlist = workspaceType ? workspaceNavAllowlist[workspaceType] : undefined
  const visibleNavGroups = navGroups
    .map(group => ({ ...group, items: allowlist?.length ? group.items.filter(item => allowlist.includes(item.href)) : group.items }))
    .filter(group => group.items.length > 0)

  return <aside className="hidden h-screen w-[240px] shrink-0 flex-col border-r border-navy-800 bg-navy-900 lg:flex">
    <div className="border-b border-navy-800 px-4 py-4"><Link href="/app/home" className="flex items-center gap-2.5"><Image src="/caption fox favicon.png" alt="Caption Fox" width={32} height={32} className="rounded-lg" /><span className="text-[15px] font-bold tracking-tight text-white">Caption Fox</span></Link></div>
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3" aria-label="Campaign Manager navigation">{visibleNavGroups.map(({ group, items }) => <div key={group ?? 'top'} className={cn(group && 'pt-3')}>
      {group && <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{group}</p>}
      {items.map(({ label, href, icon: Icon }) => { const active = pathname.startsWith(href); return <Link key={href} href={href} className={cn('group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all', active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-navy-800 hover:text-white')}><Icon size={16} className={cn('shrink-0', active ? 'text-white' : 'text-slate-400 group-hover:text-white')} /><span className="truncate">{label}</span>{active && <ChevronRight size={12} className="ml-auto opacity-60" />}</Link> })}
    </div>)}
    {isAdmin && <Link href="/admin" className={cn('mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium', pathname.startsWith('/admin') ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-navy-800 hover:text-white')}><Settings size={16} />Admin</Link>}
    </nav>
    <div className="border-t border-navy-800 px-2.5 pb-3 pt-3"><div className="flex items-center gap-2.5 rounded-lg px-3 py-2"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fox-gradient text-xs font-bold text-white">{initials}</div><div className="min-w-0 flex-1">{userName && <p className="truncate text-xs font-medium text-white">{userName}</p>}{userEmail && <p className="truncate text-xs text-slate-500">{userEmail}</p>}</div></div><button onClick={handleSignOut} className="mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-navy-800 hover:text-white"><LogOut size={14} />Sign out</button></div>
  </aside>
}
