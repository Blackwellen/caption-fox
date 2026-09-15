'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/campaigns/Toast'
import { setMessagingTemplateStatus } from '@/app/app/messaging/actions'

export default function TemplateStatusActions({ id, status, canManage, canApprove }: {
  id: string; status: string; canManage: boolean; canApprove: boolean
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()

  function change(intent: 'submit_review' | 'publish' | 'archive') {
    startTransition(async () => {
      const res = await setMessagingTemplateStatus(id, intent)
      notify(res.ok ? 'success' : 'error', res.ok ? (res.message ?? 'Updated.') : (res.error ?? 'Could not update template.'))
      if (res.ok) router.refresh()
    })
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {pending && <Loader2 size={12} className="animate-spin text-slate-400" />}
      {status === 'draft' && canManage && (
        <button type="button" onClick={() => change('submit_review')} disabled={pending} className="text-[11px] font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50">Submit for review</button>
      )}
      {status !== 'published' && status !== 'archived' && canApprove && (
        <button type="button" onClick={() => change('publish')} disabled={pending} className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50">Publish</button>
      )}
      {status !== 'archived' && canManage && (
        <button type="button" onClick={() => change('archive')} disabled={pending} className="text-[11px] font-medium text-slate-400 hover:text-slate-600 disabled:opacity-50">Archive</button>
      )}
    </div>
  )
}
