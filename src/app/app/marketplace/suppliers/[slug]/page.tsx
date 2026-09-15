import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Clock, Package, Globe2, Zap, Languages, ShieldCheck, ArrowLeft, Star,
} from 'lucide-react'
import { requireMarketplaceModule } from '@/lib/marketplace/server'
import {
  MODULE_ROUTES, SUPPLIER_TYPE_LABELS, PLATFORM_LABELS,
  compactNumber, money, percent, responseTime, startingPrice, turnaround,
  type MarketplaceProfile,
} from '@/lib/marketplace/module'
import { getSavedSupplierIds, getShortlistIds } from '@/lib/marketplace/data'
import { MarketplacePage, AccessBlocked } from '@/components/marketplace/module/Layout'
import {
  Panel, Chip, Rating, VerifiedMark, LocationLine, ProfileCover, ProfileAvatar, StatusPill,
} from '@/components/marketplace/module/primitives'
import { SaveButton, ShortlistButton } from '@/components/marketplace/module/ProfileActions'

const PROFILE_COLUMNS = `
  id, slug, display_name, type, headline, tagline, bio, location, region, country,
  avatar_url, cover_url, rating, reviews_count, verified, status, tags, platforms,
  languages, badges, starting_price_cents, price_unit, min_order_cents, currency,
  turnaround_hours, response_time_minutes, on_time_delivery_pct, job_success_pct,
  projects_count, available_now, audience_size, audience_summary, engagement_rate,
  follower_counts, is_demo
`

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return { title: `${slug.replace(/-/g, ' ')} · Marketplace · Caption Fox` }
}

export default async function SupplierDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await requireMarketplaceModule('discover')
  if (!session.access.allowed) {
    return (
      <MarketplacePage module="discover" modules={session.modules} title="Supplier profile" subtitle="Marketplace supplier detail">
        <AccessBlocked access={session.access} title="Supplier profiles are not available" />
      </MarketplacePage>
    )
  }

  const { data } = await session.supabase
    .from('marketplace_suppliers')
    .select(PROFILE_COLUMNS)
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()

  if (!data) notFound()
  const profile = data as unknown as MarketplaceProfile

  const [{ data: listings }, { data: reviews }, savedIds, shortlistIds] = await Promise.all([
    session.supabase
      .from('marketplace_listings')
      .select('id, title, summary, category, price_cents, currency, delivery_days, rating, reviews_count')
      .eq('supplier_id', profile.id).eq('status', 'active').order('price_cents'),
    session.supabase
      .from('marketplace_reviews')
      .select('id, rating, body, created_at')
      .eq('supplier_id', profile.id).order('created_at', { ascending: false }).limit(5),
    getSavedSupplierIds(session),
    getShortlistIds(session),
  ])

  const isCreator = profile.type === 'influencer' || profile.type === 'ugc_creator'
  const followers = Object.entries(profile.follower_counts ?? {}).filter(([, count]) => count > 0)

  return (
    <MarketplacePage
      module="discover" modules={session.modules}
      title={profile.display_name}
      subtitle={profile.headline ?? SUPPLIER_TYPE_LABELS[profile.type]}
      breadcrumb={[
        { label: 'Marketplace', href: MODULE_ROUTES.overview },
        { label: 'Discover', href: MODULE_ROUTES.discover },
        { label: profile.display_name },
      ]}
    >
      <ProfileCover profile={profile} className="h-40 rounded-xl sm:h-48" />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Panel padded>
            <div className="flex flex-wrap items-start gap-4">
              <ProfileAvatar profile={profile} size={64} />
              <div className="min-w-0 flex-1">
                <h2 className="flex items-center gap-1.5 text-lg font-bold text-slate-900">
                  {profile.display_name}
                  <VerifiedMark verified={profile.verified} />
                </h2>
                <p className="text-sm text-slate-500">{profile.tagline ?? profile.headline}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <Rating value={profile.rating} count={profile.reviews_count} />
                  <LocationLine location={profile.location} />
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Package size={11} />{SUPPLIER_TYPE_LABELS[profile.type]}
                  </span>
                  {profile.available_now && (
                    <StatusPill label="Available now" cls="text-emerald-700 bg-emerald-50" dot="bg-emerald-500" />
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <p className="text-xl font-bold tracking-tight text-slate-900">{startingPrice(profile)}</p>
                <p className="text-[11px] text-slate-400">
                  {profile.price_unit === 'word' ? 'per word' : `from · per ${profile.price_unit ?? 'project'}`}
                </p>
                <div className="flex items-center gap-2">
                  <SaveButton
                    supplierId={profile.id} saved={savedIds.includes(profile.id)}
                    disabled={!session.capabilities.save} variant="button"
                  />
                  <ShortlistButton
                    supplierId={profile.id} shortlisted={shortlistIds.includes(profile.id)}
                    disabled={!session.capabilities.compare}
                  />
                </div>
              </div>
            </div>

            {profile.badges && profile.badges.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {profile.badges.map(badge => <Chip key={badge} tone="blue">{badge}</Chip>)}
              </div>
            )}
          </Panel>

          {profile.bio && (
            <Panel title="Overview" padded>
              <p className="text-sm leading-relaxed text-slate-600">{profile.bio}</p>
              {profile.tags && profile.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {profile.tags.map(tag => <Chip key={tag}>{tag}</Chip>)}
                </div>
              )}
            </Panel>
          )}

          {isCreator && followers.length > 0 && (
            <Panel title="Platforms and audience" padded>
              <div className="grid gap-3 sm:grid-cols-3">
                {followers.map(([platform, count]) => (
                  <div key={platform} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
                    <p className="text-lg font-bold text-slate-900">{compactNumber(count)}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{PLATFORM_LABELS[platform] ?? platform}</p>
                  </div>
                ))}
              </div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-400">Engagement rate</dt>
                  <dd className="mt-0.5 font-semibold text-emerald-600">{percent(profile.engagement_rate, 1)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Total audience</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{compactNumber(profile.audience_size)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-slate-400">Audience profile</dt>
                  <dd className="mt-0.5 truncate font-medium text-slate-800">{profile.audience_summary ?? '—'}</dd>
                </div>
              </dl>
            </Panel>
          )}

          <Panel title="Services and packages" padded={false}>
            {!listings || listings.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">
                This supplier has not published packages yet. Send a request to get a scoped quote.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {listings.map(listing => (
                  <li key={listing.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{listing.title}</p>
                      <p className="truncate text-xs text-slate-500">{listing.summary}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        {listing.category && <Chip>{listing.category}</Chip>}
                        {listing.delivery_days && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                            <Clock size={11} />{listing.delivery_days} days
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-slate-900">
                      {money(listing.price_cents, listing.currency)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={`Reviews (${profile.reviews_count})`} padded={false}>
            {!reviews || reviews.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">
                No written reviews yet. The {Number(profile.rating).toFixed(1)} rating is based on
                {' '}{profile.reviews_count} completed orders.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {reviews.map(review => (
                  <li key={review.id} className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1 text-xs">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star
                          key={index} size={12}
                          className={index < review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}
                        />
                      ))}
                    </span>
                    {review.body && <p className="mt-1.5 text-xs text-slate-600">{review.body}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="At a glance" padded>
            <dl className="space-y-2.5 text-xs">
              {[
                { label: 'Turnaround', value: turnaround(profile.turnaround_hours), icon: <Clock size={12} /> },
                { label: 'Response time', value: responseTime(profile.response_time_minutes), icon: <Zap size={12} /> },
                { label: 'On-time delivery', value: percent(profile.on_time_delivery_pct), icon: <ShieldCheck size={12} /> },
                { label: 'Job success', value: percent(profile.job_success_pct), icon: <ShieldCheck size={12} /> },
                { label: 'Projects completed', value: compactNumber(profile.projects_count), icon: <Package size={12} /> },
                { label: 'Minimum order', value: money(profile.min_order_cents, profile.currency), icon: <Package size={12} /> },
                { label: 'Region', value: profile.region ?? '—', icon: <Globe2 size={12} /> },
                { label: 'Languages', value: profile.languages?.join(', ') ?? '—', icon: <Languages size={12} /> },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between gap-3">
                  <dt className="inline-flex items-center gap-1.5 text-slate-500">{row.icon}{row.label}</dt>
                  <dd className="truncate font-semibold text-slate-900">{row.value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Work with this supplier" padded>
            <div className="space-y-2">
              {session.capabilities.createRequest && (
                <Link
                  href={`${MODULE_ROUTES.requests}?supplier=${profile.id}&new=rfq`}
                  className="block rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
                >
                  Request a quote
                </Link>
              )}
              <Link
                href={MODULE_ROUTES.discover}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft size={14} />Back to discovery
              </Link>
            </div>
            <p className="mt-3 text-[11px] leading-snug text-slate-400">
              Orders placed through Caption Fox hold funds in escrow until you approve delivery.
            </p>
          </Panel>
        </div>
      </div>
    </MarketplacePage>
  )
}
