import Link from 'next/link'
import { Store, Check } from 'lucide-react'

export default function SellPage() {
  const benefits = [
    'Reach brands and agencies already creating content in Caption Fox',
    'Get paid securely — funds held in escrow and released on approval',
    'Manage listings, orders and disputes from one supplier dashboard',
  ]
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3"><Store size={22} className="text-blue-600" /></div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Sell your services on Caption Fox</h1>
        <p className="text-sm text-slate-500">For UGC creators, freelancers, ads managers, agencies and influencers.</p>
      </div>
      <ul className="space-y-3 max-w-md mx-auto mb-8">
        {benefits.map(b => <li key={b} className="flex items-start gap-2.5 text-sm text-slate-700"><Check size={16} className="text-emerald-500 shrink-0 mt-0.5" /> {b}</li>)}
      </ul>
      <div className="text-center">
        <button className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition-colors">Become a supplier</button>
        <p className="text-[11px] text-slate-400 mt-3">Supplier onboarding wires to <code>marketplace_suppliers</code> + Stripe Connect (payouts). <Link href="/marketplace" className="text-blue-600 hover:underline">Back to marketplace</Link></p>
      </div>
    </div>
  )
}
