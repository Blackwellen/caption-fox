'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Shield, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function MFAPage() {
  const router = useRouter()
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const refs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null))

  function handleChange(i: number, val: string) {
    if (!/^\d?$/.test(val)) return
    const next = [...code]
    next[i] = val
    setCode(next)
    if (val && i < 5) refs[i + 1].current?.focus()
    if (!val && i > 0) refs[i - 1].current?.focus()
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('')
    const next = [...code]
    digits.forEach((d, i) => { next[i] = d })
    setCode(next)
    refs[Math.min(digits.length, 5)].current?.focus()
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    const otp = code.join('')
    if (otp.length < 6) { setError('Enter the 6-digit code'); return }
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) { setError('Session expired. Please sign in again.'); setLoading(false); return }
    const { error } = await supabase.auth.verifyOtp({ email: user.email, token: otp, type: 'email' })
    if (error) { setError('Invalid or expired code. Try again.'); setCode(['','','','','','']); refs[0].current?.focus(); setLoading(false); return }
    router.push('/app/home')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Image src="/caption-fox-logo-transparent.png" alt="Caption Fox" width={160} height={38} />
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Shield size={28} className="text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Two-factor authentication</h1>
          <p className="text-sm text-slate-500 mb-8">Enter the 6-digit code sent to your email address.</p>

          <form onSubmit={handleVerify} className="space-y-6">
            <div className="flex gap-2 justify-center" onPaste={handlePaste}>
              {code.map((d, i) => (
                <input key={i} ref={refs[i]} type="text" inputMode="numeric" maxLength={1} value={d}
                  onChange={e => handleChange(i, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Backspace' && !code[i] && i > 0) refs[i - 1].current?.focus() }}
                  className="w-12 h-14 text-center text-xl font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              ))}
            </div>
            {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 text-left"><AlertCircle size={15} className="shrink-0" />{error}</div>}
            <button type="submit" disabled={loading || code.join('').length < 6} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors">
              {loading ? 'Verifying…' : 'Verify code'}
            </button>
          </form>

          <div className="mt-6 space-y-2">
            <button className="text-sm text-blue-600 hover:underline">Resend code</button>
            <div /><Link href="/login" className="text-sm text-slate-500 hover:text-slate-700">Cancel and return to sign in</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
