'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  Plus, Edit, Eye, Copy, Trash2, ExternalLink, Link2, Globe, CheckCircle, X,
  AlignLeft, Image as ImageIcon, FileText, MoveUp, MoveDown, ShoppingBag,
  ClipboardList, Target, ChevronDown, Rocket, History,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { PublicMicroPageRenderer, type RenderableItem, type RenderablePage } from '@/components/link-in-bio/PublicMicroPageRenderer'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LinkPage {
  id: string
  workspace_id: string
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
  status: string
  theme_id: string | null
  owner_id: string | null
  published_at: string | null
  current_version: number
  seo_title: string | null
  seo_description: string | null
  visibility: string
  tags: string[]
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
  sort_order: number
  is_active: boolean
  click_count: number
}

interface VersionRow { id: string; version: number; published: boolean; note: string | null; created_at: string }

type EditorTab = 'design' | 'links' | 'products' | 'forms' | 'pixels' | 'analytics' | 'settings' | 'versions'

const TABS: { id: EditorTab; label: string }[] = [
  { id: 'design', label: 'Design' },
  { id: 'links', label: 'Links' },
  { id: 'products', label: 'Products' },
  { id: 'forms', label: 'Forms' },
  { id: 'pixels', label: 'Pixels' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'settings', label: 'Settings' },
  { id: 'versions', label: 'Versions' },
]

const ITEM_TYPE_LABELS: Record<string, string> = { link: 'Link', header: 'Header', divider: 'Divider', social: 'Social Icons', video: 'Video Embed', image: 'Image', text: 'Text Block' }
const ITEM_TYPE_ICONS: Record<string, React.ReactNode> = { link: <Link2 size={13} />, header: <AlignLeft size={13} />, divider: <FileText size={13} />, social: <Globe size={13} />, video: <Eye size={13} />, image: <ImageIcon size={13} />, text: <FileText size={13} /> }
const BG_PRESETS = [{ label: 'Dark Navy', value: '#0C1A2E' }, { label: 'Black', value: '#000000' }, { label: 'White', value: '#FFFFFF' }, { label: 'Purple', value: '#6B21A8' }, { label: 'Slate', value: '#1E293B' }, { label: 'Teal', value: '#0F766E' }]
const GRADIENT_PRESETS = [{ label: 'Ocean', value: 'linear-gradient(135deg, #0C1A2E 0%, #1e40af 100%)' }, { label: 'Sunset', value: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)' }, { label: 'Forest', value: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)' }, { label: 'Fire', value: 'linear-gradient(135deg, #991b1b 0%, #ea580c 100%)' }]
const FONT_OPTIONS = [{ value: 'inter', label: 'Inter' }, { value: 'poppins', label: 'Poppins' }, { value: 'playfair', label: 'Playfair Display' }, { value: 'mono', label: 'Monospace' }]

function getAppUrl() { return typeof window !== 'undefined' ? window.location.origin : 'https://captionfox.app' }

export default function LinkPageDetail() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pageId = params.id as string

  const [page, setPage] = useState<LinkPage | null>(null)
  const [items, setItems] = useState<LinkItem[]>([])
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [ownerName, setOwnerName] = useState<string>('—')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<EditorTab>((searchParams.get('tab') as EditorTab) || 'design')
  const [publishing, setPublishing] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const loadPage = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: pg } = await supabase.from('link_pages').select('*').eq('id', pageId).single()
    const { data: its } = await supabase.from('link_page_items').select('*').eq('page_id', pageId).order('sort_order', { ascending: true })
    const { data: vers } = await supabase.from('link_page_versions').select('id, version, published, note, created_at').eq('page_id', pageId).order('version', { ascending: false })
    if (pg?.owner_id) {
      const { data: owner } = await supabase.from('profiles').select('full_name, email').eq('id', pg.owner_id).single()
      setOwnerName(owner?.full_name || owner?.email || '—')
    }
    setPage(pg ?? null)
    setItems(its ?? [])
    setVersions(vers ?? [])
    setLoading(false)
  }, [pageId])

  useEffect(() => { loadPage() }, [loadPage])

  const renderPage: RenderablePage | null = page ? {
    title: page.title, description: page.description, avatar_url: page.avatar_url,
    background_type: page.background_type, background_value: page.background_value,
    primary_color: page.primary_color, button_style: page.button_style,
    button_color: page.button_color, button_text_color: page.button_text_color,
    font_family: page.font_family, show_caption_fox_branding: page.show_caption_fox_branding,
  } : null

  const renderItems: RenderableItem[] = items.map(i => ({ id: i.id, item_type: i.item_type, title: i.title, url: i.url, is_active: i.is_active, sort_order: i.sort_order }))

  // ── Item CRUD ─────────────────────────────────────────────────────────────

  async function addItem(type: LinkItem['item_type']) {
    if (!page) return
    setAddMenuOpen(false)
    const supabase = createClient()
    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 0
    const { data } = await supabase.from('link_page_items').insert({ page_id: page.id, workspace_id: page.workspace_id, item_type: type, title: ITEM_TYPE_LABELS[type], url: null, sort_order: maxOrder }).select().single()
    if (data) { setItems(prev => [...prev, data]); setEditingItemId(data.id) }
  }

  async function saveItemEdit(itemId: string, updates: Partial<LinkItem>) {
    const supabase = createClient()
    await supabase.from('link_page_items').update(updates).eq('id', itemId)
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...updates } : i))
    setEditingItemId(null)
    showToast('Block saved')
  }

  async function toggleItem(item: LinkItem) {
    const supabase = createClient()
    await supabase.from('link_page_items').update({ is_active: !item.is_active }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i))
  }

  async function duplicateItem(item: LinkItem) {
    if (!page) return
    const supabase = createClient()
    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 0
    const { data } = await supabase.from('link_page_items').insert({ page_id: page.id, workspace_id: page.workspace_id, item_type: item.item_type, title: item.title, url: item.url, sort_order: maxOrder }).select().single()
    if (data) setItems(prev => [...prev, data])
  }

  async function deleteItem(id: string) {
    const supabase = createClient()
    await supabase.from('link_page_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    if (editingItemId === id) setEditingItemId(null)
  }

  async function moveItem(id: string, dir: 'up' | 'down') {
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex(i => i.id === id)
    if (idx < 0 || (dir === 'up' && idx === 0) || (dir === 'down' && idx === sorted.length - 1)) return
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

  // ── Publish (creates a version snapshot) ────────────────────────────────

  async function publishChanges() {
    if (!page) return
    setPublishing(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const nextVersion = page.current_version + 1
      const snapshot = { page: { ...page }, items }
      await supabase.from('link_page_versions').insert({ page_id: page.id, workspace_id: page.workspace_id, version: nextVersion, snapshot, published: true, created_by: user?.id ?? null })
      const { data: updated } = await supabase.from('link_pages').update({ status: 'published', is_active: true, published_at: new Date().toISOString(), current_version: nextVersion, updated_by: user?.id ?? null }).eq('id', page.id).select().single()
      if (updated) setPage(updated)
      setVersions(prev => [{ id: crypto.randomUUID(), version: nextVersion, published: true, note: null, created_at: new Date().toISOString() }, ...prev])
      showToast('Published!')
    } catch { showToast('Failed to publish') } finally { setPublishing(false) }
  }

  if (loading || !page) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <Skeleton className="h-10 w-80" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-[500px] w-full rounded-xl lg:col-span-2" />
          <Skeleton className="h-[500px] w-full rounded-xl" />
        </div>
      </div>
    )
  }

  const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order)
  const publicUrl = `${getAppUrl()}/l/${page.slug}`
  const ctr = page.total_views > 0 ? ((page.total_clicks / page.total_views) * 100).toFixed(1) : '0.0'

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <button onClick={() => router.push('/app/links/library')} className="hover:text-blue-600">Link Library</button>
            <span>/</span><span className="text-slate-600">{page.title}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">{page.title}</h1>
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-1.5">
            <span className="flex items-center gap-1"><Badge status={page.status}>{page.status}</Badge></span>
            <span>Owner: {ownerName}</span>
            <span>Created {new Date(page.created_at).toLocaleDateString('en-GB')}</span>
            <span>Updated {new Date(page.updated_at).toLocaleDateString('en-GB')}</span>
            {page.published_at && <span>Published {new Date(page.published_at).toLocaleDateString('en-GB')}</span>}
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline"><Globe size={11} /> {publicUrl.replace('https://', '')} <ExternalLink size={10} /></a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { navigator.clipboard.writeText(publicUrl); showToast('Link copied!') }} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"><Copy size={13} /> Copy link</button>
          <Button variant="primary" size="sm" icon={<Rocket size={14} />} loading={publishing} onClick={publishChanges}>Publish changes</Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-slate-200 mb-5 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn('px-3 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors', tab === t.id ? 'text-blue-600 border-blue-600' : 'text-slate-500 border-transparent hover:text-slate-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'design' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Blocks</h2>
                <p className="text-xs text-slate-400">Drag order with the arrows to build your page.</p>
              </div>
              <div className="relative">
                <button onClick={() => setAddMenuOpen(o => !o)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Plus size={14} /> Add block</button>
                {addMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setAddMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[160px]">
                      {(['link', 'header', 'divider', 'social', 'video', 'text'] as const).map(t => (
                        <button key={t} onClick={() => addItem(t)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left">{ITEM_TYPE_ICONS[t]} {ITEM_TYPE_LABELS[t]}</button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {sortedItems.length === 0 ? (
              <EmptyState icon={Link2} compact title="No blocks yet" description="Add your first block to start building this page." />
            ) : (
              <div className="space-y-2">
                {sortedItems.map((item, idx) => (
                  <div key={item.id} className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className={cn('flex items-center gap-3 px-3 py-2.5', !item.is_active && 'opacity-50')}>
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveItem(item.id, 'up')} disabled={idx === 0} className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20"><MoveUp size={11} /></button>
                        <button onClick={() => moveItem(item.id, 'down')} disabled={idx === sortedItems.length - 1} className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20"><MoveDown size={11} /></button>
                      </div>
                      <span className="text-slate-400 shrink-0">{ITEM_TYPE_ICONS[item.item_type]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{item.title || ITEM_TYPE_LABELS[item.item_type]}</p>
                        {item.url && <p className="text-xs text-slate-400 truncate">{item.url}</p>}
                      </div>
                      {item.item_type === 'link' && item.click_count > 0 && <span className="text-xs text-slate-400 shrink-0">{item.click_count} clicks</span>}
                      <button onClick={() => toggleItem(item)} className={cn('relative w-9 h-5 rounded-full transition-colors shrink-0', item.is_active ? 'bg-blue-600' : 'bg-slate-200')}>
                        <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', item.is_active ? 'translate-x-4' : 'translate-x-0.5')} />
                      </button>
                      <button onClick={() => duplicateItem(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Copy size={13} /></button>
                      <button onClick={() => setEditingItemId(editingItemId === item.id ? null : item.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Edit size={13} /></button>
                      <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
                    </div>
                    {editingItemId === item.id && <ItemEditor item={item} onSave={u => saveItemEdit(item.id, u)} onCancel={() => setEditingItemId(null)} />}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sticky top-4 space-y-3">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <p className="text-xs font-medium text-slate-500 px-3 pt-3 pb-2">Live preview</p>
              <div className="flex justify-center pb-4">
                <div className="relative w-[240px] shrink-0">
                  <div className="relative bg-slate-900 rounded-[2.3rem] border-4 border-slate-800 shadow-xl overflow-hidden" style={{ height: 480 }}>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-slate-900 rounded-b-2xl z-10" />
                    <div className="absolute inset-0 overflow-hidden rounded-[2rem]">
                      {renderPage && <PublicMicroPageRenderer page={renderPage} items={renderItems} frameless />}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <PageSummaryPanel page={page} versions={versions} />
          </div>
        </div>
      )}

      {tab === 'links' && <LinksAsListTab items={sortedItems} onToggle={toggleItem} onDelete={deleteItem} onEditTitle={saveItemEdit} />}
      {tab === 'products' && <NotConnectedTab icon={ShoppingBag} title="Products" description="Connect a product catalogue to feature shoppable items on this page. Not yet connected in this workspace." />}
      {tab === 'forms' && <NotConnectedTab icon={ClipboardList} title="Forms" description="Connect a lead-capture form to collect emails from visitors. Not yet connected in this workspace." />}
      {tab === 'pixels' && <NotConnectedTab icon={Target} title="Pixels" description="Connect a tracking pixel (Meta, TikTok, Google) to measure ad performance from this page. Not yet connected in this workspace." />}
      {tab === 'analytics' && <AnalyticsTab page={page} items={sortedItems} ctr={ctr} />}
      {tab === 'settings' && <SettingsTab page={page} onSaved={updated => setPage(updated)} publicUrl={publicUrl} showToast={showToast} />}
      {tab === 'versions' && <VersionsTab versions={versions} currentVersion={page.current_version} />}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white text-sm font-medium rounded-xl shadow-xl">
          <CheckCircle size={14} className="text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  )
}

// ─── Sub-panels ───────────────────────────────────────────────────────────────

function PageSummaryPanel({ page, versions }: { page: LinkPage; versions: VersionRow[] }) {
  const ctr = page.total_views > 0 ? ((page.total_clicks / page.total_views) * 100).toFixed(1) : '0.0'
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">Page summary</h3>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div><p className="text-xs text-slate-400">Total clicks</p><p className="text-lg font-bold text-slate-900">{page.total_clicks.toLocaleString()}</p></div>
        <div><p className="text-xs text-slate-400">CTR</p><p className="text-lg font-bold text-slate-900">{ctr}%</p></div>
      </div>
      <div className="space-y-1.5 text-xs text-slate-500">
        <div className="flex justify-between"><span>Version</span><span className="font-medium text-slate-700">v{page.current_version}</span></div>
        <div className="flex justify-between"><span>Visibility</span><span className="font-medium text-slate-700 capitalize">{page.visibility}</span></div>
        <div className="flex justify-between"><span>Total versions</span><span className="font-medium text-slate-700">{versions.length}</span></div>
      </div>
    </div>
  )
}

function ItemEditor({ item, onSave, onCancel }: { item: LinkItem; onSave: (u: Partial<LinkItem>) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(item.title ?? '')
  const [url, setUrl] = useState(item.url ?? '')
  return (
    <div className="border-t border-slate-100 px-3 pb-3 pt-2 space-y-3">
      {(item.item_type === 'link' || item.item_type === 'social' || item.item_type === 'video') && (
        <>
          <input type="text" className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900" value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" />
          <input type="url" className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://" />
        </>
      )}
      {(item.item_type === 'header' || item.item_type === 'text' || item.item_type === 'divider') && (
        <input type="text" className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900" value={title} onChange={e => setTitle(e.target.value)} placeholder={item.item_type === 'header' ? 'Section heading' : 'Text'} />
      )}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
        <button onClick={() => onSave({ title: title || null, url: url || null })} className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
      </div>
    </div>
  )
}

function LinksAsListTab({ items, onToggle, onDelete, onEditTitle }: { items: LinkItem[]; onToggle: (i: LinkItem) => void; onDelete: (id: string) => void; onEditTitle: (id: string, u: Partial<LinkItem>) => void }) {
  const linkItems = items.filter(i => i.item_type === 'link')
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100"><h2 className="text-sm font-semibold text-slate-900">Links on this page</h2></div>
      <table className="w-full text-sm">
        <thead><tr className="bg-slate-50 border-b border-slate-100">
          <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-2">Title</th>
          <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-2">URL</th>
          <th className="text-right text-xs font-semibold text-slate-500 uppercase px-4 py-2">Clicks</th>
          <th className="text-right text-xs font-semibold text-slate-500 uppercase px-4 py-2">Active</th>
          <th className="px-4 py-2" />
        </tr></thead>
        <tbody>
          {linkItems.map(item => (
            <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
              <td className="px-4 py-2.5 font-medium text-slate-900">{item.title ?? 'Link'}</td>
              <td className="px-4 py-2.5 text-slate-500 truncate max-w-[220px]">{item.url}</td>
              <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{item.click_count}</td>
              <td className="px-4 py-2.5 text-right">
                <button onClick={() => onToggle(item)} className={cn('relative w-9 h-5 rounded-full transition-colors inline-block', item.is_active ? 'bg-blue-600' : 'bg-slate-200')}>
                  <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', item.is_active ? 'translate-x-4' : 'translate-x-0.5')} />
                </button>
              </td>
              <td className="px-4 py-2.5 text-right"><button onClick={() => onDelete(item.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={13} /></button></td>
            </tr>
          ))}
          {linkItems.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">No links yet — add one from the Design tab.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function NotConnectedTab({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <EmptyState icon={Icon} title={`${title} isn't connected yet`} description={description} />
    </div>
  )
}

function AnalyticsTab({ page, items, ctr }: { page: LinkPage; items: LinkItem[]; ctr: string }) {
  const linkItems = items.filter(i => i.item_type === 'link' && i.click_count > 0).sort((a, b) => b.click_count - a.click_count)
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        {[{ label: 'Total views', value: page.total_views.toLocaleString() }, { label: 'Total clicks', value: page.total_clicks.toLocaleString() }, { label: 'CTR', value: `${ctr}%` }].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center"><p className="text-2xl font-bold text-slate-900">{k.value}</p><p className="text-xs text-slate-500 mt-1">{k.label}</p></div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Clicks per link</h3>
        {linkItems.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={linkItems.map(i => ({ name: (i.title ?? 'Link').slice(0, 20), clicks: i.click_count }))} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip />
              <Bar dataKey="clicks" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <div className="h-40 flex items-center justify-center text-sm text-slate-400">No click data yet</div>}
      </div>
    </div>
  )
}

function SettingsTab({ page, onSaved, publicUrl, showToast }: { page: LinkPage; onSaved: (p: LinkPage) => void; publicUrl: string; showToast: (m: string) => void }) {
  const [form, setForm] = useState({
    title: page.title, slug: page.slug, description: page.description ?? '',
    show_caption_fox_branding: page.show_caption_fox_branding, visibility: page.visibility,
    seo_title: page.seo_title ?? '', seo_description: page.seo_description ?? '',
    background_type: page.background_type, background_value: page.background_value,
    primary_color: page.primary_color, button_color: page.button_color, button_text_color: page.button_text_color,
    button_style: page.button_style, font_family: page.font_family,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!/^[a-z0-9-]+$/.test(form.slug)) { setError('Slug: lowercase letters, numbers and hyphens only'); return }
    setSaving(true); setError(null)
    try {
      const supabase = createClient()
      const { data, error: err } = await supabase.from('link_pages').update({
        title: form.title, slug: form.slug, description: form.description || null,
        show_caption_fox_branding: form.show_caption_fox_branding, visibility: form.visibility,
        seo_title: form.seo_title || null, seo_description: form.seo_description || null,
        background_type: form.background_type, background_value: form.background_value,
        primary_color: form.primary_color, button_color: form.button_color, button_text_color: form.button_text_color,
        button_style: form.button_style, font_family: form.font_family,
      }).eq('id', page.id).select().single()
      if (err) { if (err.code === '23505') throw new Error('That slug is already taken'); throw err }
      onSaved(data)
      showToast('Settings saved')
    } catch (e: any) { setError(e.message ?? 'Failed to save') } finally { setSaving(false) }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">General</h3>
        {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><X size={14} /> {error}</div>}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Page title</label>
          <input type="text" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Slug</label>
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
            <span className="px-3 py-2.5 text-xs text-slate-400 bg-slate-50 border-r border-slate-200 whitespace-nowrap">{getAppUrl()}/l/</span>
            <input type="text" className="flex-1 px-3 py-2.5 text-sm text-slate-900 focus:outline-none" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Description</label>
          <textarea rows={2} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 resize-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Visibility</label>
          <select className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900" value={form.visibility} onChange={e => setForm(f => ({ ...f, visibility: e.target.value }))}>
            <option value="public">Public</option>
            <option value="private">Private (unlisted)</option>
          </select>
        </div>
        <div className="flex items-center justify-between py-2 border-t border-slate-100">
          <span className="text-sm text-slate-700">Show &quot;Made with Caption Fox&quot;</span>
          <button onClick={() => setForm(f => ({ ...f, show_caption_fox_branding: !f.show_caption_fox_branding }))} className={cn('relative w-10 h-5 rounded-full transition-colors', form.show_caption_fox_branding ? 'bg-blue-600' : 'bg-slate-200')}>
            <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', form.show_caption_fox_branding ? 'translate-x-5' : 'translate-x-0.5')} />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Appearance</h3>
          <div className="grid grid-cols-3 gap-2">
            {(form.background_type === 'gradient' ? GRADIENT_PRESETS : BG_PRESETS).map(p => (
              <button key={p.value} onClick={() => setForm(f => ({ ...f, background_value: p.value }))} className={cn('h-9 rounded-lg border-2', form.background_value === p.value ? 'border-blue-500' : 'border-transparent')} style={form.background_type === 'gradient' ? { background: p.value } : { backgroundColor: p.value }} title={p.label} />
            ))}
          </div>
          <div className="flex gap-2">
            {(['color', 'gradient'] as const).map(t => <button key={t} onClick={() => setForm(f => ({ ...f, background_type: t }))} className={cn('flex-1 py-1.5 text-xs font-medium rounded-lg border capitalize', form.background_type === t ? 'bg-blue-600 text-white border-blue-600' : 'text-slate-600 border-slate-200')}>{t}</button>)}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[{ label: 'Primary', key: 'primary_color' as const }, { label: 'Button', key: 'button_color' as const }, { label: 'Btn text', key: 'button_text_color' as const }].map(({ label, key }) => (
              <div key={key}>
                <label className="block text-[11px] text-slate-500 mb-1">{label}</label>
                <input type="color" className="w-full h-8 rounded cursor-pointer border border-slate-200" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <select className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900" value={form.font_family} onChange={e => setForm(f => ({ ...f, font_family: e.target.value }))}>
            {FONT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">SEO &amp; sharing</h3>
          <input type="text" placeholder="SEO title" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900" value={form.seo_title} onChange={e => setForm(f => ({ ...f, seo_title: e.target.value }))} />
          <textarea rows={2} placeholder="SEO description" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 resize-none" value={form.seo_description} onChange={e => setForm(f => ({ ...f, seo_description: e.target.value }))} />
        </div>

        <Button variant="primary" loading={saving} onClick={save} className="w-full">Save settings</Button>
      </div>
    </div>
  )
}

function VersionsTab({ versions, currentVersion }: { versions: VersionRow[]; currentVersion: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden max-w-3xl">
      <div className="px-5 py-3.5 border-b border-slate-100"><h2 className="text-sm font-semibold text-slate-900">Publish history</h2></div>
      {versions.length === 0 ? (
        <EmptyState icon={History} compact title="No versions yet" description="Publish your first changes to start version history." />
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 border-b border-slate-100">
            <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-2">Version</th>
            <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-2">Date</th>
            <th className="text-right text-xs font-semibold text-slate-500 uppercase px-4 py-2">Status</th>
          </tr></thead>
          <tbody>
            {versions.map(v => (
              <tr key={v.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5 font-medium text-slate-900">v{v.version} {v.version === currentVersion && <span className="text-xs text-blue-600 ml-1">(current)</span>}</td>
                <td className="px-4 py-2.5 text-slate-500">{new Date(v.created_at).toLocaleString('en-GB')}</td>
                <td className="px-4 py-2.5 text-right"><Badge variant={v.published ? 'green' : 'slate'}>{v.published ? 'Published' : 'Draft snapshot'}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
