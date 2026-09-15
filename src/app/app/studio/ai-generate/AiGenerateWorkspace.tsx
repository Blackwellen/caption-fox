'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Bookmark, Copy, Sparkles, Wand2 } from 'lucide-react'
import { Panel, formatShortDate } from '@/components/studio/primitives'
import { StudioEmpty } from '@/components/studio/states'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/campaigns/Toast'
import {
  AI_FORMATS, AI_LENGTHS, AI_OBJECTIVES, AI_RESULT_COUNTS, AI_TONES,
  AI_MAX_PROMPT, AI_STATUS_BADGE, AI_STATUS_LABELS, CHANNEL_LABELS, STUDIO_CHANNELS,
} from '@/lib/studio/constants'
import type { AiOutputRow, PromptRow } from '@/lib/studio/types'
import type { StudioCapabilities } from '@/lib/studio/entitlements'
import { deletePrompt, savePrompt, setAiOutputState, useAiOutput as moveOutputToStudio } from './actions'

export default function AiGenerateWorkspace({
  workspaceId, capabilities, outputs, prompts, credits,
}: {
  workspaceId: string
  capabilities: StudioCapabilities
  outputs: AiOutputRow[]
  prompts: PromptRow[]
  credits: { used: number; limit: number }
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()

  const [prompt, setPrompt] = useState('')
  const [channel, setChannel] = useState<string>(STUDIO_CHANNELS[1])
  const [tone, setTone] = useState<string>(AI_TONES[0])
  const [objective, setObjective] = useState<string>(AI_OBJECTIVES[0])
  const [audience, setAudience] = useState('')
  const [length, setLength] = useState<string>(AI_LENGTHS[1])
  const [format, setFormat] = useState<string>(AI_FORMATS[0])
  const [count, setCount] = useState<number>(3)
  const [generated, setGenerated] = useState<AiOutputRow[]>(outputs.slice(0, count))
  const [selectedId, setSelectedId] = useState<string | null>(outputs[0]?.id ?? null)

  const remaining = credits.limit < 0 ? null : Math.max(0, credits.limit - credits.used)
  const outOfCredits = remaining !== null && remaining <= 0

  const selected = useMemo(
    () => generated.find(o => o.id === selectedId) ?? outputs.find(o => o.id === selectedId) ?? null,
    [generated, outputs, selectedId],
  )

  function generate() {
    if (!capabilities.generateAi) { notify('error', 'Your role does not include AI generation.'); return }
    if (!prompt.trim()) { notify('error', 'Write a prompt first.'); return }
    if (outOfCredits) { notify('error', 'This workspace has used all its AI credits for this period. Upgrade your plan for more.'); return }

    startTransition(async () => {
      try {
        const res = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'custom', topic: prompt, platform: channel, tone, objective, audience,
            length, format, count, workspaceId, brandVoice: capabilities.useBrandVoice ? 'on-brand' : undefined,
          }),
        })
        const body = await res.json()
        if (!res.ok) { notify('error', body.error ?? 'Generation failed.'); return }

        const variants: string[] = body.variants ?? []
        const ids: string[] = body.ids ?? []
        const rows: AiOutputRow[] = variants.map((text, i) => ({
          id: ids[i] ?? `local-${Date.now()}-${i}`,
          type: 'custom', prompt, output: text, channel, platform: channel, tone, objective, audience,
          model: 'claude-haiku-4-5-20251001', topic: prompt.slice(0, 80),
          word_count: text.trim().split(/\s+/).filter(Boolean).length,
          match_score: null, bookmarked: false, status: 'draft', used_content_id: null,
          batch_id: null, prompt_tokens: null, completion_tokens: null, created_at: new Date().toISOString(),
        }))
        setGenerated(rows)
        setSelectedId(rows[0]?.id ?? null)
        router.refresh()
      } catch {
        notify('error', 'Could not reach the AI service. Try again shortly.')
      }
    })
  }

  function handleUseOutput(id: string) {
    startTransition(async () => {
      const result = await moveOutputToStudio({ id })
      if (!result.ok) { notify('error', result.error ?? 'Could not use this output.'); return }
      notify('success', result.message ?? 'Draft created.')
      if (result.id) router.push(`/app/studio/compose?id=${result.id}`)
    })
  }

  function bookmark(id: string, bookmarked: boolean) {
    startTransition(async () => {
      const result = await setAiOutputState({ id, bookmarked })
      if (!result.ok) notify('error', result.error ?? 'Could not update.')
    })
  }

  function copyOutput(text: string) {
    navigator.clipboard.writeText(text).then(
      () => notify('success', 'Copied to clipboard.'),
      () => notify('error', 'Could not copy.'),
    )
  }

  function savePromptTemplate() {
    if (!prompt.trim()) { notify('error', 'Write a prompt to save first.'); return }
    const name = window.prompt('Name this saved prompt:')
    if (!name) return
    startTransition(async () => {
      const result = await savePrompt({ name, prompt, channel, tone, objective, audience })
      notify(result.ok ? 'success' : 'error', result.ok ? 'Prompt saved.' : (result.error ?? 'Failed.'))
      if (result.ok) router.refresh()
    })
  }

  const list = generated.length > 0 ? generated : outputs

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Panel title="Your prompt">
          <textarea
            value={prompt} onChange={e => setPrompt(e.target.value.slice(0, AI_MAX_PROMPT))}
            rows={5} placeholder="Write a LinkedIn post announcing our new AI Caption Generator. Highlight key benefits for marketers, include a call to action to try it free, and keep the tone professional and engaging."
            className="w-full resize-none rounded-lg border border-slate-200 p-3 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">{prompt.length} / {AI_MAX_PROMPT}</span>
            {capabilities.managePrompts && (
              <button type="button" onClick={savePromptTemplate} className="text-[11px] font-medium text-blue-600 hover:text-blue-700">Save prompt</button>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Select label="Channel" value={channel} onChange={setChannel} options={STUDIO_CHANNELS.map(c => ({ value: c, label: CHANNEL_LABELS[c] }))} />
            <Select label="Tone" value={tone} onChange={setTone} options={AI_TONES.map(t => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))} />
            <Select label="Objective" value={objective} onChange={setObjective} options={AI_OBJECTIVES.map(o => ({ value: o, label: o.replace('_', ' ') }))} />
            <Select label="Length" value={length} onChange={setLength} options={AI_LENGTHS.map(l => ({ value: l, label: l[0].toUpperCase() + l.slice(1) }))} />
            <Select label="Format" value={format} onChange={setFormat} options={AI_FORMATS.map(f => ({ value: f, label: f[0].toUpperCase() + f.slice(1) }))} />
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Audience
              <input value={audience} onChange={e => setAudience(e.target.value)} placeholder="Marketing leaders"
                className="h-9 rounded-lg border border-slate-200 px-2 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {AI_RESULT_COUNTS.map(n => (
              <button
                key={n} type="button" onClick={() => setCount(n)}
                className={`h-8 w-8 rounded-lg border text-[13px] font-semibold ${count === n ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'}`}
              >
                {n}
              </button>
            ))}
            <button
              type="button" disabled={pending || outOfCredits} onClick={generate}
              className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Sparkles size={14} /> {pending ? 'Generating…' : 'Generate'}
            </button>
          </div>
          {outOfCredits && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
              This workspace has used all its AI credits for this period. Upgrade your plan for more.
            </p>
          )}
        </Panel>

        <Panel title="Generated outputs" bodyClassName="space-y-2">
          {list.length === 0 ? (
            <StudioEmpty bare title="No outputs yet" message="Write a prompt above and generate your first result." />
          ) : (
            list.map(output => (
              <button
                key={output.id} type="button" onClick={() => setSelectedId(output.id)}
                className={`block w-full rounded-lg border p-3 text-left transition-colors ${selectedId === output.id ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <p className="line-clamp-3 text-[13px] text-slate-700">{output.output}</p>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{output.word_count ?? 0} words · {formatShortDate(output.created_at)}</span>
                  <Badge variant={AI_STATUS_BADGE[output.status] ?? 'slate'}>{AI_STATUS_LABELS[output.status] ?? output.status}</Badge>
                </div>
              </button>
            ))
          )}
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title="Output detail">
          {!selected ? (
            <StudioEmpty bare title="Nothing selected" message="Generate or pick an output to see it here." />
          ) : (
            <div>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">{selected.output}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => copyOutput(selected.output ?? '')} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  <Copy size={13} /> Copy
                </button>
                <button
                  type="button" onClick={() => bookmark(selected.id, !selected.bookmarked)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium ${selected.bookmarked ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  <Bookmark size={13} fill={selected.bookmarked ? 'currentColor' : 'none'} /> {selected.bookmarked ? 'Saved' : 'Save'}
                </button>
                {capabilities.createContent && (
                  <button
                    type="button" disabled={pending} onClick={() => handleUseOutput(selected.id)}
                    className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Wand2 size={13} /> Use in Studio
                  </button>
                )}
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Saved prompts" viewAllHref="/app/studio/ai-generate">
          {prompts.length === 0 ? (
            <p className="py-3 text-center text-[13px] text-slate-400">No saved prompts yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {prompts.map(p => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => setPrompt(p.prompt)} className="min-w-0 flex-1 truncate text-left text-[13px] text-slate-700 hover:text-blue-600">
                    {p.name}
                  </button>
                  {capabilities.managePrompts && (
                    <button
                      type="button"
                      onClick={() => startTransition(async () => { await deletePrompt({ id: p.id }); router.refresh() })}
                      className="text-[11px] text-slate-400 hover:text-red-500"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Credits & usage">
          <p className="text-[22px] font-bold text-slate-900">
            {credits.limit < 0 ? credits.used : `${credits.used} / ${credits.limit}`}
          </p>
          <p className="text-xs text-slate-400">credits used this month</p>
          {credits.limit >= 0 && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, (credits.used / Math.max(1, credits.limit)) * 100)}%` }} />
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

function Select({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
      {label}
      <select value={value} onChange={e => onChange(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-[13px] text-slate-700">
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </label>
  )
}
