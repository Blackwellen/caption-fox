'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { useToast } from '@/components/campaigns/Toast'
import { createAutomationFromTemplate } from '@/app/app/automations/actions'

/** Installs a recipe template as a new draft automation. Never activates it. */
export default function TemplateInstallButton({ templateKey, disabled }: { templateKey: string; disabled?: boolean }) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()

  function install() {
    if (pending) return
    startTransition(async () => {
      const result = await createAutomationFromTemplate(templateKey)
      if (!result.ok) { notify('error', result.error ?? 'Could not install this template.'); return }
      notify('success', result.message ?? 'Template installed as a draft.')
      router.refresh()
    })
  }

  return (
    <button
      type="button" onClick={install} disabled={disabled || pending}
      className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
    >
      <Plus size={12} />{pending ? 'Installing…' : 'Use template'}
    </button>
  )
}
