'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Download, Trash2, XCircle } from 'lucide-react'
import { CARD, Panel, formatShortDate } from '@/components/studio/primitives'
import { StudioEmpty } from '@/components/studio/states'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/campaigns/Toast'
import { MEDIA_STATUS_BADGE, MEDIA_STATUS_LABELS, type MediaStatus } from '@/lib/studio/constants'
import type { AssetVersionRow, MediaCollectionRow, MediaRow } from '@/lib/studio/types'
import type { StudioCapabilities } from '@/lib/studio/entitlements'
import { deleteMediaAsset, setMediaStatus, updateMediaAsset } from './actions'

export default function MediaDetail({
  detail, capabilities, collections,
}: {
  detail: { row: MediaRow | null; versions: AssetVersionRow[]; error: string | null } | null
  capabilities: StudioCapabilities
  collections: MediaCollectionRow[]
}) {
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const row = detail?.row ?? null
  const [description, setDescription] = useState(row?.description ?? '')

  function moveCollection(collectionId: string) {
    if (!row) return
    startTransition(async () => {
      const result = await updateMediaAsset({ id: row.id, description: row.description ?? '', tags: row.tags ?? [], collectionId: collectionId || null })
      notify(result.ok ? 'success' : 'error', result.ok ? 'Moved.' : (result.error ?? 'Failed.'))
    })
  }

  function approve() {
    if (!row) return
    startTransition(async () => {
      const result = await setMediaStatus({ id: row.id, status: 'ready' })
      notify(result.ok ? 'success' : 'error', result.ok ? 'Approved.' : (result.error ?? 'Failed.'))
    })
  }

  function requestChanges() {
    if (!row) return
    startTransition(async () => {
      const result = await setMediaStatus({ id: row.id, status: 'changes_requested' })
      notify(result.ok ? 'success' : 'error', result.ok ? 'Changes requested.' : (result.error ?? 'Failed.'))
    })
  }

  function saveDescription() {
    if (!row) return
    startTransition(async () => {
      const result = await updateMediaAsset({ id: row.id, description, tags: row.tags ?? [] })
      notify(result.ok ? 'success' : 'error', result.ok ? 'Saved.' : (result.error ?? 'Failed.'))
    })
  }

  function remove() {
    if (!row) return
    if (!confirm(`Delete ${row.file_name}? This cannot be undone.`)) return
    startTransition(async () => {
      const result = await deleteMediaAsset({ id: row.id })
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Deleted.') : (result.error ?? 'Failed.'))
    })
  }

  return (
    <Panel title={row?.file_name ?? 'Select an asset'}>
      {!row ? (
        <StudioEmpty bare title="No asset selected" message="Choose a file from the grid to see its details." />
      ) : (
        <div>
          <div className={`${CARD} mb-3 flex aspect-video items-center justify-center overflow-hidden bg-slate-50`}>
            {row.file_type === 'image'
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={row.file_url} alt={row.alt_text ?? ''} className="h-full w-full object-contain" />
              : <p className="text-sm text-slate-400">{row.file_type} preview</p>}
          </div>

          <dl className="mb-3 grid grid-cols-2 gap-y-2 text-[13px]">
            <dt className="text-slate-400">Status</dt>
            <dd><Badge variant={MEDIA_STATUS_BADGE[row.status as MediaStatus] ?? 'slate'}>{MEDIA_STATUS_LABELS[row.status as MediaStatus] ?? row.status}</Badge></dd>
            <dt className="text-slate-400">Collection</dt>
            <dd>
              {capabilities.editMedia ? (
                <select
                  defaultValue={row.collection_id ?? ''} onChange={e => moveCollection(e.target.value)}
                  className="h-7 rounded-lg border border-slate-200 px-1.5 text-[12px] text-slate-700"
                >
                  <option value="">No collection</option>
                  {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : (
                <span className="text-slate-700">{row.collection?.name ?? '—'}</span>
              )}
            </dd>
            <dt className="text-slate-400">Uploaded by</dt>
            <dd className="text-slate-700">{row.owner?.full_name ?? row.owner?.email ?? '—'}</dd>
            <dt className="text-slate-400">Uploaded</dt>
            <dd className="text-slate-700">{formatShortDate(row.created_at)}</dd>
            {row.width && row.height && (
              <>
                <dt className="text-slate-400">Dimensions</dt>
                <dd className="text-slate-700">{row.width} × {row.height}</dd>
              </>
            )}
          </dl>

          {capabilities.editMedia && (
            <label className="mb-3 block text-xs font-medium text-slate-500">
              Description
              <textarea
                value={description} onChange={e => setDescription(e.target.value)} onBlur={saveDescription}
                rows={2} className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            <a href={row.file_url} download className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <Download size={13} /> Download
            </a>
            {capabilities.approveMedia && row.status === 'needs_review' && (
              <>
                <button type="button" disabled={pending} onClick={approve} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 px-2.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 disabled:opacity-50">
                  <CheckCircle2 size={13} /> Approve
                </button>
                <button type="button" disabled={pending} onClick={requestChanges} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 px-2.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                  <XCircle size={13} /> Request changes
                </button>
              </>
            )}
            {capabilities.deleteMedia && (
              <button type="button" disabled={pending} onClick={remove} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 px-2.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>
        </div>
      )}
    </Panel>
  )
}
