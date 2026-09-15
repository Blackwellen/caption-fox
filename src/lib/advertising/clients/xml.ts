import 'server-only'

// A deliberately small XML reader for the Microsoft Advertising SOAP responses.
//
// This is not a general XML parser and does not try to be: it reads element
// text and repeated element blocks, which is all the Bing Ads envelopes need.
// Keeping it in-repo avoids adding an XML dependency for one provider.
//
// Namespace prefixes are ignored, so <a:Id>, <Id> and <ns2:Id> all match "Id".

const cache = new Map<string, RegExp>()

function tagPattern(tag: string, flags: string): RegExp {
  const key = `${tag}|${flags}`
  const cached = cache.get(key)
  if (cached) return cached
  // Matches <Tag ...>body</Tag> and the self-closing <Tag ... />
  const pattern = new RegExp(
    `<(?:[A-Za-z0-9_.-]+:)?${escapeRegex(tag)}(\\s[^>]*?)?(?:/>|>([\\s\\S]*?)</(?:[A-Za-z0-9_.-]+:)?${escapeRegex(tag)}>)`,
    flags,
  )
  cache.set(key, pattern)
  return pattern
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
}

function decode(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&(amp|lt|gt|quot|apos);/g, match => ENTITIES[match] ?? match)
    .trim()
}

/** True when the element carries xsi:nil="true", i.e. an explicit null. */
function isNil(attributes: string | undefined): boolean {
  return !!attributes && /\bnil\s*=\s*"true"/i.test(attributes)
}

export class XMLParser {
  constructor(private readonly source: string) {}

  /** Text of the first matching element, or null when absent or nil. */
  first(tag: string): string | null {
    const match = tagPattern(tag, '').exec(this.source)
    if (!match) return null
    if (isNil(match[1])) return null
    const body = match[2]
    if (body === undefined) return null
    // An element wrapping other elements has no text value of its own.
    if (/<[A-Za-z]/.test(body)) return null
    return decode(body)
  }

  /** Every matching element, each wrapped so its children can be read. */
  list(tag: string): XMLParser[] {
    const nodes: XMLParser[] = []
    const pattern = tagPattern(tag, 'g')
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(this.source)) !== null) {
      if (match[0].length === 0) { pattern.lastIndex += 1; continue }
      nodes.push(new XMLParser(match[2] ?? ''))
    }
    return nodes
  }

  /** Alias of first(), read at the call sites as "this node's Id/Name/...". */
  value(tag: string): string | null {
    return this.first(tag)
  }

  /** Text of every matching element, for repeated scalars such as FinalUrls. */
  values(tag: string): string[] {
    return this.list(tag).map(node => node.text()).filter((text): text is string => text !== null)
  }

  text(): string | null {
    const trimmed = this.source.trim()
    if (!trimmed || /<[A-Za-z]/.test(trimmed)) return null
    return decode(trimmed)
  }

  raw(): string {
    return this.source
  }
}
