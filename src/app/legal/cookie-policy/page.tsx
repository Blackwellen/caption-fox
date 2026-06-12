import Link from 'next/link'

export const metadata = { title: 'Cookie Policy — Caption Fox' }

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-slate-900 text-lg">Caption Fox</Link>
        <div className="flex gap-4">
          <Link href="/legal/privacy" className="text-sm text-slate-500 hover:text-slate-900">Privacy</Link>
          <Link href="/legal/terms" className="text-sm text-slate-500 hover:text-slate-900">Terms</Link>
          <Link href="/login" className="text-sm text-slate-500 hover:text-slate-900">Sign in</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <p className="text-sm text-slate-400 mb-2">Last updated: 10 June 2026</p>
        <h1 className="text-4xl font-extrabold text-slate-900 mb-8">Cookie Policy</h1>

        <div className="space-y-8 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">What are cookies?</h2>
            <p>Cookies are small text files stored on your device when you visit a website. They help websites remember preferences, keep you signed in, and gather analytics data.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Cookies we use</h2>
            <div className="overflow-hidden rounded-xl border border-slate-200 mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-semibold text-slate-700">Cookie</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-700">Type</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-700">Purpose</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-700">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'sb-auth-token', type: 'Essential', purpose: 'Supabase authentication session', duration: 'Session' },
                    { name: 'sb-refresh-token', type: 'Essential', purpose: 'Keeps you signed in between sessions', duration: '7 days' },
                    { name: 'cf_theme', type: 'Functional', purpose: 'Saves your UI preferences', duration: '1 year' },
                    { name: '_cf_analytics', type: 'Analytics', purpose: 'Anonymous usage analytics (no personal data)', duration: '30 days' },
                  ].map((c, i) => (
                    <tr key={c.name} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-800">{c.name}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.type === 'Essential' ? 'bg-blue-100 text-blue-700' : c.type === 'Functional' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'}`}>{c.type}</span></td>
                      <td className="px-4 py-3 text-slate-600">{c.purpose}</td>
                      <td className="px-4 py-3 text-slate-500">{c.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Essential cookies</h2>
            <p>Essential cookies are strictly necessary to operate the Service. They enable authentication and security features. You cannot opt out of essential cookies without being unable to use Caption Fox.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Analytics cookies</h2>
            <p>We use privacy-first analytics to understand how users interact with Caption Fox. Analytics cookies collect anonymous, aggregated data and do not track you across other websites. You can opt out at any time from Settings → Privacy.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Managing cookies</h2>
            <p>You can control cookies through your browser settings. Note that blocking essential cookies will prevent you from signing in. Most browsers allow you to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>See what cookies are stored</li>
              <li>Delete cookies individually or in bulk</li>
              <li>Block cookies from specific sites</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Third-party cookies</h2>
            <p>We do not permit third-party advertising cookies on Caption Fox. If you connect social accounts, those platforms may set their own cookies during the OAuth flow, governed by their respective privacy policies.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Contact</h2>
            <p>Cookie and privacy questions: privacy@captionfox.com</p>
          </section>
        </div>
      </div>
    </div>
  )
}
