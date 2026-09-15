'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Palette, Copy, Trash2, Edit, X, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import LinksSubnav from '@/components/link-in-bio/LinksSubnav'

interface ThemeTokens {
  palette?: { background?: string; primary?: string; buttonBg?: string; buttonText?: string }
  typography?: { fontFamily?: string; weight?: string }
  buttons?: { style?: string; shadow?: string }
  radius?: string
}

interface ThemeRow {
  id: string
  name: string
  category: string | null
  status: string
  tokens: ThemeTokens
  usage_count: number
  updated_at: string
  created_at: string
}

function ThemeSwatch({ tokens }: { tokens: ThemeTokens }) {
  const bg = tokens.palette?.background ?? '#0C1A2E'
  const isGradient = bg.includes('gradient')
  const btnBg = tokens.palette?.buttonBg ?? '#2563EB'
  const btnText = tokens.palette?.buttonText ?? '#FFFFFF'
  const radius = tokens.radius === 'full' ? '9999px' : tokens.radius === 'none' ? '0' : '10px'
  return (
    <div className="w-full h-28 flex items-center justify-center" style={isGradient ? { background: bg } : { backgroundColor: bg }}>
      <div className="flex flex-col gap-1.5 w-24">
        {[1, 2].map(i => (
          <div key={i} className="h-4 text-[8px] flex items-center justify-center font-semibold" style={{ backgroundColor: btnBg, color: btnText, borderRadius: radius }}>Link</div>
        ))}
      </div>
    </div>
  )
}

export default function ThemesPage() {
  const router = useRouter()
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [themes, setThemes] = useState<ThemeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ThemeRow | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    async function bootstrap() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)
      const { data } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).single()
      if (data?.workspace_id) setWorkspaceId(data.workspace_id)
      else setLoading(false)
    }
    bootstrap()
  }, [])

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('link_themes').select('*').eq('workspace_id', workspaceId).order('updated_at', { ascending: false })
    setThemes(data ?? [])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { if (workspaceId) load() }, [workspaceId, load])

  const kpis = useMemo(() => {
    const active = themes.filter(t => t.status === 'active').length
    const totalUsage = themes.reduce((a, t) => a + t.usage_count, 0)
    const mostUsed = [...themes].sort((a, b) => b.usage_count - a.usage_count)[0]
    return [
      { label: 'Total themes', value: themes.length },
      { label: 'Active', value: active },
      { label: 'Pages using a theme', value: totalUsage },
      { label: 'Most used', value: mostUsed ? mostUsed.name : '—' },
    ]
  }, [themes])

  const filtered = themes.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function openCreate() { setName(''); setCreateError(null); setShowCreate(true) }

  async function handleCreate() {
    if (!workspaceId || !userId) return
    if (!name.trim()) { setCreateError('Name is required'); return }
    setCreating(true); setCreateError(null)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('link_themes').insert({
        workspace_id: workspaceId, name, owner_id: userId, created_by: userId, status: 'draft',
        tokens: {
          palette: { background: '#0C1A2E', primary: '#2563EB', buttonBg: '#2563EB', buttonText: '#FFFFFF' },
          typography: { fontFamily: 'inter', weight: 'semibold' },
          buttons: { style: 'rounded', shadow: 'soft' },
          radius: 'lg',
        },
      }).select().single()
      if (error) throw error
      setShowCreate(false)
      router.push(`/app/links/themes/${data.id}/editor`)
    } catch (e: any) {
      setCreateError(e.message ?? 'Failed to create theme')
    } finally { setCreating(false) }
  }

  async function duplicateTheme(t: ThemeRow) {
    if (!workspaceId || !userId) return
    const supabase = createClient()
    const { data, error } = await supabase.from('link_themes').insert({
      workspace_id: workspaceId, name: `${t.name} (copy)`, category: t.category, owner_id: userId, created_by: userId,
      status: 'draft', tokens: t.tokens, usage_count: 0,
    }).select().single()
    if (!error && data) { setThemes(prev => [data, ...prev]); showToast('Theme duplicated') }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const supabase = createClient()
    await supabase.from('link_themes').delete().eq('id', deleteTarget.id)
    setThemes(prev => prev.filter(t => t.id !== deleteTarget.id))
    setDeleteTarget(null)
    showToast('Theme deleted')
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <LinksSubnav active="themes" />
      <PageHeader title="Themes" subtitle="Reusable visual styles you can apply to any link page.">
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openCreate}>New theme</Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-3.5">
            <p className="text-xs font-medium text-slate-500 mb-1">{k.label}</p>
            <p className="text-xl font-bold text-slate-900 truncate">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search themes…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700">
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState icon={Palette} title="No themes yet" description="Create a theme to reuse consistent styling across your link pages." action={{ label: 'Create theme', onClick: openCreate, icon: <Plus size={14} /> }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filtered.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
              <button onClick={() => router.push(`/app/links/themes/${t.id}/editor`)} className="w-full block">
                <ThemeSwatch tokens={t.tokens} />
              </button>
              <div className="p-3.5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <button onClick={() => router.push(`/app/links/themes/${t.id}/editor`)} className="text-left min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 truncate hover:text-blue-600">{t.name}</h3>
                    <p className="text-xs text-slate-400 truncate">{t.category ?? 'Uncategorised'} · used on {t.usage_count} page{t.usage_count === 1 ? '' : 's'}</p>
                  </button>
                  <Badge status={t.status} className="shrink-0">{t.status}</Badge>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => router.push(`/app/links/themes/${t.id}/editor`)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"><Edit size={10} /> Edit</button>
                  <button onClick={() => duplicateTheme(t)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"><Copy size={10} /></button>
                  <button onClick={() => setDeleteTarget(t)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg ml-auto"><Trash2 size={10} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Theme" size="sm"
        footer={<><Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button><Button variant="primary" loading={creating} onClick={handleCreate}>Create & edit</Button></>}>
        <div className="space-y-4">
          {createError && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><X size={14} /> {createError}</div>}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Theme name <span className="text-red-500">*</span></label>
            <input type="text" autoFocus value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900" placeholder="e.g. Midnight Studio" />
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Theme" description={`Delete "${deleteTarget?.name}"? Pages using it will fall back to their own colours.`} size="sm"
        footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="danger" onClick={confirmDelete}>Delete</Button></>}>
        <p className="text-sm text-slate-600">This cannot be undone.</p>
      </Modal>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white text-sm font-medium rounded-xl shadow-xl">
          <CheckCircle size={14} className="text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  )
}
