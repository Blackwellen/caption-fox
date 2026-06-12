'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Zap, Calendar, Megaphone, FileText, CheckCircle2, Activity,
  BrainCircuit, Clock, AlertCircle,
  Trash2, Loader2, ChevronDown, Inbox,
  Check, X as XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { createClient } from '@/lib/supabase/client'
import { cn, formatRelative, truncate, initials } from '@/lib/utils'
import { PLATFORM_LABELS } from '@/lib/constants'
import type { ContentPost, Approval, AuditLog, Profile } from '@/types/database'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ContentIdea {
  id: string
  workspace_id: string
  title: string
  description: string | null
  platforms: string[]
  status: string
  source: string
  created_at: string
}

interface ApprovalWithDetails extends Approval {
  post?: ContentPost | null
  requester?: Profile | null
}

interface AuditLogWithProfile extends AuditLog {
  profile?: Profile | null
}

interface KpiData {
  scheduledThisWeek: number
  publishedThisMonth: number
  activeCampaigns: number
  inboxUnread: number
}

interface HealthItem {
  id: string
  label: string
  description: string
  checked: boolean
  loading: boolean
  href: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const HOME_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'today', label: 'Today' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'ideas', label: 'Ideas' },
  { id: 'activity', label: 'Activity' },
  { id: 'health', label: 'Health' },
]

const QUICK_ACTIONS = [
  { icon: <Plus size={20} className="text-blue-600" />, label: 'Create Post', desc: 'Schedule content to any channel', href: '/app/studio', bg: 'bg-blue-50' },
  { icon: <Calendar size={20} className="text-violet-600" />, label: 'View Calendar', desc: 'See your content schedule', href: '/app/calendar', bg: 'bg-violet-50' },
  { icon: <Megaphone size={20} className="text-amber-600" />, label: 'New Campaign', desc: 'Plan a multi-platform campaign', href: '/app/campaigns', bg: 'bg-amber-50' },
  { icon: <Inbox size={20} className="text-emerald-600" />, label: 'View Inbox', desc: 'Manage messages & comments', href: '/app/inbox', bg: 'bg-emerald-50' },
]

const ACTION_DOT: Record<string, string> = {
  create: 'bg-emerald-500',
  update: 'bg-blue-500',
  delete: 'bg-red-500',
  approve: 'bg-violet-500',
  reject: 'bg-red-400',
  publish: 'bg-green-500',
}

const IDEA_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'ai_generated', label: 'AI Generated' },
  { id: 'saved', label: 'Saved' },
]

const ALL_PLATFORMS = ['instagram', 'tiktok', 'linkedin', 'facebook', 'x', 'youtube']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function platformBadgeVariant(p: string): 'blue' | 'violet' | 'slate' | 'amber' | 'red' | 'green' {
  if (p === 'instagram') return 'violet'
  if (p === 'linkedin') return 'blue'
  if (p === 'tiktok') return 'slate'
  if (p === 'facebook') return 'blue'
  if (p === 'x') return 'slate'
  if (p === 'youtube') return 'red'
  return 'slate'
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter()
  const [tab, setTab] = useState('overview')

  // Shared
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [bootstrapping, setBootstrapping] = useState(true)

  // Overview KPIs
  const [kpi, setKpi] = useState<KpiData | null>(null)
  const [kpiLoading, setKpiLoading] = useState(true)

  // Overview activity (last 10)
  const [recentActivity, setRecentActivity] = useState<AuditLogWithProfile[]>([])
  const [activityLoading, setActivityLoading] = useState(true)

  // Today
  const [todayPosts, setTodayPosts] = useState<ContentPost[]>([])
  const [todayLoading, setTodayLoading] = useState(true)
  const [todayIdeas, setTodayIdeas] = useState<ContentIdea[]>([])
  const [ideasLoading, setIdeasLoading] = useState(true)
  const [convertingId, setConvertingId] = useState<string | null>(null)

  // Approvals
  const [approvals, setApprovals] = useState<ApprovalWithDetails[]>([])
  const [approvalsLoading, setApprovalsLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<{ open: boolean; approval: ApprovalWithDetails | null; notes: string }>({ open: false, approval: null, notes: '' })
  const [rejecting, setRejecting] = useState(false)

  // Ideas
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [ideaFilter, setIdeaFilter] = useState('all')
  const [ideasTabLoading, setIdeasTabLoading] = useState(true)
  const [newIdeaModal, setNewIdeaModal] = useState(false)
  const [ideaForm, setIdeaForm] = useState({ title: '', description: '', platforms: [] as string[], aiGenerate: false })
  const [ideaSubmitting, setIdeaSubmitting] = useState(false)
  const [ideaGenerating, setIdeaGenerating] = useState(false)
  const [deletingIdeaId, setDeletingIdeaId] = useState<string | null>(null)

  // Activity (full tab)
  const [allActivity, setAllActivity] = useState<AuditLogWithProfile[]>([])
  const [allActivityLoading, setAllActivityLoading] = useState(true)
  const [activityPage, setActivityPage] = useState(0)
  const [activityHasMore, setActivityHasMore] = useState(false)
  const [activityLoadingMore, setActivityLoadingMore] = useState(false)

  // Health
  const [healthItems, setHealthItems] = useState<HealthItem[]>([])
  const [healthLoading, setHealthLoading] = useState(true)

  // ── Bootstrap: get user + workspace ──────────────────────────────────────

  useEffect(() => {
    async function bootstrap() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setBootstrapping(false); return }
        setUserId(user.id)

        const [profileRes, memberRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).single(),
        ])

        if (profileRes.data) setProfile(profileRes.data)
        if (memberRes.data?.workspace_id) setWorkspaceId(memberRes.data.workspace_id)
      } catch {
        // silent
      } finally {
        setBootstrapping(false)
      }
    }
    bootstrap()
  }, [])

  // ── Load data per tab ────────────────────────────────────────────────────

  const loadKpi = useCallback(async () => {
    if (!workspaceId) return
    setKpiLoading(true)
    try {
      const supabase = createClient()
      const now = new Date()
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1); weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6); weekEnd.setHours(23, 59, 59, 999)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

      const [w, pub, camp, inbox] = await Promise.allSettled([
        supabase.from('content_posts').select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId).eq('status', 'scheduled')
          .gte('scheduled_at', weekStart.toISOString()).lte('scheduled_at', weekEnd.toISOString()),
        supabase.from('content_posts').select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId).eq('status', 'published')
          .gte('published_at', monthStart.toISOString()).lte('published_at', monthEnd.toISOString()),
        supabase.from('campaigns').select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId).in('status', ['live', 'in_production']),
        supabase.from('inbox_threads').select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId).eq('status', 'open'),
      ])

      setKpi({
        scheduledThisWeek: w.status === 'fulfilled' ? (w.value.count ?? 0) : 0,
        publishedThisMonth: pub.status === 'fulfilled' ? (pub.value.count ?? 0) : 0,
        activeCampaigns: camp.status === 'fulfilled' ? (camp.value.count ?? 0) : 0,
        inboxUnread: inbox.status === 'fulfilled' ? (inbox.value.count ?? 0) : 0,
      })
    } catch {
      setKpi({ scheduledThisWeek: 0, publishedThisMonth: 0, activeCampaigns: 0, inboxUnread: 0 })
    } finally {
      setKpiLoading(false)
    }
  }, [workspaceId])

  const loadRecentActivity = useCallback(async () => {
    if (!workspaceId) return
    setActivityLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase.from('audit_logs')
        .select('*').eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }).limit(10)

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(l => l.user_id).filter(Boolean))] as string[]
        const { data: profiles } = await supabase.from('profiles').select('id,full_name,avatar_url').in('id', userIds)
        const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
        setRecentActivity(data.map(l => ({ ...l, profile: profileMap[l.user_id ?? ''] ?? null })))
      } else {
        setRecentActivity([])
      }
    } catch {
      setRecentActivity([])
    } finally {
      setActivityLoading(false)
    }
  }, [workspaceId])

  const loadToday = useCallback(async () => {
    if (!workspaceId) return
    setTodayLoading(true)
    setIdeasLoading(true)
    try {
      const supabase = createClient()
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)

      const [postsRes, ideasRes] = await Promise.allSettled([
        supabase.from('content_posts').select('*')
          .eq('workspace_id', workspaceId).eq('status', 'scheduled')
          .gte('scheduled_at', todayStart.toISOString())
          .lte('scheduled_at', todayEnd.toISOString())
          .order('scheduled_at', { ascending: true }),
        supabase.from('content_ideas').select('*')
          .eq('workspace_id', workspaceId).eq('status', 'idea')
          .order('created_at', { ascending: false }).limit(5),
      ])

      setTodayPosts(postsRes.status === 'fulfilled' ? (postsRes.value.data ?? []) : [])
      setTodayIdeas(ideasRes.status === 'fulfilled' ? (ideasRes.value.data ?? []) : [])
    } catch {
      setTodayPosts([])
      setTodayIdeas([])
    } finally {
      setTodayLoading(false)
      setIdeasLoading(false)
    }
  }, [workspaceId])

  const loadApprovals = useCallback(async () => {
    if (!workspaceId) return
    setApprovalsLoading(true)
    try {
      const supabase = createClient()
      const { data: approvalData } = await supabase.from('approvals')
        .select('*').eq('workspace_id', workspaceId).eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (approvalData && approvalData.length > 0) {
        const postIds = [...new Set(approvalData.map(a => a.post_id).filter(Boolean))] as string[]
        const requesterIds = [...new Set(approvalData.map(a => a.requested_by).filter(Boolean))] as string[]

        const [postsRes, profilesRes] = await Promise.allSettled([
          postIds.length > 0 ? supabase.from('content_posts').select('*').in('id', postIds) : Promise.resolve({ data: [] }),
          requesterIds.length > 0 ? supabase.from('profiles').select('id,full_name,avatar_url,email').in('id', requesterIds) : Promise.resolve({ data: [] }),
        ])

        const postsMap = Object.fromEntries(
          ((postsRes.status === 'fulfilled' ? postsRes.value.data : []) ?? []).map((p: ContentPost) => [p.id, p])
        )
        const profilesMap = Object.fromEntries(
          ((profilesRes.status === 'fulfilled' ? profilesRes.value.data : []) ?? []).map((p: { id: string; full_name: string | null; avatar_url: string | null; email: string }) => [p.id, p])
        )

        setApprovals(approvalData.map(a => ({
          ...a,
          post: a.post_id ? postsMap[a.post_id] ?? null : null,
          requester: a.requested_by ? profilesMap[a.requested_by] ?? null : null,
        })))
      } else {
        setApprovals([])
      }
    } catch {
      setApprovals([])
    } finally {
      setApprovalsLoading(false)
    }
  }, [workspaceId])

  const loadIdeas = useCallback(async () => {
    if (!workspaceId) return
    setIdeasTabLoading(true)
    try {
      const supabase = createClient()
      let query = supabase.from('content_ideas').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })
      if (ideaFilter === 'ai_generated') query = query.eq('source', 'ai')
      else if (ideaFilter === 'saved') query = query.eq('source', 'manual')
      const { data } = await query
      setIdeas(data ?? [])
    } catch {
      setIdeas([])
    } finally {
      setIdeasTabLoading(false)
    }
  }, [workspaceId, ideaFilter])

  const loadAllActivity = useCallback(async (page = 0) => {
    if (!workspaceId) return
    if (page === 0) setAllActivityLoading(true)
    else setActivityLoadingMore(true)
    try {
      const supabase = createClient()
      const { data } = await supabase.from('audit_logs')
        .select('*').eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .range(page * 20, page * 20 + 20)

      if (data) {
        setActivityHasMore(data.length === 21)
        const slice = data.slice(0, 20)
        const userIds = [...new Set(slice.map(l => l.user_id).filter(Boolean))] as string[]
        const { data: profiles } = await supabase.from('profiles').select('id,full_name,avatar_url').in('id', userIds)
        const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
        const enriched = slice.map(l => ({ ...l, profile: profileMap[l.user_id ?? ''] ?? null }))
        setAllActivity(prev => page === 0 ? enriched : [...prev, ...enriched])
      }
    } catch {
      // silent
    } finally {
      setAllActivityLoading(false)
      setActivityLoadingMore(false)
    }
  }, [workspaceId])

  const loadHealth = useCallback(async () => {
    if (!workspaceId) return
    setHealthLoading(true)
    const base: HealthItem[] = [
      { id: 'brand', label: 'Brand profile set up', description: 'Create a brand with name, logo and colour', checked: false, loading: true, href: '/app/settings/brand' },
      { id: 'channel', label: 'Social channel connected', description: 'Connect at least one social platform', checked: false, loading: true, href: '/app/settings/channels' },
      { id: 'voice', label: 'Brand voice configured', description: 'Set your tone, style and banned phrases', checked: false, loading: true, href: '/app/settings/brand' },
      { id: 'team', label: 'Team member invited', description: 'Invite at least one collaborator', checked: false, loading: true, href: '/app/settings/team' },
      { id: 'post', label: 'First post published', description: 'Publish your first piece of content', checked: false, loading: true, href: '/app/calendar' },
      { id: 'analytics', label: 'Analytics connected', description: 'Connect analytics for performance insights', checked: false, loading: true, href: '/app/analytics' },
    ]
    setHealthItems(base)

    try {
      const supabase = createClient()
      const [brandRes, channelRes, voiceRes, teamRes, postRes] = await Promise.allSettled([
        supabase.from('brands').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
        supabase.from('social_channels').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('is_active', true),
        supabase.from('brand_voice_profiles').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
        supabase.from('workspace_members').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
        supabase.from('content_posts').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'published'),
      ])

      setHealthItems([
        { ...base[0], checked: (brandRes.status === 'fulfilled' ? brandRes.value.count ?? 0 : 0) > 0, loading: false },
        { ...base[1], checked: (channelRes.status === 'fulfilled' ? channelRes.value.count ?? 0 : 0) > 0, loading: false },
        { ...base[2], checked: (voiceRes.status === 'fulfilled' ? voiceRes.value.count ?? 0 : 0) > 0, loading: false },
        { ...base[3], checked: (teamRes.status === 'fulfilled' ? teamRes.value.count ?? 0 : 0) > 1, loading: false },
        { ...base[4], checked: (postRes.status === 'fulfilled' ? postRes.value.count ?? 0 : 0) > 0, loading: false },
        { ...base[5], checked: false, loading: false }, // analytics: future integration
      ])
    } catch {
      setHealthItems(base.map(i => ({ ...i, loading: false })))
    } finally {
      setHealthLoading(false)
    }
  }, [workspaceId])

  // Trigger loads when workspace ready
  useEffect(() => {
    if (!workspaceId) return
    loadKpi()
    loadRecentActivity()
  }, [workspaceId, loadKpi, loadRecentActivity])

  useEffect(() => {
    if (tab === 'today' && workspaceId) loadToday()
  }, [tab, workspaceId, loadToday])

  useEffect(() => {
    if (tab === 'approvals' && workspaceId) loadApprovals()
  }, [tab, workspaceId, loadApprovals])

  useEffect(() => {
    if (tab === 'ideas' && workspaceId) loadIdeas()
  }, [tab, workspaceId, loadIdeas, ideaFilter])

  useEffect(() => {
    if (tab === 'activity' && workspaceId) { setActivityPage(0); loadAllActivity(0) }
  }, [tab, workspaceId])

  useEffect(() => {
    if (tab === 'health' && workspaceId) loadHealth()
  }, [tab, workspaceId, loadHealth])

  // ── Approval actions ──────────────────────────────────────────────────────

  async function handleApprove(approval: ApprovalWithDetails) {
    setApprovingId(approval.id)
    try {
      const supabase = createClient()
      await supabase.from('approvals').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', approval.id)
      if (approval.post_id) {
        await supabase.from('content_posts').update({ status: 'approved' }).eq('id', approval.post_id)
      }
      setApprovals(prev => prev.filter(a => a.id !== approval.id))
    } catch {
      // silent
    } finally {
      setApprovingId(null)
    }
  }

  async function handleReject() {
    if (!rejectModal.approval) return
    setRejecting(true)
    try {
      const supabase = createClient()
      await supabase.from('approvals').update({
        status: 'rejected',
        notes: rejectModal.notes,
        reviewed_at: new Date().toISOString(),
      }).eq('id', rejectModal.approval.id)
      setApprovals(prev => prev.filter(a => a.id !== rejectModal.approval?.id))
      setRejectModal({ open: false, approval: null, notes: '' })
    } catch {
      // silent
    } finally {
      setRejecting(false)
    }
  }

  // ── Idea actions ──────────────────────────────────────────────────────────

  async function handleConvertIdea(idea: ContentIdea) {
    setConvertingId(idea.id)
    try {
      const supabase = createClient()
      await supabase.from('content_ideas').update({ status: 'converted' }).eq('id', idea.id)
      setTodayIdeas(prev => prev.filter(i => i.id !== idea.id))
    } catch {
      // silent
    } finally {
      setConvertingId(null)
    }
  }

  async function handleConvertIdeaInTab(idea: ContentIdea) {
    setConvertingId(idea.id)
    try {
      const supabase = createClient()
      await supabase.from('content_ideas').update({ status: 'converted' }).eq('id', idea.id)
      setIdeas(prev => prev.filter(i => i.id !== idea.id))
    } catch {
      // silent
    } finally {
      setConvertingId(null)
    }
  }

  async function handleDeleteIdea(id: string) {
    setDeletingIdeaId(id)
    try {
      const supabase = createClient()
      await supabase.from('content_ideas').delete().eq('id', id)
      setIdeas(prev => prev.filter(i => i.id !== id))
    } catch {
      // silent
    } finally {
      setDeletingIdeaId(null)
    }
  }

  async function handleCreateIdea() {
    if (!ideaForm.title.trim() || !workspaceId) return
    setIdeaSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      let title = ideaForm.title
      let description = ideaForm.description

      if (ideaForm.aiGenerate) {
        setIdeaGenerating(true)
        try {
          const res = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'ideas', prompt: ideaForm.title, platforms: ideaForm.platforms }),
          })
          if (res.ok) {
            const json = await res.json()
            if (json.content) description = json.content
          }
        } catch { /* silent */ } finally {
          setIdeaGenerating(false)
        }
      }

      const { data } = await supabase.from('content_ideas').insert({
        workspace_id: workspaceId,
        title,
        description: description || null,
        platforms: ideaForm.platforms,
        status: 'idea',
        source: ideaForm.aiGenerate ? 'ai' : 'manual',
        created_by: user?.id ?? '',
      }).select().single()

      if (data) setIdeas(prev => [data, ...prev])
      setNewIdeaModal(false)
      setIdeaForm({ title: '', description: '', platforms: [], aiGenerate: false })
    } catch {
      // silent
    } finally {
      setIdeaSubmitting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title={bootstrapping ? 'Home' : `Welcome back, ${firstName}`}
        subtitle="Your social media command centre"
      >
        <Button variant="ghost" size="sm" icon={<BrainCircuit size={15} />} onClick={() => router.push('/app/studio')}>
          Ask Fox
        </Button>
        <Button variant="secondary" size="sm" icon={<Zap size={15} />} onClick={() => router.push('/app/studio')}>
          Generate Week Plan
        </Button>
        <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => router.push('/app/studio')}>
          New Post
        </Button>
      </PageHeader>

      <Tabs tabs={HOME_TABS} active={tab} onChange={setTab} className="mb-6" />

      {/* ═══════════════════ OVERVIEW ═══════════════════ */}
      {tab === 'overview' && (
        <div className="space-y-8">

          {/* KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 h-[88px]">
                    <Skeleton className="h-4 w-1/2 mb-3" />
                    <Skeleton className="h-7 w-1/3" />
                  </div>
                ))
              : [
                  { label: 'Scheduled This Week', value: kpi?.scheduledThisWeek ?? 0, color: 'text-blue-600', bg: 'bg-blue-50', icon: <Calendar size={18} className="text-blue-500" /> },
                  { label: 'Published This Month', value: kpi?.publishedThisMonth ?? 0, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <CheckCircle2 size={18} className="text-emerald-500" /> },
                  { label: 'Campaigns Active', value: kpi?.activeCampaigns ?? 0, color: 'text-violet-600', bg: 'bg-violet-50', icon: <Megaphone size={18} className="text-violet-500" /> },
                  { label: 'Inbox Unread', value: kpi?.inboxUnread ?? 0, color: 'text-amber-600', bg: 'bg-amber-50', icon: <Inbox size={18} className="text-amber-500" /> },
                ].map(card => (
                  <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', card.bg)}>
                      {card.icon}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">{card.label}</p>
                      <p className={cn('text-2xl font-bold mt-0.5 leading-none', card.color)}>{card.value}</p>
                    </div>
                  </div>
                ))
            }
          </div>

          {/* Recent Activity */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
              <Button variant="ghost" size="xs" onClick={() => setTab('activity')}>View all</Button>
            </div>
            <div className="bg-white rounded-xl border border-slate-200">
              {activityLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0">
                      <Skeleton className="w-2 h-2 rounded-full shrink-0" />
                      <Skeleton className="h-3 flex-1" />
                      <Skeleton className="h-3 w-14" />
                    </div>
                  ))
                : recentActivity.length === 0
                  ? <EmptyState icon={Activity} title="No recent activity" description="Actions taken across your workspace will appear here." compact />
                  : recentActivity.map(log => (
                      <div key={log.id} className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                        <span className={cn('w-2 h-2 rounded-full shrink-0 mt-0.5', ACTION_DOT[log.action] ?? 'bg-slate-400')} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 truncate">
                            <span className="font-medium">{log.profile?.full_name ?? 'Someone'}</span>
                            {' '}<span className="capitalize">{log.action}</span>
                            {' '}<span className="text-slate-500">{log.resource_type?.replace(/_/g, ' ')}</span>
                          </p>
                        </div>
                        <span className="text-xs text-slate-400 shrink-0">{formatRelative(log.created_at)}</span>
                      </div>
                    ))
              }
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {QUICK_ACTIONS.map(action => (
                <div
                  key={action.label}
                  className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3 hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer group"
                  onClick={() => router.push(action.href)}
                >
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors', action.bg)}>
                    {action.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{action.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{action.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ TODAY ═══════════════════ */}
      {tab === 'today' && (
        <div className="space-y-6">

          {/* Scheduled today */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Posts Scheduled Today</h2>
              <Button variant="ghost" size="xs" onClick={() => router.push('/app/calendar')}>Open Calendar</Button>
            </div>
            <div className="bg-white rounded-xl border border-slate-200">
              {todayLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 last:border-0">
                      <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </div>
                  ))
                : todayPosts.length === 0
                  ? <EmptyState icon={Calendar} title="Nothing scheduled today" description="Your schedule is clear — create a post to fill it." action={{ label: 'View Calendar', onClick: () => router.push('/app/calendar'), icon: <Calendar size={14} /> }} compact />
                  : todayPosts.map(post => (
                      <div key={post.id} className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => router.push(`/app/studio/${post.id}`)}>
                        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                          <FileText size={15} className="text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{post.title ?? 'Untitled post'}</p>
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock size={11} />
                            {post.scheduled_at ? new Date(post.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No time set'}
                          </p>
                        </div>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {(post.platforms ?? []).slice(0, 3).map(p => (
                            <Badge key={p} variant={platformBadgeVariant(p)} className="capitalize">{PLATFORM_LABELS[p] ?? p}</Badge>
                          ))}
                        </div>
                        <Badge status={post.status} dot>{post.status}</Badge>
                      </div>
                    ))
              }
            </div>
          </div>

          {/* Content ideas for today */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Content Ideas</h2>
              <Button variant="ghost" size="xs" onClick={() => setTab('ideas')}>View all ideas</Button>
            </div>
            <div className="bg-white rounded-xl border border-slate-200">
              {ideasLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 last:border-0">
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                  ))
                : todayIdeas.length === 0
                  ? <EmptyState icon={BrainCircuit} title="No ideas saved" description="Generate or save content ideas to see them here." action={{ label: 'Create Ideas', onClick: () => setTab('ideas'), icon: <Plus size={14} /> }} compact />
                  : todayIdeas.map(idea => (
                      <div key={idea.id} className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                        <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                          <BrainCircuit size={15} className="text-violet-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{idea.title}</p>
                          {idea.description && (
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{truncate(idea.description, 80)}</p>
                          )}
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {(idea.platforms ?? []).map(p => (
                              <Badge key={p} variant={platformBadgeVariant(p)} className="capitalize">{PLATFORM_LABELS[p] ?? p}</Badge>
                            ))}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="xs"
                          loading={convertingId === idea.id}
                          onClick={() => handleConvertIdea(idea)}
                        >
                          Convert to Post
                        </Button>
                      </div>
                    ))
              }
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ APPROVALS ═══════════════════ */}
      {tab === 'approvals' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200">
            {approvalsLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-4 px-5 py-4 border-b border-slate-100 last:border-0">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-8 w-20 rounded-lg" />
                    <Skeleton className="h-8 w-20 rounded-lg" />
                  </div>
                ))
              : approvals.length === 0
                ? <EmptyState icon={CheckCircle2} title="No pending approvals" description="When posts are submitted for your review, they will appear here." compact />
                : approvals.map(approval => (
                    <div key={approval.id} className="flex items-start gap-4 px-5 py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
                        <FileText size={16} className="text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {approval.post?.title ?? truncate(approval.post?.title ?? 'Untitled post', 60)}
                        </p>
                        {approval.post && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                            Post • {(approval.post.platforms ?? []).map(p => PLATFORM_LABELS[p] ?? p).join(', ')}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600 shrink-0">
                            {initials(approval.requester?.full_name ?? approval.requester?.email ?? '?')}
                          </div>
                          <span className="text-xs text-slate-500">
                            {approval.requester?.full_name ?? approval.requester?.email ?? 'Unknown'} · {formatRelative(approval.created_at)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="primary"
                          size="xs"
                          loading={approvingId === approval.id}
                          icon={<Check size={12} />}
                          onClick={() => handleApprove(approval)}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          size="xs"
                          icon={<XIcon size={12} />}
                          onClick={() => setRejectModal({ open: true, approval, notes: '' })}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))
            }
          </div>
        </div>
      )}

      {/* ═══════════════════ IDEAS ═══════════════════ */}
      {tab === 'ideas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* Filter chips */}
            <div className="flex gap-2">
              {IDEA_FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setIdeaFilter(f.id)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-full border transition-all',
                    ideaFilter === f.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setNewIdeaModal(true)}>
              New Idea
            </Button>
          </div>

          {ideasTabLoading
            ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            : ideas.length === 0
              ? <div className="bg-white rounded-xl border border-slate-200">
                  <EmptyState icon={BrainCircuit} title="No ideas yet" description="Create a new idea or generate them with AI." action={{ label: 'New Idea', onClick: () => setNewIdeaModal(true), icon: <Plus size={14} /> }} />
                </div>
              : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ideas.map(idea => (
                    <div key={idea.id} className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3 hover:border-blue-200 hover:shadow-sm transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 flex-1">{idea.title}</p>
                        <div className="flex gap-1 shrink-0">
                          <Badge status={idea.status} dot>{idea.status}</Badge>
                          {idea.source === 'ai' && <Badge variant="violet">AI</Badge>}
                        </div>
                      </div>
                      {idea.description && (
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{idea.description}</p>
                      )}
                      {(idea.platforms ?? []).length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {(idea.platforms ?? []).map(p => (
                            <Badge key={p} variant={platformBadgeVariant(p)} className="capitalize">{PLATFORM_LABELS[p] ?? p}</Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 mt-auto pt-1">
                        <Button
                          variant="outline"
                          size="xs"
                          className="flex-1"
                          loading={convertingId === idea.id}
                          onClick={() => handleConvertIdeaInTab(idea)}
                        >
                          Convert to Post
                        </Button>
                        <button
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          onClick={() => handleDeleteIdea(idea.id)}
                          disabled={deletingIdeaId === idea.id}
                        >
                          {deletingIdeaId === idea.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
          }
        </div>
      )}

      {/* ═══════════════════ ACTIVITY ═══════════════════ */}
      {tab === 'activity' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200">
            {allActivityLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-slate-100 last:border-0">
                    <Skeleton className="w-2 h-2 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))
              : allActivity.length === 0
                ? <EmptyState icon={Activity} title="No activity yet" description="Actions taken across your workspace will appear here." compact />
                : <>
                    {allActivity.map((log, i) => (
                      <div key={`${log.id}-${i}`} className="flex items-start gap-4 px-5 py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center pt-1 shrink-0">
                          <span className={cn('w-2.5 h-2.5 rounded-full', ACTION_DOT[log.action] ?? 'bg-slate-300')} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800">
                            <span className="font-semibold">{log.profile?.full_name ?? 'System'}</span>
                            {' '}
                            <span className="capitalize">{log.action}</span>
                            {' '}
                            <span className="text-slate-500">{log.resource_type?.replace(/_/g, ' ')}</span>
                            {log.resource_id && (
                              <span className="text-slate-400 text-xs ml-1">#{log.resource_id.slice(0, 8)}</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">{formatRelative(log.created_at)}</p>
                        </div>
                      </div>
                    ))}

                    {activityHasMore && (
                      <div className="px-5 py-3 flex justify-center">
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={activityLoadingMore}
                          icon={<ChevronDown size={14} />}
                          onClick={() => {
                            const next = activityPage + 1
                            setActivityPage(next)
                            loadAllActivity(next)
                          }}
                        >
                          Load more
                        </Button>
                      </div>
                    )}
                  </>
            }
          </div>
        </div>
      )}

      {/* ═══════════════════ HEALTH ═══════════════════ */}
      {tab === 'health' && (
        <div className="space-y-5">
          {/* Progress bar */}
          {!healthLoading && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Workspace Health</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Complete these items to get the most from Caption Fox</p>
                </div>
                <span className="text-sm font-bold text-blue-600">
                  {healthItems.filter(i => i.checked).length}/{healthItems.length}
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${(healthItems.filter(i => i.checked).length / healthItems.length) * 100}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {healthItems.filter(i => i.checked).length === healthItems.length
                  ? 'Workspace fully set up — great work!'
                  : `${healthItems.length - healthItems.filter(i => i.checked).length} item${healthItems.length - healthItems.filter(i => i.checked).length !== 1 ? 's' : ''} remaining`}
              </p>
            </div>
          )}

          {/* Health checklist */}
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {healthLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4">
                    <Skeleton className="w-8 h-8 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-8 w-20 rounded-lg" />
                  </div>
                ))
              : healthItems.map(item => (
                  <div key={item.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                    <div className={cn(
                      'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                      item.checked ? 'bg-emerald-100' : 'bg-amber-50',
                    )}>
                      {item.checked
                        ? <CheckCircle2 size={16} className="text-emerald-600" />
                        : <AlertCircle size={16} className="text-amber-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium', item.checked ? 'text-slate-900' : 'text-slate-700')}>{item.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                    </div>
                    {!item.checked && (
                      <Button variant="secondary" size="xs" onClick={() => router.push(item.href)}>
                        Set up
                      </Button>
                    )}
                    {item.checked && (
                      <Badge variant="green">Done</Badge>
                    )}
                  </div>
                ))
            }
          </div>
        </div>
      )}

      {/* ═══════════════════ REJECT MODAL ═══════════════════ */}
      <Modal
        open={rejectModal.open}
        onClose={() => setRejectModal({ open: false, approval: null, notes: '' })}
        title="Reject Post"
        description="Provide a reason so the creator can improve the content."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectModal({ open: false, approval: null, notes: '' })}>Cancel</Button>
            <Button variant="danger" loading={rejecting} onClick={handleReject}>Reject Post</Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block text-xs font-medium text-slate-700">Rejection notes (optional)</label>
          <textarea
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400"
            placeholder="e.g. Caption needs to be shorter, missing CTA…"
            rows={4}
            value={rejectModal.notes}
            onChange={e => setRejectModal(prev => ({ ...prev, notes: e.target.value }))}
          />
        </div>
      </Modal>

      {/* ═══════════════════ NEW IDEA MODAL ═══════════════════ */}
      <Modal
        open={newIdeaModal}
        onClose={() => { setNewIdeaModal(false); setIdeaForm({ title: '', description: '', platforms: [], aiGenerate: false }) }}
        title="New Content Idea"
        description="Save a content idea to develop later"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNewIdeaModal(false)}>Cancel</Button>
            <Button
              variant={ideaForm.aiGenerate ? 'ai' : 'primary'}
              loading={ideaSubmitting}
              icon={ideaForm.aiGenerate ? <BrainCircuit size={14} /> : <Plus size={14} />}
              onClick={handleCreateIdea}
              disabled={!ideaForm.title.trim()}
            >
              {ideaGenerating ? 'Generating…' : ideaForm.aiGenerate ? 'Generate & Save' : 'Save Idea'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400"
              placeholder="e.g. Behind-the-scenes product reel"
              value={ideaForm.title}
              onChange={e => setIdeaForm(p => ({ ...p, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Description</label>
            <textarea
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400"
              placeholder="Describe the content idea…"
              rows={3}
              value={ideaForm.description}
              onChange={e => setIdeaForm(p => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Platforms</label>
            <div className="flex flex-wrap gap-2">
              {ALL_PLATFORMS.map(p => {
                const selected = ideaForm.platforms.includes(p)
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setIdeaForm(prev => ({
                      ...prev,
                      platforms: selected ? prev.platforms.filter(x => x !== p) : [...prev.platforms, p],
                    }))}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-full border transition-all capitalize',
                      selected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
                    )}
                  >
                    {PLATFORM_LABELS[p] ?? p}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-violet-50 rounded-lg border border-violet-100">
            <button
              type="button"
              onClick={() => setIdeaForm(p => ({ ...p, aiGenerate: !p.aiGenerate }))}
              className={cn(
                'w-10 h-6 rounded-full transition-all relative shrink-0',
                ideaForm.aiGenerate ? 'bg-violet-600' : 'bg-slate-200',
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all',
                ideaForm.aiGenerate ? 'left-[18px]' : 'left-0.5',
              )} />
            </button>
            <div>
              <p className="text-xs font-semibold text-violet-800">AI Generate</p>
              <p className="text-xs text-violet-600">Let Fox expand this idea into a full description</p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
