'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pause, Play, Archive } from 'lucide-react'
import { useToast } from '@/components/campaigns/Toast'
import { setJourneyStatus } from '@/app/app/messaging/actions'

export default function JourneyStatusActions({ id, status, canActivate, canManage }: {
  id: string; status: string; canActivate: boolean; canManage: boolean
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()

  function change(next: 'active' | 'paused' | 'archived') {
    startTransition(async () => {
      const res = await setJourneyStatus(id, next)
      notify(res.ok ? 'success' : 'error', res.ok ? (res.message ?? 'Updated.') : (res.error ?? 'Could not update journey.'))
      if (res.ok) router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      {status !== 'active' && canActivate && (
        <button type="button" onClick={() => change('active')} disabled={pending} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[12px] font-medium text-white disabled:opacity-50">
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          Activate
        </button>
      )}
      {status === 'active' && canManage && (
        <button type="button" onClick={() => change('paused')} disabled={pending} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <Pause size={13} />
          Pause
        </button>
      )}
      {status !== 'archived' && canManage && (
        <button type="button" onClick={() => change('archived')} disabled={pending} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50">
          <Archive size={13} />
          Archive
        </button>
      )}
    </div>
  )
}
