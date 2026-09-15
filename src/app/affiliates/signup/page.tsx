'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AlertCircle, CheckCircle2, Gift } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Caption Fox's own affiliate/referral program does not have a separate
// account system today — this is a real application intake (persisted to
// affiliate_applications) reviewed by Platform Admin, kept as its own
// branded, separate flow from regular workspace sign-up.
export default function AffiliateSignupPage() {
  const [form, setForm] = useState({ full_name: '', email: '', website_url: '', promotion_channel: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error: insertError } = await supabase.from('affiliate_applications').insert({
      user_id: user?.id ?? null,
      full_name: form.full_name,
      email: form.email,
      website_url: form.website_url || null,
      promotion_channel: form.promotion_channel || null,
      message: form.message || null,
    })
    setSubmitting(false)
    if (insertError) { setError(insertError.message); return }
    setDone(true)
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)' }}>
        <div className="relative z-10 text-center">
          <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
            <Gift size={32} className="text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Caption Fox Affiliates</h2>
          <p className="text-amber-50 text-lg max-w-xs mx-auto">Earn by referring creators, agencies and brands to Caption Fox.</p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-64 opacity-10" style={{ background: 'radial-gradient(ellipse at bottom, white, transparent)' }} />
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <Image src="/caption-fox-logo-transparent.png" alt="Caption Fox" width={160} height={38} />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            {done ? (
              <div className="text-center py-4">
                <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-4" />
                <h1 className="text-xl font-bold text-slate-900 mb-2">Application received</h1>
                <p className="text-sm text-slate-500 mb-6">We review affiliate applications by hand — we&apos;ll email {form.email} once yours has been reviewed.</p>
                <Link href="/" className="text-sm text-blue-600 font-medium hover:underline">Back to home</Link>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Gift size={18} className="text-amber-600" />
                  <h1 className="text-2xl font-bold text-slate-900">Apply to become an affiliate</h1>
                </div>
                <p className="text-sm text-slate-500 mb-7">Already an affiliate? <Link href="/affiliates/login" className="text-blue-600 font-medium hover:underline">Sign in</Link></p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
                    <input id="full_name" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" placeholder="Jane Doe" />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input id="email" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" placeholder="you@example.com" />
                  </div>
                  <div>
                    <label htmlFor="website_url" className="block text-sm font-medium text-slate-700 mb-1">Website or social profile (optional)</label>
                    <input id="website_url" value={form.website_url} onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" placeholder="https://" />
                  </div>
                  <div>
                    <label htmlFor="promotion_channel" className="block text-sm font-medium text-slate-700 mb-1">How will you promote Caption Fox? (optional)</label>
                    <input id="promotion_channel" value={form.promotion_channel} onChange={e => setForm(f => ({ ...f, promotion_channel: e.target.value }))}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" placeholder="e.g. YouTube channel, newsletter, agency network" />
                  </div>
                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1">Anything else? (optional)</label>
                    <textarea id="message" rows={3} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none" />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      <AlertCircle size={15} className="shrink-0" />{error}
                    </div>
                  )}

                  <button type="submit" disabled={submitting}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors">
                    {submitting ? 'Submitting…' : 'Submit application'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
