import Link from 'next/link'
import { Users, Link2, Wallet, ArrowRight, CheckCircle2 } from 'lucide-react'
import PublicNav from '@/components/marketing/PublicNav'
import PublicFooter from '@/components/marketing/PublicFooter'

export const metadata = { title: 'Affiliates — Caption Fox' }

export default function AffiliatesPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-20 sm:pt-24 sm:pb-24" style={{ backgroundColor: '#0C1A2E' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
            <Users size={12} />
            Caption Fox Affiliate Programme
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight mb-5">
            Earn commission for every customer you bring
          </h1>
          <p className="text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
            Share Caption Fox with your audience, clients or network — and get paid a real commission for every subscriber
            who signs up through your link.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 sm:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">How it works</h2>
            <p className="text-slate-600">A two-tier programme — earn directly, and earn on the affiliates you bring in too.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="border border-slate-200 rounded-xl p-6">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                <Link2 size={18} className="text-blue-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Get your link</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Sign up and get a unique referral link and code, tracked automatically to your affiliate account.
              </p>
            </div>
            <div className="border border-slate-200 rounded-xl p-6">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                <Users size={18} className="text-blue-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Share and refer</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Share your link with your audience or network. Every signup through your link is tracked to you.
              </p>
            </div>
            <div className="border border-slate-200 rounded-xl p-6">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                <Wallet size={18} className="text-blue-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Get paid</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Earn commission on referred customers, tracked and payable through your affiliate dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Commission structure */}
      <section className="py-20 sm:py-24 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Two ways to earn</h2>
            <p className="text-slate-600">Direct referrals and a second tier for affiliates you bring into the programme.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border-2 border-blue-600 p-8">
              <div className="text-4xl font-extrabold text-blue-600 mb-2">30%</div>
              <h3 className="font-semibold text-slate-900 mb-2">Direct referral commission</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Earn a commission on a referred customer&apos;s first payment when they sign up through your link.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <div className="text-4xl font-extrabold text-slate-900 mb-2">10%</div>
              <h3 className="font-semibold text-slate-900 mb-2">Sub-affiliate override</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Bring in other affiliates and earn an override on the sales they generate — a second income stream on top of
                your own referrals.
              </p>
            </div>
          </div>
          <ul className="mt-8 grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
            {[
              'Free to join — no cost to become an affiliate',
              'Referral tracking handled automatically',
              'A dedicated affiliate dashboard for your links and payouts',
              'Available to any Caption Fox customer or partner',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-24 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Ready to start earning?</h2>
          <p className="text-slate-600 mb-8">
            Apply in a couple of minutes — we review every application by hand and email you once yours is approved.
          </p>
          <Link
            href="/affiliates/signup"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-xl text-base shadow-sm transition-colors"
          >
            Apply to the affiliate programme <ArrowRight size={18} />
          </Link>
          <p className="mt-4 text-xs text-slate-400">
            Once you&apos;re signed in, you can set up your affiliate account from your workspace.
          </p>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
