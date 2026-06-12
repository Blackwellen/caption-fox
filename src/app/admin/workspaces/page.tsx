import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'

export default async function AdminWorkspacesPage() {
  const supabase = await createClient()
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Workspaces</h1>
          <p className="text-sm text-slate-500 mt-0.5">{workspaces?.length ?? 0} total workspaces</p>
        </div>
        <button className="px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700">Export</button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {['All', 'Trial', 'Paid', 'Suspended', 'High Usage'].map(f => (
          <button key={f} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${f === 'All' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{f}</button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['Workspace', 'Type', 'Plan', 'Owner', 'Created', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!workspaces || workspaces.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">No workspaces found</td></tr>
            ) : (
              workspaces.map(w => (
                <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{w.name}</td>
                  <td className="px-4 py-3"><Badge variant="default">{w.type}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={w.plan === 'starter' ? 'slate' : 'blue'}>{w.plan}</Badge></td>
                  <td className="px-4 py-3 text-slate-500">{w.owner_id?.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(w.created_at)}</td>
                  <td className="px-4 py-3"><Badge variant="green">Active</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">View</button>
                      <button className="px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 rounded">Suspend</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
