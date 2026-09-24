// Table-by-table RLS sweep for every strategy_* table (release checklist:
// positive + negative RLS, wrong workspace, wrong role, direct API access).
//
// Each check class runs as ONE SQL batch (a PL/pgSQL loop over every table
// inside a transaction that is always rolled back), so the sweep makes ~15 API
// calls instead of hundreds and never trips the Management API rate limit.
//
// Proven for every table:
//   1. RLS is enabled and every policy is scoped (no open `using (true)`).
//   2. anon (no login) reads nothing.
//   3. A Brand-only user reads 0 rows from the Agency workspace.
//   4. View-only roles (member/viewer) cannot delete in their own workspace.
//   5. A Brand admin cannot delete rows in the Agency workspace.
//   6. Positive: an owner can read their own workspace's core tables.
//   7. Release-specific: market check constraint, member cannot edit market.
//
//   node scripts/verify-strategy-rls-sweep.mjs
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)
  .filter(line => line && !line.trimStart().startsWith('#') && line.includes('='))
  .map(line => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim()] }))
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]

const BRAND = 'd7b7c61e-7685-4b15-8a0c-d9fa85f25103'
const AGENCY = '48d161b1-5db4-4a28-82a4-e19b839aa3ce'
const USERS = {
  owner: 'e58b5076-245e-41b4-a101-7daf7e5e87ab',   // owns Brand AND Agency (legitimate member of both)
  admin: '0b7e1a00-0000-4000-8000-000000000005',   // Jason Ranti — Brand only
  member: '611d38bf-1300-4546-87c1-68c280de3504',  // Liam Chen — view-only in Brand
  viewer: '0b7e1a00-0000-4000-8000-000000000007',  // Grace Kim — Brand only
}
const CORE = ['strategy_records', 'strategy_objectives', 'strategy_audiences', 'strategy_research_items',
  'strategy_positioning_frameworks', 'strategy_plans', 'strategy_forecasts', 'strategy_activity']

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/** One Management API call, with backoff when the API throttles us. */
async function sql(query) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const body = await res.text()
    if (/ThrottlerException|Too Many Requests/i.test(body) || res.status === 429) { await sleep(2000 * (attempt + 1)); continue }
    await sleep(350)
    return { ok: res.ok, body }
  }
  return { ok: false, body: 'still throttled after retries' }
}
const rows = r => { try { return JSON.parse(r.body) } catch { return [] } }

/**
 * Runs `perTable` (a SQL template with %I for the table) against every table as
 * `who`, capturing the count — or the SQLSTATE if the statement was denied —
 * per table. Returns { table: number | 'ERR:<sqlstate>' }.
 */
async function sweep(who, tableNames, template) {
  const list = tableNames.map(t => `'${t}'`).join(',')
  const role = who === 'anon'
    ? `set local role anon;`
    : `set local role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ sub: USERS[who], role: 'authenticated' })}', true);`
  const r = await sql(`begin;
${role}
do $sweep$
declare t text; n int; res jsonb := '{}'::jsonb;
begin
  foreach t in array array[${list}] loop
    begin
      execute format($q$${template}$q$, t) into n;
      res := res || jsonb_build_object(t, n);
    exception when others then
      res := res || jsonb_build_object(t, 'ERR:' || sqlstate);
    end;
  end loop;
  perform set_config('app.sweep', res::text, true);
end $sweep$;
select current_setting('app.sweep') as res;
rollback;`)
  const out = rows(r)
  const raw = out.at(-1)?.res ?? out[0]?.res
  if (!raw) throw new Error(`sweep failed for ${who}: ${r.body.slice(0, 300)}`)
  return JSON.parse(raw)
}
/** Denied (RLS/privilege error) or saw/changed nothing. */
const blocked = v => v === 0 || (typeof v === 'string' && /^ERR:(42501|42P01)$/.test(v))

let pass = 0, fail = 0
const failures = []
const check = (name, ok, detail = '') => {
  if (ok) pass++; else { fail++; failures.push(`${name}${detail ? ' — ' + String(detail).slice(0, 220) : ''}`) }
}

// ── Discover tables ──────────────────────────────────────────────────────────
const tables = rows(await sql(`
  select c.relname as table, c.relrowsecurity as rls,
    exists (select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = c.relname and k.column_name = 'workspace_id') as has_ws
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'strategy\\_%' escape '\\'
  order by 1`))
if (!tables.length) { console.error('Could not list strategy tables'); process.exit(2) }
const all = tables.map(t => t.table)
const scoped = tables.filter(t => t.has_ws).map(t => t.table)
console.log(`Sweeping ${all.length} strategy tables (${scoped.length} workspace-scoped)\n`)

// ── 1. RLS enabled + policy audit ────────────────────────────────────────────
for (const t of tables) check(`${t.table}: RLS enabled`, t.rls === true, 'row level security is OFF')
const policies = rows(await sql(`select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' and tablename like 'strategy\\_%' escape '\\'`))
for (const t of tables) {
  const own = policies.filter(p => p.tablename === t.table)
  check(`${t.table}: has a policy`, own.length > 0, 'RLS on but no policy')
  for (const p of own) {
    const open = /^\s*true\s*$/i.test(p.qual ?? '') && p.cmd !== 'INSERT'
    check(`${t.table}.${p.policyname}: not an open "using (true)"`, !open, `qual=${p.qual}`)
    const expr = `${p.qual ?? ''} ${p.with_check ?? ''}`.toLowerCase()
    if (t.has_ws) check(`${t.table}.${p.policyname}: scoped by workspace/user`, /workspace|strategy_can_write|auth\.uid/.test(expr), `qual=${p.qual}`)
  }
}

// ── 2. anon reads nothing ────────────────────────────────────────────────────
{
  const res = await sweep('anon', all, 'select count(*)::int from public.%I')
  for (const t of all) check(`${t}: anon reads 0 rows`, blocked(res[t]), res[t])
}

// ── 3. Wrong workspace: Brand-only users read 0 Agency rows ─────────────────
// (Liam Chen / member and the owner belong to BOTH workspaces, verified against
// workspace_members, so they are covered by the multi-workspace checks below.)
for (const who of ['viewer', 'admin']) {
  const res = await sweep(who, scoped, `select count(*)::int from public.%I where workspace_id = '${AGENCY}'`)
  for (const t of scoped) check(`${t}: Brand ${who} sees 0 Agency rows`, blocked(res[t]), res[t])
}

// ── 4. Wrong role: view-only users cannot delete in their own workspace ──────
for (const who of ['member', 'viewer']) {
  const res = await sweep(who, scoped, `with x as (delete from public.%I where workspace_id = '${BRAND}' returning 1) select count(*)::int from x`)
  for (const t of scoped) check(`${t}: ${who} delete in Brand affects 0 rows`, blocked(res[t]), res[t])
}

// ── 5. Wrong workspace: Brand admin cannot delete Agency rows ────────────────
{
  const res = await sweep('admin', scoped, `with x as (delete from public.%I where workspace_id = '${AGENCY}' returning 1) select count(*)::int from x`)
  for (const t of scoped) check(`${t}: Brand admin delete in Agency affects 0 rows`, blocked(res[t]), res[t])
}

// ── 6. Wrong workspace + wrong role: UPDATE reaches nothing ──────────────────
for (const who of ['member', 'viewer']) {
  const res = await sweep(who, scoped.filter(t => t !== 'strategy_activity'),
    `with x as (update public.%I set workspace_id = workspace_id where workspace_id = '${BRAND}' returning 1) select count(*)::int from x`)
  for (const t of Object.keys(res)) check(`${t}: ${who} update in Brand affects 0 rows`, blocked(res[t]), res[t])
}

// ── 7. Positive: an owner can read their own workspace's core tables ─────────
{
  const res = await sweep('owner', CORE, `select count(*)::int from public.%I where workspace_id = '${BRAND}'`)
  for (const t of CORE) check(`${t}: owner can read own Brand rows (positive)`, typeof res[t] === 'number' && res[t] > 0, res[t])
  const viewerRes = await sweep('viewer', CORE, `select count(*)::int from public.%I where workspace_id = '${BRAND}'`)
  for (const t of CORE) check(`${t}: viewer can read own Brand rows (positive)`, typeof viewerRes[t] === 'number' && viewerRes[t] > 0, viewerRes[t])
}

// ── 7b. Multi-workspace member: reads Agency (positive) but is still view-only ─
{
  const read = await sweep('member', CORE, `select count(*)::int from public.%I where workspace_id = '${AGENCY}'`)
  for (const t of CORE) check(`${t}: multi-workspace member can read Agency rows they belong to (positive)`, typeof read[t] === 'number' && read[t] > 0, read[t])
  const del = await sweep('member', scoped, `with x as (delete from public.%I where workspace_id = '${AGENCY}' returning 1) select count(*)::int from x`)
  for (const t of scoped) check(`${t}: member delete in Agency affects 0 rows (view-only there too)`, blocked(del[t]), del[t])
}

// ── 8. Release-specific: framework market ────────────────────────────────────
const asUser = (user, statement) => sql(`begin;
set local role authenticated;
select set_config('request.jwt.claims', '${JSON.stringify({ sub: user, role: 'authenticated' })}', true);
${statement};
rollback;`)
{
  const bad = await asUser(USERS.owner, `update public.strategy_positioning_frameworks set market = 'mars' where workspace_id = '${BRAND}'`)
  check('framework market rejects unknown values (check constraint)', !bad.ok && /check constraint|strategy_frameworks_market_check/i.test(bad.body), bad.body)
  const good = await asUser(USERS.owner, `update public.strategy_positioning_frameworks set market = 'uk' where workspace_id = '${BRAND}' and id = (select id from public.strategy_positioning_frameworks where workspace_id = '${BRAND}' limit 1)`)
  check('framework market accepts a valid value', good.ok, good.body)
  const member = await asUser(USERS.member, `with x as (update public.strategy_positioning_frameworks set market = 'global' where workspace_id = '${BRAND}' returning 1) select count(*)::int as count from x`)
  const n = Number(rows(member).at(-1)?.count ?? -1)
  check('member cannot change a framework market (0 rows)', member.ok ? n === 0 : /row-level security|42501/i.test(member.body), member.body)
}

// ── 9. Privileged helper is not callable by anon ─────────────────────────────
{
  const fn = await sql(`begin; set local role anon; select public.strategy_can_write('${BRAND}'::uuid); rollback;`)
  check('strategy_can_write() is not executable by anon', !fn.ok && /permission denied/i.test(fn.body), fn.body)
}

console.log(`Checks: ${pass + fail}   passed: ${pass}   failed: ${fail}`)
if (failures.length) { console.log('\nFAILURES:'); for (const f of failures) console.log(' - ' + f) }
process.exit(fail ? 1 : 0)
