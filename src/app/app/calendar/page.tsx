'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, ChevronLeft, ChevronRight, Calendar,
  Download, Zap, Clock, AlertCircle, CheckCircle2, BrainCircuit,
  RefreshCcw, Edit2, Trash2, Send, Loader2, Check, X as XIcon, Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import BulkImportModal from '@/components/ui/BulkImportModal'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, truncate } from '@/lib/utils'
import { PLATFORM_LABELS } from '@/lib/constants'
import type { ContentPost } from '@/types/database'

// ─── Types ───────────────────────────────────────────────────────────────────

type CalView = 'month' | 'week' | 'list'

interface NewPostForm {
  step: 1 | 2 | 3 | 4
  platforms: string[]
  caption: string
  title: string
  scheduled_date: string
  scheduled_time: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CAL_TABS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'published', label: 'Published' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'needs_approval', label: 'Needs Approval' },
  { id: 'failed', label: 'Failed' },
  { id: 'queue', label: 'Publishing Queue' },
]

const PLATFORMS = ['all', 'instagram', 'tiktok', 'linkedin', 'facebook', 'x', 'youtube']
const STATUSES = ['all', 'draft', 'scheduled', 'published', 'failed']
const ALL_PLATFORMS = ['instagram', 'tiktok', 'linkedin', 'facebook', 'x', 'youtube']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEK_DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const STATUS_VARIANT: Record<string, 'blue' | 'green' | 'amber' | 'red' | 'slate' | 'violet'> = {
  scheduled: 'blue',
  published: 'green',
  draft: 'slate',
  failed: 'red',
  pending_approval: 'amber',
  approved: 'green',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1 // Mon = 0
}

function platformColor(p: string): string {
  const map: Record<string, string> = {
    instagram: 'bg-violet-400',
    tiktok: 'bg-slate-700',
    linkedin: 'bg-blue-600',
    facebook: 'bg-blue-500',
    x: 'bg-slate-800',
    youtube: 'bg-red-500',
  }
  return map[p] ?? 'bg-slate-400'
}

function getWeekDates(base: Date): Date[] {
  const monday = new Date(base)
  const day = monday.getDay()
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

// ─── Post Status Table ────────────────────────────────────────────────────────

function PostTable({
  posts,
  loading,
  emptyTitle,
  emptyDesc,
  showApproveReject,
  showRetry,
  onApprove,
  onReject,
  onRetry,
  onDelete,
  onEdit,
}: {
  posts: ContentPost[]
  loading: boolean
  emptyTitle: string
  emptyDesc: string
  showApproveReject?: boolean
  showRetry?: boolean
  onApprove?: (post: ContentPost) => void
  onReject?: (post: ContentPost) => void
  onRetry?: (post: ContentPost) => void
  onDelete?: (post: ContentPost) => void
  onEdit?: (post: ContentPost) => void
}) {
  const router = useRouter()

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 last:border-0">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200">
        <EmptyState icon={Calendar} title={emptyTitle} description={emptyDesc} compact />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Date / Time</th>
            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Caption</th>
            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Platforms</th>
            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Status</th>
            <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {posts.map(post => (
            <tr key={post.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 whitespace-nowrap">
                <p className="text-sm font-medium text-slate-900">{post.scheduled_at ? formatDate(post.scheduled_at) : post.published_at ? formatDate(post.published_at) : '—'}</p>
                {post.scheduled_at && (
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock size={10} />
                    {new Date(post.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </td>
              <td className="px-4 py-3">
                <p className="text-sm text-slate-700 max-w-xs">{truncate(post.title ?? 'Untitled post', 70)}</p>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1 flex-wrap">
                  {(post.platforms ?? []).slice(0, 3).map(p => (
                    <Badge key={p} variant="blue" className="capitalize">{PLATFORM_LABELS[p] ?? p}</Badge>
                  ))}
                  {(post.platforms ?? []).length > 3 && (
                    <Badge variant="slate">+{(post.platforms ?? []).length - 3}</Badge>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge variant={STATUS_VARIANT[post.status] ?? 'slate'} dot>{post.status.replace(/_/g, ' ')}</Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1 justify-end">
                  {showApproveReject && onApprove && (
                    <Button variant="primary" size="xs" icon={<Check size={11} />} onClick={() => onApprove(post)}>Approve</Button>
                  )}
                  {showApproveReject && onReject && (
                    <Button variant="danger" size="xs" icon={<XIcon size={11} />} onClick={() => onReject(post)}>Reject</Button>
                  )}
                  {showRetry && onRetry && (
                    <Button variant="secondary" size="xs" icon={<RefreshCcw size={11} />} onClick={() => onRetry(post)}>Retry</Button>
                  )}
                  {onEdit && (
                    <button className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" onClick={() => onEdit(post)}>
                      <Edit2 size={13} />
                    </button>
                  )}
                  {onDelete && (
                    <button className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" onClick={() => onDelete(post)}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter()

  // Workspace / auth
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [bootstrapping, setBootstrapping] = useState(true)

  // Calendar state
  const [tab, setTab] = useState('calendar')
  const [calView, setCalView] = useState<CalView>('month')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentDate, setCurrentDate] = useState(new Date())

  // Posts per tab
  const [calendarPosts, setCalendarPosts] = useState<ContentPost[]>([])
  const [calendarLoading, setCalendarLoading] = useState(true)
  const [scheduledPosts, setScheduledPosts] = useState<ContentPost[]>([])
  const [scheduledLoading, setScheduledLoading] = useState(true)
  const [publishedPosts, setPublishedPosts] = useState<ContentPost[]>([])
  const [publishedLoading, setPublishedLoading] = useState(true)
  const [draftPosts, setDraftPosts] = useState<ContentPost[]>([])
  const [draftsLoading, setDraftsLoading] = useState(true)
  const [approvalPosts, setApprovalPosts] = useState<ContentPost[]>([])
  const [approvalLoading, setApprovalLoading] = useState(true)
  const [failedPosts, setFailedPosts] = useState<ContentPost[]>([])
  const [failedLoading, setFailedLoading] = useState(true)
  const [queuePosts, setQueuePosts] = useState<ContentPost[]>([])
  const [queueLoading, setQueueLoading] = useState(true)

  // Post detail modal
  const [detailPost, setDetailPost] = useState<ContentPost | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [publishingNow, setPublishingNow] = useState(false)
  const [deletingPost, setDeletingPost] = useState(false)

  // Reject modal (needs_approval tab)
  const [rejectTarget, setRejectTarget] = useState<ContentPost | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [rejecting, setRejecting] = useState(false)

  // New post modal (multi-step)
  const [newPostModal, setNewPostModal] = useState(false)
  const [newPost, setNewPost] = useState<NewPostForm>({
    step: 1, platforms: [], caption: '', title: '', scheduled_date: '', scheduled_time: '',
  })
  const [creatingPost, setCreatingPost] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [newPostError, setNewPostError] = useState<string | null>(null)

  // Retry loading
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  // Bulk import modal
  const [showBulkImport, setShowBulkImport] = useState(false)

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  useEffect(() => {
    async function bootstrap() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setBootstrapping(false); return }
        const { data } = await supabase.from('workspace_members')
          .select('workspace_id').eq('user_id', user.id)
          .order('created_at', { ascending: true }).limit(1).single()
        if (data?.workspace_id) setWorkspaceId(data.workspace_id)
      } catch { /* silent */ } finally {
        setBootstrapping(false)
      }
    }
    bootstrap()
  }, [])

  // ── Calendar posts (changes with month / filters) ─────────────────────────

  const loadCalendarPosts = useCallback(async () => {
    if (!workspaceId) return
    setCalendarLoading(true)
    try {
      const supabase = createClient()
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()

      // For week view, load the full week range; month view loads full month
      let start: Date, end: Date
      if (calView === 'week') {
        const weekDates = getWeekDates(currentDate)
        start = weekDates[0]
        end = new Date(weekDates[6]); end.setHours(23, 59, 59, 999)
      } else {
        start = new Date(year, month, 1)
        end = new Date(year, month + 1, 0, 23, 59, 59)
      }

      let query = supabase.from('content_posts').select('*')
        .eq('workspace_id', workspaceId)
        .gte('scheduled_at', start.toISOString())
        .lte('scheduled_at', end.toISOString())
        .order('scheduled_at', { ascending: true })

      if (platformFilter !== 'all') query = query.contains('platforms', [platformFilter])
      if (statusFilter !== 'all') query = query.eq('status', statusFilter)

      const { data } = await query
      setCalendarPosts(data ?? [])
    } catch { setCalendarPosts([]) } finally { setCalendarLoading(false) }
  }, [workspaceId, currentDate, calView, platformFilter, statusFilter])

  const loadTabPosts = useCallback(async (status: string, setter: (p: ContentPost[]) => void, loadingSetter: (b: boolean) => void) => {
    if (!workspaceId) return
    loadingSetter(true)
    try {
      const supabase = createClient()
      const { data } = await supabase.from('content_posts').select('*')
        .eq('workspace_id', workspaceId).eq('status', status)
        .order('scheduled_at', { ascending: true })
      setter(data ?? [])
    } catch { setter([]) } finally { loadingSetter(false) }
  }, [workspaceId])

  const loadQueuePosts = useCallback(async () => {
    if (!workspaceId) return
    setQueueLoading(true)
    try {
      const supabase = createClient()
      // Try publishing_queue table first, fall back to scheduled posts
      const { data, error } = await supabase.from('publishing_queue' as any).select('*')
        .eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(50)
      if (error) {
        // Table may not exist — show scheduled posts as queue fallback
        const { data: fallback } = await supabase.from('content_posts').select('*')
          .eq('workspace_id', workspaceId).eq('status', 'scheduled')
          .order('scheduled_at', { ascending: true })
        setQueuePosts(fallback ?? [])
      } else {
        setQueuePosts(data ?? [])
      }
    } catch { setQueuePosts([]) } finally { setQueueLoading(false) }
  }, [workspaceId])

  useEffect(() => {
    if (workspaceId) loadCalendarPosts()
  }, [workspaceId, loadCalendarPosts])

  useEffect(() => {
    if (!workspaceId) return
    if (tab === 'scheduled') loadTabPosts('scheduled', setScheduledPosts, setScheduledLoading)
    if (tab === 'published') loadTabPosts('published', setPublishedPosts, setPublishedLoading)
    if (tab === 'drafts') loadTabPosts('draft', setDraftPosts, setDraftsLoading)
    if (tab === 'needs_approval') loadTabPosts('pending_approval', setApprovalPosts, setApprovalLoading)
    if (tab === 'failed') loadTabPosts('failed', setFailedPosts, setFailedLoading)
    if (tab === 'queue') loadQueuePosts()
  }, [tab, workspaceId])

  // ── Computed calendar grid ────────────────────────────────────────────────

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = new Date()

  const postsByDay: Record<number, ContentPost[]> = {}
  calendarPosts.forEach(p => {
    if (p.scheduled_at) {
      const d = new Date(p.scheduled_at).getDate()
      if (!postsByDay[d]) postsByDay[d] = []
      postsByDay[d].push(p)
    }
  })

  const weekDates = getWeekDates(currentDate)
  const postsByWeekDay: Record<string, ContentPost[]> = {}
  calendarPosts.forEach(p => {
    if (p.scheduled_at) {
      const key = new Date(p.scheduled_at).toDateString()
      if (!postsByWeekDay[key]) postsByWeekDay[key] = []
      postsByWeekDay[key].push(p)
    }
  })

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleRetry(post: ContentPost) {
    setRetryingId(post.id)
    try {
      const supabase = createClient()
      await supabase.from('content_posts').update({ status: 'scheduled' }).eq('id', post.id)
      setFailedPosts(prev => prev.filter(p => p.id !== post.id))
    } catch { /* silent */ } finally { setRetryingId(null) }
  }

  async function handleApprovePost(post: ContentPost) {
    setApprovingId(post.id)
    try {
      const supabase = createClient()
      await supabase.from('content_posts').update({ status: 'approved' }).eq('id', post.id)
      await supabase.from('approvals').update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('post_id', post.id).eq('status', 'pending')
      setApprovalPosts(prev => prev.filter(p => p.id !== post.id))
    } catch { /* silent */ } finally { setApprovingId(null) }
  }

  async function handleRejectPost() {
    if (!rejectTarget) return
    setRejecting(true)
    try {
      const supabase = createClient()
      await supabase.from('content_posts').update({ status: 'rejected' }).eq('id', rejectTarget.id)
      await supabase.from('approvals').update({ status: 'rejected', notes: rejectNotes, reviewed_at: new Date().toISOString() })
        .eq('post_id', rejectTarget.id).eq('status', 'pending')
      setApprovalPosts(prev => prev.filter(p => p.id !== rejectTarget.id))
      setRejectTarget(null)
      setRejectNotes('')
    } catch { /* silent */ } finally { setRejecting(false) }
  }

  async function handlePublishNow() {
    if (!detailPost) return
    setPublishingNow(true)
    try {
      const supabase = createClient()
      await supabase.from('content_posts').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', detailPost.id)
      setDetailPost(prev => prev ? { ...prev, status: 'published' } : null)
      loadCalendarPosts()
    } catch { /* silent */ } finally { setPublishingNow(false) }
  }

  async function handleDeletePost(post: ContentPost) {
    setDeletingPost(true)
    try {
      const supabase = createClient()
      await supabase.from('content_posts').delete().eq('id', post.id)
      setDetailPost(null)
      loadCalendarPosts()
      if (tab === 'scheduled') setScheduledPosts(prev => prev.filter(p => p.id !== post.id))
      if (tab === 'drafts') setDraftPosts(prev => prev.filter(p => p.id !== post.id))
    } catch { /* silent */ } finally { setDeletingPost(false) }
  }

  async function handleCreatePost() {
    if (!workspaceId) return
    if (newPost.platforms.length === 0) { setNewPostError('Select at least one platform'); return }
    if (!newPost.caption.trim()) { setNewPostError('Caption is required'); return }
    if (!newPost.scheduled_date || !newPost.scheduled_time) { setNewPostError('Schedule date and time are required'); return }

    setNewPostError(null)
    setCreatingPost(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const scheduledAt = new Date(`${newPost.scheduled_date}T${newPost.scheduled_time}`).toISOString()

      const { error } = await supabase.from('content_posts').insert({
        workspace_id: workspaceId,
        platforms: newPost.platforms,
        title: newPost.title || newPost.caption.slice(0, 80),
        status: 'scheduled',
        post_type: 'post',
        scheduled_at: scheduledAt,
        created_by: user.id,
      })
      if (error) throw error

      setNewPostModal(false)
      setNewPost({ step: 1, platforms: [], caption: '', title: '', scheduled_date: '', scheduled_time: '' })
      loadCalendarPosts()
    } catch (e: any) {
      setNewPostError(e.message ?? 'Failed to create post')
    } finally {
      setCreatingPost(false)
    }
  }

  async function handleAiGenerate() {
    if (!newPost.caption.trim()) { setNewPostError('Enter a caption prompt first'); return }
    setAiGenerating(true)
    setNewPostError(null)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'caption', prompt: newPost.caption, platforms: newPost.platforms }),
      })
      if (res.ok) {
        const json = await res.json()
        if (json.content) setNewPost(p => ({ ...p, caption: json.content }))
      }
    } catch { /* silent */ } finally { setAiGenerating(false) }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="Calendar" subtitle="Plan, schedule and manage all your content">
        <Button variant="ghost" size="sm" icon={<Download size={14} />}>Export</Button>
        <Button variant="secondary" size="sm" icon={<Upload size={14} />} onClick={() => setShowBulkImport(true)}>Bulk Import</Button>
        <Button variant="secondary" size="sm" icon={<Zap size={14} />}>Bulk Schedule</Button>
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setNewPostModal(true)}>New Post</Button>
      </PageHeader>

      <Tabs tabs={CAL_TABS} active={tab} onChange={setTab} className="mb-6" />

      {/* ═══════════════ CALENDAR TAB ═══════════════ */}
      {tab === 'calendar' && (
        <div className="space-y-4">
          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <button
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
                onClick={() => {
                  if (calView === 'week') {
                    const d = new Date(currentDate)
                    d.setDate(d.getDate() - 7)
                    setCurrentDate(d)
                  } else {
                    setCurrentDate(new Date(year, month - 1, 1))
                  }
                }}
              ><ChevronLeft size={15} /></button>
              <span className="text-sm font-semibold text-slate-900 min-w-[160px] text-center">
                {calView === 'week'
                  ? `${weekDates[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${weekDates[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : `${MONTH_NAMES[month]} ${year}`}
              </span>
              <button
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
                onClick={() => {
                  if (calView === 'week') {
                    const d = new Date(currentDate)
                    d.setDate(d.getDate() + 7)
                    setCurrentDate(d)
                  } else {
                    setCurrentDate(new Date(year, month + 1, 1))
                  }
                }}
              ><ChevronRight size={15} /></button>
              <button
                className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                onClick={() => setCurrentDate(new Date())}
              >Today</button>
            </div>

            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
              {(['month', 'week', 'list'] as CalView[]).map(v => (
                <button
                  key={v}
                  onClick={() => setCalView(v)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all',
                    calView === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                  )}
                >{v}</button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-medium text-slate-500">Platform:</span>
            {PLATFORMS.map(p => (
              <button
                key={p}
                onClick={() => setPlatformFilter(p)}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-full border transition-all capitalize',
                  platformFilter === p ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
                )}
              >{p === 'all' ? 'All' : PLATFORM_LABELS[p] ?? p}</button>
            ))}
            <span className="text-xs font-medium text-slate-500 ml-4">Status:</span>
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-full border transition-all capitalize',
                  statusFilter === s ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
                )}
              >{s}</button>
            ))}
          </div>

          {/* ── MONTH VIEW ── */}
          {calView === 'month' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-7 border-b border-slate-100">
                {WEEK_DAYS_SHORT.map(d => (
                  <div key={d} className="py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`blank-${i}`} className="min-h-[110px] bg-slate-50/40 border-b border-r border-slate-100" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1
                  const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === dayNum
                  const dayPosts = postsByDay[dayNum] ?? []
                  const col = (firstDay + i) % 7
                  const isWeekend = col >= 5

                  return (
                    <div
                      key={dayNum}
                      className={cn(
                        'min-h-[110px] p-2 border-b border-r border-slate-100 transition-colors hover:bg-blue-50/20 cursor-pointer',
                        isWeekend && 'bg-slate-50/30',
                      )}
                      onClick={() => {
                        const d = new Date(year, month, dayNum)
                        setNewPost(p => ({
                          ...p,
                          scheduled_date: d.toISOString().split('T')[0],
                        }))
                        setNewPostModal(true)
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn(
                          'w-6 h-6 flex items-center justify-center text-xs font-semibold rounded-full',
                          isToday ? 'bg-blue-600 text-white' : 'text-slate-600',
                        )}>{dayNum}</span>
                        {dayPosts.length > 0 && (
                          <span className="text-xs text-blue-500 font-semibold">{dayPosts.length}</span>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {dayPosts.slice(0, 3).map(post => (
                          <div
                            key={post.id}
                            className={cn(
                              'text-xs px-1.5 py-0.5 rounded truncate flex items-center gap-1',
                              post.status === 'published' ? 'bg-emerald-100 text-emerald-700'
                                : post.status === 'failed' ? 'bg-red-100 text-red-700'
                                : post.status === 'draft' ? 'bg-slate-100 text-slate-600'
                                : 'bg-blue-100 text-blue-700',
                            )}
                            onClick={e => { e.stopPropagation(); setDetailPost(post) }}
                          >
                            <span className="flex gap-0.5 shrink-0">
                              {(post.platforms ?? []).slice(0, 2).map(p => (
                                <span key={p} className={cn('w-1.5 h-1.5 rounded-full', platformColor(p))} />
                              ))}
                            </span>
                            <span className="truncate">{post.title ?? 'Post'}</span>
                          </div>
                        ))}
                        {dayPosts.length > 3 && (
                          <p className="text-xs text-slate-400 pl-1">+{dayPosts.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── WEEK VIEW ── */}
          {calView === 'week' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-7 border-b border-slate-100">
                {weekDates.map((d, i) => {
                  const isTd = d.toDateString() === today.toDateString()
                  return (
                    <div key={i} className={cn('py-3 text-center border-r border-slate-100 last:border-0', isTd && 'bg-blue-50')}>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{WEEK_DAYS_SHORT[i]}</p>
                      <p className={cn('text-sm font-bold mt-0.5', isTd ? 'text-blue-600' : 'text-slate-700')}>
                        {d.getDate()}
                      </p>
                    </div>
                  )
                })}
              </div>
              <div className="grid grid-cols-7 min-h-[280px]">
                {weekDates.map((d, i) => {
                  const key = d.toDateString()
                  const dayPosts = postsByWeekDay[key] ?? []
                  const isTd = d.toDateString() === today.toDateString()
                  return (
                    <div
                      key={i}
                      className={cn(
                        'p-2 border-r border-slate-100 last:border-0 min-h-[280px] cursor-pointer hover:bg-slate-50/50 transition-colors',
                        isTd && 'bg-blue-50/20',
                      )}
                      onClick={() => {
                        setNewPost(p => ({ ...p, scheduled_date: d.toISOString().split('T')[0] }))
                        setNewPostModal(true)
                      }}
                    >
                      {calendarLoading
                        ? <Skeleton className="h-8 w-full" />
                        : dayPosts.length === 0
                          ? <div className="h-full flex items-center justify-center">
                              <Plus size={16} className="text-slate-300" />
                            </div>
                          : <div className="space-y-1">
                              {dayPosts.map(post => (
                                <div
                                  key={post.id}
                                  className={cn(
                                    'text-xs px-1.5 py-1 rounded truncate cursor-pointer',
                                    post.status === 'published' ? 'bg-emerald-100 text-emerald-700'
                                      : post.status === 'failed' ? 'bg-red-100 text-red-700'
                                      : 'bg-blue-100 text-blue-700',
                                  )}
                                  onClick={e => { e.stopPropagation(); setDetailPost(post) }}
                                >
                                  <p className="truncate font-medium">{post.title ?? 'Post'}</p>
                                  {post.scheduled_at && (
                                    <p className="text-xs opacity-75">{new Date(post.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                      }
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── LIST VIEW ── */}
          {calView === 'list' && (
            <PostTable
              posts={calendarPosts}
              loading={calendarLoading}
              emptyTitle="No posts this month"
              emptyDesc="Create a post to see it here."
              onEdit={post => setDetailPost(post)}
              onDelete={handleDeletePost}
            />
          )}
        </div>
      )}

      {/* ═══════════════ SCHEDULED TAB ═══════════════ */}
      {tab === 'scheduled' && (
        <PostTable
          posts={scheduledPosts}
          loading={scheduledLoading}
          emptyTitle="No scheduled posts"
          emptyDesc="Posts you schedule will appear here."
          onEdit={post => setDetailPost(post)}
          onDelete={post => { setScheduledPosts(prev => prev.filter(p => p.id !== post.id)) }}
        />
      )}

      {/* ═══════════════ PUBLISHED TAB ═══════════════ */}
      {tab === 'published' && (
        <div className="space-y-4">
          <PostTable
            posts={publishedPosts}
            loading={publishedLoading}
            emptyTitle="No published posts yet"
            emptyDesc="Posts you publish will appear here with basic analytics."
            onEdit={post => setDetailPost(post)}
          />
          {!publishedLoading && publishedPosts.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Analytics Preview</h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Total Published', value: publishedPosts.length, color: 'text-blue-600' },
                  { label: 'This Month', value: publishedPosts.filter(p => p.published_at && new Date(p.published_at).getMonth() === today.getMonth()).length, color: 'text-emerald-600' },
                  { label: 'Platforms Used', value: new Set(publishedPosts.flatMap(p => p.platforms ?? [])).size, color: 'text-violet-600' },
                ].map(stat => (
                  <div key={stat.label} className="text-center">
                    <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ DRAFTS TAB ═══════════════ */}
      {tab === 'drafts' && (
        <PostTable
          posts={draftPosts}
          loading={draftsLoading}
          emptyTitle="No drafts"
          emptyDesc="Draft posts will appear here."
          onEdit={post => setDetailPost(post)}
          onDelete={post => setDraftPosts(prev => prev.filter(p => p.id !== post.id))}
        />
      )}

      {/* ═══════════════ NEEDS APPROVAL TAB ═══════════════ */}
      {tab === 'needs_approval' && (
        <PostTable
          posts={approvalPosts}
          loading={approvalLoading}
          emptyTitle="No posts awaiting approval"
          emptyDesc="Posts submitted for review will appear here."
          showApproveReject
          onApprove={handleApprovePost}
          onReject={post => { setRejectTarget(post); setRejectNotes('') }}
        />
      )}

      {/* ═══════════════ FAILED TAB ═══════════════ */}
      {tab === 'failed' && (
        <PostTable
          posts={failedPosts}
          loading={failedLoading}
          emptyTitle="No failed posts"
          emptyDesc="All your scheduled posts are healthy."
          showRetry
          onRetry={handleRetry}
          onDelete={post => setFailedPosts(prev => prev.filter(p => p.id !== post.id))}
        />
      )}

      {/* ═══════════════ PUBLISHING QUEUE TAB ═══════════════ */}
      {tab === 'queue' && (
        <div className="space-y-4">
          {queueLoading
            ? <div className="bg-white rounded-xl border border-slate-200">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 last:border-0">
                    <div className="space-y-2 flex-1"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/4" /></div>
                  </div>
                ))}
              </div>
            : queuePosts.length === 0
              ? <div className="bg-white rounded-xl border border-slate-200">
                  <EmptyState icon={Calendar} title="Publishing queue empty" description="Posts queued for publishing will appear here." compact />
                </div>
              : <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {queuePosts.length} post{queuePosts.length !== 1 ? 's' : ''} in queue
                    </p>
                  </div>
                  {queuePosts.map((post, i) => (
                    <div key={post.id} className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <span className="text-xs font-bold text-slate-400 w-5 text-center shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{post.title ?? 'Untitled'}</p>
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                          <Clock size={10} />
                          {post.scheduled_at ? formatDate(post.scheduled_at) : '—'}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {(post.platforms ?? []).slice(0, 3).map(p => (
                          <Badge key={p} variant="blue" className="capitalize">{PLATFORM_LABELS[p] ?? p}</Badge>
                        ))}
                      </div>
                      <Badge variant={STATUS_VARIANT[post.status] ?? 'slate'} dot>{post.status.replace(/_/g, ' ')}</Badge>
                    </div>
                  ))}
                </div>
          }
        </div>
      )}

      {/* ═══════════════ POST DETAIL MODAL ═══════════════ */}
      <Modal
        open={!!detailPost}
        onClose={() => setDetailPost(null)}
        title={detailPost?.title ?? 'Post Details'}
        description={detailPost ? `${(detailPost.platforms ?? []).map(p => PLATFORM_LABELS[p] ?? p).join(', ')} · ${detailPost.post_type}` : undefined}
        size="lg"
        footer={
          <div className="flex gap-2 w-full">
            <button
              className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              onClick={() => detailPost && handleDeletePost(detailPost)}
              disabled={deletingPost}
            >
              {deletingPost ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            </button>
            <div className="flex-1" />
            <Button variant="secondary" onClick={() => detailPost && router.push(`/app/studio/${detailPost.id}`)}>
              <Edit2 size={14} className="mr-1" /> Edit
            </Button>
            {detailPost?.status === 'approved' && (
              <Button variant="primary" loading={publishingNow} icon={<Send size={14} />} onClick={handlePublishNow}>
                Publish Now
              </Button>
            )}
            {detailPost?.status === 'scheduled' && (
              <Button variant="primary" loading={publishingNow} icon={<Send size={14} />} onClick={handlePublishNow}>
                Publish Now
              </Button>
            )}
          </div>
        }
      >
        {detailPost && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Status</p>
                <Badge variant={STATUS_VARIANT[detailPost.status] ?? 'slate'} dot className="text-sm px-2.5 py-1">
                  {detailPost.status.replace(/_/g, ' ')}
                </Badge>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Scheduled</p>
                <p className="text-sm font-medium text-slate-900">
                  {detailPost.scheduled_at ? `${formatDate(detailPost.scheduled_at)} at ${new Date(detailPost.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not scheduled'}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">Platforms</p>
              <div className="flex gap-1.5 flex-wrap">
                {(detailPost.platforms ?? []).map(p => (
                  <Badge key={p} variant="blue" className="capitalize">{PLATFORM_LABELS[p] ?? p}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">Post Type</p>
              <Badge variant="slate" className="capitalize">{detailPost.post_type}</Badge>
            </div>
            {detailPost.published_at && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Published</p>
                <p className="text-sm text-slate-700">{formatDate(detailPost.published_at)}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ═══════════════ REJECT POST MODAL ═══════════════ */}
      <Modal
        open={!!rejectTarget}
        onClose={() => { setRejectTarget(null); setRejectNotes('') }}
        title="Reject Post"
        description="Provide feedback so the creator can improve the content."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setRejectTarget(null); setRejectNotes('') }}>Cancel</Button>
            <Button variant="danger" loading={rejecting} onClick={handleRejectPost}>Reject Post</Button>
          </>
        }
      >
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Rejection notes (optional)</label>
          <textarea
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400"
            placeholder="e.g. Caption too long, missing CTA…"
            rows={4}
            value={rejectNotes}
            onChange={e => setRejectNotes(e.target.value)}
          />
        </div>
      </Modal>

      {/* ═══════════════ BULK IMPORT MODAL ═══════════════ */}
      {workspaceId && (
        <BulkImportModal
          isOpen={showBulkImport}
          onClose={() => setShowBulkImport(false)}
          workspaceId={workspaceId}
          onImported={(count) => {
            setShowBulkImport(false)
            loadCalendarPosts()
            if (tab === 'drafts') loadTabPosts('draft', setDraftPosts, setDraftsLoading)
          }}
        />
      )}

      {/* ═══════════════ NEW POST MODAL (multi-step) ═══════════════ */}
      <Modal
        open={newPostModal}
        onClose={() => {
          setNewPostModal(false)
          setNewPost({ step: 1, platforms: [], caption: '', title: '', scheduled_date: '', scheduled_time: '' })
          setNewPostError(null)
        }}
        title={`New Post — Step ${newPost.step} of 4`}
        description={
          newPost.step === 1 ? 'Choose platforms to post on'
            : newPost.step === 2 ? 'Write your caption'
            : newPost.step === 3 ? 'Pick a date and time'
            : 'Review and confirm'
        }
        size="lg"
        footer={
          <div className="flex gap-2 w-full">
            {newPost.step > 1 && (
              <Button variant="secondary" onClick={() => setNewPost(p => ({ ...p, step: (p.step - 1) as any }))}>Back</Button>
            )}
            <div className="flex-1" />
            {newPost.step < 4
              ? <Button
                  variant="primary"
                  onClick={() => {
                    setNewPostError(null)
                    if (newPost.step === 1 && newPost.platforms.length === 0) { setNewPostError('Select at least one platform'); return }
                    if (newPost.step === 2 && !newPost.caption.trim()) { setNewPostError('Caption is required'); return }
                    if (newPost.step === 3 && (!newPost.scheduled_date || !newPost.scheduled_time)) { setNewPostError('Date and time are required'); return }
                    setNewPost(p => ({ ...p, step: (p.step + 1) as any }))
                  }}
                >
                  Continue
                </Button>
              : <Button variant="primary" loading={creatingPost} onClick={handleCreatePost}>Schedule Post</Button>
            }
          </div>
        }
      >
        <div className="space-y-5">
          {/* Step indicator */}
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className={cn('h-1.5 flex-1 rounded-full transition-colors', s <= newPost.step ? 'bg-blue-600' : 'bg-slate-200')} />
            ))}
          </div>

          {newPostError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={14} /> {newPostError}
            </div>
          )}

          {/* Step 1: Platforms */}
          {newPost.step === 1 && (
            <div>
              <p className="text-xs font-medium text-slate-700 mb-3">Select one or more platforms</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALL_PLATFORMS.map(p => {
                  const selected = newPost.platforms.includes(p)
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewPost(prev => ({
                        ...prev,
                        platforms: selected ? prev.platforms.filter(x => x !== p) : [...prev.platforms, p],
                      }))}
                      className={cn(
                        'px-3 py-2.5 text-sm font-medium rounded-xl border transition-all flex items-center gap-2',
                        selected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300',
                      )}
                    >
                      {selected && <Check size={14} />}
                      <span className="capitalize">{PLATFORM_LABELS[p] ?? p}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 2: Caption */}
          {newPost.step === 2 && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Title (optional)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400"
                  placeholder="Post title for internal reference"
                  value={newPost.title}
                  onChange={e => setNewPost(p => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-700">Caption <span className="text-red-500">*</span></label>
                  <Button
                    variant="ghost"
                    size="xs"
                    icon={aiGenerating ? <Loader2 size={12} className="animate-spin" /> : <BrainCircuit size={12} />}
                    onClick={handleAiGenerate}
                    disabled={aiGenerating}
                  >
                    {aiGenerating ? 'Generating…' : 'AI Generate'}
                  </Button>
                </div>
                <textarea
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400"
                  placeholder="Write your caption here…"
                  rows={6}
                  value={newPost.caption}
                  onChange={e => setNewPost(p => ({ ...p, caption: e.target.value }))}
                />
                <p className="text-xs text-slate-400 mt-1">{newPost.caption.length} characters</p>
              </div>
            </div>
          )}

          {/* Step 3: Schedule */}
          {newPost.step === 3 && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  value={newPost.scheduled_date}
                  onChange={e => setNewPost(p => ({ ...p, scheduled_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Time <span className="text-red-500">*</span></label>
                <input
                  type="time"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  value={newPost.scheduled_time}
                  onChange={e => setNewPost(p => ({ ...p, scheduled_time: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {newPost.step === 4 && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Platforms</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {newPost.platforms.map(p => (
                      <Badge key={p} variant="blue" className="capitalize">{PLATFORM_LABELS[p] ?? p}</Badge>
                    ))}
                  </div>
                </div>
                {newPost.title && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Title</p>
                    <p className="text-sm text-slate-900">{newPost.title}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Caption</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-5">{newPost.caption}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Scheduled for</p>
                  <p className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                    <Clock size={13} className="text-blue-500" />
                    {newPost.scheduled_date && newPost.scheduled_time
                      ? `${formatDate(newPost.scheduled_date)} at ${newPost.scheduled_time}`
                      : 'Not set'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
