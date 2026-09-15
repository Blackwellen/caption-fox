'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/campaigns/Toast'
import { saveIdea } from '../idea-actions'
import type { IdeaCollectionRow } from '@/lib/studio/types'

export default function NewIdeaButton({ collections }: { collections: IdeaCollectionRow[] }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [pending, startTransition] = useTransition()
  const { notify } = useToast()

  function submit() {
    if (!title.trim()) { notify('error', 'Give the idea a title.'); return }
    startTransition(async () => {
      const result = await saveIdea({ title, description, collectionId: collectionId || null })
      if (!result.ok) { notify('error', result.error ?? 'Could not save.'); return }
      notify('success', result.message ?? 'Idea added.')
      setOpen(false)
      setTitle(''); setDescription(''); setCollectionId('')
    })
  }

  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        <Plus size={15} /> New Idea
      </button>

      {open && (
        <Modal
          open onClose={() => setOpen(false)} title="New idea"
          footer={
            <>
              <button type="button" onClick={() => setOpen(false)} className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" disabled={pending} onClick={submit} className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {pending ? 'Saving…' : 'Add idea'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-500">
              Title
              <input
                value={title} onChange={e => setTitle(e.target.value)} autoFocus
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Description
              <textarea
                value={description} onChange={e => setDescription(e.target.value)} rows={3}
                className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            {collections.length > 0 && (
              <label className="block text-xs font-medium text-slate-500">
                Collection
                <select
                  value={collectionId} onChange={e => setCollectionId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-[13px]"
                >
                  <option value="">No collection</option>
                  {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
