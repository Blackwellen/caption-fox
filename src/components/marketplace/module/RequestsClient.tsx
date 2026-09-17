'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, MoreHorizontal, Loader2, Download } from 'lucide-react'
import { cn, formatRelative } from '@/lib/utils'
import type { MarketplaceCategory, MarketplaceProfile, MarketplaceRequest, MarketplaceProposal } from '@/lib/marketplace/module'
import { REQUEST_STATUS_META, PROPOSAL_STATUS_META, money, deadlineState, MODULE_ROUTES } from '@/lib/marketplace/module'
import { setRequestStatus, setProposalStatus } from '@/lib/marketplace/actions'
import NewRequestWizard from './NewRequestWizard'
import { ProfileAvatar, StatusPill } from './primitives'

/** "New request" launcher — kept client-side so the wizard can own its own state. */
export function NewRequestButton({
  categories, suppliers, canCreate, canInvite, defaultKind, onBlue = false,
}: {
  categories: MarketplaceCategory[]
  suppliers: MarketplaceProfile[]
  canCreate: boolean
  canInvite: boolean
  defaultKind?: 'discovery' | 'rfq'
  /** White treatment for placement on the blue search hero. */
  onBlue?: boolean
}) {
  const [open, setOpen] = useState(Boolean(defaultKind))

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!canCreate}
        title={canCreate ? 'Create a marketplace request' : 'Your role cannot create requests'}
        className={cn('inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition',
          onBlue ? 'h-11 bg-white text-blue-700 hover:bg-blue-50 lg:h-10 lg:text-[11px]' : 'text-white',
          !onBlue && (canCreate ? 'bg-blue-600 hover:bg-blue-700' : 'cursor-not-allowed bg-slate-300'),
          onBlue && !canCreate && 'cursor-not-allowed opacity-60')}
      >
        <Plus size={15} />New request
      </button>
      <NewRequestWizard
        open={open} onClose={() => setOpen(false)}
        categories={categories} suppliers={suppliers}
        canInvite={canInvite} defaultKind={defaultKind}
      />
    </>
  )
}

/** Row-level status actions with a confirm step on the irreversible ones. */
export function RequestActions({
  request, canEdit, canClose,
}: {
  request: MarketplaceRequest
  canEdit: boolean
  canClose: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const closed = request.status.startsWith('closed')

  function run(status: Parameters<typeof setRequestStatus>[1]) {
    setError(null)
    start(async () => {
      const result = await setRequestStatus(request.id, status)
      if (!result.ok) setError(result.error ?? 'Could not update the request.')
      else { setOpen(false); router.refresh() }
    })
  }

  const actions = [
    { label: 'Mark as shortlisted', status: 'shortlisted' as const, show: canEdit && !closed && request.status !== 'shortlisted' },
    { label: 'Mark as awaiting proposals', status: 'awaiting_proposals' as const, show: canEdit && !closed && request.status !== 'awaiting_proposals' },
    { label: 'Close as won', status: 'closed_won' as const, show: canClose && !closed, danger: false },
    { label: 'Cancel request', status: 'closed_cancelled' as const, show: canClose && !closed, danger: true },
  ].filter(action => action.show)

  if (actions.length === 0) return null

  return (
    <div className="relative">
      <button
        type="button" onClick={() => setOpen(value => !value)}
        aria-expanded={open} aria-haspopup="menu"
        aria-label={`Actions for ${request.title}`}
        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 lg:p-0.5 [&>svg]:lg:h-3.5 [&>svg]:lg:w-3.5"
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : <MoreHorizontal size={15} />}
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-10 cursor-default" aria-hidden="true" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {actions.map(action => (
              <button
                key={action.status} type="button" role="menuitem" disabled={pending}
                onClick={() => run(action.status)}
                className={cn('block w-full px-3 py-2 text-left text-xs hover:bg-slate-50',
                  action.danger ? 'text-red-600' : 'text-slate-700')}
              >
                {action.label}
              </button>
            ))}
            {error && <p className="px-3 py-2 text-[11px] text-red-600">{error}</p>}
          </div>
        </>
      )}
    </div>
  )
}

/** Proposal evaluation controls used by the comparison strip. */
export function ProposalActions({
  proposal, canEvaluate,
}: {
  proposal: MarketplaceProposal
  canEvaluate: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  if (!canEvaluate) return null

  function run(status: Parameters<typeof setProposalStatus>[1]) {
    start(async () => {
      await setProposalStatus(proposal.id, status)
      router.refresh()
    })
  }

  return (
    <div className="mt-2 flex items-center gap-1.5">
      <button
        type="button" disabled={pending || proposal.status === 'shortlisted'}
        onClick={() => run('shortlisted')}
        className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
      >
        {pending ? '…' : 'Shortlist'}
      </button>
      <button
        type="button" disabled={pending || proposal.status === 'accepted'}
        onClick={() => run('accepted')}
        className="flex-1 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-40"
      >
        Accept
      </button>
    </div>
  )
}

/** CSV export of the requests currently shown, honouring filters and columns. */
export function ExportRequests({ rows, canExport }: { rows: MarketplaceRequest[]; canExport: boolean }) {
  const [busy, setBusy] = useState(false)

  function onExport() {
    if (!canExport || busy) return
    setBusy(true)
    try {
      const header = ['ID', 'Type', 'Project title', 'Category', 'Budget min', 'Budget max', 'Invited', 'Responses', 'Deadline', 'Status', 'Updated']
      const lines = rows.map(row => [
        row.reference, row.kind, row.title, row.category ?? '',
        row.budget_min_cents !== null ? (row.budget_min_cents / 100).toFixed(2) : '',
        row.budget_max_cents !== null ? (row.budget_max_cents / 100).toFixed(2) : '',
        String(row.invited_count), String(row.response_count),
        row.deadline ?? '', row.status, row.updated_at,
      ])
      const csv = [header, ...lines]
        .map(cells => cells.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\r\n')
      const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `marketplace-requests-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button" onClick={onExport} disabled={!canExport || rows.length === 0}
      title={canExport ? 'Export the current view to CSV' : 'Your role cannot export marketplace data'}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download size={13} />Export
    </button>
  )
}

/** Card view of a request, matching the approved card layout. */
export function RequestCard({
  request, canEdit, canClose,
}: {
  request: MarketplaceRequest
  canEdit: boolean
  canClose: boolean
}) {
  const meta = REQUEST_STATUS_META[request.status]
  const due = deadlineState(request.deadline)

  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 lg:p-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold lg:text-[8.5px]',
          request.kind === 'rfq' ? 'bg-sky-50 text-sky-700' : 'bg-violet-50 text-violet-700')}>
          {request.kind === 'rfq' ? 'RFQ' : 'Discovery'}
        </span>
        <div className="flex items-center gap-1">
          <StatusPill label={meta.label} cls={meta.cls} />
          <RequestActions request={request} canEdit={canEdit} canClose={canClose} />
        </div>
      </div>

      <h3 className="mt-2.5 truncate text-sm font-semibold text-slate-900 lg:mt-1.5 lg:text-[11px]">{request.title}</h3>
      <p className="mt-0.5 truncate text-xs text-slate-500 lg:text-[9px]">{request.category ?? 'Uncategorised'}</p>
      <p className="mt-1.5 text-sm font-semibold text-slate-900 lg:mt-1 lg:text-[10.5px]">
        {money(request.budget_min_cents)} – {money(request.budget_max_cents)}
      </p>

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-[11px] lg:mt-2 lg:grid-cols-[1.25fr_0.75fr_1fr] lg:gap-1.5 lg:pt-2 lg:text-[8.5px]">
        <div className="min-w-0">
          <dt className="text-slate-400">Invited</dt>
          <dd className="mt-1 flex -space-x-1.5 lg:mt-0.5">
            {request.invited_profiles.slice(0, 3).map(profile => (
              <ProfileAvatar
                key={profile.id}
                profile={{ ...profile, slug: profile.id, avatar_url: profile.avatar_url }}
                size={18}
              />
            ))}
            {request.invited_count > Math.min(3, request.invited_profiles.length) && (
              <span className="flex h-[22px] items-center rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-600 ring-2 ring-white lg:h-[18px] lg:px-1 lg:text-[8px]">
                +{request.invited_count - Math.min(3, request.invited_profiles.length)}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Responses</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900 lg:mt-0.5 lg:text-[10.5px]">{request.response_count}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Deadline</dt>
          <dd className="mt-1 truncate text-xs font-medium text-slate-800 lg:mt-0.5 lg:text-[9px]">
            {request.deadline
              ? new Date(request.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })
              : '—'}
          </dd>
          <dd className={cn('truncate whitespace-nowrap text-[10px] font-medium lg:text-[8px]',
            due.tone === 'danger' ? 'text-red-600' : due.tone === 'warn' ? 'text-amber-600' : 'text-slate-400')}>
            {due.label}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 lg:mt-2 lg:pt-1.5">
        <Link
          href={`${MODULE_ROUTES.requests}?q=${encodeURIComponent(request.reference)}`}
          className="text-xs font-medium text-blue-600 hover:text-blue-700 lg:text-[9.5px]"
        >
          View details
        </Link>
        <span className="text-[11px] text-slate-400 lg:text-[8.5px]">{formatRelative(request.updated_at)}</span>
      </div>
    </article>
  )
}

/** Proposal comparison strip shown beneath the requests table. */
export function ProposalComparison({
  proposals, canEvaluate,
}: {
  proposals: MarketplaceProposal[]
  canEvaluate: boolean
}) {
  if (proposals.length === 0) {
    return <p className="p-5 text-xs text-slate-500">Supplier responses appear here once proposals are submitted.</p>
  }

  return (
    <div className="overflow-x-auto p-4">
      <ul className="flex min-w-max gap-3">
        {proposals.map(proposal => {
          const meta = PROPOSAL_STATUS_META[proposal.status]
          return (
            <li key={proposal.id} className="w-64 shrink-0 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                {proposal.supplier && <ProfileAvatar profile={proposal.supplier} size={30} />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-900">{proposal.supplier?.display_name}</p>
                  <p className="truncate text-[11px] text-slate-400">{proposal.request_title}</p>
                </div>
              </div>
              <div className="mt-2.5 flex items-end justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">{money(proposal.amount_cents, proposal.currency)}</p>
                  <p className="text-[11px] text-slate-500">{proposal.delivery_days ?? '—'} days</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-emerald-600">{proposal.match_score}%</p>
                  <p className="text-[10px] text-slate-400">Match score</p>
                </div>
              </div>
              <div className="mt-2">
                <StatusPill label={meta.label} cls={meta.cls} />
              </div>
              <ProposalActions proposal={proposal} canEvaluate={canEvaluate} />
            </li>
          )
        })}
      </ul>
      <p className="mt-3 px-1 text-[11px] text-slate-400">
        Match score weights price competitiveness (30%), supplier capability (30%), availability (20%) and rating (20%)
        against the other proposals on the same request.
      </p>
    </div>
  )
}
