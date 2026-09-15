import { Sparkles } from 'lucide-react'
import PublicNav from '@/components/marketing/PublicNav'
import PublicFooter from '@/components/marketing/PublicFooter'

export const metadata = { title: 'Changelog — Caption Fox' }

const ENTRIES = [
  {
    date: '24 July 2026',
    title: 'Supplier workspace shell',
    body: 'Suppliers on the Caption Fox Marketplace now get their own dedicated workspace shell with a workspace switcher, aligned to the same navigation system as the main app.',
  },
  {
    date: '30 June 2026',
    title: 'Marketplace launch: live supplier listings and escrow ordering',
    body: 'Introduced the Caption Fox Marketplace as a standalone surface — browse and book real suppliers, with escrow-backed ordering and a seller workspace for listing and managing services.',
  },
  {
    date: '30 June 2026',
    title: 'Two-tier affiliate programme',
    body: 'Launched the Caption Fox affiliate programme, including direct and sub-affiliate commission tracking, referral links, and a payout dashboard.',
  },
]

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <section className="py-20 sm:py-24 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-6">
              <Sparkles size={24} className="text-blue-600" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">Changelog</h1>
            <p className="text-lg text-slate-600 leading-relaxed">
              What we&apos;ve shipped recently. We&apos;re a small team moving fast — this list will keep growing as we ship.
            </p>
          </div>

          <div className="space-y-8">
            {ENTRIES.map((e) => (
              <div key={e.title} className="flex gap-6">
                <div className="w-28 shrink-0 pt-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{e.date}</span>
                </div>
                <div className="flex-1 border-l border-slate-200 pl-6 pb-8">
                  <h2 className="font-semibold text-slate-900 mb-1.5">{e.title}</h2>
                  <p className="text-sm text-slate-600 leading-relaxed">{e.body}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-slate-400 mt-4">
            More entries coming as we ship — this page is updated directly from what has actually shipped.
          </p>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
