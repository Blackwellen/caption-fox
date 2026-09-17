'use client'

import { useMemo, useState } from 'react'
import { BUTTON_PRIMARY } from './design'
import { useCreatorsBase } from './controls'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/campaigns/Toast'
import { createBrief } from '@/lib/creators/actions'
import { Avatar, formatMoneyShort } from './primitives'
import WizardShell, { WizardChipToggle, WizardSection, WizardSummaryRow, type WizardStepDef } from './WizardShell'
import {
  ASSET_TYPES, ASSET_TYPE_LABELS, CHANNEL_LABELS, CREATOR_CHANNELS,
  USAGE_SCOPE_LABELS, USAGE_SCOPES,
} from '@/lib/creators/constants'
import type { CreatorRow } from '@/lib/creators/types'

const EMPTY_FORM = {
  title: '', description: '', category: '', priority: 'medium', budget: '',
  deadline: '', max_creators: '', deliverables: '', rights_requirement: '',
  do_instructions: '', dont_instructions: '', campaign_id: '',
}

interface DeliverableDraft {
  key: string
  title: string
  asset_type: string
  quantity: number
  channel: string
  due_date: string
}

function emptyDeliverable(): DeliverableDraft {
  return { key: Math.random().toString(36).slice(2), title: '', asset_type: 'video', quantity: 1, channel: '', due_date: '' }
}

export default function CreateBriefButton({
  creators, campaigns, label = 'Create Brief', className,
}: {
  creators: Pick<CreatorRow, 'id' | 'name' | 'handle' | 'avatar_url'>[]
  campaigns: { id: string; name: string }[]
  label?: string
  className?: string
}) {
  const router = useRouter()
  const base = useCreatorsBase()
  const { notify } = useToast()
  // Global "Create > UGC brief" deep-links here with ?action=new.
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(() => searchParams.get('action') === 'new')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [channels, setChannels] = useState<string[]>([])
  const [deliverables, setDeliverables] = useState<DeliverableDraft[]>([emptyDeliverable()])
  const [creatorIds, setCreatorIds] = useState<string[]>([])
  const [creatorSearch, setCreatorSearch] = useState('')

  const dirty = form.title.trim().length > 0 || channels.length > 0 || creatorIds.length > 0

  function reset() {
    setForm(EMPTY_FORM); setChannels([]); setDeliverables([emptyDeliverable()]); setCreatorIds([]); setCreatorSearch(''); setSubmitError(null)
  }

  function toggleChannel(id: string) { setChannels(list => (list.includes(id) ? list.filter(c => c !== id) : [...list, id])) }
  function toggleCreator(id: string) { setCreatorIds(list => (list.includes(id) ? list.filter(c => c !== id) : [...list, id])) }

  function updateDeliverable(key: string, patch: Partial<DeliverableDraft>) {
    setDeliverables(list => list.map(d => (d.key === key ? { ...d, ...patch } : d)))
  }

  const filteredCreators = useMemo(() => {
    const term = creatorSearch.trim().toLowerCase()
    if (!term) return creators
    return creators.filter(c => c.name.toLowerCase().includes(term) || c.handle?.toLowerCase().includes(term))
  }, [creators, creatorSearch])

  const selectedCampaign = campaigns.find(c => c.id === form.campaign_id)

  async function submit(): Promise<boolean> {
    setSubmitting(true)
    setSubmitError(null)
    const result = await createBrief({
      ...form, channels, creatorIds,
      deliverableItems: deliverables.filter(d => d.title.trim()).map(d => ({
        title: d.title.trim(), asset_type: d.asset_type, quantity: d.quantity || 1,
        channel: d.channel || undefined, due_date: d.due_date || undefined,
      })),
    })
    setSubmitting(false)
    if (!result.ok) { setSubmitError(result.error ?? 'Could not create the brief.'); return false }
    notify('success', result.message ?? 'Brief created.')
    setOpen(false); reset(); router.refresh()
    if (result.id) router.push(`${base}/briefs/${result.id}`)
    return true
  }

  const steps: WizardStepDef[] = [
    {
      id: 'basics', label: 'Basics', description: 'Title, campaign and timing',
      validate: () => (form.title.trim() ? null : 'Give this brief a title.'),
      render: () => (
        <WizardSection title="Basics" description="What is this piece of work, and when does it need to land?">
          <Input label="Brief title" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Summer Skincare Routine" />
          <Textarea label="Description" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What should this content achieve?" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Select
              label="Campaign" value={form.campaign_id} onChange={e => setForm(f => ({ ...f, campaign_id: e.target.value }))}
              options={[{ value: '', label: 'No linked campaign' }, ...campaigns.map(c => ({ value: c.id, label: c.name }))]}
            />
            <Select
              label="Priority" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]}
            />
            <Input label="Deadline" type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
          </div>
        </WizardSection>
      ),
    },
    {
      id: 'requirements', label: 'Requirements', description: 'Channels, budget and rights',
      render: () => (
        <div className="space-y-5">
          <WizardSection title="Channels">
            <WizardChipToggle options={CREATOR_CHANNELS} selected={channels} onToggle={toggleChannel} getLabel={v => CHANNEL_LABELS[v]} />
          </WizardSection>
          <WizardSection title="Budget & capacity">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Budget (GBP)" type="number" min={0} value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} />
              <Input label="Max creators" type="number" min={1} value={form.max_creators} onChange={e => setForm(f => ({ ...f, max_creators: e.target.value }))} />
            </div>
          </WizardSection>
          <WizardSection title="Usage rights requirement" description="What rights will you need once content is approved?">
            <Select
              label="Rights requirement" value={form.rights_requirement} onChange={e => setForm(f => ({ ...f, rights_requirement: e.target.value }))}
              options={[{ value: '', label: 'Not specified' }, ...USAGE_SCOPES.map(scope => ({ value: scope, label: USAGE_SCOPE_LABELS[scope] }))]}
            />
          </WizardSection>
          <WizardSection title="Creative direction">
            <div className="grid gap-3 sm:grid-cols-2">
              <Textarea label="Do" rows={3} value={form.do_instructions} onChange={e => setForm(f => ({ ...f, do_instructions: e.target.value }))} placeholder="Show the product in natural light…" />
              <Textarea label="Don't" rows={3} value={form.dont_instructions} onChange={e => setForm(f => ({ ...f, dont_instructions: e.target.value }))} placeholder="No competitor branding visible…" />
            </div>
          </WizardSection>
        </div>
      ),
    },
    {
      id: 'deliverables', label: 'Deliverables', description: 'What creators need to produce',
      render: () => (
        <WizardSection title="Deliverables" description="Add each asset creators need to deliver against this brief.">
          <div className="space-y-2.5">
            {deliverables.map((d, i) => (
              <div key={d.key} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-slate-200 p-2.5">
                <div className="col-span-12 sm:col-span-4">
                  <Input label={i === 0 ? 'Title' : undefined} value={d.title} onChange={e => updateDeliverable(d.key, { title: e.target.value })} placeholder="30s hero video" />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <Select
                    label={i === 0 ? 'Type' : undefined} value={d.asset_type} onChange={e => updateDeliverable(d.key, { asset_type: e.target.value })}
                    options={ASSET_TYPES.map(t => ({ value: t, label: ASSET_TYPE_LABELS[t] }))}
                  />
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <Input label={i === 0 ? 'Qty' : undefined} type="number" min={1} value={d.quantity} onChange={e => updateDeliverable(d.key, { quantity: Number(e.target.value) || 1 })} />
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <Input label={i === 0 ? 'Due' : undefined} type="date" value={d.due_date} onChange={e => updateDeliverable(d.key, { due_date: e.target.value })} />
                </div>
                <div className="col-span-12 flex justify-end sm:col-span-1">
                  <button
                    type="button" aria-label="Remove deliverable"
                    onClick={() => setDeliverables(list => (list.length > 1 ? list.filter(item => item.key !== d.key) : list))}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button" onClick={() => setDeliverables(list => [...list, emptyDeliverable()])}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus size={14} />Add another deliverable
          </button>
          <Textarea label="Deliverables summary (optional)" rows={2} value={form.deliverables} onChange={e => setForm(f => ({ ...f, deliverables: e.target.value }))} placeholder="Free-text summary shown to creators" />
        </WizardSection>
      ),
    },
    {
      id: 'creators', label: 'Creators', description: 'Who to invite', optional: true,
      render: () => (
        <WizardSection title="Invite creators" description={`${creatorIds.length} selected — you can also assign creators later from the brief.`}>
          <Input value={creatorSearch} onChange={e => setCreatorSearch(e.target.value)} placeholder="Search creators…" />
          {creators.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-[13px] text-slate-400">No creators in this workspace yet — invite some from the Creators tab.</p>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {filteredCreators.map(creator => (
                <label key={creator.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={creatorIds.includes(creator.id)} onChange={() => toggleCreator(creator.id)} className="rounded border-slate-300" />
                  <Avatar name={creator.name} src={creator.avatar_url} size={24} />
                  <span className="flex-1 truncate">{creator.name}</span>
                  {creator.handle && <span className="text-xs text-slate-400">@{creator.handle}</span>}
                </label>
              ))}
              {filteredCreators.length === 0 && <p className="px-2 py-4 text-center text-xs text-slate-400">No creators match &quot;{creatorSearch}&quot;.</p>}
            </div>
          )}
        </WizardSection>
      ),
    },
    {
      id: 'review', label: 'Review', description: 'Confirm and create',
      render: () => (
        <WizardSection title="Review">
          <div className="rounded-xl border border-slate-200 p-4">
            <WizardSummaryRow label="Title" value={form.title || '—'} />
            <WizardSummaryRow label="Campaign" value={selectedCampaign?.name ?? 'None'} />
            <WizardSummaryRow label="Priority" value={<span className="capitalize">{form.priority}</span>} />
            <WizardSummaryRow label="Deadline" value={form.deadline || 'Not set'} />
            <WizardSummaryRow label="Channels" value={channels.length ? channels.map(c => CHANNEL_LABELS[c]).join(', ') : '—'} />
            <WizardSummaryRow label="Budget" value={form.budget ? formatMoneyShort(Number(form.budget)) : '—'} />
            <WizardSummaryRow label="Deliverables" value={`${deliverables.filter(d => d.title.trim()).length} defined`} />
            <WizardSummaryRow label="Creators invited" value={String(creatorIds.length)} />
          </div>
          <p className="text-[12px] text-slate-400">Creating this brief will notify assigned creators and log the action in this workspace&apos;s activity feed.</p>
        </WizardSection>
      ),
    },
  ]

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? BUTTON_PRIMARY}><Plus size={16} aria-hidden />{label}</button>
      <WizardShell
        open={open} onClose={() => { setOpen(false); reset() }}
        title="Create a brief" subtitle="Define the assignment, deliverables and creators for this piece of work."
        steps={steps} onSubmit={submit} submitLabel="Create brief" submitting={submitting} submitError={submitError} dirty={dirty}
      />
    </>
  )
}
