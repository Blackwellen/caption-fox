import Link from 'next/link'
import { LifeBuoy, Mail, MessageCircle, ArrowRight } from 'lucide-react'
import PublicNav from '@/components/marketing/PublicNav'
import PublicFooter from '@/components/marketing/PublicFooter'

export const metadata = { title: 'Help Centre — Caption Fox' }

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-6">
            <LifeBuoy size={24} className="text-blue-600" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-5">Help Centre</h1>
          <p className="text-lg text-slate-600 leading-relaxed mb-12">
            We&apos;re still building out a full searchable help centre. In the meantime, the fastest way to get an answer is
            to reach out directly — a real person reads every message.
          </p>

          <div className="grid sm:grid-cols-2 gap-5 text-left mb-12">
            <div className="border border-slate-200 rounded-xl p-6">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                <Mail size={18} className="text-blue-600" />
              </div>
              <h2 className="font-semibold text-slate-900 mb-1.5">Email support</h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                For account, billing or technical issues. We typically reply within 24 hours.
              </p>
              <a href="mailto:support@captionfox.io" className="text-sm font-medium text-blue-600 hover:underline">
                support@captionfox.io
              </a>
            </div>
            <div className="border border-slate-200 rounded-xl p-6">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                <MessageCircle size={18} className="text-blue-600" />
              </div>
              <h2 className="font-semibold text-slate-900 mb-1.5">Contact form</h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                Prefer a form? Use our contact page and pick the right category for your question.
              </p>
              <Link href="/contact" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
                Go to contact <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          <p className="text-sm text-slate-400">
            Logged-in customers: look for the Fox AI bubble inside your workspace — it can answer many product questions
            instantly, grounded in your own account.
          </p>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
