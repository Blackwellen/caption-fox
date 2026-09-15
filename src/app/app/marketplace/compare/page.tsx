import Link from 'next/link'
import { ArrowLeft, Check, Minus } from 'lucide-react'
import { requireMarketplaceModule } from '@/lib/marketplace/server'
import type { RawParams } from '@/lib/marketplace/query'
import {
  MODULE_ROUTES, SUPPLIER_TYPE_LABELS, compactNumber, money, percent,
  responseTime, startingPrice, turnaround, type MarketplaceProfile,
} from '@/lib/marketplace/module'
import { getProfilesByIds, getSavedSupplierIds } from '@/lib/marketplace/data'
import { MarketplacePage, AccessBlocked, NoResults } from '@/components/marketplace/module/Layout'
import {
  Panel, ProfileAvatar, Rating, VerifiedMark, Chip, StatusPill,
} from '@/components/marketplace/module/primitives'
import { SaveButton } from '@/components/marketplace/module/ProfileActions'

export const metadata = { title: 'Compare suppliers · Caption Fox' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Row {
  label: string
  get: (profile: MarketplaceProfile) => string
  /** Higher is better — used to highlight the leading column. */
  score?: (profile: MarketplaceProfile) => number | null
}

const ROWS: Row[] = [
  { label: 'Type', get: profile => SUPPLIER_TYPE_LABELS[profile.type] },
  { label: 'Rating', get: profile => `${Number(profile.rating).toFixed(1)} (${profile.reviews_count})`, score: profile => Number(profile.rating) },
  { label: 'Starting price', get: profile => startingPrice(profile), score: profile => profile.starting_price_cents ? -profile.starting_price_cents : null },
  { label: 'Minimum order', get: profile => money(profile.min_order_cents, profile.currency), score: profile => profile.min_order_cents ? -profile.min_order_cents : null },
  { label: 'Turnaround', get: profile => turnaround(profile.turnaround_hours), score: profile => profile.turnaround_hours ? -profile.turnaround_hours : null },
  { label: 'Response time', get: profile => responseTime(profile.response_time_minutes), score: profile => profile.response_time_minutes ? -profile.response_time_minutes : null },
  { label: 'On-time delivery', get: profile => percent(profile.on_time_delivery_pct), score: profile => profile.on_time_delivery_pct ? Number(profile.on_time_delivery_pct) : null },
  { label: 'Job success', get: profile => percent(profile.job_success_pct), score: profile => profile.job_success_pct ? Number(profile.job_success_pct) : null },
  { label: 'Projects completed', get: profile => compactNumber(profile.projects_count), score: profile => profile.projects_count ?? null },
  { label: 'Audience', get: profile => compactNumber(profile.audience_size), score: profile => profile.audience_size ?? null },
  { label: 'Engagement rate', get: profile => percent(profile.engagement_rate, 1), score: profile => profile.engagement_rate ? Number(profile.engagement_rate) : null },
  { label: 'Location', get: profile => profile.location ?? '—' },
  { label: 'Languages', get: profile => profile.languages?.join(', ') || '—' },
  { label: 'Capabilities', get: profile => profile.tags?.slice(0, 4).join(', ') || '—' },
]

export default async function MarketplaceComparePage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const session = await requireMarketplaceModule('discover')
  if (!session.access.allowed || !session.capabilities.compare) {
    return (
      <MarketplacePage module="discover" modules={session.modules} title="Compare suppliers" subtitle="Side-by-side supplier comparison">
        <AccessBlocked
          access={session.access.allowed
            ? { allowed: false, reason: 'permission', upgrade: false, message: 'Your role does not include supplier comparison.' }
            : session.access}
          title="Comparison is not available"
        />
      </MarketplacePage>
    )
  }

  const params = await searchParams
  const raw = (Array.isArray(params.ids) ? params.ids[0] : params.ids) ?? ''
  const ids = raw.split(',').filter(id => UUID.test(id)).slice(0, session.capabilities.compareLimit)

  const [profiles, savedIds] = await Promise.all([
    getProfilesByIds(session.supabase, ids),
    getSavedSupplierIds(session),
  ])

  return (
    <MarketplacePage
      module="discover" modules={session.modules} showDiscoverNav
      title="Compare suppliers"
      subtitle={`Side-by-side comparison of up to ${session.capabilities.compareLimit} profiles.`}
      breadcrumb={[
        { label: 'Marketplace', href: MODULE_ROUTES.overview },
        { label: 'Discover', href: MODULE_ROUTES.discover },
        { label: 'Compare' },
      ]}
      actions={
        <Link
          href={MODULE_ROUTES.discover}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft size={14} />Back to discovery
        </Link>
      }
    >
      {profiles.length === 0 ? (
        <NoResults
          title="Nothing selected to compare"
          description="Choose suppliers from Discover, Influencer search, Services or UGC creators and they will line up here."
          action={
            <Link href={MODULE_ROUTES.discover} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Find suppliers
            </Link>
          }
        />
      ) : (
        <Panel padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Supplier comparison table</caption>
              <thead>
                <tr className="border-b border-slate-200">
                  <th scope="col" className="w-44 px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Metric
                  </th>
                  {profiles.map(profile => (
                    <th key={profile.id} scope="col" className="min-w-52 px-4 py-4 text-left align-top">
                      <div className="flex items-start gap-2.5">
                        <ProfileAvatar profile={profile} size={40} />
                        <div className="min-w-0">
                          <Link
                            href={`/app/marketplace/suppliers/${profile.slug}`}
                            className="flex items-center gap-1 text-sm font-semibold text-slate-900 hover:text-blue-700"
                          >
                            <span className="truncate">{profile.display_name}</span>
                            <VerifiedMark verified={profile.verified} />
                          </Link>
                          <p className="truncate text-[11px] font-normal text-slate-500">{profile.headline}</p>
                          <div className="mt-1.5">
                            <Rating value={profile.rating} count={profile.reviews_count} />
                          </div>
                          {profile.available_now && (
                            <div className="mt-1.5">
                              <StatusPill label="Available now" cls="text-emerald-700 bg-emerald-50" dot="bg-emerald-500" />
                            </div>
                          )}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ROWS.map(row => {
                  // Only highlight a leader when every column has a comparable value.
                  const scores = row.score ? profiles.map(row.score) : []
                  const comparable = scores.length > 1 && scores.every(value => value !== null)
                  const best = comparable ? Math.max(...(scores as number[])) : null

                  return (
                    <tr key={row.label} className="hover:bg-slate-50/60">
                      <th scope="row" className="px-5 py-3 text-left text-xs font-normal text-slate-500">{row.label}</th>
                      {profiles.map((profile, index) => {
                        const leading = comparable && scores[index] === best
                        const value = row.get(profile)
                        return (
                          <td key={profile.id} className="px-4 py-3">
                            <span className={leading ? 'inline-flex items-center gap-1 font-semibold text-emerald-700' : 'text-slate-800'}>
                              {leading && <Check size={13} className="shrink-0" />}
                              {value === '—' && !leading ? <Minus size={13} className="text-slate-300" /> : value}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
                <tr>
                  <th scope="row" className="px-5 py-4 text-left text-xs font-normal text-slate-500">Actions</th>
                  {profiles.map(profile => (
                    <td key={profile.id} className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <SaveButton
                          supplierId={profile.id} saved={savedIds.includes(profile.id)}
                          disabled={!session.capabilities.save}
                        />
                        <Link
                          href={`/app/marketplace/suppliers/${profile.slug}`}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          View profile
                        </Link>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
            A green tick marks the leading value on rows where every selected supplier has a comparable figure.
            Blank metrics are not counted against a supplier.
          </p>
        </Panel>
      )}

      {profiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {profiles.map(profile => (
            <Chip key={profile.id} tone="blue">{profile.display_name}</Chip>
          ))}
        </div>
      )}
    </MarketplacePage>
  )
}
