'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { workspaceRouteSegment } from '@/lib/workspace-shared'
import { NAV_GROUPS, visibleNavGroups, type NavItemId } from '@/lib/nav-config'

// These four always have a permanent slot in the bottom bar, independent of
// the workspace-type allowlist. The "More" sheet built from
// visibleNavGroups() below omits them to avoid duplicates.
const PRIMARY_IDS: NavItemId[] = ['home', 'studio', 'calendar', 'inbox']
const ALL_ITEMS = NAV_GROUPS.flatMap(group => group.items)

export default function MobileNav({ workspaceType }: { workspaceType?: string | null }) {
  const pathname = usePathname()
  const [sheet, setSheet] = useState(false)
  const typedBase = workspaceRouteSegment(workspaceType)
  const primary = PRIMARY_IDS.map(id => ALL_ITEMS.find(item => item.id === id)).filter(item => item !== undefined)
  const moreGroups = visibleNavGroups(workspaceType)
    .map(group => ({ ...group, items: group.items.filter(item => !PRIMARY_IDS.includes(item.id)) }))
    .filter(group => group.items.length > 0)

  return <>{sheet && <div className="fixed inset-0 z-[60] lg:hidden"><button className="absolute inset-0 bg-slate-900/40" onClick={() => setSheet(false)} aria-label="Close menu" /><div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-slate-900">Campaign Manager</p><button onClick={() => setSheet(false)} className="p-1 text-slate-400" aria-label="Close menu"><X size={18} /></button></div>{moreGroups.map(group => <div key={group.label ?? 'top'} className="mb-4"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</p><div className="grid grid-cols-3 gap-2">{group.items.map(({ id, label, href: hrefFor, icon: Icon }) => { const href = hrefFor(typedBase); return <Link key={id} href={href} onClick={() => setSheet(false)} className={cn('flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-3 text-center text-xs font-medium', pathname.startsWith(href) ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50')}><Icon size={19} />{label}</Link> })}</div></div>)}</div></div>}
    <nav className="fixed inset-x-0 bottom-0 z-50 flex items-stretch border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">{primary.map(({ id, label, href: hrefFor, icon: Icon }) => { const href = hrefFor(typedBase); return <Link key={id} href={href} className={cn('flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium', pathname.startsWith(href) ? 'text-blue-600' : 'text-slate-500')}><Icon size={20} />{label}</Link> })}<button onClick={() => setSheet(true)} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-slate-500"><Menu size={20} />More</button></nav>
  </>
}
