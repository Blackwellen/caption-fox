'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

export default function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div>
      <p className="mb-1.5 text-[12.5px] font-semibold text-shell-text-2">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-[10px] border border-shell-border bg-shell-canvas px-3 py-2.5 font-mono text-[13px] text-shell-text">{value}</code>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(value)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1600)
          }}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[10px] bg-shell-blue px-3.5 text-[13.5px] font-semibold text-white hover:bg-shell-blue-hover"
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
          <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </div>
  )
}
