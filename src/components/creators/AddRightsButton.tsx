'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/campaigns/Toast'
import { createRightsRecord, sendUsageRequest } from '@/app/app/creators/actions'
import WizardShell, { WizardChipToggle, WizardSection, WizardSummaryRow, type WizardStepDef } from './WizardShell'
import {
  CHANNEL_LABELS, CREATOR_CHANNELS, RIGHTS_TERRITORIES, USAGE_SCOPE_LABELS, USAGE_SCOPES,
} from '@/lib/creators/constants'
import type { CreatorRow } from '@/lib/creators/types'

const EMPTY = {
  creatorId: '', assetLabel: '', usageScope: 'organic_only', startDate: '', expiryDate: '',
  exclusivity: false, modificationAllowed: false, paidAmplification: false, agreementUrl: '', agreementSigned: false, notes: '',
}

export default function AddRightsButton({
  creators, label = 'Add Rights Record', className,
}: { creators: Pick<CreatorRow, 'id' | 'name' | 'handle'>[]; label?: string; className?: string }) {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [territories, setTerritories] = useState<string[]>([])
  const [channels, setChannels] = useState<string[]>([])

  const dirty = Boolean(form.creatorId || form.assetLabel.trim())

  function reset() { setForm(EMPTY); setTerritories([]); setChannels([]); setSubmitError(null) }
  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value])
  }

  async function submit(): Promise<boolean> {
    setSubmitting(true)
    setSubmitError(null)
    const result = await createRightsRecord({ ...form, territories, channels })
    setSubmitting(false)
    if (!result.ok) { setSubmitError(result.error ?? 'Could not create the rights record.'); return false }
    notify('success', result.message ?? 'Rights record created.')
    setOpen(false); reset(); router.refresh()
    if (result.id) router.push(`/app/creators/rights/${result.id}`)
    return true
  }

  const selectedCreator = creators.find(c => c.id === form.creatorId)

  const steps: WizardStepDef[] = [
    {
      id: 'creator-asset', label: 'Creator & Asset', description: 'Who and what this covers',
      validate: () => {
        if (!form.creatorId) return 'Select a creator.'
        if (!form.assetLabel.trim()) return 'Give this asset or submission a label.'
        return null
      },
      render: () => (
        <WizardSection title="Creator & asset" description="Which creator granted rights, and to which asset?">
          <Select
            label="Creator" required value={form.creatorId} onChange={e => setForm(f => ({ ...f, creatorId: e.target.value }))}
            options={[{ value: '', label: 'Select a creator' }, ...creators.map(c => ({ value: c.id, label: `${c.name}${c.handle ? ` (@${c.handle})` : ''}` }))]}
          />
          <Input label="Asset / submission label" required value={form.assetLabel} onChange={e => setForm(f => ({ ...f, assetLabel: e.target.value }))} placeholder="Summer Skincare Routine — video" />
        </WizardSection>
      ),
    },
    {
      id: 'scope', label: 'Scope & Coverage', description: 'Usage, channels and territories',
      render: () => (
        <div className="space-y-5">
          <WizardSection title="Usage scope">
            <Select
              label="Usage scope" value={form.usageScope} onChange={e => setForm(f => ({ ...f, usageScope: e.target.value }))}
              options={USAGE_SCOPES.map(scope => ({ value: scope, label: USAGE_SCOPE_LABELS[scope] }))}
            />
          </WizardSection>
          <WizardSection title="Channels">
            <WizardChipToggle options={CREATOR_CHANNELS} selected={channels} onToggle={id => toggle(channels, setChannels, id)} getLabel={v => CHANNEL_LABELS[v]} />
          </WizardSection>
          <WizardSection title="Territories">
            <WizardChipToggle options={RIGHTS_TERRITORIES} selected={territories} onToggle={id => toggle(territories, setTerritories, id)} />
          </WizardSection>
          <WizardSection title="Dates">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Start date" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              <Input label="Expiry date" type="date" value={form.expiryDate} min={form.startDate || undefined} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
            </div>
          </WizardSection>
        </div>
      ),
      validate: () => (form.startDate && form.expiryDate && form.expiryDate < form.startDate ? 'Expiry date cannot be before the start date.' : null),
    },
    {
      id: 'permissions', label: 'Permissions', description: 'What is and isn’t allowed',
      render: () => (
        <div className="space-y-5">
          <WizardSection title="Permissions">
            <div className="grid gap-2.5 sm:grid-cols-2">
              {([
                ['exclusivity', 'Exclusive to this workspace'], ['modificationAllowed', 'Modification allowed'],
                ['paidAmplification', 'Paid amplification allowed'], ['agreementSigned', 'Agreement signed'],
              ] as const).map(([key, text]) => (
                <label key={key} className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox" checked={form[key] as boolean}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                    className="rounded border-slate-300"
                  />
                  {text}
                </label>
              ))}
            </div>
          </WizardSection>
          <WizardSection title="Agreement">
            <Input label="Agreement URL (optional)" value={form.agreementUrl} onChange={e => setForm(f => ({ ...f, agreementUrl: e.target.value }))} placeholder="https://…" />
            <Textarea label="Notes" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </WizardSection>
        </div>
      ),
    },
    {
      id: 'review', label: 'Review', description: 'Confirm and save',
      render: () => (
        <WizardSection title="Review">
          <div className="rounded-xl border border-slate-200 p-4">
            <WizardSummaryRow label="Creator" value={selectedCreator?.name ?? '—'} />
            <WizardSummaryRow label="Asset" value={form.assetLabel || '—'} />
            <WizardSummaryRow label="Usage scope" value={USAGE_SCOPE_LABELS[form.usageScope as keyof typeof USAGE_SCOPE_LABELS] ?? form.usageScope} />
            <WizardSummaryRow label="Channels" value={channels.length ? channels.map(c => CHANNEL_LABELS[c]).join(', ') : 'None'} />
            <WizardSummaryRow label="Territories" value={territories.length ? territories.join(', ') : 'None'} />
            <WizardSummaryRow label="Dates" value={`${form.startDate || 'No start'} → ${form.expiryDate || 'No expiry'}`} />
            <WizardSummaryRow label="Agreement" value={form.agreementSigned ? 'Signed' : form.agreementUrl ? 'Unsigned' : 'Not attached'} />
          </div>
          <p className="text-[12px] text-slate-400">This record will be created as {form.agreementSigned ? '"Active"' : '"Pending approval"'} and logged in the workspace activity feed.</p>
        </WizardSection>
      ),
    },
  ]

  return (
    <>
      <Button size="sm" icon={<Plus size={15} />} onClick={() => setOpen(true)} className={className}>{label}</Button>
      <WizardShell
        open={open} onClose={() => { setOpen(false); reset() }}
        title="Add a rights record" subtitle="Record a usage licence, assignment or permission tied to a creator's work."
        steps={steps} onSubmit={submit} submitLabel="Save rights record" submitting={submitting} submitError={submitError} dirty={dirty}
      />
    </>
  )
}

export function SendUsageRequestButton({
  creators, label = 'Send Usage Request', className,
}: { creators: Pick<CreatorRow, 'id' | 'name' | 'handle'>[]; label?: string; className?: string }) {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creatorId, setCreatorId] = useState('')
  const [proposedFee, setProposedFee] = useState('')
  const [message, setMessage] = useState('')

  function reset() { setCreatorId(''); setProposedFee(''); setMessage(''); setError(null) }

  function submit() {
    if (pending) return
    if (!creatorId) { setError('Select a creator.'); return }
    setPending(true)
    sendUsageRequest({ creatorId, proposedFee, message }).then(result => {
      setPending(false)
      if (!result.ok) { setError(result.error ?? 'Could not send the request.'); return }
      notify('success', result.message ?? 'Usage request sent.')
      setOpen(false); reset(); router.refresh()
    })
  }

  return (
    <>
      <Button variant="secondary" size="sm" icon={<Send size={14} />} onClick={() => setOpen(true)} className={className}>{label}</Button>
      <Modal
        open={open} onClose={() => { setOpen(false); reset() }}
        title="Send a usage request" description="Ask a creator to grant additional usage rights for their content."
        footer={(
          <div className="flex w-full justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setOpen(false); reset() }}>Cancel</Button>
            <Button size="sm" loading={pending} onClick={submit}>Send request</Button>
          </div>
        )}
      >
        <form onSubmit={event => { event.preventDefault(); submit() }} className="space-y-3">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <Select
            label="Creator" required value={creatorId} onChange={e => setCreatorId(e.target.value)}
            options={[{ value: '', label: 'Select a creator' }, ...creators.map(c => ({ value: c.id, label: `${c.name}${c.handle ? ` (@${c.handle})` : ''}` }))]}
          />
          <Input label="Proposed fee (GBP, optional)" type="number" min={0} value={proposedFee} onChange={e => setProposedFee(e.target.value)} />
          <Textarea label="Message" rows={3} value={message} onChange={e => setMessage(e.target.value)} placeholder="We'd like to extend usage to paid social for 6 months…" />
        </form>
      </Modal>
    </>
  )
}
