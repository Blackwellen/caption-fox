import {
  Megaphone, Users, Video, Palette, TrendingUp, BadgeDollarSign, PenLine, Code,
  Mic, Radio, Camera, Clapperboard, Boxes,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// marketplace_categories already carries an `icon` and an `accent` per row; the
// grid used to render two-letter initials in a flat blue tile and ignore both.
const ICONS: Record<string, typeof Boxes> = {
  megaphone: Megaphone,
  users: Users,
  video: Video,
  palette: Palette,
  'trending-up': TrendingUp,
  'badge-dollar-sign': BadgeDollarSign,
  'pen-line': PenLine,
  code: Code,
  mic: Mic,
  radio: Radio,
  camera: Camera,
  clapperboard: Clapperboard,
}

const ACCENTS: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  violet: 'bg-violet-50 text-violet-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  slate: 'bg-slate-100 text-slate-600',
}

export default function CategoryIcon({
  icon, accent, size = 'md',
}: {
  icon: string | null
  accent: string | null
  size?: 'sm' | 'md'
}) {
  const Icon = ICONS[icon ?? ''] ?? Boxes
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg',
        size === 'sm' ? 'h-7 w-7' : 'h-10 w-10 lg:h-8 lg:w-8',
        ACCENTS[accent ?? ''] ?? ACCENTS.blue,
      )}
      aria-hidden="true"
    >
      <Icon size={size === 'sm' ? 13 : 16} />
    </span>
  )
}
