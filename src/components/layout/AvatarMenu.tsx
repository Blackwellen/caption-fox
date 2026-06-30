'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User, Settings, Shield, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function AvatarMenu({
  userName,
  userEmail,
  isAdmin,
}: {
  userName?: string | null
  userEmail?: string | null
  isAdmin?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const initials = userName
    ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : userEmail?.[0]?.toUpperCase() ?? '?'

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="w-8 h-8 rounded-full bg-fox-gradient flex items-center justify-center text-xs font-bold text-white" aria-label="Account menu">
        {initials}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-40 py-1.5">
            <div className="px-3.5 py-2 border-b border-slate-100">
              {userName && <p className="text-sm font-medium text-slate-900 truncate">{userName}</p>}
              {userEmail && <p className="text-xs text-slate-500 truncate">{userEmail}</p>}
            </div>
            {/* Account settings — visible to everyone, lives here in the avatar menu */}
            <Link href="/app/settings?tab=account" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
              <User size={15} className="text-slate-400" /> Account settings
            </Link>
            <Link href="/app/settings" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
              <Settings size={15} className="text-slate-400" /> Workspace settings
            </Link>
            {isAdmin && (
              <Link href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-violet-700 hover:bg-violet-50 transition-colors">
                <Shield size={15} /> Platform admin
              </Link>
            )}
            <div className="border-t border-slate-100 mt-1 pt-1">
              <button onClick={signOut} className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                <LogOut size={15} className="text-slate-400" /> Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
