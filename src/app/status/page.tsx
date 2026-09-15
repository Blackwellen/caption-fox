import { Activity, Mail } from 'lucide-react'
import PublicNav from '@/components/marketing/PublicNav'
import PublicFooter from '@/components/marketing/PublicFooter'

export const metadata = { title: 'Status — Caption Fox' }

export default function StatusPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-6">
            <Activity size={24} className="text-blue-600" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-5">Status</h1>
          <p className="text-lg text-slate-600 leading-relaxed mb-10">
            We&apos;re working on a live, automated status page with real-time uptime monitoring and incident history. It
            isn&apos;t connected yet, so rather than guess at our uptime here, we&apos;d rather tell you plainly: this page is
            coming soon.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-left">
            <h2 className="font-semibold text-slate-900 mb-2">Having an urgent issue right now?</h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              If Caption Fox is down, degraded, or behaving unexpectedly for you, contact support directly and we&apos;ll
              investigate immediately.
            </p>
            <a
              href="mailto:support@captionfox.io"
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              <Mail size={15} /> support@captionfox.io
            </a>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
