'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Eye,
  Users,
  Heart,
  Bookmark,
  TrendingUp,
  Calendar,
  Download,
  BarChart2,
  Activity,
  Table,
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton, SkeletonPage } from '@/components/ui/Skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContentPost {
  id: string
  title: string
  caption: string | null
  platform: string | null
  published_at: string | null
  status: string | null
}

interface PostAnalytics {
  id: string
  post_id: string
  recorded_at: string
  impressions: number | null
  reach: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  clicks: number | null
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  color: string
  sub?: string
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-4">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', color)}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5 tabular-nums">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtShortDate(s: string): string {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function calcEngagementRate(row: PostAnalytics): string {
  const eng = (row.likes ?? 0) + (row.comments ?? 0) + (row.shares ?? 0) + (row.saves ?? 0)
  const reach = row.reach ?? row.impressions ?? 0
  if (!reach) return '—'
  return ((eng / reach) * 100).toFixed(2) + '%'
}

// ─── Breakdown Table ──────────────────────────────────────────────────────────

function BreakdownTable({ data }: { data: PostAnalytics[] }) {
  const cols = [
    { key: 'recorded_at', label: 'Date' },
    { key: 'impressions', label: 'Impressions' },
    { key: 'reach', label: 'Reach' },
    { key: 'likes', label: 'Likes' },
    { key: 'comments', label: 'Comments' },
    { key: 'shares', label: 'Shares' },
    { key: 'saves', label: 'Saves' },
    { key: 'clicks', label: 'Clicks' },
  ]

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {cols.map(c => (
              <th key={c.key} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map(row => (
            <tr key={row.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">{fmtShortDate(row.recorded_at)}</td>
              <td className="px-4 py-3 text-slate-600 tabular-nums">{fmt(row.impressions)}</td>
              <td className="px-4 py-3 text-slate-600 tabular-nums">{fmt(row.reach)}</td>
              <td className="px-4 py-3 text-slate-600 tabular-nums">{fmt(row.likes)}</td>
              <td className="px-4 py-3 text-slate-600 tabular-nums">{fmt(row.comments)}</td>
              <td className="px-4 py-3 text-slate-600 tabular-nums">{fmt(row.shares)}</td>
              <td className="px-4 py-3 text-slate-600 tabular-nums">{fmt(row.saves)}</td>
              <td className="px-4 py-3 text-slate-600 tabular-nums">{fmt(row.clicks)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function downloadCSV(data: PostAnalytics[], title: string) {
  const headers = ['Date', 'Impressions', 'Reach', 'Likes', 'Comments', 'Shares', 'Saves', 'Clicks']
  const rows = data.map(r => [
    r.recorded_at,
    r.impressions ?? '',
    r.reach ?? '',
    r.likes ?? '',
    r.comments ?? '',
    r.shares ?? '',
    r.saves ?? '',
    r.clicks ?? '',
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/\s+/g, '_')}_analytics.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Chart tooltip style ──────────────────────────────────────────────────────

const tooltipStyle = {
  contentStyle: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 12,
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PostAnalyticsDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [post, setPost] = useState<ContentPost | null>(null)
  const [analytics, setAnalytics] = useState<PostAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: postData }, { data: analyticsData }] = await Promise.all([
        supabase
          .from('content_posts')
          .select('id, title, caption, platform, published_at, status')
          .eq('id', id)
          .single(),
        supabase
          .from('post_analytics')
          .select('*')
          .eq('post_id', id)
          .order('recorded_at', { ascending: true }),
      ])
      setPost(postData ?? null)
      setAnalytics(analyticsData ?? [])
      setLoading(false)
    }
    if (id) load()
  }, [id])

  // ── Aggregates ──────────────────────────────────────────────────────────────

  const totalImpressions = analytics.reduce((s, r) => s + (r.impressions ?? 0), 0)
  const totalReach = analytics.reduce((s, r) => s + (r.reach ?? 0), 0)
  const totalSaves = analytics.reduce((s, r) => s + (r.saves ?? 0), 0)
  const totalEng = analytics.reduce(
    (s, r) => s + (r.likes ?? 0) + (r.comments ?? 0) + (r.shares ?? 0) + (r.saves ?? 0),
    0,
  )
  const engRate = totalReach > 0 ? ((totalEng / totalReach) * 100).toFixed(2) + '%' : '—'

  // ── Chart data ──────────────────────────────────────────────────────────────

  const chartData = analytics.map(r => ({
    date: fmtShortDate(r.recorded_at),
    impressions: r.impressions ?? 0,
    reach: r.reach ?? 0,
    likes: r.likes ?? 0,
    comments: r.comments ?? 0,
    shares: r.shares ?? 0,
    saves: r.saves ?? 0,
    clicks: r.clicks ?? 0,
    engRate: (() => {
      const eng = (r.likes ?? 0) + (r.comments ?? 0) + (r.shares ?? 0) + (r.saves ?? 0)
      const reach = r.reach ?? r.impressions ?? 0
      return reach ? parseFloat(((eng / reach) * 100).toFixed(2)) : 0
    })(),
  }))

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Activity size={14} /> },
    { id: 'engagement', label: 'Engagement', icon: <Heart size={14} /> },
    { id: 'reach', label: 'Reach & Impressions', icon: <Users size={14} /> },
    { id: 'raw', label: 'Raw Data', icon: <Table size={14} /> },
  ]

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) return <SkeletonPage />

  // ── Not found ───────────────────────────────────────────────────────────────

  if (!post) {
    return (
      <div className="p-6">
        <EmptyState
          icon={BarChart2}
          title="Post not found"
          description="This post doesn't exist or you don't have access."
          action={{ label: 'Back to Analytics', onClick: () => router.push('/app/analytics') }}
        />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => router.push('/app/analytics')}
            className="mt-0.5 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{post.title}</h1>
              {post.platform && (
                <Badge variant="blue" className="capitalize">{post.platform}</Badge>
              )}
              {post.status && (
                <Badge status={post.status} dot className="capitalize">{post.status.replace('_', ' ')}</Badge>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
              <Calendar size={13} />
              {post.published_at ? `Published ${fmtDate(post.published_at)}` : 'Not yet published'}
            </p>
          </div>
        </div>
        {analytics.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={() => downloadCSV(analytics, post.title)}
          >
            Export CSV
          </Button>
        )}
      </div>

      {/* ── KPI Strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Impressions" value={fmt(totalImpressions)} icon={Eye} color="bg-blue-600" sub="All time" />
        <KpiCard label="Total Reach" value={fmt(totalReach)} icon={Users} color="bg-violet-600" sub="Unique accounts" />
        <KpiCard label="Engagement Rate" value={engRate} icon={TrendingUp} color="bg-emerald-600" sub="Eng / Reach" />
        <KpiCard label="Total Saves" value={fmt(totalSaves)} icon={Bookmark} color="bg-amber-500" sub="Bookmarks" />
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* ── No data fallback ──────────────────────────────────────────────── */}
      {analytics.length === 0 ? (
        <EmptyState
          icon={BarChart2}
          title="No analytics data yet"
          description="Analytics will appear here once this post starts collecting performance data."
          compact
        />
      ) : (
        <div className="space-y-6">

          {/* ────────────────── OVERVIEW ────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Eye size={14} className="text-blue-600" />
                  Impressions Over Time
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} {...tooltipStyle}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                    <Tooltip {...tooltipStyle} formatter={(v) => [fmt(Number(v ?? 0)), 'Impressions']} />
                    <Line
                      type="monotone"
                      dataKey="impressions"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={{ fill: '#2563eb', r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Daily Breakdown</h3>
                <BreakdownTable data={analytics} />
              </div>
            </div>
          )}

          {/* ────────────────── ENGAGEMENT ──────────────────────────────── */}
          {activeTab === 'engagement' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Heart size={14} className="text-rose-500" />
                  Engagement Breakdown
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} barGap={2} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip {...tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="likes" fill="#f43f5e" radius={[3, 3, 0, 0]} name="Likes" />
                    <Bar dataKey="comments" fill="#8b5cf6" radius={[3, 3, 0, 0]} name="Comments" />
                    <Bar dataKey="shares" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Shares" />
                    <Bar dataKey="saves" fill="#f59e0b" radius={[3, 3, 0, 0]} name="Saves" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <TrendingUp size={14} className="text-emerald-600" />
                  Engagement Rate Over Time
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                    <Tooltip {...tooltipStyle} formatter={(v) => [`${Number(v ?? 0)}%`, 'Eng Rate']} />
                    <Line
                      type="monotone"
                      dataKey="engRate"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ fill: '#10b981', r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ────────────────── REACH & IMPRESSIONS ─────────────────────── */}
          {activeTab === 'reach' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Users size={14} className="text-violet-600" />
                Reach vs Impressions per Day
              </h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} barGap={4} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [fmt(Number(v ?? 0))]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="impressions" fill="#2563eb" radius={[3, 3, 0, 0]} name="Impressions" />
                  <Bar dataKey="reach" fill="#8b5cf6" radius={[3, 3, 0, 0]} name="Reach" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ────────────────── RAW DATA ────────────────────────────────── */}
          {activeTab === 'raw' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  {analytics.length} record{analytics.length !== 1 ? 's' : ''} total
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Download size={14} />}
                  onClick={() => downloadCSV(analytics, post.title)}
                >
                  Download CSV
                </Button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {[
                        'Record ID', 'Date', 'Impressions', 'Reach',
                        'Likes', 'Comments', 'Shares', 'Saves', 'Clicks', 'Eng Rate',
                      ].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{row.id.slice(0, 8)}…</td>
                        <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">{fmtDate(row.recorded_at)}</td>
                        <td className="px-4 py-3 text-slate-600 tabular-nums">{fmt(row.impressions)}</td>
                        <td className="px-4 py-3 text-slate-600 tabular-nums">{fmt(row.reach)}</td>
                        <td className="px-4 py-3 text-slate-600 tabular-nums">{fmt(row.likes)}</td>
                        <td className="px-4 py-3 text-slate-600 tabular-nums">{fmt(row.comments)}</td>
                        <td className="px-4 py-3 text-slate-600 tabular-nums">{fmt(row.shares)}</td>
                        <td className="px-4 py-3 text-slate-600 tabular-nums">{fmt(row.saves)}</td>
                        <td className="px-4 py-3 text-slate-600 tabular-nums">{fmt(row.clicks)}</td>
                        <td className="px-4 py-3 text-slate-600 tabular-nums font-medium">{calcEngagementRate(row)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
