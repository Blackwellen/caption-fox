import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { getPartnershipSession } from '@/lib/partnerships/server'
import {
  PARTNER_HEALTH_BADGE, PARTNER_HEALTH_LABELS, PARTNER_STATUS_BADGE, PARTNER_STATUS_LABELS,
  COMMISSION_STATUS_BADGE, COMMISSION_STATUS_LABELS,
} from '@/lib/partnerships/constants'
import { Badge } from '@/components/ui/Badge'
import {
  Avatar, CARD, CARD_SHADOW, PARTNERSHIPS_PAGE, PlatformChips, TierBadge,
  formatMoney, formatNumber, formatShortDate,
} from '@/components/partnerships/primitives'
import PartnerActionsMenu from '@/components/partnerships/PartnerActionsMenu'
import { PartnershipsEmpty } from '@/components/partnerships/states'
import TrackingLinksPanel from '@/components/partnerships/TrackingLinksPanel'
import RewardsPanel from '@/components/partnerships/RewardsPanel'
import StripeConnectPanel from '@/components/partnerships/StripeConnectPanel'
import { listRewards, listTrackingLinks } from '@/lib/partnerships/data'

export default async function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, ctx, capabilities } = await getPartnershipSession()

  const { data: partner } = await supabase
    .from('partnership_partners')
    .select('id, workspace_id, programme_id, partner_type, name, handle, email, avatar_url, tier_id, status, platforms, region, health, health_reason, joined_at, last_activity_at, stripe_account_status, owner:profiles!partnership_partners_owner_id_fkey(id, full_name, email, avatar_url), tier:partnership_tiers(id, name), programme:partnership_programmes(id, name, programme_type, currency)')
    .eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()

  if (!partner) notFound()

  const owner = Array.isArray(partner.owner) ? partner.owner[0] : partner.owner
  const tier = Array.isArray(partner.tier) ? partner.tier[0] : partner.tier
  const programme = Array.isArray(partner.programme) ? partner.programme[0] : partner.programme
  const currency = programme?.currency ?? 'GBP'

  const [{ data: conversions }, { data: commissions }, { data: payouts }, trackingLinks, rewards] = await Promise.all([
    supabase.from('partnership_conversions').select('id, conversion_type, value, currency, status, converted_at')
      .eq('workspace_id', ctx.workspaceId).eq('partner_id', id).order('converted_at', { ascending: false }).limit(20),
    supabase.from('partnership_commissions').select('id, amount, currency, status, created_at')
      .eq('workspace_id', ctx.workspaceId).eq('partner_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('partnership_payouts').select('id, period_start, period_end, net_amount, currency, status')
      .eq('workspace_id', ctx.workspaceId).eq('partner_id', id).order('created_at', { ascending: false }).limit(10),
    listTrackingLinks(supabase, ctx.workspaceId, id),
    listRewards(supabase, ctx.workspaceId, { partnerId: id }),
  ])

  const totalRevenue = (conversions ?? []).filter(c => c.status !== 'reversed').reduce((s, c) => s + Number(c.value ?? 0), 0)
  const totalCommission = (commissions ?? []).filter(c => c.status !== 'rejected').reduce((s, c) => s + Number(c.amount ?? 0), 0)

  return (
    <div className={PARTNERSHIPS_PAGE}>
      <header className="mb-4">
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-1 text-xs text-slate-400">
            <li><Link href="/app/partnerships" className="hover:text-slate-600">Partnerships</Link></li>
            <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
            {programme && (
              <>
                <li><Link href={`/app/partnerships/programmes/${programme.id}`} className="hover:text-slate-600">{programme.name}</Link></li>
                <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
              </>
            )}
            <li aria-current="page" className="font-medium text-slate-700">{partner.name}</li>
          </ol>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar person={{ id: partner.id, full_name: partner.name, email: partner.email, avatar_url: partner.avatar_url }} size={40} />
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold leading-tight tracking-tight text-slate-900">{partner.name}</h1>
              <p className="mt-0.5 text-sm text-slate-500">{partner.handle ?? partner.email ?? 'No contact details on file'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={PARTNER_STATUS_BADGE[partner.status as keyof typeof PARTNER_STATUS_BADGE] ?? 'slate'}>
              {PARTNER_STATUS_LABELS[partner.status as keyof typeof PARTNER_STATUS_LABELS] ?? partner.status}
            </Badge>
            <Badge variant={PARTNER_HEALTH_BADGE[partner.health] ?? 'slate'}>
              {PARTNER_HEALTH_LABELS[partner.health] ?? partner.health}
            </Badge>
            <PartnerActionsMenu partnerId={partner.id} status={partner.status} href="#" canEdit={capabilities.editPartner} canApprove={capabilities.approveApplications} />
          </div>
        </div>
      </header>

      <div className={`${CARD} ${CARD_SHADOW} mb-4 grid grid-cols-2 gap-4 p-4 sm:grid-cols-5`}>
        <div><p className="text-[11px] text-slate-400">Owner</p><p className="mt-1 text-[13px] font-medium text-slate-800">{owner?.full_name ?? owner?.email ?? 'Unassigned'}</p></div>
        <div><p className="text-[11px] text-slate-400">Tier</p><div className="mt-1"><TierBadge name={tier?.name} /></div></div>
        <div><p className="text-[11px] text-slate-400">Region</p><p className="mt-1 text-[13px] font-medium text-slate-800">{partner.region ?? '—'}</p></div>
        <div><p className="text-[11px] text-slate-400">Joined</p><p className="mt-1 text-[13px] font-medium text-slate-800">{formatShortDate(partner.joined_at)}</p></div>
        <div><p className="text-[11px] text-slate-400">Platforms</p><div className="mt-1"><PlatformChips platforms={partner.platforms} /></div></div>
      </div>

      <div className={`${CARD} ${CARD_SHADOW} mb-4 grid grid-cols-3 gap-4 p-4`}>
        <div><p className="text-[11px] text-slate-400">Conversions</p><p className="mt-1 text-[18px] font-bold text-slate-900">{formatNumber((conversions ?? []).length)}</p></div>
        <div><p className="text-[11px] text-slate-400">Revenue</p><p className="mt-1 text-[18px] font-bold text-slate-900">{formatMoney(totalRevenue, currency)}</p></div>
        <div><p className="text-[11px] text-slate-400">Commission</p><p className="mt-1 text-[18px] font-bold text-slate-900">{formatMoney(totalCommission, currency)}</p></div>
      </div>

      {partner.health_reason && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
          <strong className="font-semibold">Health note:</strong> {partner.health_reason}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${CARD} ${CARD_SHADOW} p-4`}>
          <h2 className="mb-2 text-[13px] font-semibold text-slate-900">Recent conversions</h2>
          {(conversions ?? []).length === 0 ? (
            <PartnershipsEmpty bare title="No conversions yet" message="Conversions recorded for this partner will appear here." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {(conversions ?? []).map(c => (
                <li key={c.id} className="flex items-center justify-between py-2 text-[13px]">
                  <span className="text-slate-600">{c.conversion_type} · {formatShortDate(c.converted_at)}</span>
                  <span className="font-medium text-slate-900">{formatMoney(c.value, c.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${CARD} ${CARD_SHADOW} p-4`}>
          <h2 className="mb-2 text-[13px] font-semibold text-slate-900">Commissions</h2>
          {(commissions ?? []).length === 0 ? (
            <PartnershipsEmpty bare title="No commissions yet" message="Commissions calculated for this partner will appear here." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {(commissions ?? []).map(c => (
                <li key={c.id} className="flex items-center justify-between py-2 text-[13px]">
                  <span className="flex items-center gap-2 text-slate-600">
                    {formatShortDate(c.created_at)}
                    <Badge variant={COMMISSION_STATUS_BADGE[c.status as keyof typeof COMMISSION_STATUS_BADGE] ?? 'slate'} className="text-[10px]">
                      {COMMISSION_STATUS_LABELS[c.status as keyof typeof COMMISSION_STATUS_LABELS] ?? c.status}
                    </Badge>
                  </span>
                  <span className="font-medium text-slate-900">{formatMoney(c.amount, c.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {(payouts ?? []).length > 0 && (
        <section className={`${CARD} ${CARD_SHADOW} mt-4 p-4`}>
          <h2 className="mb-2 text-[13px] font-semibold text-slate-900">Payout history</h2>
          <ul className="divide-y divide-slate-100">
            {(payouts ?? []).map(p => (
              <li key={p.id} className="flex items-center justify-between py-2 text-[13px]">
                <span className="text-slate-600">{formatShortDate(p.period_start)} – {formatShortDate(p.period_end)}</span>
                <span className="font-medium text-slate-900">{formatMoney(p.net_amount, p.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {['affiliate', 'co_marketing_partner'].includes(partner.partner_type) && (
          <TrackingLinksPanel
            programmeId={partner.programme_id} partnerId={partner.id} links={trackingLinks}
            canManage={capabilities.manageTracking}
          />
        )}
        {['referral_advocate', 'loyalty_member', 'ambassador', 'reseller'].includes(partner.partner_type) && (
          <RewardsPanel
            programmeId={partner.programme_id} partnerId={partner.id} rewards={rewards}
            canManage={capabilities.manageRewards}
          />
        )}
        <StripeConnectPanel
          partnerId={partner.id} status={partner.stripe_account_status ?? 'not_connected'}
          canManage={capabilities.editPartner}
        />
      </div>
    </div>
  )
}
