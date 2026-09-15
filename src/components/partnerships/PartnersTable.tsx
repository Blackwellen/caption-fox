import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import PartnerActionsMenu from './PartnerActionsMenu'
import { Avatar, CARD, CARD_SHADOW, formatMoney, formatNumber } from './primitives'
import { TierBadge } from './primitives'
import {
  PARTNER_HEALTH_BADGE, PARTNER_HEALTH_LABELS, PARTNER_STATUS_BADGE, PARTNER_STATUS_LABELS,
} from '@/lib/partnerships/constants'
import type { PartnerRow } from '@/lib/partnerships/types'
import type { PartnershipCapabilities } from '@/lib/partnerships/entitlements'
import { PartnershipsEmpty } from './states'
import { formatRelative } from '@/lib/utils'

export default function PartnersTable({
  partners, capabilities, hrefFor, compact = false, bare = false, emptyMessage, primaryLabel = 'Type',
}: {
  partners: PartnerRow[]
  capabilities: PartnershipCapabilities
  hrefFor: (partner: PartnerRow) => string
  compact?: boolean
  bare?: boolean
  emptyMessage?: string
  primaryLabel?: string
}) {
  if (partners.length === 0) {
    return (
      <PartnershipsEmpty
        bare={bare} icon="search" title="No partners match"
        message={emptyMessage ?? 'No partners match the current filters.'}
      />
    )
  }

  return (
    <div className={cn(!bare && [CARD, CARD_SHADOW], 'overflow-x-auto')}>
      <table className="w-full min-w-[880px] text-left text-[13px]">
        <caption className="sr-only">Partners and their performance</caption>
        <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">Partner / Programme</th>
            <th scope="col" className="px-3 py-2.5 font-medium">{primaryLabel}</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Owner</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Tier</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Conversions</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Commission</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Revenue</th>
            {!compact && <th scope="col" className="px-3 py-2.5 font-medium">Last activity</th>}
            <th scope="col" className="px-3 py-2.5 font-medium">Health</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {partners.map(partner => (
            <tr key={partner.id} className="transition-colors hover:bg-slate-50/60">
              <td className="min-w-0 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Avatar person={{ id: partner.id, full_name: partner.name, email: partner.email, avatar_url: partner.avatar_url }} size={22} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{partner.name}</p>
                    <p className="truncate text-[11px] text-slate-400">{partner.programme?.name ?? '—'}</p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5 text-slate-600">{partner.handle ?? partner.region ?? '—'}</td>
              <td className="px-3 py-2.5">
                <span className="flex items-center gap-1.5">
                  <Avatar person={partner.owner} size={18} />
                  <span className="truncate text-slate-600">{partner.owner?.full_name ?? partner.owner?.email ?? 'Unassigned'}</span>
                </span>
              </td>
              <td className="px-3 py-2.5"><TierBadge name={partner.tier?.name} /></td>
              <td className="px-3 py-2.5">
                <Badge variant={PARTNER_STATUS_BADGE[partner.status as keyof typeof PARTNER_STATUS_BADGE] ?? 'slate'} className="text-[10px]">
                  {PARTNER_STATUS_LABELS[partner.status as keyof typeof PARTNER_STATUS_LABELS] ?? partner.status}
                </Badge>
              </td>
              <td className="px-3 py-2.5 text-right font-medium text-slate-900">{formatNumber(partner.conversions ?? 0)}</td>
              <td className="px-3 py-2.5 text-right font-medium text-slate-900">{formatMoney(partner.commission ?? 0)}</td>
              <td className="px-3 py-2.5 text-right font-medium text-slate-900">{formatMoney(partner.revenue ?? 0)}</td>
              {!compact && <td className="px-3 py-2.5 whitespace-nowrap text-slate-400">{formatRelative(partner.last_activity_at)}</td>}
              <td className="px-3 py-2.5">
                <Badge variant={PARTNER_HEALTH_BADGE[partner.health] ?? 'slate'} className="text-[10px]">
                  {PARTNER_HEALTH_LABELS[partner.health] ?? partner.health}
                </Badge>
              </td>
              <td className="px-3 py-2.5 text-right">
                <PartnerActionsMenu
                  partnerId={partner.id} status={partner.status} href={hrefFor(partner)}
                  canEdit={capabilities.editPartner} canApprove={capabilities.approveApplications}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
