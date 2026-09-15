import Link from 'next/link'
import { Compass, Sparkles, BarChart2, Users, Globe } from 'lucide-react'
import PublicNav from '@/components/marketing/PublicNav'
import PublicFooter from '@/components/marketing/PublicFooter'

export const metadata = { title: 'Roadmap — Caption Fox' }

const THEMES = [
  {
    icon: <Sparkles size={20} className="text-violet-600" />,
    title: 'Deeper Fox AI',
    desc: 'Expanding Fox AI beyond captions and replies into fuller campaign planning and content-performance recommendations.',
  },
  {
    icon: <Globe size={20} className="text-blue-600" />,
    title: 'More platform connections',
    desc: 'Extending scheduling, inbox and analytics coverage to more social platforms as demand grows.',
  },
  {
    icon: <Users size={20} className="text-emerald-600" />,
    title: 'Marketplace growth',
    desc: 'Continuing to build out the supplier marketplace — more categories, stronger trust and dispute tooling.',
  },
  {
    icon: <BarChart2 size={20} className="text-amber-600" />,
    title: 'Reporting and integrations',
    desc: 'Deeper analytics exports and integrations with the tools agencies and teams already run their business on.',
  },
]

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <section className="py-20 sm:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-6">
              <Compass size={24} className="text-blue-600" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">What we&apos;re building next</h1>
            <p className="text-lg text-slate-600 leading-relaxed max-w-xl mx-auto">
              We keep our roadmap directional rather than a list of dated promises — priorities shift based on what our
              customers need most. Here&apos;s where our attention is going.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {THEMES.map((t) => (
              <div key={t.title} className="border border-slate-200 rounded-xl p-6 hover:border-slate-300 hover:shadow-sm transition-all">
                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center mb-4">{t.icon}</div>
                <h3 className="font-semibold text-slate-900 mb-2">{t.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-14">
            <p className="text-slate-600 mb-4">Have a feature request or want to influence what we build next?</p>
            <Link href="/contact" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
              Tell us what you need →
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
