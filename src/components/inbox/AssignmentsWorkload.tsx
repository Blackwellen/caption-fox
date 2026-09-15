'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface Row { id: string; name: string; open: number; slaAtRisk: number }

/**
 * Real per-member active-assignment load for the Assignments page — counted
 * from inbox_threads.assigned_to, not decorative bars.
 */
export function AssignmentsWorkload({ workspaceId }: { workspaceId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    const sb = createClient()
    let cancelled = false
    async function load() {
      const { data: members } = await sb
        .from('workspace_members')
        .select('user_id, profiles(id, full_name, email)')
        .eq('workspace_id', workspaceId)
      const { data: threads } = await sb
        .from('inbox_threads')
        .select('assigned_to, sla_state')
        .eq('workspace_id', workspaceId)
        .in('status', ['open', 'assigned'])
        .not('assigned_to', 'is', null)

      const byUser = new Map<string, { open: number; slaAtRisk: number }>()
      for (const t of threads ?? []) {
        const id = t.assigned_to as string
        const cur = byUser.get(id) ?? { open: 0, slaAtRisk: 0 }
        cur.open += 1
        if (t.sla_state === 'warning' || t.sla_state === 'breached') cur.slaAtRisk += 1
        byUser.set(id, cur)
      }

      const list: Row[] = ((members ?? []) as unknown as { user_id: string; profiles: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] }[])
        .map(m => {
          const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
          const load = byUser.get(m.user_id) ?? { open: 0, slaAtRisk: 0 }
          return { id: m.user_id, name: p?.full_name ?? p?.email ?? 'Unknown', ...load }
        })
        .filter(r => r.open > 0)
        .sort((a, b) => b.open - a.open)

      if (!cancelled) setRows(list)
    }
    load()
    return () => { cancelled = true }
  }, [workspaceId])

  const max = Math.max(1, ...(rows ?? []).map(r => r.open))

  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Team workload</p>
      {rows === null ? (
        <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">No active assignments yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="flex items-center gap-3 text-sm">
              <span className="w-32 shrink-0 truncate text-slate-700">{r.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className={cn('h-full rounded-full', r.slaAtRisk > 0 ? 'bg-amber-500' : 'bg-blue-500')} style={{ width: `${(r.open / max) * 100}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right font-medium text-slate-800">{r.open}</span>
              {r.slaAtRisk > 0 && <span className="shrink-0 text-xs font-medium text-amber-600">{r.slaAtRisk} at risk</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
