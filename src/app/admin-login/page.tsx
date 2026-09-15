'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Separate branded sign-in surface for Platform Admin. Auth still runs
// through the same Supabase project as /login — the separation here is the
// route, branding and the post-auth is_platform_admin check, not a second
// user pool.
function AdminLoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/admin'

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
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError || !data.user) { setError(signInError?.message ?? 'Sign in failed.'); setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', data.user.id)
      .maybeSingle()

    if (!profile?.is_platform_admin) {
      await supabase.auth.signOut()
      setError('This account does not have Platform Admin access.')
      setLoading(false)
      return
    }

    router.push(next)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #4338CA 0%, #1E1B4B 100%)' }}>
        <div className="relative z-10 text-center">
          <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
            <ShieldCheck size={32} className="text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Platform Admin</h2>
          <p className="text-indigo-100 text-lg max-w-xs mx-auto">Internal access for Caption Fox platform operations. Not for workspace or affiliate accounts.</p>
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
              <ShieldCheck size={18} className="text-indigo-600" />
              <h1 className="text-2xl font-bold text-slate-900">Admin sign in</h1>
            </div>
            <p className="text-sm text-slate-500 mb-7">Not an admin? <Link href="/login" className="text-blue-600 font-medium hover:underline">Go to regular sign in</Link></p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input id="email" name="email" type="email" required autoFocus autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="you@captionfox.com" />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <input id="password" name="password" type={showPw ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors">
                {loading ? 'Signing in…' : 'Sign in to Admin'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

// Deliberately not nested under /admin — that tree is guarded by
// admin/layout.tsx, which would redirect an unauthenticated visitor straight
// back to a login page under itself and loop forever.
export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginPageContent />
    </Suspense>
  )
}
