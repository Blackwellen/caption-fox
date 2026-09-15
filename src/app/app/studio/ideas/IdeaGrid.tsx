'use client'

import { useState, useTransition } from 'react'
import { Wand2 } from 'lucide-react'
import { CARD, CARD_SHADOW, OwnerChip, formatShortDate } from '@/components/studio/primitives'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/campaigns/Toast'
import { useRouter } from 'next/navigation'
import {
  IDEA_BOARD_STAGES, IDEA_STAGE_BADGE, IDEA_STAGE_LABELS, canTransitionIdea, type IdeaStage,
} from '@/lib/studio/constants'
import type { IdeaRow } from '@/lib/studio/types'
import type { ViewMode } from '@/lib/studio/query'
import type { StudioCapabilities } from '@/lib/studio/entitlements'
import { convertIdeaToContent, setIdeaStage } from '../idea-actions'

export default function IdeaGrid({
  rows, view, capabilities,
}: { rows: IdeaRow[]; view: ViewMode; capabilities: StudioCapabilities }) {
  if (view === 'board') return <IdeaBoard rows={rows} capabilities={capabilities} />
  if (view === 'list') return <IdeaList rows={rows} capabilities={capabilities} />
  return <IdeaCards rows={rows} capabilities={capabilities} />
}

function ConvertButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()

  function convert() {
    startTransition(async () => {
      const result = await convertIdeaToContent({ id })
      if (!result.ok) { notify('error', result.error ?? 'Could not convert.'); return }
      notify('success', result.message ?? 'Draft created.')
      if (result.id) router.push(`/app/studio/compose?id=${result.id}`)
    })
  }

  if (disabled) return null
  return (
    <button
      type="button" disabled={pending} onClick={convert}
      className="inline-flex h-7 items-center gap-1 rounded-lg bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
    >
      <Wand2 size={12} /> Convert
    </button>
  )
}

function IdeaCards({ rows, capabilities }: { rows: IdeaRow[]; capabilities: StudioCapabilities }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(idea => (
        <div key={idea.id} className={`${CARD} ${CARD_SHADOW} flex flex-col gap-2 p-3.5`}>
          <div className="flex items-start justify-between gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-emerald-400 text-[11px] font-bold text-emerald-600">
              {idea.score ?? '—'}
            </span>
            <Badge variant={IDEA_STAGE_BADGE[idea.stage as IdeaStage] ?? 'slate'}>
              {IDEA_STAGE_LABELS[idea.stage as IdeaStage] ?? idea.stage}
            </Badge>
          </div>
          <p className="text-[13px] font-semibold text-slate-800">{idea.title}</p>
          {idea.description && <p className="line-clamp-2 text-xs text-slate-500">{idea.description}</p>}
          {idea.tags && idea.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {idea.tags.slice(0, 3).map(tag => (
                <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{tag}</span>
              ))}
            </div>
          )}
          <div className="mt-auto flex items-center justify-between pt-1">
            <OwnerChip person={idea.owner} />
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">{formatShortDate(idea.created_at)}</span>
              {capabilities.convertIdeas && !idea.converted_to_post_id && <ConvertButton id={idea.id} />}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function IdeaList({ rows, capabilities }: { rows: IdeaRow[]; capabilities: StudioCapabilities }) {
  return (
    <div className={`${CARD} ${CARD_SHADOW} divide-y divide-slate-50`}>
      {rows.map(idea => (
        <div key={idea.id} className="flex items-center gap-3 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-emerald-400 text-[11px] font-bold text-emerald-600">
            {idea.score ?? '—'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-slate-800">{idea.title}</p>
            <p className="truncate text-xs text-slate-400">{idea.description ?? 'No description'}</p>
          </div>
          <Badge variant={IDEA_STAGE_BADGE[idea.stage as IdeaStage] ?? 'slate'}>
            {IDEA_STAGE_LABELS[idea.stage as IdeaStage] ?? idea.stage}
          </Badge>
          <OwnerChip person={idea.owner} />
          {capabilities.convertIdeas && !idea.converted_to_post_id && <ConvertButton id={idea.id} />}
        </div>
      ))}
    </div>
  )
}

function IdeaBoard({ rows, capabilities }: { rows: IdeaRow[]; capabilities: StudioCapabilities }) {
  const { notify } = useToast()
  const [, startTransition] = useTransition()
  const [dragId, setDragId] = useState<string | null>(null)

  function move(id: string, from: IdeaStage, to: IdeaStage) {
    if (from === to || !canTransitionIdea(from, to)) return
    startTransition(async () => {
      const result = await setIdeaStage({ id, stage: to })
      if (!result.ok) notify('error', result.error ?? 'Could not move idea.')
    })
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {IDEA_BOARD_STAGES.map(stage => {
        const items = rows.filter(r => r.stage === stage)
        return (
          <div
            key={stage}
            className="w-72 shrink-0 rounded-xl border border-slate-200 bg-slate-50/60 p-2"
            onDragOver={e => e.preventDefault()}
            onDrop={() => { if (dragId) { const source = rows.find(r => r.id === dragId); if (source) move(dragId, source.stage as IdeaStage, stage) } }}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-semibold text-slate-600">{IDEA_STAGE_LABELS[stage]}</p>
              <span className="text-[11px] text-slate-400">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map(idea => (
                <div
                  key={idea.id}
                  draggable={capabilities.editIdeas}
                  onDragStart={() => setDragId(idea.id)}
                  onDragEnd={() => setDragId(null)}
                  className={`${CARD} cursor-grab select-none p-2.5 shadow-sm active:cursor-grabbing`}
                >
                  <p className="line-clamp-2 text-[13px] font-medium text-slate-800">{idea.title}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-emerald-600">{idea.score ?? '—'}</span>
                    <OwnerChip person={idea.owner} />
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <p className="px-1 py-6 text-center text-[11px] text-slate-400">No ideas</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
