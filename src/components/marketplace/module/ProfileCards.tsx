import Link from 'next/link'
import { Clock, Package, Globe2, Zap } from 'lucide-react'
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
function CoverBadge({ profile }: { profile: MarketplaceProfile }) {
  const badge = profile.badges?.[0]
  if (!badge) return null
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
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)]">
      <ProfileCover profile={profile} className={compact ? 'h-24' : 'h-32'}>
        <CoverBadge profile={profile} />
        <SaveButton supplierId={profile.id} saved={ctx.savedIds.has(profile.id)} disabled={!ctx.canSave} variant="overlay" />
      </ProfileCover>

      <div className="flex flex-1 flex-col p-3.5">
        <Link href={profileHref(profile)} className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 hover:text-blue-700">
          <span className="truncate">{profile.display_name}</span>
          <VerifiedMark verified={profile.verified} />
        </Link>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {profile.headline ?? SUPPLIER_TYPE_LABELS[profile.type]}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Rating value={profile.rating} count={profile.reviews_count} />
          <LocationLine location={profile.location} />
        </div>

        {profile.tags && profile.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {profile.tags.slice(0, 3).map(tag => <Chip key={tag} tone="blue">{tag}</Chip>)}
          </div>
        )}

        <div className="mt-2.5">
          <MetricRow items={[
            { value: responseTime(profile.response_time_minutes), label: 'Response time' },
            { value: percent(profile.on_time_delivery_pct), label: 'On-time delivery' },
            { value: compactNumber(profile.projects_count), label: 'Projects' },
          ]} />
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <p className="min-w-0 text-xs text-slate-500">
            Starting from <span className="font-semibold text-slate-900">{startingPrice(profile)}</span>
          </p>
          <Link
            href={profileHref(profile)}
            className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            View profile
          </Link>
        </div>

        <div className="mt-2 flex gap-2">
          <CompareButton
            supplierId={profile.id} query={ctx.query} pathname={ctx.pathname}
            limit={ctx.compareLimit} disabled={!ctx.canCompare} label="Add to comparison"
          />
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
  const rateFrom = profile.starting_price_cents
  const rateTo = rateFrom ? Math.round(rateFrom * 2.1) : null

  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)]">
      <div className="flex items-start gap-3">
        <CompareButton
          supplierId={profile.id} query={ctx.query} pathname={ctx.pathname}
          limit={ctx.compareLimit} disabled={!ctx.canCompare} variant="checkbox" label=""
        />
        <ProfileAvatar profile={profile} size={56} />
        <div className="min-w-0 flex-1">
          <Link href={profileHref(profile)} className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 hover:text-blue-700">
            <span className="truncate">{profile.display_name}</span>
            <VerifiedMark verified={profile.verified} />
          </Link>
          <p className="truncate text-xs text-slate-500">@{profile.slug}</p>
          {profile.badges?.[0] && (
            <span className="mt-1 inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
              {profile.badges[0]}
            </span>
          )}
        </div>
        {profile.verified && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            Verified
          </span>
        )}
      </div>

      {platforms.length > 0 && (
        <div className="mt-3 grid grid-cols-3 divide-x divide-slate-100 rounded-lg border border-slate-100">
          {platforms.map(([platform, count]) => (
            <div key={platform} className="px-2 py-2 text-center">
              <p className="text-xs font-semibold text-slate-900">{compactNumber(count)}</p>
              <p className="mt-0.5 text-[10px] text-slate-400">{PLATFORM_LABELS[platform] ?? platform}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] text-slate-400">Engagement rate</p>
          <p className="text-sm font-semibold text-emerald-600">
            {percent(profile.engagement_rate, 1)}
            {profile.engagement_rate !== null && (
              <span className="ml-1 text-[10px] font-medium text-slate-400">
                {Number(profile.engagement_rate) >= 4.5 ? 'Excellent' : Number(profile.engagement_rate) >= 3 ? 'Very good' : 'Good'}
              </span>
            )}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-slate-400">Audience</p>
          <p className="truncate text-xs font-medium text-slate-800">{profile.audience_summary ?? compactNumber(profile.audience_size)}</p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <LocationLine location={profile.location} />
        {profile.languages?.[0] && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Globe2 size={11} />{profile.languages[0]}</span>
        )}
      </div>

      {profile.tags && profile.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {profile.tags.slice(0, 3).map(tag => <Chip key={tag} tone="blue">{tag}</Chip>)}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
        <div>
          <p className="text-[11px] text-slate-400">Rate range</p>
          <p className="text-xs font-semibold text-slate-900">
            {rateFrom ? `${money(rateFrom)} – ${money(rateTo)}` : 'On request'}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400">Response rate</p>
          <p className="text-xs font-semibold text-slate-900">{percent(profile.job_success_pct)}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <ShortlistButton supplierId={profile.id} shortlisted={ctx.shortlistIds.has(profile.id)} disabled={!ctx.canCompare} />
        <CompareButton
          supplierId={profile.id} query={ctx.query} pathname={ctx.pathname}
          limit={ctx.compareLimit} disabled={!ctx.canCompare}
        />
        <Link
          href={profileHref(profile)}
          className="inline-flex flex-1 items-center justify-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
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
    <article className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)] lg:flex-row">
      <ProfileCover profile={profile} className="h-32 w-full shrink-0 rounded-lg lg:h-auto lg:w-52">
        <CoverBadge profile={profile} />
      </ProfileCover>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={profileHref(profile)} className="flex items-center gap-1.5 text-base font-semibold text-slate-900 hover:text-blue-700">
            <span className="truncate">{profile.display_name}</span>
            <VerifiedMark verified={profile.verified} />
          </Link>
          {profile.badges?.[0] && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">{profile.badges[0]}</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {profile.headline} · {SUPPLIER_TYPE_LABELS[profile.type]}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Rating value={profile.rating} count={profile.reviews_count} />
          {profile.job_success_pct !== null && (
            <span className="text-xs text-slate-500">{percent(profile.job_success_pct)} job success</span>
          )}
        </div>
        {profile.bio && <p className="mt-2 line-clamp-2 text-xs text-slate-600">{profile.bio}</p>}
        {profile.tags && profile.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {profile.tags.slice(0, 4).map(tag => <Chip key={tag}>{tag}</Chip>)}
            {profile.tags.length > 4 && <Chip>+{profile.tags.length - 4}</Chip>}
          </div>
        )}
      </div>

      <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-2.5 border-slate-100 text-xs lg:w-52 lg:border-l lg:pl-5">
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

      <div className="flex shrink-0 flex-col items-stretch gap-2 border-slate-100 lg:w-40 lg:border-l lg:pl-5">
        <div className="text-center">
          <p className="text-[11px] text-slate-400">Starting from</p>
          <p className="text-lg font-bold tracking-tight text-slate-900">{startingPrice(profile)}</p>
          <p className="text-[11px] text-slate-400">
            {profile.price_unit === 'word' ? 'per word' : `per ${profile.price_unit ?? 'project'}`}
          </p>
        </div>
        <Link
          href={profileHref(profile)}
          className="rounded-lg bg-blue-600 px-3 py-2 text-center text-xs font-medium text-white transition hover:bg-blue-700"
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
      <ProfileCover profile={profile} className="h-36">
        <CoverBadge profile={profile} />
        <SaveButton supplierId={profile.id} saved={ctx.savedIds.has(profile.id)} disabled={!ctx.canSave} variant="overlay" />
      </ProfileCover>

      <div className="flex flex-1 flex-col p-3.5">
        <Link href={profileHref(profile)} className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 hover:text-blue-700">
          <span className="truncate">{profile.display_name}</span>
          <VerifiedMark verified={profile.verified} />
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Rating value={profile.rating} count={profile.reviews_count} />
          <LocationLine location={profile.location} />
        </div>

        {profile.tags && profile.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {profile.tags.slice(0, 3).map(tag => <Chip key={tag}>{tag}</Chip>)}
          </div>
        )}

        {profile.platforms && profile.platforms.length > 0 && (
          <p className="mt-2 text-[11px] text-slate-400">
            {profile.platforms.map(platform => PLATFORM_LABELS[platform] ?? platform).join(' · ')}
          </p>
        )}

        <div className="mt-3 grid grid-cols-4 divide-x divide-slate-100 border-y border-slate-100">
          {[
            { value: turnaround(profile.turnaround_hours), label: 'Turnaround' },
            { value: percent(profile.on_time_delivery_pct), label: 'On-time' },
            { value: percent(profile.engagement_rate, 1), label: 'Eng. rate' },
            { value: compactNumber(profile.audience_size), label: 'Avg. views' },
          ].map(metric => (
            <div key={metric.label} className="px-1 py-2 text-center">
              <p className="text-[11px] font-semibold text-slate-900">{metric.value}</p>
              <p className="mt-0.5 text-[9px] leading-tight text-slate-400">{metric.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <div>
            <p className="text-xs text-slate-500">From <span className="font-semibold text-slate-900">{startingPrice(profile)}</span></p>
            <p className="text-[10px] text-slate-400">Basic package</p>
          </div>
          <Link
            href={profileHref(profile)}
            className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
          >
            View profile
          </Link>
        </div>

        <div className="mt-2">
          <CompareButton
            supplierId={profile.id} query={ctx.query} pathname={ctx.pathname}
            limit={ctx.compareLimit} disabled={!ctx.canCompare}
          />
        </div>
      </div>
    </article>
  )
}
