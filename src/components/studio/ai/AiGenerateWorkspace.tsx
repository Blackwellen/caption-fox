'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlignLeft, Bookmark, BookmarkCheck, Braces, ChevronDown, ChevronRight, Clock, Copy, FileText, Folder, Info,
  Layers, Lightbulb, Loader2, MoreHorizontal, PenLine, RefreshCw, Save, Sparkles, Wand2, Zap,
  CheckCircle2, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/campaigns/Toast'
import { ChannelIcon } from '@/components/home/brand-icons'
import { AI_FORMATS, AI_LENGTHS, AI_OBJECTIVES, AI_TONES, CHANNEL_LABELS, STUDIO_CHANNELS, captionLimitFor } from '@/lib/studio/constants'
import { AI_LANGUAGES, AUDIENCES, STUDIO_AI_MODELS, type StudioAiModel } from '@/lib/studio/ai'
import { countCharacters, countEmojis, countWords, extractHashtags } from '@/lib/studio/text-format'
import { scoreContent } from '@/lib/studio/quality'
import { deletePrompt, savePrompt, setAiOutputState, useAiOutput as moveOutputToCompose } from '@/lib/studio/actions/ai'
import type { AiOutputRow, PromptRow } from '@/lib/studio/types'
import SocialPreview, { type PreviewAccountLite } from '../SocialPreview'
import { Dialog, MenuItem, MenuSeparator, Popover, PopoverContent, PopoverTrigger } from '../overlays'
import { Btn, Card, CardHeader, EmptyBlock, S_FOCUS, btnClass, fmtAgo } from '../ui'

export interface AiCapabilities { generate: boolean; managePrompts: boolean; brandVoice: boolean; compose: boolean }
export interface BrandOption { id: string; name: string; logo: string | null }
export interface HistoryItem { id: string; batchId: string | null; topic: string; prompt: string; channel: string | null; tone: string | null; objective: string | null; audience: string | null; created_at: string }

const VARIABLES = [
  { key: 'brand', label: 'Brand name' }, { key: 'product', label: 'Product' }, { key: 'audience', label: 'Audience' },
  { key: 'offer', label: 'Offer' }, { key: 'date', label: 'Date' }, { key: 'link', label: 'Link' },
]

const titleCase = (v: string) => v.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())

interface Settings {
  model: StudioAiModel; channel: string; tone: string; objective: string; audience: string; length: string; format: string
  language: string; count: number; creativity: number; diversity: number; includeHashtags: boolean; includeEmojis: boolean
  useBrandVoice: boolean; includeCta: boolean; avoidJargon: boolean; brandId: string | null
}

const STORAGE_KEY = 'cf.studio.ai.settings'

export default function AiGenerateWorkspace({
  base, initialOutputs, initialPrompt, history, prompts, brands, accounts, credits, capabilities, now, kpis, recentOutputs,
}: {
  base: string
  initialOutputs: AiOutputRow[]
  initialPrompt: string
  history: HistoryItem[]
  prompts: PromptRow[]
  brands: BrandOption[]
  accounts: Record<string, PreviewAccountLite>
  credits: { used: number; limit: number; resetsOn: string }
  capabilities: AiCapabilities
  now: number
  kpis: React.ReactNode
  recentOutputs: React.ReactNode
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, start] = useTransition()
  const first = initialOutputs[0]

  const defaults: Settings = {
    model: (STUDIO_AI_MODELS.some(m => m.id === first?.model) ? first!.model : 'gpt-5.4-mini') as StudioAiModel,
    channel: first?.channel && (STUDIO_CHANNELS as readonly string[]).includes(first.channel) ? first.channel : 'linkedin',
    tone: first?.tone && (AI_TONES as readonly string[]).includes(first.tone) ? first.tone : 'professional',
    objective: first?.objective && (AI_OBJECTIVES as readonly string[]).includes(first.objective) ? first.objective : 'product_launch',
    audience: first?.audience && (AUDIENCES as readonly string[]).includes(first.audience as never) ? first.audience : 'Marketing leaders',
    length: 'medium', format: 'paragraph', language: 'en-GB', count: 3, creativity: 0.75, diversity: 0.6,
    includeHashtags: true, includeEmojis: true, useBrandVoice: true, includeCta: true, avoidJargon: false,
    brandId: brands[0]?.id ?? null,
  }
  const [settings, setSettings] = useState<Settings>(defaults)
  const [remember, setRemember] = useState(false)
  const [prompt, setPrompt] = useState(initialPrompt)
  const [outputs, setOutputs] = useState<AiOutputRow[]>(initialOutputs)
  const [focusId, setFocusId] = useState<string | null>(initialOutputs[0]?.id ?? null)
  const [checked, setChecked] = useState<string[]>([])
  const [tab, setTab] = useState<'detail' | 'edit'>('detail')
  const [draft, setDraft] = useState('')
  const [generating, setGenerating] = useState<null | 'generate' | 'regenerate' | 'variations' | 'enhance'>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [briefOpen, setBriefOpen] = useState(false)
  const [brief, setBrief] = useState({ goal: '', messages: '', avoid: '' })
  const [promptsOpen, setPromptsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [promptName, setPromptName] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const lastRequest = useRef<Record<string, unknown> | null>(null)
  const [hasRun, setHasRun] = useState(false)
  const promptRef = useRef<HTMLTextAreaElement>(null)

  // Settings are a per-device convenience, restored only when the user opted in.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as Partial<Settings>
      queueMicrotask(() => { setSettings(s => ({ ...s, ...saved })); setRemember(true) })
    } catch { /* storage unavailable */ }
  }, [])
  useEffect(() => {
    try {
      if (remember) localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      else localStorage.removeItem(STORAGE_KEY)
    } catch { /* storage unavailable */ }
  }, [remember, settings])

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings(s => ({ ...s, [key]: value }))
  const focused = outputs.find(o => o.id === focusId) ?? outputs[0] ?? null
  const text = focused?.output ?? ''
  const stats = useMemo(() => ({
    words: countWords(text), chars: countCharacters(text), hashtags: extractHashtags(text).length, emojis: countEmojis(text),
  }), [text])
  const postReady = focused
    ? stats.chars <= captionLimitFor([focused.channel ?? settings.channel]) && scoreContent({ caption: text, platforms: [focused.channel ?? settings.channel], hashtags: extractHashtags(text), ctaLabel: /https?:\/\//.test(text) ? 'link' : null, assetCount: 1 }).score >= 67
    : false
  const moreCount = [settings.includeCta, settings.avoidJargon].filter(Boolean).length
  const creditsLeft = credits.limit < 0 ? Infinity : Math.max(0, credits.limit - credits.used)

  async function call(kind: 'generate' | 'regenerate' | 'variations') {
    if (!capabilities.generate) return
    setError(null)
    setFieldErrors({})
    let body: Record<string, unknown>
    if (kind === 'regenerate') {
      if (!hasRun && !prompt.trim()) { setFieldErrors({ prompt: 'Write a prompt first.' }); return }
      body = lastRequest.current ?? { mode: 'generate', prompt, ...settings }
    } else if (kind === 'variations') {
      if (!focused) { setError('Generate or select an output first, then create variations of it.'); return }
      body = { mode: 'generate', ...settings, prompt: `Create variations of this post:\n${focused.output}`.slice(0, 3000), variation: true }
    } else {
      if (!prompt.trim()) { setFieldErrors({ prompt: 'Describe what you want to create.' }); promptRef.current?.focus(); return }
      body = { mode: 'generate', prompt, ...settings }
    }
    if (settings.count > creditsLeft) { setError(`Only ${creditsLeft} AI credits left this month. Reduce the number of results or upgrade.`); return }
    setGenerating(kind)
    try {
      const res = await fetch('/api/studio/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json().catch(() => ({})) as { outputs?: AiOutputRow[]; error?: string; fieldErrors?: Record<string, string> }
      if (!res.ok || !json.outputs?.length) {
        setFieldErrors(json.fieldErrors ?? {})
        setError(json.error ?? 'Generation failed. Nothing was charged.')
        return
      }
      if (kind === 'generate') { lastRequest.current = body; setHasRun(true) }
      const rows = json.outputs.map(o => ({
        ...o, type: 'custom', prompt: String(body.prompt), topic: String(body.prompt).slice(0, 80), channel: String(body.channel),
        platform: String(body.channel), tone: String(body.tone), objective: String(body.objective), audience: String(body.audience),
        match_score: null, bookmarked: false, used_content_id: null, prompt_tokens: null, completion_tokens: null,
      })) as AiOutputRow[]
      setOutputs(rows)
      setFocusId(rows[0]!.id)
      setChecked([])
      setTab('detail')
      notify('success', `${rows.length} output${rows.length === 1 ? '' : 's'} generated.`)
      router.refresh()
    } catch {
      setError('We could not reach the AI service. Check your connection and try again.')
    } finally {
      setGenerating(null)
    }
  }

  async function enhance() {
    if (!prompt.trim()) { setFieldErrors({ prompt: 'Write a rough prompt first, then enhance it.' }); return }
    setGenerating('enhance')
    setError(null)
    try {
      const res = await fetch('/api/studio/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'assist', action: 'enhance_prompt', text: prompt, channel: settings.channel }) })
      const json = await res.json().catch(() => ({})) as { outputs?: { output: string }[]; error?: string }
      if (!res.ok || !json.outputs?.[0]) { setError(json.error ?? 'Could not enhance the prompt.'); return }
      setPrompt(json.outputs[0].output.slice(0, 3000))
      notify('success', 'Prompt enhanced. Review it before generating.')
    } finally {
      setGenerating(null)
    }
  }

  function insertVariable(key: string) {
    const el = promptRef.current
    const token = `{{${key}}}`
    const startAt = el?.selectionStart ?? prompt.length
    const endAt = el?.selectionEnd ?? prompt.length
    const next = (prompt.slice(0, startAt) + token + prompt.slice(endAt)).slice(0, 3000)
    setPrompt(next)
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(startAt + token.length, startAt + token.length) })
  }

  function applyBrief() {
    const parts = [
      brief.goal.trim() && `Goal: ${brief.goal.trim()}`,
      brief.messages.trim() && `Key messages: ${brief.messages.trim()}`,
      brief.avoid.trim() && `Avoid: ${brief.avoid.trim()}`,
    ].filter(Boolean)
    if (!parts.length) { setBriefOpen(false); return }
    setPrompt(p => `${p.trimEnd()}${p.trim() ? '\n\n' : ''}${parts.join('\n')}`.slice(0, 3000))
    setBrief({ goal: '', messages: '', avoid: '' })
    setBriefOpen(false)
  }

  function loadPrompt(item: { prompt: string; channel: string | null; tone: string | null; objective: string | null; audience: string | null }) {
    setPrompt(item.prompt.slice(0, 3000))
    setSettings(s => ({
      ...s,
      channel: item.channel && (STUDIO_CHANNELS as readonly string[]).includes(item.channel) ? item.channel : s.channel,
      tone: item.tone && (AI_TONES as readonly string[]).includes(item.tone) ? item.tone : s.tone,
      objective: item.objective && (AI_OBJECTIVES as readonly string[]).includes(item.objective) ? item.objective : s.objective,
      audience: item.audience && (AUDIENCES as readonly string[]).includes(item.audience as never) ? item.audience : s.audience,
    }))
    setPromptsOpen(false)
    setHistoryOpen(false)
    promptRef.current?.focus()
  }

  const updateOutput = (patch: Partial<AiOutputRow>, ids: string[]) =>
    setOutputs(list => list.map(o => (ids.includes(o.id) ? { ...o, ...patch } : o)))

  const toggleBookmark = (row: AiOutputRow) => start(async () => {
    updateOutput({ bookmarked: !row.bookmarked }, [row.id])
    const result = await setAiOutputState({ id: row.id, bookmarked: !row.bookmarked })
    if (!result.ok) { updateOutput({ bookmarked: row.bookmarked }, [row.id]); notify('error', result.error ?? 'Could not save.'); return }
    notify('success', row.bookmarked ? 'Removed from saved outputs.' : 'Saved to your outputs.')
    router.refresh()
  })

  const bulk = (action: 'save' | 'discard') => start(async () => {
    const ids = checked.length ? checked : focused ? [focused.id] : []
    for (const id of ids) {
      const result = await setAiOutputState(action === 'save' ? { id, bookmarked: true } : { id, status: 'discarded' })
      if (!result.ok) { notify('error', result.error ?? 'Could not update.'); return }
    }
    if (action === 'discard') { setOutputs(list => list.filter(o => !ids.includes(o.id))); setChecked([]) }
    else updateOutput({ bookmarked: true }, ids)
    notify('success', `${ids.length} output${ids.length === 1 ? '' : 's'} ${action === 'save' ? 'saved' : 'discarded'}.`)
    router.refresh()
  })

  const useInCompose = () => start(async () => {
    if (!focused) return
    const result = await moveOutputToCompose({ id: focused.id })
    if (!result.ok || !result.id) { notify('error', result.error ?? 'Could not create a draft.'); return }
    notify('success', result.message ?? 'Draft created.')
    router.push(`${base}/compose?id=${result.id}`)
  })

  const saveEdit = () => start(async () => {
    if (!focused) return
    const result = await setAiOutputState({ id: focused.id, output: draft })
    if (!result.ok) { notify('error', result.error ?? 'Could not save.'); return }
    updateOutput({ output: draft.trim(), word_count: countWords(draft) }, [focused.id])
    setTab('detail')
    notify('success', 'Output updated.')
  })

  const persistPrompt = () => start(async () => {
    const result = await savePrompt({ name: promptName.trim(), prompt, channel: settings.channel, tone: settings.tone, objective: settings.objective, audience: settings.audience })
    if (!result.ok) { notify('error', result.error ?? 'Could not save the prompt.'); return }
    setSaveOpen(false)
    setPromptName('')
    notify('success', 'Prompt saved.')
    router.refresh()
  })

  const removePrompt = (id: string) => start(async () => {
    if (!confirm('Remove this saved prompt? It stays in the audit history.')) return
    const result = await deletePrompt({ id })
    notify(result.ok ? 'success' : 'error', result.ok ? 'Prompt removed.' : result.error ?? 'Could not remove.')
    if (result.ok) router.refresh()
  })

  const lbl = 'mb-1 block text-[12px] text-slate-500 lg:mb-[4px] lg:text-[9px]'
  const sel = 'h-10 w-full appearance-none rounded-[6px] border border-[#e3e7ee] bg-white pl-2.5 pr-7 text-[13px] text-slate-800 outline-none focus:border-[#9db8ff] disabled:bg-slate-50 lg:h-[33px] lg:pl-[12px] lg:text-[10.5px]'
  const selectBox = (key: keyof Settings, label: string, options: { value: string; label: string }[], icon?: React.ReactNode) => (
    <label className="block min-w-0">
      <span className={lbl}>{label}</span>
      <span className="relative block">
        {icon && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 lg:left-[11px]" aria-hidden>{icon}</span>}
        <select value={String(settings[key] ?? '')} disabled={!capabilities.generate}
          onChange={e => set(key, (key === 'brandId' ? (e.target.value || null) : e.target.value) as never)}
          aria-invalid={Boolean(fieldErrors[key]) || undefined}
          className={cn(sel, icon && 'pl-8 lg:pl-[32px]', fieldErrors[key] && 'border-red-300')}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
      </span>
      {fieldErrors[key] && <span className="mt-1 block text-[11px] text-red-600">{fieldErrors[key]}</span>}
    </label>
  )

  const toggle = (key: 'includeHashtags' | 'includeEmojis' | 'useBrandVoice', label: string, disabled = false) => (
    <div className="flex items-center justify-between text-[13px] text-slate-700 lg:text-[10px]">
      <span id={`ai-${key}`}>{label}</span>
      <button type="button" role="switch" aria-checked={settings[key]} aria-labelledby={`ai-${key}`} disabled={disabled || !capabilities.generate}
        onClick={() => set(key, !settings[key])}
        className={cn('relative h-5 w-9 rounded-full transition-colors disabled:opacity-50 lg:h-[16px] lg:w-[28px]', settings[key] ? 'bg-[#1a5cff]' : 'bg-slate-300', S_FOCUS)}>
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all lg:h-[12px] lg:w-[12px]', settings[key] ? 'left-[18px] lg:left-[14px]' : 'left-0.5')} />
      </button>
    </div>
  )

  const slider = (key: 'creativity' | 'diversity', label: string, help: string) => (
    <div>
      <div className="flex items-center text-[13px] text-slate-600 lg:text-[10px]">
        <label htmlFor={`ai-${key}`}>{label}</label>
        <span title={help} className="ml-1.5"><Info size={11} className="text-slate-400" aria-hidden /></span>
        <span className="ml-auto tabular-nums text-slate-700">{settings[key].toFixed(2)}</span>
      </div>
      <input id={`ai-${key}`} type="range" min={0} max={1} step={0.05} value={settings[key]} disabled={!capabilities.generate}
        onChange={e => set(key, Number(e.target.value))} aria-describedby={`ai-${key}-help`}
        className="mt-2 w-full accent-[#1a5cff] lg:mt-[2px] lg:h-[14px]" />
      <span id={`ai-${key}-help`} className="sr-only">{help}</span>
    </div>
  )

  return (
    <div className="grid grid-cols-1 gap-3 lg:gap-[13px] xl:grid-cols-[minmax(0,1fr)_259px]">
      <div className="min-w-0">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-slate-900 lg:text-[19px]">AI Generate</h1>
        <p className="mt-0.5 text-[13px] text-slate-500 lg:text-[10.5px]">Create high-quality, on-brand content in seconds with the power of AI.</p>
        {kpis}

        {/* ── Prompt ──────────────────────────────────────────────────── */}
        <div className="mt-4 flex items-center gap-2 lg:mt-[18px]">
          <label htmlFor="ai-prompt" className="text-[14px] font-semibold text-slate-900 lg:text-[11px]">Your prompt</label>
          <Popover>
            <PopoverTrigger label="Prompt tips" className={cn('inline-flex h-6 items-center gap-1 rounded-full bg-[#f1f4fb] px-2 text-[11px] text-[#4b6bd6] lg:h-[17px] lg:text-[8.5px]', S_FOCUS)}>
              <Lightbulb size={10} /> Tips
            </PopoverTrigger>
            <PopoverContent label="Prompt tips" width={290} className="p-3 text-[12px] text-slate-600">
              <ul className="list-disc space-y-1 pl-4">
                <li>Say who it is for and the one action you want them to take.</li>
                <li>List the facts to include. The AI will not invent claims.</li>
                <li>Use variables such as <code>{'{{product}}'}</code> for reusable prompts.</li>
                <li>Use Enhance prompt to turn a rough idea into a clear brief.</li>
              </ul>
            </PopoverContent>
          </Popover>
        </div>
        <div className={cn('mt-2 rounded-[8px] border-[1.5px] bg-white lg:mt-[7px]', fieldErrors.prompt ? 'border-red-400' : 'border-[#1a5cff]/80')}>
          <textarea id="ai-prompt" ref={promptRef} value={prompt} maxLength={3000} disabled={!capabilities.generate}
            onChange={e => { setPrompt(e.target.value); if (fieldErrors.prompt) setFieldErrors(f => ({ ...f, prompt: '' })) }}
            onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void call('generate') } }}
            placeholder="Describe the post you want: audience, key benefits, call to action and tone."
            aria-invalid={Boolean(fieldErrors.prompt) || undefined} aria-describedby="ai-prompt-count"
            className="block min-h-[110px] w-full resize-none rounded-t-[8px] bg-transparent px-3 pt-3 text-[14px] leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 lg:h-[66px] lg:min-h-0 lg:px-[11px] lg:pt-[12px] lg:text-[11px] lg:leading-[18px]" />
          <div className="flex flex-wrap items-center gap-2 px-2.5 pb-2.5 lg:gap-[8px] lg:px-[11px] lg:pb-[9px]">
            <button type="button" onClick={() => void enhance()} disabled={!capabilities.generate || generating !== null}
              className={btnClass('secondary', 'sm', 'text-[#3d63d8] lg:h-[27px] lg:px-[11px] lg:text-[9.5px]')}>
              {generating === 'enhance' ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Enhance prompt
            </button>
            <Popover>
              <PopoverTrigger haspopup="menu" label="Insert variable" disabled={!capabilities.generate}
                className={btnClass('secondary', 'sm', 'text-[#3d63d8] lg:h-[27px] lg:px-[11px] lg:text-[9.5px]')}>
                <Braces size={12} /> Insert variable
              </PopoverTrigger>
              <PopoverContent role="menu" label="Variables" width={200}>
                {close => VARIABLES.map(v => (
                  <MenuItem key={v.key} close={close} onSelect={() => insertVariable(v.key)}>
                    <span className="font-mono text-[11px] text-[#3d63d8]">{`{{${v.key}}}`}</span> <span className="text-slate-500">{v.label}</span>
                  </MenuItem>
                ))}
              </PopoverContent>
            </Popover>
            <button type="button" onClick={() => setBriefOpen(true)} disabled={!capabilities.generate}
              className={btnClass('secondary', 'sm', 'text-[#3d63d8] lg:h-[27px] lg:px-[11px] lg:text-[9.5px]')}>
              <FileText size={12} /> Add brief
            </button>
            <div className="ml-auto flex items-center gap-3 lg:gap-[20px]">
              {capabilities.managePrompts && prompt.trim() && (
                <button type="button" onClick={() => setSaveOpen(true)} className={cn('inline-flex items-center gap-1 text-[12px] font-medium text-slate-500 hover:text-slate-800 lg:text-[9.5px]', S_FOCUS)}>
                  <Save size={11} /> Save prompt
                </button>
              )}
              <button type="button" onClick={() => { setPrompt(''); promptRef.current?.focus() }} disabled={!prompt}
                className={cn('text-[12px] font-medium text-[#1a5cff] hover:underline disabled:text-slate-300 lg:text-[9.5px]', S_FOCUS)}>Clear</button>
              <span id="ai-prompt-count" className="text-[12px] tabular-nums text-slate-500 lg:text-[9.5px]">{prompt.length} / 3000</span>
            </div>
          </div>
        </div>
        {fieldErrors.prompt && <p className="mt-1 text-[12px] text-red-600">{fieldErrors.prompt}</p>}

        {/* ── Options ─────────────────────────────────────────────────── */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:mt-[16px] lg:grid-cols-5 lg:gap-x-[17px] lg:gap-y-[18px]">
          {selectBox('model', 'Model', STUDIO_AI_MODELS.map(m => ({ value: m.id, label: m.label })))}
          <label className="block min-w-0">
            <span className={lbl}>Channel</span>
            <span className="relative block">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 lg:left-[11px]" aria-hidden><ChannelIcon channel={settings.channel} size={14} /></span>
              <select value={settings.channel} onChange={e => set('channel', e.target.value)} disabled={!capabilities.generate} className={cn(sel, 'pl-8 lg:pl-[32px]')}>
                {STUDIO_CHANNELS.map(c => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
            </span>
          </label>
          {selectBox('tone', 'Tone', AI_TONES.map(t => ({ value: t, label: titleCase(t) })))}
          {selectBox('objective', 'Objective', AI_OBJECTIVES.map(o => ({ value: o, label: titleCase(o) })))}
          {selectBox('audience', 'Audience', AUDIENCES.map(a => ({ value: a, label: a })))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:mt-[18px] lg:grid-cols-[208fr_220fr_220fr_283fr] lg:gap-x-[17px]">
          {selectBox('length', 'Length', AI_LENGTHS.map(l => ({ value: l, label: titleCase(l) })), <AlignLeft size={13} />)}
          {selectBox('format', 'Format', AI_FORMATS.map(f => ({ value: f, label: titleCase(f) })), <PenLine size={13} />)}
          {brands.length > 0
            ? selectBox('brandId', 'Brand Voice', [{ value: '', label: 'No brand voice' }, ...brands.map(b => ({ value: b.id, label: b.name }))],
              <img src={brands.find(b => b.id === settings.brandId)?.logo ?? '/caption fox favicon.png'} alt="" className="h-4 w-4 rounded-[4px] object-cover" />)
            : <div><span className={lbl}>Brand Voice</span><Link href="/app/settings/brands" className={cn(sel, 'flex items-center text-slate-500')}>Set up a brand voice</Link></div>}
          <div className="min-w-0">
            <span className={lbl}>More options</span>
            <Popover className="flex w-full">
              <PopoverTrigger label={`More options, ${moreCount} enabled`} disabled={!capabilities.generate} className={cn(sel, 'relative flex items-center text-left', S_FOCUS)}>
                {moreCount} setting{moreCount === 1 ? '' : 's'}
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
              </PopoverTrigger>
              <PopoverContent label="More options" width={250} align="end" className="space-y-2.5 p-3">
                {([['includeCta', 'End with a call to action'], ['avoidJargon', 'Plain language, no jargon']] as const).map(([key, label]) => (
                  <label key={key} className="flex cursor-pointer items-center justify-between gap-3 text-[13px] text-slate-700">
                    {label}
                    <input type="checkbox" checked={settings[key]} onChange={e => set(key, e.target.checked)} className="h-4 w-4 accent-[#1a5cff]" />
                  </label>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5 lg:mt-[15px] lg:gap-[12px]">
          <Btn variant="primary" size="lg" onClick={() => void call('generate')} disabled={!capabilities.generate || generating !== null}
            className="min-w-[160px] lg:h-[35px] lg:w-[169px] lg:text-[10.5px]" title={capabilities.generate ? 'Generate (Ctrl+Enter)' : 'Your role cannot generate AI content'}>
            {generating === 'generate' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {generating === 'generate' ? 'Generating…' : 'Generate'}
          </Btn>
          <Btn size="lg" onClick={() => void call('regenerate')} disabled={!capabilities.generate || generating !== null || (!hasRun && !prompt.trim())}
            className="border-[#b9ccff] text-[#1a5cff] lg:h-[35px] lg:w-[147px] lg:text-[10.5px]">
            {generating === 'regenerate' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Regenerate
          </Btn>
          <Btn size="lg" onClick={() => void call('variations')} disabled={!capabilities.generate || generating !== null || !focused}
            className="border-[#b9ccff] text-[#1a5cff] lg:h-[35px] lg:w-[152px] lg:text-[10.5px]">
            {generating === 'variations' ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />} Create variations
          </Btn>
          <span className="text-[12px] text-slate-500 lg:text-[9.5px]">Uses {settings.count} credit{settings.count === 1 ? '' : 's'}{Number.isFinite(creditsLeft) ? ` · ${creditsLeft.toLocaleString('en-GB')} left` : ''}</span>
        </div>
        {error && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
            <AlertTriangle size={14} className="mt-px shrink-0 text-red-500" /> {error}
          </p>
        )}

        {/* ── Outputs ─────────────────────────────────────────────────── */}
        <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-[12px] lg:grid-cols-[306fr_366fr_310fr] lg:gap-[12px]">
          <Card className="flex flex-col lg:h-[312px]" aria-labelledby="ai-outputs-title">
            <div className="flex h-12 items-center px-3.5 lg:h-[36px] lg:px-[14px]">
              <h2 id="ai-outputs-title" className="text-[14px] font-semibold text-slate-900 lg:text-[11px]">Generated Outputs <span className="font-normal text-slate-600">({outputs.length})</span></h2>
              {outputs.length > 1 && (
                <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[12px] text-slate-600 lg:text-[9px]">
                  <input type="checkbox" checked={checked.length === outputs.length} onChange={e => setChecked(e.target.checked ? outputs.map(o => o.id) : [])} className="h-3.5 w-3.5 accent-[#1a5cff] lg:h-[11px] lg:w-[11px]" />
                  Select all
                </label>
              )}
            </div>
            {outputs.length === 0 ? (
              <EmptyBlock title="No outputs yet" message="Write a prompt and press Generate. Results appear here for review." />
            ) : (
              <ul role="radiogroup" aria-label="Generated outputs" className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2.5 pb-2.5 lg:space-y-[9px] lg:px-[10px] lg:pb-[10px]">
                {outputs.map(o => {
                  const active = o.id === focused?.id
                  return (
                    <li key={o.id}>
                      <div className={cn('flex gap-2.5 rounded-[8px] border px-2.5 py-2.5 lg:gap-[12px] lg:px-[12px] lg:py-[10px]', active ? 'border-[#1a5cff] bg-[#f5f8ff] ring-1 ring-[#1a5cff]' : 'border-[#e6e9f0] hover:border-[#c9d8ff]')}>
                        <input type="checkbox" checked={checked.includes(o.id)} aria-label="Select output for bulk actions"
                          onChange={e => setChecked(list => (e.target.checked ? [...list, o.id] : list.filter(x => x !== o.id)))}
                          className="sr-only" />
                        <button type="button" role="radio" aria-checked={active} onClick={() => { setFocusId(o.id); setTab('detail') }} className={cn('flex min-w-0 flex-1 gap-2.5 text-left lg:gap-[12px]', S_FOCUS)}>
                          <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border lg:h-[15px] lg:w-[15px]', active || checked.includes(o.id) ? 'border-[#1a5cff] bg-[#1a5cff] text-white' : 'border-slate-300 bg-white')} aria-hidden>
                            {(active || checked.includes(o.id)) && <CheckCircle2 size={11} strokeWidth={3} />}
                          </span>
                          <span className="min-w-0">
                            <span className="line-clamp-3 text-[12px] leading-snug text-slate-700 lg:text-[9.5px] lg:leading-[15px]">{o.output}</span>
                            <span className="mt-1.5 block text-[11px] text-slate-500 lg:mt-[8px] lg:text-[8.5px]">{o.word_count ?? countWords(o.output ?? '')} words · {fmtAgo(o.created_at, now)}{o.bookmarked ? ' · Saved' : ''}</span>
                          </span>
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card className="flex flex-col lg:h-[312px]" aria-label="Output detail">
            <div className="flex h-12 items-center border-b border-[#eef0f4] px-3 lg:h-[36px] lg:px-[12px]">
              <div role="tablist" aria-label="Output view" className="flex self-stretch">
                {(['detail', 'edit'] as const).map(t => (
                  <button key={t} type="button" role="tab" aria-selected={tab === t} disabled={!focused}
                    onClick={() => { setTab(t); if (t === 'edit') setDraft(focused?.output ?? '') }}
                    className={cn('relative px-2 text-[12px] font-medium lg:px-[4px] lg:text-[9.5px] lg:first:mr-[14px]', S_FOCUS, tab === t ? 'text-[#1a5cff] after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-[#1a5cff]' : 'text-slate-600')}>
                    {t === 'detail' ? 'Output Detail' : 'Edit'}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-3 text-slate-500 lg:gap-[16px]">
                <button type="button" aria-label="Copy output" disabled={!focused} onClick={() => { void navigator.clipboard?.writeText(text); notify('success', 'Copied to clipboard.') }} className={cn('rounded p-1 hover:text-slate-800', S_FOCUS)}><Copy size={14} /></button>
                <button type="button" aria-label={focused?.bookmarked ? 'Remove from saved' : 'Save output'} aria-pressed={focused?.bookmarked} disabled={!focused} onClick={() => focused && toggleBookmark(focused)} className={cn('rounded p-1 hover:text-slate-800', S_FOCUS, focused?.bookmarked && 'text-[#1a5cff]')}>
                  {focused?.bookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                </button>
                <Popover>
                  <PopoverTrigger haspopup="menu" label="Output actions" disabled={!focused} className={cn('rounded p-1 hover:text-slate-800', S_FOCUS)}><MoreHorizontal size={15} /></PopoverTrigger>
                  <PopoverContent role="menu" label="Output actions" width={220} align="end">
                    {close => (<>
                      <MenuItem close={close} onSelect={useInCompose} disabled={!capabilities.compose} hint="Your role cannot create content">Use in Compose</MenuItem>
                      <MenuItem close={close} onSelect={() => bulk('save')}>{checked.length > 1 ? `Save selected (${checked.length})` : 'Save output'}</MenuItem>
                      <MenuSeparator />
                      <MenuItem close={close} danger onSelect={() => bulk('discard')}>{checked.length > 1 ? `Discard selected (${checked.length})` : 'Discard output'}</MenuItem>
                    </>)}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {!focused ? <EmptyBlock title="Nothing selected" message="Select an output to review, edit or save it." /> : tab === 'edit' ? (
              <div className="flex min-h-0 flex-1 flex-col p-3 lg:p-[12px]">
                <label htmlFor="ai-edit" className="sr-only">Edit output</label>
                <textarea id="ai-edit" value={draft} onChange={e => setDraft(e.target.value)} maxLength={20000}
                  className="min-h-[180px] w-full flex-1 resize-none rounded-[6px] border border-[#e3e7ee] p-2.5 text-[13px] leading-relaxed outline-none focus:border-[#9db8ff] lg:min-h-0 lg:text-[10.5px]" />
                <div className="mt-2 flex justify-end gap-2">
                  <Btn size="sm" onClick={() => setTab('detail')}>Cancel</Btn>
                  <Btn size="sm" variant="primary" onClick={saveEdit} disabled={pending || !draft.trim() || draft === focused.output}>Save changes</Btn>
                </div>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-line break-words px-3.5 py-3 text-[13px] leading-relaxed text-slate-800 lg:px-[14px] lg:py-[12px] lg:text-[10.5px] lg:leading-[17px]">
                  {text}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#eef0f4] px-3.5 py-2 text-[11px] text-slate-500 lg:h-[36px] lg:flex-nowrap lg:gap-x-[12px] lg:whitespace-nowrap lg:px-[12px] lg:py-0 lg:text-[8.5px]">
                  <span>{stats.words} words</span><span>{stats.chars} characters</span><span>{stats.hashtags} hashtags</span><span>{stats.emojis} emoji</span>
                  <span className={cn('ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium lg:px-[10px] lg:py-[3px]', postReady ? 'bg-[#e8f7ee] text-[#1c9b52]' : 'bg-[#fff4e0] text-[#b56d04]')}>
                    {postReady ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}{postReady ? 'Good to post' : 'Review before posting'}
                  </span>
                </div>
              </>
            )}
          </Card>

          <Card className="flex flex-col lg:h-[312px]" aria-label="Channel preview">
            <div className="flex h-12 items-center gap-2 px-3.5 lg:h-[36px] lg:px-[14px]">
              <ChannelIcon channel={focused?.channel ?? settings.channel} size={15} />
              <h2 className="text-[13px] font-semibold text-slate-900 lg:text-[10.5px]">{CHANNEL_LABELS[focused?.channel ?? settings.channel] ?? 'Channel'} Preview</h2>
              <Popover>
                <PopoverTrigger haspopup="menu" label="Preview actions" disabled={!focused} className={cn('ml-auto rounded p-1 text-slate-500 hover:text-slate-800', S_FOCUS)}><MoreHorizontal size={15} /></PopoverTrigger>
                <PopoverContent role="menu" label="Preview actions" width={200} align="end">
                  {close => (<>
                    <MenuItem close={close} onSelect={() => { void navigator.clipboard?.writeText(text); notify('success', 'Copied.') }}>Copy text</MenuItem>
                    <MenuItem close={close} onSelect={() => { setTab('edit'); setDraft(text) }}>Edit output</MenuItem>
                  </>)}
                </PopoverContent>
              </Popover>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2.5 lg:px-[10px]">
              {focused
                ? <SocialPreview channel={focused.channel ?? settings.channel} content={{ caption: text, mediaUrl: null, textOnly: true }}
                  account={accounts[focused.channel ?? settings.channel] ?? { name: 'Your account', handle: '@your_account', avatar_url: null, followers: null }} />
                : <p className="py-8 text-center text-[12px] text-slate-500">A live preview appears here.</p>}
            </div>
            <div className="p-2.5 lg:px-[10px] lg:pb-[10px] lg:pt-[8px]">
              <Btn size="md" onClick={useInCompose} disabled={!focused || !capabilities.compose || pending}
                className="w-full border-[#1a5cff] text-[#1a5cff] lg:h-[27px] lg:text-[9.5px]">
                Use in Compose <ChevronRight size={12} />
              </Btn>
            </div>
          </Card>
        </div>

        {recentOutputs}
      </div>

      {/* ── Right rail ────────────────────────────────────────────────── */}
      <aside className="flex min-w-0 flex-col gap-3 lg:gap-[16px]" aria-label="Generation settings and history">
        <Card className="px-3.5 pb-3.5 pt-3 lg:px-[14px] lg:pb-[16px] lg:pt-[12px]" aria-labelledby="ai-settings-title">
          <CardHeader id="ai-settings-title" titleClassName="lg:text-[11px] flex items-center gap-1.5"
            title={<>Generation Settings <span title="These settings apply to every Generate, Regenerate and Create variations request."><Info size={11} className="text-slate-400" aria-hidden /></span></>}
            action={<button type="button" onClick={() => { setSettings(defaults); notify('success', 'Settings reset.') }} className={cn('text-[12px] font-medium text-[#1a5cff] hover:underline lg:text-[9.5px]', S_FOCUS)}>Reset all</button>} />
          <div className="mt-3 space-y-4 lg:mt-[14px] lg:space-y-[13px]">
            {slider('creativity', 'Creativity', 'Higher values give bolder, less literal copy.')}
            {slider('diversity', 'Diversity', 'Higher values make each result more different from the others.')}
            <div>
              <div className="flex items-center text-[13px] text-slate-600 lg:text-[10px]" id="ai-count-label">Number of results
                <span title="Each result uses one AI credit." className="ml-1.5"><Info size={11} className="text-slate-400" aria-hidden /></span>
              </div>
              <div role="radiogroup" aria-labelledby="ai-count-label" className="mt-2 grid grid-cols-4 gap-2 lg:mt-[7px] lg:gap-[8px]">
                {[1, 2, 3, 4].map(n => (
                  <button key={n} type="button" role="radio" aria-checked={settings.count === n} onClick={() => set('count', n)} disabled={!capabilities.generate}
                    className={cn('h-9 rounded-[5px] border text-[13px] font-medium lg:h-[23px] lg:text-[10px]', S_FOCUS, settings.count === n ? 'border-[#1a5cff] bg-[#1a5cff] text-white' : 'border-[#e3e7ee] bg-white text-slate-700 hover:bg-slate-50')}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="text-[13px] text-slate-600 lg:text-[10px]">Language</span>
              <span className="relative mt-2 block lg:mt-[5px]">
                <select value={settings.language} onChange={e => set('language', e.target.value)} disabled={!capabilities.generate} className={cn(sel, 'lg:h-[24px] lg:pl-[10px] lg:text-[9.5px]')}>
                  {AI_LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
              </span>
            </label>
            <div className="space-y-3 lg:space-y-[9px]">
              {toggle('includeHashtags', 'Include hashtags')}
              {toggle('includeEmojis', 'Include emojis')}
              {toggle('useBrandVoice', 'Use brand voice', !capabilities.brandVoice)}
            </div>
            <div>
              <button type="button" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen(v => !v)}
                className={cn('inline-flex items-center gap-1.5 text-[12px] font-medium text-[#1a5cff] hover:underline lg:text-[9.5px]', S_FOCUS)}>
                Advanced settings <ChevronRight size={11} className={cn('transition-transform', advancedOpen && 'rotate-90')} />
              </button>
              {advancedOpen && (
                <div className="mt-2 space-y-2 rounded-lg bg-[#f7f9fc] p-2.5 text-[12px] text-slate-600 lg:text-[9.5px]">
                  <label className="flex cursor-pointer items-center justify-between gap-2">
                    Remember settings on this device
                    <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="h-3.5 w-3.5 accent-[#1a5cff]" />
                  </label>
                  <p className="text-slate-500">Output length is capped per request to control credit usage.</p>
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card className="px-3.5 pb-3 pt-3 lg:px-[14px] lg:pb-[12px] lg:pt-[14px]" aria-labelledby="ai-history-title">
          <CardHeader id="ai-history-title" title="Prompt History" titleClassName="lg:text-[11px]"
            action={history.length > 5 ? <button type="button" onClick={() => setHistoryOpen(true)} className={cn('text-[12px] font-medium text-[#1a5cff] hover:underline lg:text-[9.5px]', S_FOCUS)}>View all</button> : undefined} />
          {history.length === 0 ? <p className="py-3 text-[12px] text-slate-500 lg:text-[9.5px]">Prompts you run appear here.</p> : (
            <ul className="mt-2 space-y-1 lg:mt-[10px] lg:space-y-[5px]">
              {history.slice(0, 5).map(h => (
                <li key={h.id}>
                  <button type="button" onClick={() => loadPrompt(h)} className={cn('flex w-full items-center gap-2 rounded-md py-1 text-left hover:bg-slate-50 lg:gap-[8px] lg:py-[3px]', S_FOCUS)} title="Load this prompt">
                    <Clock size={12} className="shrink-0 text-slate-500" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-slate-700 lg:text-[9px]">{h.topic}</span>
                    <span className="shrink-0 text-[11px] text-slate-500 lg:text-[8.5px]">{fmtAgo(h.created_at, now)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="px-3.5 pb-3 pt-3 lg:px-[14px] lg:pb-[12px] lg:pt-[14px]" aria-labelledby="ai-saved-title">
          <CardHeader id="ai-saved-title" title="Saved Prompts" titleClassName="lg:text-[11px]"
            action={prompts.length > 0 ? <button type="button" onClick={() => setPromptsOpen(true)} className={cn('text-[12px] font-medium text-[#1a5cff] hover:underline lg:text-[9.5px]', S_FOCUS)}>View all</button> : undefined} />
          {prompts.length === 0 ? <p className="py-3 text-[12px] text-slate-500 lg:text-[9.5px]">Save a prompt to reuse it with your team.</p> : (
            <ul className="mt-2 space-y-1 lg:mt-[9px] lg:space-y-[4px]">
              {prompts.slice(0, 5).map(p => (
                <li key={p.id}>
                  <button type="button" onClick={() => loadPrompt(p)} className={cn('flex w-full items-center gap-2 rounded-md py-1 text-left hover:bg-slate-50 lg:gap-[8px] lg:py-[3px]', S_FOCUS)} title="Load this prompt">
                    <Folder size={12} className="shrink-0 text-slate-500" aria-hidden />
                    <span className="truncate text-[12px] text-slate-700 lg:text-[9px]">{p.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="px-3.5 pb-3.5 pt-3 lg:px-[14px] lg:pb-[12px] lg:pt-[14px]" aria-labelledby="ai-credits-title">
          <CardHeader id="ai-credits-title" title="Credits & Usage" titleClassName="lg:text-[11px]"
            action={<Link href="/app/settings/billing" className="text-[12px] font-medium text-[#1a5cff] hover:underline lg:text-[9.5px]">View plans</Link>} />
          {credits.limit < 0 ? (
            <p className="mt-3 text-[13px] text-slate-700 lg:text-[10px]">{credits.used.toLocaleString('en-GB')} credits used this month. Your plan has no monthly limit.</p>
          ) : (
            <>
              <p className="mt-3 text-[13px] text-slate-700 lg:mt-[14px] lg:text-[10px]">
                <span className="font-semibold text-slate-900">{credits.used.toLocaleString('en-GB')}</span> / {credits.limit.toLocaleString('en-GB')} credits used
              </p>
              <div className="mt-1 flex items-center text-[12px] text-slate-500 lg:text-[9px]">
                <span>Resets on {credits.resetsOn}</span>
                <span className="ml-auto">{Math.min(100, Math.round((credits.used / Math.max(1, credits.limit)) * 100))}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e8edf7] lg:mt-[7px]" role="progressbar" aria-valuemin={0} aria-valuemax={credits.limit} aria-valuenow={credits.used} aria-label="AI credits used">
                <div className={cn('h-full rounded-full', credits.used / Math.max(1, credits.limit) > 0.9 ? 'bg-red-500' : 'bg-[#1a5cff]')} style={{ width: `${Math.min(100, (credits.used / Math.max(1, credits.limit)) * 100)}%` }} />
              </div>
              <div className="mt-4 rounded-[8px] border border-[#cfdcff] bg-[#f5f8ff] p-3 lg:mt-[26px] lg:p-[12px]">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-[#1a5cff] lg:text-[10px]"><Zap size={13} /> Need more credits?</p>
                <p className="mt-0.5 pl-5 text-[12px] text-slate-600 lg:text-[9px]">Upgrade your plan for higher limits.</p>
                <Link href="/app/settings/billing" className={btnClass('secondary', 'sm', 'mt-2.5 w-full border-[#1a5cff] text-[#1a5cff] lg:mt-[10px] lg:h-[26px]')}>Upgrade Plan</Link>
              </div>
            </>
          )}
        </Card>
      </aside>

      <Dialog open={briefOpen} onClose={() => setBriefOpen(false)} title="Add a brief" size="md"
        description="Structured details are appended to your prompt so the AI stays on message."
        footer={<><Btn size="md" onClick={() => setBriefOpen(false)}>Cancel</Btn><Btn size="md" variant="primary" onClick={applyBrief}>Add to prompt</Btn></>}>
        <div className="space-y-3">
          {([['goal', 'Goal', 'e.g. Drive free trial sign-ups from marketing leads'], ['messages', 'Key messages', 'e.g. Saves time, stays on brand, built for teams'], ['avoid', 'Avoid', 'e.g. Pricing claims, competitor names']] as const).map(([key, label, ph]) => (
            <label key={key} className="block text-[13px] font-medium text-slate-700">
              {label}
              <textarea value={brief[key]} onChange={e => setBrief(b => ({ ...b, [key]: e.target.value.slice(0, 600) }))} placeholder={ph} rows={2}
                className="mt-1 block w-full resize-none rounded-lg border border-[#dfe3ea] px-2.5 py-2 text-[13px] font-normal outline-none focus:border-blue-400" />
            </label>
          ))}
        </div>
      </Dialog>

      <Dialog open={saveOpen} onClose={() => setSaveOpen(false)} title="Save prompt" size="sm" description="Saved prompts are shared with your workspace."
        footer={<><Btn size="md" onClick={() => setSaveOpen(false)}>Cancel</Btn><Btn size="md" variant="primary" onClick={persistPrompt} disabled={pending || !promptName.trim()}>Save</Btn></>}>
        <label className="block text-[13px] font-medium text-slate-700">Name
          <input data-autofocus value={promptName} onChange={e => setPromptName(e.target.value)} maxLength={120} placeholder="e.g. Product launch announcement"
            className="mt-1 block h-9 w-full rounded-lg border border-[#dfe3ea] px-2.5 text-[13px] font-normal outline-none focus:border-blue-400" />
        </label>
      </Dialog>

      <Dialog open={promptsOpen} onClose={() => setPromptsOpen(false)} title="Saved prompts" size="lg">
        <ul className="space-y-2">
          {prompts.map(p => (
            <li key={p.id} className="rounded-lg border border-[#eceff4] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-slate-800">{p.name}</span>
                <span className="text-[12px] text-slate-500">Used {p.usage_count} times</span>
                <div className="ml-auto flex gap-1.5">
                  <Btn size="xs" onClick={() => loadPrompt(p)}>Use</Btn>
                  {capabilities.managePrompts && <Btn size="xs" variant="danger" onClick={() => removePrompt(p.id)}>Remove</Btn>}
                </div>
              </div>
              <p className="mt-1 line-clamp-2 text-[12px] text-slate-600">{p.prompt}</p>
            </li>
          ))}
        </ul>
      </Dialog>

      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} title="Prompt history" size="lg">
        <ul className="divide-y divide-[#eef0f4]">
          {history.map(h => (
            <li key={h.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-slate-800">{h.topic}</span>
                <span className="block text-[12px] text-slate-500">{CHANNEL_LABELS[h.channel ?? ''] ?? '—'} · {fmtAgo(h.created_at, now)}</span>
              </span>
              <Btn size="xs" onClick={() => loadPrompt(h)}>Use</Btn>
              {h.batchId && <Link href={`${base}/ai-generate?batch=${h.batchId}`} className={btnClass('ghost', 'xs')}>Outputs</Link>}
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  )
}
