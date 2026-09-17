// Icon for a keyword cluster / hashtag set, shared by server and client components.

import { Brain, Briefcase, Clock, Hash, Laptop, Leaf, Sparkles, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

const ICONS: Record<string, { Icon: typeof Hash; className: string }> = {
  target: { Icon: Target, className: 'text-[#1a5cff]' },
  laptop: { Icon: Laptop, className: 'text-slate-700' },
  clock: { Icon: Clock, className: 'text-slate-700' },
  leaf: { Icon: Leaf, className: 'text-[#16a34a]' },
  brain: { Icon: Brain, className: 'text-[#e5487a]' },
  briefcase: { Icon: Briefcase, className: 'text-[#7c5a2e]' },
  sparkles: { Icon: Sparkles, className: 'text-[#7c3aed]' },
}

export function SetIcon({ icon, className }: { icon: string | null; className?: string }) {
  const { Icon, className: tone } = ICONS[icon ?? ''] ?? { Icon: Hash, className: 'text-[#1a5cff]' }
  return (
    <span className={cn('flex shrink-0 items-center justify-center', className)} aria-hidden>
      <Icon className={cn('h-full w-full', tone)} strokeWidth={1.8} />
    </span>
  )
}
