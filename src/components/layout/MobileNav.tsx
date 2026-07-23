'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Wand2, Calendar, Inbox, Menu, X, Megaphone, Video, Link2, BarChart2, Radio, Settings, Store, Target, BadgeDollarSign, Workflow, Users, Globe2, Mail, FileSearch, LibraryBig, Gift } from 'lucide-react'
import { cn } from '@/lib/utils'

const primary = [
  { label: 'Home', href: '/app/home', icon: Home }, { label: 'Studio', href: '/app/studio', icon: Wand2 },
  { label: 'Calendar', href: '/app/calendar', icon: Calendar }, { label: 'Inbox', href: '/app/inbox', icon: Inbox },
]

const groups = [
  { label: 'Plan', items: [{ label: 'Strategy', href: '/app/strategy', icon: Target }, { label: 'Campaigns', href: '/app/campaigns', icon: Megaphone }] },
  { label: 'Create', items: [{ label: 'Brand & Assets', href: '/app/brand', icon: LibraryBig }, { label: 'Link in Bio', href: '/app/links', icon: Link2 }] },
  { label: 'Promote', items: [{ label: 'Social', href: '/app/social', icon: Radio }, { label: 'Advertising', href: '/app/advertising', icon: BadgeDollarSign }, { label: 'Messaging', href: '/app/messaging', icon: Mail }, { label: 'Web & Conversion', href: '/app/web', icon: Globe2 }, { label: 'SEO & Discovery', href: '/app/seo', icon: FileSearch }] },
  { label: 'Collaborate', items: [{ label: 'Creators & UGC', href: '/app/creators', icon: Video }, { label: 'Marketplace', href: '/app/marketplace', icon: Store }, { label: 'Partnerships', href: '/app/partnerships', icon: Gift }, { label: 'PR & Reputation', href: '/app/reputation', icon: Radio }, { label: 'Community', href: '/app/community', icon: Users }, { label: 'Events', href: '/app/events', icon: Calendar }] },
  { label: 'Engage', items: [{ label: 'Leads & Audiences', href: '/app/audiences', icon: Users }] },
  { label: 'Measure', items: [{ label: 'Analytics', href: '/app/analytics', icon: BarChart2 }, { label: 'Finance', href: '/app/finance', icon: BadgeDollarSign }] },
  { label: 'Operate', items: [{ label: 'Automations', href: '/app/automations', icon: Workflow }] },
  { label: 'Manage', items: [{ label: 'Settings', href: '/app/settings', icon: Settings }] },
]

const workspaceNavAllowlist: Record<string, string[]> = {
  creator: ['/app/strategy', '/app/campaigns', '/app/brand', '/app/links', '/app/social', '/app/marketplace', '/app/inbox', '/app/analytics', '/app/settings'],
  small_business: ['/app/strategy', '/app/campaigns', '/app/brand', '/app/links', '/app/social', '/app/messaging', '/app/web', '/app/marketplace', '/app/audiences', '/app/analytics', '/app/settings'],
  brand: [],
  agency: [],
}

export default function MobileNav({ workspaceType }: { workspaceType?: string | null }) {
  const pathname = usePathname()
  const [sheet, setSheet] = useState(false)
  const allowlist = workspaceType ? workspaceNavAllowlist[workspaceType] : undefined
  const visibleGroups = groups.map(group => ({ ...group, items: allowlist?.length ? group.items.filter(item => allowlist.includes(item.href)) : group.items })).filter(group => group.items.length > 0)
  return <>{sheet && <div className="fixed inset-0 z-[60] lg:hidden"><button className="absolute inset-0 bg-slate-900/40" onClick={() => setSheet(false)} aria-label="Close menu" /><div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-slate-900">Campaign Manager</p><button onClick={() => setSheet(false)} className="p-1 text-slate-400" aria-label="Close menu"><X size={18} /></button></div>{visibleGroups.map(group => <div key={group.label} className="mb-4"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</p><div className="grid grid-cols-3 gap-2">{group.items.map(({ label, href, icon: Icon }) => <Link key={href} href={href} onClick={() => setSheet(false)} className={cn('flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-3 text-center text-xs font-medium', pathname.startsWith(href) ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50')}><Icon size={19} />{label}</Link>)}</div></div>)}</div></div>}
    <nav className="fixed inset-x-0 bottom-0 z-50 flex items-stretch border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">{primary.map(({ label, href, icon: Icon }) => <Link key={href} href={href} className={cn('flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium', pathname.startsWith(href) ? 'text-blue-600' : 'text-slate-500')}><Icon size={20} />{label}</Link>)}<button onClick={() => setSheet(true)} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-slate-500"><Menu size={20} />More</button></nav>
  </>
}
