import { Mail, Newspaper } from 'lucide-react'
import PublicNav from '@/components/marketing/PublicNav'
import PublicFooter from '@/components/marketing/PublicFooter'

export const metadata = { title: 'Press — Caption Fox' }

export default function PressPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-6">
            <Newspaper size={24} className="text-blue-600" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-5">Press</h1>
          <p className="text-lg text-slate-600 leading-relaxed mb-10">
            Writing about Caption Fox, or looking for a comment or a demo for a story? We&apos;re happy to help.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-left mb-10">
            <h2 className="font-semibold text-slate-900 mb-2">About Caption Fox</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Caption Fox is an AI-powered social media content platform for brands, creators and agencies. It brings content
              creation, scheduling, campaign management, UGC workflows, a unified social inbox, and analytics into a single
              connected workspace, paired with Fox AI — an AI content copilot trained on each customer&apos;s brand voice.
              Caption Fox is built by a small, independent team.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-left">
            <h2 className="font-semibold text-slate-900 mb-2">Press enquiries</h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              For interviews, comments, product screenshots or briefings, reach out directly — we aim to respond within one
              business day.
            </p>
            <a
              href="mailto:press@captionfox.io"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              <Mail size={15} /> press@captionfox.io
            </a>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
