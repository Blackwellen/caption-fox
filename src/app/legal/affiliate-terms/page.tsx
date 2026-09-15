import PublicNav from '@/components/marketing/PublicNav'
import PublicFooter from '@/components/marketing/PublicFooter'
import { DIRECT_COMMISSION_RATE, OVERRIDE_COMMISSION_RATE } from '@/lib/affiliate'

export const metadata = { title: 'Affiliate Program Terms — Caption Fox' }

const direct = Math.round(DIRECT_COMMISSION_RATE * 100)
const override = Math.round(OVERRIDE_COMMISSION_RATE * 100)

export default function AffiliateTermsPage() {
  const updated = '15 September 2026'
  const sections = [
    { title: '1. The program', body: 'The Caption Fox Affiliate Program lets approved partners earn commission for referring new paying customers to Caption Fox using a unique referral link. These Affiliate Program Terms apply in addition to our Terms of Service.' },
    { title: '2. Applications and approval', body: 'Anyone can apply. Every application is reviewed by our partnerships team, who may approve, decline or ask for more information at their discretion. You become an affiliate only when your application is approved — submitting an application does not grant access to the affiliate portal or a referral link.' },
    { title: '3. Commission', body: `Approved affiliates earn ${direct}% of a referred customer’s first payment. If you recruit other affiliates through your link, you may also earn a ${override}% override on sales made by those affiliates. Commission is calculated in GBP on the amount actually paid, excluding VAT and refunds.` },
    { title: '4. Qualifying referrals', body: 'A referral qualifies when a new customer signs up through your link and completes a paid plan. Self-referrals, referrals of existing customers, and sign-ups later refunded, charged back or found to be fraudulent do not qualify and any related commission will be reversed.' },
    { title: '5. Payouts', body: 'Payout details are collected after approval, not during application. Commission becomes payable once the referred payment has cleared any refund window and your payout details have been verified. We may withhold payment while investigating suspected abuse.' },
    { title: '6. How you may promote Caption Fox', body: 'Promote Caption Fox honestly and in line with advertising rules, including clearly disclosing that you are an affiliate (for example under the UK CAP Code and FTC guidance). You must not: send spam; bid on Caption Fox trademarks in paid search; make misleading claims about features, pricing or results; offer incentives for sign-ups without our written approval; or impersonate Caption Fox.' },
    { title: '7. Suspension and termination', body: 'We may suspend or remove an affiliate account that breaches these terms, harms our brand or customers, or is inactive for an extended period. You may leave the program at any time. Commission earned legitimately before termination remains payable unless forfeited for a breach.' },
    { title: '8. Changes', body: 'We may update these terms or commission rates. We will give reasonable notice of material changes; continuing to take part after the change takes effect means you accept the updated terms.' },
    { title: '9. Contact', body: 'Questions about the program can be sent through our contact page.' },
  ]
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="mb-2 text-sm text-slate-400">Last updated: {updated}</p>
        <h1 className="mb-8 text-4xl font-extrabold text-slate-900">Affiliate Program Terms</h1>
        <div className="space-y-8 leading-relaxed text-slate-700">
          {sections.map(s => (
            <section key={s.title}>
              <h2 className="mb-2 text-lg font-bold text-slate-900">{s.title}</h2>
              <p>{s.body}</p>
            </section>
          ))}
        </div>
      </div>
      <PublicFooter />
    </div>
  )
}
