'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Loader2, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { addBriefSection, moveBriefSection, removeBriefSection, toggleBriefSection } from '@/lib/seo/actions'
import type { SeoBriefSection } from '@/lib/seo/types'

const LEVEL_STYLE: Record<string, string> = {
  h1: 'font-semibold text-slate-900',
  h2: 'ml-4 text-slate-700',
  h3: 'ml-8 text-slate-600',
}

export function BriefOutlineEditor({
  briefId, sections, canEdit,
}: { briefId: string; sections: SeoBriefSection[]; canEdit: boolean }) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function run(id: string, action: () => Promise<{ ok: boolean; error?: string }>) {
    setPendingId(id)
    startTransition(async () => {
      const result = await action()
      setPendingId(null)
      if (!result.ok) setError(result.error ?? 'Something went wrong.')
      else { setError(null); router.refresh() }
    })
  }

  function submitNewSection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title') ?? '')
    const level = String(form.get('level') ?? 'h2') as 'h1' | 'h2' | 'h3'
    if (!title.trim()) { setError('Enter a section title.'); return }
    run('new', async () => {
      const result = await addBriefSection({ briefId, level, title })
      if (result.ok) { setAdding(false); event.currentTarget.reset() }
      return result
    })
  }

  return (
    <div>
      {error && <p role="alert" className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <ul className="space-y-1">
        {sections.map((section, index) => (
          <li key={section.id} className={cn('group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50', LEVEL_STYLE[section.level])}>
            <button
              type="button"
              disabled={!canEdit || pending}
              onClick={() => run(section.id, () => toggleBriefSection(briefId, section.id))}
              aria-label={section.completed ? 'Mark section incomplete' : 'Mark section complete'}
              className="shrink-0 disabled:cursor-default"
            >
              {pendingId === section.id
                ? <Loader2 size={15} className="animate-spin text-slate-400" />
                : section.completed ? <CheckCircle2 size={15} className="text-emerald-500" /> : <Circle size={15} className="text-slate-300" />}
            </button>
            <span className="flex-1 text-sm">{section.title}</span>
            {canEdit && (
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button type="button" disabled={index === 0 || pending} onClick={() => run(section.id, () => moveBriefSection(briefId, section.id, 'up'))} aria-label="Move up" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30">
                  <ChevronUp size={13} />
                </button>
                <button type="button" disabled={index === sections.length - 1 || pending} onClick={() => run(section.id, () => moveBriefSection(briefId, section.id, 'down'))} aria-label="Move down" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30">
                  <ChevronDown size={13} />
                </button>
                <button type="button" disabled={pending} onClick={() => run(section.id, () => removeBriefSection(briefId, section.id))} aria-label="Remove section" className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                  <X size={13} />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        adding ? (
          <form onSubmit={submitNewSection} className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 p-2">
            <select name="level" defaultValue="h2" className="h-8 rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-600">
              <option value="h1">H1</option>
              <option value="h2">H2</option>
              <option value="h3">H3</option>
            </select>
            <input name="title" autoFocus maxLength={200} placeholder="Section title" className="h-8 flex-1 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-blue-400" />
            <button type="submit" disabled={pending} className="h-8 rounded-md bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60">Add</button>
            <button type="button" onClick={() => setAdding(false)} className="h-8 rounded-md px-2 text-xs text-slate-500 hover:bg-slate-100">Cancel</button>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
            <Plus size={12} /> Add section
          </button>
        )
      )}
    </div>
  )
}
