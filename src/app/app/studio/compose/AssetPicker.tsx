'use client'

import { useEffect, useState, useTransition } from 'react'
import { Modal } from '@/components/ui/Modal'
import { StudioEmpty } from '@/components/studio/states'
import type { MediaRow } from '@/lib/studio/types'
import { searchPickerAssets } from './actions'

export default function AssetPicker({
  onClose, onSelect,
}: { onClose: () => void; onSelect: (assets: MediaRow[]) => void }) {
  const [term, setTerm] = useState('')
  const [rows, setRows] = useState<MediaRow[]>([])
  const [selected, setSelected] = useState<MediaRow[]>([])
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const result = await searchPickerAssets(term)
      if (result.ok) setRows(result.rows)
    })
  }, [term])

  function toggle(asset: MediaRow) {
    setSelected(list => (list.some(a => a.id === asset.id) ? list.filter(a => a.id !== asset.id) : [...list, asset]))
  }

  return (
    <Modal
      open onClose={onClose} title="Add media" size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button
            type="button" disabled={selected.length === 0} onClick={() => onSelect(selected)}
            className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Add {selected.length || ''} asset{selected.length === 1 ? '' : 's'}
          </button>
        </>
      }
    >
      <input
        value={term} onChange={e => setTerm(e.target.value)} placeholder="Search media…" autoFocus
        className="mb-3 h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
      {pending ? (
        <p className="py-8 text-center text-[13px] text-slate-400">Searching…</p>
      ) : rows.length === 0 ? (
        <StudioEmpty bare icon="search" title="No media found" message="Upload assets in the Media library first." />
      ) : (
        <div className="grid max-h-[360px] grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5">
          {rows.map(asset => {
            const active = selected.some(a => a.id === asset.id)
            return (
              <button
                key={asset.id} type="button" onClick={() => toggle(asset)}
                className={`relative aspect-square overflow-hidden rounded-lg border-2 ${active ? 'border-blue-500' : 'border-transparent'}`}
              >
                {asset.file_type === 'image'
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={asset.file_url} alt="" className="h-full w-full object-cover" />
                  : <div className="flex h-full items-center justify-center bg-slate-100 text-[10px] text-slate-400">{asset.file_type}</div>}
                {active && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] text-white">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
