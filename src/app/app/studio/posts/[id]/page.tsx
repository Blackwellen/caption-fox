'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Save, Upload, AlertCircle, CheckCircle2, XCircle,
  Clock, Image, Video, FileText, Sparkles, X, Camera,
  PlayCircle, Briefcase, Users, AtSign, Hash, Plus, Trash2,
  Calendar, Eye, Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, formatRelative, truncate } from '@/lib/utils'
import { PLATFORM_LABELS } from '@/lib/constants'
import type { ContentPost, Approval, AuditLog } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PostPlatformVersion {
  id: string
  post_id: string
  platform: string
  caption: string | null
  hashtags: string[]
  media_asset_ids: string[]
  is_approved: boolean
  created_at: string
}

interface GeneratedCaption {
  id: string
  text: string
}

type PostStatus = 'draft' | 'pending_approval' | 'approved' | 'scheduled' | 'published' | 'rejected'

// ─── Platform config ──────────────────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Camera size={13} />,
  tiktok:    <PlayCircle size={13} />,
  linkedin:  <Briefcase size={13} />,
  facebook:  <Users size={13} />,
  x:         <AtSign size={13} />,
  youtube:   <PlayCircle size={13} />,
  pinterest: <Hash size={13} />,
}

const ALL_PLATFORMS = ['instagram', 'tiktok', 'linkedin', 'facebook', 'x', 'youtube']

const POST_TYPES = [
  { value: 'post',      label: 'Post'      },
  { value: 'reel',      label: 'Reel'      },
  { value: 'story',     label: 'Story'     },
  { value: 'carousel',  label: 'Carousel'  },
  { value: 'short',     label: 'Short'     },
]

const STATUS_OPTIONS: { value: PostStatus; label: string }[] = [
  { value: 'draft',            label: 'Draft'            },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved',         label: 'Approved'         },
  { value: 'scheduled',        label: 'Scheduled'        },
]

const EDITOR_TABS = [
  { id: 'editor',    label: 'Editor'    },
  { id: 'media',     label: 'Media'     },
  { id: 'ai',        label: 'AI Assist' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'history',   label: 'History'   },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadgeVariant(status: string) {
  const map: Record<string, string> = {
    draft: 'slate', pending_approval: 'amber', approved: 'green',
    scheduled: 'blue', published: 'green', rejected: 'red',
  }
  return (map[status] ?? 'default') as any
}

function parseHashtags(raw: string): string[] {
  return raw.split(',').map(t => t.trim()).filter(Boolean)
}

function hashtagsToString(tags: string[]): string {
  return tags.join(', ')
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PostDetailPage() {
  const params = useParams()
  const router = useRouter()
  const postId = params.id as string

  // ── Data state
  const [post, setPost] = useState<ContentPost | null>(null)
  const [platformVersion, setPlatformVersion] = useState<PostPlatformVersion | null>(null)
  const [approval, setApproval] = useState<Approval | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  // ── Editor state (mirrors post fields)
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')  // comma-separated string
  const [platforms, setPlatforms] = useState<string[]>([])
  const [postType, setPostType] = useState('post')
  const [scheduledAt, setScheduledAt] = useState('')
  const [status, setStatus] = useState<PostStatus>('draft')

  // ── Save state
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Tab
  const [activeTab, setActiveTab] = useState('editor')

  // ── AI Assist
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiResults, setAiResults] = useState<GeneratedCaption[]>([])

  // ── Media upload
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // ── Approvals
  const [requestingApproval, setRequestingApproval] = useState(false)
  const [approvalError, setApprovalError] = useState<string | null>(null)

  // ─── Load post ─────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    setPageError(null)
    try {
      const supabase = createClient()

      const [postRes, versionRes, approvalRes, auditRes] = await Promise.all([
        supabase.from('content_posts').select('*').eq('id', postId).single(),
        supabase.from('post_platform_versions').select('*').eq('post_id', postId).limit(1).maybeSingle(),
        supabase.from('approvals').select('*').eq('post_id', postId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('audit_logs').select('*').eq('resource_id', postId).order('created_at', { ascending: false }).limit(50),
      ])

      if (postRes.error) throw postRes.error

      const p = postRes.data as ContentPost
      setPost(p)
      setCaption((versionRes.data?.caption ?? '') || '')
      setHashtags(hashtagsToString(versionRes.data?.hashtags ?? []))
      setPlatforms(p.platforms ?? [])
      setPostType(p.post_type ?? 'post')
      setScheduledAt(p.scheduled_at ? new Date(p.scheduled_at).toISOString().slice(0, 16) : '')
      setStatus(p.status as PostStatus)
      setMediaUrls([]) // media_urls not in schema; would come from media_assets join

      if (versionRes.data) setPlatformVersion(versionRes.data as PostPlatformVersion)
      if (approvalRes.data) setApproval(approvalRes.data as Approval)
      if (!auditRes.error) setAuditLogs((auditRes.data ?? []) as AuditLog[])
    } catch (e: any) {
      setPageError(e.message ?? 'Failed to load post')
    } finally {
      setLoading(false)
    }
  }, [postId])

  useEffect(() => { load() }, [load])

  // ─── Save post ──────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!post) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const supabase = createClient()

      // Update content_posts
      const { error: postErr } = await supabase
        .from('content_posts')
        .update({
          status,
          post_type: postType,
          platforms,
          scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          title: truncate(caption, 100) || post.title,
        })
        .eq('id', postId)

      if (postErr) throw postErr

      // Upsert platform version for first platform (or existing version)
      const tagArray = parseHashtags(hashtags)
      const primaryPlatform = platforms[0] ?? 'instagram'

      if (platformVersion) {
        const { error: vErr } = await supabase
          .from('post_platform_versions')
          .update({ caption, hashtags: tagArray })
          .eq('id', platformVersion.id)
        if (vErr) throw vErr
      } else {
        const { data: newVer, error: vErr } = await supabase
          .from('post_platform_versions')
          .insert({
            post_id: postId,
            platform: primaryPlatform,
            caption,
            hashtags: tagArray,
            media_asset_ids: [],
            is_approved: false,
          })
          .select()
          .single()
        if (vErr) throw vErr
        if (newVer) setPlatformVersion(newVer as PostPlatformVersion)
      }

      setPost(prev => prev ? { ...prev, status, post_type: postType, platforms, scheduled_at: scheduledAt || null } : prev)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (e: any) {
      setSaveError(e.message ?? 'Failed to save post')
    } finally {
      setSaving(false)
    }
  }

  // ─── Toggle platform ────────────────────────────────────────────────────────

  function togglePlatform(p: string) {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  // ─── Upload media ───────────────────────────────────────────────────────────

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setUploadError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const newUrls: string[] = []
      for (const file of Array.from(files)) {
        const path = `media/${user.id}/${Date.now()}_${file.name}`
        const { error: upErr } = await supabase.storage.from('media').upload(path, file)
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)
        newUrls.push(urlData.publicUrl)

        // Record in media_assets
        await supabase.from('media_assets').insert({
          workspace_id: user.id,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: path,
          public_url: urlData.publicUrl,
          rights_status: 'owned',
          tags: [],
          uploaded_by: user.id,
        })
      }
      setMediaUrls(prev => [...prev, ...newUrls])
    } catch (e: any) {
      setUploadError(e.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function removeMedia(url: string) {
    setMediaUrls(prev => prev.filter(u => u !== url))
  }

  // ─── AI generate caption ────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'caption',
          topic: aiPrompt,
          platform: platforms[0] ?? 'instagram',
          post_type: postType,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Server error ${res.status}`)
      }
      const data = await res.json()
      const results: GeneratedCaption[] = []
      if (data.caption) results.push({ id: `cap-${Date.now()}`, text: data.caption })
      if (data.short_caption) results.push({ id: `short-${Date.now()}`, text: data.short_caption })
      if (Array.isArray(data.hooks)) {
        data.hooks.slice(0, 3).forEach((h: string, i: number) => {
          results.push({ id: `hook-${i}-${Date.now()}`, text: h })
        })
      }
      setAiResults(results)
    } catch (e: any) {
      setAiError(e.message ?? 'Generation failed')
    } finally {
      setAiLoading(false)
    }
  }

  // ─── Request approval ───────────────────────────────────────────────────────

  async function handleRequestApproval() {
    setRequestingApproval(true)
    setApprovalError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const workspaceId = post?.workspace_id ?? user.id

      const { data, error: err } = await supabase
        .from('approvals')
        .insert({
          workspace_id: workspaceId,
          post_id: postId,
          status: 'pending',
          requested_by: user.id,
        })
        .select()
        .single()

      if (err) throw err
      setApproval(data as Approval)

      // Update post status
      await supabase.from('content_posts').update({ status: 'pending_approval' }).eq('id', postId)
      setStatus('pending_approval')
      setPost(prev => prev ? { ...prev, status: 'pending_approval' } : prev)
    } catch (e: any) {
      setApprovalError(e.message ?? 'Failed to request approval')
    } finally {
      setRequestingApproval(false)
    }
  }

  // ─── Render loading ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-3">
          <div className="flex items-center gap-3 max-w-7xl mx-auto">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-6 w-16 ml-auto" />
          </div>
        </div>
        <div className="p-6 max-w-7xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-[1fr_400px] gap-6">
            <div className="space-y-3">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (pageError || !post) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center max-w-md">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-slate-900 mb-1">Failed to load post</h2>
          <p className="text-sm text-slate-500 mb-4">{pageError ?? 'Post not found'}</p>
          <Button variant="secondary" onClick={() => router.push('/app/studio')}>
            Back to Studio
          </Button>
        </div>
      </div>
    )
  }

  const postTitle = post.title ?? 'Untitled Post'
  const charCount = caption.length

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-3">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push('/app/studio')}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-blue-600 transition-colors shrink-0"
            >
              <ArrowLeft size={15} />
              <span className="hidden sm:inline">Studio</span>
            </button>
            <span className="text-slate-300">/</span>
            <h1 className="text-sm font-semibold text-slate-900 truncate max-w-[200px]">{postTitle}</h1>
            <Badge variant={statusBadgeVariant(status)} dot className="shrink-0">
              {status.replace('_', ' ')}
            </Badge>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {saveError && (
              <span className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle size={12} /> {saveError}
              </span>
            )}
            {saveSuccess && (
              <span className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={12} /> Saved
              </span>
            )}
            <Button
              variant="primary"
              size="sm"
              icon={<Save size={14} />}
              loading={saving}
              onClick={handleSave}
            >
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Tabs */}
        <Tabs tabs={EDITOR_TABS} active={activeTab} onChange={setActiveTab} className="mb-6" />

        {/* ── EDITOR TAB ── */}
        {activeTab === 'editor' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
            {/* Left panel */}
            <div className="space-y-5">
              {/* Caption editor */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Caption</h3>
                  <span className={cn(
                    'text-xs font-medium',
                    charCount > 2200 ? 'text-red-600' : charCount > 1800 ? 'text-amber-600' : 'text-slate-400',
                  )}>
                    {charCount.toLocaleString()} chars
                  </span>
                </div>
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder="Write your caption here…"
                  rows={10}
                  className="w-full px-3 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors placeholder:text-slate-400 leading-relaxed"
                />
              </div>

              {/* Hashtags */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
                <label className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Hash size={14} className="text-blue-600" /> Hashtags
                </label>
                <Input
                  placeholder="fitness, motivation, entrepreneur (comma-separated)"
                  value={hashtags}
                  onChange={e => setHashtags(e.target.value)}
                  hint="Enter tags separated by commas — stored as an array"
                />
                {hashtags.trim() && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {parseHashtags(hashtags).map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                        {tag.startsWith('#') ? tag : `#${tag}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Platforms */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Platforms</h3>
                <div className="flex flex-wrap gap-2">
                  {ALL_PLATFORMS.map(p => (
                    <button
                      key={p}
                      onClick={() => togglePlatform(p)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                        platforms.includes(p)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400',
                      )}
                    >
                      {PLATFORM_ICONS[p]}
                      {PLATFORM_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Post type */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <Select
                  label="Post Type"
                  value={postType}
                  onChange={e => setPostType(e.target.value)}
                  options={POST_TYPES}
                />
              </div>
            </div>

            {/* Right panel — Preview + Schedule */}
            <div className="space-y-5">
              {/* Preview card */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                  <Eye size={14} className="text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-900">Preview</h3>
                </div>
                <div className="p-4 space-y-3">
                  {/* Platform badges */}
                  {platforms.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {platforms.map(p => (
                        <span
                          key={p}
                          className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium"
                        >
                          {PLATFORM_ICONS[p]}
                          {PLATFORM_LABELS[p]}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Media thumbnail placeholder */}
                  {mediaUrls.length > 0 ? (
                    <div className="aspect-video rounded-lg overflow-hidden bg-slate-100">
                      {mediaUrls[0].match(/\.(mp4|mov|webm)$/i) ? (
                        <div className="w-full h-full flex items-center justify-center bg-slate-800">
                          <PlayCircle size={32} className="text-white opacity-70" />
                        </div>
                      ) : (
                        <img src={mediaUrls[0]} alt="Media preview" className="w-full h-full object-cover" />
                      )}
                    </div>
                  ) : (
                    <div className="aspect-video rounded-lg bg-slate-100 flex flex-col items-center justify-center gap-2">
                      <Image size={24} className="text-slate-300" />
                      <p className="text-xs text-slate-400">No media attached</p>
                    </div>
                  )}

                  {/* Caption preview */}
                  <div className="space-y-1">
                    <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap line-clamp-6">
                      {caption || <span className="text-slate-400 italic">Caption will appear here…</span>}
                    </p>
                    {hashtags.trim() && (
                      <p className="text-xs text-blue-600 line-clamp-2">
                        {parseHashtags(hashtags).map(t => t.startsWith('#') ? t : `#${t}`).join(' ')}
                      </p>
                    )}
                  </div>

                  {/* Post type chip */}
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="capitalize">{postType}</Badge>
                    {post.published_at && (
                      <span className="text-xs text-slate-400">{formatDate(post.published_at)}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Schedule section */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Calendar size={15} className="text-blue-600" />
                  <h3 className="text-sm font-semibold text-slate-900">Schedule</h3>
                </div>

                <Input
                  label="Scheduled Date & Time"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                />

                <Select
                  label="Status"
                  value={status}
                  onChange={e => setStatus(e.target.value as PostStatus)}
                  options={STATUS_OPTIONS}
                />

                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2">
                  <Shield size={13} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Caption Fox schedules posts only — it never publishes directly to social platforms without your approval.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MEDIA TAB ── */}
        {activeTab === 'media' && (
          <div className="space-y-4">
            {uploadError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" /> {uploadError}
                <button onClick={() => setUploadError(null)} className="ml-auto text-red-400 hover:text-red-600">
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Upload zone */}
            <div
              className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center hover:border-blue-300 cursor-pointer transition-colors bg-white"
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={e => handleUpload(e.target.files)}
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-slate-600">Uploading…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload size={28} className="text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">Drag & drop or click to upload media</p>
                  <p className="text-xs text-slate-400">Images and videos — stored in Supabase storage</p>
                  <Button variant="secondary" size="sm" icon={<Upload size={13} />} className="mt-2">
                    Upload Media
                  </Button>
                </div>
              )}
            </div>

            {/* Media grid */}
            {mediaUrls.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200">
                <EmptyState
                  icon={Image}
                  title="No media attached"
                  description="Upload images or videos to include in this post."
                  action={{ label: 'Upload Media', icon: <Upload size={14} />, onClick: () => fileRef.current?.click() }}
                  compact
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {mediaUrls.map((url, i) => (
                  <div key={i} className="relative group aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                    {url.match(/\.(mp4|mov|webm)$/i) ? (
                      <div className="w-full h-full flex items-center justify-center bg-slate-800">
                        <Video size={28} className="text-white opacity-70" />
                      </div>
                    ) : (
                      <img src={url} alt={`Media ${i + 1}`} className="w-full h-full object-cover" />
                    )}
                    <button
                      onClick={() => removeMedia(url)}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
                >
                  <Plus size={20} />
                  <span className="text-xs">Add more</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── AI ASSIST TAB ── */}
        {activeTab === 'ai' && (
          <div className="space-y-5 max-w-3xl">
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-violet-600" />
                <h3 className="text-sm font-semibold text-slate-900">AI Caption Generator</h3>
                <Badge variant="violet">Fox AI</Badge>
              </div>

              <Textarea
                label="Describe what you want to post about"
                placeholder="e.g. Announce our summer sale — 30% off everything. Target audience: young professionals 25–35. Tone: energetic and friendly."
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                rows={4}
              />

              {aiError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" /> {aiError}
                  <button onClick={() => setAiError(null)} className="ml-auto"><X size={12} /></button>
                </div>
              )}

              <Button
                variant="ai"
                icon={<Sparkles size={14} />}
                loading={aiLoading}
                onClick={handleGenerate}
                className="w-full"
              >
                Generate Caption
              </Button>
            </div>

            {/* Results */}
            {aiResults.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Sparkles size={14} className="text-violet-500" />
                  Generated options — click to use
                </p>
                {aiResults.map(result => (
                  <button
                    key={result.id}
                    onClick={() => setCaption(result.text)}
                    className={cn(
                      'w-full text-left p-4 bg-white rounded-xl border-2 transition-all hover:border-blue-400 hover:shadow-sm',
                      caption === result.text ? 'border-blue-500 bg-blue-50' : 'border-slate-200',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{result.text}</p>
                      {caption === result.text && (
                        <CheckCircle2 size={16} className="text-blue-600 shrink-0 mt-0.5" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">{result.text.length} chars · click to apply</p>
                  </button>
                ))}
              </div>
            )}

            {!aiLoading && aiResults.length === 0 && !aiError && (
              <div className="bg-white rounded-xl border border-slate-200">
                <EmptyState
                  icon={Sparkles}
                  title="Enter a prompt to generate captions"
                  description="Describe your product, offer, or topic. Fox AI will write multiple caption variations you can choose from."
                  compact
                />
              </div>
            )}
          </div>
        )}

        {/* ── APPROVALS TAB ── */}
        {activeTab === 'approvals' && (
          <div className="max-w-2xl space-y-5">
            {approvalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" /> {approvalError}
                <button onClick={() => setApprovalError(null)} className="ml-auto"><X size={12} /></button>
              </div>
            )}

            {/* No approval */}
            {!approval && (
              <div className="bg-white rounded-xl border border-slate-200">
                <div className="p-6 text-center space-y-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto">
                    <Shield size={22} className="text-slate-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">No approval requested</h3>
                    <p className="text-sm text-slate-500 mt-1">Request a review from your team before scheduling this post.</p>
                  </div>
                  <Button
                    variant="primary"
                    icon={<Eye size={14} />}
                    loading={requestingApproval}
                    onClick={handleRequestApproval}
                  >
                    Request Approval
                  </Button>
                </div>
              </div>
            )}

            {/* Pending approval */}
            {approval?.status === 'pending' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                    <Clock size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-amber-900">Awaiting Review</h3>
                    <p className="text-sm text-amber-700 mt-0.5">
                      Approval requested {formatRelative(approval.created_at)}.
                    </p>
                  </div>
                  <Badge variant="amber" dot className="ml-auto">Pending</Badge>
                </div>
                {approval.reviewer_id && (
                  <p className="text-xs text-amber-700 pl-13">
                    Reviewer assigned: <span className="font-semibold">{approval.reviewer_id}</span>
                  </p>
                )}
                {approval.notes && (
                  <div className="bg-amber-100 rounded-lg p-3 text-sm text-amber-800">
                    <p className="font-medium text-xs uppercase tracking-wide mb-1">Notes</p>
                    {approval.notes}
                  </div>
                )}
              </div>
            )}

            {/* Approved */}
            {approval?.status === 'approved' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-900">Post Approved</h3>
                    <p className="text-sm text-emerald-700 mt-0.5">
                      Approved {approval.reviewed_at ? formatRelative(approval.reviewed_at) : ''}.
                    </p>
                  </div>
                  <Badge variant="green" dot className="ml-auto">Approved</Badge>
                </div>
                {approval.notes && (
                  <div className="bg-emerald-100 rounded-lg p-3 text-sm text-emerald-800">
                    <p className="font-medium text-xs uppercase tracking-wide mb-1">Reviewer Notes</p>
                    {approval.notes}
                  </div>
                )}
              </div>
            )}

            {/* Rejected */}
            {approval?.status === 'rejected' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                    <XCircle size={18} className="text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-red-900">Post Rejected</h3>
                    <p className="text-sm text-red-700 mt-0.5">
                      Reviewed {approval.reviewed_at ? formatRelative(approval.reviewed_at) : ''}.
                    </p>
                  </div>
                  <Badge variant="red" dot className="ml-auto">Rejected</Badge>
                </div>
                {approval.notes && (
                  <div className="bg-red-100 rounded-lg p-3 text-sm text-red-800">
                    <p className="font-medium text-xs uppercase tracking-wide mb-1">Rejection Feedback</p>
                    {approval.notes}
                  </div>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  loading={requestingApproval}
                  onClick={handleRequestApproval}
                >
                  Re-submit for Approval
                </Button>
              </div>
            )}

            {/* Approval detail */}
            {approval && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                <h4 className="text-sm font-semibold text-slate-900">Approval Record</h4>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</dt>
                    <dd className="mt-0.5">
                      <Badge status={approval.status}>{approval.status.replace('_', ' ')}</Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Requested</dt>
                    <dd className="mt-0.5 text-slate-700">{formatRelative(approval.created_at)}</dd>
                  </div>
                  {approval.reviewed_at && (
                    <div>
                      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Reviewed</dt>
                      <dd className="mt-0.5 text-slate-700">{formatRelative(approval.reviewed_at)}</dd>
                    </div>
                  )}
                  {approval.reviewer_id && (
                    <div>
                      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Reviewer</dt>
                      <dd className="mt-0.5 text-slate-700">{approval.reviewer_id}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === 'history' && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {auditLogs.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="No history yet"
                  description="Changes made to this post will be recorded here."
                  compact
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {auditLogs.map((log, i) => (
                    <div key={log.id} className="flex items-start gap-4 px-5 py-4 relative">
                      {/* Timeline line */}
                      {i < auditLogs.length - 1 && (
                        <div className="absolute left-[28px] top-10 bottom-0 w-px bg-slate-100" />
                      )}

                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-xs font-bold text-blue-700 relative z-10">
                        {log.user_id ? log.user_id.slice(0, 2).toUpperCase() : '??'}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900">
                          <span className="font-semibold capitalize">{log.action.replace('_', ' ')}</span>
                          {' '}on{' '}
                          <span className="font-medium text-slate-600">{log.resource_type}</span>
                        </p>
                        {log.after_state && typeof log.after_state === 'object' && (
                          <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">
                            {JSON.stringify(log.after_state).slice(0, 80)}
                          </p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">{formatRelative(log.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
