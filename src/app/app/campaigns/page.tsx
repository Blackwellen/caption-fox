'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Zap, AlertCircle, Megaphone, CalendarDays, Calendar,
  FileText, DollarSign, MoreHorizontal, LayoutGrid, List, Columns,
  ChevronRight, Gift, Trophy, Rocket, Sparkles, Video, Users,
  Target, RefreshCw, Star, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SkeletonCard, SkeletonRow } from '@/components/ui/Skeleton'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, truncate, initials } from '@/lib/utils'
import {
  CAMPAIGN_STATUSES, CAMPAIGN_STATUS_LABELS, PLATFORM_LABELS,
  CAMPAIGN_TYPES, CAMPAIGN_TYPE_LABELS,
} from '@/lib/constants'
import type { Campaign } from '@/types/database'

const CAM_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'giveaways', label: 'Giveaways' },
  { id: 'competitions', label: 'Competitions' },
]

const STATUS_FILTERS = ['all', ...CAMPAIGN_STATUSES]

const OBJECTIVES = [
  { value: 'awareness', label: 'Awareness' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'conversions', label: 'Conversions' },
  { value: 'retention', label: 'Retention' },
]

const PLATFORMS_LIST = ['instagram', 'tiktok', 'linkedin', 'facebook', 'x', 'youtube']

const STATUS_LABEL_MAP: Record<string, string> = CAMPAIGN_STATUS_LABELS

// ── Campaign type icon map ────────────────────────────────────────────────────
function getCampaignTypeIcon(type: string) {
  const map: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    standard: Megaphone,
    product_launch: Rocket,
    brand_awareness: Sparkles,
    giveaway: Gift,
    competition: Trophy,
    ugc: Video,
    influencer: Users,
    seasonal: Calendar,
    event: CalendarDays,
    lead_gen: Target,
    retargeting: RefreshCw,
    partnership: Star,
  }
  return map[type] ?? Megaphone
}

interface NewCampaignForm {
  name: string
  brand: string
  start_date: string
  end_date: string
  objective: string
  target_audience: string
  platforms: string[]
  post_volume: string
  campaign_type: string
}

const EMPTY_FORM: NewCampaignForm = {
  name: '',
  brand: '',
  start_date: '',
  end_date: '',
  objective: 'awareness',
  target_audience: '',
  platforms: [],
  post_volume: '',
  campaign_type: 'standard',
}

function StatusBadgeColor(status: string): string {
  const map: Record<string, string> = {
    idea: 'slate', briefing: 'blue', in_production: 'blue', in_review: 'amber',
    scheduled: 'blue', live: 'green', reporting: 'violet', completed: 'green', archived: 'slate',
  }
  return map[status] ?? 'default'
}

// ── Giveaway / Competition row types ─────────────────────────────────────────
interface Giveaway {
  id: string
  title: string
  platform?: string | null
  prize_title?: string | null
  status?: string | null
  total_entries?: number | null
  start_date?: string | null
  end_date?: string | null
}

interface Competition {
  id: string
  title: string
  type?: string | null
  prize_title?: string | null
  status?: string | null
  submission_count?: number | null
  judging_type?: string | null
}

export default function CampaignsPage() {
  const router = useRouter()
  const [tab, setTab] = useState('overview')
  const [view, setView] = useState<'cards' | 'table' | 'kanban'>('cards')
  const [statusFilter, setStatusFilter] = useState('all')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<NewCampaignForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Giveaways + Competitions state
  const [giveaways, setGiveaways] = useState<Giveaway[]>([])
  const [giveawaysLoading, setGiveawaysLoading] = useState(false)
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [competitionsLoading, setCompetitionsLoading] = useState(false)

  const loadCampaigns = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let query = supabase.from('campaigns').select('*').order('created_at', { ascending: false })
      if (statusFilter !== 'all') query = query.eq('status', statusFilter)

      const { data, error: qErr } = await query
      if (qErr) throw qErr
      setCampaigns(data ?? [])
    } catch (e: any) {
      setError('Could not load campaigns')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  const loadGiveaways = useCallback(async () => {
    setGiveawaysLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('giveaways')
        .select('id, title, platform, prize_title, status, total_entries, start_date, end_date')
        .order('created_at', { ascending: false })
      setGiveaways(data ?? [])
    } catch {
      // silent — empty state handles it
    } finally {
      setGiveawaysLoading(false)
    }
  }, [])

  const loadCompetitions = useCallback(async () => {
    setCompetitionsLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('competitions')
        .select('id, title, type, prize_title, status, submission_count, judging_type')
        .order('created_at', { ascending: false })
      setCompetitions(data ?? [])
    } catch {
      // silent
    } finally {
      setCompetitionsLoading(false)
    }
  }, [])

  useEffect(() => { loadCampaigns() }, [loadCampaigns])

  useEffect(() => {
    if (tab === 'giveaways') loadGiveaways()
    if (tab === 'competitions') loadCompetitions()
  }, [tab, loadGiveaways, loadCompetitions])

  function openModal() {
    setForm(EMPTY_FORM)
    setStep(1)
    setFormError(null)
    setModalOpen(true)
  }

  function validateStep() {
    if (step === 1) {
      if (!form.name.trim()) { setFormError('Campaign name is required'); return false }
      if (!form.start_date) { setFormError('Start date is required'); return false }
    }
    if (step === 2) {
      if (!form.objective) { setFormError('Objective is required'); return false }
    }
    if (step === 3) {
      if (form.platforms.length === 0) { setFormError('Select at least one platform'); return false }
    }
    setFormError(null)
    return true
  }

  async function handleNext() {
    if (!validateStep()) return
    if (step < 3) { setStep((s) => s + 1); return }
    // Step 3 submit
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error: insertErr } = await supabase
        .from('campaigns')
        .insert({
          name: form.name,
          status: 'idea',
          objective: form.objective,
          target_audience: form.target_audience || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          workspace_id: 'placeholder',
          created_by: user.id,
          campaign_type: form.campaign_type || 'standard',
        })
        .select()
        .single()

      if (insertErr) throw insertErr
      setModalOpen(false)
      if (data?.id) router.push(`/app/campaigns/${data.id}`)
      else loadCampaigns()
    } catch (e: any) {
      setFormError(e.message ?? 'Failed to create campaign')
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = campaigns.filter((c) => statusFilter === 'all' || c.status === statusFilter)

  // Kanban groups
  const kanbanCols = CAMPAIGN_STATUSES.filter((s) => s !== 'archived')
  const byStatus = (status: string) => filtered.filter((c) => c.status === status)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="Campaigns" subtitle="Plan and manage your marketing campaigns">
        <Button variant="ai" size="sm" icon={<Zap size={14} />}>Generate Campaign</Button>
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openModal}>New Campaign</Button>
      </PageHeader>

      <Tabs tabs={CAM_TABS} active={tab} onChange={setTab} className="mb-6" />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <>
          {/* Filters + View toggle */}
          <div className="flex flex-wrap items-center gap-3 justify-between mb-5">
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-full border transition-all capitalize',
                    statusFilter === s
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
                  )}
                >{s === 'all' ? 'All' : STATUS_LABEL_MAP[s] ?? s}</button>
              ))}
            </div>
            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                onClick={() => setView('cards')}
                className={cn('p-1.5 rounded-md transition-all', view === 'cards' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600')}
                title="Cards"
              ><LayoutGrid size={15} /></button>
              <button
                onClick={() => setView('table')}
                className={cn('p-1.5 rounded-md transition-all', view === 'table' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600')}
                title="Table"
              ><List size={15} /></button>
              <button
                onClick={() => setView('kanban')}
                className={cn('p-1.5 rounded-md transition-all', view === 'kanban' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600')}
                title="Kanban"
              ><Columns size={15} /></button>
            </div>
          </div>

          {/* ── CARDS VIEW ── */}
          {view === 'cards' && (
            <>
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200">
                  <EmptyState
                    icon={Megaphone}
                    title="No campaigns yet"
                    description="Create your first campaign to start planning and tracking your marketing efforts."
                    action={{ label: 'New Campaign', onClick: openModal, icon: <Plus size={14} /> }}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((campaign) => (
                    <CampaignCard key={campaign.id} campaign={campaign} onClick={() => router.push(`/app/campaigns/${campaign.id}`)} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── TABLE VIEW ── */}
          {view === 'table' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Dates</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Objective</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Budget</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}><td colSpan={7}><SkeletonRow /></td></tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState icon={Megaphone} title="No campaigns" description="Create your first campaign." compact action={{ label: 'New Campaign', onClick: openModal, icon: <Plus size={12} /> }} />
                      </td>
                    </tr>
                  ) : filtered.map((campaign) => {
                    const TypeIcon = getCampaignTypeIcon((campaign as any).campaign_type ?? 'standard')
                    return (
                      <tr
                        key={campaign.id}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/app/campaigns/${campaign.id}`)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 text-blue-600 font-bold text-xs">
                              {initials(campaign.name)}
                            </div>
                            <div>
                              <span className="font-medium text-slate-900 block">{truncate(campaign.name, 40)}</span>
                              {(campaign as any).campaign_type && (campaign as any).campaign_type !== 'standard' && (
                                <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                  <TypeIcon size={10} />
                                  {CAMPAIGN_TYPE_LABELS[(campaign as any).campaign_type] ?? (campaign as any).campaign_type}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge status={campaign.status} variant={StatusBadgeColor(campaign.status) as any} dot>
                            {STATUS_LABEL_MAP[campaign.status] ?? campaign.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {(campaign as any).campaign_type ? (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <TypeIcon size={11} />
                              {CAMPAIGN_TYPE_LABELS[(campaign as any).campaign_type] ?? (campaign as any).campaign_type}
                            </span>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">
                          {campaign.start_date ? formatDate(campaign.start_date) : '—'}{campaign.end_date ? ` → ${formatDate(campaign.end_date)}` : ''}
                        </td>
                        <td className="px-4 py-3 text-slate-500 capitalize hidden lg:table-cell">{campaign.objective ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                          {campaign.budget ? `$${campaign.budget.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <ChevronRight size={14} className="text-slate-400" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── KANBAN VIEW ── */}
          {view === 'kanban' && (
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-3 min-w-max">
                {kanbanCols.map((status) => {
                  const colCampaigns = byStatus(status)
                  return (
                    <div key={status} className="w-60 shrink-0">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          {STATUS_LABEL_MAP[status]}
                        </span>
                        <Badge variant="slate">{colCampaigns.length}</Badge>
                      </div>
                      <div className="space-y-2 min-h-[120px] p-2 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                        {colCampaigns.map((c) => {
                          const TypeIcon = getCampaignTypeIcon((c as any).campaign_type ?? 'standard')
                          return (
                            <div
                              key={c.id}
                              className="bg-white border border-slate-200 rounded-lg p-3 cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all"
                              onClick={() => router.push(`/app/campaigns/${c.id}`)}
                            >
                              <p className="text-xs font-semibold text-slate-900 mb-1 leading-snug">{truncate(c.name, 35)}</p>
                              {(c as any).campaign_type && (
                                <span className="text-xs text-slate-400 flex items-center gap-1 mb-1.5">
                                  <TypeIcon size={10} />
                                  {CAMPAIGN_TYPE_LABELS[(c as any).campaign_type] ?? (c as any).campaign_type}
                                </span>
                              )}
                              <Badge status={c.status} variant={StatusBadgeColor(c.status) as any} dot className="text-xs">
                                {STATUS_LABEL_MAP[c.status]}
                              </Badge>
                            </div>
                          )
                        })}
                        {colCampaigns.length === 0 && (
                          <div className="flex items-center justify-center h-16 text-xs text-slate-400">
                            No campaigns
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-slate-400 mt-3 text-center">Drag-and-drop coming soon</p>
            </div>
          )}
        </>
      )}

      {/* ── GIVEAWAYS TAB ── */}
      {tab === 'giveaways' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">Manage giveaways attached to your campaigns.</p>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => router.push('/app/campaigns/giveaways')}
            >
              New Giveaway
            </Button>
          </div>

          {giveawaysLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : giveaways.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200">
              <EmptyState
                icon={Gift}
                title="No giveaways yet"
                description="Create a giveaway campaign to run contests and grow your audience."
                action={{ label: 'New Giveaway', onClick: () => router.push('/app/campaigns/giveaways'), icon: <Plus size={14} /> }}
              />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Platform</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Prize</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Entries</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Dates</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {giveaways.map((g) => (
                    <tr
                      key={g.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/app/campaigns/giveaways/${g.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0 text-orange-500">
                            <Gift size={15} />
                          </div>
                          <span className="font-medium text-slate-900">{truncate(g.title, 40)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {g.platform ? (
                          <Badge variant="slate">{PLATFORM_LABELS[g.platform] ?? g.platform}</Badge>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs hidden md:table-cell">
                        {g.prize_title ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {g.status ? (
                          <Badge variant={g.status === 'active' ? 'green' : g.status === 'ended' ? 'slate' : 'blue'} dot>
                            {g.status}
                          </Badge>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">
                        {g.total_entries != null ? g.total_entries.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">
                        {g.start_date ? formatDate(g.start_date) : '—'}
                        {g.end_date ? ` → ${formatDate(g.end_date)}` : ''}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-blue-600 flex items-center gap-1 hover:underline">
                          View <ExternalLink size={11} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── COMPETITIONS TAB ── */}
      {tab === 'competitions' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">Manage competitions and contests across your campaigns.</p>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => router.push('/app/campaigns/competitions')}
            >
              New Competition
            </Button>
          </div>

          {competitionsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : competitions.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200">
              <EmptyState
                icon={Trophy}
                title="No competitions yet"
                description="Create a competition to engage your audience with prizes and judging."
                action={{ label: 'New Competition', onClick: () => router.push('/app/campaigns/competitions'), icon: <Plus size={14} /> }}
              />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Prize</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Submissions</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Judging</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {competitions.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/app/campaigns/competitions/${c.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center shrink-0 text-yellow-500">
                            <Trophy size={15} />
                          </div>
                          <span className="font-medium text-slate-900">{truncate(c.title, 40)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {c.type ? (
                          <Badge variant="blue">{c.type}</Badge>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs hidden md:table-cell">
                        {c.prize_title ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {c.status ? (
                          <Badge variant={c.status === 'active' ? 'green' : c.status === 'ended' ? 'slate' : 'blue'} dot>
                            {c.status}
                          </Badge>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">
                        {c.submission_count != null ? c.submission_count.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {c.judging_type ? (
                          <Badge variant="violet">{c.judging_type}</Badge>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-blue-600 flex items-center gap-1 hover:underline">
                          View <ExternalLink size={11} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── NEW CAMPAIGN MODAL ── */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setFormError(null) }}
        title="New Campaign"
        description={`Step ${step} of 3`}
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex gap-1.5">
              {[1, 2, 3].map((s) => (
                <div key={s} className={cn('w-2 h-2 rounded-full transition-colors', s === step ? 'bg-blue-600' : 'bg-slate-200')} />
              ))}
            </div>
            <div className="flex gap-2">
              {step > 1 && <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>Back</Button>}
              <Button variant="secondary" onClick={() => { setModalOpen(false); setFormError(null) }}>Cancel</Button>
              <Button variant="primary" loading={submitting} onClick={handleNext}>
                {step === 3 ? 'Create Campaign' : 'Next'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <AlertCircle size={14} /> {formError}
            </div>
          )}

          {step === 1 && (
            <>
              {/* Campaign Type selector */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Campaign Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {CAMPAIGN_TYPES.map((type) => {
                    const TypeIcon = getCampaignTypeIcon(type)
                    const selected = form.campaign_type === type
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, campaign_type: type }))}
                        className={cn(
                          'flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg border text-xs font-medium transition-all',
                          selected
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                        )}
                      >
                        <TypeIcon size={16} className={selected ? 'text-blue-600' : 'text-slate-400'} />
                        <span className="text-center leading-tight">{CAMPAIGN_TYPE_LABELS[type]}</span>
                      </button>
                    )
                  })}
                </div>
                {/* Contextual hints */}
                {form.campaign_type === 'giveaway' && (
                  <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                    <Gift size={13} className="mt-0.5 shrink-0" />
                    Creates a campaign + giveaway — you can configure entry rules in the Giveaways section.
                  </p>
                )}
                {form.campaign_type === 'competition' && (
                  <p className="mt-2 text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 flex items-start gap-2">
                    <Trophy size={13} className="mt-0.5 shrink-0" />
                    Creates a campaign + competition — configure judging and prizes in the Competitions section.
                  </p>
                )}
              </div>

              <Input
                label="Campaign Name"
                placeholder="e.g. Summer Sale 2026"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
              <Input
                label="Brand"
                placeholder="Brand name (optional)"
                value={form.brand}
                onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Start Date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                />
                <Input
                  label="End Date"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Select
                label="Campaign Objective"
                value={form.objective}
                onChange={(e) => setForm((p) => ({ ...p, objective: e.target.value }))}
                options={OBJECTIVES}
              />
              <Textarea
                label="Target Audience"
                placeholder="Describe your target audience — age, interests, location, pain points…"
                rows={4}
                value={form.target_audience}
                onChange={(e) => setForm((p) => ({ ...p, target_audience: e.target.value }))}
              />
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Platforms</label>
                <div className="grid grid-cols-3 gap-2">
                  {PLATFORMS_LIST.map((p) => (
                    <label
                      key={p}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm capitalize',
                        form.platforms.includes(p)
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="accent-blue-600"
                        checked={form.platforms.includes(p)}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            platforms: e.target.checked
                              ? [...prev.platforms, p]
                              : prev.platforms.filter((x) => x !== p),
                          }))
                        }
                      />
                      {PLATFORM_LABELS[p] ?? p}
                    </label>
                  ))}
                </div>
              </div>
              <Input
                label="Estimated Post Volume"
                type="number"
                placeholder="e.g. 20"
                value={form.post_volume}
                onChange={(e) => setForm((p) => ({ ...p, post_volume: e.target.value }))}
                hint="How many posts do you plan to create for this campaign?"
              />
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}

function CampaignCard({ campaign, onClick }: { campaign: Campaign; onClick: () => void }) {
  const progress = campaign.start_date && campaign.end_date
    ? Math.min(100, Math.max(0, Math.round(
        (Date.now() - new Date(campaign.start_date).getTime()) /
        (new Date(campaign.end_date).getTime() - new Date(campaign.start_date).getTime()) * 100
      )))
    : 0

  const campaignType = (campaign as any).campaign_type as string | undefined
  const TypeIcon = getCampaignTypeIcon(campaignType ?? 'standard')

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-4 hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 text-blue-600 font-bold text-xs">
            {initials(campaign.name)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{campaign.name}</p>
            {campaignType && (
              <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <TypeIcon size={10} />
                {CAMPAIGN_TYPE_LABELS[campaignType] ?? campaignType}
              </span>
            )}
          </div>
        </div>
        <Badge
          status={campaign.status}
          variant={StatusBadgeColor(campaign.status) as any}
          dot
        >
          {CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status}
        </Badge>
      </div>

      {campaign.start_date && (
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <CalendarDays size={12} />
          {formatDate(campaign.start_date)}
          {campaign.end_date && <> → {formatDate(campaign.end_date)}</>}
        </div>
      )}

      {campaign.start_date && campaign.end_date && (
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><FileText size={11} /> 0 posts</span>
          {campaign.budget && <span className="flex items-center gap-1"><DollarSign size={11} />{campaign.budget.toLocaleString()}</span>}
        </div>
        <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
      </div>
    </div>
  )
}
