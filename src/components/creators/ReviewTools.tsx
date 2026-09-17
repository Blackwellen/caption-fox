'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/campaigns/Toast'
import {
  raiseSubmissionIssue, reassignReviewer, resolveSubmissionIssue, respondUsageRequest,
} from '@/lib/creators/actions'
import { ISSUE_CATEGORIES, ISSUE_CATEGORY_LABELS } from '@/lib/creators/constants'

type Result = { ok: boolean; error?: string; message?: string }

function useRun() {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const run = (action: () => Promise<Result>, after?: () => void) => startTransition(async () => {
    const result = await action()
    notify(result.ok ? 'success' : 'error', result.ok ? result.message ?? 'Updated.' : result.error ?? 'Something went wrong.')
    if (result.ok) after?.()
    router.refresh()
  })
  return { run, pending }
}

/** Flags a review issue. Reviewer-raised issues are recorded as confirmed-by-a-person. */
export function FlagIssueButton({ submissionId }: { submissionId: string }) {
  const { run, pending } = useRun()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ category: 'brand_guideline', severity: 'medium', detail: '' })
  return (
    <>
      <Button variant="secondary" size="sm" icon={<Flag size={14} />} className="w-full justify-center" onClick={() => setOpen(true)}>Flag an issue</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Flag an issue" description="Issues are visible to reviewers and block approval until confirmed, dismissed or resolved."
        footer={<div className="flex w-full justify-end gap-2"><Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button><Button size="sm" loading={pending} onClick={() => run(() => raiseSubmissionIssue({ submissionId, ...form }), () => { setOpen(false); setForm({ category: 'brand_guideline', severity: 'medium', detail: '' }) })}>Flag issue</Button></div>}>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              options={ISSUE_CATEGORIES.map(c => ({ value: c, label: ISSUE_CATEGORY_LABELS[c] }))} />
            <Select label="Severity" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
              options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} />
          </div>
          <Textarea label="Detail (shared with reviewers)" rows={3} maxLength={1000} value={form.detail} onChange={e => setForm(f => ({ ...f, detail: e.target.value }))} placeholder="e.g. #ad disclosure missing from the first frame" />
        </div>
      </Modal>
    </>
  )
}

/** Confirm, dismiss or resolve one open issue. Automated detections need a person to confirm. */
export function IssueActions({ issueId, submissionId, status, source }: { issueId: string; submissionId: string; status: string; source: string }) {
  const { run, pending } = useRun()
  if (!['open', 'confirmed'].includes(status)) return null
  const act = (next: 'confirmed' | 'dismissed' | 'resolved') => run(() => resolveSubmissionIssue(issueId, submissionId, next))
  return (
    <span className="flex shrink-0 items-center gap-1">
      {status === 'open' && source === 'automated' && (
        <button type="button" disabled={pending} onClick={() => act('confirmed')} className="rounded px-1.5 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-50">Confirm</button>
      )}
      {status === 'open' && (
        <button type="button" disabled={pending} onClick={() => act('dismissed')} className="rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100">Dismiss</button>
      )}
      <button type="button" disabled={pending} onClick={() => act('resolved')} className="rounded px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50">Resolve</button>
    </span>
  )
}

export function ReassignReviewer({
  submissionId, current, reviewers,
}: { submissionId: string; current: string | null; reviewers: { id: string; name: string }[] }) {
  const { run, pending } = useRun()
  return (
    <Select label="Reviewer" value={current ?? ''} disabled={pending}
      onChange={e => { if (e.target.value) run(() => reassignReviewer(submissionId, e.target.value)) }}
      options={[{ value: '', label: 'Unassigned' }, ...reviewers.map(r => ({ value: r.id, label: r.name }))]} />
  )
}

/** Record the creator's answer to a usage-rights request. */
export function UsageRequestActions({ id, status, currency }: { id: string; status: string; currency: string }) {
  const { run, pending } = useRun()
  const [countering, setCountering] = useState(false)
  const [fee, setFee] = useState('')
  if (!['sent', 'countered'].includes(status)) return null
  if (countering) {
    return (
      <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); run(() => respondUsageRequest({ id, response: 'countered', counterFee: fee }), () => setCountering(false)) }}>
        <Input label={`Counter fee (${currency})`} type="number" min={0} step="0.01" required value={fee} onChange={e => setFee(e.target.value)} />
        <Button size="sm" type="submit" loading={pending}>Save</Button>
        <Button size="sm" variant="secondary" type="button" onClick={() => setCountering(false)}>Cancel</Button>
      </form>
    )
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Button size="xs" loading={pending} onClick={() => run(() => respondUsageRequest({ id, response: 'accepted' }))}>Creator accepted</Button>
      <Button size="xs" variant="secondary" disabled={pending} onClick={() => setCountering(true)}>Counter-offer</Button>
      <Button size="xs" variant="secondary" disabled={pending} onClick={() => { if (window.confirm('Mark this request as declined by the creator?')) run(() => respondUsageRequest({ id, response: 'declined' })) }}>Declined</Button>
    </span>
  )
}
