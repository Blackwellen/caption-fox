// Caption formatting for social channels.
//
// Social networks store captions as plain text, so rich formatting is expressed
// the way those platforms actually render it: Unicode mathematical sans-serif
// letters for bold / italic, combining marks for underline / strikethrough, and
// literal bullet or number prefixes for lists. Every transform is reversible so
// the toolbar buttons toggle cleanly.

const BOLD = { upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec }
const ITALIC = { upper: 0x1d608, lower: 0x1d622 }
const UNDERLINE = '̲'
const STRIKE = '̶'

export type InlineStyle = 'bold' | 'italic' | 'underline' | 'strike'

function mapChars(text: string, fn: (cp: number) => number): string {
  let out = ''
  for (const ch of text) out += String.fromCodePoint(fn(ch.codePointAt(0)!))
  return out
}

function toStyled(cp: number, table: { upper: number; lower: number; digit?: number }): number {
  if (cp >= 65 && cp <= 90) return table.upper + (cp - 65)
  if (cp >= 97 && cp <= 122) return table.lower + (cp - 97)
  if (table.digit !== undefined && cp >= 48 && cp <= 57) return table.digit + (cp - 48)
  return cp
}

function fromStyled(cp: number): number {
  for (const table of [BOLD, ITALIC] as { upper: number; lower: number; digit?: number }[]) {
    if (cp >= table.upper && cp < table.upper + 26) return 65 + (cp - table.upper)
    if (cp >= table.lower && cp < table.lower + 26) return 97 + (cp - table.lower)
    if (table.digit !== undefined && cp >= table.digit && cp < table.digit + 10) return 48 + (cp - table.digit)
  }
  return cp
}

export function hasStyle(text: string, style: InlineStyle): boolean {
  if (!text) return false
  if (style === 'underline') return text.includes(UNDERLINE)
  if (style === 'strike') return text.includes(STRIKE)
  const table = style === 'bold' ? BOLD : ITALIC
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    if (cp >= table.upper && cp < table.lower + 26) return true
    if (style === 'bold' && cp >= BOLD.digit && cp < BOLD.digit + 10) return true
  }
  return false
}

export function toPlain(text: string): string {
  return mapChars(text.replaceAll(UNDERLINE, '').replaceAll(STRIKE, ''), fromStyled)
}

/** Toggles an inline style on a selection of text. */
export function toggleStyle(text: string, style: InlineStyle): string {
  if (style === 'underline' || style === 'strike') {
    const mark = style === 'underline' ? UNDERLINE : STRIKE
    if (text.includes(mark)) return text.replaceAll(mark, '')
    let out = ''
    for (const ch of text) out += /\s/.test(ch) ? ch : ch + mark
    return out
  }
  if (hasStyle(text, style)) return mapChars(text, fromStyled)
  const plain = mapChars(text, fromStyled)
  return mapChars(plain, cp => toStyled(cp, style === 'bold' ? BOLD : ITALIC))
}

export type BlockStyle = 'bullets' | 'numbers' | 'quote' | 'indent' | 'outdent'

const BULLET = '• '
const NUMBERED = /^\d+\.\s/

/** Applies a line-level style to every line touched by the selection. */
export function applyBlock(lines: string[], style: BlockStyle): string[] {
  const allBullets = lines.every(l => l.startsWith(BULLET))
  const allNumbers = lines.every(l => NUMBERED.test(l))
  const allQuotes = lines.every(l => l.startsWith('“') && l.endsWith('”'))
  return lines.map((line, i) => {
    const bare = line.replace(/^• /, '').replace(NUMBERED, '')
    switch (style) {
      case 'bullets': return allBullets ? bare : `${BULLET}${bare}`
      case 'numbers': return allNumbers ? bare : `${i + 1}. ${bare}`
      case 'quote': return allQuotes ? line.slice(1, -1) : `“${line}”`
      case 'indent': return ` ${line}`
      case 'outdent': return line.replace(/^ /, '')
    }
  })
}

export type ParagraphStyle = 'paragraph' | 'heading' | 'caps'

export function applyParagraph(text: string, style: ParagraphStyle): string {
  const plain = toPlain(text)
  if (style === 'heading') return toggleStyle(plain.toUpperCase(), 'bold')
  if (style === 'caps') return plain.toUpperCase()
  return plain
}

/** Hashtags in a caption, in order, de-duplicated (case-insensitive). */
export function extractHashtags(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const match of toPlain(text).matchAll(/(^|\s)(#[\p{L}\p{N}_]+)/gu)) {
    const tag = match[2]!
    if (!seen.has(tag.toLowerCase())) { seen.add(tag.toLowerCase()); out.push(tag) }
  }
  return out
}

/** Characters as the platforms count them (code points, not UTF-16 units). */
export function countCharacters(text: string): number {
  return [...text].length
}

export function countWords(text: string): number {
  return toPlain(text).trim().split(/\s+/).filter(Boolean).length
}

export function countEmojis(text: string): number {
  return [...text.matchAll(/\p{Extended_Pictographic}/gu)].length
}
