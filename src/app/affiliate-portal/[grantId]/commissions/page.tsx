import type { Metadata } from 'next'
import { requireActiveGrant } from '@/lib/affiliate-grant'
import { formatGBP } from '@/lib/affiliate'
import { AffiliateCard, AffiliatePage, AffiliateStat, EmptyState } from '@/components/affiliate/portal/AffiliatePortalUI'

export const metadata: Metadata = { title: 'Commissions — Affiliate Portal' }

export default async function CommissionsPage({ params }: { params: Promise<{ grantId: string }> }) {
  const grant = await requireActiveGrant((await params).grantId)
  const { data } = await grant.supabase
    .from('affiliate_referrals')
    .select('id, status, commission_cents, created_at')
    .eq('affiliate_id', grant.affiliate.id)
    .order('created_at', { ascending: false })
    .limit(500)
  const referrals = data ?? []

  const sum = (status: string) => referrals.filter(r => r.status === status).reduce((total, r) => total + (r.commission_cents as number), 0)
  const earned = sum('converted')
  const pending = sum('pending')
  const converted = referrals.filter(r => r.status === 'converted')

  return (
    <AffiliatePage title="Commissions" description="Commission earned from converted referrals and what is still pending.">
      <div className="grid gap-4 sm:grid-cols-3">
        <AffiliateStat label="Earned" value={formatGBP(earned)} hint={`${converted.length} converted referral${converted.length === 1 ? '' : 's'}`} />
        <AffiliateStat label="Pending" value={formatGBP(pending)} hint="Awaiting conversion" />
        <AffiliateStat label="Payout email" value={grant.affiliate.payout_email ? 'On file' : 'Not set'} hint={grant.affiliate.payout_email ?? 'Contact support to add one'} />
      </div>
      <AffiliateCard title="Earned commission">
        {converted.length === 0 ? (
          <EmptyState title="No commission earned yet" body="Commission appears here once a referred customer converts to a paid plan." />
        ) : (
          <ul className="divide-y divide-shell-border-soft">
            {converted.map(r => (
              <li key={r.id} className="flex items-center justify-between py-2.5 text-[13.5px]">
                <span className="text-shell-text-2">{new Date(r.created_at as string).toLocaleDateString('en-GB')}</span>
                <span className="font-semibold tabular-nums text-shell-text">{formatGBP(r.commission_cents as number)}</span>
              </li>
            ))}
          </ul>
        )}
      </AffiliateCard>
    </AffiliatePage>
  )
}
