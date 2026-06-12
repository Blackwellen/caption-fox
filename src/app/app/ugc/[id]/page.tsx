'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Edit2, Plus, Copy, Check, CheckCircle, XCircle, RotateCcw,
  ClipboardList, Users, Upload, Wand2, BarChart2, ExternalLink, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton, SkeletonRow } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate } from '@/lib/utils'
import type { UgcBrief, UgcCreator, UgcSubmission, Campaign } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BriefWithCampaign extends UgcBrief {
  campaign?: Pick<Campaign, 'id' | 'name'> | null
}

interface SubmissionWithCreator extends UgcSubmission {
  creator?: Pick<UgcCreator, 'id' | 'name' | 'instagram_handle' | 'tiktok_handle'> | null
}

interface EditBriefForm {
  title: string
  goal: string
  instructions: string
  deliverables: string
  due_date: string
  status: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DETAIL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'creators', label: 'Creators' },
  { id: 'submissions', label: 'Submissions' },
  { id: 'scripts', label: 'Scripts' },
  { id: 'performance', label: 'Performance' },
]

const PLATFORM_OPTIONS = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram Reels' },
  { value: 'youtube', label: 'YouTube Shorts' },
  { value: 'all', label: 'All Platforms' },
]

const TONE_OPTIONS = [
  { value: 'authentic', label: 'Authentic & Raw' },
  { value: 'energetic', label: 'High Energy' },
  { value: 'educational', label: 'Educational' },
  { value: 'testimonial', label: 'Testimonial' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'comedic', label: 'Comedic' },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UGCBriefDetailPage() {
  const params = useParams()
  const router = useRouter()
  const briefId = params.id as string

  // Core data
  const [brief, setBrief] = useState<BriefWithCampaign | null>(null)
  const [creators, setCreators] = useState<UgcCreator[]>([])
  const [allCreators, setAllCreators] = useState<UgcCreator[]>([])
  const [submissions, setSubmissions] = useState<SubmissionWithCreator[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Tab
  const [tab, setTab] = useState('overview')

  // Edit brief modal
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<EditBriefForm>({
    title: '', goal: '', instructions: '', deliverables: '', due_date: '', status: 'draft',
  })
  const [editSaving, setEditSaving] = useState(false)

  // Add creator modal
  const [addCreatorOpen, setAddCreatorOpen] = useState(false)
  const [selectedCreatorId, setSelectedCreatorId] = useState('')
  const [addCreatorSaving, setAddCreatorSaving] = useState(false)

  // Submission actions
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [revisionModalId, setRevisionModalId] = useState<string | null>(null)
  const [revisionNote, setRevisionNote] = useState('')

  // Script generator
  const [scriptPlatform, setScriptPlatform] = useState('tiktok')
  const [scriptTone, setScriptTone] = useState('authentic')
  const [scriptOutput, setScriptOutput] = useState<string | null>(null)
  const [scriptLoading, setScriptLoading] = useState(false)
  const [scriptCopied, setScriptCopied] = useState(false)

  // ─── Data Loading ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const sb = createClient()

    try {
      // Brief + campaign join
      const { data: briefData, error: briefErr } = await sb
        .from('ugc_briefs')
        .select('*, campaign:campaigns(id, name)')
        .eq('id', briefId)
        .single()

      if (briefErr || !briefData) {
        setError('Brief not found.')
        setLoading(false)
        return
      }

      setBrief(briefData as BriefWithCampaign)
      setEditForm({
        title: briefData.title ?? '',
        goal: briefData.goal ?? '',
        instructions: briefData.instructions ?? '',
        deliverables: briefData.deliverables ?? '',
        due_date: briefData.due_date ?? '',
        status: briefData.status ?? 'draft',
      })

      // Submissions for this brief (joined with creator)
      const { data: subsData } = await sb
        .from('ugc_submissions')
        .select('*, creator:ugc_creators(id, name, instagram_handle, tiktok_handle)')
        .eq('brief_id', briefId)
        .order('created_at', { ascending: false })

      setSubmissions((subsData ?? []) as SubmissionWithCreator[])

      // Creators assigned to this brief (via submissions)
      const creatorIds = [...new Set((subsData ?? []).map((s: UgcSubmission) => s.creator_id))]
      if (creatorIds.length > 0) {
        const { data: creatorsData } = await sb
          .from('ugc_creators')
          .select('*')
          .in('id', creatorIds)
        setCreators(creatorsData ?? [])
      } else {
        setCreators([])
      }

      // All creators (for add modal dropdown)
      const { data: allC } = await sb
        .from('ugc_creators')
        .select('id, name, instagram_handle, tiktok_handle, niche, follower_count, workspace_id, email, youtube_handle, notes, created_at')
        .order('name')
      setAllCreators(allC ?? [])
    } catch {
      setError('Failed to load brief data.')
    }

    setLoading(false)
  }, [briefId])

  useEffect(() => { loadData() }, [loadData])

  // ─── Actions ──────────────────────────────────────────────────────────────

  async function saveBriefEdit() {
    setEditSaving(true)
    const sb = createClient()
    const { error: err } = await sb
      .from('ugc_briefs')
      .update({
        title: editForm.title,
        goal: editForm.goal || null,
        instructions: editForm.instructions || null,
        deliverables: editForm.deliverables || null,
        due_date: editForm.due_date || null,
        status: editForm.status,
      })
      .eq('id', briefId)
    if (!err) {
      setEditOpen(false)
      loadData()
    }
    setEditSaving(false)
  }

  async function updateSubmissionStatus(subId: string, status: 'approved' | 'rejected') {
    setActionLoadingId(subId)
    const sb = createClient()
    await sb
      .from('ugc_submissions')
      .update({ status, ...(status === 'approved' ? { approved_at: new Date().toISOString() } : {}) })
      .eq('id', subId)
    await loadData()
    setActionLoadingId(null)
  }

  async function requestRevision() {
    if (!revisionModalId) return
    setActionLoadingId(revisionModalId)
    const sb = createClient()
    await sb
      .from('ugc_submissions')
      .update({ status: 'in_review', revision_notes: revisionNote })
      .eq('id', revisionModalId)
    setRevisionModalId(null)
    setRevisionNote('')
    await loadData()
    setActionLoadingId(null)
  }

  async function addCreatorToBrief() {
    if (!selectedCreatorId) return
    setAddCreatorSaving(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    // Create a placeholder submission to link the creator to this brief
    await sb.from('ugc_submissions').insert({
      brief_id: briefId,
      creator_id: selectedCreatorId,
      workspace_id: brief?.workspace_id ?? '',
      storage_path: '',
      file_type: 'pending',
      status: 'pending',
    })
    setAddCreatorOpen(false)
    setSelectedCreatorId('')
    await loadData()
    setAddCreatorSaving(false)
  }

  async function generateScript() {
    setScriptLoading(true)
    setScriptOutput(null)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ugc_brief',
          brief_title: brief?.title,
          goal: brief?.goal,
          instructions: brief?.instructions,
          platform: scriptPlatform,
          tone: scriptTone,
        }),
      })
      const data = await res.json()
      setScriptOutput(data.output ?? null)
    } catch {
      /* fallthrough to fallback */
    }

    if (!scriptOutput) {
      const platformLabel = PLATFORM_OPTIONS.find(p => p.value === scriptPlatform)?.label ?? scriptPlatform
      const toneLabel = TONE_OPTIONS.find(t => t.value === scriptTone)?.label ?? scriptTone
      setScriptOutput(
        `🎬 UGC SCRIPT — ${platformLabel} · ${toneLabel}\n` +
        `Brief: ${brief?.title ?? 'Untitled'}\n\n` +
        `HOOK (0–3s)\n"[Attention-grabbing opening line that stops the scroll]"\n\n` +
        `SETUP (3–8s)\nIntroduce the problem or desire this product/service solves.\n` +
        `Speak directly to the viewer — make it relatable.\n\n` +
        `DEMO / PROOF (8–22s)\n• Show the product in real use\n` +
        `• Highlight 2–3 specific benefits\n• Use natural, unscripted delivery\n\n` +
        `SOCIAL PROOF (22–27s)\n"I've been using this for X weeks and [result]..."\n\n` +
        `CTA (27–30s)\n"Link in bio / Use code [CODE] for 15% off today only."\n\n` +
        `─────────────────────────────────────\n` +
        `B-ROLL NOTES:\n` +
        `• Close-up of product texture / packaging\n` +
        `• Before/after or transformation shot\n` +
        `• Candid lifestyle moment\n` +
        `• Screen recording of results (if applicable)\n\n` +
        `CAPTION HOOK IDEAS:\n` +
        `• "POV: You finally found the thing that actually works"\n` +
        `• "I wasn't going to post this but..."\n` +
        `• "Stop scrolling — this changed everything for me"\n`
      )
    }
    setScriptLoading(false)
  }

  function copyScript() {
    if (scriptOutput) {
      navigator.clipboard.writeText(scriptOutput)
      setScriptCopied(true)
      setTimeout(() => setScriptCopied(false), 2000)
    }
  }

  // ─── Derived metrics ──────────────────────────────────────────────────────

  const totalSubs = submissions.length
  const approvedSubs = submissions.filter(s => s.status === 'approved').length
  const rejectedSubs = submissions.filter(s => s.status === 'rejected').length
  const pendingSubs = submissions.filter(s => s.status === 'pending').length
  const rejectionRate = totalSubs > 0 ? Math.round((rejectedSubs / totalSubs) * 100) : 0

  function avgTurnaround(): string {
    const approved = submissions.filter(s => s.status === 'approved' && s.approved_at)
    if (approved.length === 0) return '—'
    const days = approved.map(s => {
      const created = new Date(s.created_at).getTime()
      const approved_at = new Date(s.approved_at!).getTime()
      return Math.round((approved_at - created) / 86400000)
    })
    const avg = Math.round(days.reduce((a, b) => a + b, 0) / days.length)
    return `${avg}d`
  }

  // ─── Loading / Error ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="flex gap-1 border-b border-slate-200 pb-0">
          {DETAIL_TABS.map(t => <Skeleton key={t.id} className="h-9 w-24 rounded-t-lg" />)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
      </div>
    )
  }

  if (error || !brief) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium">{error ?? 'Brief not found'}</p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => router.push('/app/ugc')}>
            Back to UGC
          </Button>
        </div>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const doItems = brief.instructions
    ? brief.instructions
        .split('\n')
        .filter(l => l.startsWith('+') || l.toLowerCase().includes('do:'))
        .map(l => l.replace(/^\+\s*/, '').replace(/^do:\s*/i, ''))
    : []

  const dontItems = brief.instructions
    ? brief.instructions
        .split('\n')
        .filter(l => l.startsWith('-') || l.toLowerCase().includes("don't:"))
        .map(l => l.replace(/^-\s*/, '').replace(/^don't:\s*/i, ''))
    : []

  return (
    <div className="p-6">
      {/* Header */}
      <PageHeader
        title={brief.title}
        subtitle={brief.campaign ? `Campaign: ${brief.campaign.name}` : 'No campaign linked'}
        breadcrumbs={[
          { label: 'UGC', href: '/app/ugc' },
          { label: brief.title },
        ]}
      >
        <Badge status={brief.status} dot>{brief.status}</Badge>
        <Button
          variant="secondary"
          size="sm"
          icon={<Edit2 size={14} />}
          onClick={() => setEditOpen(true)}
        >
          Edit Brief
        </Button>
      </PageHeader>

      {/* Tabs */}
      <Tabs tabs={DETAIL_TABS} active={tab} onChange={setTab} className="mb-6" />

      {/* ── OVERVIEW ─────────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Details card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Brief Details</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 text-sm">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Status</p>
                <Badge status={brief.status} dot>{brief.status}</Badge>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Due Date</p>
                <p className="text-slate-700">{brief.due_date ? formatDate(brief.due_date) : 'Not set'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Campaign</p>
                <p className="text-slate-700">{brief.campaign?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Created</p>
                <p className="text-slate-700">{formatDate(brief.created_at)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Submissions</p>
                <p className="text-slate-700">{totalSubs}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Approved</p>
                <p className="text-slate-700">{approvedSubs}</p>
              </div>
            </div>

            {brief.goal && (
              <div className="mt-5 pt-5 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Goal</p>
                <p className="text-sm text-slate-700 leading-relaxed">{brief.goal}</p>
              </div>
            )}

            {brief.deliverables && (
              <div className="mt-4">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Deliverables</p>
                <div className="flex flex-wrap gap-2">
                  {brief.deliverables.split(',').map(d => d.trim()).filter(Boolean).map(d => (
                    <span key={d} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100">{d}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Do / Don't instructions */}
          {brief.instructions && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                  <CheckCircle size={15} /> Do
                </h3>
                {doItems.length > 0 ? (
                  <ul className="space-y-2">
                    {doItems.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-emerald-700">
                        <Check size={13} className="mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-emerald-600 whitespace-pre-wrap leading-relaxed">
                    {brief.instructions}
                  </div>
                )}
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
                  <XCircle size={15} /> Don't
                </h3>
                {dontItems.length > 0 ? (
                  <ul className="space-y-2">
                    {dontItems.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                        <XCircle size={13} className="mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-red-600 italic">No restrictions specified. Add instructions using + Do / - Don't format.</p>
                )}
              </div>
            </div>
          )}

          {!brief.instructions && (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-6 text-center">
              <p className="text-sm text-slate-500">No instructions added yet.</p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setEditOpen(true)}>Add Instructions</Button>
            </div>
          )}
        </div>
      )}

      {/* ── CREATORS ─────────────────────────────────────────────────────────── */}
      {tab === 'creators' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{creators.length} creator{creators.length !== 1 ? 's' : ''} assigned to this brief</p>
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setAddCreatorOpen(true)}>
              Add Creator
            </Button>
          </div>

          {creators.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No creators assigned"
              description="Assign creators to this brief so they can submit content."
              action={{ label: 'Add Creator', onClick: () => setAddCreatorOpen(true) }}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Creator', 'Platform', 'Handle', 'Followers', 'Submissions', 'Status', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {creators.map(c => {
                    const creatorSubs = submissions.filter(s => s.creator_id === c.id)
                    const latest = creatorSubs[0]
                    const primaryHandle = c.instagram_handle ?? c.tiktok_handle ?? c.youtube_handle
                    const platform = c.instagram_handle ? 'Instagram' : c.tiktok_handle ? 'TikTok' : c.youtube_handle ? 'YouTube' : 'Unknown'
                    return (
                      <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                              {c.name[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{c.name}</p>
                              {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{platform}</td>
                        <td className="px-4 py-3 text-slate-500">{primaryHandle ? `@${primaryHandle}` : '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{c.follower_count?.toLocaleString() ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{creatorSubs.length}</td>
                        <td className="px-4 py-3">
                          {latest ? <Badge status={latest.status}>{latest.status}</Badge> : <Badge variant="slate">Invited</Badge>}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => router.push(`/app/ugc/creators/${c.id}`)}
                          >
                            View Profile
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SUBMISSIONS ──────────────────────────────────────────────────────── */}
      {tab === 'submissions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">{totalSubs} total</span>
              <span className="w-px h-4 bg-slate-200" />
              <span className="text-xs text-emerald-600 font-medium">{approvedSubs} approved</span>
              <span className="text-xs text-amber-600 font-medium">{pendingSubs} pending</span>
              <span className="text-xs text-red-600 font-medium">{rejectedSubs} rejected</span>
            </div>
          </div>

          {submissions.length === 0 ? (
            <EmptyState
              icon={Upload}
              title="No submissions yet"
              description="Creators will submit their content here once you assign them to this brief."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Creator', 'File Type', 'Status', 'Revision Notes', 'Submitted', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(sub => (
                    <tr key={sub.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-700 shrink-0">
                            {(sub.creator?.name?.[0] ?? '?').toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-900">{sub.creator?.name ?? 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{sub.file_type}</td>
                      <td className="px-4 py-3"><Badge status={sub.status} dot>{sub.status}</Badge></td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs text-slate-500 truncate">{sub.revision_notes ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(sub.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {sub.status !== 'approved' && (
                            <button
                              disabled={actionLoadingId === sub.id}
                              onClick={() => updateSubmissionStatus(sub.id, 'approved')}
                              className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors',
                                'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50',
                              )}
                            >
                              <CheckCircle size={12} /> Approve
                            </button>
                          )}
                          {sub.status !== 'rejected' && (
                            <button
                              disabled={actionLoadingId === sub.id}
                              onClick={() => updateSubmissionStatus(sub.id, 'rejected')}
                              className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors',
                                'bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50',
                              )}
                            >
                              <XCircle size={12} /> Reject
                            </button>
                          )}
                          <button
                            disabled={actionLoadingId === sub.id}
                            onClick={() => { setRevisionModalId(sub.id); setRevisionNote(sub.revision_notes ?? '') }}
                            className={cn(
                              'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors',
                              'bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50',
                            )}
                          >
                            <RotateCcw size={12} /> Revise
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SCRIPTS ──────────────────────────────────────────────────────────── */}
      {tab === 'scripts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Generator panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">AI Script Generator</h2>
              <p className="text-xs text-slate-500 mt-0.5">Generate a creator script based on this brief</p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
              <p className="font-medium text-slate-700">Brief context loaded:</p>
              <p>{brief.title}</p>
              {brief.goal && <p className="text-slate-500 truncate">{brief.goal}</p>}
            </div>

            <Select
              label="Platform"
              value={scriptPlatform}
              onChange={e => setScriptPlatform(e.target.value)}
              options={PLATFORM_OPTIONS}
            />
            <Select
              label="Creator Tone"
              value={scriptTone}
              onChange={e => setScriptTone(e.target.value)}
              options={TONE_OPTIONS}
            />

            <Button
              variant="ai"
              className="w-full"
              loading={scriptLoading}
              onClick={generateScript}
              icon={<Wand2 size={14} />}
            >
              Generate Script
            </Button>
          </div>

          {/* Output panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Generated Script</h2>
              {scriptOutput && (
                <button
                  onClick={copyScript}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                >
                  {scriptCopied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  {scriptCopied ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>

            {scriptOutput ? (
              <div className="flex-1 overflow-y-auto">
                <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-4">
                  {scriptOutput}
                </pre>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState
                  icon={ClipboardList}
                  title="No script yet"
                  description="Configure the options and click Generate Script."
                  compact
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PERFORMANCE ──────────────────────────────────────────────────────── */}
      {tab === 'performance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Submissions', value: totalSubs.toString(), color: 'text-slate-900' },
              { label: 'Approved', value: approvedSubs.toString(), color: 'text-emerald-600' },
              { label: 'Rejection Rate', value: `${rejectionRate}%`, color: rejectionRate > 30 ? 'text-red-600' : 'text-slate-900' },
              { label: 'Avg Turnaround', value: avgTurnaround(), color: 'text-blue-600' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">{kpi.label}</p>
                <p className={cn('text-3xl font-bold tabular-nums', kpi.color)}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {totalSubs === 0 ? (
            <EmptyState
              icon={BarChart2}
              title="No performance data yet"
              description="Performance metrics will appear once creators submit content for this brief."
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Submission Breakdown</h3>
              <div className="space-y-3">
                {[
                  { label: 'Approved', count: approvedSubs, color: 'bg-emerald-500' },
                  { label: 'Pending', count: pendingSubs, color: 'bg-amber-400' },
                  { label: 'Rejected', count: rejectedSubs, color: 'bg-red-400' },
                  { label: 'In Review', count: submissions.filter(s => s.status === 'in_review').length, color: 'bg-blue-400' },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-3">
                    <span className="w-24 text-xs text-slate-500 font-medium">{row.label}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', row.color)}
                        style={{ width: totalSubs > 0 ? `${Math.round((row.count / totalSubs) * 100)}%` : '0%' }}
                      />
                    </div>
                    <span className="w-8 text-xs text-slate-600 font-semibold text-right">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Edit Brief Modal ──────────────────────────────────────────────── */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Brief"
        description="Update the brief details below."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button loading={editSaving} onClick={saveBriefEdit} disabled={!editForm.title}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Title *"
            placeholder="Brief title"
            value={editForm.title}
            onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
          />
          <Select
            label="Status"
            value={editForm.status}
            onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
            options={STATUS_OPTIONS}
          />
          <Textarea
            label="Goal"
            placeholder="What should creators achieve with this content?"
            rows={2}
            value={editForm.goal}
            onChange={e => setEditForm(f => ({ ...f, goal: e.target.value }))}
          />
          <Textarea
            label="Instructions"
            placeholder="Use + Do: / - Don't: format for structured do/don't rendering&#10;E.g.&#10;+ Show the product being used&#10;- Don't mention competitors"
            rows={6}
            value={editForm.instructions}
            onChange={e => setEditForm(f => ({ ...f, instructions: e.target.value }))}
            hint="Use + Do: and - Don't: prefixes to auto-populate the do/don't cards."
          />
          <Input
            label="Deliverables"
            placeholder="Video 30s, Photos x3, Behind the scenes"
            value={editForm.deliverables}
            onChange={e => setEditForm(f => ({ ...f, deliverables: e.target.value }))}
            hint="Comma-separated list of required deliverables."
          />
          <Input
            label="Due Date"
            type="date"
            value={editForm.due_date}
            onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))}
          />
        </div>
      </Modal>

      {/* ─── Add Creator Modal ─────────────────────────────────────────────── */}
      <Modal
        open={addCreatorOpen}
        onClose={() => { setAddCreatorOpen(false); setSelectedCreatorId('') }}
        title="Add Creator to Brief"
        description="Select a creator from your CRM to assign to this brief."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddCreatorOpen(false)}>Cancel</Button>
            <Button
              loading={addCreatorSaving}
              disabled={!selectedCreatorId}
              onClick={addCreatorToBrief}
            >
              Add Creator
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {allCreators.length === 0 ? (
            <div className="text-center py-4 text-sm text-slate-500">
              No creators in your CRM yet.{' '}
              <a href="/app/ugc" className="text-blue-600 underline">Add creators first</a>.
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500 mb-3">Choose a creator to assign:</p>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {allCreators.map(c => {
                  const isAlready = creators.some(existing => existing.id === c.id)
                  return (
                    <button
                      key={c.id}
                      disabled={isAlready}
                      onClick={() => setSelectedCreatorId(c.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors',
                        selectedCreatorId === c.id
                          ? 'border-blue-600 bg-blue-50'
                          : isAlready
                          ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                          : 'border-slate-200 hover:bg-slate-50',
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                        {c.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{c.name}</p>
                        <p className="text-xs text-slate-400 truncate">
                          {([c.instagram_handle && `@${c.instagram_handle}`, c.niche].filter(Boolean).join(' · ')) || (c.email ?? '')}
                        </p>
                      </div>
                      {isAlready && <span className="text-xs text-slate-400 shrink-0">Already added</span>}
                      {selectedCreatorId === c.id && <Check size={14} className="text-blue-600 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ─── Request Revision Modal ────────────────────────────────────────── */}
      <Modal
        open={!!revisionModalId}
        onClose={() => { setRevisionModalId(null); setRevisionNote('') }}
        title="Request Revision"
        description="Explain what changes the creator needs to make."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setRevisionModalId(null); setRevisionNote('') }}>Cancel</Button>
            <Button
              variant="outline"
              loading={actionLoadingId === revisionModalId}
              onClick={requestRevision}
            >
              Send Revision Request
            </Button>
          </>
        }
      >
        <Textarea
          label="Revision Notes *"
          placeholder="e.g. Please re-shoot the opening with better lighting and include the product close-up..."
          rows={4}
          value={revisionNote}
          onChange={e => setRevisionNote(e.target.value)}
        />
      </Modal>
    </div>
  )
}
