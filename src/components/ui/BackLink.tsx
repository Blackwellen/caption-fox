import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The shared "back" control for detail pages. It is a real link to the parent
 * list (not history.back()), so it works from a deep link or a fresh tab and
 * always lands on a predictable page.
 */
export default function BackLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'mb-3 inline-flex h-8 items-center gap-1.5 rounded-lg px-2 -ml-2 text-[13px] font-medium text-slate-500 transition-colors',
        'hover:bg-slate-100 hover:text-slate-800',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
        className,
      )}
    >
      <ArrowLeft size={15} aria-hidden />
      {label}
    </Link>
  )
}
