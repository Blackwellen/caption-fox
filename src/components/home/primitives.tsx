import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight, BarChart3, Calendar, CheckCircle2, FileText, Home, Inbox, LayoutGrid, Settings, ShieldCheck, Users, Zap,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { DemoPerson, Tone } from './demo-data'

/** Shared outer width for every homepage section: 1360px content at 1440. */
export const CONTAINER = 'mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10'

export function Eyebrow({ children, className, align = 'center' }: { children: ReactNode; className?: string; align?: 'center' | 'left' }) {
  return (
    <p className={cn('text-[12px] font-semibold uppercase tracking-[0.24em] text-cf-blue-deep sm:text-[13px]', align === 'center' && 'text-center', className)}>
      {children}
    </p>
  )
}

export function SectionTitle({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <h2
      id={id}
      className={cn(
        'text-balance text-[32px] font-extrabold leading-[1.06] tracking-[-0.02em] text-cf-ink sm:text-[40px] lg:text-[48px]',
        className,
      )}
    >
      {children}
    </h2>
  )
}

export function Accent({ children }: { children: ReactNode }) {
  return <span className="text-cf-blue">{children}</span>
}

export function Lead({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-[16px] leading-[1.55] text-cf-muted sm:text-[18px]', className)}>{children}</p>
}

interface CtaProps {
  href: string
  children: ReactNode
  variant?: 'primary' | 'secondary'
  size?: 'lg' | 'md' | 'sm'
  className?: string
  arrow?: boolean
}

/** Link styled as a button. All homepage CTAs are real navigations, so they are links. */
export function Cta({ href, children, variant = 'primary', size = 'md', className, arrow = true }: CtaProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group inline-flex min-h-11 items-center justify-center gap-2.5 whitespace-nowrap rounded-[12px] font-semibold tracking-[-0.01em] transition-[background-color,border-color,box-shadow,transform] duration-200 ease-cf',
        size === 'lg' && 'h-[60px] px-[30px] text-[18px]',
        size === 'md' && 'h-[48px] px-[22px] text-[15px]',
        size === 'sm' && 'h-[40px] px-4 text-[14px]',
        variant === 'primary' && 'bg-cf-blue text-white shadow-cf-button hover:bg-cf-blue-deep',
        variant === 'secondary' && 'border border-cf-line-strong bg-white text-cf-ink hover:border-cf-blue/40 hover:bg-cf-tint',
        className,
      )}
    >
      {children}
      {arrow && <ArrowRight aria-hidden className="h-[1.05em] w-[1.05em] transition-transform duration-200 ease-cf group-hover:translate-x-[3px]" strokeWidth={2.2} />}
    </Link>
  )
}

/** Inline descriptive text link with a sliding arrow. */
export function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn('group inline-flex min-h-6 items-center gap-1.5 font-medium text-cf-blue hover:text-cf-blue-deep', className)}>
      {children}
      <ArrowRight aria-hidden className="h-[1em] w-[1em] transition-transform duration-200 ease-cf group-hover:translate-x-[3px]" strokeWidth={2.2} />
    </Link>
  )
}

const TONES: Record<Tone, { pill: string; dot: string }> = {
  blue: { pill: 'bg-[#EAF2FF] text-[#1558D6]', dot: 'bg-cf-blue' },
  green: { pill: 'bg-[#E7F7EE] text-[#157A45]', dot: 'bg-[#1DB954]' },
  amber: { pill: 'bg-[#FFF3E0] text-[#A95B00]', dot: 'bg-[#F59E0B]' },
  red: { pill: 'bg-[#FDECEC] text-[#B42318]', dot: 'bg-[#EF4444]' },
  violet: { pill: 'bg-cf-violet-soft text-[#5B3FE6]', dot: 'bg-cf-violet' },
  slate: { pill: 'bg-[#F1F4F8] text-[#55657C]', dot: 'bg-[#8593A8]' },
}

export function Pill({ tone = 'blue', children, dot = true, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-medium leading-none', TONES[tone].pill, className)}>
      {dot && <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', TONES[tone].dot)} />}
      {children}
    </span>
  )
}

export function toneFor(state: string): Tone {
  const s = state.toLowerCase()
  if (['completed', 'approved', 'live', 'active', 'on track', 'connected', 'publishing', 'ready to publish', 'brief approved'].some((k) => s.includes(k))) return 'green'
  if (['pending', 'awaiting', 'high'].some((k) => s.includes(k))) return 'amber'
  if (['upcoming', 'draft', 'planning', 'not connected'].some((k) => s.includes(k))) return 'slate'
  return 'blue'
}

export function IconTile({ children, className, tone = 'blue' }: { children: ReactNode; className?: string; tone?: 'blue' | 'violet' | 'green' | 'pink' | 'amber' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[12px]',
        tone === 'blue' && 'bg-[#EAF2FF] text-cf-blue',
        tone === 'violet' && 'bg-cf-violet-soft text-cf-violet',
        tone === 'green' && 'bg-[#E7F7EE] text-[#16A34A]',
        tone === 'pink' && 'bg-[#FDECF4] text-[#DB2777]',
        tone === 'amber' && 'bg-[#FFF3E0] text-[#D97706]',
        className ?? 'h-11 w-11',
      )}
    >
      {children}
    </span>
  )
}

/** Photo avatar (synthetic demo portraits from the approved design references). */
export function Avatar({ person, size = 28, className }: { person: DemoPerson; size?: number; className?: string }) {
  return (
    <span aria-hidden className={cn('relative inline-block shrink-0 overflow-hidden rounded-full bg-[#E6ECF5] ring-2 ring-white', className)} style={{ width: size, height: size }}>
      <Image src={person.photo} alt="" fill sizes={`${size * 2}px`} quality={90} className="object-cover" />
    </span>
  )
}

export function AvatarStack({ people, size = 26, extra }: { people: DemoPerson[]; size?: number; extra?: string }) {
  return (
    <span className="inline-flex items-center">
      {people.map((p, i) => (
        <Avatar key={p.name} person={p} size={size} className={i > 0 ? '-ml-2' : ''} />
      ))}
      {extra && (
        <span
          className="-ml-2 inline-flex items-center justify-center rounded-full bg-[#EEF2F8] font-medium text-cf-muted ring-2 ring-white"
          style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.36)) }}
        >
          {extra}
        </span>
      )}
    </span>
  )
}

/**
 * Demo media library — photographic crops of the approved design references
 * (synthetic imagery; product shots and portraits are illustrative only).
 */
const MEDIA = {
  product: '/home-v2/m-r-sneaker.webp',
  portrait: '/home-v2/m-r-woman.webp',
  mountain: '/home-v2/m-r-mountain.webp',
  text: '/home-v2/m-r-text.webp',
  soft: '/home-v2/m-row4.webp',
  abstract: '/home-v2/m-brand-abstract.webp',
  video: '/home-v2/m-studio-video.webp',
  review: '/home-v2/m-review.webp',
  launch: '/home-v2/m-launch.webp',
  studio: '/home-v2/m-studio-preview.webp',
  creator: '/home-v2/p-creator.webp',
  submission: '/home-v2/m-submission.webp',
  nextup: '/home-v2/m-nextup.webp',
  sneakers: '/home-v2/m-appr1.webp',
  'shoe-dark': '/home-v2/m-appr2.webp',
  proof: '/home-v2/m-proof.webp',
  'hero-sneaker': '/home-v2/m-hero-sneaker.webp',
  'hero-mountain': '/home-v2/m-hero-mountain.webp',
  'hero-portrait': '/home-v2/m-hero-portrait.webp',
  'brand-sneaker': '/home-v2/m-brand-sneaker.webp',
  man: '/home-v2/m-s3-portrait.webp',
} as const

export type ThumbKind = keyof typeof MEDIA

export function MediaThumb({ kind, className, imgClassName, sizes = '240px' }: { kind: ThumbKind; className?: string; imgClassName?: string; label?: string; sizes?: string }) {
  return (
    <span aria-hidden className={cn('relative block overflow-hidden rounded-[8px] bg-[#E6ECF5]', className)}>
      <Image src={MEDIA[kind]} alt="" fill sizes={sizes} quality={90} className={cn('object-cover', imgClassName)} />
    </span>
  )
}

/** A generic white card surface used throughout the homepage. */
export function Surface({ children, className, as: As = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'article' | 'li' }) {
  return <As className={cn('rounded-[16px] border border-cf-line bg-white shadow-cf-card', className)}>{children}</As>
}

export function FoxMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/caption fox favicon.png"
      alt=""
      aria-hidden
      width={168}
      height={155}
      className={cn('shrink-0 rounded-[22%] object-cover', className)}
      style={{ width: size, height: size }}
    />
  )
}

const APP_NAV = [
  { key: 'home', label: 'Home', Icon: Home },
  { key: 'campaigns', label: 'Campaigns', Icon: LayoutGrid },
  { key: 'content', label: 'Content', Icon: FileText },
  { key: 'calendar', label: 'Calendar', Icon: Calendar },
  { key: 'creators', label: 'Creators', Icon: Users },
  { key: 'inbox', label: 'Inbox', Icon: Inbox },
  { key: 'analytics', label: 'Analytics', Icon: BarChart3 },
  { key: 'automations', label: 'Automations', Icon: Zap },
  { key: 'brand', label: 'Brand', Icon: ShieldCheck },
] as const

export type AppNavKey = (typeof APP_NAV)[number]['key']

/** Miniature reconstruction of the Caption Fox app sidebar. */
export function AppSidebar({ active, className, scale = 'md', footer }: { active: AppNavKey; className?: string; scale?: 'sm' | 'md'; footer?: ReactNode }) {
  const sm = scale === 'sm'
  return (
    <div aria-hidden className={cn('flex flex-col border-r border-cf-line bg-white', sm ? 'w-[118px] px-2 py-3' : 'w-[150px] px-2.5 py-4', className)}>
      <div className={cn('flex items-center gap-1.5 px-1.5', sm ? 'mb-3' : 'mb-5')}>
        <FoxMark size={sm ? 20 : 26} />
        <span className={cn('font-semibold tracking-[-0.02em] text-cf-blue', sm ? 'text-[11px]' : 'text-[14px]')}>Caption Fox</span>
      </div>
      <ul className={cn('flex flex-col', sm ? 'gap-0.5' : 'gap-1')}>
        {APP_NAV.map(({ key, label, Icon }) => (
          <li
            key={key}
            className={cn(
              'flex items-center gap-2 rounded-[7px] px-2',
              sm ? 'h-[22px] text-[9.5px]' : 'h-[30px] text-[11.5px]',
              key === active ? 'bg-[#EAF2FF] font-medium text-cf-blue-deep' : 'text-cf-muted',
            )}
          >
            <Icon className={sm ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={1.8} />
            {label}
          </li>
        ))}
      </ul>
      <div className="mt-auto">
        {footer ?? (
          <div className={cn('flex items-center gap-2 px-2 text-cf-muted', sm ? 'text-[9.5px]' : 'text-[11.5px]')}>
            <Settings className={sm ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={1.8} />
            Settings
          </div>
        )}
      </div>
    </div>
  )
}

export function SampleBadge({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border border-cf-line bg-white/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-cf-subtle', className)}>
      Sample data
    </span>
  )
}

export function CheckRow({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      {done ? (
        <CheckCircle2 aria-hidden className="h-[18px] w-[18px] fill-[#1DB954] text-white" strokeWidth={2.2} />
      ) : (
        <span aria-hidden className="h-[16px] w-[16px] rounded-full border-2 border-[#C5D0E0]" />
      )}
      <span>{children}</span>
      <span className="sr-only">{done ? '(complete)' : '(outstanding)'}</span>
    </span>
  )
}
