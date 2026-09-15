'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Copy, ExternalLink, Trash2, CheckCircle, X } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'

interface ReusableLink {
  id: string
  workspace_id: string
  name: string
  destination_url: string
  vanity_slug: string | null
  label: string | null
  status: string
  utm: Record<string, string>
  click_count: number
  tags: string[]
  created_at: string
  updated_at: string
}

interface EventRow { id: string; created_at: string; device_type: string | null }

function getAppUrl() { return typeof window !== 'undefined' ? window.location.origin : 'https://captionfox.app' }

const UTM_FIELDS = ['source', 'medium', 'campaign', 'term', 'content'] as const

export default function ReusableLinkDetail() {
  const params = useParams()
  const router = useRouter()
  const linkId = params.id as string

  const [link, setLink] = useState<ReusableLink | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [form, setForm] = useState({ name: '', destination_url: '', vanity_slug: '', label: '', status: 'active', utm: {} as Record<string, string> })
  const [error, setError] = useState<string | null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: l } = await supabase.from('reusable_links').select('*').eq('id', linkId).single()
    const { data: ev } = await supabase.from('link_analytics_events').select('id, created_at, device_type').eq('reusable_link_id', linkId).order('created_at', { ascending: true }).limit(2000)
    if (l) {
      setLink(l)
      setForm({ name: l.name, destination_url: l.destination_url, vanity_slug: l.vanity_slug ?? '', label: l.label ?? '', status: l.status, utm: l.utm ?? {} })
    }
    setEvents(ev ?? [])
    setLoading(false)
  }, [linkId])

  useEffect(() => { load() }, [load])

  const dailyClicks = useMemo(() => {
    const byDay = new Map<string, number>()
    for (const e of events) {
      const day = e.created_at.slice(0, 10)
      byDay.set(day, (byDay.get(day) ?? 0) + 1)
    }
    return Array.from(byDay.entries()).map(([day, clicks]) => ({ day: day.slice(5), clicks })).slice(-30)
  }, [events])

  const deviceBreakdown = useMemo(() => {
    const byDevice = new Map<string, number>()
    for (const e of events) byDevice.set(e.device_type ?? 'other', (byDevice.get(e.device_type ?? 'other') ?? 0) + 1)
    return Array.from(byDevice.entries())
  }, [events])

  async function save() {
    if (!link) return
    if (!form.name.trim()) { setError('Name is required'); return }
    try { new URL(form.destination_url) } catch { setError('Enter a valid destination URL'); return }
    setSaving(true); setError(null)
    try {
      const supabase = createClient()
      const { data, error: err } = await supabase.from('reusable_links').update({
        name: form.name, destination_url: form.destination_url,
        vanity_slug: form.vanity_slug ? form.vanity_slug.toLowerCase().replace(/[^a-z0-9-]/g, '') : null,
        label: form.label || null, status: form.status, utm: form.utm,
      }).eq('id', link.id).select().single()
      if (err) { if (err.code === '23505') throw new Error('That vanity slug is already taken'); throw err }
      setLink(data)
      showToast('Saved')
    } catch (e: any) { setError(e.message ?? 'Failed to save') } finally { setSaving(false) }
  }

  async function confirmDelete() {
    if (!link) return
    const supabase = createClient()
    await supabase.from('reusable_links').delete().eq('id', link.id)
    router.push('/app/links/library')
  }

  if (loading || !link) {
    return <div className="p-6 max-w-5xl mx-auto space-y-4"><Skeleton className="h-10 w-80" /><Skeleton className="h-96 w-full rounded-xl" /></div>
  }

  const shareUrl = link.vanity_slug ? `${getAppUrl()}/r/${link.vanity_slug}` : link.destination_url

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <button onClick={() => router.push('/app/links/library')} className="hover:text-blue-600">Link Library</button>
            <span>/</span><span className="text-slate-600">{link.name}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">{link.name}</h1>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5">
            <Badge status={link.status}>{link.status}</Badge>
            <span>Updated {new Date(link.updated_at).toLocaleDateString('en-GB')}</span>
            {link.vanity_slug && <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">{shareUrl.replace('https://', '')} <ExternalLink size={10} /></a>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { navigator.clipboard.writeText(shareUrl); showToast('Copied!') }} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"><Copy size={13} /> Copy link</button>
          <button onClick={() => setShowDelete(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"><Trash2 size={13} /> Delete</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center"><p className="text-2xl font-bold text-slate-900">{link.click_count.toLocaleString()}</p><p className="text-xs text-slate-500 mt-1">Total clicks</p></div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center"><p className="text-2xl font-bold text-slate-900">{events.length}</p><p className="text-xs text-slate-500 mt-1">Tracked events</p></div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center"><p className="text-2xl font-bold text-slate-900">{Object.values(form.utm).filter(Boolean).length}</p><p className="text-xs text-slate-500 mt-1">UTM tags set</p></div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Clicks over time</h3>
        {dailyClicks.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyClicks} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip />
              <Bar dataKey="clicks" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <div className="h-32 flex items-center justify-center text-sm text-slate-400">No clicks tracked yet</div>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Link details</h3>
          {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><X size={14} /> {error}</div>}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Name</label>
            <input type="text" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Destination URL</label>
            <input type="url" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900" value={form.destination_url} onChange={e => setForm(f => ({ ...f, destination_url: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Vanity slug</label>
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
              <span className="px-3 py-2.5 text-xs text-slate-400 bg-slate-50 border-r border-slate-200 whitespace-nowrap">{getAppUrl()}/r/</span>
              <input type="text" className="flex-1 px-3 py-2.5 text-sm text-slate-900 focus:outline-none" value={form.vanity_slug} onChange={e => setForm(f => ({ ...f, vanity_slug: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Status</label>
            <select className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">UTM parameters</h3>
          {UTM_FIELDS.map(field => (
            <div key={field}>
              <label className="block text-xs font-medium text-slate-700 mb-1.5 capitalize">utm_{field}</label>
              <input type="text" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900" value={form.utm[field] ?? ''} onChange={e => setForm(f => ({ ...f, utm: { ...f.utm, [field]: e.target.value } }))} />
            </div>
          ))}
          <Button variant="primary" loading={saving} onClick={save} className="w-full">Save changes</Button>
        </div>
      </div>

      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete reusable link" description={`Delete "${link.name}"? This cannot be undone.`} size="sm"
        footer={<><Button variant="secondary" onClick={() => setShowDelete(false)}>Cancel</Button><Button variant="danger" onClick={confirmDelete}>Delete</Button></>}>
        <p className="text-sm text-slate-600">All click analytics for this link will also be removed.</p>
      </Modal>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white text-sm font-medium rounded-xl shadow-xl">
          <CheckCircle size={14} className="text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  )
}
