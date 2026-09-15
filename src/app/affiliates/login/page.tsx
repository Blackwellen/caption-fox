'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff, AlertCircle, Gift } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Branded sign-in for the affiliate/partner program. Same Supabase auth
// backend as /login — an approved affiliate is simply a regular account, so
// after sign-in we route to Partnerships if the account belongs to a
// workspace, otherwise back to the application status.
function AffiliateLoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/app/partnerships'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) { setError(signInError.message); setLoading(false); return }
    router.push(next)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)' }}>
        <div className="relative z-10 text-center">
          <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
            <Gift size={32} className="text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Welcome back, partner</h2>
          <p className="text-amber-50 text-lg max-w-xs mx-auto">Track referrals and commission from your affiliate dashboard.</p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-64 opacity-10" style={{ background: 'radial-gradient(ellipse at bottom, white, transparent)' }} />
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <Image src="/caption-fox-logo-transparent.png" alt="Caption Fox" width={160} height={38} />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="flex items-center gap-2 mb-1">
              <Gift size={18} className="text-amber-600" />
              <h1 className="text-2xl font-bold text-slate-900">Affiliate sign in</h1>
            </div>
            <p className="text-sm text-slate-500 mb-7">Not an affiliate yet? <Link href="/affiliates/signup" className="text-blue-600 font-medium hover:underline">Apply here</Link></p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input id="email" name="email" type="email" required autoFocus autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="you@example.com" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" className="text-sm font-medium text-slate-700">Password</label>
                  <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">Forgot password?</Link>
                </div>
                <div className="relative">
                  <input id="password" name="password" type={showPw ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle size={15} className="shrink-0" />{error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors">
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AffiliateLoginPage() {
  return (
    <Suspense>
      <AffiliateLoginPageContent />
    </Suspense>
  )
}
