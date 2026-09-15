'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, LazyMotion, m } from 'framer-motion'
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AUTH_LINKS, MARKETPLACE_LINKS, PRODUCT_LINKS, RESOURCE_LINKS, SOLUTION_LINKS, type MarketingLink,
} from '@/lib/marketing-links'

const loadFeatures = () => import('@/components/home/motion-features').then((mod) => mod.default)
const EASE = [0.22, 1, 0.36, 1] as const

type MenuKey = 'product' | 'solutions' | 'resources'

const MENUS: { key: MenuKey; label: string; links: MarketingLink[]; footer?: MarketingLink }[] = [
  { key: 'product', label: 'Product', links: PRODUCT_LINKS, footer: { label: 'Explore every feature', href: '/features' } },
  { key: 'solutions', label: 'Solutions', links: SOLUTION_LINKS },
  { key: 'resources', label: 'Resources', links: RESOURCE_LINKS },
]

/**
 * Shared public marketing header (homepage + every unauthenticated marketing
 * page). Links come from the canonical registry in lib/marketing-links.
 */
export default function PublicNav() {
  const pathname = usePathname()
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const mobileButtonRef = useRef<HTMLButtonElement>(null)
  const mobilePanelRef = useRef<HTMLDivElement>(null)
  const baseId = useId()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close menus on route change (state adjusted during render, not in an effect).
  const [prevPath, setPrevPath] = useState(pathname)
  if (pathname !== prevPath) {
    setPrevPath(pathname)
    setOpenMenu(null)
    setMobileOpen(false)
  }

  // Desktop menus: close on outside click / Escape (restoring focus to the trigger).
  useEffect(() => {
    if (!openMenu) return
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const trigger = document.getElementById(`${baseId}-${openMenu}-trigger`)
        setOpenMenu(null)
        trigger?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [openMenu, baseId])

  const closeMobile = useCallback(() => {
    setMobileOpen(false)
    mobileButtonRef.current?.focus()
  }, [])

  // Mobile menu: lock scroll, Escape to close, keep focus inside the panel.
  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const panel = mobilePanelRef.current
    panel?.querySelector<HTMLElement>('a, button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobile()
      if (e.key === 'Tab' && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>('a, button')).filter((el) => el.offsetParent !== null)
        const first = items[0]
        const last = items[items.length - 1]
        const toButton = mobileButtonRef.current
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); toButton?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); toButton?.focus() }
        else if (document.activeElement === toButton) { e.preventDefault(); (e.shiftKey ? last : first)?.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [mobileOpen, closeMobile])

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname?.startsWith(href))

  return (
    <LazyMotion features={loadFeatures} strict>
      <header
        className={cn(
          'sticky top-0 z-50 border-b transition-[background-color,box-shadow,border-color] duration-200',
          // No backdrop-filter while the mobile menu is open: it would make the header the
          // containing block for the fixed-position panel and collapse it to header height.
          mobileOpen
            ? 'border-cf-line bg-white'
            : scrolled
              ? 'border-cf-line bg-white/95 shadow-[0_1px_0_rgb(10_22_48/0.02),0_8px_24px_-20px_rgb(10_22_48/0.25)] backdrop-blur-md'
              : 'border-cf-line/80 bg-white',
        )}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-cf-blue focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <div
          className={cn(
            'mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-4 transition-[height] duration-200 sm:px-6 lg:px-10 xl:px-14',
            scrolled ? 'h-16' : 'h-[72px]',
          )}
        >
          <Link href="/" className="flex shrink-0 items-center rounded-lg" aria-label="Caption Fox home">
            <Image
              src="/caption-fox-logo-transparent.png"
              alt="Caption Fox"
              width={612}
              height={160}
              priority
              className={cn('w-auto transition-[height] duration-200', scrolled ? 'h-10' : 'h-[46px]')}
            />
          </Link>

          <nav ref={navRef} aria-label="Primary" className="hidden flex-1 justify-center xl:flex">
            <ul className="flex items-center gap-1 xl:gap-3">
              {MENUS.slice(0, 2).map((menu) => (
                <DesktopMenu key={menu.key} menu={menu} baseId={baseId} open={openMenu === menu.key} onToggle={(o) => setOpenMenu(o ? menu.key : null)} />
              ))}
              <li>
                <NavLinkItem href="/marketplace" active={isActive('/marketplace')}>Marketplace</NavLinkItem>
              </li>
              <li>
                <NavLinkItem href="/pricing" active={isActive('/pricing')}>Pricing</NavLinkItem>
              </li>
              <DesktopMenu menu={MENUS[2]} baseId={baseId} open={openMenu === 'resources'} onToggle={(o) => setOpenMenu(o ? 'resources' : null)} />
            </ul>
          </nav>

          <div className="hidden items-center gap-6 xl:flex">
            <Link href={AUTH_LINKS.signIn} className="rounded-lg px-1 py-2 text-[16px] font-semibold text-cf-ink hover:text-cf-blue">
              Sign in
            </Link>
            <Link
              href={AUTH_LINKS.startFree}
              className="group inline-flex h-12 items-center gap-2.5 rounded-[11px] bg-cf-blue px-[26px] text-[16px] font-semibold text-white shadow-cf-button transition-colors hover:bg-cf-blue-deep"
            >
              Start free
              <ArrowRight aria-hidden className="h-[18px] w-[18px] transition-transform duration-200 ease-cf group-hover:translate-x-[3px]" strokeWidth={2.2} />
            </Link>
          </div>

          <button
            ref={mobileButtonRef}
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-cf-ink hover:bg-cf-tint xl:hidden"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls={`${baseId}-mobile`}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <m.div
              id={`${baseId}-mobile`}
              ref={mobilePanelRef}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: EASE }}
              className="fixed inset-x-0 bottom-0 top-[inherit] z-40 overflow-y-auto border-t border-cf-line bg-white px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-3 sm:px-6 xl:hidden"
              style={{ top: scrolled ? 64 : 72 }}
            >
              <nav aria-label="Mobile">
                <ul className="divide-y divide-cf-line">
                  {MENUS.slice(0, 2).map((menu) => (
                    <MobileGroup key={menu.key} menu={menu} onNavigate={() => setMobileOpen(false)} />
                  ))}
                  {[{ label: 'Marketplace', href: '/marketplace' }, { label: 'Pricing', href: '/pricing' }].map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} onClick={() => setMobileOpen(false)} className="flex min-h-14 items-center text-[17px] font-semibold text-cf-ink">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                  <MobileGroup menu={{ ...MENUS[2], links: [...RESOURCE_LINKS, ...MARKETPLACE_LINKS.slice(1)] }} onNavigate={() => setMobileOpen(false)} />
                </ul>
              </nav>
              <div className="mt-6 grid gap-3">
                <Link href={AUTH_LINKS.startFree} onClick={() => setMobileOpen(false)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cf-blue text-[16px] font-semibold text-white">
                  Start free <ArrowRight aria-hidden size={18} />
                </Link>
                <Link href={AUTH_LINKS.signIn} onClick={() => setMobileOpen(false)} className="inline-flex h-12 items-center justify-center rounded-xl border border-cf-line-strong text-[16px] font-semibold text-cf-ink">
                  Sign in
                </Link>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </header>
    </LazyMotion>
  )
}

function NavLinkItem({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn('inline-flex h-11 items-center rounded-lg px-3 text-[16px] font-medium transition-colors', active ? 'text-cf-blue' : 'text-cf-body hover:text-cf-blue')}
    >
      {children}
    </Link>
  )
}

function DesktopMenu({
  menu, baseId, open, onToggle,
}: {
  menu: (typeof MENUS)[number]
  baseId: string
  open: boolean
  onToggle: (open: boolean) => void
}) {
  const panelId = `${baseId}-${menu.key}-panel`
  const wide = menu.links.length > 5
  return (
    <li className="relative">
      <button
        id={`${baseId}-${menu.key}-trigger`}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onToggle(!open)}
        className={cn('inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-[16px] font-medium transition-colors', open ? 'text-cf-blue' : 'text-cf-body hover:text-cf-blue')}
      >
        {menu.label}
        <ChevronDown aria-hidden className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-180')} strokeWidth={2.2} />
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            id={panelId}
            initial={{ opacity: 0, scale: 0.985, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.985, y: -4 }}
            transition={{ duration: 0.16, ease: EASE }}
            style={{ transformOrigin: 'top center' }}
            className={cn(
              'absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 rounded-2xl border border-cf-line bg-white p-2.5 shadow-cf-float',
              wide ? 'w-[560px]' : 'w-[340px]',
            )}
          >
            <ul className={cn('grid gap-0.5', wide && 'grid-cols-2')}>
              {menu.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} onClick={() => onToggle(false)} className="block rounded-xl px-3.5 py-2.5 hover:bg-cf-tint focus-visible:bg-cf-tint">
                    <span className="block text-[14.5px] font-semibold text-cf-ink">{l.label}</span>
                    {l.description && <span className="mt-0.5 block text-[13px] leading-snug text-cf-muted">{l.description}</span>}
                  </Link>
                </li>
              ))}
            </ul>
            {menu.footer && (
              <div className="mt-2 border-t border-cf-line px-3.5 pb-1 pt-3">
                <Link href={menu.footer.href} onClick={() => onToggle(false)} className="group inline-flex items-center gap-1.5 text-[14px] font-semibold text-cf-blue">
                  {menu.footer.label}
                  <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-[3px]" />
                </Link>
              </div>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </li>
  )
}

function MobileGroup({ menu, onNavigate }: { menu: (typeof MENUS)[number]; onNavigate: () => void }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-14 w-full items-center justify-between text-left text-[17px] font-semibold text-cf-ink"
      >
        {menu.label}
        <ChevronDown aria-hidden className={cn('h-5 w-5 text-cf-muted transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <ul id={id} hidden={!open} className="pb-3">
        {menu.links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} onClick={onNavigate} className="flex min-h-11 items-center rounded-lg px-3 text-[15px] text-cf-body hover:bg-cf-tint">
              {l.label}
            </Link>
          </li>
        ))}
        {menu.footer && (
          <li>
            <Link href={menu.footer.href} onClick={onNavigate} className="flex min-h-11 items-center rounded-lg px-3 text-[15px] font-semibold text-cf-blue">
              {menu.footer.label}
            </Link>
          </li>
        )}
      </ul>
    </li>
  )
}
