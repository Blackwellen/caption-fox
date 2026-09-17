'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Eye, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/campaigns/Toast'
import { setAiOutputState, useAiOutput as moveOutputToCompose } from '@/lib/studio/actions/ai'
import { MenuItem, MenuSeparator, Popover, PopoverContent, PopoverTrigger } from '../overlays'
import { S_FOCUS } from '../ui'

/** Row actions for the Recent AI Outputs table: open, copy and a status menu. */
export default function AiOutputRowActions({ id, base, batchId, output, bookmarked, canCompose }: {
  id: string
  base: string
  batchId: string | null
  output: string
  bookmarked: boolean
  canCompose: boolean
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, start] = useTransition()
  const icon = cn('rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40', S_FOCUS)

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string; id?: string }>, done?: (id?: string) => void) => start(async () => {
    const result = await fn()
    notify(result.ok ? 'success' : 'error', result.ok ? result.message ?? 'Updated.' : result.error ?? 'Something went wrong.')
    if (result.ok) { done?.(result.id); router.refresh() }
  })

  return (
    <span className="flex items-center gap-2 lg:gap-[12px]">
      <button type="button" className={icon} aria-label="Open output" title="Open" onClick={() => router.push(`${base}/ai-generate?batch=${batchId ?? ''}`)} disabled={!batchId}><Eye size={13} /></button>
      <button type="button" className={icon} aria-label="Copy output" title="Copy" onClick={() => { void navigator.clipboard?.writeText(output); notify('success', 'Copied to clipboard.') }}><Copy size={13} /></button>
      <Popover>
        <PopoverTrigger haspopup="menu" label="More output actions" className={icon} disabled={pending}><MoreHorizontal size={14} /></PopoverTrigger>
        <PopoverContent role="menu" label="Output actions" width={200} align="end">
          {close => (<>
            <MenuItem close={close} disabled={!canCompose} hint="Your role cannot create content"
              onSelect={() => run(() => moveOutputToCompose({ id }), newId => newId && router.push(`${base}/compose?id=${newId}`))}>Use in Compose</MenuItem>
            <MenuItem close={close} onSelect={() => run(() => setAiOutputState({ id, bookmarked: !bookmarked }))}>{bookmarked ? 'Remove from saved' : 'Save output'}</MenuItem>
            <MenuSeparator />
            <MenuItem close={close} danger onSelect={() => run(() => setAiOutputState({ id, status: 'discarded' }))}>Discard</MenuItem>
          </>)}
        </PopoverContent>
      </Popover>
    </span>
  )
}
