import Link from 'next/link'
import { Sparkles, Target, Users, ArrowRight } from 'lucide-react'
import PublicNav from '@/components/marketing/PublicNav'
import PublicFooter from '@/components/marketing/PublicFooter'

export const metadata = { title: 'About — Caption Fox' }

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-20 sm:pt-24 sm:pb-24" style={{ backgroundColor: '#0C1A2E' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
            <Sparkles size={12} />
            Our story
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight mb-6">
            Content teams shouldn&apos;t need six different tools
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Caption Fox exists because running a modern social presence — content, campaigns, UGC, community and reporting — got
            spread across too many disconnected apps. We built one platform that holds all of it together.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-20 sm:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-8 text-slate-700 leading-relaxed">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Why we built Caption Fox</h2>
            <p>
              Before Caption Fox, running a brand&apos;s social presence usually meant a scheduling tool for posts, a separate
              spreadsheet for campaign planning, a shared drive for creative assets, a group chat for approvals, and yet another
              tool bolted on for analytics. None of these talked to each other, and every handoff between them was a place
              things got lost — a caption that never got approved, a UGC submission nobody followed up on, a campaign budget
              nobody was tracking against results.
            </p>
            <p className="mt-4">
              We set out to build a single platform where the whole lifecycle of a piece of content — brief, create, approve,
              schedule, publish, engage, and report — lives in one connected workspace. Caption Fox pairs that workflow with
              Fox AI, an AI content copilot trained on your brand voice, so the platform doesn&apos;t just organise your work —
              it helps you do more of it.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Who we build for</h2>
            <p>
              Caption Fox is built for the people actually doing the work: solo creators managing their own channels, in-house
              marketing teams running campaigns for a single brand, and agencies juggling calendars, approvals and reporting
              across many clients at once. The platform scales from a single free workspace up to unlimited brands and
              white-label reporting for agencies — the same underlying product, sized to fit.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">What we care about</h2>
            <div className="grid sm:grid-cols-3 gap-5 mt-6">
              {[
                {
                  icon: <Target size={20} className="text-blue-600" />,
                  title: 'Depth over breadth',
                  desc: 'We would rather do campaign management, UGC and analytics properly than bolt on twenty shallow features.',
                },
                {
                  icon: <Sparkles size={20} className="text-violet-600" />,
                  title: 'AI that assists, not replaces',
                  desc: 'Fox AI drafts and suggests. A human always reviews and approves before anything publishes.',
                },
                {
                  icon: <Users size={20} className="text-emerald-600" />,
                  title: 'Fair, transparent pricing',
                  desc: 'A permanent free tier, honest plan limits, and no surprise fees as your team grows.',
                },
              ].map((v) => (
                <div key={v.title} className="border border-slate-200 rounded-xl p-5">
                  <div className="w-9 h-9 bg-slate-50 rounded-lg flex items-center justify-center mb-3">{v.icon}</div>
                  <h3 className="font-semibold text-slate-900 text-sm mb-1.5">{v.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">Want to know more?</h2>
          <p className="text-slate-600 mb-8">
            Read about what&apos;s on the roadmap, or reach out directly — we read every message.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
            >
              Get in touch <ArrowRight size={16} />
            </Link>
            <Link
              href="/roadmap"
              className="inline-flex items-center gap-2 text-slate-700 font-medium px-6 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm transition-colors"
            >
              See the roadmap
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
