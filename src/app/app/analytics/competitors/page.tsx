'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus, Users, Eye, BarChart2,
  Target, RefreshCw, Plus, ExternalLink, Briefcase,
  Camera, Hash, Globe, Settings, Trash2, ArrowUp, ArrowDown,
  Zap, CheckCircle, X, Info, Download,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Tabs } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn, formatDate } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────

interface CompetitorProfile {
  id: string
  workspace_id: string
  brand_id: string | null
  competitor_name: string
  website_url: string | null
  platforms: Record<string, string>
  notes: string | null
  is_active: boolean
  created_at: string
}

interface CompetitorSnapshot {
  id: string
  competitor_id: string
  platform: string
  follower_count: number | null
  following_count: number | null
  post_count: number | null
  avg_likes: number | null
  avg_comments: number | null
  avg_shares: number | null
  engagement_rate: number | null
  posting_frequency_per_week: number | null
  top_content_type: string | null
  estimated_reach: number | null
  snapshotted_at: string
}

interface Workspace {
  id: string
  name: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatNumber(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatPct(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${Number(n).toFixed(2)}%`
}

const PLATFORMS = ['Instagram', 'TikTok', 'LinkedIn', 'X', 'YouTube']
const PLATFORM_COLORS = ['#E1306C', '#010101', '#0A66C2', '#1DA1F2', '#FF0000']
const CHART_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2']
const CONTENT_TYPES = ['video', 'image', 'carousel', 'reel', 'story', 'text']

function PlatformIcon({ name, size = 14 }: { name: string; size?: number }) {
  const cls = `w-[${size}px] h-[${size}px]`
  if (name === 'Instagram') return <Camera size={size} className="text-pink-500" />
  if (name === 'TikTok') return <Hash size={size} className="text-slate-900" />
  if (name === 'LinkedIn') return <Briefcase size={size} className="text-blue-700" />
  if (name === 'X') return <X size={size} className="text-slate-700" />
  if (name === 'YouTube') return <Eye size={size} className="text-red-500" />
  return <Globe size={size} className="text-slate-400" />
}

function TrendIcon({ current, previous }: { current: number | null; previous: number | null }) {
  if (current == null || previous == null) return <Minus size={14} className="text-slate-400" />
  const delta = current - previous
  if (delta > 0) return <ArrowUp size={14} className="text-emerald-500" />
  if (delta < 0) return <ArrowDown size={14} className="text-red-500" />
  return <Minus size={14} className="text-slate-400" />
}

// ─── KPI Card ───────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
}

function KpiCard({ label, value, sub, icon, trend }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-start gap-3 shadow-sm">
      <div className="p-2 rounded-lg bg-blue-50 text-blue-600 flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium truncate">{label}</p>
        <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
        {sub && (
          <p className={cn('text-xs mt-0.5 flex items-center gap-1',
            trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-slate-500',
          )}>
            {trend === 'up' && <ArrowUp size={10} />}
            {trend === 'down' && <ArrowDown size={10} />}
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Tooltip helper ─────────────────────────────────────────────────────────

function Tooltip2({ content, children }: { content: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 w-56 text-xs bg-slate-800 text-white rounded-lg px-3 py-2 shadow-lg text-center pointer-events-none">
          {content}
        </span>
      )}
    </span>
  )
}

// ─── Toast ──────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm font-medium animate-in slide-in-from-bottom-4">
      <CheckCircle size={16} className="text-emerald-400" />
      {message}
      <button onClick={onClose} className="ml-2 text-slate-400 hover:text-white"><X size={14} /></button>
    </div>
  )
}

// ─── Add Competitor Modal ────────────────────────────────────────────────────

interface AddCompetitorModalProps {
  open: boolean
  onClose: () => void
  workspaceId: string
  onSaved: () => void
}

function AddCompetitorModal({ open, onClose, workspaceId, onSaved }: AddCompetitorModalProps) {
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [platformHandles, setPlatformHandles] = useState<Record<string, string>>({})

  // Step 2 snapshots
  const [snapshots, setSnapshots] = useState<Record<string, Partial<CompetitorSnapshot>>>({})

  function reset() {
    setStep(1); setName(''); setWebsite(''); setNotes('')
    setSelectedPlatforms([]); setPlatformHandles({}); setSnapshots({}); setError('')
  }

  function handleClose() { reset(); onClose() }

  function togglePlatform(p: string) {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  function updateSnapshot(platform: string, field: string, value: string) {
    setSnapshots(prev => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value === '' ? null : isNaN(Number(value)) ? value : Number(value) }
    }))
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('Competitor name is required'); return }
    setLoading(true); setError('')
    try {
      const platforms: Record<string, string> = {}
      selectedPlatforms.forEach(p => { platforms[p] = platformHandles[p] ?? '' })

      const { data: comp, error: e1 } = await supabase
        .from('competitor_profiles')
        .insert({ workspace_id: workspaceId, competitor_name: name.trim(), website_url: website || null, notes: notes || null, platforms, is_active: true })
        .select('id')
        .single()
      if (e1) throw e1

      if (selectedPlatforms.length > 0) {
        const snapshotRows = selectedPlatforms.map(p => ({
          competitor_id: comp.id,
          workspace_id: workspaceId,
          platform: p,
          follower_count: snapshots[p]?.follower_count ?? null,
          avg_likes: snapshots[p]?.avg_likes ?? null,
          avg_comments: snapshots[p]?.avg_comments ?? null,
          avg_shares: snapshots[p]?.avg_shares ?? null,
          engagement_rate: snapshots[p]?.engagement_rate ?? null,
          posting_frequency_per_week: snapshots[p]?.posting_frequency_per_week ?? null,
          top_content_type: snapshots[p]?.top_content_type ?? null,
          estimated_reach: snapshots[p]?.estimated_reach ?? null,
        }))
        const { error: e2 } = await supabase.from('competitor_snapshots').insert(snapshotRows)
        if (e2) throw e2
      }
      onSaved(); handleClose()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save competitor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={step === 1 ? 'Add Competitor — Step 1 of 2' : 'Add Competitor — Step 2 of 2'}
      description={step === 1 ? 'Enter competitor details and select platforms to track.' : 'Enter baseline stats for each platform. We\'ll track changes from this point.'}
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex gap-1">
            {[1, 2].map(s => (
              <div key={s} className={cn('w-2 h-2 rounded-full', s === step ? 'bg-blue-600' : 'bg-slate-200')} />
            ))}
          </div>
          <div className="flex gap-2">
            {step === 2 && <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>}
            {step === 1 && <Button variant="secondary" onClick={handleClose}>Cancel</Button>}
            {step === 1 && (
              <Button
                onClick={() => { if (!name.trim()) { setError('Name required'); return } setError(''); setStep(2) }}
              >Next</Button>
            )}
            {step === 2 && (
              <Button loading={loading} onClick={handleSubmit}>Save Competitor</Button>
            )}
          </div>
        </div>
      }
    >
      {error && <p className="text-xs text-red-600 mb-3 p-2 bg-red-50 rounded-lg">{error}</p>}

      {step === 1 && (
        <div className="space-y-4">
          <Input label="Competitor Name *" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Acme Corp" />
          <Input label="Website URL" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://acme.com" />
          <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observations about their strategy..." rows={3} />
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">Platforms to Track</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {PLATFORMS.map(p => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all',
                    selectedPlatforms.includes(p)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300',
                  )}
                >
                  <PlatformIcon name={p} size={12} />
                  {p}
                </button>
              ))}
            </div>
            {selectedPlatforms.map(p => (
              <div key={p} className="mb-2">
                <Input
                  label={`${p} handle or profile URL`}
                  value={platformHandles[p] ?? ''}
                  onChange={e => setPlatformHandles(prev => ({ ...prev, [p]: e.target.value }))}
                  placeholder={`@handle or profile URL`}
                  icon={<PlatformIcon name={p} />}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          {selectedPlatforms.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">No platforms selected. You can add snapshots later.</p>
          )}
          {selectedPlatforms.map(p => (
            <div key={p} className="border border-slate-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <PlatformIcon name={p} size={16} />
                <h4 className="text-sm font-semibold text-slate-800">{p}</h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Followers" type="number" placeholder="e.g. 45000"
                  value={snapshots[p]?.follower_count ?? ''}
                  onChange={e => updateSnapshot(p, 'follower_count', e.target.value)} />
                <Input label="Engagement Rate (%)" type="number" step="0.01" placeholder="e.g. 3.25"
                  value={snapshots[p]?.engagement_rate ?? ''}
                  onChange={e => updateSnapshot(p, 'engagement_rate', e.target.value)} />
                <Input label="Avg Likes" type="number" placeholder="e.g. 1200"
                  value={snapshots[p]?.avg_likes ?? ''}
                  onChange={e => updateSnapshot(p, 'avg_likes', e.target.value)} />
                <Input label="Avg Comments" type="number" placeholder="e.g. 80"
                  value={snapshots[p]?.avg_comments ?? ''}
                  onChange={e => updateSnapshot(p, 'avg_comments', e.target.value)} />
                <Input label="Posts per Week" type="number" step="0.1" placeholder="e.g. 4.5"
                  value={snapshots[p]?.posting_frequency_per_week ?? ''}
                  onChange={e => updateSnapshot(p, 'posting_frequency_per_week', e.target.value)} />
                <Input label="Est. Reach" type="number" placeholder="e.g. 90000"
                  value={snapshots[p]?.estimated_reach ?? ''}
                  onChange={e => updateSnapshot(p, 'estimated_reach', e.target.value)} />
                <div className="col-span-2">
                  <Select
                    label="Top Content Type"
                    value={(snapshots[p]?.top_content_type as string) ?? ''}
                    onChange={e => updateSnapshot(p, 'top_content_type', e.target.value)}
                    options={[
                      { value: '', label: 'Select content type...' },
                      ...CONTENT_TYPES.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))
                    ]}
                  />
                </div>
              </div>
            </div>
          ))}
          <p className="text-xs text-slate-400 italic text-center">We'll track changes from this baseline each time you refresh data.</p>
        </div>
      )}
    </Modal>
  )
}

// ─── Refresh Data Modal ──────────────────────────────────────────────────────

interface RefreshModalProps {
  open: boolean
  onClose: () => void
  workspaceId: string
  competitors: CompetitorProfile[]
  latestSnapshots: Record<string, CompetitorSnapshot>
  onSaved: () => void
}

function RefreshDataModal({ open, onClose, workspaceId, competitors, latestSnapshots, onSaved }: RefreshModalProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [updates, setUpdates] = useState<Record<string, Record<string, Partial<CompetitorSnapshot>>>>({})

  function updateField(compId: string, platform: string, field: string, value: string) {
    setUpdates(prev => ({
      ...prev,
      [compId]: {
        ...prev[compId],
        [platform]: {
          ...(prev[compId]?.[platform] ?? {}),
          [field]: value === '' ? null : isNaN(Number(value)) ? value : Number(value),
        }
      }
    }))
  }

  function getInitialVal(compId: string, platform: string, field: keyof CompetitorSnapshot): string {
    const key = `${compId}_${platform}`
    const snap = latestSnapshots[key]
    return updates[compId]?.[platform]?.[field] !== undefined
      ? String(updates[compId][platform][field] ?? '')
      : String(snap?.[field] ?? '')
  }

  async function handleSubmit() {
    setLoading(true); setError('')
    try {
      const rows: any[] = []
      competitors.forEach(comp => {
        const platforms = Object.keys(comp.platforms)
        platforms.forEach(platform => {
          const u = updates[comp.id]?.[platform] ?? {}
          const key = `${comp.id}_${platform}`
          const prev = latestSnapshots[key]
          rows.push({
            competitor_id: comp.id,
            workspace_id: workspaceId,
            platform,
            follower_count: u.follower_count !== undefined ? u.follower_count : prev?.follower_count ?? null,
            avg_likes: u.avg_likes !== undefined ? u.avg_likes : prev?.avg_likes ?? null,
            avg_comments: u.avg_comments !== undefined ? u.avg_comments : prev?.avg_comments ?? null,
            avg_shares: u.avg_shares !== undefined ? u.avg_shares : prev?.avg_shares ?? null,
            engagement_rate: u.engagement_rate !== undefined ? u.engagement_rate : prev?.engagement_rate ?? null,
            posting_frequency_per_week: u.posting_frequency_per_week !== undefined ? u.posting_frequency_per_week : prev?.posting_frequency_per_week ?? null,
            top_content_type: u.top_content_type !== undefined ? u.top_content_type : prev?.top_content_type ?? null,
            estimated_reach: u.estimated_reach !== undefined ? u.estimated_reach : prev?.estimated_reach ?? null,
          })
        })
      })
      if (rows.length > 0) {
        const { error: e } = await supabase.from('competitor_snapshots').insert(rows)
        if (e) throw e
      }
      onSaved(); onClose()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save data')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Update Competitor Data"
      description="Enter the latest stats for each competitor and platform to build your historical record."
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={loading} onClick={handleSubmit} icon={<RefreshCw size={14} />}>Save New Snapshot</Button>
        </>
      }
    >
      {error && <p className="text-xs text-red-600 mb-3 p-2 bg-red-50 rounded-lg">{error}</p>}
      <div className="space-y-6">
        {competitors.filter(c => c.is_active).map(comp => (
          <div key={comp.id} className="border border-slate-100 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-slate-900 mb-4">{comp.competitor_name}</h4>
            {Object.keys(comp.platforms).map(platform => (
              <div key={platform} className="mb-4 last:mb-0">
                <div className="flex items-center gap-2 mb-3">
                  <PlatformIcon name={platform} />
                  <span className="text-xs font-medium text-slate-600">{platform}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { field: 'follower_count', label: 'Followers', type: 'number' },
                    { field: 'engagement_rate', label: 'Engagement %', type: 'number' },
                    { field: 'avg_likes', label: 'Avg Likes', type: 'number' },
                    { field: 'avg_comments', label: 'Avg Comments', type: 'number' },
                    { field: 'posting_frequency_per_week', label: 'Posts/Week', type: 'number' },
                    { field: 'estimated_reach', label: 'Est. Reach', type: 'number' },
                  ].map(({ field, label, type }) => (
                    <Input
                      key={field}
                      label={label}
                      type={type}
                      value={getInitialVal(comp.id, platform, field as keyof CompetitorSnapshot)}
                      onChange={e => updateField(comp.id, platform, field, e.target.value)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
        {competitors.filter(c => c.is_active).length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">No active competitors to update.</p>
        )}
      </div>
    </Modal>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CompetitorsPage() {
  const supabase = createClient()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [competitors, setCompetitors] = useState<CompetitorProfile[]>([])
  const [snapshots, setSnapshots] = useState<CompetitorSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [toast, setToast] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRefreshModal, setShowRefreshModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CompetitorProfile | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // ─── Load data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id, workspaces(id, name)')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      if (!member) return

      const ws = (member.workspaces as any)
      setWorkspace({ id: ws.id, name: ws.name })

      const [{ data: comps }, { data: snaps }] = await Promise.all([
        supabase.from('competitor_profiles').select('*').eq('workspace_id', ws.id).order('created_at'),
        supabase.from('competitor_snapshots').select('*').eq('workspace_id', ws.id).order('snapshotted_at'),
      ])

      setCompetitors(comps ?? [])
      setSnapshots(snaps ?? [])
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // ─── Simulate refresh ──────────────────────────────────────────────────────

  async function simulateRefresh() {
    setRefreshing(true)
    await new Promise(r => setTimeout(r, 2000))
    await loadData()
    setRefreshing(false)
    setToast('Competitor data refreshed')
  }

  // ─── Delete competitor ─────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    await supabase.from('competitor_profiles').delete().eq('id', deleteTarget.id)
    setDeleteLoading(false)
    setDeleteTarget(null)
    setToast('Competitor removed')
    loadData()
  }

  // ─── Derived data ──────────────────────────────────────────────────────────

  const latestSnapshots = useMemo(() => {
    const map: Record<string, CompetitorSnapshot> = {}
    snapshots.forEach(s => {
      const key = `${s.competitor_id}_${s.platform}`
      const existing = map[key]
      if (!existing || new Date(s.snapshotted_at) > new Date(existing.snapshotted_at)) {
        map[key] = s
      }
    })
    return map
  }, [snapshots])

  const previousSnapshots = useMemo(() => {
    const map: Record<string, CompetitorSnapshot> = {}
    const sorted = [...snapshots].sort((a, b) => new Date(a.snapshotted_at).getTime() - new Date(b.snapshotted_at).getTime())
    const seen: Record<string, number> = {}
    sorted.forEach(s => {
      const key = `${s.competitor_id}_${s.platform}`
      seen[key] = (seen[key] ?? 0) + 1
      if (seen[key] >= 2) map[key] = s
    })
    return map
  }, [snapshots])

  // Aggregate latest snapshot per competitor (best platform)
  function getLatestForCompetitor(comp: CompetitorProfile): CompetitorSnapshot | null {
    const platforms = Object.keys(comp.platforms)
    for (const p of platforms) {
      const s = latestSnapshots[`${comp.id}_${p}`]
      if (s) return s
    }
    return null
  }

  const activeCompetitors = competitors.filter(c => c.is_active)

  const avgEngagement = useMemo(() => {
    const rates = activeCompetitors.flatMap(c =>
      Object.keys(c.platforms).map(p => latestSnapshots[`${c.id}_${p}`]?.engagement_rate).filter((x): x is number => x != null)
    )
    if (rates.length === 0) return null
    return rates.reduce((a, b) => a + b, 0) / rates.length
  }, [activeCompetitors, latestSnapshots])

  const fastestGrowing = useMemo<CompetitorProfile | null>(() => {
    let best: CompetitorProfile | null = null
    let bestDelta = -Infinity
    activeCompetitors.forEach(c => {
      Object.keys(c.platforms).forEach(p => {
        const curr = latestSnapshots[`${c.id}_${p}`]?.follower_count ?? null
        const prev = previousSnapshots[`${c.id}_${p}`]?.follower_count ?? null
        if (curr != null && prev != null) {
          const delta = curr - prev
          if (delta > bestDelta) { bestDelta = delta; best = c }
        }
      })
    })
    return best
  }, [activeCompetitors, latestSnapshots, previousSnapshots])

  const topPostingFreq = useMemo(() => {
    let max = 0
    activeCompetitors.forEach(c => {
      Object.keys(c.platforms).forEach(p => {
        const f = latestSnapshots[`${c.id}_${p}`]?.posting_frequency_per_week ?? 0
        if (f > max) max = f
      })
    })
    return max
  }, [activeCompetitors, latestSnapshots])

  // Follower growth chart data
  const followerChartData = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - (timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90))

    const filtered = snapshots.filter(s => new Date(s.snapshotted_at) >= cutoff)
    const dateMap: Record<string, Record<string, number>> = {}

    filtered.forEach(s => {
      const comp = competitors.find(c => c.id === s.competitor_id)
      if (!comp) return
      const date = s.snapshotted_at.slice(0, 10)
      if (!dateMap[date]) dateMap[date] = {}
      dateMap[date][comp.competitor_name] = s.follower_count ?? 0
    })

    return Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }))
  }, [snapshots, competitors, timeRange])

  // Benchmarking data
  const benchmarkRows = useMemo(() => {
    const filtered = platformFilter === 'all'
      ? activeCompetitors
      : activeCompetitors.filter(c => Object.keys(c.platforms).includes(platformFilter))

    return filtered.map(c => {
      const platform = platformFilter === 'all' ? Object.keys(c.platforms)[0] : platformFilter
      const snap = platform ? latestSnapshots[`${c.id}_${platform}`] : null
      return { comp: c, snap, platform }
    }).sort((a, b) => (b.snap?.follower_count ?? 0) - (a.snap?.follower_count ?? 0))
  }, [activeCompetitors, platformFilter, latestSnapshots])

  // Content type pie data
  const contentPieData = useMemo(() => {
    const counts: Record<string, number> = {}
    activeCompetitors.forEach(c => {
      Object.keys(c.platforms).forEach(p => {
        const ct = latestSnapshots[`${c.id}_${p}`]?.top_content_type
        if (ct) counts[ct] = (counts[ct] ?? 0) + 1
      })
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [activeCompetitors, latestSnapshots])

  // Share of voice
  const sovData = useMemo(() => {
    return activeCompetitors.map(c => {
      const reach = Object.keys(c.platforms).reduce((sum, p) => {
        return sum + (latestSnapshots[`${c.id}_${p}`]?.estimated_reach ?? 0)
      }, 0)
      return { name: c.competitor_name, reach }
    }).filter(x => x.reach > 0)
  }, [activeCompetitors, latestSnapshots])

  const totalReach = sovData.reduce((s, x) => s + x.reach, 0)

  // ─── Tabs config ───────────────────────────────────────────────────────────

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'benchmark', label: 'Benchmarking' },
    { id: 'growth', label: 'Follower Growth' },
    { id: 'engagement', label: 'Engagement' },
    { id: 'content', label: 'Content Strategy' },
    { id: 'sov', label: 'Share of Voice' },
  ]

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-8 w-full" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Competitor Analysis</h1>
          <p className="text-sm text-slate-500 mt-1">Benchmark your brand against competitors. Track follower growth, engagement rates, and content strategy.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="secondary"
            icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />}
            onClick={simulateRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh Data'}
          </Button>
          <Button
            icon={<Plus size={14} />}
            onClick={() => setShowAddModal(true)}
          >
            Add Competitor
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          label="Competitors Tracked"
          value={String(activeCompetitors.length)}
          icon={<Users size={16} />}
          sub={activeCompetitors.length === 0 ? 'None yet' : `${activeCompetitors.length} active`}
        />
        <KpiCard
          label="Avg Industry Engagement"
          value={avgEngagement != null ? formatPct(avgEngagement) : '—'}
          icon={<TrendingUp size={16} />}
          sub="Across all platforms"
        />
        <KpiCard
          label="Your Brand vs Industry"
          value={avgEngagement != null ? formatPct(avgEngagement) : '—'}
          icon={<Target size={16} />}
          sub="Industry benchmark"
          trend="neutral"
        />
        <KpiCard
          label="Fastest Growing"
          value={fastestGrowing ? fastestGrowing.competitor_name : '—'}
          icon={<Zap size={16} />}
          sub="By follower delta"
          trend="up"
        />
        <KpiCard
          label="Top Posting Freq."
          value={topPostingFreq > 0 ? `${topPostingFreq}/wk` : '—'}
          icon={<BarChart2 size={16} />}
          sub="Most posts per week"
        />
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* ── Tab: Overview ── */}
      {activeTab === 'overview' && (
        <div>
          {activeCompetitors.length === 0 ? (
            <EmptyState
              title="No competitors added yet"
              description="Add your first competitor to start benchmarking your brand against the industry."
              action={{ label: 'Add Competitor', onClick: () => setShowAddModal(true), icon: <Plus size={14} /> }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeCompetitors.map(comp => {
                const latestSnap = getLatestForCompetitor(comp)
                const firstPlatform = Object.keys(comp.platforms)[0]
                const prevSnap = firstPlatform ? previousSnapshots[`${comp.id}_${firstPlatform}`] : null
                return (
                  <div key={comp.id} className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-slate-900 text-sm">{comp.competitor_name}</h3>
                        {comp.website_url && (
                          <a href={comp.website_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                            <ExternalLink size={10} />
                            {comp.website_url.replace(/^https?:\/\//, '').slice(0, 30)}
                          </a>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          onClick={() => setDeleteTarget(comp)}
                          title="Remove"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Platform badges */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {Object.keys(comp.platforms).map(p => (
                        <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-full text-xs text-slate-600">
                          <PlatformIcon name={p} size={10} />
                          {p}
                        </span>
                      ))}
                    </div>

                    {/* Stats */}
                    {latestSnap ? (
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-50 rounded-lg p-2">
                          <div className="flex items-center justify-center gap-0.5 mb-0.5">
                            <TrendIcon current={latestSnap.follower_count} previous={prevSnap?.follower_count ?? null} />
                          </div>
                          <p className="text-base font-bold text-slate-900">{formatNumber(latestSnap.follower_count)}</p>
                          <p className="text-xs text-slate-500">Followers</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2">
                          <div className="flex items-center justify-center gap-0.5 mb-0.5">
                            <TrendIcon current={latestSnap.engagement_rate} previous={prevSnap?.engagement_rate ?? null} />
                          </div>
                          <p className="text-base font-bold text-slate-900">{formatPct(latestSnap.engagement_rate)}</p>
                          <p className="text-xs text-slate-500">Engagement</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2">
                          <div className="flex items-center justify-center mb-0.5 h-4" />
                          <p className="text-base font-bold text-slate-900">
                            {latestSnap.posting_frequency_per_week != null ? `${latestSnap.posting_frequency_per_week}/wk` : '—'}
                          </p>
                          <p className="text-xs text-slate-500">Posts/Wk</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-3 italic">No snapshot data yet. Click Refresh Data to add stats.</p>
                    )}

                    {comp.notes && (
                      <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-50 line-clamp-2">{comp.notes}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Benchmarking ── */}
      {activeTab === 'benchmark' && (
        <div className="space-y-4">
          {/* Platform filter chips */}
          <div className="flex gap-2 flex-wrap">
            {['all', ...PLATFORMS].map(p => (
              <button
                key={p}
                onClick={() => setPlatformFilter(p)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium border transition-all',
                  platformFilter === p
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300',
                )}
              >
                {p === 'all' ? 'All Platforms' : p}
              </button>
            ))}
          </div>

          {benchmarkRows.length === 0 ? (
            <EmptyState title="No data" description="Add competitors or select a different platform filter." />
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Brand</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Followers</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Eng. Rate</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Avg Likes</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Avg Comments</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Posts/Wk</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Top Content</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Est. Reach</th>
                    </tr>
                  </thead>
                  <tbody>
                    {benchmarkRows.map(({ comp, snap }, idx) => (
                      <tr key={comp.id} className={cn('border-b border-slate-50 hover:bg-slate-50/50 transition-colors',
                        idx === 0 && 'bg-blue-50/30')}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{comp.competitor_name}</span>
                            {idx === 0 && (
                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">Top</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">{formatNumber(snap?.follower_count)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-mono text-slate-700">{formatPct(snap?.engagement_rate)}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">{formatNumber(snap?.avg_likes)}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">{snap?.avg_comments ?? '—'}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">
                          {snap?.posting_frequency_per_week != null ? `${snap.posting_frequency_per_week}/wk` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {snap?.top_content_type ? (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs capitalize">{snap.top_content_type}</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">{formatNumber(snap?.estimated_reach)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Follower Growth ── */}
      {activeTab === 'growth' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Follower Growth Over Time</h3>
            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
              {(['7d', '30d', '90d'] as const).map(r => (
                <button key={r} onClick={() => setTimeRange(r)}
                  className={cn('px-3 py-1 text-xs font-medium rounded-md transition-all',
                    timeRange === r ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {followerChartData.length < 2 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-8 text-center space-y-3">
              <BarChart2 size={32} className="text-slate-300 mx-auto" />
              <p className="text-sm font-medium text-slate-600">Not enough data for trend chart</p>
              <p className="text-xs text-slate-400">Use "Refresh Data" multiple times to build a historical record. Add more competitors to see meaningful trends.</p>
              {snapshots.length > 0 && (
                <div className="mt-4">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={activeCompetitors.map(c => ({
                      name: c.competitor_name,
                      followers: getLatestForCompetitor(c)?.follower_count ?? 0,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatNumber(v)} />
                      <Tooltip formatter={(v: any) => formatNumber(v)} />
                      <Bar dataKey="followers" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={followerChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatNumber(v)} />
                  <Tooltip formatter={(v: any) => formatNumber(v)} />
                  <Legend />
                  {activeCompetitors.map((comp, i) => (
                    <Line
                      key={comp.id}
                      type="monotone"
                      dataKey={comp.competitor_name}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Engagement Comparison ── */}
      {activeTab === 'engagement' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-semibold text-slate-700">Engagement Rate by Competitor</h3>
              <Tooltip2 content="Engagement Rate = (Likes + Comments + Shares) / Followers × 100">
                <Info size={14} className="text-slate-400 cursor-help" />
              </Tooltip2>
            </div>
            {activeCompetitors.length === 0 ? (
              <EmptyState title="No data" description="Add competitors to see engagement comparison." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={activeCompetitors.map(c => ({
                  name: c.competitor_name,
                  engagement: getLatestForCompetitor(c)?.engagement_rate ?? 0,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)}%`} />
                  {avgEngagement != null && (
                    <ReferenceLine y={avgEngagement} stroke="#f59e0b" strokeDasharray="4 4"
                      label={{ value: 'Avg', position: 'insideRight', fontSize: 10, fill: '#f59e0b' }} />
                  )}
                  <Bar dataKey="engagement" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Avg Likes / Comments / Shares</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={activeCompetitors.map(c => {
                const s = getLatestForCompetitor(c)
                return {
                  name: c.competitor_name,
                  Likes: s?.avg_likes ?? 0,
                  Comments: s?.avg_comments ?? 0,
                  Shares: s?.avg_shares ?? 0,
                }
              })}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatNumber(v)} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Likes" fill="#2563eb" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Comments" fill="#7c3aed" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Shares" fill="#059669" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Tab: Content Strategy ── */}
      {activeTab === 'content' && (
        <div className="space-y-6">
          {/* Strategy table */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50">
              <h3 className="text-sm font-semibold text-slate-700">Competitor Content Strategy</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Competitor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Posts/Wk</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Top Content</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Platforms</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Est. Reach</th>
                </tr>
              </thead>
              <tbody>
                {activeCompetitors.map(comp => {
                  const snap = getLatestForCompetitor(comp)
                  return (
                    <tr key={comp.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-900">{comp.competitor_name}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {snap?.posting_frequency_per_week != null ? `${snap.posting_frequency_per_week}/wk` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {snap?.top_content_type ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs capitalize">{snap.top_content_type}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {Object.keys(comp.platforms).map(p => (
                            <span key={p} title={p}><PlatformIcon name={p} size={13} /></span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">{formatNumber(snap?.estimated_reach)}</td>
                    </tr>
                  )
                })}
                {activeCompetitors.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-sm text-slate-400">No competitors added yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Content type distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Content Type Distribution</h3>
              {contentPieData.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No content type data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={contentPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                      {contentPieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Auto-insights */}
            <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Strategy Insights</h3>
              <ul className="space-y-3">
                {(() => {
                  const insights: string[] = []
                  // Most common content type
                  if (contentPieData.length > 0) {
                    const top = contentPieData.sort((a, b) => b.value - a.value)[0]
                    insights.push(`${top.value} out of ${activeCompetitors.length} competitor${activeCompetitors.length !== 1 ? 's' : ''} primarily post ${top.name} content.`)
                  }
                  // Average posting frequency
                  const freqs = activeCompetitors.map(c => getLatestForCompetitor(c)?.posting_frequency_per_week ?? null).filter((x): x is number => x != null)
                  if (freqs.length > 0) {
                    const avg = freqs.reduce((a, b) => a + b, 0) / freqs.length
                    insights.push(`Competitors average ${avg.toFixed(1)} posts per week across all platforms.`)
                  }
                  // Highest engagement
                  const engMap = activeCompetitors.map(c => ({ name: c.competitor_name, er: getLatestForCompetitor(c)?.engagement_rate ?? null }))
                    .filter(x => x.er != null).sort((a, b) => (b.er ?? 0) - (a.er ?? 0))
                  if (engMap.length > 0) {
                    insights.push(`${engMap[0].name} leads with ${formatPct(engMap[0].er)} engagement rate.`)
                  }
                  if (insights.length === 0) {
                    insights.push('Add competitor snapshot data to generate strategy insights.')
                  }
                  return insights.map((ins, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                      {ins}
                    </li>
                  ))
                })()}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Share of Voice ── */}
      {activeTab === 'sov' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-semibold text-slate-700">Share of Voice</h3>
                <Tooltip2 content="Share of Voice = Your estimated reach / Total industry reach × 100. Based on estimated reach data from competitor snapshots.">
                  <Info size={14} className="text-slate-400 cursor-help" />
                </Tooltip2>
              </div>
              {sovData.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No estimated reach data. Add competitor snapshots with reach values.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={sovData} dataKey="reach" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                      label={({ name, percent }) => `${(name ?? '').toString().slice(0, 10)} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                      {sovData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatNumber(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Reach Breakdown</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 text-xs font-semibold text-slate-500">Brand</th>
                    <th className="text-right py-2 text-xs font-semibold text-slate-500">Est. Reach</th>
                    <th className="text-right py-2 text-xs font-semibold text-slate-500">Share %</th>
                  </tr>
                </thead>
                <tbody>
                  {sovData.map((row, i) => (
                    <tr key={row.name} className="border-b border-slate-50">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="font-medium text-slate-700">{row.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-mono text-slate-600">{formatNumber(row.reach)}</td>
                      <td className="py-2.5 text-right font-semibold text-slate-800">
                        {totalReach > 0 ? `${((row.reach / totalReach) * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                  {sovData.length === 0 && (
                    <tr><td colSpan={3} className="py-6 text-center text-xs text-slate-400">No reach data available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddCompetitorModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        workspaceId={workspace?.id ?? ''}
        onSaved={() => { loadData(); setToast('Competitor added successfully') }}
      />

      <RefreshDataModal
        open={showRefreshModal}
        onClose={() => setShowRefreshModal(false)}
        workspaceId={workspace?.id ?? ''}
        competitors={competitors}
        latestSnapshots={latestSnapshots}
        onSaved={() => { loadData(); setToast('Snapshots saved') }}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Remove Competitor"
        description={`Remove "${deleteTarget?.competitor_name}" and all its snapshot history? This cannot be undone.`}
        confirmLabel="Remove"
        danger
      />

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
