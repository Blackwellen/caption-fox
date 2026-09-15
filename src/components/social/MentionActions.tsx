'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateMention } from '@/lib/social/actions'

export function StarMention({ mentionId, starred }: { mentionId: string; starred: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(async () => { await updateMention({ mentionId, isStarred: !starred }); router.refresh() })}
      className="rounded p-1 hover:bg-slate-100"
      aria-label={starred ? 'Unfavourite' : 'Favourite'}
    >
      <Star size={14} className={cn(starred ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
    </button>
  )
}
