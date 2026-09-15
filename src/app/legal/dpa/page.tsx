import PublicNav from '@/components/marketing/PublicNav'
import PublicFooter from '@/components/marketing/PublicFooter'

export const metadata = { title: 'Data Processing Agreement — Caption Fox' }

export default function DpaPage() {
  const updated = '10 June 2026'
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <p className="text-sm text-slate-400 mb-2">Last updated: {updated}</p>
        <h1 className="text-4xl font-extrabold text-slate-900 mb-3">Data Processing Agreement</h1>
        <p className="text-slate-500 mb-8">
          This Data Processing Agreement (&ldquo;DPA&rdquo;) forms part of the agreement between Caption Fox Ltd (&ldquo;Processor&rdquo;, &ldquo;we&rdquo;) and the
          customer using Caption Fox under our Terms of Service (&ldquo;Controller&rdquo;, &ldquo;you&rdquo;), and applies wherever we process personal
          data on your behalf as part of the Service. It reflects UK GDPR and EU GDPR requirements for controller-processor
          relationships.
        </p>

        <div className="space-y-8 text-slate-700 leading-relaxed">
          {[
            {
              title: '1. Subject matter and duration',
              body: 'This DPA governs the processing of personal data by Caption Fox on your behalf in order to provide the social media content management platform described in our Terms of Service. It applies for as long as we process personal data under your instructions, and terminates automatically when that processing ends.',
            },
            {
              title: '2. Nature and purpose of processing',
              body: 'We process personal data to operate the Service: storing and scheduling your content, managing your unified inbox (comments, mentions, and DMs from connected social accounts), running analytics on your published content, supporting UGC and campaign workflows, and providing Fox AI features you choose to use. We do not process personal data for any purpose incompatible with providing the Service.',
            },
            {
              title: '3. Categories of data subjects',
              body: 'Personal data processed under this DPA may relate to: your workspace users and team members; your audience members who comment, message, or interact with your connected social accounts; creators and suppliers you work with through UGC, campaign, or Marketplace workflows; and individuals named in content you upload or generate.',
            },
            {
              title: '4. Categories of personal data',
              body: 'Typical categories include: names, handles, and profile information from connected social accounts; message and comment content routed through the unified inbox; content assets (images, video, captions) you upload or generate; usage and analytics data tied to your account; and billing contact details. Special category data should not be knowingly submitted to the Service.',
            },
            {
              title: '5. Controller instructions',
              body: 'We process personal data only on your documented instructions, which are given by your use of the Service and its configurable settings (e.g. which social accounts you connect, what content you upload, what automations you enable). We will inform you if we believe an instruction infringes UK GDPR, EU GDPR, or other applicable data protection law.',
            },
            {
              title: '6. Confidentiality',
              body: 'We ensure that any person authorised to process personal data on our behalf (including employees and contractors) is subject to a duty of confidentiality, whether contractual or statutory.',
            },
            {
              title: '7. Security measures',
              body: 'We implement appropriate technical and organisational measures to protect personal data, including: encryption of data in transit and at rest; row-level security enforced at the database layer (Supabase); role-based access controls within workspaces; and regular security review of the platform. Full detail is available in our Privacy Policy.',
            },
            {
              title: '8. Sub-processors',
              body: 'We use sub-processors to provide parts of the Service, including our database and infrastructure provider (Supabase), our AI provider (Anthropic), and our payments provider (Stripe). We will not engage a new sub-processor that processes personal data without giving you the opportunity to object, and any sub-processor is bound by data protection obligations no less protective than this DPA.',
            },
            {
              title: '9. International transfers',
              body: 'Where personal data is transferred outside the UK or EEA (for example, to a sub-processor located in the US), the transfer is made subject to appropriate safeguards, including Standard Contractual Clauses or an equivalent lawful transfer mechanism.',
            },
            {
              title: '10. Data subject rights assistance',
              body: 'Taking into account the nature of the processing, we will assist you, through appropriate technical and organisational measures, in responding to requests from data subjects exercising their rights under UK GDPR or EU GDPR (access, rectification, erasure, restriction, portability, and objection).',
            },
            {
              title: '11. Personal data breach notification',
              body: 'We will notify you without undue delay after becoming aware of a personal data breach affecting your data, and provide information reasonably necessary for you to meet any obligation to report the breach to a supervisory authority or affected data subjects.',
            },
            {
              title: '12. Deletion or return of data',
              body: 'On termination of the Service, and subject to any legal retention obligations, we will delete or return personal data processed on your behalf, in line with the retention terms described in our Privacy Policy.',
            },
            {
              title: '13. Audit rights',
              body: 'We will make available information reasonably necessary to demonstrate compliance with this DPA and allow for, and contribute to, audits conducted by you or an auditor you mandate, subject to reasonable notice and confidentiality safeguards.',
            },
            {
              title: '14. Governing law',
              body: 'This DPA is governed by the laws of England and Wales, consistent with the governing law of our Terms of Service.',
            },
            {
              title: '15. Contact',
              body: 'Data protection enquiries: privacy@captionfox.com | Legal enquiries: legal@captionfox.com | Caption Fox Ltd, England.',
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
