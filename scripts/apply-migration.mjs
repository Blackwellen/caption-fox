// Applies a SQL file to the linked Supabase project via the Management API.
// Usage: node scripts/apply-migration.mjs supabase/migrations/<file>.sql
import { readFileSync } from 'node:fs'

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = Object.fromEntries(
  envText.split(/\r?\n/)
    .filter(line => line && !line.trimStart().startsWith('#'))
    .map(line => {
      const i = line.indexOf('=')
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
    }),
)

const token = env.SUPABASE_ACCESS_TOKEN
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN missing from .env.local')

const file = process.argv[2]
if (!file) throw new Error('Pass a .sql file path')
const query = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
})

const body = await res.text()
if (!res.ok) {
  console.error(`FAILED ${res.status}\n${body}`)
  process.exit(1)
}
console.log(`OK ${res.status} — applied ${file}`)
console.log(body.slice(0, 2000))
