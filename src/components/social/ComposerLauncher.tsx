'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Plus } from 'lucide-react'
import { PostComposer } from './PostComposer'
import type { SocialChannelRow } from '@/types/social'

export function ComposerLauncher({ channels, label = 'Schedule Post' }: { channels: SocialChannelRow[]; label?: string }) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (params.get('compose') === '1') setOpen(true)
  }, [params])

  function close() {
    setOpen(false)
    if (params.get('compose')) {
      const next = new URLSearchParams(params.toString())
      next.delete('compose')
      router.replace(`${pathname}?${next.toString()}`)
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm">
        <Plus size={15} />{label}
      </button>
      {open && <PostComposer channels={channels} onClose={close} />}
    </>
  )
}
