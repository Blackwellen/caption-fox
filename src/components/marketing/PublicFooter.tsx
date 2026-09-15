import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ChevronDown } from 'lucide-react'
import {
  AUTH_LINKS, COMPANY_LINKS, LEGAL_LINKS, MARKETPLACE_LINKS, PRODUCT_LINKS, RESOURCE_LINKS, SOLUTION_LINKS, type MarketingLink,
} from '@/lib/marketing-links'

const COLUMNS: { heading: string; links: MarketingLink[] }[] = [
  { heading: 'Product', links: [{ label: 'Features', href: '/features' }, ...PRODUCT_LINKS.filter((l) => l.label !== 'Approvals & teams')] },
  { heading: 'Solutions', links: SOLUTION_LINKS },
  { heading: 'Marketplace', links: MARKETPLACE_LINKS },
  { heading: 'Resources', links: RESOURCE_LINKS },
  { heading: 'Company', links: COMPANY_LINKS },
  { heading: 'Legal', links: LEGAL_LINKS },
]

/**
 * Shared public marketing footer. Every href comes from the canonical link
 * registry and resolves to a real page. `showCta` renders the pale-blue
 * conversion band; the homepage turns it off because Section 08 closes the page.
 */
export default function PublicFooter({ showCta = true }: { showCta?: boolean }) {
  return (
    <footer className="border-t border-cf-line bg-white">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        {showCta && (
          <div className="relative mt-12 overflow-hidden rounded-[22px] border border-cf-line bg-gradient-to-br from-cf-tint to-cf-tint-2 px-6 py-10 sm:px-12 lg:mt-16 lg:flex lg:items-center lg:justify-between lg:gap-10">
            <div className="max-w-[560px]">
              <Image src="/caption-fox-logo-transparent.png" alt="Caption Fox" width={612} height={160} className="h-[52px] w-auto" />
              <p className="mt-5 text-[30px] font-bold leading-[1.1] tracking-[-0.035em] text-cf-ink sm:text-[40px]">Ready to streamline your marketing?</p>
              <p className="mt-3 text-[16px] leading-[1.5] text-cf-muted">Plan, create, launch and measure — all in one place.</p>
            </div>
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row lg:mt-0">
              <div className="flex w-full flex-col items-center sm:w-auto">
                <Link href={AUTH_LINKS.startFree} className="group inline-flex h-[54px] w-full items-center justify-center gap-2.5 rounded-[12px] bg-cf-blue px-12 text-[16px] font-semibold text-white shadow-cf-button hover:bg-cf-blue-deep sm:w-auto">
                  Start free <ArrowRight aria-hidden className="h-[18px] w-[18px] transition-transform group-hover:translate-x-[3px]" />
                </Link>
                <span className="mt-2 text-[12.5px] text-cf-muted">No card required for the Free plan</span>
              </div>
              <Link href="/features" className="group inline-flex h-[54px] w-full items-center justify-center gap-2.5 self-start rounded-[12px] border border-cf-blue/35 bg-white px-8 text-[16px] font-semibold text-cf-blue hover:bg-cf-tint sm:w-auto">
                Explore the platform <ArrowRight aria-hidden className="h-[18px] w-[18px] transition-transform group-hover:translate-x-[3px]" />
              </Link>
            </div>
          </div>
        )}

        <div className="grid gap-10 py-12 lg:grid-cols-[300px_1fr] lg:gap-8 lg:py-16">
          <div>
            <Link href="/" aria-label="Caption Fox home" className="inline-block">
              <Image src="/caption-fox-logo-transparent.png" alt="Caption Fox" width={612} height={160} className="h-[52px] w-auto" />
            </Link>
            <p className="mt-5 text-[16px] leading-[1.5] text-cf-body">The marketing operating system for campaigns, content and growth.</p>
            <p className="mt-4 text-[15px] leading-[1.5] text-cf-muted">Plan, create, distribute and measure with one connected platform.</p>
          </div>

          {/* Desktop / tablet columns */}
          <nav aria-label="Footer" className="hidden grid-cols-3 gap-8 md:grid xl:grid-cols-6 xl:gap-0 xl:divide-x xl:divide-cf-line">
            {COLUMNS.map((col) => (
              <div key={col.heading} className="xl:px-7">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.24em] text-cf-ink">{col.heading}</h2>
                <ul className="mt-5 space-y-3">
                  {col.links.map((l) => (
                    <li key={l.label}><Link href={l.href} className="text-[15px] text-cf-body hover:text-cf-blue">{l.label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* Mobile accordions */}
          <nav aria-label="Footer" className="divide-y divide-cf-line border-y border-cf-line md:hidden">
            {COLUMNS.map((col) => (
              <details key={col.heading} className="group">
                <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between text-[13px] font-semibold uppercase tracking-[0.2em] text-cf-ink [&::-webkit-details-marker]:hidden">
                  {col.heading}
                  <ChevronDown aria-hidden className="h-4 w-4 text-cf-muted transition-transform group-open:rotate-180" />
                </summary>
                <ul className="pb-3">
                  {col.links.map((l) => (
                    <li key={l.label}><Link href={l.href} className="flex min-h-11 items-center text-[15px] text-cf-body">{l.label}</Link></li>
                  ))}
                </ul>
              </details>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-3 border-t border-cf-line py-7 text-[14px] text-cf-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Caption Fox. All rights reserved.</p>
          <a href="/sitemap.xml" className="inline-flex min-h-11 items-center hover:text-cf-blue">Sitemap</a>
        </div>
      </div>
    </footer>
  )
}
