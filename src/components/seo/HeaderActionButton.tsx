'use client'

import { Plus } from 'lucide-react'

/** Visually matches SeoHeader's primary action button — used to trigger a wizard modal. */
export function HeaderActionButton({
  label, onClick, variant = 'button',
}: { label: string; onClick: () => void; variant?: 'button' | 'link' }) {
  if (variant === 'link') {
    return <button type="button" onClick={onClick} className="text-sm font-medium text-blue-600 hover:text-blue-700">{label}</button>
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-sm font-medium text-white hover:bg-blue-700"
    >
      <Plus size={14} aria-hidden />
      {label}
    </button>
  )
}
