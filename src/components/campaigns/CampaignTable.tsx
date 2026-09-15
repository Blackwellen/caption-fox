'use client'

import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import CampaignActionsMenu from './CampaignActionsMenu'
import { Avatar, CARD, CARD_SHADOW, ProgressBar, formatMoney, formatNumber, formatShortDate } from './primitives'
import { useToast } from './Toast'
import { bulkUpdateCampaigns } from '@/app/app/campaigns/actions'
import { CAMPAIGN_TYPE_LABELS } from '@/lib/constants'
import {
  HEALTH_BADGE, HEALTH_LABELS, LIFECYCLE_BADGE, LIFECYCLE_LABELS, PRIORITIES,
  PRIORITY_BADGE, PRIORITY_LABELS, BOARD_STAGES, healthLabel,
  type CampaignHealth, type CampaignPriority, type LifecycleStage,
} from '@/lib/campaigns/constants'
import type { CampaignRow, PersonLite } from '@/lib/campaigns/types'
import type { CampaignCapabilities } from '@/lib/campaigns/entitlements'

export type ColumnKey =
  | 'campaign' | 'type' | 'owner' | 'stage' | 'status' | 'priority' | 'progress'
  | 'budget' | 'spend' | 'engagements' | 'due' | 'health' | 'approval' | 'updated'

const COLUMN_LABEL: Record<ColumnKey, string> = {
  campaign: 'Campaign', type: 'Type', owner: 'Owner', stage: 'Stage', status: 'Status',
  priority: 'Priority', progress: 'Progress', budget: 'Budget', spend: 'Spend',
  engagements: 'Engagements', due: 'Due date', health: 'Health', approval: 'Approval', updated: 'Updated',
}

/** Columns the server can sort on, mapped to their two sort directions. */
const COLUMN_SORT: Partial<Record<ColumnKey, [string, string]>> = {
  campaign: ['name_asc', 'name_desc'],
  due: ['due_soonest', 'due_latest'],
  budget: ['budget_desc', 'budget_desc'],
  progress: ['progress_desc', 'progress_desc'],
  priority: ['priority', 'priority'],
  updated: ['updated', 'updated'],
}

const DEFAULT_COLUMNS: ColumnKey[] = [
  'campaign', 'type', 'owner', 'stage', 'status', 'progress', 'budget', 'spend', 'engagements', 'due', 'health',
]

export default function CampaignTable({
  campaigns, capabilities, columns = DEFAULT_COLUMNS, selectable = false,
  members = [], compact = false, bare = false,
  emptyMessage = 'No campaigns match the current filters.',
}: {
  campaigns: CampaignRow[]
  capabilities: CampaignCapabilities
  columns?: ColumnKey[]
  selectable?: boolean
  members?: PersonLite[]
  compact?: boolean
  /** Drops the card chrome when the table already sits inside a Panel. */
  bare?: boolean
  emptyMessage?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const { notify } = useToast()
  const [selected, setSelected] = useState<string[]>([])
  const [pending, startTransition] = useTransition()

  const activeSort = params.get('sort') ?? 'due_soonest'
  const ids = useMemo(() => campaigns.map(c => c.id), [campaigns])
  const allSelected = selected.length > 0 && selected.length === ids.length

  function sortHref(column: ColumnKey): string | null {
    const pair = COLUMN_SORT[column]
    if (!pair) return null
    const next = activeSort === pair[0] ? pair[1] : pair[0]
    const search = new URLSearchParams(params.toString())
    search.set('sort', next)
    search.delete('page')
    return `${pathname}?${search.toString()}`
  }

  function sortIcon(column: ColumnKey) {
    const pair = COLUMN_SORT[column]
    if (!pair) return null
    if (activeSort === pair[0]) return <ArrowUp size={11} className="text-blue-600" />
    if (activeSort === pair[1]) return <ArrowDown size={11} className="text-blue-600" />
    return <ChevronsUpDown size={11} className="text-slate-300 opacity-0 group-hover:opacity-100" />
  }

  function runBulk(patch: Parameters<typeof bulkUpdateCampaigns>[1]) {
    startTransition(async () => {
      const result = await bulkUpdateCampaigns(selected, patch)
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Updated.') : (result.error ?? 'Bulk update failed.'))
      if (result.ok) { setSelected([]); router.refresh() }
    })
  }

  if (campaigns.length === 0) {
    return (
      <div className={cn(!bare && [CARD, CARD_SHADOW], 'px-4 py-10 text-center text-sm text-slate-500')}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={cn(!bare && [CARD, CARD_SHADOW, 'overflow-hidden'])}>
      {selectable && selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-blue-50/60 px-4 py-2">
          <span className="text-[13px] font-medium text-blue-900">
            {selected.length} selected
          </span>
          {capabilities.edit && (
            <>
              <BulkSelect label="Set stage" disabled={pending}
                options={BOARD_STAGES.map(s => ({ value: s, label: LIFECYCLE_LABELS[s] }))}
                onChange={value => runBulk({ lifecycle_stage: value })} />
              <BulkSelect label="Set priority" disabled={pending}
                options={PRIORITIES.map(p => ({ value: p, label: PRIORITY_LABELS[p] }))}
                onChange={value => runBulk({ priority: value })} />
              {members.length > 0 && (
                <BulkSelect label="Assign owner" disabled={pending}
                  options={members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Member' }))}
                  onChange={value => runBulk({ owner_id: value })} />
              )}
            </>
          )}
          {capabilities.archive && (
            <button
              type="button" disabled={pending} onClick={() => runBulk({ archive: true })}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Archive
            </button>
          )}
          <button
            type="button" onClick={() => setSelected([])}
            className="ml-auto text-[13px] font-medium text-blue-600 hover:text-blue-700"
          >
            Clear selection
          </button>
          {pending && <Loader2 size={14} className="animate-spin text-blue-600" />}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <caption className="sr-only">Campaign records for the current workspace and filters</caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60">
              {selectable && (
                <th scope="col" className="w-9 px-3 py-2">
                  <input
                    type="checkbox" checked={allSelected} aria-label="Select all campaigns on this page"
                    onChange={e => setSelected(e.target.checked ? ids : [])}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
              )}
              {columns.map(column => {
                const href = sortHref(column)
                return (
                  <th
                    key={column} scope="col"
                    className={cn(
                      'group whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500',
                      ['budget', 'spend', 'engagements'].includes(column) && 'text-right',
                    )}
                  >
                    {href ? (
                      <Link href={href} scroll={false} className="inline-flex items-center gap-1 hover:text-slate-700">
                        {COLUMN_LABEL[column]}
                        {sortIcon(column)}
                      </Link>
                    ) : COLUMN_LABEL[column]}
                  </th>
                )
              })}
              <th scope="col" className="w-10 px-3 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {campaigns.map(campaign => {
              const stage = campaign.lifecycle_stage as LifecycleStage
              const health = healthLabel(campaign.health, campaign.end_date)
              const checked = selected.includes(campaign.id)
              return (
                <tr key={campaign.id} className={cn('transition-colors hover:bg-slate-50/70', checked && 'bg-blue-50/40')}>
                  {selectable && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox" checked={checked}
                        aria-label={`Select ${campaign.name}`}
                        onChange={e => setSelected(list => e.target.checked
                          ? [...list, campaign.id]
                          : list.filter(id => id !== campaign.id))}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                  )}
                  {columns.map(column => (
                    <td key={column} className={cn('px-3 text-[13px] text-slate-600', compact ? 'py-1.5' : 'py-2.5')}>
                      {renderCell(column, campaign, stage, health)}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <CampaignActionsMenu
                      campaignId={campaign.id} name={campaign.name} stage={campaign.lifecycle_stage}
                      archived={Boolean(campaign.archived_at)} capabilities={capabilities}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function renderCell(
  column: ColumnKey, campaign: CampaignRow, stage: LifecycleStage,
  health: { label: string; variant: 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'slate' | 'default' | 'outline' },
) {
  switch (column) {
    case 'campaign':
      return (
        <Link href={`/app/campaigns/${campaign.id}`} className="font-medium text-slate-900 hover:text-blue-600">
          {campaign.name}
        </Link>
      )
    case 'type':
      return CAMPAIGN_TYPE_LABELS[campaign.campaign_type] ?? campaign.campaign_type
    case 'owner':
      return (
        <span className="flex items-center gap-1.5">
          <Avatar person={campaign.owner} size={18} />
          <span className="truncate">{campaign.owner?.full_name ?? campaign.owner?.email ?? 'Unassigned'}</span>
        </span>
      )
    case 'stage':
      return <Badge variant={LIFECYCLE_BADGE[stage] ?? 'slate'}>{LIFECYCLE_LABELS[stage] ?? campaign.lifecycle_stage}</Badge>
    case 'status':
      return (
        <Badge variant={HEALTH_BADGE[campaign.health as CampaignHealth] ?? 'slate'}>
          {HEALTH_LABELS[campaign.health as CampaignHealth] ?? campaign.health}
        </Badge>
      )
    case 'priority':
      return (
        <Badge variant={PRIORITY_BADGE[campaign.priority as CampaignPriority] ?? 'slate'}>
          {PRIORITY_LABELS[campaign.priority as CampaignPriority] ?? campaign.priority}
        </Badge>
      )
    case 'progress':
      return (
        <span className="flex min-w-[110px] items-center gap-2">
          <span className="w-8 shrink-0 text-xs font-medium text-slate-700">{campaign.progress}%</span>
          <ProgressBar value={campaign.progress} health={campaign.health} className="w-16" label={`${campaign.name} progress`} />
        </span>
      )
    case 'budget':
      return <span className="block text-right tabular-nums">{formatMoney(campaign.budget, campaign.currency ?? 'GBP')}</span>
    case 'spend':
      return <span className="block text-right tabular-nums">{formatMoney(campaign.actual_spend, campaign.currency ?? 'GBP')}</span>
    case 'engagements':
      return <span className="block text-right tabular-nums">{formatNumber(campaign.engagements)}</span>
    case 'due':
      return <span className="whitespace-nowrap">{formatShortDate(campaign.end_date)}</span>
    case 'health':
      return <Badge variant={health.variant}>{health.label}</Badge>
    case 'approval':
      return <span className="capitalize">{campaign.approval_status.replace('_', ' ')}</span>
    case 'updated':
      return <span className="whitespace-nowrap">{formatShortDate(campaign.updated_at)}</span>
    default:
      return null
  }
}

function BulkSelect({
  label, options, onChange, disabled,
}: { label: string; options: { value: string; label: string }[]; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <select
      defaultValue="" disabled={disabled} aria-label={label}
      onChange={e => { if (e.target.value) { onChange(e.target.value); e.target.value = '' } }}
      className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[13px] font-medium text-slate-600 disabled:opacity-50"
    >
      <option value="">{label}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
