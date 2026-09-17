import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Device chrome for previews. Content is laid out at a real device width
// (375px phone, 1024px desktop) and scaled down to the frame, so a preview is
// the actual page at true proportions rather than a squeezed layout.

const PHONE_LOGICAL_WIDTH = 375

export function PhoneFrame({
  width, children, className, label = 'Mobile preview', notch = true,
}: { width: number; children: ReactNode; className?: string; label?: string; notch?: boolean }) {
  const bezel = Math.max(5, Math.round(width * 0.034))
  const screenWidth = width - bezel * 2
  const height = Math.round(width * 2.02)
  const screenHeight = height - bezel * 2
  const scale = screenWidth / PHONE_LOGICAL_WIDTH
  const outerRadius = Math.round(width * 0.17)
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('relative shrink-0 bg-[#0B0B0F] shadow-[0_18px_40px_-18px_rgba(15,23,42,0.45)]', className)}
      style={{ width, height, borderRadius: outerRadius, padding: bezel }}
    >
      <div className="relative overflow-hidden bg-white" style={{ width: screenWidth, height: screenHeight, borderRadius: outerRadius - bezel }}>
        <div
          className="absolute left-0 top-0 overflow-hidden"
          style={{ width: PHONE_LOGICAL_WIDTH, height: screenHeight / scale, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          <div className="h-full overflow-hidden" aria-hidden>{children}</div>
        </div>
        {notch && (
          <span
            className="absolute left-1/2 top-[3%] -translate-x-1/2 rounded-full bg-[#0B0B0F]"
            style={{ width: screenWidth * 0.3, height: Math.max(8, screenWidth * 0.075) }}
            aria-hidden
          />
        )}
      </div>
    </div>
  )
}

export function BrowserFrame({
  width, height, children, className, logicalWidth = 1024,
}: { width: number; height: number; children: ReactNode; className?: string; logicalWidth?: number }) {
  const bar = 18
  const scale = width / logicalWidth
  return (
    <div role="img" aria-label="Desktop preview" className={cn('overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_12px_32px_-16px_rgba(15,23,42,0.35)]', className)} style={{ width, height }}>
      <div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50 px-2" style={{ height: bar }} aria-hidden>
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
      </div>
      <div className="relative overflow-hidden" style={{ width, height: height - bar }}>
        <div className="absolute left-0 top-0" style={{ width: logicalWidth, height: (height - bar) / scale, transform: `scale(${scale})`, transformOrigin: 'top left' }} aria-hidden>
          {children}
        </div>
      </div>
    </div>
  )
}
