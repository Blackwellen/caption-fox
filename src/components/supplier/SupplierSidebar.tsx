'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Package, ShoppingBag, Scale, UserCircle2, Wallet, Store, LogOut, BadgeCheck, MessageSquare, CalendarDays, Star, BarChart2, Settings, Truck, ChevronRight } from 'lucide-react'
import { typeLabel } from '@/lib/marketplace/types'
import type { SupplierType } from '@/lib/marketplace/types'

type SupplierNavItem = { label: string; href: string; icon: typeof LayoutDashboard; exact?: boolean }
type SupplierNavGroup = { group: string | null; items: SupplierNavItem[] }

// Mirrors the marketer shell's grouped information architecture
// (src/components/layout/Sidebar.tsx) so both workspaces read the same way.
const navGroups: SupplierNavGroup[] = [
  { group: null, items: [{ label: 'Dashboard', href: '/supplier', icon: LayoutDashboard, exact: true }] },
  { group: 'Sell', items: [
    { label: 'Listings', href: '/supplier/listings', icon: Package },
    { label: 'Orders', href: '/supplier/orders', icon: ShoppingBag },
    { label: 'Deliveries', href: '/supplier/deliveries', icon: Truck },
  ] },
  { group: 'Engage', items: [
    { label: 'Messages', href: '/supplier/messages', icon: MessageSquare },
    { label: 'Reviews', href: '/supplier/reviews', icon: Star },
  ] },
  { group: 'Operate', items: [
    { label: 'Availability', href: '/supplier/availability', icon: CalendarDays },
    { label: 'Disputes', href: '/supplier/disputes', icon: Scale },
  ] },
  { group: 'Measure', items: [
    { label: 'Analytics', href: '/supplier/analytics', icon: BarChart2 },
    { label: 'Payouts', href: '/supplier/payouts', icon: Wallet },
  ] },
  { group: 'Manage', items: [
    { label: 'Profile', href: '/supplier/profile', icon: UserCircle2 },
    { label: 'Settings', href: '/supplier/settings', icon: Settings },
  ] },
]

export default function SupplierSidebar({
  name, type, verified, email,
}: { name: string; type: SupplierType; verified: boolean; email?: string | null }) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="hidden lg:flex w-[240px] shrink-0 h-screen bg-navy-900 flex-col border-r border-navy-800">
      <div className="px-4 py-4 border-b border-navy-800">
        <Link href="/supplier" className="flex items-center gap-2.5">
          <Image src="/caption fox favicon.png" alt="" width={30} height={30} className="rounded-lg" />
          <div className="leading-tight">
            <p className="text-white font-bold text-[13px]">Supplier workspace</p>
            <p className="text-[10px] text-slate-400">Caption Fox Marketplace</p>
          </div>
        </Link>
      </div>

      <div className="px-4 py-3 border-b border-navy-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-fox-gradient flex items-center justify-center text-xs font-bold text-white">{name[0]?.toUpperCase()}</div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate flex items-center gap-1">{name}{verified && <BadgeCheck size={13} className="text-blue-400" />}</p>
            <p className="text-[11px] text-slate-400 capitalize">{typeLabel(type)}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto" aria-label="Supplier workspace navigation">
        {navGroups.map(({ group, items }) => (
          <div key={group ?? 'top'} className={cn(group && 'pt-3')}>
            {group && <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{group}</p>}
            {items.map(({ label, href, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href)
              return (
                <Link key={href} href={href} className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                  active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-navy-800 hover:text-white',
                )}>
                  <Icon size={16} className={cn('shrink-0', active ? 'text-white' : 'text-slate-400 group-hover:text-white')} />
                  <span className="truncate">{label}</span>
                  {active && <ChevronRight size={12} className="ml-auto opacity-60" />}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="px-2.5 pb-3 border-t border-navy-800 pt-3 space-y-0.5">
        <Link href="/marketplace" className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-navy-800 hover:text-white transition-colors">
          <Store size={14} /> View marketplace
        </Link>
        <button onClick={signOut} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-navy-800 hover:text-white transition-colors">
          <LogOut size={14} /> Sign out
        </button>
        {email && <p className="px-3 text-[10px] text-slate-500 truncate">{email}</p>}
      </div>
    </aside>
  )
}
