import 'server-only'
import { R2_PREFIX, signReadUrls } from '@/lib/storage/r2'

// Studio media is stored in the private R2 bucket as `r2:` paths. Pages get
// short-lived signed GET URLs instead. Only objects under this workspace's own
// prefixes are signed (Studio uploads and the shared Brand & Assets library,
// which both live in `media_assets`); any other `r2:` value becomes null, so a
// row can never be used to mint a URL for another tenant's object.

const MEDIA_FIELDS = new Set([
  'avatar_url', 'file_url', 'thumbnail_url', 'thumbnail_path', 'cover_url', 'preview_url', 'logo_url',
])

export async function signStudioMedia<T>(workspaceId: string, data: T): Promise<T> {
  const allowed = [`${R2_PREFIX}studio/${workspaceId}/`, `${R2_PREFIX}brand-assets/${workspaceId}/`]
  const found = new Set<string>()
  const walk = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(walk); return }
    if (!node || typeof node !== 'object') return
    for (const [key, value] of Object.entries(node)) {
      if (MEDIA_FIELDS.has(key) && typeof value === 'string' && value.startsWith(R2_PREFIX)) found.add(value)
      else if (value && typeof value === 'object') walk(value)
    }
  }
  walk(data)
  if (found.size === 0) return data

  const signable = [...found].filter(p => allowed.some(prefix => p.startsWith(prefix)) && !p.includes('..'))
  const signed = await signReadUrls(signable, 3600)
  const replace = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(replace); return }
    if (!node || typeof node !== 'object') return
    const record = node as Record<string, unknown>
    for (const [key, value] of Object.entries(record)) {
      if (MEDIA_FIELDS.has(key) && typeof value === 'string' && value.startsWith(R2_PREFIX)) record[key] = signed.get(value) ?? null
      else if (value && typeof value === 'object') replace(value)
    }
  }
  replace(data)
  return data
}
