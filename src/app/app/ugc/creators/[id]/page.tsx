'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Save, Plus, Trash2, ExternalLink, Camera, Upload,
  PlayCircle, AtSign, Users, FileText, Link as LinkIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton, SkeletonRow } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate } from '@/lib/utils'
import type { UgcCreator, UgcSubmission, UgcBrief } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubmissionWithBrief extends UgcSubmission {
  brief?: Pick<UgcBrief, 'id' | 'title'> | null
}

interface ProfileForm {
  name: string
  email: string
  instagram_handle: string
  tiktok_handle: string
  youtube_handle: string
  follower_count: string
  niche: string
  notes: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CREATOR_TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'submissions', label: 'Submissions' },
  { id: 'notes', label: 'Notes' },
  { id: 'portfolio', label: 'Portfolio' },
]

const NICHE_OPTIONS = [
  { value: '', label: 'Select niche…' },
  { value: 'Beauty', label: 'Beauty' },
  { value: 'Fashion', label: 'Fashion' },
  { value: 'Fitness', label: 'Fitness' },
  { value: 'Food', label: 'Food & Beverage' },
  { value: 'Tech', label: 'Tech & Gadgets' },
  { value: 'Lifestyle', label: 'Lifestyle' },
  { value: 'Gaming', label: 'Gaming' },
  { value: 'Travel', label: 'Travel' },
  { value: 'Health', label: 'Health & Wellness' },
  { value: 'Home', label: 'Home & Garden' },
  { value: 'Parenting', label: 'Parenting' },
  { value: 'Finance', label: 'Finance' },
  { value: 'Education', label: 'Education' },
  { value: 'Other', label: 'Other' },
]

// ─── Helper ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0]?.toUpperCase() ?? '')
    .join('')
}

function platformFromCreator(c: UgcCreator): string {
  if (c.instagram_handle) return 'Instagram'
  if (c.tiktok_handle) return 'TikTok'
  if (c.youtube_handle) return 'YouTube'
  return 'Unknown'
}

function primaryHandle(c: UgcCreator): string | null {
  return c.instagram_handle ?? c.tiktok_handle ?? c.youtube_handle ?? null
}

function isValidUrl(url: string): boolean {
  try { new URL(url); return true } catch { return false }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CreatorProfilePage() {
  const params = useParams()
  const router = useRouter()
  const creatorId = params.id as string

  // Core data
  const [creator, setCreator] = useState<UgcCreator | null>(null)
  const [submissions, setSubmissions] = useState<SubmissionWithBrief[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Tab state
  const [tab, setTab] = useState('profile')

  // Profile form
  const [form, setForm] = useState<ProfileForm>({
    name: '', email: '', instagram_handle: '', tiktok_handle: '',
    youtube_handle: '', follower_count: '', niche: '', notes: '',
  })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Notes auto-save
  const notesSaveTimer = useRef<NodeJS.Timeout | null>(null)
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  // Portfolio URLs
  const [portfolioUrls, setPortfolioUrls] = useState<string[]>([])
  const [newUrl, setNewUrl] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [urlSaving, setUrlSaving] = useState(false)

  // ─── Data Loading ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const sb = createClient()

    try {
      const { data: creatorData, error: creatorErr } = await sb
        .from('ugc_creators')
        .select('*')
        .eq('id', creatorId)
        .single()

      if (creatorErr || !creatorData) {
        setError('Creator not found.')
        setLoading(false)
        return
      }

      setCreator(creatorData)
      setForm({
        name: creatorData.name ?? '',
        email: creatorData.email ?? '',
        instagram_handle: creatorData.instagram_handle ?? '',
        tiktok_handle: creatorData.tiktok_handle ?? '',
        youtube_handle: creatorData.youtube_handle ?? '',
        follower_count: creatorData.follower_count?.toString() ?? '',
        niche: creatorData.niche ?? '',
        notes: creatorData.notes ?? '',
      })

      // Parse portfolio URLs from notes or a dedicated pattern
      // We store portfolio URLs as JSON in notes using a sentinel prefix
      const notesRaw = creatorData.notes ?? ''
      const portfolioMatch = notesRaw.match(/<!--PORTFOLIO:(.*?)-->/)
      if (portfolioMatch) {
        try {
          setPortfolioUrls(JSON.parse(portfolioMatch[1]))
        } catch {
          setPortfolioUrls([])
        }
      } else {
        setPortfolioUrls([])
      }

      // Submissions for this creator
      const { data: subsData } = await sb
        .from('ugc_submissions')
        .select('*, brief:ugc_briefs(id, title)')
        .eq('creator_id', creatorId)
        .order('created_at', { ascending: false })

      setSubmissions((subsData ?? []) as SubmissionWithBrief[])
    } catch {
      setError('Failed to load creator data.')
    }

    setLoading(false)
  }, [creatorId])

  useEffect(() => { loadData() }, [loadData])

  // ─── Profile Save ──────────────────────────────────────────────────────────

  async function saveProfile() {
    if (!form.name.trim()) {
      setProfileError('Name is required.')
      return
    }
    setProfileSaving(true)
    setProfileError(null)
    const sb = createClient()

    const { error: err } = await sb
      .from('ugc_creators')
      .update({
        name: form.name.trim(),
        email: form.email.trim() || null,
        instagram_handle: form.instagram_handle.replace(/^@/, '').trim() || null,
        tiktok_handle: form.tiktok_handle.replace(/^@/, '').trim() || null,
        youtube_handle: form.youtube_handle.replace(/^@/, '').trim() || null,
        follower_count: form.follower_count ? parseInt(form.follower_count, 10) : null,
        niche: form.niche || null,
      })
      .eq('id', creatorId)

    if (err) {
      setProfileError('Failed to save. Please try again.')
    } else {
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2500)
      await loadData()
    }
    setProfileSaving(false)
  }

  // ─── Notes Auto-Save ──────────────────────────────────────────────────────

  function handleNotesChange(value: string) {
    setForm(f => ({ ...f, notes: value }))
    setNotesSaved(false)
    if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current)
  }

  async function saveNotes() {
    setNotesSaving(true)
    const sb = createClient()
    // Preserve portfolio sentinel in notes
    const portfolioSentinel = portfolioUrls.length > 0
      ? `\n<!--PORTFOLIO:${JSON.stringify(portfolioUrls)}-->`
      : ''
    // Strip any existing sentinel from visible notes
    const cleanNotes = form.notes.replace(/\n?<!--PORTFOLIO:.*?-->/g, '')
    await sb
      .from('ugc_creators')
      .update({ notes: cleanNotes + portfolioSentinel })
      .eq('id', creatorId)
    setNotesSaving(false)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  function handleNotesBlur() {
    saveNotes()
  }

  // ─── Portfolio URLs ────────────────────────────────────────────────────────

  async function addPortfolioUrl() {
    const trimmed = newUrl.trim()
    if (!trimmed) return
    const withProtocol = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
    if (!isValidUrl(withProtocol)) {
      setUrlError('Please enter a valid URL.')
      return
    }
    if (portfolioUrls.includes(withProtocol)) {
      setUrlError('This URL is already in the portfolio.')
      return
    }
    setUrlError(null)
    setUrlSaving(true)
    const updatedUrls = [...portfolioUrls, withProtocol]
    const sb = createClient()
    const cleanNotes = (form.notes ?? '').replace(/\n?<!--PORTFOLIO:.*?-->/g, '')
    await sb
      .from('ugc_creators')
      .update({ notes: cleanNotes + `\n<!--PORTFOLIO:${JSON.stringify(updatedUrls)}-->` })
      .eq('id', creatorId)
    setPortfolioUrls(updatedUrls)
    setNewUrl('')
    setUrlSaving(false)
  }

  async function removePortfolioUrl(url: string) {
    const updatedUrls = portfolioUrls.filter(u => u !== url)
    const sb = createClient()
    const cleanNotes = (form.notes ?? '').replace(/\n?<!--PORTFOLIO:.*?-->/g, '')
    await sb
      .from('ugc_creators')
      .update({ notes: cleanNotes + (updatedUrls.length > 0 ? `\n<!--PORTFOLIO:${JSON.stringify(updatedUrls)}-->` : '') })
      .eq('id', creatorId)
    setPortfolioUrls(updatedUrls)
  }

  // ─── Loading / Error ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="flex gap-1 border-b border-slate-200">
          {CREATOR_TABS.map(t => <Skeleton key={t.id} className="h-9 w-24 rounded-t-lg" />)}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
      </div>
    )
  }

  if (error || !creator) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium">{error ?? 'Creator not found'}</p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => router.push('/app/ugc')}>
            Back to UGC
          </Button>
        </div>
      </div>
    )
  }

  const platform = platformFromCreator(creator)
  const handle = primaryHandle(creator)
  const visibleNotes = form.notes.replace(/\n?<!--PORTFOLIO:.*?-->/g, '')
  const totalSubs = submissions.length
  const approvedSubs = submissions.filter(s => s.status === 'approved').length

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      {/* Header */}
      <PageHeader
        title={creator.name}
        subtitle={handle ? `@${handle} · ${platform}` : platform}
        breadcrumbs={[
          { label: 'UGC', href: '/app/ugc' },
          { label: 'Creators', href: '/app/ugc' },
          { label: creator.name },
        ]}
      >
        {creator.niche && <Badge variant="default">{creator.niche}</Badge>}
      </PageHeader>

      {/* Creator hero card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xl font-bold shrink-0 select-none">
          {getInitials(creator.name)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-slate-900">{creator.name}</h2>
          {creator.email && <p className="text-sm text-slate-500">{creator.email}</p>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
            {handle && (
              <span className="text-sm text-slate-500 flex items-center gap-1">
                <AtSign size={12} /> {handle}
              </span>
            )}
            {creator.follower_count && (
              <span className="text-sm text-slate-500 flex items-center gap-1">
                <Users size={12} /> {creator.follower_count.toLocaleString()} followers
              </span>
            )}
            {creator.niche && (
              <span className="text-sm text-slate-500">{creator.niche}</span>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="flex items-center gap-6 shrink-0">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-900">{totalSubs}</p>
            <p className="text-xs text-slate-400 mt-0.5">Submissions</p>
          </div>
          <div className="w-px h-10 bg-slate-200" />
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600">{approvedSubs}</p>
            <p className="text-xs text-slate-400 mt-0.5">Approved</p>
          </div>
          <div className="w-px h-10 bg-slate-200" />
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-900">
              {creator.follower_count ? `${(creator.follower_count / 1000).toFixed(1)}K` : '—'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Followers</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={CREATOR_TABS} active={tab} onChange={setTab} className="mb-6" />

      {/* ── PROFILE ──────────────────────────────────────────────────────────── */}
      {tab === 'profile' && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Personal Details</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name *"
                placeholder="Creator's full name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
              <Input
                label="Email"
                type="email"
                placeholder="creator@email.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>

            <Select
              label="Niche"
              value={form.niche}
              onChange={e => setForm(f => ({ ...f, niche: e.target.value }))}
              options={NICHE_OPTIONS}
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Social Profiles</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Instagram Handle"
                placeholder="@username"
                value={form.instagram_handle}
                onChange={e => setForm(f => ({ ...f, instagram_handle: e.target.value }))}
                icon={<Camera size={14} />}
              />
              <Input
                label="TikTok Handle"
                placeholder="@username"
                value={form.tiktok_handle}
                onChange={e => setForm(f => ({ ...f, tiktok_handle: e.target.value }))}
                icon={<PlayCircle size={14} />}
              />
            </div>

            <Input
              label="YouTube Handle"
              placeholder="@channelname"
              value={form.youtube_handle}
              onChange={e => setForm(f => ({ ...f, youtube_handle: e.target.value }))}
              icon={<PlayCircle size={14} />}
            />

            <Input
              label="Follower Count"
              type="number"
              placeholder="e.g. 50000"
              value={form.follower_count}
              onChange={e => setForm(f => ({ ...f, follower_count: e.target.value }))}
              hint="Combined or primary platform follower count."
            />
          </div>

          {profileError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {profileError}
            </div>
          )}

          <div className="flex items-center justify-between">
            {profileSaved && (
              <p className="text-sm text-emerald-600 font-medium">Changes saved successfully.</p>
            )}
            <div className="ml-auto">
              <Button
                variant="primary"
                loading={profileSaving}
                onClick={saveProfile}
                icon={<Save size={14} />}
              >
                Save Profile
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUBMISSIONS ──────────────────────────────────────────────────────── */}
      {tab === 'submissions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {totalSubs} submission{totalSubs !== 1 ? 's' : ''} · {approvedSubs} approved
            </p>
          </div>

          {submissions.length === 0 ? (
            <EmptyState
              icon={Upload}
              title="No submissions yet"
              description="This creator hasn't submitted any content yet."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Brief', 'File Type', 'Status', 'Revision Notes', 'Submitted', 'Approved'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(sub => (
                    <tr key={sub.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        {sub.brief ? (
                          <a
                            href={`/app/ugc/${sub.brief.id}`}
                            className="font-medium text-blue-600 hover:underline flex items-center gap-1"
                          >
                            {sub.brief.title}
                            <ExternalLink size={11} />
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">Brief removed</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{sub.file_type}</td>
                      <td className="px-4 py-3">
                        <Badge status={sub.status} dot>{sub.status}</Badge>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs text-slate-500 truncate">{sub.revision_notes ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(sub.created_at)}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {sub.approved_at ? formatDate(sub.approved_at) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── NOTES ────────────────────────────────────────────────────────────── */}
      {tab === 'notes' && (
        <div className="max-w-2xl space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Internal Notes</h2>
              <div className="text-xs text-slate-400 flex items-center gap-1">
                {notesSaving && <span className="text-amber-500">Saving…</span>}
                {notesSaved && <span className="text-emerald-500">Saved</span>}
                {!notesSaving && !notesSaved && <span>Auto-saves on blur</span>}
              </div>
            </div>
            <Textarea
              placeholder="Add internal notes about this creator — collab history, rates negotiated, communication preferences, content quality, timezone, etc."
              rows={12}
              value={visibleNotes}
              onChange={e => handleNotesChange(e.target.value)}
              onBlur={handleNotesBlur}
            />
            <p className="text-xs text-slate-400 mt-2">
              Notes are only visible to your workspace members and are never shared with the creator.
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            loading={notesSaving}
            onClick={saveNotes}
            icon={<Save size={13} />}
          >
            Save Notes
          </Button>
        </div>
      )}

      {/* ── PORTFOLIO ────────────────────────────────────────────────────────── */}
      {tab === 'portfolio' && (
        <div className="max-w-2xl space-y-5">
          {/* Add URL */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Add Portfolio URL</h2>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="https://www.tiktok.com/@handle/video/..."
                  value={newUrl}
                  onChange={e => { setNewUrl(e.target.value); setUrlError(null) }}
                  onKeyDown={e => { if (e.key === 'Enter') addPortfolioUrl() }}
                  error={urlError ?? undefined}
                  icon={<LinkIcon size={13} />}
                />
              </div>
              <Button
                variant="primary"
                size="md"
                loading={urlSaving}
                onClick={addPortfolioUrl}
                icon={<Plus size={14} />}
              >
                Add
              </Button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Paste links to the creator's best-performing or most relevant content.
            </p>
          </div>

          {/* Portfolio list */}
          {portfolioUrls.length === 0 ? (
            <EmptyState
              icon={LinkIcon}
              title="No portfolio URLs yet"
              description="Add links to the creator's content to build their portfolio."
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {portfolioUrls.length} link{portfolioUrls.length !== 1 ? 's' : ''}
                </p>
              </div>
              <ul className="divide-y divide-slate-100">
                {portfolioUrls.map((url, i) => {
                  let hostname = ''
                  try { hostname = new URL(url).hostname.replace('www.', '') } catch { hostname = url }
                  return (
                    <li key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 group">
                      <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                        <LinkIcon size={13} className="text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-400 mb-0.5">{hostname}</p>
                        <p className="text-sm text-slate-700 truncate">{url}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Open link"
                        >
                          <ExternalLink size={13} />
                        </a>
                        <button
                          onClick={() => removePortfolioUrl(url)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Remove URL"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
