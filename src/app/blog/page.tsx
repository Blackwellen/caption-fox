import Link from 'next/link'
import { BookOpen, ArrowRight } from 'lucide-react'
import PublicNav from '@/components/marketing/PublicNav'
import PublicFooter from '@/components/marketing/PublicFooter'

export const metadata = { title: 'Blog — Caption Fox' }

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <section className="py-24 sm:py-32 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-6">
            <BookOpen size={24} className="text-blue-600" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-5">The Caption Fox blog</h1>
          <p className="text-lg text-slate-600 leading-relaxed mb-10">
            We&apos;re building out a library of practical content-strategy guides, product deep dives and playbooks for
            brands, creators and agencies. It&apos;s not live yet — check back soon, or follow the changelog for what we ship
            in the meantime.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/changelog"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
            >
              See the changelog <ArrowRight size={16} />
            </Link>
            <Link
              href="/features"
              className="inline-flex items-center gap-2 text-slate-700 font-medium px-6 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm transition-colors"
            >
              Explore features
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
