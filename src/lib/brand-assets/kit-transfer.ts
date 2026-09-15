// Brand kit file format shared by the export route and Import Kit.
// Pure functions only, so the parser is unit-tested and runs in the browser.

export const KIT_EXPORT_FORMAT = 'caption-fox.brand-kit'
export const KIT_IMPORT_MAX_BYTES = 256 * 1024

export interface ParsedKitFile {
  name: string
  description: string
  teamName: string
  sourceBrand: string | null
  colours: { name: string; hex: string; role: string }[]
  headingFont: string
  bodyFont: string
  toneStatement: string
  toneTraits: string[]
}

const HEX = /^#?([0-9a-f]{6})$/i
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/**
 * Parse an exported brand kit file. Returns a readable error instead of
 * throwing, so the form can show it next to the file input. Server-side
 * validation in createBrandKit still applies to whatever is submitted.
 */
export function parseKitFile(text: string): { ok: true; kit: ParsedKitFile } | { ok: false; error: string } {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return { ok: false, error: 'This file is not valid JSON.' } }
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'This file does not contain a brand kit.' }
  const o = raw as Record<string, unknown>
  if (o.format !== KIT_EXPORT_FORMAT) return { ok: false, error: 'This is not a Caption Fox brand kit file (expected a .brandkit.json export).' }
  if (o.version !== 1) return { ok: false, error: `Unsupported brand kit file version ${String(o.version)}.` }

  const kit = (o.kit ?? {}) as Record<string, unknown>
  const name = str(kit.name, 120)
  if (name.length < 2) return { ok: false, error: 'The file has no kit name.' }

  const colours = (Array.isArray(o.colours) ? o.colours : [])
    .map(c => (c && typeof c === 'object' ? c as Record<string, unknown> : {}))
    .map(c => ({ name: str(c.name, 40), hex: str(c.hex, 7), role: str(c.role, 20) || 'neutral' }))
    .filter(c => HEX.test(c.hex))
    .map(c => ({ ...c, hex: `#${c.hex.replace('#', '').toUpperCase()}` }))
    .slice(0, 12)
  if (colours.length === 0) return { ok: false, error: 'The file has no valid colours.' }

  const type = (Array.isArray(o.typography) ? o.typography : [])
    .map(t => (t && typeof t === 'object' ? t as Record<string, unknown> : {}))
    .map(t => ({ style: str(t.style_name, 40), family: str(t.font_family, 60) }))
    .filter(t => t.family)
  const heading = type.find(t => /heading|display|h1/i.test(t.style))?.family ?? type[0]?.family ?? ''
  const body = type.find(t => /body|paragraph|text/i.test(t.style))?.family ?? type[type.length - 1]?.family ?? ''
  if (!heading || !body) return { ok: false, error: 'The file has no typography.' }

  const tone = (o.tone && typeof o.tone === 'object' ? o.tone : {}) as Record<string, unknown>
  return {
    ok: true,
    kit: {
      name, description: str(kit.description, 600), teamName: str(kit.team_name, 60),
      sourceBrand: str(kit.brand, 120) || null, colours, headingFont: heading, bodyFont: body,
      toneStatement: str(tone.statement, 400),
      toneTraits: (Array.isArray(tone.traits) ? tone.traits : []).map(t => str(t, 30)).filter(Boolean).slice(0, 8),
    },
  }
}
