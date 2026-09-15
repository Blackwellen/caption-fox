'use client'

import { useState, useEffect } from 'react'
import { Image as ImageIcon, Sparkles, Download, Save } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { createClient } from '@/lib/supabase/client'
import type { MediaAsset } from '@/types/database'

const ASPECTS = ['1:1', '16:9', '9:16']
const STYLES = ['Photographic', '3D Render', 'Illustration', 'Minimal', 'Bold']

export function MediaTab({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  const [prompt, setPrompt] = useState('')
  const [aspect, setAspect] = useState('1:1')
  const [style, setStyle] = useState('Photographic')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ imageUrl: string | null; optimizedPrompt: string } | null>(null)
  const [recent, setRecent] = useState<MediaAsset[] | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const sb = createClient()
    sb.from('media_assets').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(6)
      .then(({ data }) => setRecent((data as MediaAsset[]) ?? []))
  }, [workspaceId])

  async function generate() {
    if (!prompt.trim() || loading) return
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/ai/image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), style: style.toLowerCase(), aspect_ratio: aspect, workspace_id: workspaceId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Generation failed.'); return }
      setResult({ imageUrl: data.image_url ?? null, optimizedPrompt: data.optimized_prompt ?? prompt })
      if (!data.image_url) setError('Image rendering is not configured on this environment — showing the optimised prompt only.')
    } catch {
      setError('Something went wrong generating media. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function saveToLibrary() {
    if (!result?.imageUrl) return
    setSaving(true)
    const sb = createClient()
    const { data } = await sb.from('media_assets').insert({
      workspace_id: workspaceId, brand_id: null, file_name: `fox-ai-${Date.now()}.png`,
      file_type: 'image/png', file_size: 0, storage_path: 'fox-ai/generated', public_url: result.imageUrl,
      width: null, height: null, duration: null, rights_status: 'ai_generated', tags: [style.toLowerCase()], uploaded_by: userId,
    }).select().single()
    if (data) setRecent(prev => [data as MediaAsset, ...(prev ?? [])].slice(0, 6))
    setSaving(false)
  }

  return (
    <div className="max-h-[560px] overflow-y-auto p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><ImageIcon size={16} /></div>
        <div><p className="text-sm font-semibold text-slate-900">Media</p><p className="text-xs text-slate-500">Generate images and creative assets</p></div>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe the image you want to generate…" rows={2} className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
        <div className="flex flex-wrap gap-1.5">
          {ASPECTS.map(a => <button key={a} onClick={() => setAspect(a)} className={`rounded-full px-2.5 py-1 text-xs font-medium ${aspect === a ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{a}</button>)}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STYLES.map(s => <button key={s} onClick={() => setStyle(s)} className={`rounded-full px-2.5 py-1 text-xs font-medium ${style === s ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{s}</button>)}
        </div>
        <Button size="sm" className="w-full" loading={loading} disabled={!prompt.trim()} onClick={generate} icon={<Sparkles size={13} />}>Generate</Button>
      </div>

      {error && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{error}</p>}

      {result && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
          {result.imageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.imageUrl} alt={result.optimizedPrompt} className="w-full rounded-lg" />
              <div className="mt-2 flex gap-1.5">
                <a href={result.imageUrl} download="fox-ai-image.png" className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"><Download size={11} /> Download</a>
                <button onClick={saveToLibrary} disabled={saving} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"><Save size={11} /> {saving ? 'Saving…' : 'Save to library'}</button>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500"><span className="font-medium text-slate-700">Optimised prompt:</span> {result.optimizedPrompt}</p>
          )}
        </div>
      )}

      <div className="mt-4">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Recent outputs</p>
        {recent === null ? (
          <div className="grid grid-cols-3 gap-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
        ) : recent.length === 0 ? (
          <p className="text-xs text-slate-400">Nothing generated yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {recent.map(a => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={a.id} src={a.public_url ?? undefined} alt={a.file_name} className="h-16 w-full rounded-lg object-cover" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
