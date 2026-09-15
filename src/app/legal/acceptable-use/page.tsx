import PublicNav from '@/components/marketing/PublicNav'
import PublicFooter from '@/components/marketing/PublicFooter'

export const metadata = { title: 'Acceptable Use Policy — Caption Fox' }

export default function AcceptableUsePage() {
  const updated = '10 June 2026'
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <p className="text-sm text-slate-400 mb-2">Last updated: {updated}</p>
        <h1 className="text-4xl font-extrabold text-slate-900 mb-8">Acceptable Use Policy</h1>

        <div className="space-y-8 text-slate-700 leading-relaxed">
          {[
            {
              title: '1. Purpose',
              body: 'This Acceptable Use Policy ("AUP") sets out the rules for using Caption Fox ("the Service"). It applies to every account, workspace, connected social channel, and API integration. It supplements our Terms of Service — if the two conflict on a specific point, this AUP governs that point.',
            },
            {
              title: '2. Prohibited content',
              body: 'You must not use the Service to create, store, schedule, publish, or distribute content that: (a) is illegal in the jurisdictions you operate in; (b) is defamatory, harassing, hateful, or discriminatory; (c) infringes intellectual property, privacy, or publicity rights; (d) contains malware, phishing links, or deceptive redirects; (e) sexually exploits or endangers minors — this is reported to the relevant authorities without exception; (f) promotes violence, self-harm, or terrorism.',
            },
            {
              title: '3. Prohibited use of AI features',
              body: 'Fox AI must not be used to generate content intended to impersonate a real person without disclosure, defraud or mislead audiences, create non-consensual intimate imagery, manufacture fake reviews or engagement, or produce content that violates this AUP. AI-generated output must always be reviewed by a human before publishing — Caption Fox does not support fully autonomous publishing.',
            },
            {
              title: '4. Platform and account abuse',
              body: 'You must not: (a) attempt to bypass rate limits, usage caps, or plan restrictions; (b) share, resell, or sublicense account access outside your workspace\'s seat allowance without an appropriate plan; (c) scrape, reverse-engineer, or probe the Service\'s infrastructure; (d) use automated means to create accounts or bypass billing; (e) upload files containing malware or attempt to compromise other users\' data.',
            },
            {
              title: '5. Connected social accounts',
              body: 'When you connect a third-party social account (Instagram, X, LinkedIn, Facebook, TikTok, Pinterest, YouTube, or others), you remain responsible for complying with that platform\'s own terms of service, community guidelines, and API usage policies. Caption Fox will suspend scheduling or publishing capability for a connected account if the platform revokes access or reports abuse.',
            },
            {
              title: '6. Spam and unsolicited outreach',
              body: 'You must not use the unified inbox, messaging, or automation features to send unsolicited bulk messages, engage in comment spam, or run engagement schemes (fake likes, follows, or comments) that violate a connected platform\'s policies.',
            },
            {
              title: '7. Marketplace conduct',
              body: 'Suppliers and buyers using the Caption Fox Marketplace must represent their services, pricing, and availability accurately, deliver work as described, and communicate through the Marketplace-tracked channels for any transaction covered by escrow or dispute protection. Attempting to move a Marketplace transaction off-platform to avoid fees or dispute protection is prohibited.',
            },
            {
              title: '8. Reporting violations',
              body: 'If you believe content or activity on Caption Fox violates this policy, contact abuse@captionfox.com with as much detail as possible. We investigate all reports and take action proportionate to the severity of the violation.',
            },
            {
              title: '9. Enforcement',
              body: 'Violations of this AUP may result in content removal, feature restriction, account suspension, or termination, depending on severity and recurrence. We may act without prior notice where content presents legal risk, safety risk, or risk to the Service\'s integrity. Serious or repeated violations may be reported to law enforcement where required by law.',
            },
            {
              title: '10. Changes to this policy',
              body: 'We may update this AUP as new risks or platform requirements emerge. Material changes will be notified by email at least 14 days before they take effect. Continued use of the Service after the effective date constitutes acceptance.',
            },
            {
              title: '11. Contact',
              body: 'Report a violation or ask a question: abuse@captionfox.com | Legal enquiries: legal@captionfox.com | Caption Fox Ltd, England.',
            },
          ].map(({ title, body }) => (
            <section key={title}>
              <h2 className="text-lg font-bold text-slate-900 mb-2">{title}</h2>
              <p>{body}</p>
            </section>
          ))}
        </div>
      </div>

      <PublicFooter />
    </div>
  )
}
