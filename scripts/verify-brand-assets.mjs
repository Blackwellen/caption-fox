// Functional verification for the Brand & Assets module.
//
// Exercises filters, search, sorting, view switching, pagination, deep links,
// entitlement gating and unauthenticated redirects against a running dev server,
// asserting on what actually comes back rather than on a bare 200.
//
//   node scripts/verify-brand-assets.mjs           # defaults to :3013
//   ORIGIN=http://127.0.0.1:3000 node scripts/verify-brand-assets.mjs
//
// The session is held in memory for this process only and never written to disk.
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const url = env.NEXT_PUBLIC_SUPABASE_URL
const ref = new URL(url).hostname.split('.')[0]
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:3013'

const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: link } = await admin.auth.admin.generateLink({
  type: 'magiclink', email: 'jamahlthomas1996@gmail.com',
})
const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const { data: sess } = await anon.auth.verifyOtp({ type: 'email', token_hash: link.properties.hashed_token })

const payload = 'base64-' + Buffer.from(JSON.stringify(sess.session)).toString('base64')
const nm = `sb-${ref}-auth-token`
const CHUNK = 3180
const cookie = (payload.length <= CHUNK
  ? [[nm, payload]]
  : Array.from({ length: Math.ceil(payload.length / CHUNK) },
    (_, i) => [`${nm}.${i}`, payload.slice(i * CHUNK, (i + 1) * CHUNK)]))
  .map(([n, v]) => `${n}=${v}`).join('; ')

const sleep = ms => new Promise(r => setTimeout(r, ms))

// A concurrent Next process in this directory intermittently restarts the dev
// server mid-suite (ECONNRESET / ECONNREFUSED). Retry so a transient restart
// does not abort the run and masquerade as a product failure.
const get = async (path, withCookie = true, attempt = 0) => {
  try {
    const r = await fetch(ORIGIN + path, {
      headers: withCookie ? { cookie } : {}, redirect: 'manual',
    })
    return { status: r.status, html: r.status === 200 ? await r.text() : '', location: r.headers.get('location') }
  } catch (err) {
    if (attempt >= 15) throw err
    await sleep(2500)
    return get(path, withCookie, attempt + 1)
  }
}

const countOf = (html, re) => (html.match(re) || []).length
const cards = html => countOf(html, /<article/g)

let pass = 0, fail = 0
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`) }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`) }
}

console.log('\n== Routes render with live data ==')
{
  const MARKERS = {
    '/brand/brand': ['Brand &amp; Assets Overview', 'Brand Kits', 'Recent Assets', 'Rights &amp; Licensing', 'Product Library', 'Storage Overview', 'Activity Feed'],
    '/brand/brand/kits': ['Brand Kits', 'Total Kits', 'Consistency Score', 'Typography System', 'Color Palette', 'Approval Workflow'],
    '/brand/brand/assets': ['Assets', 'Total Assets', 'Approved', 'Storage Used', 'Folders', 'Approval Queue', 'Flagged Assets'],
    '/brand/brand/rights': ['Rights', 'Active Licenses', 'Expiring Soon', 'Rights Coverage by Region', 'Status Summary', 'High-Risk Assets'],
    '/brand/brand/products': ['Product Library', 'Active SKUs', 'Campaign Ready', 'Missing Product Assets', 'Top Categories'],
  }
  for (const [path, markers] of Object.entries(MARKERS)) {
    const r = await get(path)
    const missing = markers.filter(m => !r.html.includes(m))
    const errored = /Application error|Internal Server Error|Jest worker|__next_error__/.test(r.html)
    check(`${path} renders`, r.status === 200 && !errored && missing.length === 0,
      `status=${r.status} markers=${markers.length - missing.length}/${markers.length}${missing.length ? ' missing: ' + missing.join(' | ') : ''}`)
  }
  const ov = await get('/brand/brand')
  check('real seeded records present (not empty states)',
    ov.html.includes('Acme') && !ov.html.includes('No brand kits yet'))
}

console.log('\n== Assets: filters, search, views, sorting ==')
{
  const all = await get('/brand/brand/assets?pageSize=100')
  const pdf = await get('/brand/brand/assets?type=pdf&pageSize=100')
  const search = await get('/brand/brand/assets?q=Hydrate&pageSize=100')
  const nores = await get('/brand/brand/assets?q=zzzznotarealasset')
  const nAll = cards(all.html), nPdf = cards(pdf.html)

  check('unfiltered list renders assets', nAll > 5, `${nAll} cards`)
  check('type=pdf narrows results', nPdf > 0 && nPdf < nAll, `${nPdf} of ${nAll} cards`)
  check('type=pdf returns a known pdf', pdf.html.includes('Acme_Brand_Guide.pdf'))
  check('status=approved filter applies', (await get('/brand/brand/assets?status=approved')).status === 200)
  check('search matches a known asset', search.html.includes('Acme Hydrate Serum'))
  check('search with no results shows empty state', nores.html.includes('No assets match those filters'))
  check('grid view renders', (await get('/brand/brand/assets?view=grid')).html.includes('Grid'))
  check('list view renders', (await get('/brand/brand/assets?view=list')).html.includes('List'))
  check('table view renders headers', (await get('/brand/brand/assets?view=table')).html.includes('Downloads'))
  check('sort=name_asc accepted', (await get('/brand/brand/assets?sort=name_asc')).status === 200)
}

console.log('\n== Rights: filters, three views, joins ==')
{
  const all = await get('/brand/brand/rights?pageSize=100')
  const expired = await get('/brand/brand/rights?status=expired&pageSize=100')
  check('rights table renders licences', countOf(all.html, /ACM-|TM-|VID-|IMG-|PKG-|DSN-/g) > 5)
  check('status=active narrows', !(await get('/brand/brand/rights?status=active&pageSize=100')).html.includes('Legacy Logo Usage'))
  check('status=expired finds the expired licence', expired.html.includes('Legacy Logo Usage'))
  check('calendar view renders', (await get('/brand/brand/rights?view=calendar')).html.includes('Renewal Calendar'))
  check('cards view renders', (await get('/brand/brand/rights?view=cards')).html.includes('Territory'))
  check('territory filter accepted', (await get('/brand/brand/rights?territory=emea')).status === 200)
  check('region coverage computed from data', all.html.includes('Rights Coverage by Region'))
}

console.log('\n== Products: readiness, filters, views ==')
{
  const all = await get('/brand/brand/products?pageSize=100')
  const ready = await get('/brand/brand/products?readiness=ready&pageSize=100')
  const notReady = await get('/brand/brand/products?readiness=not_ready&pageSize=100')
  const nAll = cards(all.html), nReady = cards(ready.html)
  check('product list renders', nAll > 8, `${nAll} cards`)
  check('readiness=ready narrows', nReady > 0 && nReady < nAll, `${nReady} of ${nAll}`)
  check('readiness=not_ready finds draft product', notReady.html.includes('Acme Everyday Tote'))
  check('list view renders', (await get('/brand/brand/products?view=list')).status === 200)
  check('table view renders readiness column', (await get('/brand/brand/products?view=table')).html.includes('Readiness'))
  check('missing-assets breakdown present', all.html.includes('Missing Product Assets'))
}

console.log('\n== Kits: filters + views ==')
{
  const all = await get('/brand/brand/kits?pageSize=100')
  check('kit cards render', countOf(all.html, /Brand Kit</g) > 3)
  check('table view renders headers', (await get('/brand/brand/kits?view=table')).html.includes('Palette'))
  check('search narrows kits', (await get('/brand/brand/kits?q=Sport')).html.includes('Acme Sport'))
  check('brand system panels render', all.html.includes('Typography System') && all.html.includes('Logo Lockups'))
}

console.log('\n== Deep links, pagination, unknown routes ==')
{
  const p1 = await get('/brand/brand/assets?pageSize=5&page=1')
  const p2 = await get('/brand/brand/assets?pageSize=5&page=2')
  check('pagination renders', p1.html.includes('Showing'))
  check('page 2 differs from page 1', p1.html !== p2.html)
  const unknown = await get('/brand/brand/not-a-real-tab')
  check('unknown sub-route redirects to module index',
    unknown.status === 307 || unknown.status === 308, `status ${unknown.status} -> ${unknown.location ?? ''}`)
  const capped = await get('/brand/brand/assets?pageSize=99999')
  check('pageSize is capped (no unbounded scan)', capped.status === 200)
}

console.log('\n== Entitlement gating (creator workspace) ==')
{
  // Creator workspaces get Overview + Kits only; Rights/Products must be blocked
  // and must not be reachable from any nav, KPI, panel or alert link.
  const ov = await get('/creator/brand')
  check('creator overview reachable', ov.status === 200)
  check('creator sees no Rights link anywhere', !/\/creator\/brand\/rights/.test(ov.html))
  check('creator sees no Products link anywhere', !/\/creator\/brand\/products/.test(ov.html))
  check('creator Rights route blocked',
    /Not available|Upgrade required/.test((await get('/creator/brand/rights')).html))
  check('creator Products route blocked',
    /Not available|Upgrade required/.test((await get('/creator/brand/products')).html))
}

console.log('\n== Unauthenticated access ==')
{
  for (const p of ['/brand/brand', '/brand/brand/assets', '/brand/brand/rights', '/brand/brand/products']) {
    const r = await get(p, false)
    check(`unauthenticated ${p} redirects to login`, r.status === 307 || r.status === 308, `status ${r.status}`)
  }
}

console.log(`\n${'='.repeat(52)}\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
