'use client'

import { useState } from 'react'
import { Copy, Check, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const QUICK_PROMPTS: { label: string; type: string; topic: string; platform?: string }[] = [
  { label: 'Generate 10 TikTok hooks', type: 'hook', topic: 'growing an audience organically', platform: 'tiktok' },
  { label: 'Write an Instagram caption', type: 'caption', topic: 'a new product launch', platform: 'instagram' },
  { label: 'Create a LinkedIn post', type: 'caption', topic: 'a lesson learned this quarter', platform: 'linkedin' },
  { label: 'Generate hashtag set', type: 'hashtags', topic: 'the current campaign topic', platform: 'instagram' },
  { label: 'Write a Reel script', type: 'script', topic: 'a behind-the-scenes moment', platform: 'reels' },
  { label: 'Generate content ideas', type: 'ideas', topic: 'this week’s content calendar' },
]

const TYPES = [
  { id: 'caption', label: 'Caption' },
  { id: 'hook', label: 'Hook' },
  { id: 'script', label: 'Script' },
  { id: 'hashtags', label: 'Hashtags' },
  { id: 'ideas', label: 'Ideas' },
]

export function CreateTab({ workspaceId }: { workspaceId: string }) {
  const [type, setType] = useState('caption')
  const [platform, setPlatform] = useState('instagram')
  const [topic, setTopic] = useState('')
  const [useBrandVoice, setUseBrandVoice] = useState(true)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  async function generate(overrideTopic?: string, overrideType?: string, overridePlatform?: string) {
    const t = overrideTopic ?? topic
    if (!t.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: overrideType ?? type, platform: overridePlatform ?? platform, topic: t.trim(), count: 3, workspaceId,
          brandVoice: useBrandVoice ? undefined : 'no specific brand voice — keep it generic',
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Generation failed.'); return }
      const out = Array.isArray(data.result) ? data.result : [String(data.result ?? '')]
      setResults(out)
    } catch {
      setError('Something went wrong generating content. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function copy(i: number, text: string) {
    navigator.clipboard.writeText(text).then(() => { setCopiedIndex(i); setTimeout(() => setCopiedIndex(null), 1500) })
  }

  return (
    <div className="max-h-[560px] space-y-4 overflow-y-auto p-4">
      {results.length === 0 && !loading && (
        <div className="pb-1 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-fox-50"><Sparkles size={20} className="text-blue-500" /></div>
          <p className="text-sm font-medium text-slate-700">Generate captions, hooks, scripts & more</p>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {QUICK_PROMPTS.map(p => (
              <button key={p.label} onClick={() => { setType(p.type); if (p.platform) setPlatform(p.platform); setTopic(p.topic); generate(p.topic, p.type, p.platform) }} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-200">
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map(t => (
            <button key={t.id} onClick={() => setType(t.id)} className={cn('rounded-full px-2.5 py-1 text-xs font-medium', type === t.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200')}>{t.label}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && generate()} placeholder="What would you like to create?" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <select value={platform} onChange={e => setPlatform(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-sm">
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="linkedin">LinkedIn</option>
            <option value="facebook">Facebook</option>
            <option value="x">X</option>
            <option value="youtube">YouTube</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={useBrandVoice} onChange={e => setUseBrandVoice(e.target.checked)} className="rounded" />
          Use Caption Fox Brand Voice
        </label>
        <Button size="sm" className="w-full" loading={loading} disabled={!topic.trim()} onClick={() => generate()} icon={<Sparkles size={13} />}>Generate</Button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="whitespace-pre-wrap text-sm text-slate-800">{r}</p>
              <div className="mt-2 flex gap-1.5">
                <button onClick={() => copy(i, r)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                  {copiedIndex === i ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />} {copiedIndex === i ? 'Copied' : 'Copy'}
                </button>
                <button onClick={() => generate()} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"><RefreshCw size={11} /> Regenerate</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
