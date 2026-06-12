'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Pencil, Plus, X, Upload, Globe, Building2, Hash, Users,
  BarChart2, Shield, Layers, BookOpen, Radio, FileText,
  CheckCircle, AlertCircle, ChevronDown, ChevronUp, Trash2,
  Camera, Save, Check, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Brand {
  id: string
  workspace_id: string
  name: string
  industry?: string
  website?: string
  description?: string
  primary_color?: string
  secondary_color?: string
  logo_url?: string
  cover_image_url?: string
  created_at: string
}

interface BrandVoiceProfile {
  id?: string
  brand_id: string
  tones: string[]
  style_rules?: string
  do_not_use: string[]
  example_captions: string[]
  competitor_avoid: string[]
}

interface BrandGuidelines {
  id?: string
  brand_id: string
  do_use: string[]
  dont_use: string[]
  fonts: string[]
  hex_colors: string[]
  image_style?: string
}

interface SocialChannel {
  id: string
  brand_id: string
  platform: string
  account_name: string
  follower_count?: number
  is_active: boolean
}

interface ContentTemplate {
  id: string
  brand_id?: string
  workspace_id: string
  name: string
  description?: string
  platforms: string[]
  post_type: string
  caption_template: string
  hashtags?: string[]
  is_global: boolean
}

interface HashtagSet {
  id: string
  brand_id: string
  name: string
  platform?: string
  hashtags: string[]
  avg_reach?: number
}

interface WorkspaceMember {
  id: string
  user_id: string
  role: string
  email?: string
  full_name?: string
  avatar_url?: string
  brand_access?: string[]
}

interface AuditLog {
  id: string
  action: string
  entity_type: string
  entity_id: string
  metadata?: Record<string, unknown>
  created_at: string
  user_id?: string
  actor_email?: string
}

interface PostAnalytic {
  total_posts: number
  avg_engagement: number
  top_platform: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TONE_OPTIONS = ['Professional', 'Casual', 'Bold', 'Playful', 'Expert', 'Warm', 'Inspirational', 'Witty']

const PLATFORM_OPTIONS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'facebook', label: 'Facebook' },
]

const POST_TYPE_OPTIONS = ['post', 'reel', 'story', 'carousel', 'short']

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'violet',
  tiktok: 'default',
  linkedin: 'blue',
  x: 'slate',
  youtube: 'red',
  facebook: 'blue',
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'voice', label: 'Brand Voice' },
  { id: 'guidelines', label: 'Guidelines' },
  { id: 'channels', label: 'Channels' },
  { id: 'templates', label: 'Templates' },
  { id: 'hashtags', label: 'Hashtag Sets' },
  { id: 'team', label: 'Team Access' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'audit', label: 'Audit Log' },
]

// ─── Small helpers ────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function ColorSwatch({ hex, size = 'md' }: { hex: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'inline-block rounded border border-slate-200',
        size === 'sm' ? 'w-5 h-5' : 'w-8 h-8',
      )}
      style={{ backgroundColor: hex }}
      title={hex}
    />
  )
}

function InfoCard({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="bg-slate-50 rounded-xl p-4 space-y-1">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-slate-800 break-all">{value || '—'}</p>
    </div>
  )
}

function ChipInput({
  items,
  onChange,
  placeholder,
}: {
  items: string[]
  onChange: (items: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')
  const add = () => {
    const v = input.trim()
    if (v && !items.includes(v)) onChange([...items, v])
    setInput('')
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 border border-slate-200 rounded-lg bg-white">
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full"
          >
            {item}
            <button
              type="button"
              onClick={() => onChange(items.filter((i) => i !== item))}
              className="text-blue-400 hover:text-blue-700"
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder ?? 'Type and press Enter'}
          className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Button size="xs" variant="secondary" onClick={add}>
          Add
        </Button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BrandDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const supabase = createClient()

  const [tab, setTab] = useState('overview')
  const [brand, setBrand] = useState<Brand | null>(null)
  const [loading, setLoading] = useState(true)

  // sub-data
  const [voice, setVoice] = useState<BrandVoiceProfile | null>(null)
  const [guidelines, setGuidelines] = useState<BrandGuidelines | null>(null)
  const [channels, setChannels] = useState<SocialChannel[]>([])
  const [templates, setTemplates] = useState<ContentTemplate[]>([])
  const [hashtagSets, setHashtagSets] = useState<HashtagSet[]>([])
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [analytics, setAnalytics] = useState<PostAnalytic | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Load brand ──────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('brands').select('*').eq('id', id).single()
      if (data) setBrand(data)
      setLoading(false)
    }
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load tab-specific data on demand ────────────────────────────────────────

  useEffect(() => {
    if (!brand) return
    if (tab === 'voice') {
      supabase
        .from('brand_voice_profiles')
        .select('*')
        .eq('brand_id', id)
        .maybeSingle()
        .then(({ data }) =>
          setVoice(
            data ?? {
              brand_id: id,
              tones: [],
              do_not_use: [],
              example_captions: [],
              competitor_avoid: [],
            },
          ),
        )
    }
    if (tab === 'guidelines') {
      supabase
        .from('brand_guidelines')
        .select('*')
        .eq('brand_id', id)
        .maybeSingle()
        .then(({ data }) =>
          setGuidelines(
            data ?? {
              brand_id: id,
              do_use: [],
              dont_use: [],
              fonts: [],
              hex_colors: [],
            },
          ),
        )
    }
    if (tab === 'channels') {
      supabase
        .from('social_channels')
        .select('*')
        .eq('brand_id', id)
        .then(({ data }) => setChannels(data ?? []))
    }
    if (tab === 'templates') {
      supabase
        .from('content_templates')
        .select('*')
        .eq('brand_id', id)
        .then(({ data }) => setTemplates(data ?? []))
    }
    if (tab === 'hashtags') {
      supabase
        .from('hashtag_sets')
        .select('*')
        .eq('brand_id', id)
        .then(({ data }) => setHashtagSets(data ?? []))
    }
    if (tab === 'team') {
      supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', brand.workspace_id)
        .then(({ data }) => setMembers(data ?? []))
    }
    if (tab === 'analytics') {
      // Pull post analytics joined via content_posts for this brand
      supabase
        .from('content_posts')
        .select('id, platform, post_analytics(engagement_rate)')
        .eq('brand_id', id)
        .gte(
          'created_at',
          new Date(new Date().setDate(1)).toISOString(),
        )
        .then(({ data }) => {
          if (!data?.length) {
            setAnalytics({ total_posts: 0, avg_engagement: 0, top_platform: '—' })
            return
          }
          const allRates: number[] = []
          const platformCount: Record<string, number> = {}
          data.forEach((p: any) => {
            platformCount[p.platform] = (platformCount[p.platform] ?? 0) + 1
            const rates = Array.isArray(p.post_analytics) ? p.post_analytics : []
            rates.forEach((a: any) => {
              if (typeof a.engagement_rate === 'number') allRates.push(a.engagement_rate)
            })
          })
          const topPlatform = Object.entries(platformCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
          const avg = allRates.length ? allRates.reduce((s, r) => s + r, 0) / allRates.length : 0
          setAnalytics({ total_posts: data.length, avg_engagement: avg, top_platform: topPlatform })
        })
    }
    if (tab === 'audit') {
      supabase
        .from('audit_logs')
        .select('*')
        .eq('entity_id', id)
        .order('created_at', { ascending: false })
        .limit(50)
        .then(({ data }) => setAuditLogs(data ?? []))
    }
  }, [tab, brand]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-14 h-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-10 w-full max-w-2xl" />
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (!brand) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Building2}
          title="Brand not found"
          description="This brand may have been deleted or you don't have access."
          action={{ label: 'Back to Brands', onClick: () => router.push('/app/studio') }}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white',
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600',
          )}
        >
          {toast.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 pt-6 pb-0">
        <PageHeader
          title={brand.name}
          subtitle={brand.industry ?? 'Brand'}
          breadcrumbs={[
            { label: 'Studio', href: '/app/studio' },
            { label: 'Brands', href: '/app/studio' },
            { label: brand.name },
          ]}
        >
          <Button
            variant="secondary"
            size="sm"
            icon={<Pencil size={14} />}
            onClick={() => setTab('overview')}
          >
            Edit Brand
          </Button>
        </PageHeader>

        {/* Logo initials circle + cover */}
        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
            style={{ backgroundColor: brand.primary_color ?? '#3b82f6' }}
          >
            {brand.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logo_url}
                alt={brand.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              initials(brand.name)
            )}
          </div>
          <div>
            <p className="text-sm text-slate-500">{brand.website ?? 'No website set'}</p>
            {brand.description && (
              <p className="text-sm text-slate-700 max-w-lg line-clamp-2">{brand.description}</p>
            )}
          </div>
        </div>

        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {/* Tab content */}
      <div className="p-6">
        {tab === 'overview' && (
          <OverviewTab brand={brand} setBrand={setBrand} supabase={supabase} showToast={showToast} saving={saving} setSaving={setSaving} />
        )}
        {tab === 'voice' && voice && (
          <VoiceTab voice={voice} setVoice={setVoice} supabase={supabase} showToast={showToast} />
        )}
        {tab === 'guidelines' && guidelines && (
          <GuidelinesTab guidelines={guidelines} setGuidelines={setGuidelines} supabase={supabase} showToast={showToast} />
        )}
        {tab === 'channels' && (
          <ChannelsTab channels={channels} setChannels={setChannels} brandId={id} supabase={supabase} showToast={showToast} />
        )}
        {tab === 'templates' && (
          <TemplatesTab templates={templates} setTemplates={setTemplates} brandId={id} workspaceId={brand.workspace_id} supabase={supabase} showToast={showToast} router={router} />
        )}
        {tab === 'hashtags' && (
          <HashtagsTab hashtagSets={hashtagSets} setHashtagSets={setHashtagSets} brandId={id} supabase={supabase} showToast={showToast} />
        )}
        {tab === 'team' && (
          <TeamTab members={members} setMembers={setMembers} brandId={id} workspaceId={brand.workspace_id} supabase={supabase} showToast={showToast} />
        )}
        {tab === 'analytics' && (
          <AnalyticsTab analytics={analytics} brandId={id} supabase={supabase} />
        )}
        {tab === 'audit' && (
          <AuditTab logs={auditLogs} />
        )}
      </div>
    </div>
  )
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({
  brand,
  setBrand,
  supabase,
  showToast,
  saving,
  setSaving,
}: {
  brand: Brand
  setBrand: (b: Brand) => void
  supabase: ReturnType<typeof createClient>
  showToast: (m: string, t?: 'success' | 'error') => void
  saving: boolean
  setSaving: (v: boolean) => void
}) {
  const [form, setForm] = useState({ ...brand })
  const logoInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<'logo' | 'cover' | null>(null)

  const save = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('brands')
      .update({
        name: form.name,
        industry: form.industry,
        website: form.website,
        description: form.description,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
      })
      .eq('id', brand.id)
    setSaving(false)
    if (error) {
      showToast(error.message, 'error')
    } else {
      setBrand({ ...brand, ...form })
      showToast('Brand saved successfully')
    }
  }

  const handleImageUpload = async (file: File, type: 'logo' | 'cover') => {
    setUploading(type)
    const ext = file.name.split('.').pop()
    const path = `${brand.id}/${type}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('brand-assets')
      .upload(path, file, { upsert: true })
    if (upErr) {
      showToast(upErr.message, 'error')
      setUploading(null)
      return
    }
    const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
    const col = type === 'logo' ? 'logo_url' : 'cover_image_url'
    const { error: updateErr } = await supabase
      .from('brands')
      .update({ [col]: urlData.publicUrl })
      .eq('id', brand.id)
    if (updateErr) {
      showToast(updateErr.message, 'error')
    } else {
      setBrand({ ...brand, [col]: urlData.publicUrl })
      showToast(`${type === 'logo' ? 'Logo' : 'Cover image'} updated`)
    }
    setUploading(null)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Image uploads */}
      <div className="grid grid-cols-2 gap-4">
        {/* Logo */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">Brand Logo</p>
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-2xl font-bold shrink-0 border border-slate-200"
              style={{ backgroundColor: form.primary_color ?? '#3b82f6' }}
            >
              {brand.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brand.logo_url}
                  alt="Logo"
                  className="w-full h-full rounded-xl object-cover"
                />
              ) : (
                initials(brand.name)
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleImageUpload(f, 'logo')
                }}
              />
              <Button
                size="sm"
                variant="secondary"
                icon={<Camera size={14} />}
                loading={uploading === 'logo'}
                onClick={() => logoInputRef.current?.click()}
              >
                Upload Logo
              </Button>
              <p className="text-xs text-slate-400">PNG, JPG, SVG up to 5MB</p>
            </div>
          </div>
        </div>

        {/* Cover */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">Cover Image</p>
          <div
            className="h-20 w-full rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors overflow-hidden"
            onClick={() => coverInputRef.current?.click()}
          >
            {brand.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.cover_image_url}
                alt="Cover"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center">
                <Upload size={20} className="mx-auto text-slate-400 mb-1" />
                <p className="text-xs text-slate-400">Click to upload</p>
              </div>
            )}
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleImageUpload(f, 'cover')
            }}
          />
          {uploading === 'cover' && (
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <RefreshCw size={10} className="animate-spin" /> Uploading…
            </p>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <p className="text-sm font-semibold text-slate-800">Brand Information</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Brand Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Industry</label>
            <input
              value={form.industry ?? ''}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
              placeholder="e.g. Fashion, SaaS, Food &amp; Beverage"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Website</label>
          <div className="relative">
            <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={form.website ?? ''}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://yourbrand.com"
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Description</label>
          <textarea
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            placeholder="What does this brand do? What makes it unique?"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Colors */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Primary Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.primary_color ?? '#3b82f6'}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                className="w-10 h-10 rounded border border-slate-200 cursor-pointer p-0.5"
              />
              <input
                value={form.primary_color ?? ''}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                placeholder="#3b82f6"
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              {form.primary_color && <ColorSwatch hex={form.primary_color} />}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Secondary Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.secondary_color ?? '#64748b'}
                onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                className="w-10 h-10 rounded border border-slate-200 cursor-pointer p-0.5"
              />
              <input
                value={form.secondary_color ?? ''}
                onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                placeholder="#64748b"
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              {form.secondary_color && <ColorSwatch hex={form.secondary_color} />}
            </div>
          </div>
        </div>

        {/* Read-only info cards */}
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <InfoCard label="Brand ID" value={brand.id} />
          <InfoCard label="Created" value={new Date(brand.created_at).toLocaleDateString()} />
          <InfoCard label="Workspace" value={brand.workspace_id} />
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" icon={<Save size={14} />} loading={saving} onClick={save}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Brand Voice ─────────────────────────────────────────────────────────

function VoiceTab({
  voice,
  setVoice,
  supabase,
  showToast,
}: {
  voice: BrandVoiceProfile
  setVoice: (v: BrandVoiceProfile) => void
  supabase: ReturnType<typeof createClient>
  showToast: (m: string, t?: 'success' | 'error') => void
}) {
  const [saving, setSaving] = useState(false)
  const [local, setLocal] = useState({ ...voice })

  const toggleTone = (tone: string) => {
    setLocal((prev) => ({
      ...prev,
      tones: prev.tones.includes(tone)
        ? prev.tones.filter((t) => t !== tone)
        : [...prev.tones, tone],
    }))
  }

  const save = async () => {
    setSaving(true)
    const payload = {
      brand_id: local.brand_id,
      tones: local.tones,
      style_rules: local.style_rules,
      do_not_use: local.do_not_use,
      example_captions: local.example_captions,
      competitor_avoid: local.competitor_avoid,
    }
    const { error } = local.id
      ? await supabase.from('brand_voice_profiles').update(payload).eq('id', local.id)
      : await supabase.from('brand_voice_profiles').insert(payload)
    setSaving(false)
    if (error) {
      showToast(error.message, 'error')
    } else {
      setVoice(local)
      showToast('Brand voice saved')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Tones */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <p className="text-sm font-semibold text-slate-800 mb-4">Brand Tones</p>
        <div className="flex flex-wrap gap-2">
          {TONE_OPTIONS.map((tone) => (
            <button
              key={tone}
              onClick={() => toggleTone(tone)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-full border transition-all',
                local.tones.includes(tone)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400',
              )}
            >
              {tone}
            </button>
          ))}
        </div>
      </div>

      {/* Style rules */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <label className="block text-sm font-semibold text-slate-800 mb-3">Style Rules</label>
        <textarea
          value={local.style_rules ?? ''}
          onChange={(e) => setLocal({ ...local, style_rules: e.target.value })}
          rows={4}
          placeholder="Describe your brand's writing style, tone guidelines, formatting rules..."
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Do not use */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <label className="block text-sm font-semibold text-slate-800 mb-3">Words / Phrases to Avoid</label>
        <ChipInput
          items={local.do_not_use}
          onChange={(v) => setLocal({ ...local, do_not_use: v })}
          placeholder="Add word or phrase…"
        />
      </div>

      {/* Example captions */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <label className="block text-sm font-semibold text-slate-800 mb-3">Example Captions</label>
        <ChipInput
          items={local.example_captions}
          onChange={(v) => setLocal({ ...local, example_captions: v })}
          placeholder="Add example caption…"
        />
      </div>

      {/* Competitor avoid */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <label className="block text-sm font-semibold text-slate-800 mb-3">Competitors to Avoid Mentioning</label>
        <ChipInput
          items={local.competitor_avoid}
          onChange={(v) => setLocal({ ...local, competitor_avoid: v })}
          placeholder="Add competitor name…"
        />
      </div>

      <div className="flex justify-end">
        <Button variant="primary" icon={<Save size={14} />} loading={saving} onClick={save}>
          Save Brand Voice
        </Button>
      </div>
    </div>
  )
}

// ─── Tab: Guidelines ─────────────────────────────────────────────────────────

function GuidelinesTab({
  guidelines,
  setGuidelines,
  supabase,
  showToast,
}: {
  guidelines: BrandGuidelines
  setGuidelines: (g: BrandGuidelines) => void
  supabase: ReturnType<typeof createClient>
  showToast: (m: string, t?: 'success' | 'error') => void
}) {
  const [saving, setSaving] = useState(false)
  const [local, setLocal] = useState({ ...guidelines })
  const [newColor, setNewColor] = useState('#ffffff')

  const save = async () => {
    setSaving(true)
    const payload = {
      brand_id: local.brand_id,
      do_use: local.do_use,
      dont_use: local.dont_use,
      fonts: local.fonts,
      hex_colors: local.hex_colors,
      image_style: local.image_style,
    }
    const { error } = local.id
      ? await supabase.from('brand_guidelines').update(payload).eq('id', local.id)
      : await supabase.from('brand_guidelines').insert(payload)
    setSaving(false)
    if (error) {
      showToast(error.message, 'error')
    } else {
      setGuidelines(local)
      showToast('Guidelines saved')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={16} className="text-emerald-500" />
            <p className="text-sm font-semibold text-slate-800">Do Use</p>
          </div>
          <ChipInput
            items={local.do_use}
            onChange={(v) => setLocal({ ...local, do_use: v })}
            placeholder="Add approved phrase or style…"
          />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={16} className="text-red-500" />
            <p className="text-sm font-semibold text-slate-800">Don't Use</p>
          </div>
          <ChipInput
            items={local.dont_use}
            onChange={(v) => setLocal({ ...local, dont_use: v })}
            placeholder="Add banned phrase or style…"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <p className="text-sm font-semibold text-slate-800 mb-3">Brand Fonts</p>
        <ChipInput
          items={local.fonts}
          onChange={(v) => setLocal({ ...local, fonts: v })}
          placeholder="e.g. Inter, Playfair Display…"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <p className="text-sm font-semibold text-slate-800 mb-3">Brand Colors</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {local.hex_colors.map((hex) => (
            <div key={hex} className="flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg">
              <ColorSwatch hex={hex} size="sm" />
              <span className="text-xs font-mono text-slate-600">{hex}</span>
              <button
                onClick={() => setLocal({ ...local, hex_colors: local.hex_colors.filter((c) => c !== hex) })}
                className="text-slate-400 hover:text-red-500 ml-1"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="w-10 h-10 rounded border border-slate-200 cursor-pointer p-0.5"
          />
          <input
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            placeholder="#ffffff"
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (newColor && !local.hex_colors.includes(newColor)) {
                setLocal({ ...local, hex_colors: [...local.hex_colors, newColor] })
              }
            }}
          >
            Add
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <label className="block text-sm font-semibold text-slate-800 mb-3">Image Style Guidelines</label>
        <textarea
          value={local.image_style ?? ''}
          onChange={(e) => setLocal({ ...local, image_style: e.target.value })}
          rows={4}
          placeholder="Describe your preferred photography style, mood, lighting, subject matter…"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="flex justify-end">
        <Button variant="primary" icon={<Save size={14} />} loading={saving} onClick={save}>
          Save Guidelines
        </Button>
      </div>
    </div>
  )
}

// ─── Tab: Channels ────────────────────────────────────────────────────────────

function ChannelsTab({
  channels,
  setChannels,
  brandId,
  supabase,
  showToast,
}: {
  channels: SocialChannel[]
  setChannels: (c: SocialChannel[]) => void
  brandId: string
  supabase: ReturnType<typeof createClient>
  showToast: (m: string, t?: 'success' | 'error') => void
}) {
  const [connectModal, setConnectModal] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState('')
  const [accountName, setAccountName] = useState('')
  const [saving, setSaving] = useState(false)

  const connect = async () => {
    if (!selectedPlatform || !accountName) return
    setSaving(true)
    const { data, error } = await supabase
      .from('social_channels')
      .insert({ brand_id: brandId, platform: selectedPlatform, account_name: accountName, is_active: true })
      .select()
      .single()
    setSaving(false)
    if (error) {
      showToast(error.message, 'error')
    } else {
      setChannels([...channels, data])
      setConnectModal(false)
      setSelectedPlatform('')
      setAccountName('')
      showToast('Channel connected')
    }
  }

  const toggleActive = async (ch: SocialChannel) => {
    const { error } = await supabase
      .from('social_channels')
      .update({ is_active: !ch.is_active })
      .eq('id', ch.id)
    if (!error) {
      setChannels(channels.map((c) => (c.id === ch.id ? { ...c, is_active: !c.is_active } : c)))
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{channels.length} channel{channels.length !== 1 ? 's' : ''} connected</p>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setConnectModal(true)}>
          Connect Channel
        </Button>
      </div>

      {channels.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No channels connected"
          description="Connect your social media accounts to start publishing."
          action={{ label: 'Connect Channel', onClick: () => setConnectModal(true) }}
          compact
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Platform</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Account</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Followers</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {channels.map((ch) => (
                <tr key={ch.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Badge variant={(PLATFORM_COLORS[ch.platform] as any) ?? 'default'}>
                      {ch.platform}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">@{ch.account_name}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {ch.follower_count?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={ch.is_active ? 'active' : 'archived'} dot>
                      {ch.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleActive(ch)}
                      className="text-xs text-slate-400 hover:text-slate-600 underline"
                    >
                      {ch.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={connectModal}
        onClose={() => setConnectModal(false)}
        title="Connect Social Channel"
        description="Select a platform and enter your account name to connect."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConnectModal(false)}>Cancel</Button>
            <Button loading={saving} onClick={connect} disabled={!selectedPlatform || !accountName}>
              Connect Channel
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Platform</label>
            <div className="grid grid-cols-3 gap-2">
              {PLATFORM_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setSelectedPlatform(p.value)}
                  className={cn(
                    'px-3 py-2 text-sm rounded-lg border text-center transition-all',
                    selectedPlatform === p.value
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {selectedPlatform && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Account Handle</label>
                <input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="@yourbrand"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <p>
                  You&apos;ll be redirected to authenticate with{' '}
                  <strong>{PLATFORM_OPTIONS.find((p) => p.value === selectedPlatform)?.label}</strong> to
                  complete the connection.
                </p>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}

// ─── Tab: Templates ───────────────────────────────────────────────────────────

function TemplatesTab({
  templates,
  setTemplates,
  brandId,
  workspaceId,
  supabase,
  showToast,
  router,
}: {
  templates: ContentTemplate[]
  setTemplates: (t: ContentTemplate[]) => void
  brandId: string
  workspaceId: string
  supabase: ReturnType<typeof createClient>
  showToast: (m: string, t?: 'success' | 'error') => void
  router: ReturnType<typeof useRouter>
}) {
  const [modal, setModal] = useState(false)
  const [editTarget, setEditTarget] = useState<ContentTemplate | null>(null)
  const [saving, setSaving] = useState(false)
  const blank = (): Partial<ContentTemplate> => ({
    name: '',
    caption_template: '',
    platforms: [],
    post_type: 'post',
    hashtags: [],
    is_global: false,
  })
  const [form, setForm] = useState<Partial<ContentTemplate>>(blank())

  const openNew = () => {
    setForm(blank())
    setEditTarget(null)
    setModal(true)
  }

  const openEdit = (t: ContentTemplate) => {
    setForm({ ...t })
    setEditTarget(t)
    setModal(true)
  }

  const togglePlatform = (p: string) => {
    const cur = form.platforms ?? []
    setForm({ ...form, platforms: cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p] })
  }

  const save = async () => {
    if (!form.name || !form.caption_template) return
    setSaving(true)
    const payload = {
      name: form.name,
      description: form.description,
      brand_id: brandId,
      workspace_id: workspaceId,
      platforms: form.platforms ?? [],
      post_type: form.post_type ?? 'post',
      caption_template: form.caption_template ?? '',
      hashtags: form.hashtags ?? [],
      is_global: form.is_global ?? false,
    }
    if (editTarget) {
      const { error } = await supabase.from('content_templates').update(payload).eq('id', editTarget.id)
      setSaving(false)
      if (error) { showToast(error.message, 'error'); return }
      setTemplates(templates.map((t) => (t.id === editTarget.id ? { ...t, ...payload } : t)))
    } else {
      const { data, error } = await supabase.from('content_templates').insert(payload).select().single()
      setSaving(false)
      if (error) { showToast(error.message, 'error'); return }
      setTemplates([...templates, data])
    }
    showToast(editTarget ? 'Template updated' : 'Template created')
    setModal(false)
  }

  const deleteTemplate = async (t: ContentTemplate) => {
    const { error } = await supabase.from('content_templates').delete().eq('id', t.id)
    if (!error) {
      setTemplates(templates.filter((x) => x.id !== t.id))
      showToast('Template deleted')
    } else {
      showToast(error.message, 'error')
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
        <Button size="sm" icon={<Plus size={14} />} onClick={openNew}>
          New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No templates yet"
          description="Create reusable caption templates for this brand."
          action={{ label: 'Create Template', onClick: openNew }}
          compact
        />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800 line-clamp-1">{t.name}</p>
                <Badge status={t.post_type}>{t.post_type}</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {t.platforms.map((p) => (
                  <Badge key={p} variant={(PLATFORM_COLORS[p] as any) ?? 'default'}>{p}</Badge>
                ))}
              </div>
              <p className="text-xs text-slate-500 line-clamp-3 flex-1 font-mono bg-slate-50 rounded-lg p-2 leading-relaxed">
                {t.caption_template}
              </p>
              <div className="flex gap-2 pt-1">
                <Button
                  size="xs"
                  variant="primary"
                  onClick={() =>
                    router.push(`/app/studio?template=${encodeURIComponent(t.caption_template)}`)
                  }
                >
                  Use Template
                </Button>
                <Button size="xs" variant="secondary" icon={<Pencil size={12} />} onClick={() => openEdit(t)}>
                  Edit
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  icon={<Trash2 size={12} />}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 ml-auto"
                  onClick={() => deleteTemplate(t)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editTarget ? 'Edit Template' : 'New Content Template'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button loading={saving} onClick={save} disabled={!form.name || !form.caption_template}>
              {editTarget ? 'Save Changes' : 'Create Template'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Template Name *</label>
            <input
              value={form.name ?? ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Product Launch Post"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Caption Template *</label>
            <textarea
              value={form.caption_template ?? ''}
              onChange={(e) => setForm({ ...form, caption_template: e.target.value })}
              rows={5}
              placeholder="Use {{brand_name}}, {{product}}, {{cta}} as placeholders…"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
            />
            <p className="text-xs text-slate-400 mt-1">Placeholders: {'{{brand_name}}'}, {'{{product}}'}, {'{{cta}}'}, {'{{hashtags}}'}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Platforms</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => togglePlatform(p.value)}
                  className={cn(
                    'px-3 py-1 text-xs rounded-full border transition-all',
                    (form.platforms ?? []).includes(p.value)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Post Type</label>
            <select
              value={form.post_type ?? 'post'}
              onChange={(e) => setForm({ ...form, post_type: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {POST_TYPE_OPTIONS.map((o) => (
                <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Hashtags (comma-separated)</label>
            <input
              value={(form.hashtags ?? []).join(', ')}
              onChange={(e) =>
                setForm({ ...form, hashtags: e.target.value.split(',').map((h) => h.trim()).filter(Boolean) })
              }
              placeholder="#brand, #launch, #newproduct"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Tab: Hashtag Sets ────────────────────────────────────────────────────────

function HashtagsTab({
  hashtagSets,
  setHashtagSets,
  brandId,
  supabase,
  showToast,
}: {
  hashtagSets: HashtagSet[]
  setHashtagSets: (h: HashtagSet[]) => void
  brandId: string
  supabase: ReturnType<typeof createClient>
  showToast: (m: string, t?: 'success' | 'error') => void
}) {
  const [modal, setModal] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', platform: '', hashtags: [] as string[], avg_reach: '' })

  const save = async () => {
    setSaving(true)
    const { data, error } = await supabase
      .from('hashtag_sets')
      .insert({
        brand_id: brandId,
        name: form.name,
        platform: form.platform || null,
        hashtags: form.hashtags,
        avg_reach: form.avg_reach ? parseFloat(form.avg_reach) : null,
      })
      .select()
      .single()
    setSaving(false)
    if (error) {
      showToast(error.message, 'error')
    } else {
      setHashtagSets([...hashtagSets, data])
      setModal(false)
      setForm({ name: '', platform: '', hashtags: [], avg_reach: '' })
      showToast('Hashtag set created')
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{hashtagSets.length} hashtag set{hashtagSets.length !== 1 ? 's' : ''}</p>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setModal(true)}>
          New Set
        </Button>
      </div>

      {hashtagSets.length === 0 ? (
        <EmptyState
          icon={Hash}
          title="No hashtag sets"
          description="Organise your hashtags into reusable sets by platform or campaign."
          action={{ label: 'Create Set', onClick: () => setModal(true) }}
          compact
        />
      ) : (
        <div className="space-y-3">
          {hashtagSets.map((set) => (
            <div key={set.id} className="bg-white rounded-xl border border-slate-200">
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left"
                onClick={() => setExpanded(expanded === set.id ? null : set.id)}
              >
                <div className="flex items-center gap-3">
                  <Hash size={16} className="text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{set.name}</p>
                    <p className="text-xs text-slate-400">
                      {set.hashtags.length} hashtags
                      {set.platform && ` · ${set.platform}`}
                      {set.avg_reach && ` · ~${set.avg_reach.toLocaleString()} avg reach`}
                    </p>
                  </div>
                </div>
                {expanded === set.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </button>
              {expanded === set.id && (
                <div className="px-5 pb-4 border-t border-slate-100 pt-3">
                  <div className="flex flex-wrap gap-1.5">
                    {set.hashtags.map((h) => (
                      <span
                        key={h}
                        className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded-full font-medium"
                      >
                        {h.startsWith('#') ? h : `#${h}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="New Hashtag Set"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button loading={saving} onClick={save} disabled={!form.name || form.hashtags.length === 0}>
              Create Set
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Set Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Product Launch, Brand Awareness"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Platform (optional)</label>
            <select
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All platforms</option>
              {PLATFORM_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Hashtags *</label>
            <ChipInput
              items={form.hashtags}
              onChange={(v) => setForm({ ...form, hashtags: v })}
              placeholder="#hashtag (press Enter)"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Average Reach (optional)</label>
            <input
              type="number"
              value={form.avg_reach}
              onChange={(e) => setForm({ ...form, avg_reach: e.target.value })}
              placeholder="e.g. 12500"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Tab: Team Access ─────────────────────────────────────────────────────────

function TeamTab({
  members,
  setMembers,
  brandId,
  workspaceId,
  supabase,
  showToast,
}: {
  members: WorkspaceMember[]
  setMembers: (m: WorkspaceMember[]) => void
  brandId: string
  workspaceId: string
  supabase: ReturnType<typeof createClient>
  showToast: (m: string, t?: 'success' | 'error') => void
}) {
  const brandMembers = members.filter(
    (m) => !m.brand_access || m.brand_access.includes(brandId),
  )

  const grantAccess = async (memberId: string) => {
    const member = members.find((m) => m.id === memberId)
    if (!member) return
    const newAccess = Array.from(new Set([...(member.brand_access ?? []), brandId]))
    const { error } = await supabase
      .from('workspace_members')
      .update({ brand_access: newAccess })
      .eq('id', memberId)
    if (!error) {
      setMembers(members.map((m) => (m.id === memberId ? { ...m, brand_access: newAccess } : m)))
      showToast('Access granted')
    } else {
      showToast(error.message, 'error')
    }
  }

  const revokeAccess = async (memberId: string) => {
    const member = members.find((m) => m.id === memberId)
    if (!member) return
    const newAccess = (member.brand_access ?? []).filter((id) => id !== brandId)
    const { error } = await supabase
      .from('workspace_members')
      .update({ brand_access: newAccess })
      .eq('id', memberId)
    if (!error) {
      setMembers(members.map((m) => (m.id === memberId ? { ...m, brand_access: newAccess } : m)))
      showToast('Access revoked')
    } else {
      showToast(error.message, 'error')
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-sm text-slate-500">{brandMembers.length} member{brandMembers.length !== 1 ? 's' : ''} with access to this brand</p>

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No workspace members"
          description="Invite team members to your workspace first."
          compact
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Member</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Brand Access</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => {
                const hasAccess = !m.brand_access || m.brand_access.includes(brandId)
                return (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {(m.full_name ?? m.email ?? '?').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{m.full_name ?? m.email ?? 'Unknown'}</p>
                          {m.email && m.full_name && (
                            <p className="text-xs text-slate-400">{m.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="default">{m.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={hasAccess ? 'active' : 'archived'} dot>
                        {hasAccess ? 'Has access' : 'No access'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {hasAccess ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => revokeAccess(m.id)}
                        >
                          Revoke
                        </Button>
                      ) : (
                        <Button size="xs" variant="secondary" onClick={() => grantAccess(m.id)}>
                          Grant Access
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Analytics ───────────────────────────────────────────────────────────

function AnalyticsTab({
  analytics,
  brandId,
  supabase,
}: {
  analytics: PostAnalytic | null
  brandId: string
  supabase: ReturnType<typeof createClient>
}) {
  if (!analytics) {
    return (
      <div className="flex items-center justify-center py-20">
        <Skeleton className="w-full max-w-xl h-32" />
      </div>
    )
  }

  const kpis = [
    {
      label: 'Posts This Month',
      value: analytics.total_posts.toString(),
      icon: <Layers size={18} className="text-blue-500" />,
      color: 'bg-blue-50',
    },
    {
      label: 'Avg Engagement Rate',
      value: analytics.avg_engagement > 0 ? `${analytics.avg_engagement.toFixed(2)}%` : '—',
      icon: <BarChart2 size={18} className="text-violet-500" />,
      color: 'bg-violet-50',
    },
    {
      label: 'Top Platform',
      value: analytics.top_platform,
      icon: <Radio size={18} className="text-emerald-500" />,
      color: 'bg-emerald-50',
    },
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="grid grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-3', kpi.color)}>
              {kpi.icon}
            </div>
            <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
            <p className="text-xs font-medium text-slate-400 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {analytics.total_posts === 0 && (
        <EmptyState
          icon={BarChart2}
          title="No analytics data yet"
          description="Analytics will appear here once you start publishing content for this brand."
          compact
        />
      )}
    </div>
  )
}

// ─── Tab: Audit Log ───────────────────────────────────────────────────────────

function AuditTab({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) {
    return (
      <EmptyState
        icon={Shield}
        title="No audit events"
        description="Actions related to this brand will appear here."
        compact
      />
    )
  }

  return (
    <div className="max-w-2xl space-y-0 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
      {logs.map((log, i) => (
        <div key={log.id} className="flex gap-4 pl-10 pb-5 relative">
          <div className="absolute left-[11px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white ring-1 ring-blue-200 z-10" />
          <div className="flex-1 bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-800 capitalize">
                {log.action.replace(/_/g, ' ')}
              </p>
              <time className="text-xs text-slate-400 shrink-0">
                {new Date(log.created_at).toLocaleString()}
              </time>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Entity: {log.entity_type} · {log.entity_id.slice(0, 8)}
              {log.actor_email && ` · ${log.actor_email}`}
            </p>
            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <pre className="mt-2 text-xs bg-slate-50 rounded-lg p-2 overflow-x-auto text-slate-600">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
