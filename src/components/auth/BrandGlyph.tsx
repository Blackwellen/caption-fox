import { BrandLogo } from '@/components/brand/BrandLogo'
import { hasBrand } from '@/lib/brand/brands'

// Platform glyphs. Real brand marks come from the shared registry
// (`@/lib/brand/brands`); only the generic channels are drawn here.
// Decorative only — always paired with a visible text label.

export function BrandGlyph({ platform, size = 20 }: { platform: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true as const }
  if (hasBrand(platform)) return <BrandLogo brand={platform} size={size} decorative />
  switch (platform) {
    case 'email':
      return (
        <svg {...common}><rect x="2.5" y="5" width="19" height="14" rx="3" fill="#1769FF" /><path d="m4 7.5 8 5.5 8-5.5" stroke="#fff" strokeWidth="1.8" fill="none" /></svg>
      )
    case 'web':
      return (
        <svg {...common}><circle cx="12" cy="12" r="9" fill="none" stroke="#1769FF" strokeWidth="1.8" /><path d="M3 12h18M12 3c2.6 2.5 3.8 5.5 3.8 9s-1.2 6.5-3.8 9c-2.6-2.5-3.8-5.5-3.8-9S9.4 5.5 12 3Z" fill="none" stroke="#1769FF" strokeWidth="1.8" /></svg>
      )
    default:
      return <svg {...common}><circle cx="12" cy="12" r="8" fill="#DCE7F7" /></svg>
  }
}
