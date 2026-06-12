'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus, Users, Eye, MousePointerClick,
  UserPlus, Trophy, BarChart2, Camera, PlayCircle, Briefcase,
  AtSign, ArrowUpDown, Sparkles, Download, FileText, Trash2,
  Plus, Calendar, Info, Settings, RefreshCw, ExternalLink,
  ThumbsUp, MessageSquare, Share2, Bookmark, Activity, Target,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Tabs } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn, formatDate, truncate } from '@/lib/utils'

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type DateRangeKey = '7d' | '14d' | '30d' | '90d' | 'custom'

interface ChannelAnalytic {
  id: string
  channel_id: string
  date: string
  impressions: number
  reach: number
  followers: number
  follower_change: number
  engagement_rate: number
  platform?: string
  channel_name?: string
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

interface ContentPost {
  id: string
  caption: string
  platform: string
  post_type: string
  published_at: string
  campaign_id?: string
  thumbnail_url?: string
}

interface SocialChannel {
  id: string
  name: string
  platform: string
  followers: number
  analytics_enabled?: boolean
}

interface Campaign {
  id: string
  name: string
  status: string
  start_date: string
  end_date: string
  budget?: number
  actual_spend?: number
}

interface DayPoint {
  date: string
  impressions: number
  reach: number
  engagementRate: number
  followers: number
  likes: number
  comments: number
  shares: number
  saves: number
}

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ANALYTICS_TABS = [
  { id: 'overview',       label: 'Overview'     },
  { id: 'content',        label: 'Content'      },
  { id: 'audience',       label: 'Audience'     },
  { id: 'reach',          label: 'Reach & Impressions' },
  { id: 'engagement',     label: 'Engagement'   },
  { id: 'campaigns',      label: 'Campaigns'    },
  { id: 'competitors',    label: 'Competitors'  },
  { id: 'sched-reports',  label: 'Reports'      },
  { id: 'reports',        label: 'Export'       },
  { id: 'benchmarks',     label: 'Benchmarks'   },
  { id: 'settings',       label: 'Settings'     },
]

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E1306C',
  tiktok:    '#010101',
  linkedin:  '#0077B5',
  facebook:  '#1877F2',
  twitter:   '#14171A',
  x:         '#14171A',
  youtube:   '#FF0000',
  pinterest: '#BD081C',
}

const PIE_COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626']

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = ['12a', '2a', '4a', '6a', '8a', '10a', '12p', '2p', '4p', '6p', '8p', '10p']

const HEATMAP_DEMO: Record<string, Record<string, number>> = {
  Mon: { '8a': 1, '12p': 1 },
  Tue: { '8a': 2, '10a': 3, '12p': 3, '6p': 3 },
  Wed: { '8a': 2, '10a': 3, '12p': 3, '4p': 2, '6p': 3 },
  Thu: { '8a': 2, '10a': 3, '12p': 3, '6p': 3, '8p': 2 },
  Fri: { '10a': 2, '12p': 2, '6p': 1 },
  Sat: { '10a': 1, '12p': 1 },
  Sun: { '10a': 1 },
}

const INTENSITY_CLASS: Record<number, string> = {
  0: 'bg-slate-100',
  1: 'bg-blue-100',
  2: 'bg-blue-300',
  3: 'bg-blue-600',
}

const SAVED_REPORTS_DEMO = [
  { id: 'r1', name: 'Monthly Report â€” May 2026', type: 'Monthly', created_at: '2026-06-01', range: 'May 2026' },
  { id: 'r2', name: 'Q1 2026 Summary',           type: 'Quarterly', created_at: '2026-04-01', range: 'Q1 2026' },
]

const INDUSTRY_BENCHMARKS = [
  { metric: 'Engagement Rate',    yours: null as number | null, industry: 1.2,  unit: '%',      note: 'Instagram avg' },
  { metric: 'Reach Rate',         yours: null as number | null, industry: 9.4,  unit: '%',      note: 'Organic reach' },
  { metric: 'Posting Frequency',  yours: null as number | null, industry: 4.5,  unit: '/week',  note: 'Industry avg' },
  { metric: 'Response Rate',      yours: null as number | null, industry: 32.0, unit: '%',      note: 'Comment replies' },
]

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getDaysBack(key: DateRangeKey): number {
  if (key === '7d')  return 7
  if (key === '14d') return 14
  if (key === '30d') return 30
  if (key === '90d') return 90
  return 30
}

function dateFromDaysBack(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function fmtPct(n: number): string {
  return `${n.toFixed(2)}%`
}

function trendIcon(change: number) {
  if (change > 0) return <TrendingUp size={12} className="text-green-500" />
  if (change < 0) return <TrendingDown size={12} className="text-red-500" />
  return <Minus size={12} className="text-slate-400" />
}

function trendClass(change: number): string {
  if (change > 0) return 'text-green-600'
  if (change < 0) return 'text-red-600'
  return 'text-slate-400'
}

// â”€â”€â”€ Date Range Selector â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function DateRangeSelector({
  value,
  onChange,
  customFrom,
  customTo,
  onCustomChange,
}: {
  value: DateRangeKey
  onChange: (v: DateRangeKey) => void
  customFrom: string
  customTo: string
  onCustomChange: (from: string, to: string) => void
}) {
  const opts: { label: string; value: DateRangeKey }[] = [
    { label: 'Last 7 days',  value: '7d'     },
    { label: 'Last 14 days', value: '14d'    },
    { label: 'Last 30 days', value: '30d'    },
    { label: 'Last 90 days', value: '90d'    },
    { label: 'Custom',       value: 'custom' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
        {opts.map(o => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap',
              value === o.value
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {value === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={e => onCustomChange(e.target.value, customTo)}
            className="px-2 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={customTo}
            onChange={e => onCustomChange(customFrom, e.target.value)}
            className="px-2 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  )
}

// â”€â”€â”€ KPI Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function KpiCard({
  label,
  value,
  change,
  icon,
  loading,
}: {
  label: string
  value: string
  change: number
  icon: React.ReactNode
  loading?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {icon}
      </div>
      {loading ? (
        <Skeleton className="h-7 w-20 mb-2" />
      ) : (
        <div className="text-2xl font-semibold text-slate-900">{value}</div>
      )}
      <div className="flex items-center gap-1 mt-1">
        {trendIcon(change)}
        <span className={cn('text-xs', trendClass(change))}>
          {change === 0 ? 'No prior data' : `${change > 0 ? '+' : ''}${change.toFixed(1)}% vs prev`}
        </span>
      </div>
    </div>
  )
}

// â”€â”€â”€ Sortable Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SortableHeader({
  label, field, sortField, sortDir, onSort,
}: {
  label: string; field: string; sortField: string; sortDir: 'asc' | 'desc'
  onSort: (f: string) => void
}) {
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 whitespace-nowrap"
    >
      {label}
      <ArrowUpDown size={10} className={cn(sortField === field ? 'text-blue-500' : 'text-slate-300')} />
    </button>
  )
}

// â”€â”€â”€ Platform Badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PlatformBadge({ platform }: { platform: string }) {
  const p = platform.toLowerCase()
  const color = PLATFORM_COLORS[p] ?? '#64748b'
  const icons: Record<string, React.ReactNode> = {
    instagram: <Camera size={10} />,
    youtube:   <PlayCircle size={10} />,
    linkedin:  <Briefcase size={10} />,
    facebook:  <Users size={10} />,
    tiktok:    <AtSign size={10} />,
    twitter:   <AtSign size={10} />,
    x:         <AtSign size={10} />,
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs font-medium capitalize"
      style={{ backgroundColor: color }}
    >
      {icons[p] ?? <AtSign size={10} />}
      {platform}
    </span>
  )
}

// â”€â”€â”€ Hook: Analytics Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function useAnalyticsData(rangeKey: DateRangeKey, customFrom: string, customTo: string) {
  const [channelAnalytics, setChannelAnalytics] = useState<ChannelAnalytic[]>([])
  const [postAnalytics, setPostAnalytics] = useState<PostAnalytic[]>([])
  const [posts, setPosts] = useState<ContentPost[]>([])
  const [channels, setChannels] = useState<SocialChannel[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [wsId, setWsId] = useState<string | null>(null)

  const fromDate = rangeKey === 'custom' ? customFrom : dateFromDaysBack(getDaysBack(rangeKey))
  const toDate   = rangeKey === 'custom' ? customTo   : new Date().toISOString().split('T')[0]

  const fetch = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Get workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()
    const workspaceId = member?.workspace_id
    setWsId(workspaceId ?? null)
    if (!workspaceId) { setLoading(false); return }

    // Fetch channels for this workspace
    const { data: channelsData } = await supabase
      .from('social_channels')
      .select('*')
      .eq('workspace_id', workspaceId)

    const channelIds = (channelsData ?? []).map((c: SocialChannel) => c.id)
    setChannels(channelsData ?? [])

    // Fetch channel analytics
    let channelQ = supabase
      .from('channel_analytics')
      .select('*, social_channels(name, platform)')
      .gte('date', fromDate)
      .lte('date', toDate)
    if (channelIds.length > 0) {
      channelQ = channelQ.in('channel_id', channelIds)
    }
    const { data: caData } = await channelQ.order('date', { ascending: true })

    const caFlat: ChannelAnalytic[] = (caData ?? []).map((r: any) => ({
      ...r,
      platform:     r.social_channels?.platform ?? '',
      channel_name: r.social_channels?.name ?? '',
    }))
    setChannelAnalytics(caFlat)

    // Fetch posts (published this month / in range)
    const { data: postsData } = await supabase
      .from('content_posts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'published')
      .gte('published_at', fromDate)
      .lte('published_at', toDate + 'T23:59:59')
      .order('published_at', { ascending: false })
    setPosts(postsData ?? [])

    // Fetch post analytics
    const postIds = (postsData ?? []).map((p: ContentPost) => p.id)
    if (postIds.length > 0) {
      const { data: paData } = await supabase
        .from('post_analytics')
        .select('*')
        .in('post_id', postIds)
        .gte('date', fromDate)
        .lte('date', toDate)
        .order('date', { ascending: true })
      setPostAnalytics(paData ?? [])
    } else {
      setPostAnalytics([])
    }

    // Fetch campaigns
    const { data: campaignsData } = await supabase
      .from('campaigns')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    setCampaigns(campaignsData ?? [])

    setLoading(false)
  }, [fromDate, toDate])

  useEffect(() => { fetch() }, [fetch])

  return { channelAnalytics, postAnalytics, posts, channels, campaigns, loading, wsId, refetch: fetch, fromDate, toDate }
}

// â”€â”€â”€ Derived data helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildDailyTimeline(
  channelAnalytics: ChannelAnalytic[],
  postAnalytics: PostAnalytic[],
  fromDate: string,
  toDate: string,
): DayPoint[] {
  const from = new Date(fromDate)
  const to   = new Date(toDate)
  const days: DayPoint[] = []
  const cur = new Date(from)
  while (cur <= to) {
    const dateStr = cur.toISOString().split('T')[0]
    const caForDay = channelAnalytics.filter(r => r.date.startsWith(dateStr))
    const paForDay = postAnalytics.filter(r => r.date.startsWith(dateStr))
    const engSum = caForDay.reduce((s, r) => s + (r.engagement_rate ?? 0), 0)
    days.push({
      date:           dateStr.slice(5), // MM-DD
      impressions:    caForDay.reduce((s, r) => s + (r.impressions ?? 0), 0),
      reach:          caForDay.reduce((s, r) => s + (r.reach ?? 0), 0),
      engagementRate: caForDay.length ? engSum / caForDay.length : 0,
      followers:      caForDay.reduce((s, r) => s + (r.followers ?? 0), 0),
      likes:          paForDay.reduce((s, r) => s + (r.likes ?? 0), 0),
      comments:       paForDay.reduce((s, r) => s + (r.comments ?? 0), 0),
      shares:         paForDay.reduce((s, r) => s + (r.shares ?? 0), 0),
      saves:          paForDay.reduce((s, r) => s + (r.saves ?? 0), 0),
    })
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

function buildPlatformBreakdown(channelAnalytics: ChannelAnalytic[]) {
  const map: Record<string, number> = {}
  channelAnalytics.forEach(r => {
    const p = (r.platform || 'unknown').toLowerCase()
    map[p] = (map[p] ?? 0) + (r.impressions ?? 0)
  })
  return Object.entries(map).map(([name, value]) => ({ name, value }))
}

function aggregateKpis(channelAnalytics: ChannelAnalytic[], posts: ContentPost[]) {
  const totalImpressions = channelAnalytics.reduce((s, r) => s + (r.impressions ?? 0), 0)
  const totalReach       = channelAnalytics.reduce((s, r) => s + (r.reach ?? 0), 0)
  const engSum           = channelAnalytics.reduce((s, r) => s + (r.engagement_rate ?? 0), 0)
  const avgEngRate       = channelAnalytics.length ? engSum / channelAnalytics.length : 0
  const totalFollowers   = channelAnalytics.length
    ? Math.max(...channelAnalytics.map(r => r.followers ?? 0))
    : 0
  const followerGrowth   = channelAnalytics.reduce((s, r) => s + (r.follower_change ?? 0), 0)
  return { totalImpressions, totalReach, avgEngRate, totalFollowers, followerGrowth, postsPublished: posts.length }
}

// â”€â”€â”€ Tab: Overview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function OverviewTab({
  channelAnalytics, postAnalytics, posts, channels, loading, fromDate, toDate,
}: {
  channelAnalytics: ChannelAnalytic[]
  postAnalytics: PostAnalytic[]
  posts: ContentPost[]
  channels: SocialChannel[]
  loading: boolean
  fromDate: string
  toDate: string
}) {
  const kpis = useMemo(() => aggregateKpis(channelAnalytics, posts), [channelAnalytics, posts])
  const timeline = useMemo(() => buildDailyTimeline(channelAnalytics, postAnalytics, fromDate, toDate), [channelAnalytics, postAnalytics, fromDate, toDate])
  const platformBreakdown = useMemo(() => buildPlatformBreakdown(channelAnalytics), [channelAnalytics])

  // Top 5 posts by engagement rate
  const topPosts = useMemo(() => {
    const paMap: Record<string, PostAnalytic[]> = {}
    postAnalytics.forEach(pa => {
      if (!paMap[pa.post_id]) paMap[pa.post_id] = []
      paMap[pa.post_id].push(pa)
    })
    return posts
      .map(p => {
        const pas = paMap[p.id] ?? []
        const totalImpressions = pas.reduce((s, r) => s + (r.impressions ?? 0), 0)
        const avgEng = pas.length
          ? pas.reduce((s, r) => s + (r.engagement_rate ?? 0), 0) / pas.length
          : 0
        return { ...p, totalImpressions, avgEng }
      })
      .sort((a, b) => b.avgEng - a.avgEng)
      .slice(0, 5)
  }, [posts, postAnalytics])

  const kpiCards = [
    { label: 'Total Impressions',   value: fmt(kpis.totalImpressions), change: 0, icon: <Eye size={16} className="text-blue-500" /> },
    { label: 'Total Reach',         value: fmt(kpis.totalReach),        change: 0, icon: <Activity size={16} className="text-violet-500" /> },
    { label: 'Avg Engagement Rate', value: fmtPct(kpis.avgEngRate),     change: 0, icon: <TrendingUp size={16} className="text-green-500" /> },
    { label: 'Total Followers',     value: fmt(kpis.totalFollowers),    change: 0, icon: <Users size={16} className="text-sky-500" /> },
    { label: 'Posts Published',     value: String(kpis.postsPublished), change: 0, icon: <Camera size={16} className="text-orange-500" /> },
    { label: 'Follower Growth',     value: `+${fmt(kpis.followerGrowth)}`, change: kpis.followerGrowth > 0 ? 1 : 0, icon: <UserPlus size={16} className="text-emerald-500" /> },
  ]

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map(c => (
          <KpiCard key={c.label} {...c} loading={loading} />
        ))}
      </div>

      {/* Impressions vs Reach area chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Impressions vs Reach</h3>
        {loading ? (
          <Skeleton className="h-52 w-full" />
        ) : timeline.length === 0 || timeline.every(d => d.impressions === 0 && d.reach === 0) ? (
          <div className="h-52 flex items-center justify-center text-sm text-slate-400">No data for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={208}>
            <AreaChart data={timeline}>
              <defs>
                <linearGradient id="impGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="reachGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmt} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v) => fmt(Number(v ?? 0))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="impressions" stroke="#2563eb" strokeWidth={2} fill="url(#impGrad)" name="Impressions" />
              <Area type="monotone" dataKey="reach"       stroke="#7c3aed" strokeWidth={2} fill="url(#reachGrad)" name="Reach" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Row: Engagement Line + Platform Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Engagement Rate over Time</h3>
          {loading ? (
            <Skeleton className="h-44 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={176}>
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${Number(v).toFixed(1)}%`} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v) => `${Number(v ?? 0).toFixed(2)}%`} />
                <Line type="monotone" dataKey="engagementRate" stroke="#059669" strokeWidth={2} dot={false} name="Eng. Rate" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Impressions by Platform</h3>
          {loading ? (
            <Skeleton className="h-44 w-full" />
          ) : platformBreakdown.length === 0 || platformBreakdown.every(d => d.value === 0) ? (
            <div className="h-44 flex items-center justify-center text-sm text-slate-400">No platform data</div>
          ) : (
            <ResponsiveContainer width="100%" height={176}>
              <PieChart>
                <Pie data={platformBreakdown} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {platformBreakdown.map((entry, i) => (
                    <Cell key={entry.name} fill={PLATFORM_COLORS[entry.name] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v) => fmt(Number(v ?? 0))} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top 5 Posts */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Top 5 Posts by Engagement Rate</h3>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : topPosts.length === 0 ? (
          <EmptyState compact icon={BarChart2} title="No posts yet" description="Publish content to see top performers." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">Caption</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Platform</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Eng. Rate</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Impressions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Published</th>
              </tr>
            </thead>
            <tbody>
              {topPosts.map(p => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                        <Camera size={12} className="text-slate-400" />
                      </div>
                      <span className="text-sm text-slate-700">{truncate(p.caption ?? '', 60)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><PlatformBadge platform={p.platform} /></td>
                  <td className="px-4 py-3 text-sm font-medium text-emerald-600">{fmtPct(p.avgEng)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{fmt(p.totalImpressions)}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{formatDate(p.published_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// â”€â”€â”€ Tab: Content Performance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ContentTab({
  posts, postAnalytics, loading,
}: {
  posts: ContentPost[]
  postAnalytics: PostAnalytic[]
  loading: boolean
}) {
  const [sortField, setSortField] = useState('published_at')
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc')
  const [filterPlatform, setFilterPlatform] = useState('')
  const [filterType, setFilterType]         = useState('')

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  // Merge posts with their analytics totals
  const enriched = useMemo(() => {
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

  const platforms = useMemo(() => [...new Set(posts.map(p => p.platform))], [posts])
  const postTypes = useMemo(() => [...new Set(posts.map(p => p.post_type).filter(Boolean))], [posts])

  const filtered = useMemo(() => enriched.filter(p => {
    if (filterPlatform && p.platform !== filterPlatform) return false
    if (filterType && p.post_type !== filterType) return false
    return true
  }), [enriched, filterPlatform, filterType])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const va = (a as any)[sortField] ?? 0
    const vb = (b as any)[sortField] ?? 0
    if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    return sortDir === 'asc' ? va - vb : vb - va
  }), [filtered, sortField, sortDir])

  const exportCsv = () => {
    const headers = ['Date', 'Caption', 'Platform', 'Post Type', 'Impressions', 'Reach', 'Likes', 'Comments', 'Shares', 'Saves', 'Engagement Rate']
    const rows = sorted.map(p => [
      p.published_at ? formatDate(p.published_at) : '',
      `"${(p.caption ?? '').replace(/"/g, '""')}"`,
      p.platform,
      p.post_type ?? '',
      p.impressions,
      p.reach,
      p.likes,
      p.comments,
      p.shares,
      p.saves,
      `${p.engagementRate.toFixed(2)}%`,
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'content-analytics.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const shProps = { sortField, sortDir, onSort: handleSort }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterPlatform}
          onChange={e => setFilterPlatform(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Platforms</option>
          {platforms.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          {postTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="ml-auto">
          <Button size="sm" variant="secondary" icon={<Download size={13} />} onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Content Performance</h3>
          <span className="text-xs text-slate-500">{sorted.length} posts</span>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState compact icon={BarChart2} title="No posts in this range" description="Try a different date range or platform filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3 text-left"><SortableHeader label="Date"         field="published_at"   {...shProps} /></th>
                  <th className="px-4 py-3 text-left"><SortableHeader label="Caption"      field="caption"        {...shProps} /></th>
                  <th className="px-4 py-3 text-left"><SortableHeader label="Platform"     field="platform"       {...shProps} /></th>
                  <th className="px-4 py-3 text-left"><SortableHeader label="Type"         field="post_type"      {...shProps} /></th>
                  <th className="px-4 py-3 text-left"><SortableHeader label="Impressions"  field="impressions"    {...shProps} /></th>
                  <th className="px-4 py-3 text-left"><SortableHeader label="Reach"        field="reach"          {...shProps} /></th>
                  <th className="px-4 py-3 text-left"><SortableHeader label="Likes"        field="likes"          {...shProps} /></th>
                  <th className="px-4 py-3 text-left"><SortableHeader label="Comments"     field="comments"       {...shProps} /></th>
                  <th className="px-4 py-3 text-left"><SortableHeader label="Shares"       field="shares"         {...shProps} /></th>
                  <th className="px-4 py-3 text-left"><SortableHeader label="Saves"        field="saves"          {...shProps} /></th>
                  <th className="px-4 py-3 text-left"><SortableHeader label="Eng. Rate"    field="engagementRate" {...shProps} /></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Details</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(p => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{p.published_at ? formatDate(p.published_at) : 'â€”'}</td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <span className="text-sm text-slate-700 line-clamp-1">{truncate(p.caption ?? '', 55)}</span>
                    </td>
                    <td className="px-4 py-3"><PlatformBadge platform={p.platform} /></td>
                    <td className="px-4 py-3"><Badge variant="default">{p.post_type ?? 'â€”'}</Badge></td>
                    <td className="px-4 py-3 text-sm text-slate-700">{fmt(p.impressions)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{fmt(p.reach)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{fmt(p.likes)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{fmt(p.comments)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{fmt(p.shares)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{fmt(p.saves)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-emerald-600">{fmtPct(p.engagementRate)}</td>
                    <td className="px-4 py-3">
                      <a href={`/app/analytics/posts/${p.id}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        View <ExternalLink size={10} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// â”€â”€â”€ Tab: Audience â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AudienceTab({
  channelAnalytics, channels, loading, fromDate, toDate,
}: {
  channelAnalytics: ChannelAnalytic[]
  channels: SocialChannel[]
  loading: boolean
  fromDate: string
  toDate: string
}) {
  const timeline = useMemo(() => {
    // Per-day follower totals
    const days: DayPoint[] = []
    const from = new Date(fromDate); const to = new Date(toDate)
    const cur = new Date(from)
    while (cur <= to) {
      const dateStr = cur.toISOString().split('T')[0]
      const caForDay = channelAnalytics.filter(r => r.date.startsWith(dateStr))
      days.push({
        date:           dateStr.slice(5),
        impressions:    0, reach: 0, engagementRate: 0,
        followers:      caForDay.reduce((s, r) => s + (r.followers ?? 0), 0),
        likes: 0, comments: 0, shares: 0, saves: 0,
        followerGrowth: caForDay.reduce((s, r) => s + (r.follower_change ?? 0), 0),
      } as any)
      cur.setDate(cur.getDate() + 1)
    }
    return days
  }, [channelAnalytics, fromDate, toDate])

  // Per-channel summary
  const channelSummary = useMemo(() => {
    return channels.map(ch => {
      const cas = channelAnalytics.filter(r => r.channel_id === ch.id)
      const latestFollowers = cas.length ? Math.max(...cas.map(r => r.followers ?? 0)) : (ch.followers ?? 0)
      const growth = cas.reduce((s, r) => s + (r.follower_change ?? 0), 0)
      const growthPct = latestFollowers ? (growth / latestFollowers) * 100 : 0
      return { ...ch, latestFollowers, growth, growthPct }
    })
  }, [channels, channelAnalytics])

  return (
    <div className="space-y-6">
      {channels.length === 0 && !loading && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700">Connect social channels to see audience data. <a href="/app/settings?tab=channels" className="underline font-medium">Connect now â†’</a></p>
        </div>
      )}

      {/* Follower timeline */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Total Followers over Time</h3>
        {loading ? <Skeleton className="h-48 w-full" /> : (
          <ResponsiveContainer width="100%" height={192}>
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmt} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v) => fmt(Number(v ?? 0))} />
              <Line type="monotone" dataKey="followers" stroke="#2563eb" strokeWidth={2} dot={false} name="Followers" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Follower growth bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Daily Follower Growth</h3>
        {loading ? <Skeleton className="h-40 w-full" /> : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={timeline} barSize={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Bar dataKey="followerGrowth" fill="#059669" radius={[3, 3, 0, 0]} name="Growth" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Per-channel cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : channelSummary.length === 0 ? (
        <EmptyState compact icon={Users} title="No channels found" description="Connect channels to see per-channel audience analytics." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {channelSummary.map(ch => (
            <div key={ch.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: PLATFORM_COLORS[ch.platform?.toLowerCase()] ?? '#e2e8f0' }}>
                  <Users size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{ch.name}</p>
                  <PlatformBadge platform={ch.platform} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-slate-500">Followers</p>
                  <p className="text-sm font-semibold text-slate-900">{fmt(ch.latestFollowers)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Growth</p>
                  <p className={cn('text-sm font-semibold', ch.growth >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                    {ch.growth >= 0 ? '+' : ''}{fmt(ch.growth)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Growth %</p>
                  <p className={cn('text-sm font-semibold', ch.growthPct >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                    {ch.growthPct >= 0 ? '+' : ''}{ch.growthPct.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// â”€â”€â”€ Tab: Reach & Impressions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ReachTab({
  channelAnalytics, loading, fromDate, toDate,
}: {
  channelAnalytics: ChannelAnalytic[]
  loading: boolean
  fromDate: string
  toDate: string
}) {
  const timeline = useMemo(() => buildDailyTimeline(channelAnalytics, [], fromDate, toDate), [channelAnalytics, fromDate, toDate])
  const platformTotals = useMemo(() => {
    const map: Record<string, { impressions: number; reach: number }> = {}
    channelAnalytics.forEach(r => {
      const p = (r.platform || 'unknown').toLowerCase()
      if (!map[p]) map[p] = { impressions: 0, reach: 0 }
      map[p].impressions += r.impressions ?? 0
      map[p].reach       += r.reach ?? 0
    })
    return Object.entries(map).map(([platform, vals]) => ({
      platform, ...vals, difference: vals.impressions - vals.reach,
    }))
  }, [channelAnalytics])

  const platformChartData = platformTotals.map(p => ({
    name: p.platform,
    Impressions: p.impressions,
    Reach: p.reach,
  }))

  return (
    <div className="space-y-6">
      {/* Impressions vs Reach by day */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Daily Impressions vs Reach</h3>
        {loading ? <Skeleton className="h-52 w-full" /> : (
          <ResponsiveContainer width="100%" height={208}>
            <BarChart data={timeline} barSize={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmt} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v) => fmt(Number(v ?? 0))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="impressions" fill="#2563eb" radius={[3, 3, 0, 0]} name="Impressions" />
              <Bar dataKey="reach"       fill="#7c3aed" radius={[3, 3, 0, 0]} name="Reach" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Grouped by platform */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Impressions by Platform</h3>
        {loading ? <Skeleton className="h-44 w-full" /> : platformChartData.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-sm text-slate-400">No platform data</div>
        ) : (
          <ResponsiveContainer width="100%" height={176}>
            <BarChart data={platformChartData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmt} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v) => fmt(Number(v ?? 0))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Impressions" fill="#2563eb" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Reach"       fill="#7c3aed" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Per-platform table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Platform Totals</h3>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : platformTotals.length === 0 ? (
          <EmptyState compact icon={BarChart2} title="No data" description="No channel analytics for this period." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">Platform</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Impressions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Reach</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Difference</th>
              </tr>
            </thead>
            <tbody>
              {platformTotals.map(p => (
                <tr key={p.platform} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-5 py-3"><PlatformBadge platform={p.platform} /></td>
                  <td className="px-4 py-3 text-sm text-slate-700">{fmt(p.impressions)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{fmt(p.reach)}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{fmt(p.difference)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// â”€â”€â”€ Tab: Engagement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function EngagementTab({
  channelAnalytics, postAnalytics, loading, fromDate, toDate,
}: {
  channelAnalytics: ChannelAnalytic[]
  postAnalytics: PostAnalytic[]
  loading: boolean
  fromDate: string
  toDate: string
}) {
  const timeline = useMemo(() => buildDailyTimeline(channelAnalytics, postAnalytics, fromDate, toDate), [channelAnalytics, postAnalytics, fromDate, toDate])

  return (
    <div className="space-y-6">
      {/* Engagement rate line */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Engagement Rate over Time</h3>
        {loading ? <Skeleton className="h-52 w-full" /> : (
          <ResponsiveContainer width="100%" height={208}>
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(1)}%`} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v) => `${Number(v ?? 0).toFixed(2)}%`} />
              <Line type="monotone" dataKey="engagementRate" stroke="#059669" strokeWidth={2} dot={false} name="Eng. Rate" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Engagement breakdown stacked bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Engagement Breakdown (Likes Â· Comments Â· Shares Â· Saves)</h3>
        {loading ? <Skeleton className="h-52 w-full" /> : (
          <ResponsiveContainer width="100%" height={208}>
            <BarChart data={timeline} barSize={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmt} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v) => fmt(Number(v ?? 0))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="likes"    stackId="a" fill="#2563eb" name="Likes"    />
              <Bar dataKey="comments" stackId="a" fill="#7c3aed" name="Comments" />
              <Bar dataKey="shares"   stackId="a" fill="#0891b2" name="Shares"   />
              <Bar dataKey="saves"    stackId="a" fill="#059669" name="Saves" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Best posting time heatmap */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 overflow-x-auto">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-semibold text-slate-900">Best Time to Post</h3>
          <Badge variant="default">Industry benchmarks</Badge>
        </div>
        <p className="text-xs text-slate-500 mb-4">Connect channels for personalised recommendations. Currently showing industry averages.</p>
        <div className="min-w-[600px]">
          <div className="flex mb-2">
            <div className="w-12 shrink-0" />
            {HOURS.map(h => (
              <div key={h} className="flex-1 text-center text-xs text-slate-400">{h}</div>
            ))}
          </div>
          {DAYS.map(day => (
            <div key={day} className="flex items-center mb-1.5">
              <div className="w-12 shrink-0 text-xs font-medium text-slate-500">{day}</div>
              {HOURS.map(hour => {
                const intensity = HEATMAP_DEMO[day]?.[hour] ?? 0
                return (
                  <div key={hour} className="flex-1 px-0.5">
                    <div
                      className={cn('h-8 rounded-md transition-all', INTENSITY_CLASS[intensity], intensity > 0 && 'cursor-pointer')}
                      title={intensity > 0 ? `${day} ${hour} â€” ${['', 'Low', 'Medium', 'High'][intensity]} activity` : undefined}
                    />
                  </div>
                )
              })}
            </div>
          ))}
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
            <span className="text-xs text-slate-500">Activity:</span>
            {[{ cls: 'bg-slate-100', label: 'None' }, { cls: 'bg-blue-100', label: 'Low' }, { cls: 'bg-blue-300', label: 'Medium' }, { cls: 'bg-blue-600', label: 'High' }].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={cn('w-4 h-4 rounded', l.cls)} />
                <span className="text-xs text-slate-500">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// â”€â”€â”€ Tab: Campaigns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CampaignsTab({
  campaigns, posts, postAnalytics, loading,
}: {
  campaigns: Campaign[]
  posts: ContentPost[]
  postAnalytics: PostAnalytic[]
  loading: boolean
}) {
  const enriched = useMemo(() => {
    const paMap: Record<string, PostAnalytic[]> = {}
    postAnalytics.forEach(pa => {
      if (!paMap[pa.post_id]) paMap[pa.post_id] = []
      paMap[pa.post_id].push(pa)
    })
    return campaigns.map(c => {
      const campaignPosts = posts.filter(p => p.campaign_id === c.id)
      const allPa = campaignPosts.flatMap(p => paMap[p.id] ?? [])
      const totalImpressions = allPa.reduce((s, r) => s + (r.impressions ?? 0), 0)
      const totalReach       = allPa.reduce((s, r) => s + (r.reach ?? 0), 0)
      const avgEng = allPa.length ? allPa.reduce((s, r) => s + (r.engagement_rate ?? 0), 0) / allPa.length : 0
      return { ...c, postsCount: campaignPosts.length, totalImpressions, totalReach, avgEng }
    })
  }, [campaigns, posts, postAnalytics])

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Campaign Performance</h3>
      </div>
      {loading ? (
        <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : enriched.length === 0 ? (
        <EmptyState compact icon={Target} title="No campaigns" description="Create a campaign and publish posts to see analytics." action={{ label: 'Go to Campaigns', onClick: () => window.location.href = '/app/campaigns' }} />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">Campaign</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Dates</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Posts</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Impressions</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Reach</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Avg Eng. Rate</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Details</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map(c => (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 font-medium text-slate-900">{c.name}</td>
                <td className="px-4 py-3"><Badge variant={c.status === 'active' ? 'green' : 'default'}>{c.status}</Badge></td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                  {c.start_date ? formatDate(c.start_date) : 'â€”'} â€“ {c.end_date ? formatDate(c.end_date) : 'â€”'}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{c.postsCount}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{fmt(c.totalImpressions)}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{fmt(c.totalReach)}</td>
                <td className="px-4 py-3 text-sm font-medium text-emerald-600">{fmtPct(c.avgEng)}</td>
                <td className="px-4 py-3">
                  <a href={`/app/campaigns/${c.id}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    View <ExternalLink size={10} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// â”€â”€â”€ Tab: Reports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ReportsTab({
  channelAnalytics, posts, fromDate, toDate, rangeKey,
}: {
  channelAnalytics: ChannelAnalytic[]
  posts: ContentPost[]
  fromDate: string
  toDate: string
  rangeKey: DateRangeKey
}) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [reportDateFrom, setReportDateFrom] = useState(fromDate)
  const [reportDateTo, setReportDateTo]     = useState(toDate)
  const [reportPlatforms, setReportPlatforms] = useState<string[]>([])
  const [metrics, setMetrics] = useState({ impressions: true, reach: true, engagementRate: true, followers: false, posts: true })

  const kpis = useMemo(() => aggregateKpis(channelAnalytics, posts), [channelAnalytics, posts])

  const toggleMetric = (k: keyof typeof metrics) => setMetrics(m => ({ ...m, [k]: !m[k] }))

  const downloadText = () => {
    const lines = [
      `Caption Fox Analytics Report`,
      `Period: ${reportDateFrom} to ${reportDateTo}`,
      `Generated: ${new Date().toISOString()}`,
      ``,
      metrics.impressions    ? `Total Impressions:   ${fmt(kpis.totalImpressions)}` : '',
      metrics.reach          ? `Total Reach:         ${fmt(kpis.totalReach)}` : '',
      metrics.engagementRate ? `Avg Engagement Rate: ${fmtPct(kpis.avgEngRate)}` : '',
      metrics.followers      ? `Total Followers:     ${fmt(kpis.totalFollowers)}` : '',
      metrics.posts          ? `Posts Published:     ${kpis.postsPublished}` : '',
    ].filter(Boolean).join('\n')
    const blob = new Blob([lines], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'analytics-report.txt'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Generate section */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Generate Report</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1.5">From</label>
              <input type="date" value={reportDateFrom} onChange={e => setReportDateFrom(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1.5">To</label>
              <input type="date" value={reportDateTo} onChange={e => setReportDateTo(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-2">Platform Filter</label>
            <div className="flex flex-wrap gap-2">
              {['Instagram', 'TikTok', 'LinkedIn', 'Facebook', 'X', 'YouTube'].map(p => (
                <button key={p} type="button"
                  onClick={() => setReportPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                  className={cn('px-3 py-1.5 text-xs font-medium rounded-full border transition-all',
                    reportPlatforms.includes(p) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300')}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-2">Metrics to Include</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(metrics) as Array<keyof typeof metrics>).map(k => (
                <label key={k} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={metrics[k]} onChange={() => toggleMetric(k)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-slate-700 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={() => setPreviewOpen(true)} icon={<Eye size={14} />}>Preview Report</Button>
            <Button variant="secondary" onClick={downloadText} icon={<Download size={14} />}>Download</Button>
          </div>
        </div>
      </div>

      {/* Saved reports */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Saved Reports</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {SAVED_REPORTS_DEMO.map(r => (
            <div key={r.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">{r.name}</p>
                <p className="text-xs text-slate-500">{r.type} Â· {r.range} Â· Generated {formatDate(r.created_at)}</p>
              </div>
              <Button size="sm" variant="secondary" icon={<Download size={12} />}>Download</Button>
            </div>
          ))}
        </div>
      </div>

      {/* Preview modal */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Report Preview" size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPreviewOpen(false)}>Close</Button>
            <Button onClick={downloadText} icon={<Download size={14} />}>Download</Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="bg-slate-50 rounded-lg p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
{`Caption Fox Analytics Report
Period: ${reportDateFrom} to ${reportDateTo}
Generated: ${new Date().toLocaleDateString('en-GB')}

${metrics.impressions    ? `Total Impressions:   ${fmt(kpis.totalImpressions)}` : ''}
${metrics.reach          ? `Total Reach:         ${fmt(kpis.totalReach)}` : ''}
${metrics.engagementRate ? `Avg Engagement Rate: ${fmtPct(kpis.avgEngRate)}` : ''}
${metrics.followers      ? `Total Followers:     ${fmt(kpis.totalFollowers)}` : ''}
${metrics.posts          ? `Posts Published:     ${kpis.postsPublished}` : ''}`}
          </div>
        </div>
      </Modal>
    </div>
  )
}

// â”€â”€â”€ Tab: Benchmarks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function BenchmarksTab({
  channelAnalytics, posts, loading,
}: {
  channelAnalytics: ChannelAnalytic[]
  posts: ContentPost[]
  loading: boolean
}) {
  const kpis = useMemo(() => aggregateKpis(channelAnalytics, posts), [channelAnalytics, posts])

  const rows = INDUSTRY_BENCHMARKS.map(b => {
    let yours: number | null = null
    if (b.metric === 'Engagement Rate')   yours = kpis.avgEngRate
    if (b.metric === 'Reach Rate')        yours = kpis.totalFollowers ? (kpis.totalReach / kpis.totalFollowers) * 100 : null
    if (b.metric === 'Posts Published')   yours = kpis.postsPublished
    const diff = yours !== null ? yours - b.industry : null
    return { ...b, yours, diff }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700">
          Industry benchmarks are static averages. Your data is calculated from connected channels in the selected date range.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">Metric</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Your Average</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Industry Average</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">vs Industry</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.metric} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-900">{r.metric}</td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {loading ? 'â€¦' : r.yours !== null ? `${r.yours.toFixed(2)}${r.unit}` : 'â€”'}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{r.industry}{r.unit}</td>
                <td className="px-4 py-3">
                  {r.diff !== null ? (
                    <span className={cn('text-sm font-medium flex items-center gap-1', r.diff >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                      {r.diff >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      {r.diff >= 0 ? '+' : ''}{r.diff.toFixed(2)}{r.unit}
                    </span>
                  ) : <span className="text-sm text-slate-400">â€”</span>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// â”€â”€â”€ Tab: Analytics Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SettingsTab({
  channels, wsId,
}: {
  channels: SocialChannel[]
  wsId: string | null
}) {
  const [includeWeekends,       setIncludeWeekends]       = useState(true)
  const [autoMonthlyReport,     setAutoMonthlyReport]     = useState(false)
  const [defaultRange,          setDefaultRange]          = useState('30d')
  const [channelToggles,        setChannelToggles]        = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  useEffect(() => {
    const init: Record<string, boolean> = {}
    channels.forEach(c => { init[c.id] = c.analytics_enabled !== false })
    setChannelToggles(init)
  }, [channels])

  const handleSave = async () => {
    if (!wsId) return
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from('workspaces')
      .update({
        settings: {
          analytics: {
            includeWeekends,
            autoMonthlyReport,
            defaultDateRange: defaultRange,
            channelAnalytics: channelToggles,
          },
        },
      })
      .eq('id', wsId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
        <h3 className="text-sm font-semibold text-slate-900">Reporting Preferences</h3>

        {/* Include weekends */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-800">Include weekends in reporting</p>
            <p className="text-xs text-slate-500">Count Saturday and Sunday in analytics calculations</p>
          </div>
          <button
            onClick={() => setIncludeWeekends(v => !v)}
            className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
              includeWeekends ? 'bg-blue-600' : 'bg-slate-200')}
          >
            <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
              includeWeekends ? 'translate-x-6' : 'translate-x-1')} />
          </button>
        </div>

        {/* Auto-generate monthly report */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-800">Auto-generate monthly report</p>
            <p className="text-xs text-slate-500">Automatically create a report at the end of each month</p>
          </div>
          <button
            onClick={() => setAutoMonthlyReport(v => !v)}
            className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
              autoMonthlyReport ? 'bg-blue-600' : 'bg-slate-200')}
          >
            <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
              autoMonthlyReport ? 'translate-x-6' : 'translate-x-1')} />
          </button>
        </div>

        {/* Default date range */}
        <div>
          <label className="text-sm font-medium text-slate-800 block mb-1.5">Default Date Range</label>
          <select
            value={defaultRange}
            onChange={e => setDefaultRange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="14d">Last 14 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Connected channels */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Analytics per Channel</h3>
        </div>
        {channels.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">
            No channels connected. <a href="/app/settings?tab=channels" className="text-blue-600 hover:underline">Connect a channel â†’</a>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {channels.map(ch => (
              <div key={ch.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: PLATFORM_COLORS[ch.platform?.toLowerCase()] ?? '#e2e8f0' }}>
                    <Users size={14} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{ch.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{ch.platform}</p>
                  </div>
                </div>
                <button
                  onClick={() => setChannelToggles(t => ({ ...t, [ch.id]: !t[ch.id] }))}
                  className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                    channelToggles[ch.id] ? 'bg-blue-600' : 'bg-slate-200')}
                >
                  <span className={cn('inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform',
                    channelToggles[ch.id] ? 'translate-x-5' : 'translate-x-1')} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button onClick={handleSave} loading={saving} className="w-full justify-center">
        {saved ? 'Saved!' : 'Save Settings'}
      </Button>
    </div>
  )
}

// â”€â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// ─── Tab: Competitors ────────────────────────────────────────────────────────

function CompetitorsTab() {
  const competitors = [
    { name: 'BrandAlpha', platform: 'Instagram', followers: '142K', engRate: '3.2%', posts: 24 },
    { name: 'RivalCo', platform: 'TikTok', followers: '89K', engRate: '5.7%', posts: 18 },
    { name: 'TopMark', platform: 'LinkedIn', followers: '34K', engRate: '1.9%', posts: 12 },
  ]
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Competitor Analysis</h3>
            <p className="text-xs text-slate-500 mt-0.5">Benchmark your brand against competitor accounts</p>
          </div>
          <a
            href="/app/analytics/competitors"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            Open Competitor Analysis <ExternalLink size={11} />
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Competitor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Platform</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Followers</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Eng. Rate</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Posts / Mo</th>
              </tr>
            </thead>
            <tbody>
              {competitors.map(c => (
                <tr key={c.name} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 capitalize">{c.platform}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{c.followers}</td>
                  <td className="px-4 py-3 text-sm font-medium text-emerald-600">{c.engRate}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{c.posts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
          <Info size={11} /> Preview data shown. Open Competitor Analysis for full benchmarking tools.
        </p>
      </div>
    </div>
  )
}

// ─── Tab: Scheduled Reports ──────────────────────────────────────────────────

function ScheduledReportsTab() {
  const examples = [
    { name: 'Weekly Analytics Summary', freq: 'Every Monday', recipients: 3, status: 'active' },
    { name: 'Monthly Campaign Report', freq: '1st of each month', recipients: 5, status: 'active' },
    { name: 'Bi-weekly Inbox Digest', freq: 'Every 2 weeks', recipients: 2, status: 'paused' },
  ]
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Scheduled Reports</h3>
            <p className="text-xs text-slate-500 mt-0.5">Automatically send analytics reports to your team and stakeholders</p>
          </div>
          <a
            href="/app/analytics/reports"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            Manage Reports <ExternalLink size={11} />
          </a>
        </div>
        <div className="space-y-2">
          {examples.map(r => (
            <div key={r.name} className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
              <div>
                <p className="text-sm font-medium text-slate-800">{r.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{r.freq} &middot; {r.recipients} recipients</p>
              </div>
              <span className={cn(
                'px-2 py-0.5 text-xs font-medium rounded-full capitalize',
                r.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500',
              )}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
          <Info size={11} /> Example reports shown. Open Manage Reports to create and schedule your own.
        </p>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [activeTab,   setActiveTab]   = useState('overview')
  const [rangeKey,    setRangeKey]    = useState<DateRangeKey>('30d')
  const [customFrom,  setCustomFrom]  = useState('')
  const [customTo,    setCustomTo]    = useState('')

  const handleCustomChange = (from: string, to: string) => {
    setCustomFrom(from); setCustomTo(to)
  }

  const {
    channelAnalytics, postAnalytics, posts, channels, campaigns,
    loading, wsId, fromDate, toDate,
  } = useAnalyticsData(rangeKey, customFrom, customTo)

  const showDatePicker = !['reports', 'sched-reports', 'competitors', 'benchmarks', 'settings'].includes(activeTab)

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Analytics"
        subtitle="Enterprise analytics hub â€” track performance across all channels and campaigns."
      >
        <Button variant="secondary" size="sm" icon={<RefreshCw size={13} />} onClick={() => {}}>
          Refresh
        </Button>
      </PageHeader>

      {/* Tabs + date range */}
      <div className="flex flex-col gap-3">
        <Tabs tabs={ANALYTICS_TABS} active={activeTab} onChange={setActiveTab} />
        {showDatePicker && (
          <DateRangeSelector
            value={rangeKey}
            onChange={setRangeKey}
            customFrom={customFrom}
            customTo={customTo}
            onCustomChange={handleCustomChange}
          />
        )}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab channelAnalytics={channelAnalytics} postAnalytics={postAnalytics} posts={posts} channels={channels} loading={loading} fromDate={fromDate} toDate={toDate} />
      )}
      {activeTab === 'content' && (
        <ContentTab posts={posts} postAnalytics={postAnalytics} loading={loading} />
      )}
      {activeTab === 'audience' && (
        <AudienceTab channelAnalytics={channelAnalytics} channels={channels} loading={loading} fromDate={fromDate} toDate={toDate} />
      )}
      {activeTab === 'reach' && (
        <ReachTab channelAnalytics={channelAnalytics} loading={loading} fromDate={fromDate} toDate={toDate} />
      )}
      {activeTab === 'engagement' && (
        <EngagementTab channelAnalytics={channelAnalytics} postAnalytics={postAnalytics} loading={loading} fromDate={fromDate} toDate={toDate} />
      )}
      {activeTab === 'campaigns' && (
        <CampaignsTab campaigns={campaigns} posts={posts} postAnalytics={postAnalytics} loading={loading} />
      )}
      {activeTab === 'competitors' && (
        <CompetitorsTab />
      )}
      {activeTab === 'sched-reports' && (
        <ScheduledReportsTab />
      )}
      {activeTab === 'reports' && (
        <ReportsTab channelAnalytics={channelAnalytics} posts={posts} fromDate={fromDate} toDate={toDate} rangeKey={rangeKey} />
      )}
      {activeTab === 'benchmarks' && (
        <BenchmarksTab channelAnalytics={channelAnalytics} posts={posts} loading={loading} />
      )}
      {activeTab === 'settings' && (
        <SettingsTab channels={channels} wsId={wsId} />
      )}
    </div>
  )
}


