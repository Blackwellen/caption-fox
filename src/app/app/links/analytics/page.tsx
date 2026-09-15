'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import LinksSubnav from '@/components/link-in-bio/LinksSubnav'

interface EventRow {
  id: string
  page_id: string | null
  reusable_link_id: string | null
  event_type: 'page_view' | 'link_click' | 'qr_visit'
  device_type: string | null
  created_at: string
}

const RANGE_OPTIONS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
]

export default function LinkAnalyticsPage() {
  const router = useRouter()
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<EventRow[]>([])
  const [pages, setPages] = useState<{ id: string; title: string; slug: string }[]>([])
  const [links, setLinks] = useState<{ id: string; name: string }[]>([])
  const [rangeDays, setRangeDays] = useState(30)

  useEffect(() => {
    async function bootstrap() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).single()
      if (data?.workspace_id) setWorkspaceId(data.workspace_id)
      else setLoading(false)
    }
    bootstrap()
  }, [])

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const supabase = createClient()
    const since = new Date(Date.now() - rangeDays * 86_400_000).toISOString()
    const [{ data: ev }, { data: pg }, { data: rl }] = await Promise.all([
      supabase.from('link_analytics_events').select('id, page_id, reusable_link_id, event_type, device_type, created_at')
        .eq('workspace_id', workspaceId).gte('created_at', since).order('created_at', { ascending: true }).limit(5000),
      supabase.from('link_pages').select('id, title, slug').eq('workspace_id', workspaceId),
      supabase.from('reusable_links').select('id, name').eq('workspace_id', workspaceId),
    ])
    setEvents(ev ?? [])
    setPages(pg ?? [])
    setLinks(rl ?? [])
    setLoading(false)
  }, [workspaceId, rangeDays])

  useEffect(() => { if (workspaceId) load() }, [workspaceId, load])

  const pageTitle = useMemo(() => new Map(pages.map(p => [p.id, p.title])), [pages])
  const linkName = useMemo(() => new Map(links.map(l => [l.id, l.name])), [links])

  const kpis = useMemo(() => {
    const views = events.filter(e => e.event_type === 'page_view').length
    const clicks = events.filter(e => e.event_type === 'link_click').length
    const ctr = views > 0 ? ((clicks / views) * 100).toFixed(1) : '0.0'
    const uniqueDevices = new Set(events.map(e => e.device_type ?? 'other')).size
    return [
      { label: 'Page views', value: views.toLocaleString() },
      { label: 'Clicks', value: clicks.toLocaleString() },
      { label: 'CTR', value: `${ctr}%` },
      { label: 'Device types seen', value: uniqueDevices },
    ]
  }, [events])

  const series = useMemo(() => {
    const byDay = new Map<string, { day: string; views: number; clicks: number }>()
    for (const e of events) {
      const day = e.created_at.slice(0, 10)
      const row = byDay.get(day) ?? { day, views: 0, clicks: 0 }
      if (e.event_type === 'page_view') row.views += 1
      if (e.event_type === 'link_click') row.clicks += 1
      byDay.set(day, row)
    }
    return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day))
  }, [events])

  const topPages = useMemo(() => {
    const byPage = new Map<string, { views: number; clicks: number }>()
    for (const e of events) {
      if (!e.page_id) continue
      const row = byPage.get(e.page_id) ?? { views: 0, clicks: 0 }
      if (e.event_type === 'page_view') row.views += 1
      if (e.event_type === 'link_click') row.clicks += 1
      byPage.set(e.page_id, row)
    }
    return Array.from(byPage.entries())
      .map(([id, v]) => ({ id, title: pageTitle.get(id) ?? 'Unknown page', ...v, ctr: v.views > 0 ? (v.clicks / v.views) * 100 : 0 }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8)
  }, [events, pageTitle])

  const topLinks = useMemo(() => {
    const byLink = new Map<string, number>()
    for (const e of events) {
      if (!e.reusable_link_id || e.event_type !== 'link_click') continue
      byLink.set(e.reusable_link_id, (byLink.get(e.reusable_link_id) ?? 0) + 1)
    }
    return Array.from(byLink.entries())
      .map(([id, clicks]) => ({ id, name: linkName.get(id) ?? 'Unknown link', clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 8)
  }, [events, linkName])

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <LinksSubnav active="analytics" />
      <PageHeader title="Analytics" subtitle="Real click and view data from your link pages and reusable links.">
        <select value={rangeDays} onChange={e => setRangeDays(Number(e.target.value))} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700">
          {RANGE_OPTIONS.map(o => <option key={o.days} value={o.days}>{o.label}</option>)}
        </select>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-500 mb-1">{k.label}</p>
            <p className="text-2xl font-bold text-slate-900">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Views &amp; clicks over time</h2>
        {loading ? <Skeleton className="h-56 w-full" /> : series.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-slate-400">No data in this range yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={series} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="views" stroke="#2563EB" fill="url(#viewsGrad)" name="Views" />
              <Area type="monotone" dataKey="clicks" stroke="#10B981" fillOpacity={0} name="Clicks" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100"><h2 className="text-sm font-semibold text-slate-900">Top pages</h2></div>
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-2">Page</th>
              <th className="text-right text-xs font-semibold text-slate-500 uppercase px-4 py-2">Views</th>
              <th className="text-right text-xs font-semibold text-slate-500 uppercase px-4 py-2">CTR</th>
            </tr></thead>
            <tbody>
              {topPages.map(p => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/app/links/${p.id}`)}>
                  <td className="px-4 py-2.5 text-slate-700 truncate max-w-[220px] flex items-center gap-1">{p.title} <ArrowUpRight size={11} className="text-slate-300" /></td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{p.views}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500">{p.ctr.toFixed(1)}%</td>
                </tr>
              ))}
              {topPages.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-400">No page views yet</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100"><h2 className="text-sm font-semibold text-slate-900">Top reusable links</h2></div>
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-2">Link</th>
              <th className="text-right text-xs font-semibold text-slate-500 uppercase px-4 py-2">Clicks</th>
            </tr></thead>
            <tbody>
              {topLinks.map(l => (
                <tr key={l.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/app/links/reusable-links/${l.id}`)}>
                  <td className="px-4 py-2.5 text-slate-700 truncate max-w-[220px] flex items-center gap-1">{l.name} <ArrowUpRight size={11} className="text-slate-300" /></td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{l.clicks}</td>
                </tr>
              ))}
              {topLinks.length === 0 && <tr><td colSpan={2} className="px-4 py-8 text-center text-sm text-slate-400">No link clicks yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
