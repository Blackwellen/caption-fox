'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Rocket, CheckCircle, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { PublicMicroPageRenderer, type RenderablePage } from '@/components/link-in-bio/PublicMicroPageRenderer'

interface ThemeTokens {
  palette: { background: string; primary: string; buttonBg: string; buttonText: string }
  typography: { fontFamily: string; weight: string }
  buttons: { style: string; shadow: string }
  radius: string
}

interface ThemeRow {
  id: string
  workspace_id: string
  name: string
  category: string | null
  status: string
  tokens: ThemeTokens
  usage_count: number
  created_at: string
  updated_at: string
}

interface PageUsingTheme { id: string; title: string; slug: string; total_clicks: number; total_views: number; status: string }

const BG_PRESETS = ['#0C1A2E', '#000000', '#FFFFFF', '#6B21A8', '#1E293B', '#0F766E', 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)', 'linear-gradient(135deg, #0C1A2E 0%, #1e40af 100%)']
const FONT_OPTIONS = [{ value: 'inter', label: 'Inter' }, { value: 'poppins', label: 'Poppins' }, { value: 'playfair', label: 'Playfair Display' }, { value: 'mono', label: 'Monospace' }]

const DEMO_ITEMS = [
  { id: '1', item_type: 'link' as const, title: 'Shop Bestsellers', url: '#', is_active: true, sort_order: 0 },
  { id: '2', item_type: 'link' as const, title: 'New Arrivals', url: '#', is_active: true, sort_order: 1 },
  { id: '3', item_type: 'link' as const, title: 'Find Us on Instagram', url: '#', is_active: true, sort_order: 2 },
]

export default function ThemeEditorPage() {
  const params = useParams()
  const router = useRouter()
  const themeId = params.id as string

  const [theme, setTheme] = useState<ThemeRow | null>(null)
  const [pagesUsing, setPagesUsing] = useState<PageUsingTheme[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [tokens, setTokens] = useState<ThemeTokens | null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: t } = await supabase.from('link_themes').select('*').eq('id', themeId).single()
    if (t) {
      setTheme(t)
      setName(t.name)
      setTokens(t.tokens)
      const { data: pages } = await supabase.from('link_pages').select('id, title, slug, total_clicks, total_views, status').eq('theme_id', themeId)
      setPagesUsing(pages ?? [])
    }
    setLoading(false)
  }, [themeId])

  useEffect(() => { load() }, [load])

  async function saveTokens() {
    if (!theme || !tokens) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { data } = await supabase.from('link_themes').update({ name, tokens }).eq('id', theme.id).select().single()
      if (data) setTheme(data)
      showToast('Theme saved')
    } finally { setSaving(false) }
  }

  async function publishTheme() {
    if (!theme || !tokens) return
    setPublishing(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: versions } = await supabase.from('link_theme_versions').select('version').eq('theme_id', theme.id).order('version', { ascending: false }).limit(1)
      const nextVersion = (versions?.[0]?.version ?? 0) + 1
      await supabase.from('link_theme_versions').insert({ theme_id: theme.id, workspace_id: theme.workspace_id, version: nextVersion, tokens, published: true, created_by: user?.id ?? null })
      const { data } = await supabase.from('link_themes').update({ name, tokens, status: 'active' }).eq('id', theme.id).select().single()
      if (data) setTheme(data)
      showToast('Theme published')
    } finally { setPublishing(false) }
  }

  if (loading || !theme || !tokens) {
    return <div className="p-6 max-w-[1600px] mx-auto"><Skeleton className="h-10 w-80 mb-4" /><Skeleton className="h-[500px] w-full rounded-xl" /></div>
  }

  const previewPage: RenderablePage = {
    title: name || 'Your Page', description: 'Bright days. Bold moves.', avatar_url: null,
    background_type: tokens.palette.background.includes('gradient') ? 'gradient' : 'color',
    background_value: tokens.palette.background, primary_color: tokens.palette.primary,
    button_style: (tokens.buttons.style as any) ?? 'rounded', button_color: tokens.palette.buttonBg,
    button_text_color: tokens.palette.buttonText, font_family: tokens.typography.fontFamily, show_caption_fox_branding: true,
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <button onClick={() => router.push('/app/links/themes')} className="hover:text-blue-600">Themes</button>
            <span>/</span><span className="text-slate-600">{theme.name}</span>
          </div>
          <input value={name} onChange={e => setName(e.target.value)} className="text-xl font-bold text-slate-900 border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-none bg-transparent" />
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5">
            <Badge status={theme.status}>{theme.status}</Badge>
            <span>Used on {pagesUsing.length} page{pagesUsing.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" loading={saving} onClick={saveTokens}>Save draft</Button>
          <Button variant="primary" size="sm" icon={<Rocket size={14} />} loading={publishing} onClick={publishTheme}>Publish theme</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Colour palette</label>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {BG_PRESETS.map(c => (
                <button key={c} onClick={() => setTokens(t => t ? { ...t, palette: { ...t.palette, background: c } } : t)} className={cn('h-10 rounded-lg border-2', tokens.palette.background === c ? 'border-blue-500' : 'border-transparent')} style={c.includes('gradient') ? { background: c } : { backgroundColor: c }} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[{ label: 'Primary', key: 'primary' as const }, { label: 'Button bg', key: 'buttonBg' as const }, { label: 'Button text', key: 'buttonText' as const }].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-[11px] text-slate-500 mb-1">{label}</label>
                  <input type="color" className="w-full h-9 rounded cursor-pointer border border-slate-200" value={tokens.palette[key]} onChange={e => setTokens(t => t ? { ...t, palette: { ...t.palette, [key]: e.target.value } } : t)} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Typography</label>
            <select value={tokens.typography.fontFamily} onChange={e => setTokens(t => t ? { ...t, typography: { ...t.typography, fontFamily: e.target.value } } : t)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900">
              {FONT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Buttons</label>
            <div className="flex gap-2">
              {(['square', 'rounded', 'pill'] as const).map(s => (
                <button key={s} onClick={() => setTokens(t => t ? { ...t, buttons: { ...t.buttons, style: s } } : t)} className={cn('flex-1 py-2 text-xs font-semibold border-2 transition-all capitalize', s === 'pill' ? 'rounded-full' : s === 'square' ? 'rounded-none' : 'rounded-lg', tokens.buttons.style === s ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600')}>{s}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Card radius</label>
            <div className="flex gap-2">
              {(['none', 'md', 'lg', 'full'] as const).map(r => (
                <button key={r} onClick={() => setTokens(t => t ? { ...t, radius: r } : t)} className={cn('flex-1 py-2 text-xs font-semibold border-2 uppercase', tokens.radius === r ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600')}>{r}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="sticky top-4 space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <p className="text-xs font-medium text-slate-500 px-3 pt-3 pb-2">Live preview</p>
            <div className="flex justify-center pb-4">
              <div className="relative w-[240px] shrink-0">
                <div className="relative bg-slate-900 rounded-[2.3rem] border-4 border-slate-800 shadow-xl overflow-hidden" style={{ height: 480 }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-slate-900 rounded-b-2xl z-10" />
                  <div className="absolute inset-0 overflow-hidden rounded-[2rem]">
                    <PublicMicroPageRenderer page={previewPage} items={DEMO_ITEMS} frameless />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Pages using this theme</h3>
            {pagesUsing.length === 0 ? <p className="text-xs text-slate-400">No pages yet.</p> : (
              <div className="space-y-2">
                {pagesUsing.slice(0, 6).map(p => (
                  <button key={p.id} onClick={() => router.push(`/app/links/${p.id}`)} className="w-full flex items-center justify-between gap-2 text-left group">
                    <span className="text-xs text-slate-700 group-hover:text-blue-600 truncate flex items-center gap-1">{p.title} <ExternalLink size={10} className="text-slate-300" /></span>
                    <span className="text-xs text-slate-400 shrink-0">{p.total_clicks} clicks</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white text-sm font-medium rounded-xl shadow-xl">
          <CheckCircle size={14} className="text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  )
}
