'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, Grid3x3, Table as TableIcon, Copy, Eye, BarChart2,
  Download, Upload, MoreHorizontal, Globe, AlertTriangle, CheckCircle,
  Link2, ExternalLink, Trash2, Edit, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import LinksSubnav from '@/components/link-in-bio/LinksSubnav'

interface LinkPageRow {
  id: string
  slug: string
  title: string
  description: string | null
  background_type: 'color' | 'gradient' | 'image'
  background_value: string
  primary_color: string
  status: string
  is_active: boolean
  owner_id: string | null
  theme_id: string | null
  total_views: number
  total_clicks: number
  updated_at: string
  created_at: string
  tags: string[]
}

interface ReusableLinkRow {
  id: string
  name: string
  destination_url: string
  vanity_slug: string | null
  label: string | null
  status: string
  utm: Record<string, string>
  owner_id: string | null
  click_count: number
  updated_at: string
  created_at: string
  tags: string[]
}

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}
function getAppUrl() {
  return typeof window !== 'undefined' ? window.location.origin : 'https://captionfox.app'
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

type ViewMode = 'cards' | 'table'
type TypeFilter = 'all' | 'pages' | 'reusable'

export default function LinkLibraryPage() {
  const router = useRouter()
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pages, setPages] = useState<LinkPageRow[]>([])
  const [reusableLinks, setReusableLinks] = useState<ReusableLinkRow[]>([])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [view, setView] = useState<ViewMode>('cards')

  const [showCreatePage, setShowCreatePage] = useState(false)
  const [showCreateLink, setShowCreateLink] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'page' | 'link'; id: string; label: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [pageForm, setPageForm] = useState({ title: '', slug: '', description: '' })
  const [linkForm, setLinkForm] = useState({ name: '', destination_url: '', vanity_slug: '', label: '' })

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    async function bootstrap() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)
      const { data } = await supabase.from('workspace_members').select('workspace_id')
        .eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).single()
      if (data?.workspace_id) setWorkspaceId(data.workspace_id)
      else setLoading(false)
    }
    bootstrap()
  }, [])

  const loadAll = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const supabase = createClient()
    const [{ data: pg }, { data: rl }] = await Promise.all([
      supabase.from('link_pages').select('*').eq('workspace_id', workspaceId).order('updated_at', { ascending: false }),
      supabase.from('reusable_links').select('*').eq('workspace_id', workspaceId).order('updated_at', { ascending: false }),
    ])
    setPages(pg ?? [])
    setReusableLinks(rl ?? [])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { if (workspaceId) loadAll() }, [workspaceId, loadAll])

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalPages = pages.length
    const published = pages.filter(p => p.status === 'published').length
    const draft = pages.filter(p => p.status === 'draft').length
    const totalViews = pages.reduce((a, p) => a + (p.total_views ?? 0), 0)
    const totalClicks = pages.reduce((a, p) => a + (p.total_clicks ?? 0), 0) + reusableLinks.reduce((a, l) => a + (l.click_count ?? 0), 0)
    const avgCtr = totalViews > 0 ? ((pages.reduce((a, p) => a + (p.total_clicks ?? 0), 0) / totalViews) * 100).toFixed(1) : '0.0'
    return [
      { label: 'Total pages', value: totalPages, tone: 'text-violet-600' },
      { label: 'Published', value: published, tone: 'text-emerald-600' },
      { label: 'Draft', value: draft, tone: 'text-slate-500' },
      { label: 'Avg CTR', value: `${avgCtr}%`, tone: 'text-blue-600' },
      { label: 'Total clicks', value: totalClicks.toLocaleString(), tone: 'text-amber-600' },
      { label: 'Reusable links', value: reusableLinks.length, tone: 'text-pink-600' },
    ]
  }, [pages, reusableLinks])

  // ── Governance alerts (real, computed) ──────────────────────────────────────
  const [nowRef] = useState(() => Date.now())
  const alerts = useMemo(() => {
    const missingUtm = reusableLinks.filter(l => !l.utm || Object.keys(l.utm).length === 0).length
    const stalePublished = pages.filter(p => p.status === 'draft' && (nowRef - new Date(p.updated_at).getTime()) > 1000 * 60 * 60 * 24 * 14).length
    const pausedLinks = reusableLinks.filter(l => l.status === 'paused').length
    return [
      { label: `${missingUtm} reusable link${missingUtm === 1 ? '' : 's'} missing UTM tags`, count: missingUtm, icon: AlertTriangle },
      { label: `${stalePublished} draft${stalePublished === 1 ? '' : 's'} untouched 14+ days`, count: stalePublished, icon: AlertTriangle },
      { label: `${pausedLinks} reusable link${pausedLinks === 1 ? '' : 's'} paused`, count: pausedLinks, icon: AlertTriangle },
    ].filter(a => a.count > 0)
  }, [pages, reusableLinks])

  const recentActivity = useMemo(() => {
    const items = [
      ...pages.map(p => ({ id: `p-${p.id}`, label: `"${p.title}" updated`, at: p.updated_at, href: `/app/links/${p.id}` })),
      ...reusableLinks.map(l => ({ id: `l-${l.id}`, label: `"${l.name}" updated`, at: l.updated_at, href: `/app/links/reusable-links/${l.id}` })),
    ]
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 6)
  }, [pages, reusableLinks])

  // ── Filtering ────────────────────────────────────────────────────────────
  const filteredPages = pages.filter(p => {
    if (typeFilter === 'reusable') return false
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !p.slug.includes(search.toLowerCase())) return false
    return true
  })
  const filteredLinks = reusableLinks.filter(l => {
    if (typeFilter === 'pages') return false
    if (statusFilter !== 'all' && l.status !== statusFilter) return false
    if (search && !l.name.toLowerCase().includes(search.toLowerCase()) && !l.destination_url.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // ── Create page ──────────────────────────────────────────────────────────
  function openCreatePage() {
    setPageForm({ title: '', slug: '', description: '' })
    setCreateError(null)
    setShowCreatePage(true)
  }

  async function handleCreatePage() {
    if (!workspaceId || !userId) return
    if (!pageForm.title.trim()) { setCreateError('Title is required'); return }
    const slug = pageForm.slug.trim() || slugify(pageForm.title)
    if (!/^[a-z0-9-]+$/.test(slug)) { setCreateError('Slug can only contain lowercase letters, numbers and hyphens'); return }
    setCreating(true); setCreateError(null)
    try {
      const supabase = createClient()
      const { data: page, error } = await supabase.from('link_pages').insert({
        workspace_id: workspaceId, slug, title: pageForm.title, description: pageForm.description || null,
        owner_id: userId, created_by: userId, status: 'draft', is_active: false,
      }).select().single()
      if (error) {
        if (error.code === '23505') throw new Error('That slug is already taken, choose another')
        throw error
      }
      setShowCreatePage(false)
      router.push(`/app/links/${page.id}`)
    } catch (e: any) {
      setCreateError(e.message ?? 'Failed to create page')
    } finally { setCreating(false) }
  }

  // ── Create reusable link ─────────────────────────────────────────────────
  function openCreateLink() {
    setLinkForm({ name: '', destination_url: '', vanity_slug: '', label: '' })
    setCreateError(null)
    setShowCreateLink(true)
  }

  async function handleCreateLink() {
    if (!workspaceId || !userId) return
    if (!linkForm.name.trim()) { setCreateError('Name is required'); return }
    if (!linkForm.destination_url.trim()) { setCreateError('Destination URL is required'); return }
    try { new URL(linkForm.destination_url) } catch { setCreateError('Enter a valid URL, including https://'); return }
    setCreating(true); setCreateError(null)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('reusable_links').insert({
        workspace_id: workspaceId, name: linkForm.name, destination_url: linkForm.destination_url,
        vanity_slug: linkForm.vanity_slug ? slugify(linkForm.vanity_slug) : null,
        label: linkForm.label || null, owner_id: userId, created_by: userId,
      }).select().single()
      if (error) {
        if (error.code === '23505') throw new Error('That vanity slug is already taken')
        throw error
      }
      setShowCreateLink(false)
      setReusableLinks(prev => [data, ...prev])
      showToast('Reusable link created')
    } catch (e: any) {
      setCreateError(e.message ?? 'Failed to create link')
    } finally { setCreating(false) }
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteTarget) return
    const supabase = createClient()
    if (deleteTarget.kind === 'page') {
      await supabase.from('link_pages').delete().eq('id', deleteTarget.id)
      setPages(prev => prev.filter(p => p.id !== deleteTarget.id))
    } else {
      await supabase.from('reusable_links').delete().eq('id', deleteTarget.id)
      setReusableLinks(prev => prev.filter(l => l.id !== deleteTarget.id))
    }
    setDeleteTarget(null)
    showToast('Deleted')
  }

  // ── Export (real CSV of the currently filtered rows) ────────────────────
  function exportCsv() {
    const rows = [
      ['type', 'name', 'slug_or_destination', 'status', 'clicks', 'updated_at'],
      ...filteredPages.map(p => ['page', p.title, `${getAppUrl()}/l/${p.slug}`, p.status, String(p.total_clicks), p.updated_at]),
      ...filteredLinks.map(l => ['reusable_link', l.name, l.destination_url, l.status, String(l.click_count), l.updated_at]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `link-library-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Export downloaded')
  }

  // ── Import (real CSV parse → creates reusable links: name,destination_url,label) ──
  async function handleImportFile(file: File) {
    if (!workspaceId || !userId) return
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter(Boolean)
    const header = lines[0]?.toLowerCase() ?? ''
    const startIdx = header.includes('name') && header.includes('destination') ? 1 : 0
    const rows = lines.slice(startIdx).map(l => l.split(',').map(c => c.replace(/^"|"$/g, '').trim()))
    const inserts = rows
      .filter(r => r[0] && r[1])
      .map(r => ({ workspace_id: workspaceId, name: r[0], destination_url: r[1], label: r[2] || null, owner_id: userId, created_by: userId }))
    if (inserts.length === 0) { showToast('No valid rows found (expected: name,destination_url,label)'); return }
    const supabase = createClient()
    const { data, error } = await supabase.from('reusable_links').insert(inserts).select()
    if (error) { showToast('Import failed: ' + error.message); return }
    setReusableLinks(prev => [...(data ?? []), ...prev])
    setShowImport(false)
    showToast(`Imported ${data?.length ?? 0} reusable link${(data?.length ?? 0) === 1 ? '' : 's'}`)
  }

  function copyPageLink(p: LinkPageRow) {
    navigator.clipboard.writeText(`${getAppUrl()}/l/${p.slug}`).then(() => showToast('Link copied!'))
  }
  function copyReusableLink(l: ReusableLinkRow) {
    const url = l.vanity_slug ? `${getAppUrl()}/r/${l.vanity_slug}` : l.destination_url
    navigator.clipboard.writeText(url).then(() => showToast('Link copied!'))
  }

  const bootstrapping = loading && pages.length === 0 && reusableLinks.length === 0

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <LinksSubnav active="library" />

      <PageHeader title="Link Library" subtitle="Manage published link pages, reusable links, and lightweight conversion pages.">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<Upload size={14} />} onClick={() => setShowImport(true)}>Import</Button>
          <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={exportCsv}>Export</Button>
          <Button variant="secondary" size="sm" icon={<Link2 size={14} />} onClick={openCreateLink}>New reusable link</Button>
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openCreatePage}>New link page</Button>
        </div>
      </PageHeader>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-3.5">
            <p className="text-xs font-medium text-slate-500 mb-1">{k.label}</p>
            <p className={cn('text-xl font-bold', k.tone)}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5 items-start">
        {/* ── Main column ── */}
        <div>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search link pages and reusable links…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400"
              />
            </div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as TypeFilter)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700">
              <option value="all">All types</option>
              <option value="pages">Link pages</option>
              <option value="reusable">Reusable links</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700">
              <option value="all">All status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg ml-auto">
              <button onClick={() => setView('cards')} className={cn('p-1.5 rounded-md', view === 'cards' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400')}><Grid3x3 size={14} /></button>
              <button onClick={() => setView('table')} className={cn('p-1.5 rounded-md', view === 'table' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400')}><TableIcon size={14} /></button>
            </div>
          </div>

          {bootstrapping ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 w-full rounded-xl" />)}
            </div>
          ) : filteredPages.length === 0 && filteredLinks.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200">
              <EmptyState
                icon={Globe}
                title="Nothing here yet"
                description="Create a link page or a reusable link to get started."
                action={{ label: 'Create link page', onClick: openCreatePage, icon: <Plus size={14} /> }}
              />
            </div>
          ) : view === 'cards' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPages.map(p => (
                <PageCard key={p.id} page={p} onOpen={() => router.push(`/app/links/${p.id}`)} onCopy={() => copyPageLink(p)} onAnalytics={() => router.push(`/app/links/${p.id}?tab=analytics`)} onDelete={() => setDeleteTarget({ kind: 'page', id: p.id, label: p.title })} />
              ))}
              {filteredLinks.map(l => (
                <ReusableLinkCard key={l.id} link={l} onOpen={() => router.push(`/app/links/reusable-links/${l.id}`)} onCopy={() => copyReusableLink(l)} onDelete={() => setDeleteTarget({ kind: 'link', id: l.id, label: l.name })} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Name</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Type</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Status</th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Clicks</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Updated</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filteredPages.map(p => (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/app/links/${p.id}`)}>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{p.title}</td>
                      <td className="px-4 py-2.5 text-slate-500">Link page</td>
                      <td className="px-4 py-2.5"><Badge status={p.status}>{p.status}</Badge></td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{p.total_clicks}</td>
                      <td className="px-4 py-2.5 text-slate-500">{timeAgo(p.updated_at)}</td>
                      <td className="px-4 py-2.5 text-right"><ExternalLink size={13} className="text-slate-300 inline" /></td>
                    </tr>
                  ))}
                  {filteredLinks.map(l => (
                    <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/app/links/reusable-links/${l.id}`)}>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{l.name}</td>
                      <td className="px-4 py-2.5 text-slate-500">Reusable link</td>
                      <td className="px-4 py-2.5"><Badge status={l.status}>{l.status}</Badge></td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{l.click_count}</td>
                      <td className="px-4 py-2.5 text-slate-500">{timeAgo(l.updated_at)}</td>
                      <td className="px-4 py-2.5 text-right"><ExternalLink size={13} className="text-slate-300 inline" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Right rail ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Recent activity</h3>
            {recentActivity.length === 0 ? (
              <p className="text-xs text-slate-400">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map(a => (
                  <button key={a.id} onClick={() => router.push(a.href)} className="w-full text-left flex items-start gap-2 group">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-700 group-hover:text-blue-600 truncate">{a.label}</p>
                      <p className="text-[11px] text-slate-400">{timeAgo(a.at)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Governance alerts</h3>
            {alerts.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-emerald-600">
                <CheckCircle size={14} /> Everything looks healthy
              </div>
            ) : (
              <div className="space-y-2.5">
                {alerts.map((a, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <a.icon size={13} className="text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-slate-600">{a.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ CREATE PAGE MODAL ═══ */}
      <Modal
        open={showCreatePage}
        onClose={() => setShowCreatePage(false)}
        title="New Link Page"
        description="Give it a title — you'll design it on the next screen."
        size="md"
        footer={<>
          <Button variant="secondary" onClick={() => setShowCreatePage(false)}>Cancel</Button>
          <Button variant="primary" loading={creating} onClick={handleCreatePage}>Create page</Button>
        </>}
      >
        <div className="space-y-4">
          {createError && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><X size={14} /> {createError}</div>}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Page title <span className="text-red-500">*</span></label>
            <input type="text" autoFocus value={pageForm.title} onChange={e => setPageForm(f => ({ ...f, title: e.target.value, slug: f.slug || slugify(e.target.value) }))}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900" placeholder="e.g. My Official Links" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Slug</label>
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
              <span className="px-3 py-2.5 text-xs text-slate-400 bg-slate-50 border-r border-slate-200 whitespace-nowrap">{getAppUrl()}/l/</span>
              <input type="text" value={pageForm.slug} onChange={e => setPageForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                className="flex-1 px-3 py-2.5 text-sm text-slate-900 focus:outline-none" placeholder="your-slug" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Description</label>
            <textarea rows={2} value={pageForm.description} onChange={e => setPageForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 resize-none" placeholder="A short bio or tagline" />
          </div>
        </div>
      </Modal>

      {/* ═══ CREATE REUSABLE LINK MODAL ═══ */}
      <Modal
        open={showCreateLink}
        onClose={() => setShowCreateLink(false)}
        title="New Reusable Link"
        description="A tracked link you can drop into any page, bio, or caption."
        size="md"
        footer={<>
          <Button variant="secondary" onClick={() => setShowCreateLink(false)}>Cancel</Button>
          <Button variant="primary" loading={creating} onClick={handleCreateLink}>Create link</Button>
        </>}
      >
        <div className="space-y-4">
          {createError && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><X size={14} /> {createError}</div>}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Name <span className="text-red-500">*</span></label>
            <input type="text" autoFocus value={linkForm.name} onChange={e => setLinkForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900" placeholder="e.g. Summer Sale Link" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Destination URL <span className="text-red-500">*</span></label>
            <input type="url" value={linkForm.destination_url} onChange={e => setLinkForm(f => ({ ...f, destination_url: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900" placeholder="https://" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Vanity slug (optional)</label>
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
              <span className="px-3 py-2.5 text-xs text-slate-400 bg-slate-50 border-r border-slate-200 whitespace-nowrap">{getAppUrl()}/r/</span>
              <input type="text" value={linkForm.vanity_slug} onChange={e => setLinkForm(f => ({ ...f, vanity_slug: e.target.value }))}
                className="flex-1 px-3 py-2.5 text-sm text-slate-900 focus:outline-none" placeholder="summer-sale" />
            </div>
          </div>
        </div>
      </Modal>

      {/* ═══ IMPORT MODAL ═══ */}
      <Modal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Import reusable links"
        description="Upload a CSV with columns: name, destination_url, label (optional)."
        size="sm"
        footer={<Button variant="secondary" onClick={() => setShowImport(false)}>Close</Button>}
      >
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl p-8 cursor-pointer hover:border-blue-300 transition-colors">
          <Upload size={22} className="text-slate-400" />
          <span className="text-sm text-slate-600">Click to choose a .csv file</span>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f) }} />
        </label>
      </Modal>

      {/* ═══ DELETE CONFIRM ═══ */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete"
        description={`Are you sure you want to delete "${deleteTarget?.label}"? This cannot be undone.`}
        size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete}>Delete</Button>
        </>}
      >
        <p className="text-sm text-slate-600">All associated analytics data will also be removed.</p>
      </Modal>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white text-sm font-medium rounded-xl shadow-xl">
          <CheckCircle size={14} className="text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  )
}

// ─── Cards ──────────────────────────────────────────────────────────────────

function PageCard({ page, onOpen, onCopy, onAnalytics, onDelete }: { page: LinkPageRow; onOpen: () => void; onCopy: () => void; onAnalytics: () => void; onDelete: () => void }) {
  const bgStyle = page.background_type === 'gradient' ? { background: page.background_value } : { backgroundColor: page.background_value }
  const ctr = page.total_views > 0 ? ((page.total_clicks / page.total_views) * 100).toFixed(1) : '0.0'
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
      <button onClick={onOpen} className="w-full h-28 relative overflow-hidden block" style={bgStyle}>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-6">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: page.primary_color }}>
            {page.title.charAt(0).toUpperCase()}
          </div>
          <p className="text-white font-semibold text-xs text-center truncate max-w-full">{page.title}</p>
        </div>
      </button>
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <button onClick={onOpen} className="min-w-0 text-left">
            <h3 className="text-sm font-semibold text-slate-900 truncate hover:text-blue-600">{page.title}</h3>
            <p className="text-xs text-slate-400 truncate mt-0.5">/l/{page.slug}</p>
          </button>
          <Badge status={page.status} className="shrink-0">{page.status}</Badge>
        </div>
        <div className="grid grid-cols-3 gap-1.5 mb-2.5">
          <div className="bg-slate-50 rounded-lg p-1.5 text-center"><p className="text-xs font-bold text-slate-900">{page.total_views}</p><p className="text-[10px] text-slate-400">Views</p></div>
          <div className="bg-slate-50 rounded-lg p-1.5 text-center"><p className="text-xs font-bold text-slate-900">{page.total_clicks}</p><p className="text-[10px] text-slate-400">Clicks</p></div>
          <div className="bg-slate-50 rounded-lg p-1.5 text-center"><p className="text-xs font-bold text-slate-900">{ctr}%</p><p className="text-[10px] text-slate-400">CTR</p></div>
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={onOpen} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"><Edit size={10} /> Edit</button>
          <a href={`/l/${page.slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"><Eye size={10} /> View</a>
          <button onClick={onCopy} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"><Copy size={10} /></button>
          <button onClick={onAnalytics} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg"><BarChart2 size={10} /></button>
          <button onClick={onDelete} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg ml-auto"><Trash2 size={10} /></button>
        </div>
      </div>
    </div>
  )
}

function ReusableLinkCard({ link, onOpen, onCopy, onDelete }: { link: ReusableLinkRow; onOpen: () => void; onCopy: () => void; onDelete: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
      <button onClick={onOpen} className="w-full h-28 bg-gradient-to-br from-slate-700 to-slate-900 relative overflow-hidden flex items-center justify-center">
        <Link2 size={28} className="text-white/70" />
      </button>
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <button onClick={onOpen} className="min-w-0 text-left">
            <h3 className="text-sm font-semibold text-slate-900 truncate hover:text-blue-600">{link.name}</h3>
            <p className="text-xs text-slate-400 truncate mt-0.5">{link.destination_url}</p>
          </button>
          <Badge status={link.status} className="shrink-0">{link.status}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-1.5 mb-2.5">
          <div className="bg-slate-50 rounded-lg p-1.5 text-center"><p className="text-xs font-bold text-slate-900">{link.click_count}</p><p className="text-[10px] text-slate-400">Clicks</p></div>
          <div className="bg-slate-50 rounded-lg p-1.5 text-center"><p className="text-xs font-bold text-slate-900">{Object.keys(link.utm ?? {}).length}</p><p className="text-[10px] text-slate-400">UTM tags</p></div>
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={onOpen} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"><Edit size={10} /> Edit</button>
          <button onClick={onCopy} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"><Copy size={10} /> Copy</button>
          <button onClick={onDelete} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg ml-auto"><Trash2 size={10} /></button>
        </div>
      </div>
    </div>
  )
}
