import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { getPartnershipSession } from '@/lib/partnerships/server'
import { listAssets, listPartners, listTerritories, listTiers } from '@/lib/partnerships/data'
import TerritoriesPanel from '@/components/partnerships/TerritoriesPanel'
import AssetsPanel from '@/components/partnerships/AssetsPanel'
import { parsePartnershipQuery } from '@/lib/partnerships/query'
import {
  PROGRAMME_STATUS_BADGE, PROGRAMME_STATUS_LABELS, PROGRAMME_TYPE_LABELS, type ProgrammeType,
} from '@/lib/partnerships/constants'
import { Badge } from '@/components/ui/Badge'
import { Avatar, CARD, CARD_SHADOW, PARTNERSHIPS_PAGE, formatMoney, formatShortDate } from '@/components/partnerships/primitives'
import PartnersTable from '@/components/partnerships/PartnersTable'
import { TierBadge } from '@/components/partnerships/primitives'

export default async function ProgrammeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, ctx, capabilities } = await getPartnershipSession()

  const { data: programme } = await supabase
    .from('partnership_programmes')
    .select('id, workspace_id, name, programme_type, category, description, status, commission_type, commission_rate, currency, tracking_window_days, start_date, end_date, channels, terms_url, created_at, updated_at, owner:profiles!partnership_programmes_owner_id_fkey(id, full_name, email, avatar_url)')
    .eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()

  if (!programme) notFound()

  const owner = Array.isArray(programme.owner) ? programme.owner[0] : programme.owner
  const query = parsePartnershipQuery({})
  const [partners, tiers, territories, assets] = await Promise.all([
    listPartners(supabase, ctx.workspaceId, programme.programme_type as ProgrammeType, { ...query, size: 50 }, { limit: 50, excludeArchived: true }),
    listTiers(supabase, ctx.workspaceId, id),
    programme.programme_type === 'reseller' ? listTerritories(supabase, ctx.workspaceId, id) : Promise.resolve([]),
    ['ambassador', 'co_marketing'].includes(programme.programme_type) ? listAssets(supabase, ctx.workspaceId, { programmeId: id }) : Promise.resolve([]),
  ])

  return (
    <div className={PARTNERSHIPS_PAGE}>
      <header className="mb-4">
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-1 text-xs text-slate-400">
            <li><Link href="/app/partnerships" className="hover:text-slate-600">Partnerships</Link></li>
            <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
            <li><Link href={`/app/partnerships/${programme.programme_type === 'co_marketing' ? 'co-marketing' : `${programme.programme_type}s`}`} className="hover:text-slate-600">{PROGRAMME_TYPE_LABELS[programme.programme_type as ProgrammeType]}</Link></li>
            <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
            <li aria-current="page" className="font-medium text-slate-700">{programme.name}</li>
          </ol>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold leading-tight tracking-tight text-slate-900">{programme.name}</h1>
            <p className="mt-0.5 text-sm text-slate-500">{programme.description ?? 'No description yet.'}</p>
          </div>
          <Badge variant={PROGRAMME_STATUS_BADGE[programme.status as keyof typeof PROGRAMME_STATUS_BADGE] ?? 'slate'}>
            {PROGRAMME_STATUS_LABELS[programme.status as keyof typeof PROGRAMME_STATUS_LABELS] ?? programme.status}
          </Badge>
        </div>
      </header>

      <div className={`${CARD} ${CARD_SHADOW} mb-4 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4`}>
        <div>
          <p className="text-[11px] text-slate-400">Owner</p>
          <div className="mt-1 flex items-center gap-1.5">
            <Avatar person={owner} size={18} />
            <span className="text-[13px] font-medium text-slate-800">{owner?.full_name ?? owner?.email ?? 'Unassigned'}</span>
          </div>
        </div>
        <div>
          <p className="text-[11px] text-slate-400">Commission</p>
          <p className="mt-1 text-[13px] font-medium text-slate-800">
            {programme.commission_type === 'percentage' ? `${programme.commission_rate}%` : formatMoney(programme.commission_rate, programme.currency)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400">Tracking window</p>
          <p className="mt-1 text-[13px] font-medium text-slate-800">{programme.tracking_window_days} days</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400">Dates</p>
          <p className="mt-1 text-[13px] font-medium text-slate-800">{formatShortDate(programme.start_date)} – {programme.end_date ? formatShortDate(programme.end_date) : 'Ongoing'}</p>
        </div>
      </div>

      {tiers.length > 0 && (
        <div className={`${CARD} ${CARD_SHADOW} mb-4 p-4`}>
          <h2 className="mb-2 text-[13px] font-semibold text-slate-900">Tiers</h2>
          <div className="flex flex-wrap gap-2">
            {tiers.map(tier => (
              <span key={tier.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px]">
                <TierBadge name={tier.name} />
                <span className="text-slate-500">from {formatMoney(tier.threshold, programme.currency)}</span>
                {tier.commission_rate != null && <span className="text-slate-400">· {tier.commission_rate}% commission</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {programme.programme_type === 'reseller' && (
        <div className="mb-4">
          <TerritoriesPanel
            programmeId={id} territories={territories} partners={partners.rows}
            canManage={capabilities.manageTerritories}
          />
        </div>
      )}

      {['ambassador', 'co_marketing'].includes(programme.programme_type) && (
        <div className="mb-4">
          <AssetsPanel
            assets={assets} canReview={capabilities.manageAmbassadorContent}
            title={programme.programme_type === 'ambassador' ? 'Content submissions' : 'Co-marketing assets'}
          />
        </div>
      )}

      <h2 className="mb-2 text-[13px] font-semibold text-slate-900">Partners in this programme</h2>
      <PartnersTable
        partners={partners.rows} capabilities={capabilities}
        hrefFor={partner => `/app/partnerships/partners/${partner.id}`}
        primaryLabel="Region"
        emptyMessage="No partners have joined this programme yet."
      />
    </div>
  )
}
