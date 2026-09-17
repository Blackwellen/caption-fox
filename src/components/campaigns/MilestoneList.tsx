'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { useToast } from './Toast'
import { setMilestoneStatus } from '@/app/app/campaigns/actions'
import type { MilestoneRow } from '@/lib/campaigns/types'
import { useCampaignsBase } from './links'

export default function MilestoneList({
  milestones, canManage, emptyMessage = 'No upcoming milestones.',
}: { milestones: MilestoneRow[]; canManage: boolean; emptyMessage?: string }) {
  const router = useRouter()
  const campaignsBase = useCampaignsBase()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()

  if (milestones.length === 0) {
    return <p className="py-6 text-center text-[13px] lg:text-[10px] text-slate-400">{emptyMessage}</p>
  }

  function toggle(milestone: MilestoneRow) {
    if (!canManage) return
    startTransition(async () => {
      const result = await setMilestoneStatus(milestone.id, milestone.status === 'completed' ? 'pending' : 'completed')
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Updated.') : (result.error ?? 'Could not update the milestone.'))
      if (result.ok) router.refresh()
    })
  }

  return (
    <ul className="space-y-2">
      {milestones.map(milestone => {
        const done = milestone.status === 'completed'
        return (
          <li key={milestone.id} className="flex items-start gap-2">
            <button
              type="button" disabled={!canManage || pending} onClick={() => toggle(milestone)}
              aria-pressed={done}
              aria-label={done ? `Mark ${milestone.title} as not completed` : `Mark ${milestone.title} as completed`}
              className={cn('mt-0.5 shrink-0 text-slate-300 transition-colors', canManage && 'hover:text-emerald-500', done && 'text-emerald-500')}
            >
              {done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
            </button>
            <span className="min-w-0 flex-1">
              <span className={cn('block truncate text-[12px] lg:text-[9.5px] font-medium', done ? 'text-slate-400 line-through' : 'text-slate-900')}>
                {milestone.title}
              </span>
              <span className="block truncate text-[11px] lg:text-[8.5px] text-slate-400">
                {milestone.campaign?.name ? (
                  <Link href={`${campaignsBase}/${milestone.campaign.id}`} className="hover:text-blue-600">{milestone.campaign.name}</Link>
                ) : 'Unlinked'}
              </span>
            </span>
            <span className="shrink-0 text-[11px] lg:text-[8.5px] text-slate-500">{formatDate(milestone.due_date)}</span>
          </li>
        )
      })}
      {pending && <li className="flex items-center gap-1.5 text-[12px] lg:text-[9.5px] text-slate-400"><Loader2 size={12} className="animate-spin" /> Saving…</li>}
    </ul>
  )
}
