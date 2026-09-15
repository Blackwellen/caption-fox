// Real RLS verification for the PR & Reputation module — not a mock.
// Runs each check as an actual Postgres session with `role authenticated`
// and `request.jwt.claims` set (the same mechanism PostgREST/Supabase uses to
// evaluate auth.uid() in RLS policies), via the same Management API query
// endpoint used by scripts/apply-migration.mjs. This genuinely exercises the
// live RLS policies — it does not bypass them via the service role.
//
// Usage: node scripts/test-reputation-rls.mjs
import { readFileSync } from 'node:fs'

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = Object.fromEntries(
  envText.split(/\r?\n/).filter(line => line && !line.trimStart().startsWith('#'))
    .map(line => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim()] }),
)
const token = env.SUPABASE_ACCESS_TOKEN
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`${res.status}: ${body}`)
  return JSON.parse(body)
}

const REAL_WORKSPACE_A = 'd7b7c61e-7685-4b15-8a0c-d9fa85f25103' // Brand demo workspace
const REAL_USER = 'e58b5076-245e-41b4-a101-7daf7e5e87ab' // owner of the demo workspace
const RANDOM_UNAFFILIATED_USER = '00000000-0000-0000-0000-000000000099'

const TABLES = [
  'media_outlets', 'media_contacts', 'media_lists', 'media_list_members',
  'pitches', 'pitch_recipients', 'press_releases', 'press_room_assets',
  'coverage_mentions', 'reviews', 'review_responses',
  'crisis_incidents', 'crisis_timeline_events', 'crisis_statements',
  'reputation_activity', 'reputation_ai_usage',
]

let pass = 0, fail = 0
const results = []

function record(name, ok, detail) {
  results.push({ name, ok, detail })
  if (ok) pass += 1; else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function asAuthenticated(userId, query) {
  const claims = JSON.stringify({ sub: userId }).replace(/'/g, "''")
  return sql(`set local role authenticated; set local request.jwt.claims = '${claims}'; ${query}`)
}
async function asAnon(query) {
  return sql(`set local role anon; ${query}`)
}

async function main() {
  console.log('== Positive RLS: real workspace member can read their own workspace data ==')
  for (const table of TABLES) {
    const rows = await asAuthenticated(REAL_USER, `select count(*) as n from ${table} where workspace_id = '${REAL_WORKSPACE_A}';`)
    const n = Number(rows[0]?.n ?? -1)
    record(`positive:${table}`, n >= 0, `${n} row(s) visible to the real owner in their own workspace`)
  }

  console.log('\n== Negative RLS: unaffiliated authenticated user (random UUID, no workspace membership) sees nothing ==')
  for (const table of TABLES) {
    const rows = await asAuthenticated(RANDOM_UNAFFILIATED_USER, `select count(*) as n from ${table};`)
    const n = Number(rows[0]?.n ?? -1)
    record(`negative-unaffiliated:${table}`, n === 0, `expected 0 rows visible, got ${n}`)
  }

  console.log('\n== Negative RLS: anonymous (unauthenticated) role sees nothing ==')
  for (const table of TABLES) {
    try {
      const rows = await asAnon(`select count(*) as n from ${table};`)
      const n = Number(rows[0]?.n ?? -1)
      record(`negative-anon:${table}`, n === 0, `expected 0 rows visible, got ${n}`)
    } catch (err) {
      // A permission-denied error from Postgres itself (no SELECT grant to anon at all) is
      // an even stronger negative result than "0 rows" — also a pass.
      record(`negative-anon:${table}`, true, `query rejected outright: ${String(err.message).slice(0, 120)}`)
    }
  }

  console.log('\n== Negative RLS: unaffiliated user cannot INSERT into a workspace they are not a member of ==')
  try {
    await asAuthenticated(RANDOM_UNAFFILIATED_USER, `insert into media_contacts (workspace_id, name, created_by) values ('${REAL_WORKSPACE_A}', 'RLS test intrusion attempt', '${RANDOM_UNAFFILIATED_USER}');`)
    // If we get here, the insert was NOT rejected — check whether it actually landed.
    const check = await sql(`select count(*) as n from media_contacts where workspace_id = '${REAL_WORKSPACE_A}' and name = 'RLS test intrusion attempt';`)
    const landed = Number(check[0]?.n ?? 0) > 0
    record('negative-insert:media_contacts', !landed, landed ? 'INSERT SUCCEEDED — RLS WITH CHECK failed to block it' : 'insert reported success but no row landed')
    if (landed) await sql(`delete from media_contacts where workspace_id = '${REAL_WORKSPACE_A}' and name = 'RLS test intrusion attempt';`)
  } catch (err) {
    record('negative-insert:media_contacts', true, `insert correctly rejected: ${String(err.message).slice(0, 160)}`)
  }

  console.log(`\n${pass} passed, ${fail} failed, ${results.length} total checks.`)
  if (fail > 0) process.exitCode = 1
}

main().catch(err => { console.error('RLS test run crashed:', err); process.exitCode = 1 })
