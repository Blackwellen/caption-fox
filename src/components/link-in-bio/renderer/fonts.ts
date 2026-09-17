import { DM_Sans, Inter, Lora, Playfair_Display, Poppins, Space_Grotesk } from 'next/font/google'
import type { ThemeFont } from '@/lib/link-in-bio/theme'

// Theme fonts are self-hosted by next/font. Each exposes a CSS variable; font
// files only download when a rendered page actually uses the family.

const inter = Inter({ subsets: ['latin'], variable: '--lib-inter', display: 'swap' })
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--lib-poppins', display: 'swap' })
const playfair = Playfair_Display({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--lib-playfair', display: 'swap' })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--lib-dmsans', display: 'swap' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--lib-space', display: 'swap' })
const lora = Lora({ subsets: ['latin'], variable: '--lib-lora', display: 'swap' })

export const THEME_FONT_CLASSES = [inter, poppins, playfair, dmSans, spaceGrotesk, lora].map(font => font.variable).join(' ')

const VARIABLE: Record<ThemeFont, string> = {
  'Inter': 'var(--lib-inter)',
  'Poppins': 'var(--lib-poppins)',
  'Playfair Display': 'var(--lib-playfair)',
  'DM Sans': 'var(--lib-dmsans)',
  'Space Grotesk': 'var(--lib-space)',
  'Lora': 'var(--lib-lora)',
}

const FALLBACK: Record<ThemeFont, string> = {
  'Inter': 'system-ui, sans-serif',
  'Poppins': 'system-ui, sans-serif',
  'Playfair Display': 'Georgia, serif',
  'DM Sans': 'system-ui, sans-serif',
  'Space Grotesk': 'system-ui, sans-serif',
  'Lora': 'Georgia, serif',
}

export function fontFamily(font: ThemeFont): string {
  return `${VARIABLE[font]}, ${FALLBACK[font]}`
}
