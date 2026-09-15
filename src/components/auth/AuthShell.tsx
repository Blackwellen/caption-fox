import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { authFontClass } from './fonts'

export function AuthLogo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/caption-fox-logo-transparent.png"
      alt="Caption Fox"
      width={612}
      height={160}
      priority={priority}
      className={cn('w-auto', className)}
    />
  )
}

export function BackToHome() {
  return (
    <Link
      href="/"
      className="inline-flex min-h-11 items-center gap-2.5 rounded-lg px-1 text-[15px] font-medium text-cf-body transition-colors hover:text-cf-blue sm:text-[17px]"
    >
      <ArrowLeft size={20} strokeWidth={2} aria-hidden />
      Back to home
    </Link>
  )
}

export function AuthHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="relative z-10 border-b border-cf-line bg-white">
      <div className="mx-auto flex h-16 max-w-[1448px] items-center justify-between gap-4 px-4 sm:h-[76px] sm:px-8 lg:h-[82px] lg:px-[60px]">
        <Link href="/" aria-label="Caption Fox home" className="flex shrink-0 items-center rounded-lg lg:-ml-3">
          <AuthLogo priority className="h-11 sm:h-[52px] lg:h-[66px]" />
        </Link>
        {right ?? <BackToHome />}
      </div>
    </header>
  )
}

// Soft pale-blue atmosphere + thin connection curves used across auth pages.
export function Atmosphere() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-40 left-[38%] h-[720px] w-[720px] rounded-full bg-[radial-gradient(circle,rgb(46_139_255/0.10),transparent_65%)]" />
      <div className="absolute top-[30%] -right-40 h-[680px] w-[680px] rounded-full bg-[radial-gradient(circle,rgb(23_105_255/0.08),transparent_62%)]" />
      <div className="absolute bottom-[-280px] left-[-160px] h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle,rgb(46_139_255/0.07),transparent_65%)]" />
    </div>
  )
}

export function ConnectorCurves({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={cn('pointer-events-none absolute left-0 top-0 hidden h-[800px] w-[1448px] xl:block', className)}
      viewBox="0 0 1448 800"
      fill="none"
    >
      <path d="M560 132 C 615 128, 655 140, 683 158 C 740 190, 766 250, 767 318 C 768 362, 800 386, 862 392" stroke="#9CC3F5" strokeWidth="1.2" className="cf-draw" pathLength={1} />
      <path d="M560 344 C 640 356, 718 410, 752 494 C 768 536, 796 556, 862 560" stroke="#9CC3F5" strokeWidth="1.2" className="cf-draw" pathLength={1} style={{ ['--d' as string]: '600ms' }} />
      {[[683, 158], [767, 318], [752, 494]].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="6" fill="#fff" stroke="#2E8BFF" strokeWidth="2" />
      ))}
    </svg>
  )
}

/**
 * Two-column auth layout: marketing left (~55%), contained form card right.
 * Below lg the form comes first so nobody scrolls past marketing to sign in.
 */
export function AuthShell({ marketing, children, cardWidth = 550, compact }: { marketing: React.ReactNode; children: React.ReactNode; cardWidth?: number; compact?: boolean }) {
  return (
    <div className={cn('flex min-h-screen flex-col bg-white text-cf-ink', authFontClass)}>
      <AuthHeader />
      <main id="main" className="relative flex-1 bg-gradient-to-b from-white via-cf-tint/60 to-white">
        <Atmosphere />
        <div className="relative mx-auto max-w-[1448px]">
          <ConnectorCurves />
          <div
            className="relative grid gap-10 px-4 pb-14 pt-6 sm:px-8 sm:pt-10 lg:gap-12 lg:px-[58px] lg:pb-10 lg:pt-[52px] lg:[grid-template-columns:minmax(0,1fr)_var(--card)] xl:gap-16"
            style={{ ['--card' as string]: `${cardWidth}px` }}
          >
            {/* Marketing + product preview only earn their space on laptop/desktop;
                on tablet and mobile the form stands alone. */}
            <div className="hidden min-w-0 lg:order-1 lg:block">{marketing}</div>
            <div className={cn('order-1 mx-auto flex w-full max-w-[560px] flex-col lg:order-2 lg:max-w-none', compact && 'lg:-mt-8')}>{children}</div>
          </div>
        </div>
      </main>
    </div>
  )
}

type Tone = 'blue' | 'violet' | 'green'
const TONE: Record<Tone, string> = {
  blue: 'bg-[#EAF2FF] text-cf-blue',
  violet: 'bg-cf-violet-soft text-[#5B3DF5]',
  green: 'bg-[#E7F8EF] text-[#16A34A]',
}

export interface Benefit {
  icon: React.ReactNode
  tone: Tone
  title: string
  body: string
}

export function AuthMarketing({
  eyebrow, title, intro, benefits, preview,
}: { eyebrow: string; title: React.ReactNode; intro: string; benefits: Benefit[]; preview?: React.ReactNode }) {
  return (
    <section aria-labelledby="auth-marketing-title" className="lg:pt-3">
      <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-cf-blue sm:text-[13px]">{eyebrow}</p>
      <h2 id="auth-marketing-title" className="mt-4 text-[38px] font-extrabold leading-[1.03] tracking-[-0.025em] text-cf-ink sm:text-[52px] xl:mt-5 xl:text-[64px]">
        {title}
      </h2>
      <p className="mt-5 max-w-[560px] text-[17px] leading-[1.45] text-cf-muted sm:text-[19px] xl:mt-4 xl:text-[21px]">{intro}</p>
      <ul className="mt-6 space-y-4 xl:mt-5 xl:space-y-5">
        {benefits.map(b => (
          <li key={b.title} className="flex items-center gap-4 xl:gap-5">
            <span aria-hidden className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] xl:h-[60px] xl:w-[60px] xl:rounded-[16px]', TONE[b.tone])}>
              {b.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-[17px] font-semibold tracking-[-0.01em] text-cf-ink xl:text-[20px]">{b.title}</span>
              <span className="mt-0.5 block text-[14px] leading-snug text-cf-muted xl:text-[16px]">{b.body}</span>
            </span>
          </li>
        ))}
      </ul>
      {preview && <div className="mt-8 hidden sm:block xl:mt-9">{preview}</div>}
    </section>
  )
}

export function AuthCard({
  eyebrow, title, subtitle, children, className, logoGap = 'lg', titleSize = 'lg', titleClassName, density = 'default',
}: { eyebrow?: string; title: string; subtitle?: React.ReactNode; children: React.ReactNode; className?: string; logoGap?: 'lg' | 'sm'; titleSize?: 'lg' | 'md'; titleClassName?: string; density?: 'default' | 'compact' }) {
  const compact = density === 'compact'
  return (
    <div className={cn('cf-pop flex flex-col rounded-[24px] border border-cf-line-strong/80 bg-white px-5 py-8 shadow-cf-float sm:rounded-[28px] sm:px-10 lg:flex-1 xl:px-12', compact ? 'sm:pb-7 sm:pt-5' : 'sm:py-11', className)}>
      <div className="flex justify-center">
        <AuthLogo className={compact ? 'h-12 sm:h-[54px]' : 'h-12 sm:h-[62px]'} />
      </div>
      <div className={cn('text-center', compact ? 'mt-3' : logoGap === 'lg' ? 'mt-7 sm:mt-8' : 'mt-4')}>
        {eyebrow && <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-cf-blue sm:text-[13px]">{eyebrow}</p>}
        <h1 className={cn('font-extrabold leading-[1.08] tracking-[-0.025em] text-cf-ink', compact ? 'mt-1' : 'mt-2', titleClassName ?? (titleSize === 'lg' ? (compact ? 'text-[32px] sm:text-[42px]' : 'text-[34px] sm:text-[50px]') : 'text-[28px] sm:text-[35px]'))}>{title}</h1>
        {subtitle && <p className={cn('mx-auto max-w-[440px] text-[15px] leading-snug text-cf-muted', compact ? 'mt-2 sm:text-[16px]' : 'mt-3 sm:text-[17px]')}>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
