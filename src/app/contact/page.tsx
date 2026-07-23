'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Mail, MessageCircle, Clock } from 'lucide-react'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', category: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const sb = createClient()
    const { error: err } = await sb.from('support_tickets').insert({
      name: form.name,
      email: form.email,
      subject: form.subject,
      category: form.category,
      message: form.message,
      status: 'open',
    })
    if (err) { setError('Something went wrong. Please try again.'); setLoading(false); return }
    setSubmitted(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-slate-900 text-lg">Caption Fox</Link>
        <div className="flex items-center gap-4">
          <Link href="/marketplace" className="hidden sm:inline text-sm text-slate-600 hover:text-slate-900">Marketplace</Link>
          <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900">Sign in</Link>
          <Link href="/signup" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">Get started</Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-14">
          <h1 className="text-4xl font-extrabold text-slate-900 mb-4">Get in touch</h1>
          <p className="text-lg text-slate-500">We&apos;re here to help. Expect a reply within 24 hours.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Info */}
          <div className="space-y-6">
            {[
              { icon: Mail, title: 'Email us', desc: 'hello@captionfox.com', sub: 'For general enquiries' },
              { icon: MessageCircle, title: 'Live chat', desc: 'Available in-app', sub: 'For active subscribers' },
              { icon: Clock, title: 'Response time', desc: '< 24 hours', sub: 'Mon–Fri, 9am–6pm GMT' },
            ].map(({ icon: Icon, title, desc, sub }) => (
              <div key={title} className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0"><Icon size={18} className="text-blue-600" /></div>
                <div><p className="font-semibold text-slate-900">{title}</p><p className="text-sm text-slate-700">{desc}</p><p className="text-xs text-slate-400">{sub}</p></div>
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="lg:col-span-2">
            {submitted ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4"><Mail size={28} className="text-emerald-600" /></div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Message received!</h3>
                <p className="text-slate-500">We&apos;ll get back to you at {form.email} within 24 hours.</p>
                <Link href="/" className="mt-6 inline-block text-sm text-blue-600 hover:underline">Back to home</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Name</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Your name" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Email</label><input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="you@example.com" /></div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select category</option>
                    {['Billing', 'Technical issue', 'Account', 'Feature request', 'Partnership', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Subject</label><input required value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Brief description of your question" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Message</label><textarea required rows={6} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Describe your issue or question in detail…" /></div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors">
                  {loading ? 'Sending…' : 'Send message'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
