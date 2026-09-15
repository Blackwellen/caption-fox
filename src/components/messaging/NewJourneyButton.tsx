import Link from 'next/link'
import { Workflow } from 'lucide-react'

export default function NewJourneyButton({ href = '/app/messaging/journeys/new' }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
    >
      <Workflow size={14} />
      New journey
    </Link>
  )
}
