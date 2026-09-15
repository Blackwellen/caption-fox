'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/campaigns/Toast'
import { refreshChannelHealth } from '@/app/app/messaging/actions'

export default function RefreshChannelHealthButton() {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const res = await refreshChannelHealth()
      notify(res.ok ? 'success' : 'error', res.ok ? (res.message ?? 'Checked.') : (res.error ?? 'Could not check channel health.'))
      if (res.ok) router.refresh()
    })
  }

  return (
    <button
      type="button" onClick={handleClick} disabled={pending}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
    >
      {pending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
      Check connection
    </button>
  )
}
