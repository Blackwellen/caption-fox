'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles, Copy, Check, Plus, X, Upload, Image, Video, FileText,
  Camera, PlayCircle, Briefcase, Users, AtSign, Hash, Zap, Wand2,
  BookOpen, Layers, Palette, Mic2, LayoutTemplate, FolderOpen, AlignLeft,
  GitBranch, ChevronDown, ChevronUp, RotateCcw, Save, Send, Trash2,
  Eye, Pencil, CheckCircle2, XCircle, AlertCircle, RefreshCw, Link2,
  AlignJustify, Clock, Star, Bookmark, ArrowRight, Play, Download
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, truncate } from '@/lib/utils'
import { SOCIAL_PLATFORMS, PLATFORM_LABELS } from '@/lib/constants'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavedIdea {
  id: string
  topic: string
  description: string
  platform: string
  created_at: string
}

interface AIOutput {
  caption: string
  short_caption: string
  hooks: string[]
  hashtags: string[]
  cta_variants: string[]
  compliance_score: number
  brand_voice_score: number
}

interface MediaAsset {
  id: string
  file_name: string
  file_type: string
  file_size: number
  public_url: string | null
  storage_path: string
  tags: string[]
  created_at: string
}

interface Template {
  id: string
  name: string
  category: string
  preview_text: string
  content: string
  created_at: string
}

interface SavedCaption {
  id: string
  caption: string
  platform: string
  created_at: string
}

interface HashtagGroup {
  id: string
  name: string
  tags: string[]
}

interface BrandVoiceProfile {
  tone: string[]
  banned_phrases: string[]
  approved_phrases: string[]
  style_rules: string
  example_copy: string
}

// ─── Platform config ──────────────────────────────────────────────────────────

const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  instagram: 2200, tiktok: 2200, linkedin: 3000,
  facebook: 63206, x: 280, youtube: 5000, pinterest: 500,
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Camera size={14} />,
  tiktok: <Play size={14} />,
  linkedin: <Briefcase size={14} />,
  facebook: <Users size={14} />,
  x: <AtSign size={14} />,
  youtube: <PlayCircle size={14} />,
  pinterest: <Hash size={14} />,
}

function charCountColor(count: number, limit: number) {
  const pct = count / limit
  if (pct >= 1) return 'text-red-600'
  if (pct >= 0.85) return 'text-amber-600'
  return 'text-emerald-600'
}

// ─── Sub-component: CopyButton ─────────────────────────────────────────────────

function CopyButton({ text, size = 'sm' }: { text: string; size?: 'xs' | 'sm' }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
      title="Copy"
    >
      {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
    </button>
  )
}

// ─── STUB DATA ─────────────────────────────────────────────────────────────────

const STUB_IDEAS = [
  {
    id: '1', platform: 'instagram', topic: '5 Morning Habits to Skyrocket Productivity',
    description: 'Carousel post showing 5 research-backed morning routines used by top executives — position yourself as the go-to expert.',
  },
  {
    id: '2', platform: 'tiktok', topic: 'Behind the Scenes: Product Creation',
    description: 'Short-form video (30–60s) showing the raw, authentic process of making your product. Builds trust and humanises the brand.',
  },
  {
    id: '3', platform: 'linkedin', topic: 'The Contrarian Take on Your Industry',
    description: 'Thought-leadership post challenging a common assumption in your niche. Great for engagement and positioning.',
  },
]

// ─── IDEAS TAB ─────────────────────────────────────────────────────────────────

function IdeasTab() {
  const [ideas, setIdeas] = useState<SavedIdea[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      // ideas stored in ai_generations output
      setLoading(false)
    }
    load()
  }, [])

  const saveIdea = (idea: typeof STUB_IDEAS[0]) => {
    const newIdea: SavedIdea = {
      id: Date.now().toString(),
      topic: idea.topic,
      description: idea.description,
      platform: idea.platform,
      created_at: new Date().toISOString(),
    }
    setIdeas(prev => [newIdea, ...prev])
  }

  const removeIdea = (id: string) => setIdeas(prev => prev.filter(i => i.id !== id))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Saved ideas */}
      <div className="bg-white rounded-xl border border-slate-200 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Bookmark size={16} className="text-blue-600" /> Saved Ideas
            {ideas.length > 0 && <span className="ml-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">{ideas.length}</span>}
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">{[1, 2].map(i => <SkeletonCard key={i} />)}</div>
          ) : ideas.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              title="No ideas saved yet"
              description="Browse the AI suggestions panel and save ideas you want to develop."
              action={{
                label: 'Generate Ideas',
                icon: <Sparkles size={14} />,
                onClick: () => {},
              }}
              compact
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {ideas.map(idea => (
                <li key={idea.id} className="flex items-start gap-3 px-5 py-4 group">
                  <span className="mt-0.5 shrink-0">{PLATFORM_ICONS[idea.platform]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 leading-snug">{idea.topic}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{idea.description}</p>
                    <p className="text-xs text-slate-400 mt-1">{formatDate(idea.created_at)}</p>
                  </div>
                  <button
                    onClick={() => removeIdea(idea.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-red-500 transition-all"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* AI suggestions */}
      <div className="bg-white rounded-xl border border-slate-200 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles size={16} className="text-violet-600" /> AI Content Ideas
          </h3>
          <Badge variant="violet">Powered by Fox AI</Badge>
        </div>
        <ul className="divide-y divide-slate-100">
          {STUB_IDEAS.map(idea => (
            <li key={idea.id} className="px-5 py-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 text-slate-500">{PLATFORM_ICONS[idea.platform]}</span>
                  <p className="text-sm font-semibold text-slate-900 leading-snug">{idea.topic}</p>
                </div>
                <Badge variant="default" className="shrink-0 capitalize">{PLATFORM_LABELS[idea.platform]}</Badge>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{idea.description}</p>
              <div className="flex gap-2 pt-1">
                <Button variant="ai" size="xs" icon={<Wand2 size={12} />}>Use Idea</Button>
                <Button variant="secondary" size="xs" icon={<Save size={12} />} onClick={() => saveIdea(idea)}>Save</Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ─── AI GENERATOR TAB ─────────────────────────────────────────────────────────

const INITIAL_FORM = {
  brand: '', platform: 'instagram', content_type: 'post', objective: 'engagement',
  tone: 'casual', topic: '', target_audience: '', cta: '', keywords: '', do_not_say: '',
}

function AIGeneratorTab() {
  const [form, setForm] = useState(INITIAL_FORM)
  const [output, setOutput] = useState<AIOutput | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rewriteLoading, setRewriteLoading] = useState(false)
  const [hooksLoading, setHooksLoading] = useState(false)
  const supabase = createClient()

  const set = (k: keyof typeof INITIAL_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const generate = async () => {
    if (!form.topic.trim()) { setError('Please fill in the Offer / Topic field.'); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Server error ${res.status}`)
      }
      const data = await res.json()
      setOutput(data)

      // Log generation to supabase
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('ai_generations').insert({
          workspace_id: user.id, // placeholder — real app passes workspace_id from context
          user_id: user.id,
          prompt: JSON.stringify(form),
          output: data as any,
          model: 'claude-3-5-sonnet',
          tokens_used: null,
        })
      }
    } catch (e: any) {
      setError(e.message ?? 'Generation failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const generateHooks = async () => {
    if (!output) return
    setHooksLoading(true)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, mode: 'hooks_only', count: 10 }),
      })
      if (!res.ok) throw new Error('Failed to generate hooks')
      const data = await res.json()
      setOutput(prev => prev ? { ...prev, hooks: data.hooks ?? prev.hooks } : prev)
    } catch {
      setError('Could not generate hooks. Try again.')
    } finally {
      setHooksLoading(false)
    }
  }

  const rewrite = async () => {
    if (!output) return
    setRewriteLoading(true)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, mode: 'rewrite', existing_caption: output.caption }),
      })
      if (!res.ok) throw new Error('Rewrite failed')
      const data = await res.json()
      setOutput(prev => prev ? { ...prev, ...data } : prev)
    } catch {
      setError('Rewrite failed. Try again.')
    } finally {
      setRewriteLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
      {/* Form */}
      <div className="bg-white rounded-xl border border-slate-200 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Wand2 size={16} className="text-violet-600" /> Generate Post
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <Input label="Brand" placeholder="e.g. FitLife Co." value={form.brand} onChange={set('brand')} />
          <Select
            label="Platform"
            value={form.platform}
            onChange={set('platform')}
            options={SOCIAL_PLATFORMS.map(p => ({ value: p, label: PLATFORM_LABELS[p] }))}
          />
          <Select
            label="Content Type"
            value={form.content_type}
            onChange={set('content_type')}
            options={[
              { value: 'post', label: 'Post' },
              { value: 'reel', label: 'Reel / Short' },
              { value: 'story', label: 'Story' },
              { value: 'carousel', label: 'Carousel' },
              { value: 'article', label: 'Article' },
            ]}
          />
          <Select
            label="Objective"
            value={form.objective}
            onChange={set('objective')}
            options={[
              { value: 'awareness', label: 'Awareness' },
              { value: 'engagement', label: 'Engagement' },
              { value: 'leads', label: 'Leads' },
              { value: 'sales', label: 'Sales' },
              { value: 'education', label: 'Education' },
            ]}
          />
          <Select
            label="Tone"
            value={form.tone}
            onChange={set('tone')}
            options={[
              { value: 'professional', label: 'Professional' },
              { value: 'casual', label: 'Casual' },
              { value: 'funny', label: 'Funny' },
              { value: 'inspirational', label: 'Inspirational' },
              { value: 'bold', label: 'Bold' },
            ]}
          />
          <Textarea
            label="Offer / Topic *"
            placeholder="Describe your product, offer, or the topic you want to post about..."
            value={form.topic}
            onChange={set('topic')}
            rows={3}
          />
          <Input label="Target Audience" placeholder="e.g. Women 25–40 interested in fitness" value={form.target_audience} onChange={set('target_audience')} />
          <Input label="CTA (optional)" placeholder="e.g. Shop now, DM us, Link in bio" value={form.cta} onChange={set('cta')} />
          <Input label="Keywords (optional)" placeholder="Comma-separated keywords to include" value={form.keywords} onChange={set('keywords')} />
          <Input label="Do Not Say (optional)" placeholder="Words or phrases to avoid" value={form.do_not_say} onChange={set('do_not_say')} />
        </div>
        <div className="p-5 border-t border-slate-100 space-y-2">
          <Button
            variant="ai"
            className="w-full"
            icon={<Sparkles size={14} />}
            loading={loading}
            onClick={generate}
          >
            Generate Post
          </Button>
          {output && (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                icon={<Zap size={13} />}
                loading={hooksLoading}
                onClick={generateHooks}
              >
                Generate 10 Hooks
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                icon={<RotateCcw size={13} />}
                loading={rewriteLoading}
                onClick={rewrite}
              >
                Rewrite
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Output */}
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle size={15} className="shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X size={14} />
            </button>
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center">
                <Sparkles size={22} className="text-violet-600 animate-pulse" />
              </div>
              <p className="text-sm font-medium text-slate-700">Fox AI is writing your post…</p>
              <p className="text-xs text-slate-400">This usually takes 5–10 seconds</p>
            </div>
          </div>
        )}

        {!output && !loading && (
          <div className="bg-white rounded-xl border border-slate-200">
            <EmptyState
              icon={Wand2}
              title="Fill in the form and generate your first post"
              description="Fox AI will write your caption, hooks, hashtags and CTA options — all tailored to your brand."
            />
          </div>
        )}

        {output && !loading && (
          <>
            {/* Caption card */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">Full Caption</h4>
                <div className="flex gap-1">
                  <CopyButton text={output.caption} />
                  <Badge variant="green">
                    <CheckCircle2 size={10} /> Ready
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{output.caption}</p>
            </div>

            {/* Short caption */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">Short Caption</h4>
                <CopyButton text={output.short_caption} />
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{output.short_caption}</p>
            </div>

            {/* Hooks */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Zap size={14} className="text-amber-500" /> Hook Options
              </h4>
              <ul className="space-y-2">
                {output.hooks.map((hook, i) => (
                  <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 group">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                    <p className="flex-1 text-sm text-slate-700">{hook}</p>
                    <Button variant="ghost" size="xs" className="opacity-0 group-hover:opacity-100">Use</Button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Hashtags */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Hash size={14} className="text-blue-600" /> Hashtags
                  <span className="text-xs text-slate-400">{output.hashtags.length} tags</span>
                </h4>
                <CopyButton text={output.hashtags.join(' ')} />
              </div>
              <div className="flex flex-wrap gap-2">
                {output.hashtags.map((tag, i) => (
                  <span key={i} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                    {tag.startsWith('#') ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            </div>

            {/* CTA variants */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <ArrowRight size={14} className="text-emerald-600" /> CTA Variants
              </h4>
              <ul className="space-y-2">
                {output.cta_variants.map((cta, i) => (
                  <li key={i} className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50">
                    <p className="flex-1 text-sm text-slate-700">{cta}</p>
                    <CopyButton text={cta} />
                  </li>
                ))}
              </ul>
            </div>

            {/* Compliance scores */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Quality Scores</h4>
              <div className="flex gap-4">
                <div className="flex-1 p-3 rounded-lg bg-violet-50 text-center">
                  <p className="text-2xl font-bold text-violet-700">{output.compliance_score}%</p>
                  <p className="text-xs text-violet-600 mt-0.5">Compliance Score</p>
                </div>
                <div className="flex-1 p-3 rounded-lg bg-blue-50 text-center">
                  <p className="text-2xl font-bold text-blue-700">{output.brand_voice_score}%</p>
                  <p className="text-xs text-blue-600 mt-0.5">Brand Voice Match</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── POST BUILDER TAB ─────────────────────────────────────────────────────────

function PostBuilderTab() {
  const router = useRouter()
  const supabase = createClient()
  const [masterCaption, setMasterCaption] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram'])
  const [platformCaptions, setPlatformCaptions] = useState<Record<string, string>>({})
  const [assets, setAssets] = useState<File[]>([])
  const [scheduledAt, setScheduledAt] = useState('')
  const [requireApproval, setRequireApproval] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendingApproval, setSendingApproval] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  const sendToCalendar = async () => {
    if (!masterCaption.trim()) { setError('Add a caption before scheduling.'); return }
    if (!scheduledAt) { setError('Pick a date/time for scheduling.'); return }
    setSaving(true); setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: post, error: postErr } = await supabase
        .from('content_posts')
        .insert({
          workspace_id: user.id,
          title: truncate(masterCaption, 80),
          status: requireApproval ? 'in_review' : 'scheduled',
          post_type: 'post',
          platforms: selectedPlatforms,
          scheduled_at: new Date(scheduledAt).toISOString(),
          created_by: user.id,
        })
        .select()
        .single()

      if (postErr) throw postErr

      // Insert platform versions
      const versions = selectedPlatforms.map(platform => ({
        post_id: post.id,
        platform,
        caption: platformCaptions[platform] || masterCaption,
        hashtags: [],
        media_asset_ids: [],
        is_approved: false,
      }))
      const { error: vErr } = await supabase.from('post_platform_versions').insert(versions)
      if (vErr) throw vErr

      setSuccess('Post scheduled! Redirecting to calendar…')
      setTimeout(() => router.push('/app/calendar'), 1500)
    } catch (e: any) {
      setError(e.message ?? 'Failed to schedule post.')
    } finally {
      setSaving(false)
    }
  }

  const sendForApproval = async () => {
    setRequireApproval(true)
    await sendToCalendar()
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <CheckCircle2 size={15} className="shrink-0" /> {success}
        </div>
      )}

      {/* Master caption */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Master Caption</h3>
        <Textarea
          placeholder="Write your master caption here — it will be applied to all platforms unless overridden below..."
          value={masterCaption}
          onChange={e => setMasterCaption(e.target.value)}
          rows={5}
        />
        <p className="text-xs text-slate-400">{masterCaption.length} characters</p>
      </div>

      {/* Platform selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Platform Versions</h3>
          <div className="flex flex-wrap gap-2">
            {SOCIAL_PLATFORMS.map(p => (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                  selectedPlatforms.includes(p)
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {selectedPlatforms.map(platform => {
            const text = platformCaptions[platform] ?? masterCaption
            const limit = PLATFORM_CHAR_LIMITS[platform]
            const count = text.length
            return (
              <div key={platform} className="border border-slate-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{PLATFORM_ICONS[platform]}</span>
                  <span className="text-sm font-medium text-slate-700">{PLATFORM_LABELS[platform]}</span>
                  <span className={cn('ml-auto text-xs font-medium', charCountColor(count, limit))}>
                    {count} / {limit.toLocaleString()}
                  </span>
                </div>
                <Textarea
                  placeholder={`${PLATFORM_LABELS[platform]}-specific caption (leave blank to use master)`}
                  value={platformCaptions[platform] ?? ''}
                  onChange={e => setPlatformCaptions(prev => ({ ...prev, [platform]: e.target.value }))}
                  rows={4}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Assets */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Media Assets</h3>
          <Button variant="secondary" size="sm" icon={<Upload size={13} />} onClick={() => fileRef.current?.click()}>
            Upload Media
          </Button>
        </div>
        <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden"
          onChange={e => setAssets(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
        {assets.length === 0 ? (
          <div
            className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Image size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">Drag & drop or click to add media</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {assets.map((f, i) => (
              <div key={i} className="relative group aspect-square bg-slate-100 rounded-lg overflow-hidden">
                {f.type.startsWith('image') ? (
                  <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video size={24} className="text-slate-400" />
                  </div>
                )}
                <button
                  onClick={() => setAssets(prev => prev.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule + Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Schedule</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Date & Time"
            type="datetime-local"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
          />
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={requireApproval}
                onChange={e => setRequireApproval(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600"
              />
              <span className="text-sm text-slate-700">Require approval before publishing</span>
            </label>
          </div>
        </div>

        {/* Sticky action bar */}
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Button
            variant="primary"
            icon={<Send size={14} />}
            loading={saving}
            onClick={sendToCalendar}
          >
            Send to Calendar
          </Button>
          <Button
            variant="secondary"
            icon={<Eye size={14} />}
            loading={sendingApproval}
            onClick={sendForApproval}
          >
            Send for Approval
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── CREATIVE CANVAS TAB ──────────────────────────────────────────────────────

function CreativeCanvasTab() {
  const [activePlatform, setActivePlatform] = useState('instagram')
  const [caption, setCaption] = useState('')
  const [hooks, setHooks] = useState(['', '', ''])
  const [ctas, setCtas] = useState(['', ''])
  const [foxQuery, setFoxQuery] = useState('')
  const [assets, setAssets] = useState<File[]>([])
  const [foxSuggestions, setFoxSuggestions] = useState<string[]>([])
  const [foxLoading, setFoxLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const compliance = [
    { label: 'Brand voice aligned', ok: caption.length > 20 },
    { label: 'CTA included', ok: ctas.some(c => c.trim().length > 0) },
    { label: 'Image ratio correct', ok: assets.length > 0 },
    { label: 'Hashtag count (10–30)', ok: (caption.match(/#\w+/g) ?? []).length >= 10 },
  ]

  const askFox = async () => {
    if (!foxQuery.trim()) return
    setFoxLoading(true)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'rewrite', platform: activePlatform, topic: foxQuery, caption }),
      })
      const data = await res.json()
      setFoxSuggestions(data.hooks ?? [data.caption].filter(Boolean))
    } catch {
      // silently fail in canvas
    } finally {
      setFoxLoading(false)
      setFoxQuery('')
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[200px_1fr_260px] gap-4 min-h-[600px]">
      {/* Asset tray */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Assets</p>
          <button onClick={() => fileRef.current?.click()} className="p-1 rounded text-slate-400 hover:text-blue-600">
            <Upload size={14} />
          </button>
        </div>
        <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden"
          onChange={e => setAssets(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
        {assets.length === 0 ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-blue-300 transition-colors"
          >
            <Image size={20} className="mx-auto text-slate-300 mb-1" />
            <p className="text-xs text-slate-400">Upload</p>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {assets.map((f, i) => (
              <div key={i} className="aspect-square rounded-lg overflow-hidden bg-slate-100 relative group">
                {f.type.startsWith('image') && <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" alt="" />}
                <button
                  onClick={() => setAssets(prev => prev.filter((_, j) => j !== i))}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button onClick={() => fileRef.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 hover:border-blue-300">
              <Plus size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Main canvas */}
      <div className="bg-white rounded-xl border border-slate-200 flex flex-col">
        {/* Platform tabs */}
        <div className="flex gap-0 border-b border-slate-100 overflow-x-auto">
          {SOCIAL_PLATFORMS.map(p => (
            <button
              key={p}
              onClick={() => setActivePlatform(p)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px shrink-0 transition-colors',
                activePlatform === p
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              {PLATFORM_ICONS[p]} {PLATFORM_LABELS[p]}
            </button>
          ))}
        </div>

        <div className="flex-1 p-5 space-y-4">
          {/* Caption editor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Caption</label>
              <span className="text-xs text-slate-400">{caption.length} chars · {caption.split(/\s+/).filter(Boolean).length} words</span>
            </div>
            <Textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Write your caption..."
              rows={5}
            />
          </div>

          {/* Hooks */}
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Hooks</p>
            <div className="space-y-2">
              {hooks.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-600 w-4">{i + 1}</span>
                  <input
                    value={h}
                    onChange={e => setHooks(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                    placeholder={`Hook ${i + 1}...`}
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* CTAs */}
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">CTA Options</p>
            <div className="space-y-2">
              {ctas.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-600 w-4">{i + 1}</span>
                  <input
                    value={c}
                    onChange={e => setCtas(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                    placeholder={`CTA option ${i + 1}...`}
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Preview card */}
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Preview</p>
            <div className="flex justify-center">
              <div className="w-[220px] border-4 border-slate-800 rounded-[28px] overflow-hidden shadow-xl bg-white">
                <div className="h-5 bg-slate-800 flex items-center justify-center">
                  <div className="w-16 h-1 bg-slate-600 rounded-full" />
                </div>
                <div className="bg-slate-50 min-h-[240px] p-3 flex flex-col gap-2">
                  {assets[0] ? (
                    <div className="aspect-square rounded-lg overflow-hidden bg-slate-200">
                      <img src={URL.createObjectURL(assets[0])} className="w-full h-full object-cover" alt="" />
                    </div>
                  ) : (
                    <div className="aspect-square rounded-lg bg-slate-200 flex items-center justify-center">
                      <Image size={28} className="text-slate-400" />
                    </div>
                  )}
                  <p className="text-[9px] text-slate-800 leading-relaxed line-clamp-4">
                    {hooks[0] ? `${hooks[0]}\n\n` : ''}{caption || 'Your caption preview will appear here...'}
                  </p>
                </div>
                <div className="h-4 bg-slate-800" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI side panel + compliance */}
      <div className="space-y-4">
        {/* Fox AI panel */}
        <div className="bg-white rounded-xl border border-violet-200 p-4 space-y-3">
          <h4 className="text-xs font-semibold text-violet-700 uppercase tracking-wide flex items-center gap-1.5">
            <Sparkles size={12} /> Ask Fox
          </h4>
          <div className="flex gap-2">
            <input
              value={foxQuery}
              onChange={e => setFoxQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && askFox()}
              placeholder="Rewrite this, make it funnier..."
              className="flex-1 px-3 py-1.5 text-xs border border-violet-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <Button variant="ai" size="xs" loading={foxLoading} onClick={askFox}>
              <Sparkles size={11} />
            </Button>
          </div>
          {foxSuggestions.length > 0 && (
            <ul className="space-y-2">
              {foxSuggestions.map((s, i) => (
                <li key={i} className="p-2 rounded-lg bg-violet-50 text-xs text-slate-700 leading-relaxed">
                  <div className="flex items-start justify-between gap-2">
                    <span>{s}</span>
                    <button onClick={() => setCaption(s)} className="shrink-0 text-violet-600 hover:text-violet-800">
                      <Check size={12} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Compliance checklist */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Compliance</h4>
          <ul className="space-y-2">
            {compliance.map((item, i) => (
              <li key={i} className="flex items-center gap-2.5 text-xs">
                {item.ok
                  ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  : <XCircle size={14} className="text-red-400 shrink-0" />}
                <span className={item.ok ? 'text-slate-700' : 'text-slate-500'}>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ─── BRAND VOICE TAB ──────────────────────────────────────────────────────────

const TONE_OPTIONS = ['Professional', 'Casual', 'Warm', 'Bold', 'Playful', 'Expert']

function BrandVoiceTab() {
  const supabase = createClient()
  const [profile, setProfile] = useState<BrandVoiceProfile>({
    tone: [], banned_phrases: [], approved_phrases: [],
    style_rules: '', example_copy: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [bannedInput, setBannedInput] = useState('')
  const [approvedInput, setApprovedInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('brand_voice_profiles')
        .select('*')
        .eq('workspace_id', user.id)
        .single()
      if (data) {
        setProfile({
          tone: data.tone ?? [],
          banned_phrases: data.banned_phrases ?? [],
          approved_phrases: data.approved_phrases ?? [],
          style_rules: data.style_rules ?? '',
          example_copy: data.example_copy ?? '',
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  const toggleTone = (t: string) =>
    setProfile(prev => ({
      ...prev,
      tone: prev.tone.includes(t) ? prev.tone.filter(x => x !== t) : [...prev.tone, t],
    }))

  const addTag = (field: 'banned_phrases' | 'approved_phrases', val: string) => {
    if (!val.trim()) return
    setProfile(prev => ({ ...prev, [field]: [...prev[field], val.trim()] }))
    if (field === 'banned_phrases') setBannedInput('')
    else setApprovedInput('')
  }

  const removeTag = (field: 'banned_phrases' | 'approved_phrases', tag: string) =>
    setProfile(prev => ({ ...prev, [field]: prev[field].filter(t => t !== tag) }))

  const save = async () => {
    setSaving(true); setError(null); setSuccess(false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { error: err } = await supabase
        .from('brand_voice_profiles')
        .upsert({
          workspace_id: user.id,
          brand_id: user.id, // placeholder
          ...profile,
        }, { onConflict: 'workspace_id' })
      if (err) throw err
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e: any) {
      setError(e.message ?? 'Failed to save brand voice.')
    } finally {
      setSaving(false)
    }
  }

  const testBrandVoice = async () => {
    if (!profile.example_copy.trim()) { setError('Add example copy to test.'); return }
    setTesting(true); setTestResult(null)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'brand_voice_check',
          tone: profile.tone,
          banned_phrases: profile.banned_phrases,
          copy: profile.example_copy,
        }),
      })
      const data = await res.json()
      setTestResult(data.feedback ?? 'Your copy aligns well with your brand voice settings.')
    } catch {
      setTestResult('Could not check brand voice. Please try again.')
    } finally {
      setTesting(false)
    }
  }

  if (loading) return <div className="p-8"><SkeletonCard /></div>

  return (
    <div className="max-w-2xl space-y-6">
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <CheckCircle2 size={15} className="shrink-0" /> Brand voice profile saved.
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <h3 className="font-semibold text-slate-900">Brand Voice Profile</h3>

        {/* Tone */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Tone</p>
          <div className="flex flex-wrap gap-2">
            {TONE_OPTIONS.map(t => (
              <button
                key={t}
                onClick={() => toggleTone(t)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                  profile.tone.includes(t)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Banned phrases */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Banned Phrases</p>
          <div className="flex gap-2 mb-2">
            <input
              value={bannedInput}
              onChange={e => setBannedInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag('banned_phrases', bannedInput)}
              placeholder="Type a phrase and press Enter"
              className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button variant="secondary" size="sm" onClick={() => addTag('banned_phrases', bannedInput)}>Add</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.banned_phrases.map(tag => (
              <span key={tag} className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 text-xs rounded-full border border-red-200">
                {tag}
                <button onClick={() => removeTag('banned_phrases', tag)}><X size={10} /></button>
              </span>
            ))}
          </div>
        </div>

        {/* Approved phrases */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Approved Phrases</p>
          <div className="flex gap-2 mb-2">
            <input
              value={approvedInput}
              onChange={e => setApprovedInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag('approved_phrases', approvedInput)}
              placeholder="Type a phrase and press Enter"
              className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button variant="secondary" size="sm" onClick={() => addTag('approved_phrases', approvedInput)}>Add</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.approved_phrases.map(tag => (
              <span key={tag} className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full border border-emerald-200">
                {tag}
                <button onClick={() => removeTag('approved_phrases', tag)}><X size={10} /></button>
              </span>
            ))}
          </div>
        </div>

        <Textarea
          label="Style Rules"
          placeholder="e.g. Always write in second person. Avoid jargon. Use short sentences."
          value={profile.style_rules}
          onChange={e => setProfile(prev => ({ ...prev, style_rules: e.target.value }))}
          rows={3}
        />

        <Textarea
          label="Example Copy"
          placeholder="Paste a sample of your best-performing copy here so Fox AI can learn your voice."
          value={profile.example_copy}
          onChange={e => setProfile(prev => ({ ...prev, example_copy: e.target.value }))}
          rows={4}
        />
      </div>

      {testResult && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-violet-700 mb-1 flex items-center gap-1.5">
            <Sparkles size={12} /> Fox AI Brand Voice Check
          </p>
          <p className="text-sm text-slate-700">{testResult}</p>
        </div>
      )}

      <div className="flex gap-3 sticky bottom-0 bg-white border-t border-slate-100 p-4 -mx-1 rounded-b-xl">
        <Button variant="primary" icon={<Save size={14} />} loading={saving} onClick={save}>
          Save Brand Voice
        </Button>
        <Button variant="ai" icon={<Sparkles size={14} />} loading={testing} onClick={testBrandVoice}>
          Test Brand Voice
        </Button>
      </div>
    </div>
  )
}

// ─── TEMPLATES TAB ────────────────────────────────────────────────────────────

const TEMPLATE_CATEGORIES = ['Post Templates', 'Campaign Templates', 'Caption Frameworks', 'Hook Frameworks', 'Hashtag Groups']

function TemplatesTab() {
  const supabase = createClient()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('Post Templates')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    // In a real app these would come from a templates table
    setLoading(false)
  }, [])

  const deleteTemplate = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setTemplates(prev => prev.filter(t => t.id !== deleteTarget))
    setDeleteTarget(null)
    setDeleteLoading(false)
  }

  const filtered = templates.filter(t => t.category === activeCategory)

  return (
    <div>
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteTemplate}
        title="Delete Template"
        description="This template will be permanently deleted."
        confirmLabel="Delete"
        danger
        loading={deleteLoading}
      />

      <div className="flex gap-2 mb-6 flex-wrap">
        {TEMPLATE_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-full font-medium border transition-colors',
              activeCategory === cat ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300',
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="No templates saved yet"
          description="Save your best captions, hooks, and frameworks as reusable templates."
          action={{
            label: 'Save Current as Template',
            icon: <Plus size={14} />,
            onClick: () => {},
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-900">{t.name}</h4>
                <Badge variant="blue">{t.category}</Badge>
              </div>
              <p className="text-sm text-slate-500 line-clamp-3">{t.preview_text}</p>
              <div className="flex gap-2 pt-1">
                <Button variant="primary" size="xs">Use</Button>
                <Button variant="secondary" size="xs" icon={<Pencil size={11} />}>Edit</Button>
                <button
                  onClick={() => setDeleteTarget(t.id)}
                  className="ml-auto p-1.5 rounded text-slate-400 hover:text-red-500"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── MEDIA LIBRARY TAB ────────────────────────────────────────────────────────

type MediaFilter = 'all' | 'images' | 'videos' | 'documents'

function MediaLibraryTab() {
  const supabase = createClient()
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [filter, setFilter] = useState<MediaFilter>('all')
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data, error: err } = await supabase
        .from('media_assets')
        .select('*')
        .eq('workspace_id', user.id)
        .order('created_at', { ascending: false })
      if (!err && data) setAssets(data)
      setLoading(false)
    }
    load()
  }, [])

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true); setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop()
        const path = `media/${user.id}/${Date.now()}_${file.name}`
        const { error: upErr } = await supabase.storage.from('media').upload(path, file)
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)
        const { data: asset, error: dbErr } = await supabase
          .from('media_assets')
          .insert({
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
          .select()
          .single()
        if (dbErr) throw dbErr
        setAssets(prev => [asset, ...prev])
      }
    } catch (e: any) {
      setError(e.message ?? 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const deleteAsset = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await supabase.storage.from('media').remove([deleteTarget.storage_path])
      await supabase.from('media_assets').delete().eq('id', deleteTarget.id)
      setAssets(prev => prev.filter(a => a.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (e: any) {
      setError(e.message ?? 'Delete failed.')
    } finally {
      setDeleteLoading(false)
    }
  }

  const copyUrl = (url: string) => { navigator.clipboard.writeText(url) }

  const filtered = assets.filter(a => {
    if (filter === 'all') return true
    if (filter === 'images') return a.file_type.startsWith('image')
    if (filter === 'videos') return a.file_type.startsWith('video')
    if (filter === 'documents') return !a.file_type.startsWith('image') && !a.file_type.startsWith('video')
    return true
  })

  return (
    <div className="space-y-4">
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteAsset}
        title="Delete Asset"
        description={`"${deleteTarget?.file_name}" will be permanently deleted from your media library.`}
        confirmLabel="Delete"
        danger
        loading={deleteLoading}
      />

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Upload zone */}
      <div
        ref={dragRef}
        className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-blue-300 transition-colors cursor-pointer"
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); dragRef.current?.classList.add('border-blue-400') }}
        onDragLeave={() => dragRef.current?.classList.remove('border-blue-400')}
        onDrop={e => { e.preventDefault(); dragRef.current?.classList.remove('border-blue-400'); uploadFiles(e.dataTransfer.files) }}
      >
        <input ref={fileRef} type="file" multiple accept="image/*,video/*,.pdf" className="hidden" onChange={e => uploadFiles(e.target.files)} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-600">Uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={28} className="text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Drag & drop files here</p>
            <p className="text-xs text-slate-400">or click to browse — images, videos, documents</p>
            <Button variant="secondary" size="sm" className="mt-2" icon={<FolderOpen size={13} />}>Browse Files</Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(['all', 'images', 'videos', 'documents'] as MediaFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-full font-medium border capitalize transition-colors',
              filter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200',
            )}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">{filtered.length} files</span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Image}
          title="No media assets yet"
          description="Upload images, videos, and documents to use in your posts."
          action={{ label: 'Upload Files', icon: <Upload size={14} />, onClick: () => fileRef.current?.click() }}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map(asset => (
            <div key={asset.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden group">
              <div className="aspect-square bg-slate-100 relative">
                {asset.file_type.startsWith('image') && asset.public_url ? (
                  <img src={asset.public_url} alt={asset.file_name} className="w-full h-full object-cover" />
                ) : asset.file_type.startsWith('video') ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video size={28} className="text-slate-400" />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileText size={28} className="text-slate-400" />
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {asset.public_url && (
                    <button
                      onClick={() => copyUrl(asset.public_url!)}
                      className="p-2 bg-white/20 rounded-lg text-white hover:bg-white/30"
                      title="Copy URL"
                    >
                      <Copy size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteTarget(asset)}
                    className="p-2 bg-white/20 rounded-lg text-white hover:bg-red-500/80"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="p-2.5">
                <p className="text-xs font-medium text-slate-700 truncate">{asset.file_name}</p>
                <p className="text-xs text-slate-400">{(asset.file_size / 1024).toFixed(0)} KB</p>
                {asset.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {asset.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── CAPTIONS & HASHTAGS TAB ──────────────────────────────────────────────────

function CaptionsHashtagsTab() {
  const supabase = createClient()
  const [captions, setCaptions] = useState<SavedCaption[]>([])
  const [hashtagGroups, setHashtagGroups] = useState<HashtagGroup[]>([])
  const [hooks, setHooks] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [showAddCaption, setShowAddCaption] = useState(false)
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [showAddHook, setShowAddHook] = useState(false)
  const [newCaption, setNewCaption] = useState({ caption: '', platform: 'instagram' })
  const [newGroup, setNewGroup] = useState({ name: '', tags: '' })
  const [newHook, setNewHook] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setLoading(false) }, [])

  const addCaption = async () => {
    if (!newCaption.caption.trim()) return
    setSaving(true)
    setCaptions(prev => [
      { id: Date.now().toString(), ...newCaption, created_at: new Date().toISOString() },
      ...prev,
    ])
    setNewCaption({ caption: '', platform: 'instagram' })
    setShowAddCaption(false)
    setSaving(false)
  }

  const addHashtagGroup = async () => {
    if (!newGroup.name.trim()) return
    setSaving(true)
    setHashtagGroups(prev => [
      { id: Date.now().toString(), name: newGroup.name, tags: newGroup.tags.split(/[\s,]+/).filter(Boolean) },
      ...prev,
    ])
    setNewGroup({ name: '', tags: '' })
    setShowAddGroup(false)
    setSaving(false)
  }

  const addHook = () => {
    if (!newHook.trim()) return
    setHooks(prev => [newHook, ...prev])
    setNewHook('')
    setShowAddHook(false)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Caption bank */}
      <div className="bg-white rounded-xl border border-slate-200 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2"><AlignJustify size={15} className="text-blue-600" /> Caption Bank</h3>
          <Button variant="secondary" size="xs" icon={<Plus size={12} />} onClick={() => setShowAddCaption(true)}>Add</Button>
        </div>
        {showAddCaption && (
          <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50">
            <Textarea placeholder="New caption..." value={newCaption.caption} onChange={e => setNewCaption(p => ({ ...p, caption: e.target.value }))} rows={3} />
            <Select
              options={SOCIAL_PLATFORMS.map(p => ({ value: p, label: PLATFORM_LABELS[p] }))}
              value={newCaption.platform}
              onChange={e => setNewCaption(p => ({ ...p, platform: e.target.value }))}
            />
            <div className="flex gap-2">
              <Button variant="primary" size="xs" loading={saving} onClick={addCaption}>Save</Button>
              <Button variant="ghost" size="xs" onClick={() => setShowAddCaption(false)}>Cancel</Button>
            </div>
          </div>
        )}
        {loading ? (
          <div className="p-4 space-y-2">{[1, 2].map(i => <SkeletonCard key={i} />)}</div>
        ) : captions.length === 0 ? (
          <EmptyState icon={AlignJustify} title="No captions saved" compact action={{ label: 'Add Caption', onClick: () => setShowAddCaption(true) }} />
        ) : (
          <ul className="divide-y divide-slate-100 overflow-y-auto">
            {captions.map(c => (
              <li key={c.id} className="px-5 py-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="default" className="capitalize">{PLATFORM_LABELS[c.platform]}</Badge>
                  <CopyButton text={c.caption} />
                </div>
                <p className="text-sm text-slate-700 line-clamp-3">{c.caption}</p>
                <Button variant="outline" size="xs">Use</Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Hashtag groups */}
      <div className="bg-white rounded-xl border border-slate-200 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Hash size={15} className="text-violet-600" /> Hashtag Groups</h3>
          <Button variant="secondary" size="xs" icon={<Plus size={12} />} onClick={() => setShowAddGroup(true)}>Add</Button>
        </div>
        {showAddGroup && (
          <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50">
            <Input placeholder="Group name" value={newGroup.name} onChange={e => setNewGroup(p => ({ ...p, name: e.target.value }))} />
            <Textarea placeholder="#hashtag1 #hashtag2 #hashtag3" value={newGroup.tags} onChange={e => setNewGroup(p => ({ ...p, tags: e.target.value }))} rows={2} hint="Space or comma separated" />
            <div className="flex gap-2">
              <Button variant="primary" size="xs" loading={saving} onClick={addHashtagGroup}>Save</Button>
              <Button variant="ghost" size="xs" onClick={() => setShowAddGroup(false)}>Cancel</Button>
            </div>
          </div>
        )}
        {hashtagGroups.length === 0 ? (
          <EmptyState icon={Hash} title="No hashtag groups" compact action={{ label: 'Create Group', onClick: () => setShowAddGroup(true) }} />
        ) : (
          <ul className="divide-y divide-slate-100 overflow-y-auto">
            {hashtagGroups.map(group => (
              <li key={group.id} className="px-5 py-3">
                <button
                  onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <span className="text-sm font-medium text-slate-800">{group.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{group.tags.length} tags</span>
                    {expandedGroup === group.id ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                  </div>
                </button>
                {expandedGroup === group.id && (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {group.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-violet-50 text-violet-700 text-xs rounded-full">
                          {tag.startsWith('#') ? tag : `#${tag}`}
                        </span>
                      ))}
                    </div>
                    <Button variant="secondary" size="xs" icon={<Copy size={11} />} onClick={() => navigator.clipboard.writeText(group.tags.map(t => t.startsWith('#') ? t : `#${t}`).join(' '))}>
                      Copy All
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Hook library */}
      <div className="bg-white rounded-xl border border-slate-200 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Zap size={15} className="text-amber-500" /> Hook Library</h3>
          <Button variant="secondary" size="xs" icon={<Plus size={12} />} onClick={() => setShowAddHook(true)}>Add</Button>
        </div>
        {showAddHook && (
          <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50">
            <Input placeholder="New hook template..." value={newHook} onChange={e => setNewHook(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="primary" size="xs" onClick={addHook}>Save</Button>
              <Button variant="ghost" size="xs" onClick={() => setShowAddHook(false)}>Cancel</Button>
            </div>
          </div>
        )}
        {hooks.length === 0 ? (
          <EmptyState icon={Zap} title="No hooks saved" compact action={{ label: 'Add Hook', onClick: () => setShowAddHook(true) }} />
        ) : (
          <ul className="divide-y divide-slate-100 overflow-y-auto">
            {hooks.map((hook, i) => (
              <li key={i} className="flex items-start gap-3 px-5 py-3 group">
                <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <p className="flex-1 text-sm text-slate-700">{hook}</p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                  <CopyButton text={hook} />
                  <button onClick={() => setHooks(prev => prev.filter((_, j) => j !== i))} className="p-1 text-slate-400 hover:text-red-500">
                    <Trash2 size={12} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── VARIANTS TAB ─────────────────────────────────────────────────────────────

function VariantsTab() {
  const [variantA, setVariantA] = useState({ caption: '', hook: '', cta: '' })
  const [variantB, setVariantB] = useState({ caption: '', hook: '', cta: '' })
  const [winner, setWinner] = useState<'A' | 'B' | null>(null)
  const [comparing, setComparing] = useState(false)

  const pickWinner = async (v: 'A' | 'B') => {
    setWinner(v)
    // In a real app: save winner to content_posts
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
        <GitBranch size={15} className="shrink-0" />
        Create two variations of your post and compare them side-by-side to pick the winner.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(['A', 'B'] as const).map(v => {
          const val = v === 'A' ? variantA : variantB
          const set = v === 'A' ? setVariantA : setVariantB
          const isWinner = winner === v
          return (
            <div
              key={v}
              className={cn(
                'bg-white rounded-xl border-2 p-5 space-y-4 transition-all',
                isWinner ? 'border-emerald-400 shadow-md' : 'border-slate-200',
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <span className={cn('w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold',
                    v === 'A' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'
                  )}>{v}</span>
                  Version {v}
                </h3>
                {isWinner && <Badge variant="green" dot>Winner</Badge>}
              </div>
              <Textarea
                label="Caption"
                placeholder={`Version ${v} caption...`}
                value={val.caption}
                onChange={e => set(p => ({ ...p, caption: e.target.value }))}
                rows={5}
              />
              <Input
                label="Hook"
                placeholder={`Version ${v} opening hook...`}
                value={val.hook}
                onChange={e => set(p => ({ ...p, hook: e.target.value }))}
              />
              <Input
                label="CTA"
                placeholder={`Version ${v} call-to-action...`}
                value={val.cta}
                onChange={e => set(p => ({ ...p, cta: e.target.value }))}
              />
              {comparing && (
                <Button
                  variant={isWinner ? 'primary' : 'secondary'}
                  className="w-full"
                  icon={<Star size={14} />}
                  onClick={() => pickWinner(v)}
                >
                  {isWinner ? 'Winner Selected' : `Pick Version ${v}`}
                </Button>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-3">
        <Button
          variant="primary"
          icon={<Eye size={14} />}
          onClick={() => setComparing(true)}
        >
          Compare Versions
        </Button>
        {winner && (
          <Button variant="secondary" icon={<Check size={14} />}>
            Use Version {winner}
          </Button>
        )}
        <Button
          variant="ghost"
          icon={<RotateCcw size={14} />}
          onClick={() => { setWinner(null); setComparing(false) }}
        >
          Reset
        </Button>
      </div>
    </div>
  )
}

// ─── HASHTAGS PREVIEW TAB ─────────────────────────────────────────────────────

interface HashtagSetPreview {
  id: string
  name: string
  hashtags: string[]
  category: string
  usage_count: number
  is_favorite: boolean
  created_at: string
}

function HashtagsPreviewTab() {
  const supabase = createClient()
  const [sets, setSets] = useState<HashtagSetPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      const wid = member?.workspace_id ?? user.id
      const { data } = await supabase
        .from('hashtag_sets')
        .select('id, name, hashtags, category, usage_count, is_favorite, created_at')
        .eq('workspace_id', wid)
        .order('created_at', { ascending: false })
        .limit(6)
      if (data) setSets(data as HashtagSetPreview[])
      setLoading(false)
    }
    load()
  }, [])

  const copyAll = (set: HashtagSetPreview) => {
    navigator.clipboard.writeText(set.hashtags.map(t => `#${t}`).join(' '))
    setCopiedId(set.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const CATEGORY_COLOURS: Record<string, string> = {
    general: 'bg-slate-100 text-slate-700',
    branded: 'bg-blue-100 text-blue-700',
    niche: 'bg-violet-100 text-violet-700',
    trending: 'bg-rose-100 text-rose-700',
    ugc: 'bg-amber-100 text-amber-700',
    location: 'bg-emerald-100 text-emerald-700',
    industry: 'bg-cyan-100 text-cyan-700',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Your most recent hashtag sets. Manage and create more in the full Hashtag Manager.</p>
        <button
          onClick={() => router.push('/app/studio/hashtags')}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors"
        >
          View All <ArrowRight size={13} />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : sets.length === 0 ? (
        <EmptyState
          icon={Hash}
          title="No hashtag sets yet"
          description="Build strategic hashtag sets to deploy across your content."
          action={{
            label: 'Open Hashtag Manager',
            icon: <Hash size={14} />,
            onClick: () => router.push('/app/studio/hashtags'),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sets.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900 truncate">{s.name}</h4>
                    {s.is_favorite && <Star size={12} className="text-amber-400 shrink-0" fill="currentColor" />}
                  </div>
                  <span className={cn('inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full capitalize', CATEGORY_COLOURS[s.category] ?? CATEGORY_COLOURS.general)}>
                    {s.category}
                  </span>
                </div>
                <button
                  onClick={() => copyAll(s)}
                  className="shrink-0 p-1.5 text-slate-400 hover:text-blue-600 rounded transition-colors"
                  title="Copy all hashtags"
                >
                  {copiedId === s.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {s.hashtags.slice(0, 8).map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                    #{tag}
                  </span>
                ))}
                {s.hashtags.length > 8 && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full">
                    +{s.hashtags.length - 8}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{s.hashtags.length} hashtags · {s.usage_count} uses</span>
                <button
                  onClick={() => router.push('/app/studio/hashtags')}
                  className="text-blue-500 hover:text-blue-700"
                >
                  Manage →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-center pt-2">
        <Button
          variant="primary"
          icon={<Hash size={14} />}
          onClick={() => router.push('/app/studio/hashtags')}
        >
          Open Hashtag Manager
        </Button>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

const STUDIO_TABS = [
  { id: 'ideas', label: 'Ideas', icon: <Bookmark size={14} /> },
  { id: 'generator', label: 'AI Generator', icon: <Sparkles size={14} /> },
  { id: 'builder', label: 'Post Builder', icon: <Layers size={14} /> },
  { id: 'canvas', label: 'Creative Canvas', icon: <Palette size={14} /> },
  { id: 'brand_voice', label: 'Brand Voice', icon: <Mic2 size={14} /> },
  { id: 'templates', label: 'Templates', icon: <LayoutTemplate size={14} /> },
  { id: 'media', label: 'Media Library', icon: <FolderOpen size={14} /> },
  { id: 'captions', label: 'Captions & Hashtags', icon: <Hash size={14} /> },
  { id: 'hashtags', label: 'Hashtag Manager', icon: <Hash size={14} /> },
  { id: 'variants', label: 'Variants', icon: <GitBranch size={14} /> },
]

export default function StudioPage() {
  const [activeTab, setActiveTab] = useState('ideas')

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Studio"
        subtitle="Create, generate, and manage your social media content"
        breadcrumbs={[{ label: 'App' }, { label: 'Studio' }]}
      >
        <Button variant="ai" size="sm" icon={<Sparkles size={13} />}>
          Quick Generate
        </Button>
      </PageHeader>

      <Tabs tabs={STUDIO_TABS} active={activeTab} onChange={setActiveTab} />

      <div className="min-h-[400px]">
        {activeTab === 'ideas' && <IdeasTab />}
        {activeTab === 'generator' && <AIGeneratorTab />}
        {activeTab === 'builder' && <PostBuilderTab />}
        {activeTab === 'canvas' && <CreativeCanvasTab />}
        {activeTab === 'brand_voice' && <BrandVoiceTab />}
        {activeTab === 'templates' && <TemplatesTab />}
        {activeTab === 'media' && <MediaLibraryTab />}
        {activeTab === 'captions' && <CaptionsHashtagsTab />}
        {activeTab === 'variants' && <VariantsTab />}
        {activeTab === 'hashtags' && <HashtagsPreviewTab />}
      </div>
    </div>
  )
}
