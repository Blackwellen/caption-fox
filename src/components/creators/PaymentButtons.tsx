'use client'

import { useMemo, useState } from 'react'
import { BUTTON_PRIMARY } from './design'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { useToast } from '@/components/campaigns/Toast'
import { approvePaymentBatch, createPayment, createPaymentBatch } from '@/lib/creators/actions'
import { formatMoney } from './primitives'
import WizardShell, { WizardSection, WizardSummaryRow } from './WizardShell'
import type { WizardStepDef } from './WizardShell'
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from '@/lib/creators/constants'
import type { CreatorRow } from '@/lib/creators/types'
import type { EligiblePayment } from '@/lib/creators/data'

export function CreatePaymentButton({
  creators, label = 'Record Payment', className,
}: { creators: Pick<CreatorRow, 'id' | 'name' | 'handle'>[]; label?: string; className?: string }) {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ creatorId: '', amount: '', paymentMethod: '', invoiceNumber: '', notes: '' })

  function reset() { setForm({ creatorId: '', amount: '', paymentMethod: '', invoiceNumber: '', notes: '' }); setError(null) }

  async function submit() {
    if (pending) return
    if (!form.creatorId) { setError('Select a creator.'); return }
    if (!form.amount || Number(form.amount) <= 0) { setError('Enter a valid amount.'); return }
    setPending(true)
    const result = await createPayment(form)
    setPending(false)
    if (!result.ok) { setError(result.error ?? 'Could not record the payment.'); return }
    notify('success', result.message ?? 'Payment recorded.')
    setOpen(false); reset(); router.refresh()
  }

  return (
    <>
      <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setOpen(true)} className={className}>{label}</Button>
      <Modal
        open={open} onClose={() => { setOpen(false); reset() }}
        title="Record a payment" description="Add a payment obligation for a creator's completed work."
        footer={(
          <div className="flex w-full justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setOpen(false); reset() }}>Cancel</Button>
            <Button size="sm" loading={pending} onClick={submit}>Record payment</Button>
          </div>
        )}
      >
        <form onSubmit={event => { event.preventDefault(); void submit() }} className="space-y-3">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <Select
            label="Creator" required value={form.creatorId} onChange={e => setForm(f => ({ ...f, creatorId: e.target.value }))}
            options={[{ value: '', label: 'Select a creator' }, ...creators.map(c => ({ value: c.id, label: `${c.name}${c.handle ? ` (@${c.handle})` : ''}` }))]}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Amount (GBP)" type="number" min={0} required value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            <Select
              label="Payment method" value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
              options={[{ value: '', label: 'Not set' }, ...PAYMENT_METHODS.map(m => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))]}
            />
          </div>
          <Input label="Invoice number (optional)" value={form.invoiceNumber} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} />
        </form>
      </Modal>
    </>
  )
}

export function CreatePaymentBatchButton({
  eligible, label = 'Create Payment Batch', className,
}: { eligible: EligiblePayment[]; label?: string; className?: string }) {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  const readyPayments = useMemo(() => eligible.filter(p => p.blockedReasons.length === 0), [eligible])
  const selectedPayments = useMemo(() => eligible.filter(p => selected.includes(p.id)), [eligible, selected])
  const total = useMemo(() => selectedPayments.reduce((sum, p) => sum + Number(p.amount), 0), [selectedPayments])
  const currency = selectedPayments[0]?.currency ?? 'GBP'
  const dirty = selected.length > 0

  function reset() { setName(''); setScheduledFor(''); setSelected([]); setSubmitError(null) }
  function toggle(id: string) { setSelected(list => (list.includes(id) ? list.filter(v => v !== id) : [...list, id])) }
  function selectAllReady() { setSelected(readyPayments.map(p => p.id)) }

  async function submit(): Promise<boolean> {
    setSubmitting(true)
    setSubmitError(null)
    const result = await createPaymentBatch({
      name, paymentIds: selected, scheduledFor,
      idempotencyKey: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    })
    setSubmitting(false)
    if (!result.ok) { setSubmitError(result.error ?? 'Could not create the batch.'); return false }
    notify('success', result.message ?? 'Payment batch created.')
    setOpen(false); reset(); router.refresh()
    return true
  }

  const steps: WizardStepDef[] = [
    {
      id: 'select', label: 'Select Payments', description: `${selected.length} selected`,
      validate: () => (selected.length === 0 ? 'Select at least one payment for this batch.' : null),
      render: () => (
        <WizardSection title="Select payments" description="Only payments that are approved, tax-clear and payout-ready can be batched.">
          {eligible.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">No unbatched payments are approved, scheduled or ready to retry right now.</p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12px] text-slate-500">{readyPayments.length} of {eligible.length} ready to batch</p>
                {readyPayments.length > 0 && (
                  <button type="button" onClick={selectAllReady} className="text-[12px] font-medium text-blue-600 hover:underline">Select all ready</button>
                )}
              </div>
              <div className="max-h-80 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {eligible.map(payment => (
                  <label
                    key={payment.id}
                    className={`flex items-start gap-2 rounded-lg px-2 py-2 text-sm ${payment.blockedReasons.length ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-slate-50'}`}
                  >
                    <input
                      type="checkbox" disabled={payment.blockedReasons.length > 0}
                      checked={selected.includes(payment.id)} onChange={() => toggle(payment.id)}
                      className="mt-0.5 rounded border-slate-300"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-slate-800">{payment.creator?.name ?? 'Unknown creator'}</span>
                        <span className="shrink-0 font-semibold text-slate-900">{formatMoney(payment.amount, payment.currency)}</span>
                      </span>
                      {payment.blockedReasons.length > 0
                        ? <span className="mt-0.5 flex items-center gap-1 text-xs text-amber-600"><AlertTriangle size={11} />{payment.blockedReasons.join(' · ')}</span>
                        : <span className="mt-0.5 flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 size={11} />Ready to batch</span>}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
        </WizardSection>
      ),
    },
    {
      id: 'details', label: 'Batch Details', description: 'Name and schedule',
      render: () => (
        <WizardSection title="Batch details">
          <Input label="Batch name" value={name} onChange={e => setName(e.target.value)} placeholder={`Payout batch ${new Date().toLocaleDateString('en-GB')}`} />
          <Input label="Scheduled for" type="date" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)} />
          <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-[13px] text-slate-600">
            {selected.length} payment{selected.length === 1 ? '' : 's'} · <span className="font-semibold text-slate-900">{formatMoney(total, currency)}</span>
          </div>
        </WizardSection>
      ),
    },
    {
      id: 'review', label: 'Review', description: 'Confirm and create',
      render: () => (
        <WizardSection title="Review">
          <div className="rounded-xl border border-slate-200 p-4">
            <WizardSummaryRow label="Batch name" value={name || `Payout batch ${new Date().toLocaleDateString('en-GB')}`} />
            <WizardSummaryRow label="Payments" value={String(selected.length)} />
            <WizardSummaryRow label="Total" value={formatMoney(total, currency)} />
            <WizardSummaryRow label="Scheduled for" value={scheduledFor || 'Not set'} />
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {selectedPayments.map(p => (
              <div key={p.id} className="flex items-center justify-between text-[12.5px] text-slate-600">
                <span className="truncate">{p.creator?.name ?? 'Unknown creator'}</span>
                <span className="font-medium text-slate-800">{formatMoney(p.amount, p.currency)}</span>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-slate-400">Creating this batch moves the selected payments to &quot;Scheduled&quot; and requires approval before payout.</p>
        </WizardSection>
      ),
    },
  ]

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? BUTTON_PRIMARY}><Plus size={16} aria-hidden />{label}</button>
      <WizardShell
        open={open} onClose={() => { setOpen(false); reset() }}
        title="Create a payment batch" subtitle="Group approved, invoiced and tax-ready payments into one payout run."
        steps={steps} onSubmit={submit} submitLabel="Create batch" submitting={submitting} submitError={submitError} dirty={dirty}
      />
    </>
  )
}

export function ApproveBatchButton({ batchId, disabled }: { batchId: string; disabled?: boolean }) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, setPending] = useState(false)

  async function submit() {
    if (pending) return
    setPending(true)
    const result = await approvePaymentBatch(batchId)
    setPending(false)
    if (!result.ok) { notify('error', result.error ?? 'Could not approve the batch.'); return }
    notify('success', result.message ?? 'Batch approved.')
    router.refresh()
  }

  return (
    <Button size="xs" variant="secondary" loading={pending} disabled={disabled} onClick={submit}>Approve</Button>
  )
}
