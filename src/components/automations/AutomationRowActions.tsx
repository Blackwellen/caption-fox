'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pause, Play, Trash2, Zap } from 'lucide-react'
import { useToast } from '@/components/campaigns/Toast'
import { setAutomationStatus, deleteAutomation, runAutomationManually } from '@/app/app/automations/actions'
import { canTransitionAutomation } from '@/lib/automations/constants'
import { cn } from '@/lib/utils'

export default function AutomationRowActions({
  id, status, canActivate, canRemove, canRunManually,
}: { id: string; status: string; canActivate: boolean; canRemove: boolean; canRunManually: boolean }) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const [active, setActive] = useState<string | null>(null)

  function run(key: string, task: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    if (pending) return
    setActive(key)
    startTransition(async () => {
      const result = await task()
      if (!result.ok) { notify('error', result.error ?? 'Something went wrong.'); setActive(null); return }
      notify('success', result.message ?? 'Done.')
      setActive(null)
      router.refresh()
    })
  }

  const canPause = canActivate && canTransitionAutomation(status, 'paused')
  const canActivateNow = canActivate && canTransitionAutomation(status, 'active')

  return (
    <span className="inline-flex items-center gap-1">
      {canActivateNow && (
        <button
          type="button" onClick={() => run('activate', () => setAutomationStatus({ id, status: 'active' }))}
          disabled={pending} aria-label="Activate"
          className={cn('inline-flex h-7 w-7 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-40', pending && active === 'activate' && 'animate-pulse')}
        ><Play size={14} /></button>
      )}
      {canPause && (
        <button
          type="button" onClick={() => run('pause', () => setAutomationStatus({ id, status: 'paused' }))}
          disabled={pending} aria-label="Pause"
          className={cn('inline-flex h-7 w-7 items-center justify-center rounded-lg text-amber-600 hover:bg-amber-50 disabled:opacity-40', pending && active === 'pause' && 'animate-pulse')}
        ><Pause size={14} /></button>
      )}
      {canRunManually && status === 'active' && (
        <button
          type="button" onClick={() => run('run', () => runAutomationManually(id))}
          disabled={pending} aria-label="Run now"
          className={cn('inline-flex h-7 w-7 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 disabled:opacity-40', pending && active === 'run' && 'animate-pulse')}
        ><Zap size={14} /></button>
      )}
      {canRemove && status !== 'archived' && (
        <button
          type="button" onClick={() => run('delete', () => deleteAutomation(id))}
          disabled={pending} aria-label="Delete"
          className={cn('inline-flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-40', pending && active === 'delete' && 'animate-pulse')}
        ><Trash2 size={14} /></button>
      )}
    </span>
  )
}
