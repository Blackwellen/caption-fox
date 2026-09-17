// Functional verification for Campaign Manager → Strategy.
//
// Signs in (session held in memory only), selects a demo workspace and
// requests every Strategy route and view, asserting on what renders: status,
// time, the route's own H1, and the absence of the error boundary.
//
//   node scripts/verify-strategy.mjs                 # :3004, brand demo
//   ORIGIN=http://127.0.0.1:3004 KIND=agency node scripts/verify-strategy.mjs
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const url = env.NEXT_PUBLIC_SUPABASE_URL
const ref = new URL(url).hostname.split('.')[0]
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:3004'
const KIND = process.env.KIND || 'brand'
const WORKSPACE = { brand: 'd7b7c61e-7685-4b15-8a0c-d9fa85f25103', business: '173b63f8-3263-4609-a4f7-c6e113f25bda', agency: '48d161b1-5db4-4a28-82a4-e19b839aa3ce', creator: '0cf44b57-cf4c-45c8-b600-e435e3bd4e9e' }
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null

const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'jamahlthomas1996@gmail.com' })
const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const { data: sess } = await anon.auth.verifyOtp({ type: 'email', token_hash: link.properties.hashed_token })

const payload = 'base64-' + Buffer.from(JSON.stringify(sess.session)).toString('base64')
const nm = `sb-${ref}-auth-token`
const CHUNK = 3180
const cookie = [
  ...(payload.length <= CHUNK ? [[nm, payload]]
    : Array.from({ length: Math.ceil(payload.length / CHUNK) }, (_, i) => [`${nm}.${i}`, payload.slice(i * CHUNK, (i + 1) * CHUNK)])),
  ['cf_workspace', WORKSPACE[KIND]],
].map(([n, v]) => `${n}=${v}`).join('; ')

const get = async (path, withCookie = true) => {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 240_000)
  try {
    const r = await fetch(ORIGIN + path, { headers: withCookie ? { cookie } : {}, redirect: 'manual', signal: controller.signal })
    const html = await r.text()
    return { status: r.status, html, ms: Date.now() - started, location: r.headers.get('location') }
  } finally { clearTimeout(timer) }
}

let pass = 0, fail = 0
const check = (name, ok, detail = '') => {
  if (ok) pass += 1; else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}
const errorText = html => {
  const m = html.match(/This Strategy page could not load[\s\S]{0,400}/)
  return m ? m[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300) : ''
}

const base = `/${KIND}/strategy`
const ROUTES = [
  ['overview', base, 'Strategic planning and governance'],
  ['overview table', `${base}?view=table`, 'Initiatives'],
  ['objectives', `${base}/objectives`, 'Manage and track strategic objectives'],
  ['objectives table', `${base}/objectives?view=table`, 'All objectives'],
  ['objectives timeline', `${base}/objectives?view=timeline`, 'Objective timeline'],
  ['objectives kanban', `${base}/objectives?view=kanban`, 'Objectives board'],
  ['audiences', `${base}/audiences`, 'activate the right audiences'],
  ['research', `${base}/research`, 'collect, and manage the insights'],
  ['positioning', `${base}/positioning`, 'differentiate, and validate'],
  ['plans', `${base}/plans`, 'clear plans, milestones'],
  ['forecasts', `${base}/forecasts`, 'Model future performance'],
].filter(([name]) => !ONLY || ONLY.some(prefix => name.startsWith(prefix)))

for (const [name, path, marker] of ROUTES) {
  try {
    const r = await get(path)
    const err = errorText(r.html)
    check(`${name} ${path}`, r.status === 200 && !err && r.html.includes(marker), `${r.status} ${r.ms}ms${err ? ` ${err}` : ''}${r.status !== 200 && r.location ? ` → ${r.location}` : ''}`)
  } catch (error) {
    check(`${name} ${path}`, false, String(error))
  }
}

if (!ONLY) {
  const anonymous = await get(base, false)
  check('unauthenticated redirects to login', [302, 303, 307, 308].includes(anonymous.status) && /login/.test(anonymous.location ?? ''), `${anonymous.status} → ${anonymous.location}`)
  const legacy = await get('/app/strategy/objectives?view=table')
  check('legacy /app/strategy redirects to canonical', [307, 308].includes(legacy.status) && (legacy.location ?? '').includes(`/${KIND}/strategy/objectives`), `${legacy.status} → ${legacy.location}`)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
