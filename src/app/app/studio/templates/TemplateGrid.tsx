'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Star, Copy, CheckCircle2, XCircle, Send } from 'lucide-react'
import { CARD, CARD_SHADOW, OwnerChip, formatShortDate } from '@/components/studio/primitives'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/campaigns/Toast'
import { TEMPLATE_STATUS_BADGE, TEMPLATE_STATUS_LABELS, CHANNEL_LABELS, type TemplateStatus } from '@/lib/studio/constants'
import type { TemplateRow } from '@/lib/studio/types'
import type { ViewMode } from '@/lib/studio/query'
import type { StudioCapabilities } from '@/lib/studio/entitlements'
import { duplicateTemplate, setTemplateStatus, toggleTemplateFavourite, useTemplate as applyTemplate } from './actions'

export default function TemplateGrid({
  rows, view, capabilities,
}: { rows: TemplateRow[]; view: ViewMode; capabilities: StudioCapabilities }) {
  if (view === 'table') return <TemplateTable rows={rows} capabilities={capabilities} />
  return <TemplateCards rows={rows} capabilities={capabilities} />
}

function useTemplateActions(id: string) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()

  function use() {
    startTransition(async () => {
      const result = await applyTemplate({ id })
      if (!result.ok) { notify('error', result.error ?? 'Could not use this template.'); return }
      notify('success', result.message ?? 'Draft created.')
      if (result.id) router.push(`/app/studio/compose?id=${result.id}`)
    })
  }

  function duplicate() {
    startTransition(async () => {
      const result = await duplicateTemplate({ id })
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Duplicated.') : (result.error ?? 'Failed.'))
    })
  }

  function favourite() {
    startTransition(async () => {
      const result = await toggleTemplateFavourite({ id })
      if (!result.ok) notify('error', result.error ?? 'Could not update favourite.')
    })
  }

  function approve() {
    startTransition(async () => {
      const result = await setTemplateStatus({ id, status: 'approved' })
      notify(result.ok ? 'success' : 'error', result.ok ? 'Approved.' : (result.error ?? 'Failed.'))
    })
  }

  function requestChanges() {
    startTransition(async () => {
      const result = await setTemplateStatus({ id, status: 'changes_requested' })
      notify(result.ok ? 'success' : 'error', result.ok ? 'Changes requested.' : (result.error ?? 'Failed.'))
    })
  }

  function publish() {
    startTransition(async () => {
      const result = await setTemplateStatus({ id, status: 'published' })
      notify(result.ok ? 'success' : 'error', result.ok ? 'Published.' : (result.error ?? 'Failed.'))
    })
  }

  return { pending, use, duplicate, favourite, approve, requestChanges, publish }
}

function TemplateActions({ row, capabilities }: { row: TemplateRow; capabilities: StudioCapabilities }) {
  const actions = useTemplateActions(row.id)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {capabilities.viewTemplates && (
        <button type="button" onClick={actions.favourite} title="Favourite" aria-pressed={row.favourite}
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${row.favourite ? 'text-amber-500' : 'text-slate-300 hover:text-slate-500'}`}>
          <Star size={14} fill={row.favourite ? 'currentColor' : 'none'} />
        </button>
      )}
      {capabilities.createTemplates && (
        <button type="button" onClick={actions.duplicate} disabled={actions.pending} title="Duplicate"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50">
          <Copy size={14} />
        </button>
      )}
      {capabilities.approveTemplates && row.status === 'in_review' && (
        <>
          <button type="button" onClick={actions.approve} disabled={actions.pending} title="Approve"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-emerald-500 hover:bg-emerald-50">
            <CheckCircle2 size={14} />
          </button>
          <button type="button" onClick={actions.requestChanges} disabled={actions.pending} title="Request changes"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50">
            <XCircle size={14} />
          </button>
        </>
      )}
      {capabilities.publishTemplates && row.status === 'approved' && (
        <button type="button" onClick={actions.publish} disabled={actions.pending} title="Publish"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-blue-500 hover:bg-blue-50">
          <Send size={14} />
        </button>
      )}
      {capabilities.createContent && row.status !== 'archived' && (
        <button
          type="button" onClick={actions.use} disabled={actions.pending}
          className="inline-flex h-7 items-center rounded-lg bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Use template
        </button>
      )}
    </div>
  )
}

function TemplateCards({ rows, capabilities }: { rows: TemplateRow[]; capabilities: StudioCapabilities }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {rows.map(row => (
        <div key={row.id} className={`${CARD} ${CARD_SHADOW} flex flex-col overflow-hidden`}>
          <div className="flex h-28 w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 p-3 text-center text-sm font-semibold text-white">
            {row.name}
          </div>
          <div className="flex flex-1 flex-col gap-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">
                {(row.platforms ?? []).map(p => CHANNEL_LABELS[p] ?? p).join(', ') || row.channel || '—'}
              </span>
              <Badge variant={TEMPLATE_STATUS_BADGE[row.status as TemplateStatus] ?? 'slate'}>
                {TEMPLATE_STATUS_LABELS[row.status as TemplateStatus] ?? row.status}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400">{row.usage_count} uses</p>
            <div className="mt-auto flex items-center justify-between pt-1">
              <OwnerChip person={row.owner} />
              <span className="text-[11px] text-slate-400">{formatShortDate(row.updated_at)}</span>
            </div>
            <TemplateActions row={row} capabilities={capabilities} />
          </div>
        </div>
      ))}
    </div>
  )
}

function TemplateTable({ rows, capabilities }: { rows: TemplateRow[]; capabilities: StudioCapabilities }) {
  return (
    <div className={`${CARD} ${CARD_SHADOW} overflow-x-auto`}>
      <table className="w-full min-w-[820px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
            <th className="px-4 py-2.5 font-medium">Template</th>
            <th className="px-4 py-2.5 font-medium">Channel</th>
            <th className="px-4 py-2.5 font-medium">Usage</th>
            <th className="px-4 py-2.5 font-medium">Owner</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Updated</th>
            <th className="px-4 py-2.5 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map(row => (
            <tr key={row.id} className="hover:bg-slate-50/60">
              <td className="max-w-[240px] truncate px-4 py-2.5 font-medium text-slate-800">{row.name}</td>
              <td className="px-4 py-2.5 text-slate-500">{(row.platforms ?? []).map(p => CHANNEL_LABELS[p] ?? p).join(', ') || row.channel || '—'}</td>
              <td className="px-4 py-2.5 text-slate-500">{row.usage_count}</td>
              <td className="px-4 py-2.5"><OwnerChip person={row.owner} /></td>
              <td className="px-4 py-2.5">
                <Badge variant={TEMPLATE_STATUS_BADGE[row.status as TemplateStatus] ?? 'slate'}>
                  {TEMPLATE_STATUS_LABELS[row.status as TemplateStatus] ?? row.status}
                </Badge>
              </td>
              <td className="px-4 py-2.5 text-slate-400">{formatShortDate(row.updated_at)}</td>
              <td className="px-4 py-2.5"><TemplateActions row={row} capabilities={capabilities} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
