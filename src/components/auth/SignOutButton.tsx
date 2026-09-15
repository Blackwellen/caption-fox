'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function SignOutButton({ redirectTo = '/login', className }: { redirectTo?: string; className?: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await createClient().auth.signOut()
        window.location.assign(redirectTo)
      }}
      className={className ?? 'inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-[15px] font-medium text-cf-body hover:text-cf-blue'}
    >
      <LogOut size={17} aria-hidden /> {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
