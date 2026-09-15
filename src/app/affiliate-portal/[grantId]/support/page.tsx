import type { Metadata } from 'next'
import Link from 'next/link'
import { requireActiveGrant } from '@/lib/affiliate-grant'
import { AffiliatePage } from '@/components/affiliate/portal/AffiliatePortalUI'

export const metadata: Metadata = { title: 'Support — Affiliate Portal' }

const OPTIONS = [
  { href: '/contact', title: 'Contact the partnerships team', body: 'Questions about attribution, commission or your account.' },
  { href: '/help', title: 'Help Centre', body: 'Guides on sharing your link and how referrals are tracked.' },
  { href: '/legal/affiliate-terms', title: 'Affiliate terms', body: 'The full programme rules and payout conditions.' },
  { href: '/status', title: 'System status', body: 'Check whether tracking or the platform is affected by an incident.' },
]

export default async function SupportPage({ params }: { params: Promise<{ grantId: string }> }) {
  await requireActiveGrant((await params).grantId)
  return (
    <AffiliatePage title="Support" description="Get help with the affiliate programme.">
      <div className="grid gap-4 sm:grid-cols-2">
        {OPTIONS.map(option => (
          <Link key={option.href} href={option.href} className="rounded-2xl border border-shell-border bg-white p-5 transition-colors hover:border-[#c9d6ea] hover:bg-shell-blue-soft/40">
            <p className="text-[15px] font-semibold text-shell-text">{option.title}</p>
            <p className="mt-1 text-[13.5px] text-shell-text-2">{option.body}</p>
          </Link>
        ))}
      </div>
    </AffiliatePage>
  )
}
