'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Radio, Plus, Settings, Search, Filter, Download, Star, Eye, CheckCircle,
  AlertCircle, TrendingUp, MessageSquare, Bell, Hash, Globe, Rss,
  Activity, ChevronDown, X, Clock, ExternalLink, Users, AtSign,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ListeningKeyword {
  id: string
  workspace_id: string
  keyword: string
  match_type: string
  platforms: string[]
  is_active: boolean
  alert_enabled: boolean
  alert_threshold: number
  color: string
  created_at: string
}

interface BrandMention {
  id: string
  workspace_id: string
  keyword_id: string | null
  platform: string
  author_name: string | null
  author_handle: string | null
  author_followers: number | null
  content: string
  url: string | null
  sentiment: string
  sentiment_score: number | null
  is_read: boolean
  is_starred: boolean
  is_actioned: boolean
  assigned_to: string | null
  reach_estimate: number | null
  engagement_count: number
  mentioned_at: string
}

interface ListeningAlert {
  id: string
  keyword_id: string | null
  alert_type: string
  title: string
  message: string | null
  is_read: boolean
  triggered_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS = ['Instagram', 'TikTok', 'X', 'YouTube', 'LinkedIn', 'Facebook', 'News', 'Reddit']
const MATCH_TYPES = ['contains', 'exact', 'hashtag', 'mention']
const PRESET_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#22C55E', '#EF4444']
const SENTIMENT_COLORS = { positive: '#22C55E', neutral: '#94A3B8', negative: '#EF4444' }
const ALERT_TYPES: Record<string, { label: string; color: string }> = {
  volume_spike:       { label: 'Volume Spike',        color: 'bg-orange-100 text-orange-700' },
  negative_sentiment: { label: 'Negative Sentiment',  color: 'bg-red-100 text-red-700' },
  viral:              { label: 'Viral',                color: 'bg-purple-100 text-purple-700' },
  competitor_mention: { label: 'Competitor',           color: 'bg-blue-100 text-blue-700' },
  new_mention:        { label: 'New Mention',          color: 'bg-green-100 text-green-700' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function fmtNum(n: number | null | undefined): string {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function platformIcon(platform: string) {
  const map: Record<string, string> = {
    Instagram: 'IG', TikTok: 'TT', X: 'X', YouTube: 'YT',
    LinkedIn: 'LI', Facebook: 'FB', News: 'NW', Reddit: 'RD',
  }
  const colors: Record<string, string> = {
    Instagram: 'bg-pink-500', TikTok: 'bg-black', X: 'bg-slate-800',
    YouTube: 'bg-red-600', LinkedIn: 'bg-blue-700', Facebook: 'bg-blue-600',
    News: 'bg-slate-600', Reddit: 'bg-orange-500',
  }
  return (
    <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold text-white shrink-0', colors[platform] ?? 'bg-slate-400')}>
      {map[platform] ?? platform.slice(0, 2).toUpperCase()}
    </span>
  )
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const map: Record<string, string> = {
    positive: 'bg-green-50 text-green-700 border border-green-200',
    neutral:  'bg-slate-50 text-slate-600 border border-slate-200',
    negative: 'bg-red-50 text-red-700 border border-red-200',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', map[sentiment] ?? map.neutral)}>
      {sentiment === 'positive' ? '↑' : sentiment === 'negative' ? '↓' : '—'}
      {sentiment}
    </span>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, badge, badgeColor }: {
  label: string; value: string | number; badge?: string; badgeColor?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-1">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {badge && (
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full w-fit', badgeColor ?? 'bg-slate-100 text-slate-600')}>
          {badge}
        </span>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-slate-200 rounded', className)} />
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({ title, message, onConfirm, onCancel }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Keyword Modal ────────────────────────────────────────────────────────

function AddKeywordModal({
  onClose, onSave, workspaceId,
}: { onClose: () => void; onSave: (kw: ListeningKeyword) => void; workspaceId: string }) {
  const supabase = createClient()
  const [keyword, setKeyword] = useState('')
  const [matchType, setMatchType] = useState('contains')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [color, setColor] = useState('#3B82F6')
  const [alertEnabled, setAlertEnabled] = useState(true)
  const [alertThreshold, setAlertThreshold] = useState(10)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function togglePlatform(p: string) {
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  async function handleSave() {
    if (!keyword.trim()) { setError('Keyword is required'); return }
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase.from('listening_keywords').insert({
      workspace_id: workspaceId,
      keyword: keyword.trim(),
      match_type: matchType,
      platforms: selectedPlatforms,
      color,
      alert_enabled: alertEnabled,
      alert_threshold: alertThreshold,
    }).select().single()
    setSaving(false)
    if (err) { setError(err.message); return }
    onSave(data as ListeningKeyword)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Add Keyword</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Keyword *</label>
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="e.g. Caption Fox, #CaptionFox"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Match Type</label>
            <select
              value={matchType}
              onChange={e => setMatchType(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MATCH_TYPES.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Platforms</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    selectedPlatforms.includes(p)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Color</label>
            <div className="flex gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn('w-7 h-7 rounded-full transition-all', color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : '')}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-slate-700">Enable Alerts</p>
              <p className="text-xs text-slate-500">Get notified when threshold is exceeded</p>
            </div>
            <button
              onClick={() => setAlertEnabled(!alertEnabled)}
              className={cn('w-10 h-5.5 rounded-full transition-colors relative', alertEnabled ? 'bg-blue-600' : 'bg-slate-200')}
              style={{ height: '22px', width: '40px' }}
            >
              <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', alertEnabled ? 'translate-x-5' : 'translate-x-0.5')} />
            </button>
          </div>

          {alertEnabled && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Alert Threshold (mentions per 24h)</label>
              <input
                type="number"
                min={1}
                value={alertThreshold}
                onChange={e => setAlertThreshold(Number(e.target.value))}
                className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end p-5 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Add Keyword'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ListeningPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'feed' | 'keywords' | 'sentiment' | 'volume' | 'alerts' | 'competitors'>('feed')
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Data
  const [keywords, setKeywords] = useState<ListeningKeyword[]>([])
  const [mentions, setMentions] = useState<BrandMention[]>([])
  const [alerts, setAlerts] = useState<ListeningAlert[]>([])

  // Feed filters
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState('All')
  const [sentimentFilter, setSentimentFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [dateRange, setDateRange] = useState('30d')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [mentionPage, setMentionPage] = useState(20)
  const [expandedMentions, setExpandedMentions] = useState<Set<string>>(new Set())

  // Modals
  const [showAddKeyword, setShowAddKeyword] = useState(false)
  const [showAlertsModal, setShowAlertsModal] = useState(false)
  const [deleteKeyword, setDeleteKeyword] = useState<ListeningKeyword | null>(null)
  const [editKeyword, setEditKeyword] = useState<ListeningKeyword | null>(null)

  // Load workspace
  useEffect(() => {
    async function loadWorkspace() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      if (data?.workspace_id) setWorkspaceId(data.workspace_id)
      setLoading(false)
    }
    loadWorkspace()
  }, [])

  // Load data
  useEffect(() => {
    if (!workspaceId) return
    loadAll()
  }, [workspaceId])

  async function loadAll() {
    const [kwRes, mentionRes, alertRes] = await Promise.all([
      supabase.from('listening_keywords').select('*').eq('workspace_id', workspaceId!).order('created_at', { ascending: false }),
      supabase.from('brand_mentions').select('*').eq('workspace_id', workspaceId!).order('mentioned_at', { ascending: false }).limit(200),
      supabase.from('listening_alerts').select('*').eq('workspace_id', workspaceId!).order('triggered_at', { ascending: false }).limit(100),
    ])
    if (kwRes.data) setKeywords(kwRes.data as ListeningKeyword[])
    if (mentionRes.data) setMentions(mentionRes.data as BrandMention[])
    if (alertRes.data) setAlerts(alertRes.data as ListeningAlert[])
  }

  // ─── KPI computations ───────────────────────────────────────────────────────

  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 86400000
  const last30Mentions = useMemo(() => mentions.filter(m => new Date(m.mentioned_at).getTime() >= thirtyDaysAgo), [mentions])
  const positiveMentions = last30Mentions.filter(m => m.sentiment === 'positive')
  const negativeMentions = last30Mentions.filter(m => m.sentiment === 'negative')
  const positivePct = last30Mentions.length ? Math.round((positiveMentions.length / last30Mentions.length) * 100) : 0
  const negativePct = last30Mentions.length ? Math.round((negativeMentions.length / last30Mentions.length) * 100) : 0
  const totalReach = last30Mentions.reduce((s, m) => s + (m.reach_estimate ?? 0), 0)
  const unreadCount = mentions.filter(m => !m.is_read).length

  // ─── Feed Filter ────────────────────────────────────────────────────────────

  const filteredMentions = useMemo(() => {
    const daysMap: Record<string, number> = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 }
    const days = daysMap[dateRange] ?? 30
    const cutoff = Date.now() - days * 86400000
    return mentions.filter(m => {
      if (new Date(m.mentioned_at).getTime() < cutoff) return false
      if (platformFilter !== 'All' && m.platform !== platformFilter) return false
      if (sentimentFilter !== 'All' && m.sentiment !== sentimentFilter.toLowerCase()) return false
      if (statusFilter === 'Unread' && m.is_read) return false
      if (statusFilter === 'Starred' && !m.is_starred) return false
      if (statusFilter === 'Actioned' && !m.is_actioned) return false
      if (search && !m.content.toLowerCase().includes(search.toLowerCase()) &&
          !m.author_handle?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [mentions, platformFilter, sentimentFilter, statusFilter, dateRange, search])

  const visibleMentions = filteredMentions.slice(0, mentionPage)

  // ─── Toggle mention state ────────────────────────────────────────────────────

  async function toggleMentionField(id: string, field: 'is_starred' | 'is_read' | 'is_actioned', current: boolean) {
    await supabase.from('brand_mentions').update({ [field]: !current }).eq('id', id)
    setMentions(prev => prev.map(m => m.id === id ? { ...m, [field]: !current } : m))
  }

  // ─── Delete keyword ──────────────────────────────────────────────────────────

  async function confirmDeleteKeyword() {
    if (!deleteKeyword) return
    await supabase.from('listening_keywords').delete().eq('id', deleteKeyword.id)
    setKeywords(prev => prev.filter(k => k.id !== deleteKeyword.id))
    setDeleteKeyword(null)
  }

  // ─── Toggle keyword active ───────────────────────────────────────────────────

  async function toggleKeywordActive(kw: ListeningKeyword) {
    await supabase.from('listening_keywords').update({ is_active: !kw.is_active }).eq('id', kw.id)
    setKeywords(prev => prev.map(k => k.id === kw.id ? { ...k, is_active: !k.is_active } : k))
  }

  // ─── Mark all alerts read ────────────────────────────────────────────────────

  async function markAllAlertsRead() {
    if (!workspaceId) return
    await supabase.from('listening_alerts').update({ is_read: true }).eq('workspace_id', workspaceId)
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })))
  }

  // ─── Sentiment over time data ────────────────────────────────────────────────

  const sentimentOverTime = useMemo(() => {
    const map: Record<string, { date: string; positive: number; neutral: number; negative: number }> = {}
    last30Mentions.forEach(m => {
      const d = m.mentioned_at.slice(0, 10)
      if (!map[d]) map[d] = { date: d, positive: 0, neutral: 0, negative: 0 }
      map[d][m.sentiment as 'positive' | 'neutral' | 'negative']++
    })
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
  }, [last30Mentions])

  // ─── Volume over time data ───────────────────────────────────────────────────

  const volumeOverTime = useMemo(() => {
    const map: Record<string, number> = {}
    last30Mentions.forEach(m => {
      const d = m.mentioned_at.slice(0, 10)
      map[d] = (map[d] ?? 0) + 1
    })
    return Object.entries(map).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))
  }, [last30Mentions])

  // ─── Sentiment by platform ───────────────────────────────────────────────────

  const sentimentByPlatform = useMemo(() => {
    const map: Record<string, { platform: string; positive: number; neutral: number; negative: number }> = {}
    last30Mentions.forEach(m => {
      if (!map[m.platform]) map[m.platform] = { platform: m.platform, positive: 0, neutral: 0, negative: 0 }
      map[m.platform][m.sentiment as 'positive' | 'neutral' | 'negative']++
    })
    return Object.values(map)
  }, [last30Mentions])

  // ─── Top authors ─────────────────────────────────────────────────────────────

  const topAuthors = useMemo(() => {
    const map: Record<string, { handle: string; platform: string; count: number; sentimentSum: number }> = {}
    last30Mentions.forEach(m => {
      const key = m.author_handle ?? m.author_name ?? 'Unknown'
      if (!map[key]) map[key] = { handle: key, platform: m.platform, count: 0, sentimentSum: 0 }
      map[key].count++
      map[key].sentimentSum += m.sentiment === 'positive' ? 1 : m.sentiment === 'negative' ? -1 : 0
    })
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 10)
  }, [last30Mentions])

  // ─── Trending hashtags ────────────────────────────────────────────────────────

  const trendingHashtags = useMemo(() => {
    const map: Record<string, number> = {}
    last30Mentions.forEach(m => {
      const tags = m.content.match(/#\w+/g) ?? []
      tags.forEach(t => { map[t.toLowerCase()] = (map[t.toLowerCase()] ?? 0) + 1 })
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 20)
  }, [last30Mentions])

  // ─── Share of voice ───────────────────────────────────────────────────────────

  const shareOfVoice = useMemo(() => {
    const brandKws = keywords.filter(k => !k.keyword.startsWith('@') && k.is_active)
    if (brandKws.length === 0) return []
    const map: Record<string, number> = {}
    last30Mentions.forEach(m => {
      if (!m.keyword_id) return
      const kw = keywords.find(k => k.id === m.keyword_id)
      if (kw) map[kw.keyword] = (map[kw.keyword] ?? 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [last30Mentions, keywords])

  const PIE_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#22C55E', '#EF4444']

  // ─── Keyword stats ────────────────────────────────────────────────────────────

  function kwStats(kwId: string) {
    const sevenDays = Date.now() - 7 * 86400000
    const kwMentions = mentions.filter(m => m.keyword_id === kwId)
    const last7 = kwMentions.filter(m => new Date(m.mentioned_at).getTime() >= sevenDays).length
    const last30 = kwMentions.filter(m => new Date(m.mentioned_at).getTime() >= thirtyDaysAgo).length
    const scores = kwMentions.filter(m => m.sentiment_score !== null).map(m => m.sentiment_score!)
    const avgSentiment = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : null
    return { last7, last30, avgSentiment }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  const TABS = [
    { key: 'feed',        label: 'Feed' },
    { key: 'keywords',    label: 'Keywords' },
    { key: 'sentiment',   label: 'Sentiment Analysis' },
    { key: 'volume',      label: 'Volume & Trends' },
    { key: 'alerts',      label: `Alerts${alerts.filter(a => !a.is_read).length > 0 ? ` (${alerts.filter(a => !a.is_read).length})` : ''}` },
    { key: 'competitors', label: 'Competitors' },
  ] as const

  if (loading) {
    return (
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!workspaceId) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <p className="text-slate-500">No workspace found.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Radio size={16} className="text-white" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">Social Listening</h1>
            </div>
            <p className="text-sm text-slate-500">Monitor brand mentions, track keywords, and detect sentiment across the web.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowAlertsModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Bell size={14} />
              Configure Alerts
            </button>
            <button
              onClick={() => setShowAddKeyword(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} />
              Add Keyword
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <KpiCard label="Total Mentions (30d)" value={fmtNum(last30Mentions.length)} />
          <KpiCard
            label="Positive Sentiment"
            value={`${positivePct}%`}
            badge={`${positiveMentions.length} mentions`}
            badgeColor="bg-green-50 text-green-700"
          />
          <KpiCard
            label="Negative Mentions"
            value={negativeMentions.length}
            badge={negativePct > 10 ? `⚠ ${negativePct}% — high` : `${negativePct}%`}
            badgeColor={negativePct > 10 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}
          />
          <KpiCard label="Reach Estimate" value={fmtNum(totalReach)} />
          <KpiCard
            label="Unread Mentions"
            value={unreadCount}
            badge={unreadCount > 0 ? 'needs review' : 'all clear'}
            badgeColor={unreadCount > 0 ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}
          />
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 bg-white rounded-t-xl px-4">
          <div className="flex gap-0 overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  'px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  activeTab === t.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── TAB: Feed ─── */}
        {activeTab === 'feed' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Search */}
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search mentions…"
                    className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {/* Date range */}
                <select
                  value={dateRange}
                  onChange={e => setDateRange(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="14d">Last 14 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                </select>
                {/* View toggle */}
                <div className="flex border border-slate-200 rounded-lg overflow-hidden">
                  <button onClick={() => setViewMode('grid')} className={cn('px-3 py-2 text-xs font-medium', viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50')}>Grid</button>
                  <button onClick={() => setViewMode('list')} className={cn('px-3 py-2 text-xs font-medium', viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50')}>List</button>
                </div>
              </div>
              {/* Platform chips */}
              <div className="flex flex-wrap gap-2">
                {['All', ...PLATFORMS].map(p => (
                  <button
                    key={p}
                    onClick={() => setPlatformFilter(p)}
                    className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-colors', platformFilter === p ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400')}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {/* Sentiment + status chips */}
              <div className="flex flex-wrap gap-2">
                {['All', 'Positive', 'Neutral', 'Negative'].map(s => (
                  <button
                    key={s}
                    onClick={() => setSentimentFilter(s)}
                    className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-colors', sentimentFilter === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400')}
                  >
                    {s}
                  </button>
                ))}
                <span className="text-slate-300 self-center">|</span>
                {['All', 'Unread', 'Starred', 'Actioned'].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-colors', statusFilter === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400')}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Count */}
            <p className="text-xs text-slate-500">{filteredMentions.length} mention{filteredMentions.length !== 1 ? 's' : ''} found</p>

            {/* Mention cards */}
            {filteredMentions.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <Radio size={36} className="mx-auto text-slate-300 mb-3" />
                <p className="text-base font-semibold text-slate-700 mb-1">No mentions found</p>
                <p className="text-sm text-slate-500 mb-4">Add keywords to start monitoring your brand across the web.</p>
                <button onClick={() => setShowAddKeyword(true)} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                  <Plus size={14} /> Add Keyword
                </button>
              </div>
            ) : (
              <div className={cn(viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'space-y-3')}>
                {visibleMentions.map(m => {
                  const expanded = expandedMentions.has(m.id)
                  const kw = keywords.find(k => k.id === m.keyword_id)
                  return (
                    <div key={m.id} className={cn('bg-white rounded-xl border transition-shadow hover:shadow-md', m.is_read ? 'border-slate-200' : 'border-blue-200 bg-blue-50/20')}>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            {platformIcon(m.platform)}
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {m.author_handle ? `@${m.author_handle}` : m.author_name ?? 'Unknown'}
                              </p>
                              {m.author_followers !== null && (
                                <p className="text-xs text-slate-500">{fmtNum(m.author_followers)} followers</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <SentimentBadge sentiment={m.sentiment} />
                            {kw && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: kw.color }}>
                                {kw.keyword}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-sm text-slate-700 mb-3 leading-relaxed">
                          {expanded ? m.content : m.content.slice(0, 180)}
                          {m.content.length > 180 && (
                            <button
                              onClick={() => setExpandedMentions(prev => {
                                const s = new Set(prev)
                                expanded ? s.delete(m.id) : s.add(m.id)
                                return s
                              })}
                              className="ml-1 text-blue-600 text-xs hover:underline"
                            >
                              {expanded ? 'Show less' : 'Read more'}
                            </button>
                          )}
                        </p>

                        <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                          {m.reach_estimate !== null && <span>Reach: {fmtNum(m.reach_estimate)}</span>}
                          {m.engagement_count > 0 && <span>Engagements: {fmtNum(m.engagement_count)}</span>}
                          <span className="flex items-center gap-1"><Clock size={11} />{timeAgo(m.mentioned_at)}</span>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                          <button
                            onClick={() => toggleMentionField(m.id, 'is_starred', m.is_starred)}
                            className={cn('flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors', m.is_starred ? 'bg-amber-50 text-amber-600' : 'text-slate-500 hover:bg-slate-50')}
                            title="Star"
                          >
                            <Star size={12} className={m.is_starred ? 'fill-amber-400 text-amber-400' : ''} />
                            Star
                          </button>
                          <button
                            onClick={() => toggleMentionField(m.id, 'is_read', m.is_read)}
                            className={cn('flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors', m.is_read ? 'text-slate-400' : 'bg-blue-50 text-blue-600')}
                            title="Mark read"
                          >
                            <Eye size={12} />
                            {m.is_read ? 'Read' : 'Mark Read'}
                          </button>
                          <button
                            onClick={() => toggleMentionField(m.id, 'is_actioned', m.is_actioned)}
                            className={cn('flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors', m.is_actioned ? 'bg-green-50 text-green-600' : 'text-slate-500 hover:bg-slate-50')}
                          >
                            <CheckCircle size={12} />
                            {m.is_actioned ? 'Actioned' : 'Action'}
                          </button>
                          {m.url && (
                            <a href={m.url} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors">
                              <ExternalLink size={12} />
                              View original
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Load more */}
            {filteredMentions.length > mentionPage && (
              <div className="text-center pt-2">
                <button
                  onClick={() => setMentionPage(p => p + 20)}
                  className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Load more ({filteredMentions.length - mentionPage} remaining)
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: Keywords ─── */}
        {activeTab === 'keywords' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{keywords.length} keyword{keywords.length !== 1 ? 's' : ''} configured</p>
              <button onClick={() => setShowAddKeyword(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                <Plus size={14} /> Add Keyword
              </button>
            </div>

            {keywords.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <Hash size={36} className="mx-auto text-slate-300 mb-3" />
                <p className="text-base font-semibold text-slate-700 mb-1">No keywords yet</p>
                <p className="text-sm text-slate-500 mb-4">Add keywords to start monitoring mentions across social platforms.</p>
                <button onClick={() => setShowAddKeyword(true)} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                  <Plus size={14} /> Add First Keyword
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {keywords.map(kw => {
                  const stats = kwStats(kw.id)
                  return (
                    <div key={kw.id} className="bg-white rounded-xl border border-slate-200 p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: kw.color }} />
                          <span className="text-base font-bold text-slate-900">{kw.keyword}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => toggleKeywordActive(kw)}
                            className={cn('px-2.5 py-1 rounded-full text-xs font-medium transition-colors', kw.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500')}
                          >
                            {kw.is_active ? 'Active' : 'Paused'}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-4">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">{kw.match_type}</span>
                        {kw.platforms.map(p => (
                          <span key={p} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">{p}</span>
                        ))}
                      </div>

                      <div className="grid grid-cols-3 gap-3 mb-4 py-3 border-t border-b border-slate-100">
                        <div className="text-center">
                          <p className="text-lg font-bold text-slate-900">{stats.last7}</p>
                          <p className="text-xs text-slate-500">7d</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-slate-900">{stats.last30}</p>
                          <p className="text-xs text-slate-500">30d</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-slate-900">
                            {stats.avgSentiment !== null ? stats.avgSentiment.toFixed(2) : '—'}
                          </p>
                          <p className="text-xs text-slate-500">Avg sentiment</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Bell size={11} />
                          {kw.alert_enabled ? `Alert at ${kw.alert_threshold}/24h` : 'Alerts off'}
                        </div>
                        <button
                          onClick={() => setDeleteKeyword(kw)}
                          className="text-xs text-red-500 hover:text-red-700 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: Sentiment Analysis ─── */}
        {activeTab === 'sentiment' && (
          <div className="space-y-6">
            {/* Sentiment summary */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Positive', count: positiveMentions.length, pct: positivePct, color: 'text-green-600', bg: 'bg-green-50', bar: 'bg-green-500' },
                { label: 'Neutral', count: last30Mentions.filter(m => m.sentiment === 'neutral').length, pct: last30Mentions.length ? Math.round((last30Mentions.filter(m => m.sentiment === 'neutral').length / last30Mentions.length) * 100) : 0, color: 'text-slate-600', bg: 'bg-slate-50', bar: 'bg-slate-400' },
                { label: 'Negative', count: negativeMentions.length, pct: negativePct, color: 'text-red-600', bg: 'bg-red-50', bar: 'bg-red-500' },
              ].map(s => (
                <div key={s.label} className={cn('rounded-xl border border-slate-200 p-5', s.bg)}>
                  <p className={cn('text-3xl font-bold mb-1', s.color)}>{s.pct}%</p>
                  <p className="text-sm font-semibold text-slate-700 mb-3">{s.label}</p>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', s.bar)} style={{ width: `${s.pct}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">{s.count} mentions</p>
                </div>
              ))}
            </div>

            {/* Sentiment over time */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Sentiment Over Time (30d)</h3>
              {sentimentOverTime.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-slate-400">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={sentimentOverTime} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="positive" stroke="#22C55E" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="neutral" stroke="#94A3B8" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="negative" stroke="#EF4444" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Sentiment by platform */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Sentiment by Platform</h3>
              {sentimentByPlatform.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-slate-400">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={sentimentByPlatform} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="platform" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="positive" fill="#22C55E" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="neutral" fill="#94A3B8" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="negative" fill="#EF4444" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Most positive / negative keywords */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <TrendingUp size={14} className="text-green-500" /> Most Positive Keywords
                </h3>
                {keywords.length === 0 ? (
                  <p className="text-xs text-slate-400">No keywords yet</p>
                ) : (
                  <div className="space-y-2">
                    {keywords
                      .map(kw => ({ kw, stats: kwStats(kw.id) }))
                      .filter(x => x.stats.avgSentiment !== null)
                      .sort((a, b) => (b.stats.avgSentiment ?? 0) - (a.stats.avgSentiment ?? 0))
                      .slice(0, 5)
                      .map(({ kw, stats }) => (
                        <div key={kw.id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: kw.color }} />
                            {kw.keyword}
                          </span>
                          <span className="text-green-600 font-medium">{stats.avgSentiment?.toFixed(2)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <AlertCircle size={14} className="text-red-500" /> Most Negative Keywords
                </h3>
                {keywords.length === 0 ? (
                  <p className="text-xs text-slate-400">No keywords yet</p>
                ) : (
                  <div className="space-y-2">
                    {keywords
                      .map(kw => ({ kw, stats: kwStats(kw.id) }))
                      .filter(x => x.stats.avgSentiment !== null)
                      .sort((a, b) => (a.stats.avgSentiment ?? 0) - (b.stats.avgSentiment ?? 0))
                      .slice(0, 5)
                      .map(({ kw, stats }) => (
                        <div key={kw.id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: kw.color }} />
                            {kw.keyword}
                          </span>
                          <span className="text-red-600 font-medium">{stats.avgSentiment?.toFixed(2)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent negative mentions */}
            <div className="bg-white rounded-xl border border-red-100 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <AlertCircle size={14} className="text-red-500" /> Recent Negative Mentions
              </h3>
              {negativeMentions.length === 0 ? (
                <p className="text-sm text-slate-400">No negative mentions — great job!</p>
              ) : (
                <div className="space-y-3">
                  {negativeMentions.slice(0, 5).map(m => (
                    <div key={m.id} className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
                      {platformIcon(m.platform)}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700">{m.author_handle ? `@${m.author_handle}` : m.author_name ?? 'Unknown'} · {timeAgo(m.mentioned_at)}</p>
                        <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">{m.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB: Volume & Trends ─── */}
        {activeTab === 'volume' && (
          <div className="space-y-6">
            {/* Volume over time */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Mention Volume (Last 30 Days)</h3>
              {volumeOverTime.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-slate-400">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={volumeOverTime} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2} fill="url(#colorVolume)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top authors */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Top Mentioned Authors (30d)</h3>
              {topAuthors.length === 0 ? (
                <p className="text-sm text-slate-400">No mentions yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Author</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Platform</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">Mentions</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">Sentiment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topAuthors.map((a, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-medium text-slate-900">@{a.handle}</td>
                          <td className="py-2.5 px-3">{platformIcon(a.platform)}</td>
                          <td className="py-2.5 px-3 text-right font-semibold">{a.count}</td>
                          <td className="py-2.5 px-3 text-right">
                            <span className={cn('text-xs font-medium', a.sentimentSum > 0 ? 'text-green-600' : a.sentimentSum < 0 ? 'text-red-600' : 'text-slate-500')}>
                              {a.sentimentSum > 0 ? '↑ Positive' : a.sentimentSum < 0 ? '↓ Negative' : '— Neutral'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Trending hashtags */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Hash size={14} className="text-blue-500" /> Trending Hashtags (30d)
              </h3>
              {trendingHashtags.length === 0 ? (
                <p className="text-sm text-slate-400">No hashtags detected in mentions</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {trendingHashtags.map(([tag, count]) => (
                    <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                      {tag}
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold">{count}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Hourly heatmap */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Mention Heatmap by Day & Hour</h3>
              {(() => {
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
                last30Mentions.forEach(m => {
                  const d = new Date(m.mentioned_at)
                  grid[d.getDay()][d.getHours()]++
                })
                const maxVal = Math.max(...grid.flat(), 1)
                return (
                  <div className="overflow-x-auto">
                    <div className="flex gap-1 text-[10px] text-slate-400 mb-1 pl-10">
                      {Array.from({ length: 24 }, (_, h) => (
                        <div key={h} className="w-5 text-center shrink-0">{h % 6 === 0 ? `${h}h` : ''}</div>
                      ))}
                    </div>
                    {days.map((day, di) => (
                      <div key={day} className="flex items-center gap-1 mb-1">
                        <span className="text-[10px] text-slate-500 w-9 text-right shrink-0">{day}</span>
                        {grid[di].map((val, hi) => (
                          <div
                            key={hi}
                            className="w-5 h-5 rounded-sm shrink-0"
                            title={`${day} ${hi}:00 — ${val} mentions`}
                            style={{
                              backgroundColor: val === 0 ? '#F1F5F9' : `rgba(37,99,235,${0.15 + 0.85 * (val / maxVal)})`,
                            }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>

            {/* Reach vs Engagement */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Reach vs Engagement by Platform</h3>
              {sentimentByPlatform.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-sm text-slate-400">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={PLATFORMS.map(p => {
                      const pMentions = last30Mentions.filter(m => m.platform === p)
                      return {
                        platform: p,
                        reach: pMentions.reduce((s, m) => s + (m.reach_estimate ?? 0), 0),
                        engagement: pMentions.reduce((s, m) => s + m.engagement_count, 0),
                      }
                    }).filter(d => d.reach > 0 || d.engagement > 0)}
                    margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="platform" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="reach" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="engagement" fill="#8B5CF6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB: Alerts ─── */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Alert Log</h3>
              <button
                onClick={markAllAlertsRead}
                className="text-sm text-blue-600 hover:underline"
              >
                Mark all read
              </button>
            </div>

            {alerts.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <Bell size={36} className="mx-auto text-slate-300 mb-3" />
                <p className="text-base font-semibold text-slate-700 mb-1">No alerts yet</p>
                <p className="text-sm text-slate-500">Alerts will appear here when keyword thresholds are exceeded.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Type</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Title</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Message</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Triggered</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map(a => (
                      <tr key={a.id} className={cn('border-b border-slate-50 hover:bg-slate-50', !a.is_read && 'bg-blue-50/30')}>
                        <td className="py-3 px-4">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', ALERT_TYPES[a.alert_type]?.color ?? 'bg-slate-100 text-slate-600')}>
                            {ALERT_TYPES[a.alert_type]?.label ?? a.alert_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">{a.title}</td>
                        <td className="py-3 px-4 text-slate-500">{a.message ?? '—'}</td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{timeAgo(a.triggered_at)}</td>
                        <td className="py-3 px-4">
                          <button
                            onClick={async () => {
                              await supabase.from('listening_alerts').update({ is_read: true }).eq('id', a.id)
                              setAlerts(prev => prev.map(x => x.id === a.id ? { ...x, is_read: true } : x))
                            }}
                            className={cn('text-xs font-medium px-2 py-1 rounded', a.is_read ? 'text-slate-400 bg-slate-50' : 'text-blue-600 bg-blue-50 hover:bg-blue-100')}
                          >
                            {a.is_read ? 'Read' : 'Mark read'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Alert configuration */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Settings size={14} className="text-slate-500" /> Alert Configuration
              </h3>
              {keywords.length === 0 ? (
                <p className="text-sm text-slate-400">Add keywords to configure alerts.</p>
              ) : (
                <div className="space-y-3">
                  {keywords.map(kw => (
                    <div key={kw.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: kw.color }} />
                        <span className="text-sm font-medium text-slate-700">{kw.keyword}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-500">Threshold: {kw.alert_threshold}/24h</span>
                        <button
                          onClick={async () => {
                            const updated = !kw.alert_enabled
                            await supabase.from('listening_keywords').update({ alert_enabled: updated }).eq('id', kw.id)
                            setKeywords(prev => prev.map(k => k.id === kw.id ? { ...k, alert_enabled: updated } : k))
                          }}
                          className={cn('relative rounded-full transition-colors shrink-0')}
                          style={{ width: 36, height: 20, backgroundColor: kw.alert_enabled ? '#2563EB' : '#E2E8F0' }}
                        >
                          <span
                            className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                            style={{ transform: kw.alert_enabled ? 'translateX(17px)' : 'translateX(2px)' }}
                          />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Global Alert Rules</p>
                {[
                  { label: 'Negative sentiment spike', desc: 'Alert if >20% mentions in 24h are negative' },
                  { label: 'Viral mention detected', desc: 'Alert if a single mention gets >1,000 engagements' },
                  { label: 'Email notifications', desc: 'Send alerts to workspace owner email' },
                ].map(rule => (
                  <div key={rule.label} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{rule.label}</p>
                      <p className="text-xs text-slate-500">{rule.desc}</p>
                    </div>
                    <button
                      className="relative rounded-full shrink-0"
                      style={{ width: 36, height: 20, backgroundColor: '#E2E8F0' }}
                    >
                      <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow" style={{ transform: 'translateX(2px)' }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: Competitors ─── */}
        {activeTab === 'competitors' && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
              <AlertCircle size={16} className="text-blue-600 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-700">
                Add competitor brand names as keywords (e.g. "CompetitorBrand") to start tracking their mention volume, sentiment, and share of voice.
              </p>
            </div>

            {/* Competitor keyword list */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900">Tracked Competitors</h3>
                <button onClick={() => setShowAddKeyword(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                  <Plus size={12} /> Add Competitor Keyword
                </button>
              </div>
              {keywords.length === 0 ? (
                <p className="text-sm text-slate-400">No keywords tracked yet. Add competitor names to compare.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Keyword</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">Mentions (30d)</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">% Positive</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">% Negative</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">Top Platform</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keywords.map(kw => {
                        const kwMentions = last30Mentions.filter(m => m.keyword_id === kw.id)
                        const pos = kwMentions.filter(m => m.sentiment === 'positive').length
                        const neg = kwMentions.filter(m => m.sentiment === 'negative').length
                        const total = kwMentions.length
                        const platformCounts = kwMentions.reduce((acc, m) => {
                          acc[m.platform] = (acc[m.platform] ?? 0) + 1; return acc
                        }, {} as Record<string, number>)
                        const topPlatform = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
                        return (
                          <tr key={kw.id} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="py-2.5 px-3">
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: kw.color }} />
                                <span className="font-medium text-slate-900">{kw.keyword}</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold">{total}</td>
                            <td className="py-2.5 px-3 text-right text-green-600">{total ? Math.round((pos / total) * 100) : 0}%</td>
                            <td className="py-2.5 px-3 text-right text-red-600">{total ? Math.round((neg / total) * 100) : 0}%</td>
                            <td className="py-2.5 px-3 text-right">{topPlatform}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Share of Voice */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Share of Voice</h3>
              {shareOfVoice.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center gap-2">
                  <Activity size={32} className="text-slate-300" />
                  <p className="text-sm text-slate-400">No mention data to display share of voice</p>
                </div>
              ) : (
                <div className="flex items-center gap-8">
                  <ResponsiveContainer width={200} height={200}>
                    <PieChart>
                      <Pie data={shareOfVoice} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {shareOfVoice.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {shareOfVoice.map((item, i) => {
                      const total = shareOfVoice.reduce((s, x) => s + x.value, 0)
                      return (
                        <div key={item.name} className="flex items-center gap-2 text-sm">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-slate-700">{item.name}</span>
                          <span className="font-semibold text-slate-900 ml-auto pl-4">{Math.round((item.value / total) * 100)}%</span>
                          <span className="text-slate-400 text-xs">({item.value})</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Modals ─── */}
      {showAddKeyword && workspaceId && (
        <AddKeywordModal
          workspaceId={workspaceId}
          onClose={() => setShowAddKeyword(false)}
          onSave={kw => setKeywords(prev => [kw, ...prev])}
        />
      )}

      {deleteKeyword && (
        <ConfirmModal
          title="Delete keyword?"
          message={`Are you sure you want to delete "${deleteKeyword.keyword}"? All associated mentions will be unlinked.`}
          onConfirm={confirmDeleteKeyword}
          onCancel={() => setDeleteKeyword(null)}
        />
      )}

      {showAlertsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">Alert Configuration</h2>
              <button onClick={() => setShowAlertsModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Configure alert settings on the Alerts tab for per-keyword thresholds and global rules.</p>
            <button
              onClick={() => { setShowAlertsModal(false); setActiveTab('alerts') }}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Alerts Tab
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
