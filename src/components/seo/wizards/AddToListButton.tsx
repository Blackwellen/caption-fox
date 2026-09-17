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
  const [error, setError] = useState<string | null>(null)

  if (lists.length === 0) {
    return <span className="text-[11px] text-slate-400">Create a list first</span>
  }

  function add(listId: string) {
    startTransition(async () => {
      const result = await addOpportunityToList(listId, opportunityId)
      if (result.ok) { setError(null); setDone(true); router.refresh(); setTimeout(() => setDone(false), 1500) }
      else setError(result.error ?? 'Could not add to the list.')
      setOpen(false)
    })
  }

  return (
    <div className="relative inline-block" title={error ?? undefined}>
      {error && <span role="alert" className="sr-only">{error}</span>}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={pending}
        className="inline-flex h-6 items-center gap-0.5 whitespace-nowrap rounded-md border border-blue-200 bg-blue-50/60 px-1.5 text-[10.5px] font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
      >
        {pending ? <Loader2 size={11} className="animate-spin" /> : done ? <Check size={11} className="text-emerald-600" /> : null}
        {done ? 'Added' : error ? 'Retry' : 'Add to List'}
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
