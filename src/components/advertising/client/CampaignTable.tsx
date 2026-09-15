'use client'

import Link from 'next/link'
import { useMemo, useState, useSyncExternalStore, useTransition, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { Columns3, Download, Loader2, Pause, Play, X } from 'lucide-react'
import { pauseResumeCampaignAction } from '@/lib/advertising/actions'
import { cn } from '@/lib/utils'
import ProviderLogo from '../ProviderLogo'
import StatusPill, { CAMPAIGN_STATUS, OBJECTIVE_LABELS } from '../StatusPill'
import { KebabMenu } from '../MiniControls'

// The Campaigns table: row selection with a bulk bar (pause / resume / export
// selected), a Columns menu remembered per browser, and row actions.
// Bulk pause/resume goes through the same server action as a single row, one
// campaign at a time, and reports per-row failures rather than hiding them.

export type CampaignTableRow = {
  id: string; name: string; provider: string; objective: string; status: string
  spend: string; budget: string; roas: string; ctr: string; conversions: string
  ownerName: string | null
}

const COLUMNS = [
  { key: 'platform', label: 'Platform' }, { key: 'objective', label: 'Objective' },
  { key: 'spend', label: 'Spend' }, { key: 'budget', label: 'Budget' }, { key: 'roas', label: 'ROAS' },
  { key: 'ctr', label: 'CTR' }, { key: 'conversions', label: 'Conversions' },
  { key: 'status', label: 'Status' }, { key: 'owner', label: 'Owner' },
] as const
type ColumnKey = typeof COLUMNS[number]['key']
const STORAGE_KEY = 'cf.advertising.campaigns.hiddenColumns'
const COLUMNS_EVENT = 'cf:campaign-columns'

function subscribeColumns(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(COLUMNS_EVENT, onChange)
  return () => { window.removeEventListener('storage', onChange); window.removeEventListener(COLUMNS_EVENT, onChange) }
}
function readColumns(): string {
  try { return localStorage.getItem(STORAGE_KEY) ?? '[]' } catch { return '[]' }
}

function initials(name: string | null) {
  return name ? name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() : '—'
}

function csvCell(value: string) {
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export default function CampaignTable({
  rows, basePath, workspaceId, workspaceType, canPause, canBulkEdit, toolbarLeft, toolbarRight, footer,
}: {
  rows: CampaignTableRow[]; basePath: string; workspaceId: string; workspaceType: string
  canPause: boolean; canBulkEdit: boolean; toolbarLeft: ReactNode; toolbarRight: ReactNode; footer: ReactNode
}) {
  const searchParams = useSearchParams()
  // "Bulk Edit" in the header links here with ?bulk=1: start with every visible row selected.
  const [chosen, setSelected] = useState<Set<string>>(() =>
    searchParams.get('bulk') === '1' && canBulkEdit ? new Set(rows.map(row => row.id)) : new Set())
  const [pending, startTransition] = useTransition()
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null)

  // Hidden columns persist per browser. Read through useSyncExternalStore so
  // the server render (nothing hidden) and the client never disagree.
  const storedColumns = useSyncExternalStore(subscribeColumns, readColumns, () => '[]')
  const hidden = useMemo(() => {
    try { return new Set(JSON.parse(storedColumns) as ColumnKey[]) } catch { return new Set<ColumnKey>() }
  }, [storedColumns])

  // Only rows on the current page count as selected, so a new filter or page
  // never carries stale selections into a bulk action.
  const selected = useMemo(() => new Set(rows.map(row => row.id).filter(id => chosen.has(id))), [rows, chosen])

  function toggleColumn(key: ColumnKey) {
    const next = new Set(hidden)
    if (next.has(key)) next.delete(key); else next.add(key)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      window.dispatchEvent(new Event(COLUMNS_EVENT))
    } catch { /* storage unavailable: change applies to nothing persisted */ }
  }

  const show = (key: ColumnKey) => !hidden.has(key)
  const allSelected = rows.length > 0 && selected.size === rows.length
  const selectedRows = rows.filter(row => selected.has(row.id))

  function bulkStatus(target: 'active' | 'paused') {
    const eligible = selectedRows.filter(row => row.status === (target === 'paused' ? 'active' : 'paused'))
    if (eligible.length === 0) {
      setNotice({ text: `None of the selected campaigns can be ${target === 'paused' ? 'paused' : 'resumed'}.`, ok: false })
      return
    }
    setNotice(null)
    startTransition(async () => {
      const failures: string[] = []
      for (const row of eligible) {
        const result = await pauseResumeCampaignAction({ workspaceId, workspaceType, campaignId: row.id, status: target })
        if (!result.ok) failures.push(`${row.name}: ${result.error}`)
      }
      setNotice(failures.length === 0
        ? { text: `${eligible.length} campaign${eligible.length === 1 ? '' : 's'} ${target === 'paused' ? 'paused' : 'resumed'}.`, ok: true }
        : { text: `${failures.length} of ${eligible.length} failed — ${failures[0]}`, ok: false })
    })
  }

  function exportSelected() {
    const header = ['Campaign', 'Platform', 'Objective', 'Spend', 'Budget', 'ROAS', 'CTR', 'Conversions', 'Status', 'Owner']
    const lines = [header.join(','), ...selectedRows.map(row => [
      row.name, row.provider, OBJECTIVE_LABELS[row.objective] ?? row.objective, row.spend, row.budget, row.roas, row.ctr, row.conversions,
      CAMPAIGN_STATUS[row.status]?.label ?? row.status, row.ownerName ?? '',
    ].map(csvCell).join(','))]
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `caption-fox-selected-campaigns-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3">
        {toolbarLeft}
        <div className="flex items-center gap-2">
          <details className="relative">
            <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <Columns3 size={14} aria-hidden /> Columns
            </summary>
            <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
              {COLUMNS.map(column => (
                <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50">
                  <input type="checkbox" checked={show(column.key)} onChange={() => toggleColumn(column.key)} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600" />
                  {column.label}
                </label>
              ))}
            </div>
          </details>
          {toolbarRight}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mx-4 mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-[12.5px]" role="region" aria-label="Bulk actions">
          <span className="font-medium text-blue-900">{selected.size} selected</span>
          {canPause && (
            <>
              <button type="button" disabled={pending} onClick={() => bulkStatus('paused')} className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Pause size={13} aria-hidden /> Pause</button>
              <button type="button" disabled={pending} onClick={() => bulkStatus('active')} className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Play size={13} aria-hidden /> Resume</button>
            </>
          )}
          <button type="button" onClick={exportSelected} className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 font-medium text-slate-700 hover:bg-slate-50"><Download size={13} aria-hidden /> Export selected</button>
          {pending && <Loader2 size={14} className="animate-spin text-blue-600" aria-label="Working" />}
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto inline-flex items-center gap-1 text-slate-500 hover:text-slate-800"><X size={13} aria-hidden /> Clear</button>
        </div>
      )}
      {notice && <p role="status" className={cn('mx-4 mb-2 rounded-lg px-3 py-2 text-[12px]', notice.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700')}>{notice.text}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-[11.5px] lg:text-[10.5px]">
          <caption className="sr-only">Advertising campaigns</caption>
          <thead>
            <tr className="border-y border-slate-100 text-[11.5px] text-slate-700 lg:text-[10.5px]">
              <th className="w-10 py-2 pl-4">
                <input type="checkbox" aria-label="Select all campaigns on this page" checked={allSelected} disabled={!canBulkEdit && !rows.length}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map(row => row.id)))} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600" />
              </th>
              <th className="px-3 py-2 font-semibold">Campaign Name</th>
              {show('platform') && <th className="px-3 py-2 text-center font-semibold">Platform</th>}
              {show('objective') && <th className="px-3 py-2 text-center font-semibold">Objective</th>}
              {show('spend') && <th className="px-3 py-2 font-semibold">Spend</th>}
              {show('budget') && <th className="px-3 py-2 font-semibold">Budget</th>}
              {show('roas') && <th className="px-3 py-2 font-semibold">ROAS</th>}
              {show('ctr') && <th className="px-3 py-2 font-semibold">CTR</th>}
              {show('conversions') && <th className="px-3 py-2 font-semibold">Conversions</th>}
              {show('status') && <th className="px-3 py-2 font-semibold">Status</th>}
              {show('owner') && <th className="px-3 py-2 font-semibold">Owner</th>}
              <th className="px-4 py-2 text-center font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(row => (
              <tr key={row.id} className={cn('hover:bg-slate-50/70', selected.has(row.id) && 'bg-blue-50/40')}>
                <td className="py-[5px] pl-4">
                  <input type="checkbox" aria-label={`Select ${row.name}`} checked={selected.has(row.id)}
                    onChange={() => setSelected(prev => { const next = new Set(prev); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next })}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600" />
                </td>
                <td className="px-3 py-[5px]">
                  <Link href={`${basePath}/campaigns/${row.id}`} className="flex items-center gap-2 text-slate-800 hover:text-blue-700">
                    <ProviderLogo provider={row.provider} size={16} decorative /><span className="truncate">{row.name}</span>
                  </Link>
                </td>
                {show('platform') && <td className="px-3 py-[5px] text-center"><span className="inline-flex"><ProviderLogo provider={row.provider} size={16} /></span></td>}
                {show('objective') && <td className="px-3 py-[5px] text-center text-slate-600">{OBJECTIVE_LABELS[row.objective] ?? row.objective}</td>}
                {show('spend') && <td className="px-3 py-[5px] tabular-nums text-slate-700">{row.spend}</td>}
                {show('budget') && <td className="px-3 py-[5px] tabular-nums text-slate-700">{row.budget}</td>}
                {show('roas') && <td className="px-3 py-[5px] tabular-nums text-slate-700">{row.roas}</td>}
                {show('ctr') && <td className="px-3 py-[5px] tabular-nums text-slate-700">{row.ctr}</td>}
                {show('conversions') && <td className="px-3 py-[5px] tabular-nums text-slate-700">{row.conversions}</td>}
                {show('status') && <td className="px-3 py-[5px]"><StatusPill status={row.status} map={CAMPAIGN_STATUS} className="rounded-md px-2 text-[11px]" /></td>}
                {show('owner') && (
                  <td className="px-3 py-[5px]">
                    <span className="flex items-center gap-2 whitespace-nowrap text-slate-700">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[8.5px] font-semibold text-slate-600" aria-hidden>{initials(row.ownerName)}</span>
                      {row.ownerName ?? '—'}
                    </span>
                  </td>
                )}
                <td className="px-4 py-[4px] text-center">
                  <span className="inline-flex">
                    <KebabMenu size="sm" label={`${row.name} actions`}>
                      <Link href={`${basePath}/campaigns/${row.id}`}>View campaign</Link>
                      <Link href={`${basePath}/creatives?q=${encodeURIComponent(row.name)}`}>View creatives</Link>
                      <Link href={`${basePath}/reports?platform=${row.provider}`}>Open report</Link>
                    </KebabMenu>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  )
}
