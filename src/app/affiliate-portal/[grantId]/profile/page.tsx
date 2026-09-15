import type { Metadata } from 'next'
import { requireActiveGrant } from '@/lib/affiliate-grant'
import { AffiliateCard, AffiliatePage } from '@/components/affiliate/portal/AffiliatePortalUI'

export const metadata: Metadata = { title: 'Profile — Affiliate Portal' }

export default async function ProfilePage({ params }: { params: Promise<{ grantId: string }> }) {
  const grant = await requireActiveGrant((await params).grantId)
  const rows: [string, string][] = [
    ['Name', grant.fullName ?? '—'],
    ['Sign-in email', grant.email ?? '—'],
    ['Referral code', grant.affiliate.code],
    ['Status', grant.affiliate.status === 'active' ? 'Active' : 'Suspended'],
    ['Payout email', grant.affiliate.payout_email ?? 'Not set'],
    ['Member since', new Date(grant.affiliate.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })],
  ]

  return (
    <AffiliatePage title="Profile" description="Your affiliate account details. Contact support to change your payout email.">
      <AffiliateCard>
        <dl className="divide-y divide-shell-border-soft">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <dt className="text-[13px] font-medium text-shell-muted">{label}</dt>
              <dd className="text-[14px] font-medium text-shell-text">{value}</dd>
            </div>
          ))}
        </dl>
      </AffiliateCard>
    </AffiliatePage>
  )
}
