'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { workspaceRouteSegment } from '@/lib/workspace-shared'
import { visibleNavGroups } from '@/lib/nav-config'
import { LogOut, ChevronRight, Settings } from 'lucide-react'

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

  const typedBase = workspaceRouteSegment(workspaceType)
  const groups = visibleNavGroups(workspaceType)

  return <aside className="hidden h-screen w-[240px] shrink-0 flex-col border-r border-navy-800 bg-navy-900 lg:flex">
    <div className="border-b border-navy-800 px-4 py-4"><Link href="/app/home" className="flex items-center gap-2.5"><Image src="/caption fox favicon.png" alt="Caption Fox" width={32} height={32} className="rounded-lg" /><span className="text-[15px] font-bold tracking-tight text-white">Caption Fox</span></Link></div>
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3" aria-label="Campaign Manager navigation">{groups.map(({ label: groupLabel, items }) => <div key={groupLabel ?? 'top'} className={cn(groupLabel && 'pt-3')}>
      {groupLabel && <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{groupLabel}</p>}
      {items.map(({ id, label, href: hrefFor, icon: Icon }) => { const href = hrefFor(typedBase); const active = pathname.startsWith(href); return <Link key={id} href={href} className={cn('group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all', active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-navy-800 hover:text-white')}><Icon size={16} className={cn('shrink-0', active ? 'text-white' : 'text-slate-400 group-hover:text-white')} /><span className="truncate">{label}</span>{active && <ChevronRight size={12} className="ml-auto opacity-60" />}</Link> })}
    </div>)}
    {isAdmin && <Link href="/admin" className={cn('mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium', pathname.startsWith('/admin') ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-navy-800 hover:text-white')}><Settings size={16} />Admin</Link>}
    </nav>
    <div className="border-t border-navy-800 px-2.5 pb-3 pt-3"><div className="flex items-center gap-2.5 rounded-lg px-3 py-2"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fox-gradient text-xs font-bold text-white">{initials}</div><div className="min-w-0 flex-1">{userName && <p className="truncate text-xs font-medium text-white">{userName}</p>}{userEmail && <p className="truncate text-xs text-slate-500">{userEmail}</p>}</div></div><button onClick={handleSignOut} className="mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-navy-800 hover:text-white"><LogOut size={14} />Sign out</button></div>
  </aside>
}
