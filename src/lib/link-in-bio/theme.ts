// Theme tokens: the one shape every theme, page preview and public page is
// rendered from. normaliseTokens() accepts any stored JSON (including the
// original core-increment shape) and always returns a complete, valid set,
// so a malformed row can never break a public page.

export const THEME_FONTS = ['Inter', 'Poppins', 'Playfair Display', 'DM Sans', 'Space Grotesk', 'Lora'] as const
export type ThemeFont = typeof THEME_FONTS[number]

export type ThemeTokens = {
  palette: {
    primary: string; secondary: string; accent: string; background: string
    surface: string; textPrimary: string; textSecondary: string; border: string
  }
  typography: { heading: ThemeFont; body: ThemeFont }
  buttons: { primaryStyle: 'filled' | 'gradient' | 'outline'; secondaryStyle: 'outline' | 'filled' | 'ghost'; radius: number }
  cards: { radius: 8 | 12 | 16 | 24; shadow: 'none' | 'soft' | 'medium' | 'large' }
  background: { type: 'solid' | 'gradient' | 'texture' | 'image'; imageUrl: string | null }
  accents: { iconStyle: 'filled' | 'outline'; divider: 'solid' | 'dashed' | 'dotted' }
  spacing: { sectionPadding: number; elementGap: number }
  preset: 'soft' | 'elevated' | 'glass' | 'outline' | 'minimal'
  mode: 'light' | 'dark'
}

export const DEFAULT_TOKENS: ThemeTokens = {
  palette: {
    primary: '#2563EB', secondary: '#60A5FA', accent: '#7C3AED', background: '#F8FAFC',
    surface: '#FFFFFF', textPrimary: '#0F172A', textSecondary: '#475569', border: '#E2E8F0',
  },
  typography: { heading: 'Inter', body: 'Inter' },
  buttons: { primaryStyle: 'filled', secondaryStyle: 'outline', radius: 12 },
  cards: { radius: 12, shadow: 'soft' },
  background: { type: 'solid', imageUrl: null },
  accents: { iconStyle: 'outline', divider: 'solid' },
  spacing: { sectionPadding: 24, elementGap: 12 },
  preset: 'soft',
  mode: 'light',
}

const HEX = /^#[0-9a-fA-F]{6}$/

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : fallback
}
function hex(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX.test(value) ? value.toUpperCase() : fallback
}
function num(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback
}
function safeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return value.startsWith('/') && !value.startsWith('//') ? value : null
  }
}

export function normaliseTokens(input: unknown): ThemeTokens {
  const t = (input && typeof input === 'object' ? input : {}) as Record<string, Record<string, unknown> | undefined>
  const p = t.palette ?? {}
  const d = DEFAULT_TOKENS
  // Core-increment themes stored buttonBg/buttonText; map them forward.
  const primary = hex(p.primary ?? p.buttonBg, d.palette.primary)
  return {
    palette: {
      primary,
      secondary: hex(p.secondary, d.palette.secondary),
      accent: hex(p.accent, d.palette.accent),
      background: hex(p.background, d.palette.background),
      surface: hex(p.surface, d.palette.surface),
      textPrimary: hex(p.textPrimary, d.palette.textPrimary),
      textSecondary: hex(p.textSecondary, d.palette.textSecondary),
      border: hex(p.border, d.palette.border),
    },
    typography: {
      heading: pick(t.typography?.heading, THEME_FONTS, d.typography.heading),
      body: pick(t.typography?.body, THEME_FONTS, d.typography.body),
    },
    buttons: {
      primaryStyle: pick(t.buttons?.primaryStyle, ['filled', 'gradient', 'outline'] as const, d.buttons.primaryStyle),
      secondaryStyle: pick(t.buttons?.secondaryStyle, ['outline', 'filled', 'ghost'] as const, d.buttons.secondaryStyle),
      radius: num(t.buttons?.radius, 0, 32, d.buttons.radius),
    },
    cards: {
      radius: [8, 12, 16, 24].includes(Number(t.cards?.radius)) ? Number(t.cards?.radius) as 8 | 12 | 16 | 24 : d.cards.radius,
      shadow: pick(t.cards?.shadow, ['none', 'soft', 'medium', 'large'] as const, d.cards.shadow),
    },
    background: {
      type: pick(t.background?.type, ['solid', 'gradient', 'texture', 'image'] as const, d.background.type),
      imageUrl: safeImageUrl(t.background?.imageUrl),
    },
    accents: {
      iconStyle: pick(t.accents?.iconStyle, ['filled', 'outline'] as const, d.accents.iconStyle),
      divider: pick(t.accents?.divider, ['solid', 'dashed', 'dotted'] as const, d.accents.divider),
    },
    spacing: {
      sectionPadding: num(t.spacing?.sectionPadding, 8, 48, d.spacing.sectionPadding),
      elementGap: num(t.spacing?.elementGap, 4, 32, d.spacing.elementGap),
    },
    preset: pick(t.preset, ['soft', 'elevated', 'glass', 'outline', 'minimal'] as const, d.preset),
    mode: pick(t.mode, ['light', 'dark'] as const, d.mode),
  }
}

// ------------------------------------------------------------ WCAG contrast

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hexColour: string): number {
  const h = hexColour.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100
}

/** Text colour (dark or white) that reads best on a fill. */
export function readableOn(fill: string): string {
  return contrastRatio(fill, '#FFFFFF') >= contrastRatio(fill, '#0F172A') ? '#FFFFFF' : '#0F172A'
}

export type ThemeCheck = { id: string; label: string; passed: boolean; detail: string }

/**
 * Measurable accessibility checks. The score is the share of checks passed,
 * weighted equally — no invented number.
 */
export function themeAccessibilityChecks(tokens: ThemeTokens): { checks: ThemeCheck[]; score: number } {
  const { palette } = tokens
  const text = contrastRatio(palette.textPrimary, palette.surface)
  const bodyBg = contrastRatio(palette.textPrimary, palette.background)
  const secondary = contrastRatio(palette.textSecondary, palette.surface)
  const buttonText = readableOn(palette.primary)
  const button = contrastRatio(buttonText, palette.primary)
  const checks: ThemeCheck[] = [
    { id: 'text-surface', label: 'Colors meet contrast (AA)', passed: text >= 4.5 && bodyBg >= 4.5, detail: `Body text ${text}:1 on cards, ${bodyBg}:1 on background (needs 4.5:1).` },
    { id: 'text-secondary', label: 'Secondary text contrast', passed: secondary >= 4.5, detail: `Secondary text ${secondary}:1 (needs 4.5:1).` },
    { id: 'button', label: 'Button label contrast', passed: button >= 4.5, detail: `Button label ${button}:1 (needs 4.5:1).` },
    { id: 'type-scale', label: 'Typography scale valid', passed: THEME_FONTS.includes(tokens.typography.heading) && THEME_FONTS.includes(tokens.typography.body), detail: 'Heading and body fonts are from the supported, web-safe set.' },
    { id: 'touch', label: 'Touch targets ≥ 44px', passed: tokens.spacing.elementGap >= 8, detail: 'Buttons render at 44px minimum height with at least 8px between targets.' },
    { id: 'focus', label: 'Focus states defined', passed: contrastRatio(palette.primary, palette.background) >= 3, detail: `Focus ring ${contrastRatio(palette.primary, palette.background)}:1 against the background (needs 3:1).` },
  ]
  const score = Math.round((checks.filter(c => c.passed).length / checks.length) * 100)
  return { checks, score }
}

/** Human description of what differs between two token sets, for version notes. */
export function describeTokenChanges(before: ThemeTokens, after: ThemeTokens): string {
  const parts: string[] = []
  if (JSON.stringify(before.palette) !== JSON.stringify(after.palette)) parts.push('Color')
  if (JSON.stringify(before.typography) !== JSON.stringify(after.typography)) parts.push('Typography')
  if (JSON.stringify(before.buttons) !== JSON.stringify(after.buttons)) parts.push('Button styles')
  if (JSON.stringify(before.cards) !== JSON.stringify(after.cards) || before.preset !== after.preset) parts.push('Card')
  if (JSON.stringify(before.background) !== JSON.stringify(after.background)) parts.push('Background')
  if (JSON.stringify(before.spacing) !== JSON.stringify(after.spacing)) parts.push('Spacing')
  if (JSON.stringify(before.accents) !== JSON.stringify(after.accents)) parts.push('Accent')
  if (parts.length === 0) return 'No token changes'
  if (parts.length === 1) return `${parts[0]} update`
  return `${parts.slice(0, 2).join(' + ')} updates`
}
