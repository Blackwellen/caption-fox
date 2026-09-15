// Uploads the Brand & Assets demo media to the private Cloudflare R2 bucket,
// using the keys that supabase/seed_brand_assets_media.sql wrote to the rows.
//
//   python scripts/render-brand-seed-media.py      # once, renders the files
//   node scripts/apply-migration.mjs supabase/seed_brand_assets_media.sql
//   node scripts/seed-brand-media-r2.mjs
//
// Keys are read back from the database rather than recomputed, so the SQL
// seeder stays the single source of truth for where each object lives.
// Afterwards the true byte sizes are written back and storage is recalculated.
import fs from 'node:fs'
import path from 'node:path'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))

// Same endpoint normalisation as src/lib/storage/r2.ts (strip a trailing bucket path).
const endpoint = new URL(env.CLOUDFLARE_R2_S3_API).origin
const Bucket = env.CLOUDFLARE_S3_BUCKET
const s3 = new S3Client({ region: 'auto', endpoint,
  credentials: { accessKeyId: env.CLOUDFLARE_ACCESS_KEY_ID, secretAccessKey: env.CLOUDFLARE_SECRET_ACCESS } })
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const ROOT = path.join('supabase', 'seed-media', 'brand-assets')
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'))

const keyOf = stored => stored.startsWith('r2:') ? stored.slice(3) : stored

async function put(stored, file, ContentType) {
  const key = keyOf(stored)
  const Body = fs.readFileSync(path.join(ROOT, file))
  await s3.send(new PutObjectCommand({ Bucket, Key: key, Body, ContentType, CacheControl: 'private, max-age=86400' }))
  return Body.length
}

const { data: ws } = await db.from('workspaces').select('id').eq('type', 'brand').order('created_at').limit(1).single()
const { data: assets, error } = await db.from('media_assets')
  .select('id, file_name, file_path, thumbnail_path').eq('workspace_id', ws.id).eq('is_demo', true)
if (error) throw error

let uploaded = 0
for (const a of assets) {
  const packshot = a.file_name.match(/^(.+) Packshot\.jpg$/)
  const entry = packshot ? manifest.products[packshot[1]] : manifest.assets[a.file_name]
  if (!entry) { console.log('  skip (no media):', a.file_name); continue }
  if (a.thumbnail_path) { await put(a.thumbnail_path, entry.thumb, 'image/jpeg'); uploaded++ }
  if (entry.original && a.file_path) {
    const size = await put(a.file_path, entry.original, entry.mime); uploaded++
    await db.from('media_assets').update({ file_size: size }).eq('id', a.id)
  }
  console.log('  ok', a.file_name)
}

for (const [slug, file] of Object.entries(manifest.avatars)) {
  await put(`r2:brand-assets/${ws.id}/avatars/${slug}.jpg`, file, 'image/jpeg'); uploaded++
}

for (const [slug, file] of Object.entries(manifest.logos ?? {})) {
  await put(`r2:brand-assets/${ws.id}/brands/${slug}/logo.png`, file, 'image/png'); uploaded++
}

// Storage used from real sizes only.
const { data: sizes } = await db.from('media_assets').select('file_size').eq('workspace_id', ws.id).is('archived_at', null)
const bytes = (sizes ?? []).reduce((n, r) => n + (r.file_size ?? 0), 0)
await db.from('workspace_storage').upsert({ workspace_id: ws.id, bytes_used: bytes, asset_count: sizes.length, recalculated_at: new Date().toISOString() })
console.log(`\n${uploaded} objects uploaded to r2://${Bucket}; storage used ${bytes} bytes across ${sizes.length} assets`)
