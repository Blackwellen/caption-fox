import 'server-only'
import { randomUUID } from 'node:crypto'
import {
  DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Cloudflare R2 (S3-compatible) for private workspace files.
//
// The bucket is private: the browser uploads with a short-lived signed PUT
// URL and reads with a short-lived signed GET URL. Access keys never leave the
// server. Keys are namespaced `{area}/{workspaceId}/{uploadId}/{file}` so every
// object is attributable to one workspace, and callers must check that prefix.
//
// Stored paths carry an `r2:` prefix (e.g. `r2:advertising/ws/…/file.jpg`) so
// records can tell R2 objects from Supabase Storage objects.

export const R2_PREFIX = 'r2:'

let client: S3Client | null = null
let warned = false

function config() {
  const endpoint = process.env.CLOUDFLARE_R2_S3_API
  const bucket = process.env.CLOUDFLARE_S3_BUCKET
  const accessKeyId = process.env.CLOUDFLARE_ACCESS_KEY_ID
  const secretAccessKey = process.env.CLOUDFLARE_SECRET_ACCESS
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null
  // R2 S3 credentials are a 32-char access key ID and 64-char secret. Anything
  // else is a mis-pasted value; treat R2 as unconfigured so uploads fall back
  // to Supabase Storage instead of failing every time.
  if (accessKeyId.length !== 32 || secretAccessKey.length !== 64) {
    if (!warned) { console.warn('[storage] R2 credentials are malformed; falling back to Supabase Storage.'); warned = true }
    return null
  }
  return { endpoint: endpoint.replace(/\/[^/]*$/, (tail) => (tail.includes('.') ? tail : '')).replace(/\/$/, ''), bucket, accessKeyId, secretAccessKey }
}

export function isR2Configured(): boolean {
  return config() !== null
}

function r2() {
  const settings = config()
  if (!settings) throw new Error('R2 is not configured.')
  client ??= new S3Client({
    region: 'auto',
    endpoint: settings.endpoint,
    credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
  })
  return { client, bucket: settings.bucket }
}

function safeFileName(name: string): string {
  const dot = name.lastIndexOf('.')
  const base = (dot > 0 ? name.slice(0, dot) : name).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file'
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) : ''
  return ext ? `${base}.${ext}` : base
}

/** A signed PUT for one new object under `{area}/{workspaceId}/`. Valid for 10 minutes. */
export async function createUploadUrl(input: { area: string; workspaceId: string; fileName: string; contentType: string }) {
  const { client: s3, bucket } = r2()
  const key = `${input.area}/${input.workspaceId}/${randomUUID()}/${safeFileName(input.fileName)}`
  const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: input.contentType }), { expiresIn: 600 })
  return { key, url, storedPath: `${R2_PREFIX}${key}` }
}

/** Signed GET URLs for stored `r2:` paths. Unknown or failing paths map to null. */
export async function signReadUrls(storedPaths: string[], expiresIn = 600): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>()
  if (!isR2Configured()) return result
  const { client: s3, bucket } = r2()
  await Promise.all(storedPaths.map(async stored => {
    try {
      const key = stored.slice(R2_PREFIX.length)
      result.set(stored, await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn }))
    } catch {
      result.set(stored, null)
    }
  }))
  return result
}

/** Reads an uploaded object's real size and type, so the client's claims are never trusted. */
export async function inspectObject(storedPath: string): Promise<{ size: number; contentType: string | null } | null> {
  const { client: s3, bucket } = r2()
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: storedPath.slice(R2_PREFIX.length) }))
    return { size: Number(head.ContentLength ?? 0), contentType: head.ContentType ?? null }
  } catch {
    return null
  }
}

export async function deleteObject(storedPath: string): Promise<void> {
  const { client: s3, bucket } = r2()
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: storedPath.slice(R2_PREFIX.length) })).catch(() => undefined)
}

/** Reads a whole stored object into memory. Callers must cap the size first. */
export async function readObject(storedPath: string): Promise<Buffer | null> {
  const { client: s3, bucket } = r2()
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: storedPath.slice(R2_PREFIX.length) }))
    const bytes = await res.Body?.transformToByteArray()
    return bytes ? Buffer.from(bytes) : null
  } catch {
    return null
  }
}

/** Writes a server-generated object under `{area}/{workspaceId}/` and returns its stored path. */
export async function putObject(input: { area: string; workspaceId: string; fileName: string; contentType: string; body: Buffer }): Promise<string> {
  const { client: s3, bucket } = r2()
  const key = `${input.area}/${input.workspaceId}/${randomUUID()}/${safeFileName(input.fileName)}`
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: input.contentType, Body: input.body }))
  return `${R2_PREFIX}${key}`
}