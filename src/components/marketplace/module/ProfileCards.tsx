import Link from 'next/link'
import { Clock, Package, Globe2, Star, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  MARKETPLACE_BASE, SUPPLIER_TYPE_LABELS, PLATFORM_LABELS,
  compactNumber, money, percent, responseTime, startingPrice, turnaround,
  type MarketplaceProfile,
} from '@/lib/marketplace/module'
import type { MarketplaceQuery } from '@/lib/marketplace/query'
import {
  Chip, LocationLine, MetricRow, ProfileAvatar, ProfileCover, Rating, VerifiedMark,
} from './primitives'
import { CompareButton, SaveButton, ShortlistButton } from './ProfileActions'

export interface CardContext {
  query: MarketplaceQuery
  /** Recent-work thumbnails per supplier, preloaded by the page. */
  portfolio?: Map<string, { media_url: string; title: string | null }[]>
  pathname: string
  savedIds: Set<string>
  shortlistIds: Set<string>
  canSave: boolean
  canCompare: boolean
  compareLimit: number
}

function profileHref(profile: MarketplaceProfile) {
  return `${MARKETPLACE_BASE}/suppliers/${profile.slug}`
}

/** Top-left ribbon derived from the profile's real badge list. */
function CoverBadge({ profile, placement = 'top' }: { profile: MarketplaceProfile; placement?: 'top' | 'bottom' }) {
  const badge = profile.badges?.[0]
  if (!badge) return null
  if (placement === 'bottom') {
    // UGC reference: a light pill sitting on the lower edge of the cover.
    return (
      <span className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded-md bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 shadow-sm lg:text-[9px]">
        <Star size={9} className="text-emerald-600" />{badge}
      </span>
    )
  }
  const tone = badge.includes('Top') ? 'bg-blue-600'
    : badge.includes('Pro') || badge.includes('Featured') ? 'bg-emerald-600'
      : badge.includes('Fast') ? 'bg-sky-600' : 'bg-violet-600'
  return (
    <span className={cn('absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold text-white', tone)}>
      {badge}
    </span>
  )
}

// ── Supplier / discovery card ────────────────────────────────────────────────

export function SupplierCard({ profile, ctx, compact }: { profile: MarketplaceProfile; ctx: CardContext; compact?: boolean }) {
  // The compact variant backs the reference's three-up "Featured suppliers"
  // panel: cover, identity, rating/location, then price and turnaround only.
  if (compact) {
    return (
      <article className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)]">
        <ProfileCover profile={profile} className="h-28 lg:h-[62px]">
          <CoverBadge profile={profile} />
          <SaveButton supplierId={profile.id} saved={ctx.savedIds.has(profile.id)} disabled={!ctx.canSave} variant="overlay" />
        </ProfileCover>
        <div className="flex flex-1 flex-col p-3.5 lg:px-2.5 lg:py-1.5">
          <Link href={profileHref(profile)} className="flex items-center gap-1 text-sm font-semibold text-slate-900 hover:text-blue-700 lg:text-[11px]">
            <span className="truncate">{profile.display_name}</span>
            <VerifiedMark verified={profile.verified} />
          </Link>
          <p className="mt-0.5 truncate text-xs text-slate-500 lg:text-[9px] lg:leading-tight">
            {profile.headline ?? SUPPLIER_TYPE_LABELS[profile.type]}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 lg:flex-nowrap lg:gap-x-1.5 lg:overflow-hidden">
            <span className="shrink-0"><Rating value={profile.rating} count={profile.reviews_count} /></span>
            <LocationLine location={profile.location} />
          </div>
          <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-slate-500 lg:pt-1.5 lg:text-[9.5px]">
            <span>From <span className="font-semibold text-slate-900">{startingPrice(profile)}</span></span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Clock size={11} className="lg:h-2.5 lg:w-2.5" />{turnaround(profile.turnaround_hours)}
            </span>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)]">
      <ProfileCover profile={profile} className="h-40 lg:h-[104px]">
        <CoverBadge profile={profile} />
        <CompareButton
          supplierId={profile.id} query={ctx.query} pathname={ctx.pathname}
          limit={ctx.compareLimit} disabled={!ctx.canCompare} variant="overlay" placement="bottom-right"
        />
        <SaveButton supplierId={profile.id} saved={ctx.savedIds.has(profile.id)} disabled={!ctx.canSave} variant="overlay" />
      </ProfileCover>

      <div className="flex flex-1 flex-col p-3.5 lg:px-2.5 lg:py-2">
        <Link href={profileHref(profile)} className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 hover:text-blue-700 lg:text-[11.5px]">
          <span className="truncate">{profile.display_name}</span>
          <VerifiedMark verified={profile.verified} />
        </Link>
        <p className="mt-0.5 truncate text-xs text-slate-500 lg:text-[9.5px]">
          {profile.headline ?? SUPPLIER_TYPE_LABELS[profile.type]}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 lg:mt-1 lg:flex-nowrap lg:gap-x-2 lg:overflow-hidden">
          <span className="shrink-0"><Rating value={profile.rating} count={profile.reviews_count} /></span>
          <LocationLine location={profile.location} />
        </div>

        {profile.tags && profile.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap items-start gap-1 lg:mt-1 lg:h-[18px] lg:flex-nowrap lg:overflow-hidden [&>span]:flex [&>span>span]:lg:leading-[14px]">
            {profile.tags.slice(0, 3).map((tag, index) => (
              // The third chip would clip mid-word in a four-up column.
              <span key={tag} className={index === 2 ? 'lg:!hidden' : undefined}>
                <Chip tone="blue"><span className="lg:inline-block lg:max-w-[70px] lg:truncate lg:align-bottom">{tag}</span></Chip>
              </span>
            ))}
          </div>
        )}

        <div className="mt-2.5 lg:mt-1.5">
          <MetricRow items={[
            { value: responseTime(profile.response_time_minutes), label: 'Response time' },
            { value: percent(profile.on_time_delivery_pct), label: 'On-time delivery' },
            { value: compactNumber(profile.projects_count), label: 'Projects' },
          ]} />
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-3 lg:pt-1.5">
          <p className="min-w-0 whitespace-nowrap text-xs text-slate-500 lg:text-[9.5px]">
            <span className="lg:hidden">Starting from </span><span className="hidden lg:inline">From </span>
            <span className="font-semibold text-slate-900">{startingPrice(profile)}</span>
          </p>
          {/* Reference footer is price + View profile; compare lives on the cover. */}
          <Link
            href={profileHref(profile)}
            className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 lg:px-2 lg:py-1 lg:text-[9px]"
          >
            View profile
          </Link>
        </div>
      </div>
    </article>
  )
}

/** Dense list row used by the alternate "List" view on discovery surfaces. */
export function SupplierRow({ profile, ctx }: { profile: MarketplaceProfile; ctx: CardContext }) {
  return (
    <article className="flex flex-col gap-3 border-b border-slate-100 p-4 last:border-b-0 sm:flex-row sm:items-center">
      <ProfileAvatar profile={profile} size={44} />
      <div className="min-w-0 flex-1">
        <Link href={profileHref(profile)} className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 hover:text-blue-700">
          <span className="truncate">{profile.display_name}</span>
          <VerifiedMark verified={profile.verified} />
        </Link>
        <p className="truncate text-xs text-slate-500">{profile.headline ?? SUPPLIER_TYPE_LABELS[profile.type]}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Rating value={profile.rating} count={profile.reviews_count} />
          <LocationLine location={profile.location} />
          <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Clock size={11} />{turnaround(profile.turnaround_hours)}</span>
        </div>
      </div>
      <div className="hidden w-40 shrink-0 lg:block">
        <p className="text-xs text-slate-400">On-time delivery</p>
        <p className="text-sm font-semibold text-slate-900">{percent(profile.on_time_delivery_pct)}</p>
      </div>
      <div className="w-32 shrink-0">
        <p className="text-xs text-slate-400">Starting from</p>
        <p className="text-sm font-semibold text-slate-900">{startingPrice(profile)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <SaveButton supplierId={profile.id} saved={ctx.savedIds.has(profile.id)} disabled={!ctx.canSave} />
        <CompareButton
          supplierId={profile.id} query={ctx.query} pathname={ctx.pathname}
          limit={ctx.compareLimit} disabled={!ctx.canCompare} variant="icon"
        />
        <Link href={profileHref(profile)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
          View profile
        </Link>
      </div>
    </article>
  )
}

// ── Influencer card ──────────────────────────────────────────────────────────

export function InfluencerCard({ profile, ctx }: { profile: MarketplaceProfile; ctx: CardContext }) {
  const followers = profile.follower_counts ?? {}
  const platforms = Object.entries(followers).filter(([, count]) => count > 0).slice(0, 3)
  const engagement = profile.engagement_rate === null ? null : Number(profile.engagement_rate)

  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)] lg:p-3">
      <div className="flex items-start gap-3 lg:gap-2.5">
        <CompareButton
          supplierId={profile.id} query={ctx.query} pathname={ctx.pathname}
          limit={ctx.compareLimit} disabled={!ctx.canCompare} variant="checkbox" label=""
        />
        <span className="shrink-0 [&_*]:lg:!h-12 [&_*]:lg:!w-12"><ProfileAvatar profile={profile} size={56} /></span>
        <div className="min-w-0 flex-1 pt-0.5">
          <Link href={profileHref(profile)} className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 hover:text-blue-700 lg:gap-1 lg:text-[11px]">
            <span className="truncate">{profile.display_name}</span>
            <VerifiedMark verified={profile.verified} />
          </Link>
          <p className="truncate text-xs text-slate-500 lg:text-[9px]">@{profile.slug}</p>
          {profile.badges?.[0] && (
            <span className="mt-1 inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 lg:mt-0.5 lg:py-px lg:text-[8.5px]">
              {profile.badges[0]}
            </span>
          )}
        </div>
      </div>

      {platforms.length > 0 && (
        <div className="mt-3 grid grid-cols-3 divide-x divide-slate-100 rounded-lg border border-slate-100 lg:mt-2.5">
          {platforms.map(([platform, count]) => (
            <div key={platform} className="px-2 py-2 text-center lg:py-1">
              <p className="text-xs font-semibold text-slate-900 lg:text-[10px]">{compactNumber(count)}</p>
              <p className="mt-0.5 text-[10px] text-slate-400 lg:mt-0 lg:text-[8px]">{PLATFORM_LABELS[platform] ?? platform}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 lg:mt-2 lg:gap-2">
        <div>
          <p className="text-[11px] text-slate-400 lg:text-[8.5px]">Engagement rate</p>
          <p className="text-sm font-semibold text-emerald-600 lg:text-[11px]">
            {percent(profile.engagement_rate, 1)}
            {engagement !== null && (
              <span className="ml-1 text-[10px] font-medium text-slate-400 lg:text-[8px]">
                {engagement >= 4.5 ? 'Excellent' : engagement >= 3 ? 'Very good' : 'Good'}
              </span>
            )}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-slate-400 lg:text-[8.5px]">Audience</p>
          <p className="truncate text-xs font-medium text-slate-800 lg:text-[9.5px]">{profile.audience_summary ?? compactNumber(profile.audience_size)}</p>
        </div>
      </div>

      {/* Reference: location, language and niche tags share one row. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 lg:mt-2 lg:h-[18px] lg:gap-x-1.5 lg:overflow-hidden">
        <span className="shrink-0 [&>span]:lg:text-[8.5px]"><LocationLine location={profile.location} /></span>
        {profile.languages?.[0] && (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-500 lg:text-[8.5px]"><Globe2 size={11} className="lg:h-2.5 lg:w-2.5" />{profile.languages[0]}</span>
        )}
        {(profile.tags ?? []).slice(0, 3).map(tag => (
          <span key={tag} className="flex shrink-0 [&>span]:lg:text-[8px] [&>span]:lg:leading-[14px]"><Chip tone="blue">{tag}</Chip></span>
        ))}
      </div>

      {/* Reference: "Recent campaigns" thumbnails, drawn from the creator's portfolio. */}
      {(ctx.portfolio?.get(profile.id)?.length ?? 0) > 0 && (
        <div className="mt-2.5 flex items-center gap-2 lg:mt-2 lg:gap-1.5">
          <p className="w-14 shrink-0 text-[11px] leading-tight text-slate-400 lg:w-11 lg:text-[8.5px]">Recent campaigns</p>
          <PortfolioStrip
            items={ctx.portfolio?.get(profile.id)}
            name={profile.display_name}
            className="mt-0 min-w-0 flex-1 lg:mt-0 [&_img]:lg:aspect-auto [&_img]:lg:h-[26px]"
          />
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 lg:mt-2 lg:gap-2 lg:pt-2">
        <div>
          <p className="text-[11px] text-slate-400 lg:text-[8.5px]">Starting rate</p>
          <p className="text-xs font-semibold text-slate-900 lg:text-[10px]">
            {profile.starting_price_cents ? `From ${startingPrice(profile)}` : 'On request'}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400 lg:text-[8.5px]">Response rate</p>
          <p className="text-xs font-semibold text-slate-900 lg:text-[10px]">{percent(profile.job_success_pct)}</p>
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2 pt-3 lg:gap-1.5 lg:pt-2 [&_button]:lg:py-1 [&_button]:lg:text-[9px]">
        <ShortlistButton supplierId={profile.id} shortlisted={ctx.shortlistIds.has(profile.id)} disabled={!ctx.canCompare} />
        <CompareButton
          supplierId={profile.id} query={ctx.query} pathname={ctx.pathname}
          limit={ctx.compareLimit} disabled={!ctx.canCompare}
        />
        <Link
          href={profileHref(profile)}
          className="inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 lg:px-2 lg:py-1 lg:text-[9.5px]"
        >
          View profile
        </Link>
      </div>
    </article>
  )
}

// ── Service provider row ─────────────────────────────────────────────────────

export function ServiceCard({ profile, ctx }: { profile: MarketplaceProfile; ctx: CardContext }) {
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 transition lg:gap-3.5 lg:p-3 hover:border-slate-300 hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)] lg:flex-row">
      {/* Reference: cover with the provider's recent work directly beneath it. */}
      <div className="flex w-full shrink-0 flex-col lg:w-[232px]">
        <ProfileCover profile={profile} className="h-32 w-full rounded-lg lg:h-[92px] lg:flex-1">
          <CoverBadge profile={profile} />
        </ProfileCover>
        <PortfolioStrip items={ctx.portfolio?.get(profile.id)} name={profile.display_name} className="lg:mt-1 lg:gap-1 [&_img]:lg:aspect-auto [&_img]:lg:h-[28px]" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={profileHref(profile)} className="flex items-center gap-1.5 text-base font-semibold text-slate-900 hover:text-blue-700 lg:text-[12.5px]">
            <span className="truncate">{profile.display_name}</span>
            <VerifiedMark verified={profile.verified} />
          </Link>
          {profile.badges?.[0] && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 lg:text-[8.5px]">{profile.badges[0]}</span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500 lg:text-[9.5px]">
          {profile.headline} · {SUPPLIER_TYPE_LABELS[profile.type]}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 lg:mt-1">
          <Rating value={profile.rating} count={profile.reviews_count} />
          {profile.job_success_pct !== null && (
            <span className="text-xs text-slate-500 lg:text-[9.5px]">{percent(profile.job_success_pct)} job success</span>
          )}
        </div>
        {profile.bio && <p className="mt-2 line-clamp-2 text-xs text-slate-600 lg:mt-1 lg:line-clamp-1 lg:text-[9.5px]">{profile.bio}</p>}
        {profile.tags && profile.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1 lg:mt-1.5 lg:h-[18px] lg:overflow-hidden">
            {profile.tags.slice(0, 4).map(tag => <Chip key={tag}>{tag}</Chip>)}
            {profile.tags.length > 4 && <Chip>+{profile.tags.length - 4}</Chip>}
          </div>
        )}

      </div>

      <dl className="grid shrink-0 grid-cols-2 content-center gap-x-5 gap-y-2.5 border-slate-100 text-xs lg:w-48 lg:gap-y-3 lg:border-l lg:pl-4 lg:text-[10px]">
        <div>
          <dt className="flex items-center gap-1 text-slate-400"><Clock size={11} />Turnaround</dt>
          <dd className="mt-0.5 font-medium text-slate-800">{turnaround(profile.turnaround_hours)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-slate-400"><Package size={11} />Min. order</dt>
          <dd className="mt-0.5 font-medium text-slate-800">{money(profile.min_order_cents, profile.currency)}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Location</dt>
          <dd className="mt-0.5 truncate font-medium text-slate-800">{profile.location ?? '—'}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-slate-400"><Zap size={11} />Response</dt>
          <dd className="mt-0.5 font-medium text-slate-800">{responseTime(profile.response_time_minutes)}</dd>
        </div>
      </dl>

      <div className="flex shrink-0 flex-col items-stretch justify-center gap-2 border-slate-100 lg:w-36 lg:gap-1.5 lg:border-l lg:pl-4">
        <div className="text-center">
          <p className="text-[11px] text-slate-400 lg:text-[9px]">Starting from</p>
          <p className="text-lg font-bold tracking-tight text-slate-900 lg:text-[15px] lg:leading-5">{startingPrice(profile)}</p>
          <p className="text-[11px] text-slate-400 lg:text-[9px]">
            {profile.price_unit === 'word' ? 'per word' : `per ${profile.price_unit ?? 'project'}`}
          </p>
        </div>
        <Link
          href={profileHref(profile)}
          className="rounded-lg bg-blue-600 px-3 py-2 text-center text-xs font-medium text-white transition hover:bg-blue-700 lg:py-1.5 lg:text-[10px]"
        >
          View profile
        </Link>
        <div className="flex items-center justify-center gap-2">
          <SaveButton supplierId={profile.id} saved={ctx.savedIds.has(profile.id)} disabled={!ctx.canSave} />
          <CompareButton
            supplierId={profile.id} query={ctx.query} pathname={ctx.pathname}
            limit={ctx.compareLimit} disabled={!ctx.canCompare} variant="icon"
          />
        </div>
      </div>
    </article>
  )
}

// ── UGC creator card ─────────────────────────────────────────────────────────

export function UgcCreatorCard({ profile, ctx }: { profile: MarketplaceProfile; ctx: CardContext }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)]">
      <ProfileCover profile={profile} className="h-40 lg:h-[118px]">
        <CompareButton
          supplierId={profile.id} query={ctx.query} pathname={ctx.pathname}
          limit={ctx.compareLimit} disabled={!ctx.canCompare} variant="overlay"
        />
        <CoverBadge profile={profile} placement="bottom" />
        <SaveButton supplierId={profile.id} saved={ctx.savedIds.has(profile.id)} disabled={!ctx.canSave} variant="overlay" />
      </ProfileCover>

      <div className="flex flex-1 flex-col p-3.5 lg:px-3 lg:pb-2.5 lg:pt-2">
        <Link href={profileHref(profile)} className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 hover:text-blue-700 lg:text-[12px]">
          <span className="truncate">{profile.display_name}</span>
          <VerifiedMark verified={profile.verified} />
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 lg:mt-0.5">
          <Rating value={profile.rating} count={profile.reviews_count} />
          <LocationLine location={profile.location} />
        </div>

        {profile.tags && profile.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1 lg:mt-1.5">
            {profile.tags.slice(0, 3).map(tag => <Chip key={tag}>{tag}</Chip>)}
          </div>
        )}

        {profile.platforms && profile.platforms.length > 0 && (
          <ul className="mt-2 flex items-center gap-1.5 lg:mt-1.5" aria-label="Platforms">
            {profile.platforms.slice(0, 5).map(platform => (
              <li key={platform} title={PLATFORM_LABELS[platform] ?? platform}>
                <PlatformGlyph platform={platform} />
              </li>
            ))}
          </ul>
        )}

        <PortfolioStrip items={ctx.portfolio?.get(profile.id)} name={profile.display_name} />

        <div className="mt-2.5 grid grid-cols-4 lg:mt-2">
          {[
            { value: turnaround(profile.turnaround_hours), label: 'Turnaround' },
            { value: percent(profile.on_time_delivery_pct), label: 'On-time' },
            { value: percent(profile.engagement_rate, 1), label: 'Eng. rate' },
            { value: compactNumber(profile.audience_size), label: 'Avg. views' },
          ].map(metric => (
            <div key={metric.label} className="px-1 py-1.5 text-center">
              <p className="text-[11px] font-semibold text-slate-900 lg:text-[10.5px]">{metric.value}</p>
              <p className="mt-0.5 text-[9px] leading-tight text-slate-400 lg:text-[8.5px]">{metric.label}</p>
            </div>
          ))}
        </div>

        {/* Reference footer: price, View profile and Compare share a single row. */}
        <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-2.5 lg:pt-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-slate-500 lg:text-[10px]">From <span className="font-semibold text-slate-900">{startingPrice(profile)}</span></p>
            <p className="text-[10px] text-slate-400 lg:text-[8.5px]">Basic package</p>
          </div>
          <Link
            href={profileHref(profile)}
            className="shrink-0 rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50 lg:px-2 lg:py-1 lg:text-[10px]"
          >
            View profile
          </Link>
          <div className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 lg:[&_label]:text-[10px]">
            <CompareButton
              supplierId={profile.id} query={ctx.query} pathname={ctx.pathname}
              limit={ctx.compareLimit} disabled={!ctx.canCompare} variant="checkbox"
            />
          </div>
        </div>
      </div>
    </article>
  )
}

/**
 * Recent-work strip shown on creator and service cards. Renders nothing when a
 * supplier has no portfolio rows rather than showing placeholder tiles.
 */
function PortfolioStrip({
  items, name, className,
}: {
  items?: { media_url: string; title: string | null }[]
  name: string
  className?: string
}) {
  if (!items || items.length === 0) return null
  return (
    <ul className={cn('mt-2 grid grid-cols-4 gap-1 lg:mt-1.5', className)}>
      {items.slice(0, 4).map(item => (
        <li key={item.media_url} className="overflow-hidden rounded-md bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.media_url}
            alt={item.title ? `${name} — ${item.title}` : `Recent work by ${name}`}
            loading="lazy"
            width={96}
            height={96}
            className="aspect-square h-auto w-full object-cover"
          />
        </li>
      ))}
    </ul>
  )
}

/**
 * Small monochrome platform marks. Simplified shapes rather than official
 * artwork; anything unknown falls back to a lettered tile.
 */
function PlatformGlyph({ platform }: { platform: string }) {
  const box = 'flex h-[18px] w-[18px] items-center justify-center rounded-[5px] bg-slate-900 text-white lg:h-4 lg:w-4'
  const label = PLATFORM_LABELS[platform] ?? platform
  if (platform === 'instagram') {
    return (
      <span className={box} role="img" aria-label={label}>
        <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <rect x="2" y="2" width="12" height="12" rx="3.5" /><circle cx="8" cy="8" r="2.8" />
        </svg>
      </span>
    )
  }
  if (platform === 'youtube') {
    return (
      <span className={box} role="img" aria-label={label}>
        <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
          <path d="M6 4.5v7L11.8 8z" />
        </svg>
      </span>
    )
  }
  if (platform === 'tiktok') {
    return (
      <span className={box} role="img" aria-label={label}>
        <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
          <path d="M9.2 1.5h2.1c.2 1.5 1.1 2.5 2.7 2.7v2.1c-1 0-1.9-.3-2.7-.8v4.6A3.9 3.9 0 1 1 7.4 6.3v2.2a1.8 1.8 0 1 0 1.8 1.6z" />
        </svg>
      </span>
    )
  }
  return (
    <span className={cn(box, 'text-[8px] font-bold')} role="img" aria-label={label}>
      {label.charAt(0)}
    </span>
  )
}
