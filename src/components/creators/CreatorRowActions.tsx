'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Archive, ArchiveRestore, ExternalLink, ListPlus, MoreHorizontal, Star } from 'lucide-react'
import { useToast } from '@/components/campaigns/Toast'
import { archiveCreator, addCreatorToList, toggleShortlist } from '@/app/app/creators/actions'
import type { CreatorListRow, CreatorRow } from '@/lib/creators/types'

/**
 * The row/card overflow menu for a creator. Every action calls a real server
 * action and refreshes the route — nothing here is a placeholder toast.
 */
export default function CreatorRowActions({
  creator, lists, canManage, canManageLists,
}: { creator: CreatorRow; lists: CreatorListRow[]; canManage: boolean; canManageLists: boolean }) {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const archived = Boolean(creator.archived_at)

  function run(action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setOpen(false)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) { notify('error', result.error ?? 'Something went wrong.'); return }
      if (result.message) notify('success', result.message)
      router.refresh()
    })
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button" onClick={() => setOpen(v => !v)} aria-label={`Actions for ${creator.name}`} aria-expanded={open}
        disabled={pending}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
            <Link href={`/app/creators/creators/${creator.id}`} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-50" onClick={() => setOpen(false)}>
              <ExternalLink size={13} />Open profile
            </Link>
            {canManage && (
              <button type="button" onClick={() => run(() => toggleShortlist(creator.id, !creator.shortlisted))} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50">
                <Star size={13} />{creator.shortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
              </button>
            )}
            {canManageLists && lists.length > 0 && (
              <div className="border-t border-slate-100 pt-1">
                <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Add to list</p>
                {lists.slice(0, 5).map(list => (
                  <button
                    key={list.id} type="button"
                    onClick={() => run(() => addCreatorToList(list.id, creator.id))}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                  >
                    <ListPlus size={13} />{list.name}
                  </button>
                ))}
              </div>
            )}
            {canManage && (
              <div className="border-t border-slate-100 pt-1">
                <button
                  type="button"
                  onClick={() => run(() => archiveCreator(creator.id, !archived))}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                >
                  {archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                  {archived ? 'Restore creator' : 'Archive creator'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
