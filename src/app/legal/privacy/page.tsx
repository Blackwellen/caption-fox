import Link from 'next/link'

export const metadata = { title: 'Privacy Policy — Caption Fox' }

export default function PrivacyPage() {
  const updated = '10 June 2026'
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-slate-900 text-lg">Caption Fox</Link>
        <div className="flex gap-4">
          <Link href="/legal/terms" className="text-sm text-slate-500 hover:text-slate-900">Terms</Link>
          <Link href="/legal/cookie-policy" className="text-sm text-slate-500 hover:text-slate-900">Cookies</Link>
          <Link href="/login" className="text-sm text-slate-500 hover:text-slate-900">Sign in</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <p className="text-sm text-slate-400 mb-2">Last updated: {updated}</p>
        <h1 className="text-4xl font-extrabold text-slate-900 mb-8">Privacy Policy</h1>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Who we are</h2>
            <p>Caption Fox is operated by Caption Fox Ltd ("we", "our", "us"). We provide an AI-powered social media content management platform accessible at captionfox.com and related subdomains.</p>
            <p className="mt-2">Data controller: Caption Fox Ltd. Contact: privacy@captionfox.com</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Data we collect</h2>
            <p className="font-semibold mb-2">Account data</p>
            <p>When you create an account we collect your name, email address, and password (hashed). If you sign in via Google OAuth, we receive your name and email from Google.</p>
            <p className="font-semibold mt-4 mb-2">Workspace and content data</p>
            <p>We store content you create, schedule, or publish through Caption Fox — including captions, media files, campaign details, and social channel access tokens necessary for posting.</p>
            <p className="font-semibold mt-4 mb-2">Usage data</p>
            <p>We collect information about how you use Caption Fox, including pages visited, features used, AI generation history, and error logs. This helps us improve the product.</p>
            <p className="font-semibold mt-4 mb-2">Payment data</p>
            <p>Payments are processed by Stripe. We store your subscription plan and billing history but never see or store your full card number.</p>
            <p className="font-semibold mt-4 mb-2">Cookies and tracking</p>
            <p>We use essential cookies for authentication, and optional analytics cookies. See our <Link href="/legal/cookie-policy" className="text-blue-600 hover:underline">Cookie Policy</Link> for details.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. How we use your data</h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li>To provide, operate and improve the Caption Fox service</li>
              <li>To process payments and manage subscriptions</li>
              <li>To send transactional emails (receipts, password resets, notifications)</li>
              <li>To respond to support requests</li>
              <li>To detect and prevent fraud and abuse</li>
              <li>To comply with our legal obligations</li>
            </ul>
            <p className="mt-3">We do <strong>not</strong> sell your personal data to third parties. We do not use your content to train AI models without your explicit consent.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Legal basis (UK GDPR)</h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li><strong>Contract:</strong> processing your account data to deliver the service</li>
              <li><strong>Legitimate interests:</strong> improving the product, preventing fraud, security monitoring</li>
              <li><strong>Consent:</strong> marketing emails and optional analytics cookies</li>
              <li><strong>Legal obligation:</strong> audit logs, tax records</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Data sharing</h2>
            <p>We share data with:</p>
            <ul className="list-disc list-inside space-y-1.5 mt-2">
              <li><strong>Supabase</strong> — database, auth and storage provider</li>
              <li><strong>Anthropic</strong> — AI content generation (prompts and outputs)</li>
              <li><strong>Stripe</strong> — payment processing</li>
              <li><strong>Social platforms</strong> — for content scheduling (e.g. Meta, TikTok APIs)</li>
            </ul>
            <p className="mt-3">All sub-processors are bound by data processing agreements and comply with applicable privacy laws.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">6. Data retention</h2>
            <p>We retain your account data for as long as your account is active. If you delete your account, we permanently delete your personal data within 30 days, except where we are required by law to retain it (e.g. financial records, 7 years).</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">7. Your rights</h2>
            <p>Under UK GDPR you have the right to:</p>
            <ul className="list-disc list-inside space-y-1.5 mt-2">
              <li>Access your personal data</li>
              <li>Rectify inaccurate data</li>
              <li>Erase your data ("right to be forgotten")</li>
              <li>Restrict or object to processing</li>
              <li>Data portability (receive your data in a machine-readable format)</li>
              <li>Withdraw consent at any time</li>
            </ul>
            <p className="mt-3">To exercise any right, email privacy@captionfox.com. We will respond within 30 days.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">8. Security</h2>
            <p>We use industry-standard security measures including TLS encryption in transit, AES-256 at rest, row-level security in our database, audit logging, and two-factor authentication. We undergo regular security reviews.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">9. International transfers</h2>
            <p>Your data is stored primarily in the EU (Supabase). Some processing may occur in the US (Anthropic, Stripe). All international transfers are made under appropriate safeguards (Standard Contractual Clauses).</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">10. Changes to this policy</h2>
            <p>We may update this policy. We&apos;ll notify you via email or in-app notification for material changes. Continued use after the effective date constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">11. Contact & complaints</h2>
            <p>Questions: privacy@captionfox.com</p>
            <p className="mt-2">You also have the right to lodge a complaint with the ICO (UK): <span className="text-blue-600">ico.org.uk</span></p>
          </section>
        </div>
      </div>
    </div>
  )
}
