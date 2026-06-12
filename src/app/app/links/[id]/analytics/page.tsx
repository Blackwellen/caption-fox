'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowRight, Layout } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'

export default function LinkAnalyticsPage() {
  const params = useParams()
  const router = useRouter()
  const pageId = params.id as string

  const [page, setPage] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data: pg } = await supabase.from('link_pages').select('*').eq('id', pageId).single()
        const { data: its } = await supabase.from('link_page_items').select('*')
          .eq('page_id', pageId).order('click_count', { ascending: false })
        setPage(pg)
        setItems(its ?? [])
      } catch { /* silent */ } finally { setLoading(false) }
    }
    load()
  }, [pageId])

  if (loading) return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )

  if (!page) return null

  const ctr = page.total_views > 0 ? ((page.total_clicks / page.total_views) * 100).toFixed(1) : '0.0'
  const linkItems = items.filter((i: any) => i.item_type === 'link')
  const chartData = linkItems.map((i: any) => ({
    name: (i.title ?? 'Link').slice(0, 18),
    clicks: i.click_count ?? 0,
  }))

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => router.push('/app/links')} className="text-slate-500 hover:text-blue-600">Link Pages</button>
        <ArrowRight size={13} className="text-slate-300" />
        <button onClick={() => router.push(`/app/links/${pageId}`)} className="text-slate-500 hover:text-blue-600">{page.title}</button>
        <ArrowRight size={13} className="text-slate-300" />
        <span className="font-semibold text-slate-900">Analytics</span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Views', value: page.total_views?.toLocaleString() ?? '0', color: 'text-blue-600' },
          { label: 'Total Clicks', value: page.total_clicks?.toLocaleString() ?? '0', color: 'text-emerald-600' },
          { label: 'CTR', value: `${ctr}%`, color: 'text-violet-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-5 text-center">
            <p className={cn('text-3xl font-bold', k.color)}>{k.value}</p>
            <p className="text-sm text-slate-500 mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Clicks per link chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Clicks Per Link</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="clicks" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-sm text-slate-400">
            No click data yet
          </div>
        )}
      </div>

      {/* Top links table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Link Performance</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Link</th>
              <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Clicks</th>
              <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">CTR vs Views</th>
              <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {linkItems.map((item: any) => {
              const itemCtr = page.total_views > 0 ? ((item.click_count / page.total_views) * 100).toFixed(1) : '0.0'
              return (
                <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-700 truncate max-w-[240px]">{item.title ?? 'Link'}</td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-900">{item.click_count ?? 0}</td>
                  <td className="px-5 py-3 text-right text-slate-500">{itemCtr}%</td>
                  <td className="px-5 py-3 text-right">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      item.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
                    )}>
                      {item.is_active ? 'Active' : 'Paused'}
                    </span>
                  </td>
                </tr>
              )
            })}
            {linkItems.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-400">
                  No links on this page yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        Connect full analytics tracking for real-time view data, geographic insights, and device breakdowns.
      </p>
    </div>
  )
}
