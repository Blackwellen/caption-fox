'use client'

import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { BrandGlyph } from './BrandGlyph'
import { OrDivider } from './fields'

// Google is only offered when the provider is enabled in Supabase Auth
// (set NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true once it is — see user-fixes).
export const GOOGLE_AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === 'true'

export function GoogleSection({ continuePath, onError }: { continuePath: string; onError: (message: string) => void }) {
  const [loading, setLoading] = useState(false)
  if (!GOOGLE_AUTH_ENABLED) return null

  async function start() {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/callback?next=${encodeURIComponent(continuePath)}` },
    })
    if (error) {
      setLoading(false)
      onError('Google sign-in isn’t available right now. Use your email instead.')
    }
  }

  return (
    <>
      <div className="my-6"><OrDivider /></div>
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="flex h-14 w-full items-center justify-center gap-3.5 rounded-[10px] border border-cf-line-strong bg-white text-[18px] font-semibold text-cf-ink transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-px hover:border-cf-blue/50 hover:shadow-cf-card disabled:opacity-70 sm:h-[58px] sm:text-[19px]"
      >
        {loading ? <LoaderCircle size={22} className="animate-spin" aria-hidden /> : <BrandGlyph platform="google" size={26} />}
        Continue with Google
      </button>
    </>
  )
}
