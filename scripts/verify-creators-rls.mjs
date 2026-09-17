// RLS + trigger verification for Creators & UGC.
//
// Runs real statements as specific users (JWT claims + authenticated role)
// inside a transaction that is always rolled back, so nothing persists.
// Positive cases must succeed; negative cases must be denied or see nothing.
//
//   node scripts/verify-creators-rls.mjs
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)
  .filter(line => line && !line.trimStart().startsWith('#') && line.includes('='))
  .map(line => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim()] }))
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]

const BRAND = 'd7b7c61e-7685-4b15-8a0c-d9fa85f25103'
const AGENCY = '48d161b1-5db4-4a28-82a4-e19b839aa3ce'
const USERS = {
  owner: 'e58b5076-245e-41b4-a101-7daf7e5e87ab',
  admin: '0b7e1a00-0000-4000-8000-000000000005',   // Jason Ranti — brand only
  manager: '1bfbe54d-3e3a-4262-92e8-76692d66ef7b', // Emma Davis
  member: '611d38bf-1300-4546-87c1-68c280de3504',  // Liam Chen
  viewer: '0b7e1a00-0000-4000-8000-000000000007',  // Grace Kim — brand only
  outsider: '00000000-0000-4000-8000-00000000dead',
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return { ok: res.ok, body: await res.text() }
}

function asUser(user, statement) {
  const claims = JSON.stringify({ sub: user, role: 'authenticated' }).replace(/'/g, "''")
  return sql(`begin;
set local role authenticated;
select set_config('request.jwt.claims', '${claims}', true);
${statement};
rollback;`)
}

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  if (ok) pass += 1; else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  — ${String(detail).slice(0, 300)}`}`)
}
const denied = r => !r.ok && /row-level security|permission denied|42501/i.test(r.body)
const rows = r => { try { const data = JSON.parse(r.body); return Array.isArray(data) ? data : [] } catch { return [] } }
const count = r => Number(rows(r).at(-1)?.count ?? -1)
/** An UPDATE/DELETE filtered by RLS succeeds with zero affected rows. */
const affected = r => rows(r).filter(row => row && 'id' in row).length

const probeCreator = ws => `insert into public.ugc_creators (workspace_id, name) values ('${ws}', 'RLS probe') returning id`
const probeBrief = ws => `insert into public.ugc_briefs (workspace_id, title) values ('${ws}', 'RLS probe') returning id`
const readCount = (table, ws) => `select count(*)::int as count from public.${table} where workspace_id = '${ws}'`

// ── Reads ────────────────────────────────────────────────────────────────────
for (const role of ['owner', 'manager', 'member', 'viewer']) {
  const r = await asUser(USERS[role], readCount('ugc_creators', BRAND))
  check(`${role} can read Brand creators`, r.ok && count(r) > 0, r.body)
}
{
  const r = await asUser(USERS.viewer, readCount('ugc_creators', AGENCY))
  check('viewer (Brand only) sees 0 Agency creators', r.ok && count(r) === 0, r.body)
  const a = await asUser(USERS.admin, readCount('ugc_submissions', AGENCY))
  check('admin of Brand sees 0 Agency submissions', a.ok && count(a) === 0, a.body)
  const o = await asUser(USERS.outsider, readCount('ugc_rights', BRAND))
  check('non-member sees 0 Brand rights', o.ok && count(o) === 0, o.body)
}

// Financial data: payments are owner/admin/manager only.
for (const role of ['owner', 'manager']) {
  const r = await asUser(USERS[role], readCount('ugc_payments', BRAND))
  check(`${role} can read Brand payments`, r.ok && count(r) > 0, r.body)
}
for (const role of ['member', 'viewer']) {
  const r = await asUser(USERS[role], readCount('ugc_payments', BRAND))
  check(`${role} sees 0 payments (financial data hidden)`, r.ok && count(r) === 0, r.body)
  const b = await asUser(USERS[role], readCount('ugc_payment_batches', BRAND))
  check(`${role} sees 0 payment batches`, b.ok && count(b) === 0, b.body)
}

// ── Writes: creators (manage_creators) ──────────────────────────────────────
for (const role of ['owner', 'admin', 'manager']) {
  const r = await asUser(USERS[role], probeCreator(BRAND))
  check(`${role} can create a creator`, r.ok, r.body)
}
for (const role of ['member', 'viewer']) {
  const r = await asUser(USERS[role], probeCreator(BRAND))
  check(`${role} cannot create a creator`, denied(r), r.body)
}
{
  const r = await asUser(USERS.admin, probeCreator(AGENCY))
  check('admin of Brand cannot insert a creator into the Agency workspace', denied(r), r.body)
}

// ── Writes: briefs (create_brief includes member) ───────────────────────────
for (const role of ['owner', 'manager', 'member']) {
  const r = await asUser(USERS[role], probeBrief(BRAND))
  check(`${role} can create a brief`, r.ok, r.body)
}
{
  const r = await asUser(USERS.viewer, probeBrief(BRAND))
  check('viewer cannot create a brief', denied(r), r.body)
  const u = await asUser(USERS.viewer, `update public.ugc_submissions set status = 'approved' where workspace_id = '${BRAND}' returning id`)
  check('viewer cannot approve submissions via the API', u.ok && affected(u) === 0, u.body)
  const d = await asUser(USERS.viewer, `delete from public.ugc_rights where workspace_id = '${BRAND}' returning id`)
  check('viewer cannot delete rights records', d.ok && affected(d) === 0, d.body)
}

// ── Writes: payments (owner only) ───────────────────────────────────────────
{
  const m = await asUser(USERS.manager, `update public.ugc_payments set notes = 'probe' where workspace_id = '${BRAND}' returning id`)
  check('manager cannot modify payments', m.ok && affected(m) === 0, m.body)
  const o = await asUser(USERS.owner, `update public.ugc_payments set notes = 'probe' where workspace_id = '${BRAND}' and status = 'approved' returning id`)
  check('owner can modify payments', o.ok && affected(o) > 0, o.body)
  const i = await asUser(USERS.member, `insert into public.ugc_payments (workspace_id, creator_id, amount) select '${BRAND}', id, 10 from public.ugc_creators where workspace_id = '${BRAND}' limit 1 returning id`)
  check('member cannot create payments', denied(i) || (i.ok && affected(i) === 0), i.body)
}

// ── Financial safety trigger ────────────────────────────────────────────────
{
  const bad = await asUser(USERS.owner, `update public.ugc_payments set status = 'draft' where workspace_id = '${BRAND}' and status = 'paid'`)
  check('paid payment cannot move back to draft (trigger)', !bad.ok && /Invalid payment status transition/i.test(bad.body), bad.body)
  const locked = await asUser(USERS.owner, `update public.ugc_payments set amount = amount + 1 where workspace_id = '${BRAND}' and status = 'paid'`)
  check('paid payment amount is locked (trigger)', !locked.ok && /locked/i.test(locked.body), locked.body)
  const ok = await asUser(USERS.owner, `update public.ugc_payments set status = 'scheduled' where workspace_id = '${BRAND}' and status = 'approved' returning id`)
  check('valid approved -> scheduled transition succeeds', ok.ok, ok.body)
}

// ── Activity is append-only ─────────────────────────────────────────────────
{
  const u = await asUser(USERS.owner, `update public.ugc_activity set summary = 'tampered' where workspace_id = '${BRAND}' returning id`)
  check('activity audit trail cannot be edited', u.ok && affected(u) === 0, u.body)
  const spoof = await asUser(USERS.member, `insert into public.ugc_activity (workspace_id, actor_id, entity_type, action, summary) values ('${BRAND}', '${USERS.owner}', 'creator', 'x', 'spoof')`)
  check('member cannot write activity as another user', denied(spoof), spoof.body)
}

// ── Saved views ─────────────────────────────────────────────────────────────
{
  const mine = await asUser(USERS.member, `insert into public.creator_saved_views (workspace_id, owner_id, surface, name, query) values ('${BRAND}', '${USERS.member}', 'creators', 'RLS probe', '{}') returning id`)
  check('member can save a personal view', mine.ok, mine.body)
  const other = await asUser(USERS.member, `insert into public.creator_saved_views (workspace_id, owner_id, surface, name, query) values ('${BRAND}', '${USERS.owner}', 'creators', 'RLS probe', '{}')`)
  check('member cannot save a view as another user', denied(other), other.body)
}

// ── Storage: private submission media ───────────────────────────────────────
{
  const v = await asUser(USERS.viewer, `select count(*)::int as count from storage.objects where bucket_id = 'ugc-submissions' and name like '${BRAND}/%'`)
  check('viewer can read Brand submission objects (for signed URLs)', v.ok && count(v) > 0, v.body)
  const x = await asUser(USERS.viewer, `select count(*)::int as count from storage.objects where bucket_id = 'ugc-submissions' and name like '${AGENCY}/%'`)
  check('viewer cannot read Agency submission objects', x.ok && count(x) === 0, x.body)
  const bucket = await sql(`select public from storage.buckets where id = 'ugc-submissions'`)
  check('ugc-submissions bucket is private', bucket.ok && rows(bucket)[0]?.public === false, bucket.body)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
