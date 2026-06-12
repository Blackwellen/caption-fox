import { createClient } from '@/lib/supabase/server'
import { Tabs } from '@/components/ui/Tabs'
import { Badge } from '@/components/ui/Badge'

export default async function AdminHomePage() {
  const supabase = await createClient()
  const [{ count: workspaceCount }, { count: userCount }] = await Promise.all([
    supabase.from('workspaces').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
  ])

  const kpis = [
    { label: 'Total Workspaces', value: workspaceCount ?? 0, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total Users', value: userCount ?? 0, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Active Subscriptions', value: 0, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'MRR', value: '£0', color: 'text-amber-600', bg: 'bg-amber-50' },
  ]

  const health = [
    { name: 'Database', ok: true }, { name: 'Auth', ok: true },
    { name: 'Storage', ok: true }, { name: 'AI API', ok: false },
  ]

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Platform overview and health monitoring.</p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* System Health */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-4">System Health</h3>
          <div className="space-y-2.5">
            {health.map(h => (
              <div key={h.name} className="flex items-center justify-between">
                <span className="text-sm text-slate-700">{h.name}</span>
                <Badge variant={h.ok ? 'green' : 'red'}>{h.ok ? 'Operational' : 'Check needed'}</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { label: 'View all workspaces', href: '/admin/workspaces' },
              { label: 'Open support queue', href: '/admin/support' },
              { label: 'Check audit logs', href: '/admin/audit-logs' },
              { label: 'Review AI usage', href: '/admin/content-ai' },
            ].map(a => (
              <a key={a.label} href={a.href} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-sm text-slate-700 font-medium">
                {a.label}
                <span className="text-slate-400 text-xs">→</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
