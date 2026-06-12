import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500 mt-0.5">{profiles?.length ?? 0} total users</p>
        </div>
        <div className="flex gap-2">
          <input className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Search users…" />
          <button className="px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700">Export</button>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        {['All', 'Owners', 'Team Members', 'Admins', 'Disabled'].map(f => (
          <button key={f} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${f === 'All' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{f}</button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['User', 'Email', 'Admin', 'MFA', 'Joined', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!profiles || profiles.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">No users found</td></tr>
            ) : (
              profiles.map(p => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">{(p.full_name ?? p.email)[0].toUpperCase()}</div>
                      <span className="font-medium text-slate-900">{p.full_name ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.email}</td>
                  <td className="px-4 py-3"><Badge variant={p.is_platform_admin ? 'red' : 'slate'}>{p.is_platform_admin ? 'Admin' : 'User'}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={p.mfa_enabled ? 'green' : 'amber'}>{p.mfa_enabled ? 'Enabled' : 'Off'}</Badge></td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(p.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">View</button>
                      <button className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded">Disable</button>
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
