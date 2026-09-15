'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, Clock, Loader2, Mail, Plus, Trash2, Workflow, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/campaigns/Toast'
import { createJourney, updateJourneySteps, type JourneyStepInput } from '@/app/app/messaging/actions'
import { CHANNEL_LABELS, MESSAGING_CHANNELS, type MessagingChannel } from '@/lib/messaging/constants'
import AudiencePicker from '@/components/messaging/composer/AudiencePicker'
import type { AudienceRow, JourneyRow } from '@/lib/messaging/types'

const FIELD = 'w-full rounded-lg border border-slate-200 px-3 text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'

type StepDraft = JourneyStepInput & { key: string }

function newStep(type: StepDraft['type']): StepDraft {
  const key = crypto.randomUUID()
  if (type === 'message') return { key, id: key, type, channel: 'email', content: { body: '' } }
  if (type === 'wait') return { key, id: key, type, waitHours: 24 }
  return { key, id: key, type }
}

export default function JourneyBuilder({
  audiences, channels, existing,
}: { audiences: AudienceRow[]; channels: MessagingChannel[]; existing?: JourneyRow }) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()

  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [audienceId, setAudienceId] = useState(existing?.audience_id ?? '')
  const existingSteps = existing?.canvas?.nodes as StepDraft[] | undefined
  const [steps, setSteps] = useState<StepDraft[]>(
    existingSteps?.filter(s => s.type !== 'trigger').map(s => ({ ...s, key: s.id })) ?? [newStep('message')],
  )

  function updateStep(key: string, patch: Partial<StepDraft>) {
    setSteps(list => list.map(s => (s.key === key ? { ...s, ...patch } : s)))
  }
  function removeStep(key: string) {
    setSteps(list => list.filter(s => s.key !== key))
  }
  function addStep(type: StepDraft['type']) {
    setSteps(list => [...list, newStep(type)])
  }

  function handleSave() {
    if (!name.trim()) { notify('error', 'Journey name is required.'); return }
    if (steps.length === 0) { notify('error', 'Add at least one step.'); return }
    const payload: JourneyStepInput[] = [
      { id: 'trigger', type: 'trigger', triggerLabel: 'Audience entry' },
      ...steps.map(({ key: _key, ...step }) => step),
    ]

    startTransition(async () => {
      const res = existing
        ? await updateJourneySteps(existing.id, payload)
        : await createJourney({ name, description, audienceId: audienceId || undefined, steps: payload })
      if (!res.ok) { notify('error', res.error ?? 'Could not save journey.'); return }
      notify('success', res.message ?? 'Journey saved.')
      router.push('/app/messaging/journeys')
      router.refresh()
    })
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">Journey name</label>
          <input className={cn(FIELD, 'h-9')} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Welcome Series" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">Description</label>
          <input className={cn(FIELD, 'h-9')} value={description} onChange={e => setDescription(e.target.value)} placeholder="What this journey is for" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[12px] font-medium text-slate-600">
            <Workflow size={14} className="text-slate-400" />
            Trigger — contact enters the chosen audience
          </div>

          {steps.map((step, index) => (
            <div key={step.key}>
              <div className="flex justify-center py-0.5"><ArrowDown size={14} className="text-slate-300" /></div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <select
                    value={step.type} onChange={e => updateStep(step.key, newStep(e.target.value as StepDraft['type']))}
                    className={cn(FIELD, 'h-8 w-auto text-[12px] font-medium')}
                  >
                    <option value="message">Send message</option>
                    <option value="wait">Wait</option>
                    <option value="condition">Condition</option>
                    <option value="end">End</option>
                  </select>
                  <button type="button" onClick={() => removeStep(step.key)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>

                {step.type === 'message' && (
                  <div className="space-y-2">
                    <select
                      value={step.channel} onChange={e => updateStep(step.key, { channel: e.target.value as MessagingChannel })}
                      className={cn(FIELD, 'h-8')}
                    >
                      {channels.map(c => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
                    </select>
                    {step.channel === 'email' && (
                      <input
                        className={cn(FIELD, 'h-8')} placeholder="Subject" value={step.content?.subject ?? ''}
                        onChange={e => updateStep(step.key, { content: { ...step.content, body: step.content?.body ?? '', subject: e.target.value } })}
                      />
                    )}
                    <textarea
                      className={cn(FIELD, 'min-h-[70px] resize-y py-2')} placeholder="Message body"
                      value={step.content?.body ?? ''}
                      onChange={e => updateStep(step.key, { content: { ...step.content, body: e.target.value } })}
                    />
                  </div>
                )}

                {step.type === 'wait' && (
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-slate-400" />
                    <input
                      type="number" min={1} className={cn(FIELD, 'h-8 w-24')} value={step.waitHours ?? 24}
                      onChange={e => updateStep(step.key, { waitHours: Number(e.target.value) })}
                    />
                    <span className="text-[12px] text-slate-500">hours</span>
                  </div>
                )}

                {step.type === 'condition' && (
                  <div className="space-y-2">
                    <select
                      className={cn(FIELD, 'h-8')} value={step.conditionType ?? ''}
                      onChange={e => updateStep(step.key, { conditionType: (e.target.value || undefined) as StepDraft['conditionType'] })}
                    >
                      <option value="">Informational only (always continues)</option>
                      <option value="opened_previous">Real check: opened the previous message</option>
                      <option value="clicked_previous">Real check: clicked the previous message</option>
                    </select>
                    <input
                      className={cn(FIELD, 'h-8')} placeholder="Label shown on this step (optional)"
                      value={step.conditionLabel ?? ''} onChange={e => updateStep(step.key, { conditionLabel: e.target.value })}
                    />
                    {step.conditionType && (
                      <p className="text-[11px] text-slate-400">
                        Contacts who don&apos;t meet this exit the journey here — everyone else continues to the next step.
                      </p>
                    )}
                  </div>
                )}

                {step.type === 'end' && <p className="text-[12px] text-slate-400">Contacts exit the journey here.</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
          <button type="button" onClick={() => addStep('message')} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50">
            <Mail size={13} /> Message
          </button>
          <button type="button" onClick={() => addStep('wait')} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50">
            <Clock size={13} /> Wait
          </button>
          <button type="button" onClick={() => addStep('condition')} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50">
            <Plus size={13} /> Condition
          </button>
          <button
            type="button" onClick={handleSave} disabled={pending}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            {existing ? 'Save changes' : 'Create journey'}
          </button>
        </div>
      </div>

      {!existing && <AudiencePicker channel="email" audiences={audiences} value={audienceId} onChange={setAudienceId} />}
      {existing && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-[12px] text-slate-500">
          <p className="mb-1 flex items-center gap-1.5 font-medium text-slate-700"><X size={12} className="text-slate-300" /> Entry audience is set when a journey is created.</p>
          To change the audience, create a new journey — this keeps historical participant data attributable to a single, stable entry rule.
        </div>
      )}
    </div>
  )
}
