'use client'

import { useEffect, useState, useCallback } from 'react'
import { AlertTriangle, Bell, Sparkles, Check } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { createClient } from '@/lib/supabase/client'
import { formatRelative, cn } from '@/lib/utils'
import type { ListeningAlert, Notification } from '@/types/database'

const CHANNELS = [
  { key: 'email', label: 'Email' },
  { key: 'in_app', label: 'In-app' },
]

export function AlertsTab({ workspaceId, onCountChange }: { workspaceId: string; onCountChange: (n: number) => void }) {
  const [alerts, setAlerts] = useState<ListeningAlert[] | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [prefs, setPrefs] = useState<Record<string, boolean>>({ email: true, in_app: true })
  const [tab, setTab] = useState<'current' | 'resolved' | 'preferences'>('current')

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    const [{ data: la }, { data: notifs }, { data: profile }] = await Promise.all([
      sb.from('listening_alerts').select('*').eq('workspace_id', workspaceId).order('triggered_at', { ascending: false }).limit(50),
      user ? sb.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
      user ? sb.from('profiles').select('notification_preferences').eq('id', user.id).single() : Promise.resolve({ data: null }),
    ])
    setAlerts((la as ListeningAlert[]) ?? [])
    setNotifications((notifs as Notification[]) ?? [])
    const savedPrefs = (profile?.notification_preferences as Record<string, boolean> | undefined)?.foxAlerts as Record<string, boolean> | undefined
    if (savedPrefs) setPrefs(savedPrefs)
    const unread = ((la as ListeningAlert[]) ?? []).filter(a => !a.is_read).length + ((notifs as Notification[]) ?? []).filter(n => !n.is_read).length
    onCountChange(unread)
  }, [workspaceId, onCountChange])

  useEffect(() => { load() }, [load])

  async function markRead(alert: ListeningAlert) {
    const sb = createClient()
    await sb.from('listening_alerts').update({ is_read: true }).eq('id', alert.id)
    load()
  }

  async function togglePref(key: string) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    const { data: profile } = await sb.from('profiles').select('notification_preferences').eq('id', user.id).single()
    const merged = { ...(profile?.notification_preferences as Record<string, unknown> ?? {}), foxAlerts: next }
    await sb.from('profiles').update({ notification_preferences: merged }).eq('id', user.id)
  }

  const current = (alerts ?? []).filter(a => !a.is_read)
  const resolved = (alerts ?? []).filter(a => a.is_read)

  return (
    <div className="max-h-[560px] overflow-y-auto p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-500"><AlertTriangle size={16} /></div>
        <div><p className="text-sm font-semibold text-slate-900">Alerts</p><p className="text-xs text-slate-500">Listening alerts and notifications</p></div>
      </div>

      <div className="mb-3 flex gap-1.5">
        {(['current', 'resolved', 'preferences'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn('rounded-full px-2.5 py-1 text-xs font-medium capitalize', tab === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}>{t}</button>
        ))}
      </div>

      {tab === 'preferences' ? (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Notification destinations</p>
          {CHANNELS.map(c => (
            <label key={c.key} className="flex items-center justify-between py-1.5 text-sm">
              {c.label}
              <button onClick={() => togglePref(c.key)} className={cn('h-5 w-9 rounded-full transition-colors', prefs[c.key] ? 'bg-blue-600' : 'bg-slate-200')}>
                <span className={cn('block h-4 w-4 translate-x-0.5 rounded-full bg-white transition-transform', prefs[c.key] && 'translate-x-4')} />
              </button>
            </label>
          ))}
        </div>
      ) : alerts === null ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
      ) : (tab === 'current' ? current : resolved).length === 0 ? (
        <div className="py-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-fox-50"><Sparkles size={20} className="text-blue-500" /></div>
          <p className="text-sm font-medium text-slate-700">No {tab} alerts</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {(tab === 'current' ? current : resolved).map(a => (
            <div key={a.id} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2.5">
              <Bell size={14} className="mt-0.5 shrink-0 text-amber-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">{a.title}</p>
                {a.message && <p className="text-xs text-slate-500">{a.message}</p>}
                <p className="mt-0.5 text-[11px] text-slate-400">{formatRelative(a.triggered_at)}</p>
              </div>
              {tab === 'current' && <button onClick={() => markRead(a)} className="shrink-0 rounded p-1 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title="Mark resolved"><Check size={14} /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
