'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Mail, ArrowLeft, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function VerifyEmailPage() {
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  async function resendEmail() {
    setResending(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      await supabase.auth.resend({ type: 'signup', email: user.email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })
    }
    setResent(true)
    setResending(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Image src="/caption-fox-logo-transparent.png" alt="Caption Fox" width={160} height={38} />
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-5">
            <Mail size={32} className="text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Verify your email</h1>
          <p className="text-sm text-slate-500 mb-6">We sent a confirmation link to your email address. Click the link to activate your Caption Fox account.</p>
          {resent
            ? <p className="text-sm text-emerald-600 font-medium mb-4">Email resent! Check your inbox.</p>
            : <button onClick={resendEmail} disabled={resending} className="flex items-center gap-2 mx-auto text-sm text-blue-600 hover:underline disabled:opacity-50 mb-4">
                <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />{resending ? 'Resending…' : 'Resend email'}
              </button>}
          <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
