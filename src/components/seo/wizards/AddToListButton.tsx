'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { addOpportunityToList } from '@/lib/seo/actions'

/** Per-row "Add to List" control for link opportunities. */
export function AddToListButton({
  opportunityId, lists,
}: { opportunityId: string; lists: { id: string; name: string }[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  if (lists.length === 0) {
    return <span className="text-[11px] text-slate-400">Create a list first</span>
  }

  function add(listId: string) {
    startTransition(async () => {
      const result = await addOpportunityToList(listId, opportunityId)
      if (result.ok) { setDone(true); router.refresh(); setTimeout(() => setDone(false), 1500) }
      setOpen(false)
    })
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={pending}
        className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? <Loader2 size={11} className="animate-spin" /> : done ? <Check size={11} className="text-emerald-600" /> : null}
        {done ? 'Added' : 'Add to List'}
        {!pending && !done && <ChevronDown size={11} />}
      </button>
      {open && (
        <>
          <button aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {lists.map(list => (
              <button key={list.id} role="menuitem" onClick={() => add(list.id)} className="block w-full truncate px-3 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50">
                {list.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
