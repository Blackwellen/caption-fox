'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Archive, Copy, Eye, Loader2, MoreHorizontal, RotateCcw, Rocket, Star, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { useToast } from './Toast'
import { formatMoney, formatShortDate } from './primitives'
import {
  archiveTemplate, createCampaignFromTemplate, duplicateTemplate,
  setTemplateStatus, toggleTemplateFavourite, type ActionResult,
} from '@/app/app/campaigns/actions'
import {
  CHANNEL_LABELS, TEMPLATE_STATUS_BADGE, TEMPLATE_STATUS_LABELS,
  TEMPLATE_TYPE_LABELS, type TemplateStatus,
} from '@/lib/campaigns/constants'
import type { PersonLite, TemplateRow } from '@/lib/campaigns/types'
import type { CampaignCapabilities } from '@/lib/campaigns/entitlements'

const ICON_BTN = 'inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40'
const MENU_ITEM = 'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'
const FIELD = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
const LABEL = 'mb-1 block text-[11px] font-medium text-slate-600'

/** Status transitions the UI offers, mirroring the server-side rules. */
const STATUS_ACTIONS: { intent: 'publish' | 'unpublish' | 'submit_review' | 'approve' | 'request_changes'; label: string; from: string[]; approver?: boolean }[] = [
  { intent: 'submit_review', label: 'Submit for review', from: ['draft'] },
  { intent: 'publish', label: 'Publish', from: ['draft', 'in_review'], approver: true },
  { intent: 'approve', label: 'Approve', from: ['in_review'], approver: true },
  { intent: 'request_changes', label: 'Request changes', from: ['in_review'], approver: true },
  { intent: 'unpublish', label: 'Unpublish', from: ['published'] },
]

export default function TemplateActions({
  template, capabilities, members,
}: { template: TemplateRow; capabilities: CampaignCapabilities; members: PersonLite[] }) {
  const router = useRouter()
  const { notify } = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [preview, setPreview] = useState(false)
  const [useOpen, setUseOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const archived = Boolean(template.archived_at)

  function run(work: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await work()
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Done.') : (result.error ?? 'Something went wrong.'))
      if (result.ok) router.refresh()
      setMenuOpen(false)
    })
  }

  const available = STATUS_ACTIONS.filter(action =>
    action.from.includes(template.status) && (!action.approver || capabilities.publishTemplates))

  return (
    <span className="flex items-center gap-0.5">
      <button
        type="button" onClick={() => setPreview(true)} aria-label={`Preview ${template.name}`}
        className={ICON_BTN} title="Preview template"
      >
        <Eye size={14} />
      </button>

      {capabilities.manageTemplates && (
        <button
          type="button" disabled={pending} title="Duplicate as draft"
          aria-label={`Duplicate ${template.name}`}
          onClick={() => run(() => duplicateTemplate(template.id))}
          className={ICON_BTN}
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Copy size={14} />}
        </button>
      )}

      <div className="relative">
        <button
          type="button" onClick={() => setMenuOpen(open => !open)}
          aria-haspopup="menu" aria-expanded={menuOpen}
          aria-label={`More actions for ${template.name}`}
          className={ICON_BTN}
        >
          <MoreHorizontal size={15} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden />
            <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              {capabilities.create && template.status === 'published' && !archived && (
                <button type="button" role="menuitem" className={MENU_ITEM} onClick={() => { setMenuOpen(false); setUseOpen(true) }}>
                  <Rocket size={14} className="text-slate-400" />
                  Create campaign from template
                </button>
              )}

              {capabilities.manageTemplates && !archived && available.map(action => (
                <button
                  key={action.intent} type="button" role="menuitem" className={MENU_ITEM} disabled={pending}
                  onClick={() => run(() => setTemplateStatus(template.id, action.intent))}
                >
                  <span className="w-3.5" />
                  {action.label}
                </button>
              ))}

              {capabilities.manageTemplates && (
                <button
                  type="button" role="menuitem" className={MENU_ITEM} disabled={pending}
                  onClick={() => run(() => toggleTemplateFavourite(template.id))}
                >
                  <Star size={14} className={cn('text-slate-400', template.is_favourite && 'fill-amber-400 text-amber-400')} />
                  {template.is_favourite ? 'Remove from favourites' : 'Add to favourites'}
                </button>
              )}

              {capabilities.manageTemplates && (
                <button
                  type="button" role="menuitem" className={MENU_ITEM} disabled={pending}
                  onClick={() => run(() => archiveTemplate(template.id, archived))}
                >
                  {archived ? <RotateCcw size={14} className="text-slate-400" /> : <Archive size={14} className="text-slate-400" />}
                  {archived ? 'Restore template' : 'Archive template'}
                </button>
              )}

              {!capabilities.manageTemplates && (
                <p className="px-3 py-2 text-xs text-slate-400">
                  Your role has read-only access to templates.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {preview && (
        <PreviewDialog template={template} onClose={() => setPreview(false)} />
      )}

      {useOpen && (
        <UseTemplateDialog
          template={template} members={members} pending={pending}
          onClose={() => setUseOpen(false)}
          onSubmit={input => startTransition(async () => {
            const result = await createCampaignFromTemplate(template.id, input)
            notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Campaign created.') : (result.error ?? 'Could not create the campaign.'))
            if (result.ok) {
              setUseOpen(false)
              router.refresh()
              if (result.id) router.push(`/app/campaigns/${result.id}`)
            }
          })}
        />
      )}
    </span>
  )
}

function PreviewDialog({ template, onClose }: { template: TemplateRow; onClose: () => void }) {
  const status = template.status as TemplateStatus
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
      <div className="fixed inset-0" onClick={onClose} aria-hidden />
      <div
        role="dialog" aria-modal="true" aria-labelledby="template-preview-title"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-3.5">
          <div>
            <h2 id="template-preview-title" className="text-[15px] font-semibold text-slate-900">{template.name}</h2>
            <p className="text-xs capitalize text-slate-500">
              {template.category.replace(/_/g, ' ')} · {TEMPLATE_TYPE_LABELS[template.template_type] ?? template.template_type}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={16} />
          </button>
        </header>
        <div className="space-y-3 px-5 py-4 text-[13px] text-slate-600">
          <p>{template.description || 'This template has no description yet.'}</p>
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-[11px] text-slate-400">Status</dt>
              <dd className="mt-0.5">
                <Badge variant={TEMPLATE_STATUS_BADGE[status] ?? 'slate'}>
                  {TEMPLATE_STATUS_LABELS[status] ?? template.status}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">Times used</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{template.usage_count}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">Default budget</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{formatMoney(template.default_budget)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">Default duration</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {template.default_duration_days ? `${template.default_duration_days} days` : '—'}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[11px] text-slate-400">Channels</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {template.channels.length
                  ? template.channels.map(channel => CHANNEL_LABELS[channel] ?? channel).join(', ')
                  : 'No channels set'}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[11px] text-slate-400">Last updated</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{formatShortDate(template.updated_at)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}

function UseTemplateDialog({
  template, members, pending, onClose, onSubmit,
}: {
  template: TemplateRow
  members: PersonLite[]
  pending: boolean
  onClose: () => void
  onSubmit: (input: {
    name?: string; owner_id?: string; start_date?: string; end_date?: string
    budget?: string; channels?: string[]; includeMilestones?: boolean
  }) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [name, setName] = useState(`${template.name} — ${new Date().getFullYear()}`)
  const [ownerId, setOwnerId] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + (template.default_duration_days ?? 30) * 86_400_000).toISOString().slice(0, 10),
  )
  const [budget, setBudget] = useState(template.default_budget ? String(template.default_budget) : '')
  const [includeMilestones, setIncludeMilestones] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function submit() {
    if (!name.trim()) { setError('Give the campaign a name.'); return }
    if (endDate < startDate) { setError('The end date cannot be before the start date.'); return }
    setError(null)
    onSubmit({ name, owner_id: ownerId, start_date: startDate, end_date: endDate, budget, includeMilestones })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
      <div className="fixed inset-0" onClick={onClose} aria-hidden />
      <div
        role="dialog" aria-modal="true" aria-labelledby="use-template-title"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-3.5">
          <div>
            <h2 id="use-template-title" className="text-[15px] font-semibold text-slate-900">Create campaign from template</h2>
            <p className="text-xs text-slate-500">
              A new campaign record is created from <strong>{template.name}</strong>. The template itself is unchanged.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={16} />
          </button>
        </header>

        <div className="space-y-3 px-5 py-4">
          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
          )}
          <label className="block">
            <span className={LABEL}>Campaign name <span className="text-red-500">*</span></span>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={140} className={FIELD} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={LABEL}>Owner</span>
              <select value={ownerId} onChange={e => setOwnerId(e.target.value)} className={FIELD}>
                <option value="">Assign to me</option>
                {members.map(member => <option key={member.id} value={member.id}>{member.full_name ?? member.email}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={LABEL}>Budget (GBP)</span>
              <input type="number" min="0" value={budget} onChange={e => setBudget(e.target.value)} className={FIELD} />
            </label>
            <label className="block">
              <span className={LABEL}>Start date</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={FIELD} />
            </label>
            <label className="block">
              <span className={LABEL}>End date</span>
              <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className={FIELD} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-slate-600">
            <input
              type="checkbox" checked={includeMilestones}
              onChange={e => setIncludeMilestones(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Create the template&apos;s brief and launch milestones
          </label>
          <p className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-[12px] text-slate-600">
            Channels ({template.channels.length ? template.channels.map(c => CHANNEL_LABELS[c] ?? c).join(', ') : 'none set'})
            are copied from the template and can be changed on the campaign afterwards.
          </p>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-slate-200 px-3.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button" onClick={submit} disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            Create campaign
          </button>
        </footer>
      </div>
    </div>
  )
}
