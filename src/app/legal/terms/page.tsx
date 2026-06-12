import Link from 'next/link'

export const metadata = { title: 'Terms of Service — Caption Fox' }

export default function TermsPage() {
  const updated = '10 June 2026'
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-slate-900 text-lg">Caption Fox</Link>
        <div className="flex gap-4">
          <Link href="/legal/privacy" className="text-sm text-slate-500 hover:text-slate-900">Privacy</Link>
          <Link href="/legal/cookie-policy" className="text-sm text-slate-500 hover:text-slate-900">Cookies</Link>
          <Link href="/login" className="text-sm text-slate-500 hover:text-slate-900">Sign in</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <p className="text-sm text-slate-400 mb-2">Last updated: {updated}</p>
        <h1 className="text-4xl font-extrabold text-slate-900 mb-8">Terms of Service</h1>

        <div className="space-y-8 text-slate-700 leading-relaxed">
          {[
            {
              title: '1. Acceptance of terms',
              body: 'By accessing or using Caption Fox ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you are using the Service on behalf of an organisation, you agree to these Terms on their behalf. If you do not agree, do not use the Service.',
            },
            {
              title: '2. Description of service',
              body: 'Caption Fox is a cloud-based social media content management platform that uses AI to help users plan, create, schedule, and analyse social media content. Features include a content calendar, campaign management, UGC workflow, inbox management, and analytics.',
            },
            {
              title: '3. Accounts and workspace',
              body: 'You are responsible for maintaining the security of your account. You must notify us immediately of any unauthorised access. We reserve the right to terminate accounts that violate these Terms.',
            },
            {
              title: '4. Acceptable use',
              body: `You agree not to: (a) post or publish illegal, defamatory, or abusive content; (b) use the Service to spam or harass others; (c) attempt to reverse engineer, scrape or disrupt the Service; (d) circumvent billing or access restrictions; (e) use AI-generated content to mislead, impersonate, or defraud; (f) violate any applicable law or regulation.`,
            },
            {
              title: '5. AI-generated content',
              body: 'You are solely responsible for reviewing, editing, and approving all AI-generated content before publishing. Caption Fox AI may produce inaccurate or inappropriate output. We are not liable for any content you publish using our AI tools. AI must not publish content autonomously — all publishing is initiated by you.',
            },
            {
              title: '6. Social platform compliance',
              body: 'By connecting social accounts, you grant us permission to act on your behalf to schedule and publish content you approve. You remain responsible for complying with each platform\'s terms of service. We are not affiliated with any social media platform.',
            },
            {
              title: '7. Subscription and billing',
              body: 'Paid plans are billed monthly or annually via Stripe. You can cancel at any time; cancellation takes effect at the end of the current billing period. We do not offer refunds for unused time, except as required by law. We reserve the right to change pricing with 30 days notice.',
            },
            {
              title: '8. Intellectual property',
              body: 'You retain ownership of all content you create or upload. You grant us a limited, non-exclusive licence to host, process, and display your content to provide the Service. We retain ownership of the Caption Fox platform, software, and brand.',
            },
            {
              title: '9. Privacy',
              body: 'Our Privacy Policy describes how we collect and use your data. By using the Service, you agree to our Privacy Policy.',
            },
            {
              title: '10. Limitation of liability',
              body: 'To the maximum extent permitted by law, Caption Fox shall not be liable for indirect, incidental, or consequential damages. Our total liability to you shall not exceed the amount you paid us in the 12 months preceding the claim.',
            },
            {
              title: '11. Warranty disclaimer',
              body: 'The Service is provided "as is" without any warranty. We do not guarantee uptime, accuracy of AI output, or suitability for any particular purpose. We aim for 99.9% uptime but do not guarantee it.',
            },
            {
              title: '12. Governing law',
              body: 'These Terms are governed by the laws of England and Wales. Any disputes shall be resolved in the courts of England and Wales.',
            },
            {
              title: '13. Changes to terms',
              body: 'We may update these Terms. We will notify you by email 14 days before material changes take effect. Continued use after the effective date constitutes acceptance.',
            },
            {
              title: '14. Contact',
              body: 'Legal enquiries: legal@captionfox.com | Caption Fox Ltd, England.',
            },
          ].map(({ title, body }) => (
            <section key={title}>
              <h2 className="text-lg font-bold text-slate-900 mb-2">{title}</h2>
              <p>{body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
