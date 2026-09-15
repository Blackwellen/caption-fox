import type { Metadata } from 'next'
import { maskEmail, requireActiveGrant } from '@/lib/affiliate-grant'
import { formatGBP } from '@/lib/affiliate'
import { AffiliatePage, EmptyState, StatusBadge } from '@/components/affiliate/portal/AffiliatePortalUI'

export const metadata: Metadata = { title: 'Conversions — Affiliate Portal' }

export default async function ConversionsPage({ params }: { params: Promise<{ grantId: string }> }) {
  const grant = await requireActiveGrant((await params).grantId)
  const { data } = await grant.supabase
    .from('affiliate_referrals')
    .select('id, kind, referred_email, status, commission_cents, created_at')
    .eq('affiliate_id', grant.affiliate.id)
    .order('created_at', { ascending: false })
    .limit(200)
  const referrals = data ?? []

  return (
    <AffiliatePage title="Conversions" description="Every signup attributed to your link or code, newest first.">
      {referrals.length === 0 ? (
        <EmptyState title="No conversions yet" body="Share your referral link — signups attributed to you will appear here with their status." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-shell-border bg-white">
          <table className="w-full min-w-[560px] text-left text-[13.5px]">
            <caption className="sr-only">Referred signups</caption>
            <thead className="border-b border-shell-border-soft text-[12px] uppercase tracking-[0.06em] text-shell-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">Referral</th>
                <th scope="col" className="px-5 py-3 font-semibold">Type</th>
                <th scope="col" className="px-5 py-3 font-semibold">Date</th>
                <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                <th scope="col" className="px-5 py-3 text-right font-semibold">Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-shell-border-soft">
              {referrals.map(referral => (
                <tr key={referral.id}>
                  <td className="px-5 py-3 text-shell-text">{maskEmail(referral.referred_email as string | null)}</td>
                  <td className="px-5 py-3 capitalize text-shell-text-2">{referral.kind}</td>
                  <td className="px-5 py-3 text-shell-text-2">{new Date(referral.created_at as string).toLocaleDateString('en-GB')}</td>
                  <td className="px-5 py-3"><StatusBadge status={referral.status as string} /></td>
                  <td className="px-5 py-3 text-right font-medium tabular-nums text-shell-text">{formatGBP(referral.commission_cents as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AffiliatePage>
  )
}
