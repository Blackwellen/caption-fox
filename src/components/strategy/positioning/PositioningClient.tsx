'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronDown, Download, FileSpreadsheet, MoreVertical, Plus, PlusCircle, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  addClaim, addProofPoint, createFramework, decideApproval, makeFrameworkPrimary, sendApprovalReminder, setFrameworkArchived,
  setMatrixScore, setProofVerification, submitFrameworkForApproval, updateFramework,
} from '@/lib/strategy/actions/positioning'
import {
  IMPACT_LEVELS, IMPACT_SHORT, MARKET_LABELS, MATRIX_SCORE_LABELS, MATRIX_SCORE_NEXT, PROOF_CATEGORIES, PROOF_CATEGORY_LABELS,
  RISK_LEVELS, RISK_LABELS, STRATEGY_MARKETS, VERIFICATION_LABELS, VERIFICATION_STATES, type MatrixScore,
} from '@/lib/strategy/constants'
import type { FrameworkRow, PersonLite } from '@/lib/strategy/types'
import type { ActionResult } from '@/lib/strategy/action-types'
import { BUTTON, ICON } from '../buttons'
import { Menu } from '../client/menu'
import { ConfirmDialog, Dialog, DialogButton } from '../client/dialog'
import { FormError, FormGrid, formValues, SelectField, TextArea, TextField } from '../client/fields'
import { useStrategyAction } from '../client/use-action'

interface Can { create: boolean; edit: boolean; approve: boolean; export: boolean }
interface Option { id: string; name: string }

/** Submits a form to a server action, mapping field errors back onto inputs. */
function useForm(action: (values: Record<string, string>) => Promise<ActionResult>, onDone: () => void) {
  const { run, pending } = useStrategyAction()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = formValues(event.currentTarget)
    const result = await run(() => action(values))
    if (result.ok) { setFieldErrors({}); setFormError(null); onDone() }
    else { setFieldErrors(result.fieldErrors ?? {}); setFormError(result.fieldErrors ? null : result.error ?? null) }
  }
  return { submit, pending, fieldErrors, formError }
}

export function PositioningHeaderActions({
  frameworks, primaryId, audiences, people, research, can,
}: { frameworks: Option[]; primaryId: string | null; audiences: Option[]; people: PersonLite[]; research: Option[]; can: Can }) {
  const params = useSearchParams()
  const [open, setOpen] = useState<'framework' | 'proof' | 'submit' | null>(null)
  const [claimOpen, setClaimOpen] = useState(false)
  const exportHref = (format: string) => {
    const qs = new URLSearchParams(params.toString())
    qs.set('module', 'positioning'); qs.set('format', format)
    return `/api/strategy/export?${qs}`
  }
  const close = () => setOpen(null)
  const selected = params.get('framework') || primaryId || frameworks[0]?.id || ''

  const framework = useForm(values => createFramework(values), close)
  const proof = useForm(values => addProofPoint(values), close)
  const submitForm = useForm(values => submitFrameworkForApproval(values), close)

  return (
    <>
      {can.create && <button type="button" className={BUTTON.primary} onClick={() => setOpen('framework')}><PlusCircle aria-hidden className={ICON} /> New framework</button>}
      {can.edit && frameworks.length > 0 && <button type="button" className={BUTTON.secondary} onClick={() => setOpen('proof')}><Plus aria-hidden className={ICON} /> Add proof point</button>}
      {can.edit && frameworks.length > 0 && <button type="button" className={BUTTON.secondary} onClick={() => setOpen('submit')}><Send aria-hidden className={ICON} /> Submit for approval</button>}
      {can.export && (
        <Menu label="Export" items={[
          { id: 'csv', label: 'Export CSV', description: 'Frameworks, proof points and claims', icon: <FileSpreadsheet className="h-3.5 w-3.5" />, href: exportHref('csv'), download: true },
          { id: 'json', label: 'Export JSON', icon: <Download className="h-3.5 w-3.5" />, href: exportHref('json'), download: true },
        ]} trigger={({ ref, toggle, open: isOpen, ...aria }) => (
          <button ref={ref} type="button" onClick={toggle} {...aria} className={BUTTON.secondary}>
            <Download aria-hidden className={ICON} /> Export
            <ChevronDown aria-hidden className={cn(ICON, 'ml-2 text-slate-500 transition-transform lg:ml-[9px]', isOpen && 'rotate-180')} />
          </button>
        )} />
      )}
      <Menu label="More actions" items={[
        { id: 'claims', label: 'Add claim for risk review', disabled: !can.edit || frameworks.length === 0, disabledReason: 'Your role cannot add claims', onSelect: () => setClaimOpen(true) },
        { id: 'archived', label: 'View archived frameworks', href: '?view=table&archived=1' },
      ]} trigger={({ ref, toggle, ...aria }) => (
        <button ref={ref} type="button" onClick={toggle} {...aria} aria-label="More actions" className={BUTTON.icon}><MoreVertical aria-hidden className={ICON} /></button>
      )} />

      <Dialog open={open === 'framework'} onClose={close} busy={framework.pending} size="lg" title="New positioning framework" description="Frameworks start as drafts and go through review, legal and leadership sign-off."
        footer={<><DialogButton onClick={close}>Cancel</DialogButton><DialogButton variant="primary" type="submit" form="sg-new-framework" disabled={framework.pending}>Create framework</DialogButton></>}>
        <FormError message={framework.formError} />
        <form id="sg-new-framework" onSubmit={framework.submit} noValidate>
          <FormGrid>
            <TextField className="sm:col-span-2" label="Framework name" name="name" required maxLength={80} error={framework.fieldErrors.name} />
            <TextField className="sm:col-span-2" label="Category promise" name="category_promise" maxLength={240} error={framework.fieldErrors.category_promise} />
            <SelectField label="Target audience" name="target_audience_id" placeholder="Choose later" options={audiences.map(item => ({ value: item.id, label: item.name }))} />
            <SelectField label="Market" name="market" placeholder="Not set" options={STRATEGY_MARKETS.map(value => ({ value, label: MARKET_LABELS[value] }))} />
            <TextArea className="sm:col-span-2" label="Positioning statement" name="positioning_statement" maxLength={600} error={framework.fieldErrors.positioning_statement} />
            <TextField className="sm:col-span-2" label="Foundation" name="foundation" maxLength={240} />
          </FormGrid>
        </form>
      </Dialog>

      <Dialog open={open === 'proof'} onClose={close} busy={proof.pending} title="Add proof point" description="Link evidence from the research library to move it into review."
        footer={<><DialogButton onClick={close}>Cancel</DialogButton><DialogButton variant="primary" type="submit" form="sg-new-proof" disabled={proof.pending}>Add proof point</DialogButton></>}>
        <FormError message={proof.formError} />
        <form id="sg-new-proof" onSubmit={proof.submit} noValidate>
          <FormGrid>
            <SelectField className="sm:col-span-2" label="Framework" name="framework_id" required defaultValue={selected} options={frameworks.map(item => ({ value: item.id, label: item.name }))} />
            <TextField className="sm:col-span-2" label="Proof point" name="label" required maxLength={120} error={proof.fieldErrors.label} />
            <SelectField label="Category" name="category" defaultValue="trust" options={PROOF_CATEGORIES.map(value => ({ value, label: PROOF_CATEGORY_LABELS[value] }))} />
            <SelectField label="Impact" name="impact" defaultValue="medium" options={IMPACT_LEVELS.map(value => ({ value, label: IMPACT_SHORT[value] }))} />
            <SelectField className="sm:col-span-2" label="Evidence" name="evidence_research_id" placeholder="No evidence yet" options={research.map(item => ({ value: item.id, label: item.name }))} />
          </FormGrid>
        </form>
      </Dialog>

      <Dialog open={open === 'submit'} onClose={close} busy={submitForm.pending} size="lg" title="Submit for approval" description="Each stage is decided in order: review, legal review, then leadership."
        footer={<><DialogButton onClick={close}>Cancel</DialogButton><DialogButton variant="primary" type="submit" form="sg-submit-framework" disabled={submitForm.pending}>Submit</DialogButton></>}>
        <FormError message={submitForm.formError} />
        <form id="sg-submit-framework" onSubmit={submitForm.submit} noValidate>
          <FormGrid>
            <SelectField className="sm:col-span-2" label="Framework" name="framework_id" required defaultValue={selected} options={frameworks.map(item => ({ value: item.id, label: item.name }))} />
            {([['reviewer_id', 'Reviewer'], ['legal_id', 'Legal reviewer'], ['leadership_id', 'Leadership approver']] as const).map(([name, label]) => (
              <SelectField key={name} label={label} name={name} required placeholder="Choose a member" error={submitForm.fieldErrors[name]}
                options={people.map(person => ({ value: person.id, label: person.full_name ?? person.email ?? 'Member' }))} />
            ))}
            <TextField label="Due date" name="due_date" type="date" error={submitForm.fieldErrors.due_date} />
          </FormGrid>
        </form>
      </Dialog>

      <ClaimDialog open={claimOpen} onClose={() => setClaimOpen(false)} frameworks={frameworks} selected={selected} />
    </>
  )
}

function ClaimDialog({ open, onClose, frameworks, selected }: { open: boolean; onClose: () => void; frameworks: Option[]; selected: string }) {
  const form = useForm(values => addClaim(values), onClose)
  return (
    <Dialog open={open} onClose={onClose} busy={form.pending} title="Add claim" description="Claims are assessed for substantiation risk before use in market."
      footer={<><DialogButton onClick={onClose}>Cancel</DialogButton><DialogButton variant="primary" type="submit" form="sg-new-claim" disabled={form.pending}>Add claim</DialogButton></>}>
      <FormError message={form.formError} />
      <form id="sg-new-claim" onSubmit={form.submit} noValidate>
        <FormGrid>
          <SelectField className="sm:col-span-2" label="Framework" name="framework_id" required defaultValue={selected} options={frameworks.map(item => ({ value: item.id, label: item.name }))} />
          <TextField className="sm:col-span-2" label="Claim" name="claim" required maxLength={160} error={form.fieldErrors.claim} />
          <SelectField label="Risk" name="risk_level" defaultValue="medium" options={RISK_LEVELS.map(value => ({ value, label: RISK_LABELS[value] }))} />
          <TextArea className="sm:col-span-2" label="Rationale" name="rationale" maxLength={500} />
        </FormGrid>
      </form>
    </Dialog>
  )
}

/** One competitor × attribute cell. Click cycles Strong → Moderate → Weak → N/A. */
export function MatrixCell({ competitorId, attributeId, score, canEdit, label }: { competitorId: string; attributeId: string; score: MatrixScore; canEdit: boolean; label: string }) {
  const { run } = useStrategyAction()
  const [value, setValue] = useState<MatrixScore>(score)
  const dot = { strong: 'bg-emerald-500', moderate: 'bg-amber-400', weak: 'bg-red-500', na: 'bg-slate-300' }[value]
  const text = `${label}: ${MATRIX_SCORE_LABELS[value]}`
  if (!canEdit) return <span role="img" aria-label={text} title={text} className={cn('inline-block h-2 w-2 rounded-full', dot)} />
  return (
    <button type="button" aria-label={`${text}. Change score`} title={text}
      onClick={async () => {
        const next = MATRIX_SCORE_NEXT[value]
        setValue(next)
        const result = await run(() => setMatrixScore(competitorId, attributeId, next), { quiet: true })
        if (!result.ok) setValue(value)
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-sg-blue lg:h-4 lg:w-4">
      <span aria-hidden className={cn('h-2 w-2 rounded-full', dot)} />
    </button>
  )
}

export function ApprovalControls({ approvalId, isCurrentApprover, canApprove, canRemind }: { approvalId: string; isCurrentApprover: boolean; canApprove: boolean; canRemind: boolean }) {
  const { run, pending } = useStrategyAction()
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canApprove && isCurrentApprover && (
        <>
          <button type="button" disabled={pending} onClick={() => { void run(() => decideApproval(approvalId, 'approved')) }}
            className="inline-flex h-10 items-center rounded-lg bg-sg-blue px-3 text-[12.5px] font-medium text-white hover:bg-sg-blue-hover disabled:opacity-50 lg:h-[20px] lg:rounded-[5px] lg:px-[12px] lg:text-[9px]">Approve</button>
          <button type="button" disabled={pending} onClick={() => setOpen(true)}
            className="inline-flex h-10 items-center rounded-lg border border-sg-line bg-white px-3 text-[12.5px] font-medium text-sg-body hover:bg-slate-50 lg:h-[20px] lg:rounded-[5px] lg:px-[10px] lg:text-[9px]">Request changes</button>
        </>
      )}
      {canRemind && !isCurrentApprover && (
        <button type="button" disabled={pending} onClick={() => { void run(() => sendApprovalReminder(approvalId)) }}
          className="inline-flex h-10 items-center rounded-lg bg-sg-blue-soft px-4 text-[12.5px] font-medium text-sg-blue hover:bg-[#dfe8ff] disabled:opacity-50 lg:h-[20px] lg:rounded-[5px] lg:px-[22px] lg:text-[9px]">Send reminder</button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} busy={pending} size="sm" title="Request changes" description="The submitter is notified with your comment and the workflow restarts after edits."
        footer={<><DialogButton onClick={() => setOpen(false)}>Cancel</DialogButton><DialogButton variant="primary" disabled={pending || !comment.trim()}
          onClick={async () => { const result = await run(() => decideApproval(approvalId, 'changes_requested', comment)); if (result.ok) { setOpen(false); setComment('') } }}>Send</DialogButton></>}>
        <TextArea label="Comment" name="comment" required maxLength={1000} value={comment} onChange={event => setComment(event.target.value)} />
      </Dialog>
    </div>
  )
}

export function ProofVerificationMenu({ id, label, verification, canApprove }: { id: string; label: string; verification: string; canApprove: boolean }) {
  const { run } = useStrategyAction()
  const tone = verification === 'verified' ? 'text-sg-body' : 'text-sg-muted'
  if (!canApprove) return <span className={cn('text-[12px] lg:text-[9px]', tone)}>{VERIFICATION_LABELS[verification]}</span>
  return (
    <Menu label={`Verification for ${label}`} items={VERIFICATION_STATES.map(state => ({
      id: state, label: VERIFICATION_LABELS[state], selected: state === verification,
      onSelect: () => { void run(() => setProofVerification(id, state)) },
    }))} trigger={({ ref, toggle, ...aria }) => (
      <button ref={ref} type="button" onClick={toggle} {...aria} className={cn('min-h-8 rounded px-1 text-[12px] hover:bg-slate-100 lg:min-h-0 lg:text-[9px]', tone)}>
        {VERIFICATION_LABELS[verification]}
      </button>
    )} />
  )
}

export function FrameworkMenu({ framework, audiences, can }: { framework: FrameworkRow; audiences: Option[]; can: Can }) {
  const { run, pending } = useStrategyAction()
  const [editOpen, setEditOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const form = useForm(values => updateFramework(framework.id, values), () => setEditOpen(false))
  const items = [
    ...(can.edit && !framework.archived_at ? [{ id: 'edit', label: 'Edit framework', onSelect: () => setEditOpen(true) }] : []),
    ...(can.approve && !framework.is_primary && !framework.archived_at ? [{ id: 'primary', label: 'Make primary', onSelect: () => { void run(() => makeFrameworkPrimary(framework.id)) } }] : []),
    { id: 'matrix', label: 'Open full matrix', href: `?view=matrix&framework=${framework.id}` },
    ...(can.edit ? [framework.archived_at
      ? { id: 'restore', label: 'Restore', separatorBefore: true, onSelect: () => { void run(() => setFrameworkArchived(framework.id, false)) } }
      : { id: 'archive', label: 'Archive', separatorBefore: true, disabled: framework.is_primary, disabledReason: 'Make another framework primary first', onSelect: () => setConfirm(true) }] : []),
  ]
  return (
    <>
      <Menu label={`Actions for ${framework.name}`} items={items} trigger={({ ref, toggle, ...aria }) => (
        <button ref={ref} type="button" onClick={toggle} {...aria} aria-label={`Actions for ${framework.name}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 lg:h-5 lg:w-5"><MoreVertical aria-hidden className="h-4 w-4 lg:h-3.5 lg:w-3.5" /></button>
      )} />
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} busy={form.pending} size="lg" title={`Edit “${framework.name}”`}
        description={framework.status === 'approved' ? 'Editing an approved framework creates a new draft version that needs approval again.' : undefined}
        footer={<><DialogButton onClick={() => setEditOpen(false)}>Cancel</DialogButton><DialogButton variant="primary" type="submit" form={`sg-edit-${framework.id}`} disabled={form.pending}>Save</DialogButton></>}>
        <FormError message={form.formError} />
        <form id={`sg-edit-${framework.id}`} onSubmit={form.submit} noValidate>
          <FormGrid>
            <TextField className="sm:col-span-2" label="Framework name" name="name" required maxLength={80} defaultValue={framework.name} error={form.fieldErrors.name} />
            <TextField className="sm:col-span-2" label="Category promise" name="category_promise" maxLength={240} defaultValue={framework.category_promise ?? ''} />
            <SelectField label="Target audience" name="target_audience_id" defaultValue={framework.target_audience_id ?? ''} placeholder="None" options={audiences.map(item => ({ value: item.id, label: item.name }))} />
            <SelectField label="Market" name="market" defaultValue={framework.market ?? ''} placeholder="Not set" options={STRATEGY_MARKETS.map(value => ({ value, label: MARKET_LABELS[value] }))} />
            <TextArea className="sm:col-span-2" label="Positioning statement" name="positioning_statement" rows={4} maxLength={600} defaultValue={framework.positioning_statement ?? ''} error={form.fieldErrors.positioning_statement} />
            <TextField className="sm:col-span-2" label="Foundation" name="foundation" maxLength={240} defaultValue={framework.foundation ?? ''} />
          </FormGrid>
        </form>
      </Dialog>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} busy={pending} title={`Archive “${framework.name}”?`} description="Archived frameworks leave pickers and KPIs but keep their history."
        confirmLabel="Archive" onConfirm={async () => { const result = await run(() => setFrameworkArchived(framework.id, true)); if (result.ok) setConfirm(false) }} />
    </>
  )
}
