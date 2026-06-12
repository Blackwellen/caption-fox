'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Plus, Edit, Eye, Copy, Trash2, ExternalLink, Link2,
  Globe, CheckCircle, X, AlignLeft, Image, FileText,
  Monitor, Smartphone, ToggleLeft, Layout, MoveUp, MoveDown,
  AlignCenter, Upload, Download,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
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

interface LinkItem {
  id: string
  page_id: string
  workspace_id: string
  item_type: 'link' | 'header' | 'divider' | 'social' | 'video' | 'image' | 'text'
  title: string | null
  url: string | null
  thumbnail_url: string | null
  icon: string | null
  sort_order: number
  is_active: boolean
  click_count: number
  created_at: string
}

type EditorTab = 'links' | 'appearance' | 'settings' | 'analytics'
type PreviewMode = 'mobile' | 'desktop'

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_TYPE_LABELS: Record<string, string> = {
  link: 'Link', header: 'Header', divider: 'Divider',
  social: 'Social Icons', video: 'Video Embed', image: 'Image', text: 'Text Block',
}

const ITEM_TYPE_ICONS: Record<string, React.ReactNode> = {
  link: <Link2 size={13} />, header: <AlignLeft size={13} />, divider: <Layout size={13} />,
  social: <Globe size={13} />, video: <Eye size={13} />, image: <Image size={13} />, text: <FileText size={13} />,
}

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
  inter: 'font-sans', poppins: 'font-sans', playfair: 'font-serif', mono: 'font-mono',
}

function getAppUrl() {
  return typeof window !== 'undefined' ? window.location.origin : 'https://captionfox.app'
}

// ─── Phone Frame Preview ──────────────────────────────────────────────────────

function PhonePreview({ page, items, mode }: { page: LinkPage; items: LinkItem[]; mode: PreviewMode }) {
  const bgStyle = page.background_type === 'gradient'
    ? { background: page.background_value }
    : { backgroundColor: page.background_value }

  const btnRadius = page.button_style === 'pill'
    ? 'rounded-full'
    : page.button_style === 'square'
    ? 'rounded-none'
    : 'rounded-xl'

  const activeItems = items.filter(i => i.is_active).sort((a, b) => a.sort_order - b.sort_order)

  const inner = (
    <div className="h-full overflow-y-auto" style={bgStyle}>
      <div className={cn('flex flex-col items-center px-5 py-8 gap-3 min-h-full', FONT_CLASS[page.font_family ?? 'inter'])}>
        {/* Avatar */}
        <div
          className="w-16 h-16 rounded-full border-2 border-white/30 flex items-center justify-center text-white font-bold text-xl shrink-0"
          style={{ backgroundColor: page.primary_color }}
        >
          {page.avatar_url
            ? <img src={page.avatar_url} alt={page.title} className="w-full h-full rounded-full object-cover" />
            : page.title.charAt(0).toUpperCase()
          }
        </div>

        {/* Title */}
        <p className="text-white font-bold text-base text-center">{page.title}</p>

        {/* Description */}
        {page.description && (
          <p className="text-white/60 text-xs text-center">{page.description}</p>
        )}

        {/* Items */}
        <div className="w-full space-y-2.5 mt-2">
          {activeItems.map(item => {
            if (item.item_type === 'divider') {
              return <div key={item.id} className="w-full h-px bg-white/20" />
            }
            if (item.item_type === 'header') {
              return (
                <p key={item.id} className="text-white/80 text-xs font-semibold uppercase tracking-wider text-center pt-2">
                  {item.title}
                </p>
              )
            }
            if (item.item_type === 'text') {
              return (
                <p key={item.id} className="text-white/70 text-xs text-center">
                  {item.title}
                </p>
              )
            }
            return (
              <a
                key={item.id}
                href={item.url ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={cn('flex items-center justify-center w-full py-3 text-sm font-semibold text-center transition-opacity hover:opacity-90', btnRadius)}
                style={{ backgroundColor: page.button_color, color: page.button_text_color }}
              >
                {item.title || 'Link'}
              </a>
            )
          })}
          {activeItems.length === 0 && (
            <div
              className={cn('w-full py-3 text-center text-sm font-semibold opacity-40', btnRadius)}
              style={{ backgroundColor: page.button_color, color: page.button_text_color }}
            >
              Your link here
            </div>
          )}
        </div>

        {/* Branding */}
        {page.show_caption_fox_branding && (
          <p className="text-white/30 text-xs mt-auto pt-6">Made with Caption Fox</p>
        )}
      </div>
    </div>
  )

  if (mode === 'desktop') {
    return (
      <div className="w-full bg-slate-100 rounded-xl border border-slate-200 overflow-hidden" style={{ minHeight: 520 }}>
        <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 border-b border-slate-300">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div className="w-3 h-3 rounded-full bg-emerald-400" />
          <div className="flex-1 mx-2 px-3 py-1 bg-white rounded text-xs text-slate-400 text-center">
            {getAppUrl()}/l/{page.slug}
          </div>
        </div>
        <div className="flex justify-center py-6">
          <div className="w-80" style={{ minHeight: 460 }}>
            {inner}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-center">
      {/* Phone frame */}
      <div className="relative w-[260px] shrink-0">
        <div className="relative bg-slate-900 rounded-[2.5rem] border-4 border-slate-800 shadow-2xl overflow-hidden" style={{ height: 520 }}>
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-slate-900 rounded-b-2xl z-10" />
          {/* Screen */}
          <div className="absolute inset-0 overflow-hidden rounded-[2.2rem]">
            {inner}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Add Item Dropdown ────────────────────────────────────────────────────────

function AddItemDropdown({ onAdd }: { onAdd: (type: LinkItem['item_type']) => void }) {
  const [open, setOpen] = useState(false)
  const types: LinkItem['item_type'][] = ['link', 'header', 'divider', 'social', 'video', 'text']

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Plus size={14} /> Add Item
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[160px]">
            {types.map(t => (
              <button
                key={t}
                onClick={() => { onAdd(t); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left"
              >
                {ITEM_TYPE_ICONS[t]}
                {ITEM_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Inline Item Editor ───────────────────────────────────────────────────────

function ItemEditor({
  item,
  onSave,
  onCancel,
}: {
  item: LinkItem
  onSave: (updates: Partial<LinkItem>) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(item.title ?? '')
  const [url, setUrl] = useState(item.url ?? '')
  const [icon, setIcon] = useState(item.icon ?? '')

  return (
    <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
      {(item.item_type === 'link' || item.item_type === 'social' || item.item_type === 'video') && (
        <>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
            <input
              type="text"
              className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Link title"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {item.item_type === 'video' ? 'Embed URL (YouTube/TikTok)' : 'URL'}
            </label>
            <input
              type="url"
              className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://"
            />
          </div>
        </>
      )}
      {(item.item_type === 'header' || item.item_type === 'text' || item.item_type === 'divider') && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {item.item_type === 'header' ? 'Header Text' : item.item_type === 'text' ? 'Text Content' : 'Label (optional)'}
          </label>
          <input
            type="text"
            className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={item.item_type === 'header' ? 'Section heading…' : item.item_type === 'text' ? 'Your text…' : ''}
          />
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
        <button
          onClick={() => onSave({ title: title || null, url: url || null, icon: icon || null })}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Save
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LinkBuilderPage() {
  const params = useParams()
  const router = useRouter()
  const pageId = params.id as string

  const [page, setPage] = useState<LinkPage | null>(null)
  const [items, setItems] = useState<LinkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<EditorTab>('links')
  const [previewMode, setPreviewMode] = useState<PreviewMode>('mobile')

  // Editing item
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // Appearance edits (live preview)
  const [appearance, setAppearance] = useState<Partial<LinkPage>>({})
  const [savingAppearance, setSavingAppearance] = useState(false)

  // Settings edits
  const [settings, setSettings] = useState<{ title: string; slug: string; description: string; show_caption_fox_branding: boolean; is_active: boolean }>({
    title: '', slug: '', description: '', show_caption_fox_branding: true, is_active: true,
  })
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  // Toast
  const [toast, setToast] = useState<string | null>(null)

  // ── Load page ─────────────────────────────────────────────────────────────

  const loadPage = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: pg } = await supabase.from('link_pages').select('*').eq('id', pageId).single()
      const { data: its } = await supabase.from('link_page_items').select('*')
        .eq('page_id', pageId).order('sort_order', { ascending: true })

      if (pg) {
        setPage(pg)
        setAppearance({
          background_type: pg.background_type,
          background_value: pg.background_value,
          primary_color: pg.primary_color,
          button_style: pg.button_style,
          button_color: pg.button_color,
          button_text_color: pg.button_text_color,
          font_family: pg.font_family,
        })
        setSettings({
          title: pg.title,
          slug: pg.slug,
          description: pg.description ?? '',
          show_caption_fox_branding: pg.show_caption_fox_branding,
          is_active: pg.is_active,
        })
      }
      setItems(its ?? [])
    } catch { /* silent */ } finally { setLoading(false) }
  }, [pageId])

  useEffect(() => { loadPage() }, [loadPage])

  // ── Computed preview page (merges live appearance edits) ──────────────────

  const previewPage: LinkPage | null = page ? { ...page, ...appearance } : null

  // ── Add item ──────────────────────────────────────────────────────────────

  async function addItem(type: LinkItem['item_type']) {
    if (!page) return
    const supabase = createClient()
    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 0
    const { data } = await supabase.from('link_page_items').insert({
      page_id: page.id,
      workspace_id: page.workspace_id,
      item_type: type,
      title: ITEM_TYPE_LABELS[type],
      url: null,
      sort_order: maxOrder,
    }).select().single()
    if (data) {
      setItems(prev => [...prev, data])
      setEditingItemId(data.id)
    }
  }

  // ── Save item edits ───────────────────────────────────────────────────────

  async function saveItemEdit(itemId: string, updates: Partial<LinkItem>) {
    const supabase = createClient()
    await supabase.from('link_page_items').update(updates).eq('id', itemId)
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...updates } : i))
    setEditingItemId(null)
    showToast('Item saved')
  }

  // ── Toggle item active ────────────────────────────────────────────────────

  async function toggleItem(item: LinkItem) {
    const supabase = createClient()
    await supabase.from('link_page_items').update({ is_active: !item.is_active }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i))
  }

  // ── Delete item ───────────────────────────────────────────────────────────

  async function deleteItem(id: string) {
    const supabase = createClient()
    await supabase.from('link_page_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    if (editingItemId === id) setEditingItemId(null)
  }

  // ── Reorder items ─────────────────────────────────────────────────────────

  async function moveItem(id: string, dir: 'up' | 'down') {
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex(i => i.id === id)
    if (idx < 0) return
    if (dir === 'up' && idx === 0) return
    if (dir === 'down' && idx === sorted.length - 1) return

    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    const newItems = [...sorted]
    const temp = newItems[idx].sort_order
    newItems[idx] = { ...newItems[idx], sort_order: newItems[swapIdx].sort_order }
    newItems[swapIdx] = { ...newItems[swapIdx], sort_order: temp }

    setItems(newItems)
    const supabase = createClient()
    await Promise.all([
      supabase.from('link_page_items').update({ sort_order: newItems[idx].sort_order }).eq('id', newItems[idx].id),
      supabase.from('link_page_items').update({ sort_order: newItems[swapIdx].sort_order }).eq('id', newItems[swapIdx].id),
    ])
  }

  // ── Save appearance ───────────────────────────────────────────────────────

  async function saveAppearance() {
    if (!page) return
    setSavingAppearance(true)
    try {
      const supabase = createClient()
      await supabase.from('link_pages').update(appearance).eq('id', page.id)
      setPage(p => p ? { ...p, ...appearance } : p)
      showToast('Appearance saved')
    } catch { /* silent */ } finally { setSavingAppearance(false) }
  }

  // ── Save settings ─────────────────────────────────────────────────────────

  async function saveSettings() {
    if (!page) return
    if (!settings.title.trim()) { setSettingsError('Title is required'); return }
    if (!settings.slug.trim()) { setSettingsError('Slug is required'); return }
    if (!/^[a-z0-9-]+$/.test(settings.slug)) { setSettingsError('Slug: lowercase letters, numbers and hyphens only'); return }

    setSavingSettings(true)
    setSettingsError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('link_pages').update({
        title: settings.title,
        slug: settings.slug,
        description: settings.description || null,
        show_caption_fox_branding: settings.show_caption_fox_branding,
        is_active: settings.is_active,
      }).eq('id', page.id)
      if (error) {
        if (error.code === '23505') throw new Error('That slug is already taken')
        throw error
      }
      setPage(p => p ? { ...p, ...settings, description: settings.description || null } : p)
      showToast('Settings saved')
    } catch (e: any) {
      setSettingsError(e.message ?? 'Failed to save settings')
    } finally { setSavingSettings(false) }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loading || !page) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[600px] w-full rounded-xl" />
          <Skeleton className="h-[600px] w-full rounded-xl" />
        </div>
      </div>
    )
  }

  const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order)
  const publicUrl = `${getAppUrl()}/l/${page.slug}`
  const ctr = page.total_views > 0 ? ((page.total_clicks / page.total_views) * 100).toFixed(1) : '0.0'

  const TABS: { id: EditorTab; label: string }[] = [
    { id: 'links', label: 'Links' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'settings', label: 'Settings' },
    { id: 'analytics', label: 'Analytics' },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Breadcrumb + top actions */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => router.push('/app/links')} className="text-slate-500 hover:text-blue-600 transition-colors">
            Link Pages
          </button>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900">{page.title}</span>
          <Badge variant={page.is_active ? 'green' : 'slate'} dot className="ml-1">
            {page.is_active ? 'Active' : 'Paused'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { navigator.clipboard.writeText(publicUrl); showToast('Link copied!') }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Copy size={13} /> Copy Link
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ExternalLink size={13} /> View Live
          </a>
        </div>
      </div>

      {/* Main layout: left editor + right preview */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px] gap-6 items-start">
        {/* ── LEFT: Editor ── */}
        <div className="space-y-4">
          {/* Tab bar */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex border-b border-slate-100">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex-1 py-3 text-sm font-medium transition-colors',
                    tab === t.id ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-4">
              {/* ═══ LINKS TAB ═══ */}
              {tab === 'links' && (
                <div className="space-y-3">
                  <AddItemDropdown onAdd={addItem} />

                  {sortedItems.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                      <Link2 size={28} className="mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No items yet. Add your first link above.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sortedItems.map((item, idx) => (
                        <div key={item.id} className="border border-slate-200 rounded-xl overflow-hidden">
                          {/* Item row */}
                          <div className={cn('flex items-center gap-3 px-3 py-2.5', !item.is_active && 'opacity-50')}>
                            {/* Sort arrows */}
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={() => moveItem(item.id, 'up')}
                                disabled={idx === 0}
                                className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 disabled:cursor-not-allowed"
                              >
                                <MoveUp size={11} />
                              </button>
                              <button
                                onClick={() => moveItem(item.id, 'down')}
                                disabled={idx === sortedItems.length - 1}
                                className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 disabled:cursor-not-allowed"
                              >
                                <MoveDown size={11} />
                              </button>
                            </div>

                            {/* Type icon */}
                            <span className="text-slate-400 shrink-0">{ITEM_TYPE_ICONS[item.item_type]}</span>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {item.title || ITEM_TYPE_LABELS[item.item_type]}
                              </p>
                              {item.url && (
                                <p className="text-xs text-slate-400 truncate">{item.url}</p>
                              )}
                            </div>

                            {/* Active toggle */}
                            <button
                              onClick={() => toggleItem(item)}
                              className={cn(
                                'relative w-9 h-5 rounded-full transition-colors shrink-0',
                                item.is_active ? 'bg-blue-600' : 'bg-slate-200',
                              )}
                            >
                              <span className={cn(
                                'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                                item.is_active ? 'translate-x-4' : 'translate-x-0.5',
                              )} />
                            </button>

                            {/* Edit / Delete */}
                            <button
                              onClick={() => setEditingItemId(editingItemId === item.id ? null : item.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => deleteItem(item.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          {/* Inline edit form */}
                          {editingItemId === item.id && (
                            <div className="border-t border-slate-100 px-3 pb-3">
                              <ItemEditor
                                item={item}
                                onSave={updates => saveItemEdit(item.id, updates)}
                                onCancel={() => setEditingItemId(null)}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ═══ APPEARANCE TAB ═══ */}
              {tab === 'appearance' && (
                <div className="space-y-5">
                  {/* Background type */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">Background Type</label>
                    <div className="flex gap-2">
                      {(['color', 'gradient'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setAppearance(a => ({ ...a, background_type: t }))}
                          className={cn(
                            'flex-1 py-2 text-xs font-medium rounded-lg border transition-all capitalize',
                            appearance.background_type === t ? 'bg-blue-600 text-white border-blue-600' : 'text-slate-600 border-slate-200 hover:border-slate-300',
                          )}
                        >{t}</button>
                      ))}
                    </div>
                  </div>

                  {/* Background presets */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">
                      {appearance.background_type === 'gradient' ? 'Gradient' : 'Background Color'}
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {(appearance.background_type === 'gradient' ? GRADIENT_PRESETS : BG_PRESETS).map(p => (
                        <button
                          key={p.value}
                          onClick={() => setAppearance(a => ({ ...a, background_value: p.value }))}
                          className={cn(
                            'h-9 rounded-lg border-2 transition-all relative overflow-hidden',
                            appearance.background_value === p.value ? 'border-blue-500' : 'border-transparent',
                          )}
                          style={appearance.background_type === 'gradient' ? { background: p.value } : { backgroundColor: p.value }}
                          title={p.label}
                        >
                          {appearance.background_value === p.value && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <CheckCircle size={12} className="text-white drop-shadow" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Colors */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Primary Color', key: 'primary_color' as const },
                      { label: 'Button Color', key: 'button_color' as const },
                      { label: 'Button Text', key: 'button_text_color' as const },
                    ].map(({ label, key }) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">{label}</label>
                        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-2 py-1.5">
                          <input
                            type="color"
                            className="w-5 h-5 rounded cursor-pointer border-0 p-0 shrink-0"
                            value={(appearance[key] as string) ?? '#000000'}
                            onChange={e => setAppearance(a => ({ ...a, [key]: e.target.value }))}
                          />
                          <span className="text-xs font-mono text-slate-600 truncate">{(appearance[key] as string)}</span>
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
                          onClick={() => setAppearance(a => ({ ...a, button_style: s }))}
                          className={cn(
                            'flex-1 py-2 text-xs font-semibold border-2 transition-all capitalize',
                            s === 'pill' ? 'rounded-full' : s === 'square' ? 'rounded-none' : 'rounded-lg',
                            appearance.button_style === s ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300',
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
                      value={appearance.font_family}
                      onChange={e => setAppearance(a => ({ ...a, font_family: e.target.value }))}
                    >
                      {FONT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>

                  <Button variant="primary" loading={savingAppearance} onClick={saveAppearance}>
                    Save Appearance
                  </Button>
                </div>
              )}

              {/* ═══ SETTINGS TAB ═══ */}
              {tab === 'settings' && (
                <div className="space-y-4">
                  {settingsError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      <X size={14} /> {settingsError}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Page Title</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      value={settings.title}
                      onChange={e => setSettings(s => ({ ...s, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Slug</label>
                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                      <span className="px-3 py-2.5 text-xs text-slate-400 bg-slate-50 border-r border-slate-200 whitespace-nowrap">
                        {getAppUrl()}/l/
                      </span>
                      <input
                        type="text"
                        className="flex-1 px-3 py-2.5 text-sm text-slate-900 focus:outline-none"
                        value={settings.slug}
                        onChange={e => setSettings(s => ({ ...s, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Description</label>
                    <textarea
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400 resize-none"
                      rows={2}
                      value={settings.description}
                      onChange={e => setSettings(s => ({ ...s, description: e.target.value }))}
                    />
                  </div>

                  {/* Toggles */}
                  <div className="space-y-3">
                    {[
                      { label: 'Show "Made with Caption Fox" branding', key: 'show_caption_fox_branding' as const },
                      { label: 'Page is active (visible to visitors)', key: 'is_active' as const },
                    ].map(({ label, key }) => (
                      <div key={key} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                        <span className="text-sm text-slate-700">{label}</span>
                        <button
                          onClick={() => setSettings(s => ({ ...s, [key]: !s[key] }))}
                          className={cn(
                            'relative w-10 h-5 rounded-full transition-colors',
                            settings[key] ? 'bg-blue-600' : 'bg-slate-200',
                          )}
                        >
                          <span className={cn(
                            'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                            settings[key] ? 'translate-x-5' : 'translate-x-0.5',
                          )} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <ExternalLink size={13} /> View Live Page
                    </a>
                    <button
                      onClick={() => { navigator.clipboard.writeText(publicUrl); showToast('Copied!') }}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <Copy size={13} /> Copy Link
                    </button>
                    <Button variant="primary" loading={savingSettings} onClick={saveSettings} className="ml-auto">
                      Save Settings
                    </Button>
                  </div>
                </div>
              )}

              {/* ═══ ANALYTICS TAB ═══ */}
              {tab === 'analytics' && (
                <div className="space-y-5">
                  {/* KPI row */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Total Views', value: page.total_views.toLocaleString(), color: 'text-blue-600' },
                      { label: 'Total Clicks', value: page.total_clicks.toLocaleString(), color: 'text-emerald-600' },
                      { label: 'CTR', value: `${ctr}%`, color: 'text-violet-600' },
                    ].map(k => (
                      <div key={k.label} className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className={cn('text-xl font-bold', k.color)}>{k.value}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Clicks per link */}
                  {sortedItems.filter(i => i.item_type === 'link' && i.click_count > 0).length > 0 ? (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 mb-3">Clicks Per Link</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart
                          data={sortedItems
                            .filter(i => i.item_type === 'link')
                            .sort((a, b) => b.click_count - a.click_count)
                            .map(i => ({ name: (i.title ?? 'Link').slice(0, 20), clicks: i.click_count }))}
                          margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="clicks" fill="#2563EB" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                      <p className="text-sm text-slate-500">No click data yet. Share your page to start tracking.</p>
                    </div>
                  )}

                  {/* Top links table */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">Link Performance</h3>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-3 py-2.5">Link</th>
                            <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-3 py-2.5">Clicks</th>
                            <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-3 py-2.5">CTR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedItems.filter(i => i.item_type === 'link').map(item => {
                            const itemCtr = page.total_views > 0 ? ((item.click_count / page.total_views) * 100).toFixed(1) : '0.0'
                            return (
                              <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                <td className="px-3 py-2.5 text-slate-700 truncate max-w-[180px]">{item.title ?? 'Link'}</td>
                                <td className="px-3 py-2.5 text-right font-semibold text-slate-900">{item.click_count}</td>
                                <td className="px-3 py-2.5 text-right text-slate-500">{itemCtr}%</td>
                              </tr>
                            )
                          })}
                          {sortedItems.filter(i => i.item_type === 'link').length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-3 py-6 text-center text-sm text-slate-400">No links yet</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    Connect full analytics tracking for real-time view data and detailed visitor insights.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Phone Preview ── */}
        <div className="sticky top-4 space-y-3">
          {/* Preview mode toggle */}
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Preview</p>
            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
              {([
                { mode: 'mobile' as const, icon: <Smartphone size={13} /> },
                { mode: 'desktop' as const, icon: <Monitor size={13} /> },
              ]).map(({ mode, icon }) => (
                <button
                  key={mode}
                  onClick={() => setPreviewMode(mode)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-md transition-all flex items-center gap-1',
                    previewMode === mode ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600',
                  )}
                >
                  {icon}
                  <span className="text-xs font-medium capitalize">{mode}</span>
                </button>
              ))}
            </div>
          </div>
          {previewPage && <PhonePreview page={previewPage} items={items} mode={previewMode} />}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white text-sm font-medium rounded-xl shadow-xl">
          <CheckCircle size={14} className="text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  )
}
