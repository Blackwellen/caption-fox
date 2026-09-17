// RLS verification for Campaign Manager → Strategy.
//
// Runs real statements as specific users (JWT claims + authenticated role)
// inside a transaction that is always rolled back, so nothing persists.
// Positive cases must succeed; negative cases must be denied or see nothing.
//
//   node scripts/verify-strategy-rls.mjs
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
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  return { ok: res.ok, body: text }
}

/** Runs `statement` as `user`, returns { ok, body }. Always rolls back. */
function asUser(user, statement) {
  const claims = JSON.stringify({ sub: user, role: 'authenticated' }).replace(/'/g, "''")
  return sql(`begin;
set local role authenticated;
select set_config('request.jwt.claims', '${claims}', true);
${statement};
rollback;`)
}

let pass = 0, fail = 0
const check = (name, ok, detail = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail.slice(0, 300)}`}`) }
const denied = r => !r.ok && /row-level security|permission denied|42501/i.test(r.body)
const count = r => { try { const rows = JSON.parse(r.body); return Number(rows.at(-1)?.count ?? rows[0]?.count ?? -1) } catch { return -1 } }

const insertObjective = ws => `insert into public.strategy_objectives (workspace_id, name) values ('${ws}', 'RLS probe')`
const readObjectives = ws => `select count(*)::int as count from public.strategy_objectives where workspace_id = '${ws}'`

// ── Reads ────────────────────────────────────────────────────────────────────
for (const role of ['owner', 'manager', 'member', 'viewer']) {
  const r = await asUser(USERS[role], readObjectives(BRAND))
  check(`${role} can read own workspace objectives`, r.ok && count(r) > 0, r.body)
}
{
  const r = await asUser(USERS.viewer, readObjectives(AGENCY))
  check('viewer cannot read another workspace (0 rows)', r.ok && count(r) === 0, r.body)
  const a = await asUser(USERS.admin, `select count(*)::int as count from public.strategy_research_items where workspace_id = '${AGENCY}'`)
  check('admin of Brand sees no Agency research', a.ok && count(a) === 0, a.body)
}

// ── Writes ───────────────────────────────────────────────────────────────────
for (const role of ['owner', 'admin', 'manager']) {
  const r = await asUser(USERS[role], insertObjective(BRAND))
  check(`${role} can create an objective`, r.ok, r.body)
}
for (const role of ['member', 'viewer']) {
  const r = await asUser(USERS[role], insertObjective(BRAND))
  check(`${role} cannot create an objective (RLS)`, denied(r), r.body)
}
{
  const r = await asUser(USERS.admin, insertObjective(AGENCY))
  check('Brand admin cannot write into Agency workspace', denied(r), r.body)
  const u = await asUser(USERS.viewer, `with x as (update public.strategy_plans set progress = 1 where workspace_id = '${BRAND}' returning 1) select count(*)::int as count from x`)
  check('viewer update affects 0 plans', u.ok ? count(u) === 0 : denied(u), u.body)
  const d = await asUser(USERS.member, `with x as (delete from public.strategy_research_items where workspace_id = '${BRAND}' returning 1) select count(*)::int as count from x`)
  check('member delete affects 0 research items', d.ok ? count(d) === 0 : denied(d), d.body)
  const act = await asUser(USERS.owner, `with x as (delete from public.strategy_activity where workspace_id = '${BRAND}' returning 1) select count(*)::int as count from x`)
  check('activity log is append-only (owner deletes 0 rows)', act.ok ? count(act) === 0 : denied(act), act.body)
}

// ── Integrity guards ─────────────────────────────────────────────────────────
{
  const r = await asUser(USERS.owner, `insert into public.strategy_links (workspace_id, source_type, source_id, target_type, target_id)
    select '${BRAND}', 'objective', (select id from public.strategy_objectives where workspace_id = '${BRAND}' limit 1),
           'audience', (select id from public.strategy_audiences where workspace_id = '${AGENCY}' limit 1)`)
  check('cross-workspace link is rejected by trigger', !r.ok && /same workspace/i.test(r.body), r.body)
  const cyc = await sql(`begin;
    insert into public.strategy_plan_dependencies (workspace_id, plan_id, depends_on_plan_id)
    select d.workspace_id, d.depends_on_plan_id, d.plan_id from public.strategy_plan_dependencies d where d.workspace_id = '${BRAND}' limit 1;
    rollback;`)
  check('circular plan dependency is rejected', !cyc.ok && /circular/i.test(cyc.body), cyc.body)
}

// ── Saved views are private ──────────────────────────────────────────────────
{
  const r = await asUser(USERS.viewer, `insert into public.strategy_saved_views (workspace_id, user_id, module, name, query) values ('${BRAND}', '${USERS.manager}', 'objectives', 'spoof', '')`)
  check("viewer cannot create a saved view as another user", denied(r), r.body)
  const ok = await asUser(USERS.viewer, `insert into public.strategy_saved_views (workspace_id, user_id, module, name, query) values ('${BRAND}', '${USERS.viewer}', 'objectives', 'mine', 'status=at_risk')`)
  check('viewer can save their own view', ok.ok, ok.body)
}

// ── Storage ──────────────────────────────────────────────────────────────────
{
  const up = name => `insert into storage.objects (bucket_id, name, owner) values ('strategy-research', '${name}', '${USERS.manager}')`
  const m = await asUser(USERS.manager, up(`${BRAND}/research/00000000-0000-0000-0000-000000000001-probe.pdf`))
  check('manager can upload into own workspace folder', m.ok, m.body)
  const x = await asUser(USERS.manager, up(`00000000-0000-0000-0000-000000000000/research/probe.pdf`))
  check('manager cannot upload into a folder outside their workspaces', denied(x), x.body)
  const v = await asUser(USERS.viewer, up(`${BRAND}/research/00000000-0000-0000-0000-000000000002-probe.pdf`))
  check('viewer cannot upload research files', denied(v), v.body)
  const bucket = await sql(`select public from storage.buckets where id = 'strategy-research'`)
  check('research bucket is private', bucket.ok && /"public":false/.test(bucket.body), bucket.body)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
