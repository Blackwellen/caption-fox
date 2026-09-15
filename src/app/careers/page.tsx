import Link from 'next/link'
import { Mail, Heart } from 'lucide-react'
import PublicNav from '@/components/marketing/PublicNav'
import PublicFooter from '@/components/marketing/PublicFooter'

export const metadata = { title: 'Careers — Caption Fox' }

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-6">
            <Heart size={24} className="text-blue-600" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-5">Careers at Caption Fox</h1>
          <p className="text-lg text-slate-600 leading-relaxed mb-10">
            We&apos;re not actively hiring right now — Caption Fox is a small, focused team and we&apos;d rather grow slowly and
            deliberately than post roles for the sake of it. But we&apos;re always interested in hearing from exceptional
            people who care about content tooling, AI, and building something brands and creators genuinely rely on.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-left">
            <h2 className="font-semibold text-slate-900 mb-2">Want to get on our radar?</h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              Send us a short note about what you do and why Caption Fox interests you. We keep every message on file and
              reach out when a relevant opening comes up.
            </p>
            <a
              href="mailto:careers@captionfox.io"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              <Mail size={15} /> careers@captionfox.io
            </a>
          </div>

          <p className="mt-8 text-sm text-slate-400">
            Prefer to talk about something else? <Link href="/contact" className="text-blue-600 hover:underline">Contact us</Link> instead.
          </p>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
