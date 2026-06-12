'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, Pencil, Trash2, X, Check, AlertCircle,
  FileText, Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { ConfirmModal } from '@/components/ui/Modal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContentTemplate {
  id: string
  brand_id?: string | null
  workspace_id: string
  name: string
  description?: string | null
  platforms: string[]
  post_type: string
  caption_template: string
  hashtags?: string[] | null
  is_global: boolean
  created_at: string
  brand?: { name: string } | null
}

interface Brand {
  id: string
  name: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [templates, setTemplates] = useState<ContentTemplate[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)

  // filters
  const [search, setSearch] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('')
  const [filterPostType, setFilterPostType] = useState('')
  const [filterBrand, setFilterBrand] = useState('')

  // modals
  const [formModal, setFormModal] = useState(false)
  const [editTarget, setEditTarget] = useState<ContentTemplate | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ContentTemplate | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // form
  const blank = (): Partial<ContentTemplate> & { hashtagInput: string } => ({
    name: '',
    description: '',
    brand_id: null,
    platforms: [],
    post_type: 'post',
    caption_template: '',
    hashtags: [],
    is_global: false,
    hashtagInput: '',
  })
  const [form, setForm] = useState(blank())

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: memberRow } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      const wsId = memberRow?.workspace_id ?? null
      setWorkspaceId(wsId)
      if (!wsId) { setLoading(false); return }

      const [{ data: tmplData }, { data: brandData }] = await Promise.all([
        supabase
          .from('content_templates')
          .select('*, brand:brands(name)')
          .eq('workspace_id', wsId)
          .order('created_at', { ascending: false }),
        supabase.from('brands').select('id, name').eq('workspace_id', wsId),
      ])

      setTemplates(tmplData ?? [])
      setBrands(brandData ?? [])
      setLoading(false)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filters ────────────────────────────────────────────────────────────────

  const filtered = templates.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) &&
      !t.caption_template.toLowerCase().includes(search.toLowerCase())) return false
    if (filterPlatform && !t.platforms.includes(filterPlatform)) return false
    if (filterPostType && t.post_type !== filterPostType) return false
    if (filterBrand && t.brand_id !== filterBrand) return false
    return true
  })

  const clearFilters = () => {
    setSearch('')
    setFilterPlatform('')
    setFilterPostType('')
    setFilterBrand('')
  }
  const hasFilters = search || filterPlatform || filterPostType || filterBrand

  // ── Modal handlers ─────────────────────────────────────────────────────────

  const openNew = () => {
    setForm(blank())
    setEditTarget(null)
    setFormModal(true)
  }

  const openEdit = (t: ContentTemplate) => {
    setForm({
      ...t,
      hashtagInput: '',
    } as any)
    setEditTarget(t)
    setFormModal(true)
  }

  const togglePlatform = (p: string) => {
    const cur = form.platforms ?? []
    setForm({ ...form, platforms: cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p] })
  }

  const save = async () => {
    if (!form.name?.trim() || !form.caption_template?.trim() || !workspaceId) return
    setSaving(true)
    const payload = {
      workspace_id: workspaceId,
      brand_id: form.brand_id || null,
      name: form.name.trim(),
      description: form.description?.trim() || null,
      platforms: form.platforms ?? [],
      post_type: form.post_type ?? 'post',
      caption_template: form.caption_template.trim(),
      hashtags: form.hashtags ?? [],
      is_global: form.is_global ?? false,
    }

    if (editTarget) {
      const { error } = await supabase
        .from('content_templates')
        .update(payload)
        .eq('id', editTarget.id)
      setSaving(false)
      if (error) { showToast(error.message, 'error'); return }
      const brandName = brands.find((b) => b.id === payload.brand_id)?.name ?? null
      setTemplates(
        templates.map((t) =>
          t.id === editTarget.id
            ? { ...t, ...payload, brand: brandName ? { name: brandName } : null }
            : t,
        ),
      )
      showToast('Template updated')
    } else {
      const { data, error } = await supabase
        .from('content_templates')
        .insert(payload)
        .select('*, brand:brands(name)')
        .single()
      setSaving(false)
      if (error) { showToast(error.message, 'error'); return }
      setTemplates([data, ...templates])
      showToast('Template created')
    }
    setFormModal(false)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('content_templates').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) {
      showToast(error.message, 'error')
    } else {
      setTemplates(templates.filter((t) => t.id !== deleteTarget.id))
      showToast('Template deleted')
    }
    setDeleteTarget(null)
  }

  const useTemplate = (t: ContentTemplate) => {
    router.push(`/app/studio?template=${encodeURIComponent(t.caption_template)}`)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

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

      <div className="bg-white border-b border-slate-200 px-6 pt-6 pb-5">
        <PageHeader
          title="Content Templates"
          subtitle="Reusable caption templates for faster content creation"
          breadcrumbs={[
            { label: 'Studio', href: '/app/studio' },
            { label: 'Templates' },
          ]}
        >
          <Button icon={<Plus size={14} />} onClick={openNew}>
            New Template
          </Button>
        </PageHeader>
      </div>

      <div className="p-6 space-y-5">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
          >
            <option value="">All platforms</option>
            {PLATFORM_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          <select
            value={filterPostType}
            onChange={(e) => setFilterPostType(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
          >
            <option value="">All post types</option>
            {POST_TYPE_OPTIONS.map((o) => (
              <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
            ))}
          </select>

          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
          >
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-100"
            >
              <X size={14} />
              Clear filters
            </button>
          )}

          <p className="ml-auto text-sm text-slate-400">
            {filtered.length} of {templates.length} template{templates.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-16 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-7 w-20" />
                  <Skeleton className="h-7 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          templates.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No templates yet"
              description="Create reusable caption templates to speed up content production across all your brands."
              action={{
                label: 'Create Your First Template',
                onClick: openNew,
                icon: <Plus size={14} />,
              }}
            />
          ) : (
            <EmptyState
              icon={Filter}
              title="No templates match your filters"
              description="Try adjusting your search or filter criteria."
              action={{ label: 'Clear Filters', onClick: clearFilters }}
              compact
            />
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onUse={() => useTemplate(t)}
                onEdit={() => openEdit(t)}
                onDelete={() => setDeleteTarget(t)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      <Modal
        open={formModal}
        onClose={() => setFormModal(false)}
        title={editTarget ? 'Edit Template' : 'New Content Template'}
        description={
          editTarget
            ? 'Update the template details below.'
            : 'Create a reusable caption template for your team.'
        }
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormModal(false)}>Cancel</Button>
            <Button
              loading={saving}
              onClick={save}
              disabled={!form.name?.trim() || !form.caption_template?.trim()}
            >
              {editTarget ? 'Save Changes' : 'Create Template'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Template Name <span className="text-red-500">*</span>
              </label>
              <input
                value={form.name ?? ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Product Launch, Weekly Promo"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Brand</label>
              <select
                value={form.brand_id ?? ''}
                onChange={(e) => setForm({ ...form, brand_id: e.target.value || null })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No specific brand (global)</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Description</label>
            <input
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of when to use this template…"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Caption Template <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.caption_template ?? ''}
              onChange={(e) => setForm({ ...form, caption_template: e.target.value })}
              rows={6}
              placeholder={`Introducing {{product}} from {{brand_name}}! 🚀\n\n{{description}}\n\n{{cta}}\n\n{{hashtags}}`}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono leading-relaxed"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['{{brand_name}}', '{{product}}', '{{cta}}', '{{description}}', '{{hashtags}}'].map((ph) => (
                <button
                  key={ph}
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      caption_template: (form.caption_template ?? '') + ph,
                    })
                  }
                  className="px-2 py-0.5 text-xs bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-700 rounded font-mono transition-colors"
                >
                  {ph}
                </button>
              ))}
              <span className="text-xs text-slate-400 self-center ml-1">Click to insert placeholder</span>
            </div>
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
                    'px-3 py-1.5 text-xs rounded-full border transition-all font-medium',
                    (form.platforms ?? []).includes(p.value)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Hashtags</label>
              <input
                value={(form.hashtags ?? []).join(', ')}
                onChange={(e) =>
                  setForm({
                    ...form,
                    hashtags: e.target.value
                      .split(',')
                      .map((h) => h.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="#brand, #launch, #newproduct"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Is global toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <p className="text-sm font-medium text-slate-800">Shared across all brands</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Global templates appear in the template picker for every brand in this workspace.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, is_global: !form.is_global })}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
                form.is_global ? 'bg-blue-600' : 'bg-slate-200',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                  form.is_global ? 'translate-x-5' : 'translate-x-0',
                )}
              />
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Template"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Template"
        danger
        loading={deleting}
      />
    </div>
  )
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onUse,
  onEdit,
  onDelete,
}: {
  template: ContentTemplate
  onUse: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{template.name}</p>
          {template.brand?.name && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{template.brand.name}</p>
          )}
          {template.is_global && !template.brand?.name && (
            <p className="text-xs text-blue-500 mt-0.5">Global template</p>
          )}
        </div>
        <Badge status={template.post_type} className="shrink-0">
          {template.post_type}
        </Badge>
      </div>

      {/* Platforms */}
      {template.platforms.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {template.platforms.map((p) => (
            <Badge key={p} variant={(PLATFORM_COLORS[p] as any) ?? 'default'}>
              {p}
            </Badge>
          ))}
        </div>
      )}

      {/* Caption preview */}
      <div className="flex-1 bg-slate-50 rounded-lg p-3 border border-slate-100">
        <p className="text-xs text-slate-600 font-mono leading-relaxed line-clamp-4 whitespace-pre-wrap break-words">
          {template.caption_template}
        </p>
      </div>

      {/* Hashtags preview */}
      {template.hashtags && template.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {template.hashtags.slice(0, 4).map((h) => (
            <span key={h} className="text-xs text-blue-600 font-medium">
              {h.startsWith('#') ? h : `#${h}`}
            </span>
          ))}
          {template.hashtags.length > 4 && (
            <span className="text-xs text-slate-400">+{template.hashtags.length - 4} more</span>
          )}
        </div>
      )}

      {/* Description */}
      {template.description && (
        <p className="text-xs text-slate-400 line-clamp-1">{template.description}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
        <Button size="xs" variant="primary" onClick={onUse} className="flex-1">
          Use Template
        </Button>
        <Button size="xs" variant="secondary" icon={<Pencil size={12} />} onClick={onEdit}>
          Edit
        </Button>
        <Button
          size="xs"
          variant="ghost"
          icon={<Trash2 size={12} />}
          onClick={onDelete}
          className="text-red-500 hover:text-red-700 hover:bg-red-50"
        />
      </div>
    </div>
  )
}
