'use client'

import { useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/campaigns/Toast'
import { updateFunnelSteps, archiveFunnel } from '@/app/app/web/actions'
import { CARD, CARD_SHADOW, formatPercentValue } from './primitives'
import type { FunnelRow, FunnelStepRow } from '@/lib/web/types'

interface EditableStep { id: string; name: string; users_count: number }

export default function FunnelStepsClient({ funnel, canEdit, canDelete }: {
  funnel: FunnelRow; canEdit: boolean; canDelete: boolean
}) {
  const { notify } = useToast()
  const [steps, setSteps] = useState<EditableStep[]>((funnel.steps ?? []).map((s: FunnelStepRow) => ({ id: s.id, name: s.name, users_count: s.users_count })))
  const [dirty, setDirty] = useState(false)
  const [pending, startTransition] = useTransition()

  function mutate(next: EditableStep[]) { setSteps(next); setDirty(true) }

  function addStep() { mutate([...steps, { id: crypto.randomUUID(), name: `Step ${steps.length + 1}`, users_count: 0 }]) }
  function removeStep(id: string) { mutate(steps.filter(s => s.id !== id)) }
  function moveStep(id: string, dir: -1 | 1) {
    const index = steps.findIndex(s => s.id === id)
    const target = index + dir
    if (index < 0 || target < 0 || target >= steps.length) return
    const next = [...steps]
    ;[next[index], next[target]] = [next[target], next[index]]
    mutate(next)
  }
  function updateStep(id: string, patch: Partial<EditableStep>) { mutate(steps.map(s => (s.id === id ? { ...s, ...patch } : s))) }

  function save() {
    startTransition(async () => {
      const result = await updateFunnelSteps(funnel.id, steps.map(s => ({ name: s.name, users_count: s.users_count })))
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Saved.') : (result.error ?? 'Could not save.'))
      if (result.ok) setDirty(false)
    })
  }

  function archive() {
    if (!confirm(`Archive "${funnel.name}"?`)) return
    startTransition(async () => {
      const result = await archiveFunnel(funnel.id)
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Archived.') : (result.error ?? 'Could not archive.'))
    })
  }

  const entries = steps[0]?.users_count ?? 0

  return (
    <div className={cn(CARD, CARD_SHADOW, 'p-4')}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-slate-900">Steps</h2>
        {canEdit && <button type="button" onClick={addStep} className="text-[12px] font-medium text-blue-600 hover:text-blue-700">+ Add step</button>}
      </div>

      <ul className="space-y-2">
        {steps.map((step, index) => {
          const dropOff = index > 0 && steps[index - 1].users_count > 0
            ? ((steps[index - 1].users_count - step.users_count) / steps[index - 1].users_count) * 100
            : null
          return (
            <li key={step.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-600">{index + 1}</span>
              <input
                value={step.name} disabled={!canEdit} onChange={e => updateStep(step.id, { name: e.target.value })}
                className="h-8 min-w-[120px] flex-1 rounded-md border border-slate-200 px-2 text-[12px] disabled:bg-slate-50"
              />
              <input
                type="number" min={0} value={step.users_count} disabled={!canEdit}
                onChange={e => updateStep(step.id, { users_count: Math.max(0, Number(e.target.value) || 0) })}
                className="h-8 w-24 rounded-md border border-slate-200 px-2 text-[12px] disabled:bg-slate-50"
              />
              {dropOff !== null && (
                <span className={cn('w-16 shrink-0 text-right text-[11px]', dropOff > 40 ? 'text-red-500' : 'text-slate-400')}>
                  −{formatPercentValue(dropOff, 0)}
                </span>
              )}
              {canEdit && steps.length > 2 && (
                <div className="flex items-center gap-1">
                  <button type="button" disabled={index === 0} onClick={() => moveStep(step.id, -1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ArrowUp size={12} /></button>
                  <button type="button" disabled={index === steps.length - 1} onClick={() => moveStep(step.id, 1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ArrowDown size={12} /></button>
                  <button type="button" onClick={() => removeStep(step.id)} className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={12} /></button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <p className="mt-2 text-[11px] text-slate-400">
        Step counts are entered here from your own analytics until real Tracking Event measurement is wired to this funnel. Entries: {entries}.
      </p>

      {canEdit && (
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={save} disabled={pending || !dirty} className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50">Save steps</button>
          {canDelete && funnel.status !== 'archived' && <button type="button" onClick={archive} disabled={pending} className="ml-auto inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50">Archive</button>}
        </div>
      )}
    </div>
  )
}
