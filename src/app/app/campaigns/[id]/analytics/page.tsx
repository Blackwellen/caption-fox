'use client'

import { useState, useEffect, useMemo } from 'react'
import { use } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus, Camera, Eye, Activity,
  Users, DollarSign, BarChart2, ArrowLeft, ExternalLink,
  Target, Layers,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Tabs } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn, formatDate, truncate } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Campaign {
  id: string
  name: string
  status: string
  start_date: string | null
  end_date: string | null
  budget: number | null
  actual_spend: number | null
  workspace_id: string
}

interface ContentPost {
  id: string
  caption: string
  platform: string
  post_type: string
  published_at: string | null
  campaign_id: string | null
}

interface PostAnalytic {
  id: string
  post_id: string
  date: string
  impressions: number
  reach: number
  likes: number
  comments: number
  shares: number
  saves: number
  engagement_rate: number
}

interface EnrichedPost extends ContentPost {
  impressions: number
  reach: number
  likes: number
  comments: number
  shares: number
  saves: number
  engagementRate: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n)
}

function fmtPct(n: number): string {
  return `${n.toFixed(2)}%`
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E1306C',
  tiktok:    '#010101',
  linkedin:  '#0077B5',
  facebook:  '#1877F2',
  twitter:   '#14171A',
  x:         '#14171A',
  youtube:   '#FF0000',
}

function PlatformBadge({ platform }: { platform: string }) {
  const p = platform?.toLowerCase() ?? ''
  const color = PLATFORM_COLORS[p] ?? '#64748b'
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs font-medium capitalize"
      style={{ backgroundColor: color }}>
      <Camera size={9} />
      {platform}
    </span>
  )
}

function KpiCard({ label, value, sub, icon, loading }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; loading?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {icon}
      </div>
      {loading ? <Skeleton className="h-7 w-20 mb-1" /> : (
        <div className="text-2xl font-semibold text-slate-900">{value}</div>
      )}
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Data hook ────────────────────────────────────────────────────────────────

function useCampaignAnalytics(campaignId: string) {
  const [campaign,     setCampaign]     = useState<Campaign | null>(null)
  const [posts,        setPosts]        = useState<ContentPost[]>([])
  const [postAnalytics, setPostAnalytics] = useState<PostAnalytic[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)

  useEffect(() => {
    if (!campaignId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const supabase = createClient()

      // Campaign
      const { data: campaignData, error: campaignErr } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single()

      if (campaignErr || !campaignData) {
        if (!cancelled) { setError('Campaign not found'); setLoading(false) }
        return
      }
      if (!cancelled) setCampaign(campaignData)

      // Posts in this campaign
      const { data: postsData } = await supabase
        .from('content_posts')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('published_at', { ascending: false })
      const postsArr = postsData ?? []
      if (!cancelled) setPosts(postsArr)

      // Post analytics
      const postIds = postsArr.map((p: ContentPost) => p.id)
      if (postIds.length > 0) {
        const { data: paData } = await supabase
          .from('post_analytics')
          .select('*')
          .in('post_id', postIds)
          .order('date', { ascending: true })
        if (!cancelled) setPostAnalytics(paData ?? [])
      }

      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [campaignId])

  return { campaign, posts, postAnalytics, loading, error }
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({
  campaign, posts, postAnalytics, loading,
}: {
  campaign: Campaign
  posts: ContentPost[]
  postAnalytics: PostAnalytic[]
  loading: boolean
}) {
  // Daily impressions for campaign duration
  const dailyData = useMemo(() => {
    if (!campaign.start_date) return []
    const from = new Date(campaign.start_date)
    const to   = campaign.end_date ? new Date(campaign.end_date) : new Date()
    const days: { date: string; impressions: number; reach: number }[] = []
    const cur = new Date(from)
    while (cur <= to) {
      const dateStr = cur.toISOString().split('T')[0]
      const forDay  = postAnalytics.filter(r => r.date.startsWith(dateStr))
      days.push({
        date:        dateStr.slice(5),
        impressions: forDay.reduce((s, r) => s + (r.impressions ?? 0), 0),
        reach:       forDay.reduce((s, r) => s + (r.reach ?? 0), 0),
      })
      cur.setDate(cur.getDate() + 1)
    }
    return days
  }, [campaign, postAnalytics])

  // Top 10 posts by impressions for bar chart
  const paMap = useMemo(() => {
    const m: Record<string, PostAnalytic[]> = {}
    postAnalytics.forEach(pa => {
      if (!m[pa.post_id]) m[pa.post_id] = []
      m[pa.post_id].push(pa)
    })
    return m
  }, [postAnalytics])

  const top10 = useMemo(() => {
    return posts
      .map(p => ({
        name:        truncate(p.caption ?? '', 30),
        impressions: (paMap[p.id] ?? []).reduce((s, r) => s + (r.impressions ?? 0), 0),
      }))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10)
  }, [posts, paMap])

  const totalImpressions = postAnalytics.reduce((s, r) => s + (r.impressions ?? 0), 0)
  const totalReach       = postAnalytics.reduce((s, r) => s + (r.reach ?? 0), 0)
  const avgEng           = postAnalytics.length
    ? postAnalytics.reduce((s, r) => s + (r.engagement_rate ?? 0), 0) / postAnalytics.length
    : 0

  return (
    <div className="space-y-6">
      {/* Daily impressions line */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Daily Impressions</h3>
        {loading ? <Skeleton className="h-52 w-full" /> : dailyData.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-sm text-slate-400">No data for campaign period</div>
        ) : (
          <ResponsiveContainer width="100%" height={208}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmt} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v) => fmt(Number(v ?? 0))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="impressions" stroke="#2563eb" strokeWidth={2} dot={false} name="Impressions" />
              <Line type="monotone" dataKey="reach"       stroke="#7c3aed" strokeWidth={2} dot={false} name="Reach" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top 10 posts bar chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Top Posts by Impressions</h3>
        {loading ? <Skeleton className="h-52 w-full" /> : top10.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-sm text-slate-400">No post analytics yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={208}>
            <BarChart data={top10} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmt} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={130} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v) => fmt(Number(v ?? 0))} />
              <Bar dataKey="impressions" fill="#2563eb" radius={[0, 4, 4, 0]} name="Impressions" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Posts ───────────────────────────────────────────────────────────────

function PostsTab({
  posts, postAnalytics, loading,
}: {
  posts: ContentPost[]
  postAnalytics: PostAnalytic[]
  loading: boolean
}) {
  const [sortField, setSortField] = useState('published_at')
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc')

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const enriched: EnrichedPost[] = useMemo(() => {
    const paMap: Record<string, PostAnalytic[]> = {}
    postAnalytics.forEach(pa => {
      if (!paMap[pa.post_id]) paMap[pa.post_id] = []
      paMap[pa.post_id].push(pa)
    })
    return posts.map(p => {
      const pas = paMap[p.id] ?? []
      return {
        ...p,
        impressions:    pas.reduce((s, r) => s + (r.impressions ?? 0), 0),
        reach:          pas.reduce((s, r) => s + (r.reach ?? 0), 0),
        likes:          pas.reduce((s, r) => s + (r.likes ?? 0), 0),
        comments:       pas.reduce((s, r) => s + (r.comments ?? 0), 0),
        shares:         pas.reduce((s, r) => s + (r.shares ?? 0), 0),
        saves:          pas.reduce((s, r) => s + (r.saves ?? 0), 0),
        engagementRate: pas.length ? pas.reduce((s, r) => s + (r.engagement_rate ?? 0), 0) / pas.length : 0,
      }
    })
  }, [posts, postAnalytics])

  const sorted = useMemo(() => [...enriched].sort((a, b) => {
    const va = (a as any)[sortField] ?? 0
    const vb = (b as any)[sortField] ?? 0
    if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    return sortDir === 'asc' ? va - vb : vb - va
  }), [enriched, sortField, sortDir])

  const SH = ({ label, field }: { label: string; field: string }) => (
    <button onClick={() => handleSort(field)}
      className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 whitespace-nowrap">
      {label}
      <span className={cn('text-xs', sortField === field ? 'text-blue-500' : 'text-slate-300')}>↕</span>
    </button>
  )

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">All Posts</h3>
        <span className="text-xs text-slate-500">{sorted.length} posts</span>
      </div>
      {loading ? (
        <div className="p-5 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : sorted.length === 0 ? (
        <EmptyState compact icon={BarChart2} title="No posts in this campaign" description="Add posts to this campaign to see analytics." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-5 py-3 text-left"><SH label="Date"         field="published_at"   /></th>
                <th className="px-4 py-3 text-left"><SH label="Caption"      field="caption"        /></th>
                <th className="px-4 py-3 text-left"><SH label="Platform"     field="platform"       /></th>
                <th className="px-4 py-3 text-left"><SH label="Type"         field="post_type"      /></th>
                <th className="px-4 py-3 text-left"><SH label="Impressions"  field="impressions"    /></th>
                <th className="px-4 py-3 text-left"><SH label="Reach"        field="reach"          /></th>
                <th className="px-4 py-3 text-left"><SH label="Likes"        field="likes"          /></th>
                <th className="px-4 py-3 text-left"><SH label="Comments"     field="comments"       /></th>
                <th className="px-4 py-3 text-left"><SH label="Shares"       field="shares"         /></th>
                <th className="px-4 py-3 text-left"><SH label="Saves"        field="saves"          /></th>
                <th className="px-4 py-3 text-left"><SH label="Eng. Rate"    field="engagementRate" /></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{p.published_at ? formatDate(p.published_at) : '—'}</td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center shrink-0">
                        <Camera size={11} className="text-slate-400" />
                      </div>
                      <span className="text-sm text-slate-700 line-clamp-1">{truncate(p.caption ?? '', 50)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><PlatformBadge platform={p.platform} /></td>
                  <td className="px-4 py-3"><Badge variant="default">{p.post_type ?? '—'}</Badge></td>
                  <td className="px-4 py-3 text-sm text-slate-700">{fmt(p.impressions)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{fmt(p.reach)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{fmt(p.likes)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{fmt(p.comments)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{fmt(p.shares)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{fmt(p.saves)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-emerald-600">{fmtPct(p.engagementRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Tab: ROI ─────────────────────────────────────────────────────────────────

function ROITab({
  campaign, posts, postAnalytics, loading,
}: {
  campaign: Campaign
  posts: ContentPost[]
  postAnalytics: PostAnalytic[]
  loading: boolean
}) {
  const totalImpressions = postAnalytics.reduce((s, r) => s + (r.impressions ?? 0), 0)
  const totalReach       = postAnalytics.reduce((s, r) => s + (r.reach ?? 0), 0)
  const totalLikes       = postAnalytics.reduce((s, r) => s + (r.likes ?? 0), 0)
  const totalComments    = postAnalytics.reduce((s, r) => s + (r.comments ?? 0), 0)
  const totalShares      = postAnalytics.reduce((s, r) => s + (r.shares ?? 0), 0)
  const totalSaves       = postAnalytics.reduce((s, r) => s + (r.saves ?? 0), 0)
  const totalEngagements = totalLikes + totalComments + totalShares + totalSaves

  const budget       = campaign.budget ?? 0
  const actualSpend  = campaign.actual_spend ?? 0
  const remaining    = budget - actualSpend
  const spendPct     = budget > 0 ? (actualSpend / budget) * 100 : 0

  const impPerPound  = actualSpend > 0 ? totalImpressions / actualSpend : null
  const reachPerPound = actualSpend > 0 ? totalReach / actualSpend : null
  const costPerEng   = totalEngagements > 0 && actualSpend > 0 ? actualSpend / totalEngagements : null
  const roi          = budget > 0 && totalImpressions > 0
    ? ((totalImpressions / 1000) / (budget / 1000)) * 100
    : null

  const budgetBarData = [
    { name: 'Budget',  value: budget },
    { name: 'Spent',   value: actualSpend },
    { name: 'Remaining', value: Math.max(0, remaining) },
  ]

  return (
    <div className="space-y-6">
      {/* Budget vs Spend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Budget</p>
          {loading ? <Skeleton className="h-7 w-24" /> : (
            <p className="text-2xl font-semibold text-slate-900">{budget > 0 ? fmtCurrency(budget) : '—'}</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Actual Spend</p>
          {loading ? <Skeleton className="h-7 w-24" /> : (
            <p className="text-2xl font-semibold text-slate-900">{actualSpend > 0 ? fmtCurrency(actualSpend) : '—'}</p>
          )}
          {budget > 0 && <p className="text-xs text-slate-500 mt-0.5">{spendPct.toFixed(0)}% of budget</p>}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Remaining</p>
          {loading ? <Skeleton className="h-7 w-24" /> : (
            <p className={cn('text-2xl font-semibold', remaining >= 0 ? 'text-emerald-600' : 'text-red-500')}>
              {budget > 0 ? fmtCurrency(remaining) : '—'}
            </p>
          )}
        </div>
      </div>

      {/* Spend progress bar */}
      {budget > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-800">Budget Utilisation</p>
            <p className="text-sm font-semibold text-slate-900">{spendPct.toFixed(1)}%</p>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', spendPct > 90 ? 'bg-red-500' : spendPct > 70 ? 'bg-amber-500' : 'bg-emerald-500')}
              style={{ width: `${Math.min(spendPct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-slate-400">
            <span>{fmtCurrency(0)}</span>
            <span>{fmtCurrency(budget)}</span>
          </div>
        </div>
      )}

      {/* Budget bar chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Budget vs Spend</h3>
        {loading ? <Skeleton className="h-44 w-full" /> : (
          <ResponsiveContainer width="100%" height={176}>
            <BarChart data={budgetBarData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `£${fmt(v)}`} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v) => fmtCurrency(Number(v ?? 0))} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {budgetBarData.map((entry, i) => (
                  <rect key={i} fill={['#2563eb', '#f59e0b', '#059669'][i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ROI metrics */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Return on Investment</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">Metric</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Value</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Notes</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Total Impressions',       value: fmt(totalImpressions),              note: 'Sum across all posts' },
              { label: 'Total Reach',             value: fmt(totalReach),                    note: 'Unique accounts reached' },
              { label: 'Total Engagements',       value: fmt(totalEngagements),              note: 'Likes + comments + shares + saves' },
              { label: 'Impressions per £1 spent', value: impPerPound ? impPerPound.toFixed(1) : '—', note: 'Based on actual spend' },
              { label: 'Reach per £1 spent',       value: reachPerPound ? reachPerPound.toFixed(1) : '—', note: 'Based on actual spend' },
              { label: 'Cost per Engagement',     value: costPerEng ? fmtCurrency(costPerEng) : '—', note: 'Actual spend / total engagements' },
              { label: 'Est. ROI',                value: roi ? `${roi.toFixed(1)}%` : '—',  note: 'Impressions per 1k / budget per 1k' },
            ].map(row => (
              <tr key={row.label} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">{row.label}</td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-900">{loading ? '…' : row.value}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'posts',    label: 'Posts'    },
  { id: 'roi',      label: 'ROI'      },
]

export default function CampaignAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [activeTab, setActiveTab] = useState('overview')

  const { campaign, posts, postAnalytics, loading, error } = useCampaignAnalytics(id)

  const totalImpressions = postAnalytics.reduce((s, r) => s + (r.impressions ?? 0), 0)
  const totalReach       = postAnalytics.reduce((s, r) => s + (r.reach ?? 0), 0)
  const avgEng           = postAnalytics.length
    ? postAnalytics.reduce((s, r) => s + (r.engagement_rate ?? 0), 0) / postAnalytics.length
    : 0

  if (error) {
    return (
      <div className="p-6">
        <EmptyState icon={BarChart2} title="Campaign not found" description={error}
          action={{ label: 'Back to Campaigns', onClick: () => window.location.href = '/app/campaigns' }} />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title={loading ? 'Loading…' : (campaign?.name ?? 'Campaign Analytics')}
        subtitle="Campaign-level analytics — impressions, reach, engagement and ROI."
        breadcrumbs={[
          { label: 'Campaigns', href: '/app/campaigns' },
          { label: campaign?.name ?? '…', href: `/app/campaigns/${id}` },
          { label: 'Analytics' },
        ]}
      >
        <Button variant="secondary" size="sm" icon={<ArrowLeft size={13} />} onClick={() => window.location.href = `/app/campaigns/${id}`}>
          Back to Campaign
        </Button>
        {campaign && (
          <Badge variant={campaign.status === 'active' ? 'green' : 'default'}>{campaign.status}</Badge>
        )}
      </PageHeader>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Posts"         value={String(posts.length)}             icon={<Layers size={16} className="text-slate-400" />}      loading={loading} />
        <KpiCard label="Total Impressions"   value={fmt(totalImpressions)}             icon={<Eye size={16} className="text-blue-500" />}           loading={loading} />
        <KpiCard label="Total Reach"         value={fmt(totalReach)}                   icon={<Activity size={16} className="text-violet-500" />}    loading={loading} />
        <KpiCard label="Avg Engagement Rate" value={`${avgEng.toFixed(2)}%`}           icon={<TrendingUp size={16} className="text-emerald-500" />} loading={loading} />
        <KpiCard
          label="Total Spend"
          value={campaign?.actual_spend ? `£${fmt(campaign.actual_spend)}` : '—'}
          sub={campaign?.budget ? `of £${fmt(campaign.budget)} budget` : undefined}
          icon={<DollarSign size={16} className="text-amber-500" />}
          loading={loading}
        />
      </div>

      {/* Tabs */}
      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === 'overview' && campaign && (
        <OverviewTab campaign={campaign} posts={posts} postAnalytics={postAnalytics} loading={loading} />
      )}
      {activeTab === 'posts' && (
        <PostsTab posts={posts} postAnalytics={postAnalytics} loading={loading} />
      )}
      {activeTab === 'roi' && campaign && (
        <ROITab campaign={campaign} posts={posts} postAnalytics={postAnalytics} loading={loading} />
      )}
    </div>
  )
}
