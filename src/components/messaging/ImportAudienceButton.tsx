'use client'

import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Import audience is a data-integrity-sensitive workflow (contact + consent
 * validation) planned for a later Messaging phase — surfaced here so the
 * action is discoverable and truthfully disabled rather than hidden or fake.
 */
export default function ImportAudienceButton({ allowed, className }: { allowed: boolean; className?: string }) {
  return (
    <button
      type="button" disabled
      title={allowed
        ? 'Audience CSV import with consent validation is coming in a later Messaging release.'
        : 'Your role does not include importing audiences. Ask a workspace owner or admin for access.'}
      className={cn('inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-400 shadow-sm', className)}
    >
      <Upload size={14} />
      Import audience
    </button>
  )
}
