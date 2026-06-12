import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { LayoutDashboard, Building2, Users, CreditCard, Brain, Wifi, Video, Headphones, ShieldAlert, Settings, BarChart2, ScrollText, ArrowLeft } from 'lucide-react'

const adminNav = [
  { label: 'Admin Home',          href: '/admin',                    icon: LayoutDashboard },
  { label: 'Workspaces',          href: '/admin/workspaces',         icon: Building2 },
  { label: 'Users',               href: '/admin/users',              icon: Users },
  { label: 'Plans & Billing',     href: '/admin/plans',              icon: CreditCard },
  { label: 'Content & AI',        href: '/admin/content-ai',         icon: Brain },
  { label: 'Social Connections',  href: '/admin/social-connections', icon: Wifi },
  { label: 'UGC Oversight',       href: '/admin/ugc-oversight',      icon: Video },
  { label: 'Support Inbox',       href: '/admin/support',            icon: Headphones },
  { label: 'Compliance & Abuse',  href: '/admin/compliance',         icon: ShieldAlert },
  { label: 'System Settings',     href: '/admin/system-settings',    icon: Settings },
  { label: 'Platform Analytics',  href: '/admin/platform-analytics', icon: BarChart2 },
  { label: 'Audit Logs',          href: '/admin/audit-logs',         icon: ScrollText },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_platform_admin').eq('id', user.id).single()
  if (!profile?.is_platform_admin) redirect('/app/home')

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Admin sidebar */}
      <aside className="w-56 shrink-0 bg-slate-900 flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-slate-800">
          <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-0.5">Admin Panel</p>
          <p className="text-white font-bold text-sm">Caption Fox</p>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {adminNav.map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
              <Icon size={14} className="shrink-0" />{label}
            </Link>
          ))}
        </nav>
        <div className="px-2 pb-4 border-t border-slate-800 pt-3">
          <Link href="/app/home" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
            <ArrowLeft size={13} /> Back to App
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
