'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Edit, Eye, Copy, Trash2, ExternalLink, Link2,
  Globe, CheckCircle, X, AlignLeft, Image, FileText,
  Monitor, Smartphone, ToggleLeft, Layout,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LinkPage {
  id: string
  workspace_id: string
  brand_id: string | null
  slug: string
  title: string
  description: string | null
  avatar_url: string | null
  background_type: 'color' | 'gradient' | 'image'
  background_value: string
  primary_color: string
  button_style: 'square' | 'rounded' | 'pill'
  button_color: string
  button_text_color: string
  font_family: string
  show_caption_fox_branding: boolean
  total_views: number
  total_clicks: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Brand {
  id: string
  name: string
}

interface CreateForm {
  step: 1 | 2 | 3
  // Step 1
  title: string
  slug: string
  brand_id: string
  description: string
  // Step 2
  background_type: 'color' | 'gradient' | 'image'
  background_value: string
  primary_color: string
  button_color: string
  button_text_color: string
  button_style: 'square' | 'rounded' | 'pill'
  font_family: string
  // Step 3
  first_link_title: string
  first_link_url: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BG_PRESETS = [
  { label: 'Dark Navy', value: '#0C1A2E' },
  { label: 'Black', value: '#000000' },
  { label: 'White', value: '#FFFFFF' },
  { label: 'Purple', value: '#6B21A8' },
  { label: 'Slate', value: '#1E293B' },
  { label: 'Teal', value: '#0F766E' },
]

const GRADIENT_PRESETS = [
  { label: 'Ocean', value: 'linear-gradient(135deg, #0C1A2E 0%, #1e40af 100%)' },
  { label: 'Sunset', value: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)' },
  { label: 'Forest', value: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)' },
  { label: 'Fire', value: 'linear-gradient(135deg, #991b1b 0%, #ea580c 100%)' },
]

const FONT_OPTIONS = [
  { value: 'inter', label: 'Inter' },
  { value: 'poppins', label: 'Poppins' },
  { value: 'playfair', label: 'Playfair Display' },
  { value: 'mono', label: 'Monospace' },
]

const FONT_CLASS: Record<string, string> = {
  inter: 'font-sans',
  poppins: 'font-sans',
  playfair: 'font-serif',
  mono: 'font-mono',
}

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function getAppUrl() {
  return typeof window !== 'undefined' ? window.location.origin : 'https://captionfox.app'
}

// ─── Mini Preview ─────────────────────────────────────────────────────────────

function MiniPreview({ page, items = [] }: { page: Partial<CreateForm>; items?: { title: string; url: string }[] }) {
  const bg = page.background_type === 'gradient' ? page.background_value : page.background_value
  const bgStyle = page.background_type === 'gradient'
    ? { background: page.background_value }
    : { backgroundColor: page.background_value }

  const btnRadius = page.button_style === 'pill' ? 'rounded-full' : page.button_style === 'square' ? 'rounded-none' : 'rounded-lg'

  return (
    <div
      className="w-full rounded-xl overflow-hidden border border-slate-200"
      style={{ ...bgStyle, minHeight: 200 }}
    >
      <div className="flex flex-col items-center px-4 py-6 gap-3">
        <div
          className="w-12 h-12 rounded-full border-2 border-white/30 flex items-center justify-center text-white/60 text-lg font-bold"
          style={{ backgroundColor: page.primary_color ?? '#2563EB' }}
        >
          {(page.title ?? 'P').charAt(0).toUpperCase()}
        </div>
        <p className={cn('text-white font-semibold text-sm text-center', FONT_CLASS[page.font_family ?? 'inter'])}>
          {page.title || 'Your Page Title'}
        </p>
        {page.description && (
          <p className="text-white/60 text-xs text-center">{page.description}</p>
        )}
        {items.map((item, i) => (
          <div
            key={i}
            className={cn('w-full py-2.5 text-center text-xs font-semibold', btnRadius)}
            style={{ backgroundColor: page.button_color ?? '#2563EB', color: page.button_text_color ?? '#FFFFFF' }}
          >
            {item.title || 'Link'}
          </div>
        ))}
        {items.length === 0 && (
          <div
            className={cn('w-full py-2.5 text-center text-xs font-semibold opacity-50', btnRadius)}
            style={{ backgroundColor: page.button_color ?? '#2563EB', color: page.button_text_color ?? '#FFFFFF' }}
          >
            Your link here
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page Card ────────────────────────────────────────────────────────────────

function LinkPageCard({
  page,
  onEdit,
  onDelete,
  onCopy,
  onAnalytics,
}: {
  page: LinkPage
  onEdit: () => void
  onDelete: () => void
  onCopy: () => void
  onAnalytics: () => void
}) {
  const appUrl = getAppUrl()
  const publicUrl = `${appUrl}/l/${page.slug}`
  const ctr = page.total_views > 0 ? ((page.total_clicks / page.total_views) * 100).toFixed(1) : '0.0'

  const bgStyle = page.background_type === 'gradient'
    ? { background: page.background_value }
    : { backgroundColor: page.background_value }

  const btnRadius = page.button_style === 'pill' ? 'rounded-full' : page.button_style === 'square' ? 'rounded-none' : 'rounded-lg'

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Mini mockup preview */}
      <div className="h-36 relative overflow-hidden" style={bgStyle}>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: page.primary_color }}
          >
            {page.title.charAt(0).toUpperCase()}
          </div>
          <p className={cn('text-white font-semibold text-xs text-center', FONT_CLASS[page.font_family ?? 'inter'])}>
            {page.title}
          </p>
          <div
            className={cn('w-32 py-1.5 text-center text-xs font-semibold', btnRadius)}
            style={{ backgroundColor: page.button_color, color: page.button_text_color }}
          >
            Visit Link
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 truncate">{page.title}</h3>
            <p className="text-xs text-slate-400 truncate mt-0.5">{getAppUrl()}/l/{page.slug}</p>
          </div>
          <Badge variant={page.is_active ? 'green' : 'slate'} dot className="shrink-0">
            {page.is_active ? 'Active' : 'Paused'}
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Views', value: page.total_views.toLocaleString() },
            { label: 'Clicks', value: page.total_clicks.toLocaleString() },
            { label: 'CTR', value: `${ctr}%` },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 rounded-lg p-2 text-center">
              <p className="text-sm font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={onEdit}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Edit size={11} /> Edit
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Eye size={11} /> Preview
          </a>
          <button
            onClick={onCopy}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Copy size={11} /> Copy Link
          </button>
          <button
            onClick={onAnalytics}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <Layout size={11} /> Analytics
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors ml-auto"
          >
            <Trash2 size={11} /> Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LinksPage() {
  const router = useRouter()
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [pages, setPages] = useState<LinkPage[]>([])
  const [loading, setLoading] = useState(true)
  const [brands, setBrands] = useState<Brand[]>([])

  // Modal
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [form, setForm] = useState<CreateForm>({
    step: 1,
    title: '', slug: '', brand_id: '', description: '',
    background_type: 'color', background_value: '#0C1A2E',
    primary_color: '#2563EB', button_color: '#2563EB', button_text_color: '#FFFFFF',
    button_style: 'rounded', font_family: 'inter',
    first_link_title: '', first_link_url: '',
  })

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<LinkPage | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Toast
  const [toast, setToast] = useState<string | null>(null)

  // ── Bootstrap ───────────────────────────────────────────────────────────────

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
      } catch { /* silent */ } finally { setBootstrapping(false) }
    }
    bootstrap()
  }, [])

  // ── Load pages + brands ─────────────────────────────────────────────────────

  const loadPages = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase.from('link_pages').select('*')
        .eq('workspace_id', workspaceId).order('created_at', { ascending: false })
      setPages(data ?? [])
    } catch { setPages([]) } finally { setLoading(false) }
  }, [workspaceId])

  useEffect(() => {
    if (!workspaceId) return
    loadPages()
    createClient().from('brands').select('id, name').eq('workspace_id', workspaceId)
      .then(({ data }) => setBrands(data ?? []))
  }, [workspaceId, loadPages])

  // ── KPI calculations ────────────────────────────────────────────────────────

  const totalViews = pages.reduce((a, p) => a + p.total_views, 0)
  const totalClicks = pages.reduce((a, p) => a + p.total_clicks, 0)
  const avgCtr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : '0.0'

  const kpis = [
    { label: 'Total Pages', value: pages.length, color: 'text-blue-600' },
    { label: 'Total Views', value: totalViews.toLocaleString(), color: 'text-violet-600' },
    { label: 'Total Clicks', value: totalClicks.toLocaleString(), color: 'text-emerald-600' },
    { label: 'Avg CTR', value: `${avgCtr}%`, color: 'text-amber-600' },
  ]

  // ── Create flow ─────────────────────────────────────────────────────────────

  function openCreate() {
    setForm({
      step: 1, title: '', slug: '', brand_id: '', description: '',
      background_type: 'color', background_value: '#0C1A2E',
      primary_color: '#2563EB', button_color: '#2563EB', button_text_color: '#FFFFFF',
      button_style: 'rounded', font_family: 'inter',
      first_link_title: '', first_link_url: '',
    })
    setCreateError(null)
    setShowCreate(true)
  }

  function validateSlug(slug: string) {
    return /^[a-z0-9-]+$/.test(slug)
  }

  async function handleCreate() {
    if (!workspaceId) return
    if (!form.title.trim()) { setCreateError('Title is required'); return }
    if (!form.slug.trim()) { setCreateError('Slug is required'); return }
    if (!validateSlug(form.slug)) { setCreateError('Slug can only contain lowercase letters, numbers and hyphens'); return }
    if (!form.first_link_url.trim()) { setCreateError('Add a URL for your first link'); return }

    setCreating(true)
    setCreateError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: page, error } = await supabase.from('link_pages').insert({
        workspace_id: workspaceId,
        brand_id: form.brand_id || null,
        slug: form.slug,
        title: form.title,
        description: form.description || null,
        background_type: form.background_type,
        background_value: form.background_value,
        primary_color: form.primary_color,
        button_style: form.button_style,
        button_color: form.button_color,
        button_text_color: form.button_text_color,
        font_family: form.font_family,
        created_by: user.id,
      }).select().single()

      if (error) {
        if (error.code === '23505') throw new Error('That slug is already taken, choose another')
        throw error
      }

      // Insert first link item
      await supabase.from('link_page_items').insert({
        page_id: page.id,
        workspace_id: workspaceId,
        item_type: 'link',
        title: form.first_link_title || form.title,
        url: form.first_link_url,
        sort_order: 0,
      })

      setShowCreate(false)
      loadPages()
      showToast('Page created!')
    } catch (e: any) {
      setCreateError(e.message ?? 'Failed to create page')
    } finally {
      setCreating(false)
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const supabase = createClient()
      await supabase.from('link_pages').delete().eq('id', deleteTarget.id)
      setPages(prev => prev.filter(p => p.id !== deleteTarget.id))
      setDeleteTarget(null)
      showToast('Page deleted')
    } catch { /* silent */ } finally { setDeleting(false) }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function copyLink(page: LinkPage) {
    const url = `${getAppUrl()}/l/${page.slug}`
    navigator.clipboard.writeText(url).then(() => showToast('Link copied!'))
  }

  // ── Step validation ─────────────────────────────────────────────────────────

  function canAdvance() {
    if (form.step === 1) return form.title.trim().length > 0 && form.slug.trim().length > 0 && validateSlug(form.slug)
    if (form.step === 2) return true
    return form.first_link_url.trim().length > 0
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="Link Pages" subtitle="Build beautiful link-in-bio landing pages for each of your social profiles.">
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openCreate}>
          New Page
        </Button>
      </PageHeader>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-500 mb-1">{k.label}</p>
            <p className={cn('text-2xl font-bold', k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Pages Grid */}
      {bootstrapping || loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <Skeleton className="h-36 w-full rounded-none" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : pages.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={Globe}
            title="No link pages yet"
            description="Create your first link-in-bio page to share across your social profiles."
            action={{ label: 'Create Link Page', onClick: openCreate, icon: <Plus size={14} /> }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {pages.map(page => (
            <LinkPageCard
              key={page.id}
              page={page}
              onEdit={() => router.push(`/app/links/${page.id}`)}
              onDelete={() => setDeleteTarget(page)}
              onCopy={() => copyLink(page)}
              onAnalytics={() => router.push(`/app/links/${page.id}/analytics`)}
            />
          ))}
        </div>
      )}

      {/* ═══ CREATE MODAL ═══ */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={`New Link Page — Step ${form.step} of 3`}
        description={
          form.step === 1 ? 'Set up your page details'
            : form.step === 2 ? 'Customise the appearance'
            : 'Add your first link'
        }
        size="lg"
        footer={
          <div className="flex gap-2 w-full">
            {form.step > 1 && (
              <Button variant="secondary" onClick={() => setForm(f => ({ ...f, step: (f.step - 1) as any }))}>
                Back
              </Button>
            )}
            <div className="flex-1" />
            {form.step < 3
              ? <Button variant="primary" disabled={!canAdvance()} onClick={() => { setCreateError(null); setForm(f => ({ ...f, step: (f.step + 1) as any })) }}>
                  Continue
                </Button>
              : <Button variant="primary" loading={creating} onClick={handleCreate}>
                  Create Page
                </Button>
            }
          </div>
        }
      >
        <div className="space-y-5">
          {/* Step indicator */}
          <div className="flex gap-1.5">
            {[1, 2, 3].map(s => (
              <div key={s} className={cn('h-1.5 flex-1 rounded-full transition-colors', s <= form.step ? 'bg-blue-600' : 'bg-slate-200')} />
            ))}
          </div>

          {createError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <X size={14} /> {createError}
            </div>
          )}

          {/* ── Step 1: Setup ── */}
          {form.step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Page Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400"
                  placeholder="e.g. My Official Links"
                  value={form.title}
                  onChange={e => {
                    const title = e.target.value
                    setForm(f => ({ ...f, title, slug: slugify(title) }))
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Slug <span className="text-red-500">*</span>
                  <span className="text-slate-400 font-normal ml-1">(lowercase letters, numbers and hyphens only)</span>
                </label>
                <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                  <span className="px-3 py-2.5 text-xs text-slate-400 bg-slate-50 border-r border-slate-200 whitespace-nowrap">
                    {getAppUrl()}/l/
                  </span>
                  <input
                    type="text"
                    className="flex-1 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    placeholder="your-slug"
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  />
                  {form.slug && (
                    <span className={cn('px-3', validateSlug(form.slug) ? 'text-emerald-500' : 'text-red-500')}>
                      {validateSlug(form.slug) ? <CheckCircle size={14} /> : <X size={14} />}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Brand (optional)</label>
                <select
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
                  value={form.brand_id}
                  onChange={e => setForm(f => ({ ...f, brand_id: e.target.value }))}
                >
                  <option value="">No brand</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Description (optional)</label>
                <textarea
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400 resize-none"
                  placeholder="A short bio or tagline shown under your name"
                  rows={2}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* ── Step 2: Appearance ── */}
          {form.step === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Controls */}
              <div className="space-y-4">
                {/* Background type */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-2">Background Type</label>
                  <div className="flex gap-2">
                    {(['color', 'gradient'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setForm(f => ({ ...f, background_type: t }))}
                        className={cn(
                          'flex-1 py-2 text-xs font-medium rounded-lg border transition-all capitalize',
                          form.background_type === t ? 'bg-blue-600 text-white border-blue-600' : 'text-slate-600 border-slate-200 hover:border-slate-300',
                        )}
                      >{t}</button>
                    ))}
                  </div>
                </div>

                {/* Background presets */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-2">
                    {form.background_type === 'gradient' ? 'Gradient' : 'Background Color'}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(form.background_type === 'gradient' ? GRADIENT_PRESETS : BG_PRESETS).map(p => (
                      <button
                        key={p.value}
                        onClick={() => setForm(f => ({ ...f, background_value: p.value }))}
                        className={cn(
                          'h-9 rounded-lg border-2 transition-all relative overflow-hidden',
                          form.background_value === p.value ? 'border-blue-500' : 'border-transparent',
                        )}
                        style={form.background_type === 'gradient' ? { background: p.value } : { backgroundColor: p.value }}
                        title={p.label}
                      >
                        {form.background_value === p.value && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <CheckCircle size={14} className="text-white drop-shadow" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Colors */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Primary', key: 'primary_color' as const },
                    { label: 'Button', key: 'button_color' as const },
                    { label: 'Btn Text', key: 'button_text_color' as const },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">{label}</label>
                      <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-2 py-1.5">
                        <input
                          type="color"
                          className="w-5 h-5 rounded cursor-pointer border-0 p-0"
                          value={form[key]}
                          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        />
                        <span className="text-xs font-mono text-slate-600">{form[key]}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Button style */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-2">Button Style</label>
                  <div className="flex gap-2">
                    {(['square', 'rounded', 'pill'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setForm(f => ({ ...f, button_style: s }))}
                        className={cn(
                          'flex-1 py-2 text-xs font-semibold border-2 transition-all capitalize',
                          s === 'pill' ? 'rounded-full' : s === 'square' ? 'rounded-none' : 'rounded-lg',
                          form.button_style === s ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300',
                        )}
                      >{s}</button>
                    ))}
                  </div>
                </div>

                {/* Font */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Font Family</label>
                  <select
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
                    value={form.font_family}
                    onChange={e => setForm(f => ({ ...f, font_family: e.target.value }))}
                  >
                    {FONT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Live preview */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Live Preview</p>
                <MiniPreview page={form} />
              </div>
            </div>
          )}

          {/* ── Step 3: First Link ── */}
          {form.step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Add your first link to get started. You can add more after creating the page.</p>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Link Title</label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400"
                  placeholder="e.g. My Website, Latest Video"
                  value={form.first_link_title}
                  onChange={e => setForm(f => ({ ...f, first_link_title: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">URL <span className="text-red-500">*</span></label>
                <input
                  type="url"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400"
                  placeholder="https://"
                  value={form.first_link_url}
                  onChange={e => setForm(f => ({ ...f, first_link_url: e.target.value }))}
                />
              </div>
              {/* Preview of the page */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Page Preview</p>
                <MiniPreview
                  page={form}
                  items={form.first_link_url ? [{ title: form.first_link_title || 'Visit Link', url: form.first_link_url }] : []}
                />
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ═══ DELETE CONFIRM ═══ */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Link Page"
        description={`Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deleting} onClick={confirmDelete}>Delete Page</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">All links and analytics for this page will be permanently deleted.</p>
      </Modal>

      {/* ═══ TOAST ═══ */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white text-sm font-medium rounded-xl shadow-xl animate-in slide-in-from-bottom-2">
          <CheckCircle size={14} className="text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  )
}
