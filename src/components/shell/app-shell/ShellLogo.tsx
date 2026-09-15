import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * The real Caption Fox brand assets, always on a white surface — the fox mark
 * has transparent internal areas that break on dark backgrounds. Never
 * recoloured, reconstructed or stretched.
 */
export function ShellWordmark({ badge }: { badge?: string | null }) {
  return (
    <span className="flex flex-col items-start">
      <span className="flex items-center gap-2.5">
        <ShellFoxMark size={34} />
        <span className="text-[18px] font-bold tracking-[-0.01em] text-shell-text">Caption Fox</span>
      </span>
      {badge && (
        <span
          className={cn(
            'ml-[44px] mt-0.5 inline-flex rounded-md px-1.5 py-[3px] text-[10.5px] font-semibold leading-none',
            badge.toLowerCase().includes('affiliate') ? 'bg-emerald-50 text-emerald-700' : 'bg-cf-violet-soft text-cf-violet',
          )}
        >
          {badge}
        </span>
      )}
    </span>
  )
}

export function ShellFoxMark({ size = 36 }: { size?: number }) {
  return (
    <Image
      src="/caption fox favicon.png"
      alt="Caption Fox"
      width={size}
      height={size}
      priority
      className="shrink-0 rounded-[10px]"
      style={{ width: size, height: size }}
    />
  )
}

export function ShellAvatar({ initials, size = 36, shape = 'rounded' }: { initials: string; size?: number; shape?: 'rounded' | 'circle' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center bg-shell-blue font-semibold text-white',
        shape === 'circle' ? 'rounded-full' : 'rounded-[10px]',
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials}
    </span>
  )
}
