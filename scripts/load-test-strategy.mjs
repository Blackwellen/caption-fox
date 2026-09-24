// Load test for the Strategy section at 10k+ rows per table.
//
// Everything runs in ONE transaction that is always rolled back, so no data is
// left behind and production tables are never touched permanently:
//   1. Seeds ROWS extra rows into each core table for the Brand workspace
//      (and 5x that many plan items / activity rows), then ANALYZEs.
//   2. Switches to the `authenticated` role with the owner's JWT claims, so the
//      real RLS policies run on every query.
//   3. Times the exact query shapes src/lib/strategy/data.ts issues: first
//      page, deep page, filtered page, search, exact count and KPI aggregates.
//      Each is run 3 times; the best (warm) time is reported.
//
//   node scripts/load-test-strategy.mjs [rows=12000]
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)
  .filter(line => line && !line.trimStart().startsWith('#') && line.includes('='))
  .map(line => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim()] }))
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]

const ROWS = Number(process.argv[2] ?? 12000)
const BRAND = 'd7b7c61e-7685-4b15-8a0c-d9fa85f25103'
const OWNER = 'e58b5076-245e-41b4-a101-7daf7e5e87ab'

// Budgets are database time per query as the signed-in user, in milliseconds.
const BUDGET = { page: 100, deep: 150, filter: 150, search: 400, count: 150, aggregate: 200 }

const seed = `
insert into strategy_objectives (workspace_id, name, description, owner_id, created_by, start_date, due_date, archived_at)
  select '${BRAND}', 'Load objective ' || i, 'Description ' || md5(i::text), '${OWNER}', '${OWNER}',
         date '2026-01-01' + (i % 300), date '2026-01-01' + (i % 300) + 60, case when i % 20 = 0 then now() end
  from generate_series(1, ${ROWS}) i;
insert into strategy_audiences (workspace_id, name, description, owner_id, created_by, archived_at)
  select '${BRAND}', 'Load audience ' || i, 'Description ' || md5(i::text), '${OWNER}', '${OWNER}', case when i % 20 = 0 then now() end
  from generate_series(1, ${ROWS}) i;
insert into strategy_research_items (workspace_id, title, summary, theme, owner_id, created_by, archived_at)
  select '${BRAND}', 'Load research ' || i, 'Summary ' || md5(i::text), 'theme-' || (i % 25), '${OWNER}', '${OWNER}', case when i % 20 = 0 then now() end
  from generate_series(1, ${ROWS}) i;
insert into strategy_positioning_frameworks (workspace_id, name, category_promise, owner_id, created_by, archived_at)
  select '${BRAND}', 'Load framework ' || i, 'Promise ' || md5(i::text), '${OWNER}', '${OWNER}', case when i % 20 = 0 then now() end
  from generate_series(1, ${ROWS}) i;
insert into strategy_plans (workspace_id, name, description, owner_id, created_by, start_date, end_date, archived_at)
  select '${BRAND}', 'Load plan ' || i, 'Description ' || md5(i::text), '${OWNER}', '${OWNER}',
         date '2026-01-01' + (i % 300), date '2026-01-01' + (i % 300) + 60, case when i % 20 = 0 then now() end
  from generate_series(1, ${ROWS}) i;
insert into strategy_forecasts (workspace_id, name, description, owner_id, created_by, period_start, period_end, archived_at)
  select '${BRAND}', 'Load forecast ' || i, 'Description ' || md5(i::text), '${OWNER}', '${OWNER}',
         date '2026-01-01', date '2026-12-31', case when i % 20 = 0 then now() end
  from generate_series(1, ${ROWS}) i;
insert into strategy_plan_items (workspace_id, plan_id, title, owner_id, created_by, start_date, due_date)
  select '${BRAND}', p.id, 'Load item ' || g, '${OWNER}', '${OWNER}', date '2026-01-01' + (g % 300), date '2026-01-01' + (g % 300) + 30
  from (select id, row_number() over () rn from strategy_plans where workspace_id = '${BRAND}' and name like 'Load plan %') p,
       generate_series(1, 5) g;
insert into strategy_activity (workspace_id, entity_type, action, summary, created_at)
  select '${BRAND}', 'objective', 'updated', 'Load activity ' || i, now() - (i || ' seconds')::interval
  from generate_series(1, ${ROWS * 5}) i;
analyze strategy_objectives; analyze strategy_audiences; analyze strategy_research_items; analyze strategy_positioning_frameworks;
analyze strategy_plans; analyze strategy_forecasts; analyze strategy_plan_items; analyze strategy_activity;`

const W = `workspace_id = '${BRAND}'`
const shape = (table, cols, order, extra = '') => ({
  first: `select ${cols} from ${table} where ${W} and archived_at is null${extra} order by ${order}, id limit 25`,
  deep: `select ${cols} from ${table} where ${W} and archived_at is null${extra} order by ${order}, id offset ${Math.floor(ROWS * 0.8)} limit 25`,
  count: `select count(*) from ${table} where ${W} and archived_at is null${extra}`,
})
const specs = []
const add = (table, kind, label, sql) => specs.push({ table, kind, label, sql })
for (const [table, cols, order, nameCols] of [
  ['strategy_objectives', 'id,name,status,priority,due_date,owner_id', 'due_date asc nulls last', ['name', 'description']],
  ['strategy_audiences', 'id,name,status,owner_id', 'updated_at desc', ['name', 'description']],
  ['strategy_research_items', 'id,title,status,theme,owner_id', 'updated_at desc', ['title', 'summary', 'theme']],
  ['strategy_positioning_frameworks', 'id,name,status,owner_id', 'updated_at desc', ['name', 'category_promise']],
  ['strategy_plans', 'id,name,status,start_date,end_date,owner_id', 'start_date asc nulls last', ['name', 'description']],
  ['strategy_forecasts', 'id,name,status,owner_id', 'updated_at desc', ['name', 'description']],
]) {
  const s = shape(table, cols, order)
  add(table, 'page', 'first page (25)', s.first)
  add(table, 'deep', 'page 32000 deep', s.deep)
  add(table, 'count', 'exact count', s.count)
  add(table, 'filter', 'status filter page', shape(table, cols, order, " and status = (select status from " + table + ` where ${W} limit 1)`).first)
  add(table, 'search', 'search %term% (OR across text columns)',
    `select ${cols} from ${table} where ${W} and archived_at is null and (${nameCols.map(c => `${c} ilike '%zz9%'`).join(' or ')}) order by ${order}, id limit 25`)
  add(table, 'aggregate', 'KPI count by status', `select status, count(*) from ${table} where ${W} and archived_at is null group by status`)
}
add('strategy_plan_items', 'page', 'items of one plan', `select id,title,status,start_date,due_date from strategy_plan_items where ${W} and plan_id = (select plan_id from strategy_plan_items where ${W} limit 1) order by start_date, id`)
add('strategy_plan_items', 'page', 'due soonest across workspace (Overview)', `select id,title,due_date from strategy_plan_items where ${W} and due_date >= date '2026-09-01' order by due_date asc limit 8`)
add('strategy_plan_items', 'aggregate', 'KPI count by status', `select status, count(*) from strategy_plan_items where ${W} group by status`)
add('strategy_activity', 'page', 'recent activity (Overview)', `select id,summary,created_at from strategy_activity where ${W} order by created_at desc limit 10`)
add('strategy_activity', 'count', 'exact count', `select count(*) from strategy_activity where ${W}`)

const q = s => s.replace(/\$/g, '')
const timing = `
do $load$
declare t0 timestamptz; best numeric; ms numeric; res jsonb := '[]'::jsonb; i int; n bigint;
begin
${specs.map((s, idx) => `
  best := null;
  for i in 1..3 loop
    t0 := clock_timestamp();
    ${s.kind === 'count' ? `execute $qq$${q(s.sql)}$qq$ into n;` : `select count(*) into n from (${q(s.sql)}) x;`}
    ms := round((extract(epoch from clock_timestamp() - t0) * 1000)::numeric, 1);
    if best is null or ms < best then best := ms; end if;
  end loop;
  res := res || jsonb_build_object('i', ${idx}, 'ms', best, 'rows', n);`).join('')}
  perform set_config('app.load', res::text, true);
end $load$;`

const script = `begin;
set local statement_timeout = '280s';
${seed}
select 'seeded' as step, (select count(*) from strategy_objectives where ${W}) as objectives, (select count(*) from strategy_plan_items where ${W}) as plan_items, (select count(*) from strategy_activity where ${W}) as activity;
set local role authenticated;
select set_config('request.jwt.claims', '${JSON.stringify({ sub: OWNER, role: 'authenticated' })}', true);
${timing}
select current_setting('app.load') as res;
rollback;`

const started = Date.now()
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST', headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: script }),
})
const text = await res.text()
if (!res.ok) { console.error(`Load test failed (${res.status}): ${text.slice(0, 600)}`); process.exit(2) }
const out = JSON.parse(text)
const seeded = out.find(r => r.step === 'seeded')
const timings = JSON.parse(out.at(-1).res)
console.log(`Seeded per core table: ${ROWS} rows (Brand workspace, rolled back). Totals now: objectives ${seeded?.objectives}, plan items ${seeded?.plan_items}, activity ${seeded?.activity}. Wall time ${((Date.now() - started) / 1000).toFixed(0)}s.\n`)

let over = 0
for (const t of timings) {
  const spec = specs[t.i]
  const ok = t.ms <= BUDGET[spec.kind]
  if (!ok) over++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${String(t.ms).padStart(7)} ms  (budget ${BUDGET[spec.kind]})  ${spec.table.replace('strategy_', '')}: ${spec.label}  [${spec.kind === 'count' ? 'counted ' + t.rows : t.rows + ' rows'}]`)
}
console.log(`\n${timings.length - over}/${timings.length} within budget. Nothing was kept (transaction rolled back).`)
process.exit(over ? 1 : 0)
