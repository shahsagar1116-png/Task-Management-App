// Checks the Row Level Security rules in supabase/migrations against an in-memory
// Postgres (PGlite). Run with: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
const db = new PGlite();
const q = (s, p) => db.query(s, p);
await db.exec(`
-- Minimal stand-in for what Supabase provides.
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon;
`);
// Run every migration in order.
const dir = new URL("../migrations/", import.meta.url);
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(fs.readFileSync(new URL(f, dir), "utf8"));
}
await db.exec(`
grant select, insert, update, delete on all tables in schema public to authenticated;
insert into auth.users values
 ('11111111-1111-1111-1111-111111111111','p@x.com'),
 ('22222222-2222-2222-2222-222222222222','m@x.com'),
 ('33333333-3333-3333-3333-333333333333','s@x.com'),
 ('44444444-4444-4444-4444-444444444444','s2@x.com'),
 ('99999999-9999-9999-9999-999999999999','other@y.com');
`);
console.log((await q(`select public.bootstrap_partner('P@x.com','Partner','Firm A') r`)).rows[0].r);
await q(`select public.bootstrap_partner('other@y.com','Other','Firm B')`);
const firmA = (await q(`select id from firms where name='Firm A'`)).rows[0].id;
await db.exec(`insert into users (id, firm_id, name, email, role) values
 ('22222222-2222-2222-2222-222222222222','${firmA}','Mgr','m@x.com','manager'),
 ('33333333-3333-3333-3333-333333333333','${firmA}','Staff','s@x.com','staff'),
 ('44444444-4444-4444-4444-444444444444','${firmA}','Staff2','s2@x.com','staff');`);

const P='11111111-1111-1111-1111-111111111111', M='22222222-2222-2222-2222-222222222222', S='33333333-3333-3333-3333-333333333333', S2='44444444-4444-4444-4444-444444444444', O='99999999-9999-9999-9999-999999999999';
let pass = 0, fail = 0;
async function as(uid, sql) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid}',false); set role authenticated;`);
  try { return { rows: (await q(sql)).rows }; } catch (e) { return { error: e.message }; }
  finally { await db.exec(`reset role;`); }
}
function check(name, cond, detail) { if (cond) pass++; else { fail++; console.log("FAIL", name, JSON.stringify(detail)); } }

let r;
r = await as(S, `select count(*)::int n from users`); check("staff sees firm users only", r.rows?.[0].n === 4, r);
r = await as(O, `select count(*)::int n from users`); check("other firm isolated", r.rows?.[0].n === 1, r);
r = await as(S, `insert into users (id, firm_id, name, email, role) values ('${O}','${firmA}','x','x','partner')`); check("staff cannot add user", !!r.error, r);
r = await as(S, `update users set role='partner' where id='${S}' returning id`); check("staff cannot change own role", r.rows?.length === 0, r);
r = await as(M, `update users set role='partner' where id='${S}' returning id`); check("manager cannot change roles", r.rows?.length === 0, r);
r = await as(P, `update users set role='manager' where id='${S2}' returning id`); check("partner can change role", r.rows?.length === 1, r);
await as(P, `update users set role='staff' where id='${S2}'`);
r = await as(S, `insert into clients (name) values ('C1') returning id`); check("staff cannot add client", !!r.error, r);
r = await as(M, `insert into clients (name) values ('C1') returning id, firm_id`); check("manager adds client, firm filled", r.rows?.[0]?.firm_id === firmA, r);
const C = r.rows[0].id;
r = await as(M, `update clients set is_deleted=true where id='${C}'`); check("manager cannot soft delete", !!r.error, r);
r = await as(P, `delete from clients where id='${C}' returning id`); check("no hard delete", r.rows?.length === 0 || !!r.error, r);
r = await as(O, `select * from clients`); check("other firm cannot see client", r.rows?.length === 0, r);
r = await as(M, `insert into tasks (client_id, title, assigned_to) values ('${C}','T for S','${S}') returning id`); const T1 = r.rows[0].id;
r = await as(M, `insert into tasks (client_id, title, assigned_to) values ('${C}','T for S2','${S2}') returning id`); const T2 = r.rows[0].id;
r = await as(S, `select title from tasks`); check("staff sees own tasks only", r.rows?.length === 1 && r.rows[0].title === "T for S", r);
r = await as(S, `insert into tasks (title, assigned_to) values ('mine','${S}') returning id`); check("staff creates own task", r.rows?.length === 1, r);
r = await as(S, `insert into tasks (title, assigned_to) values ('theirs','${S2}') returning id`); check("staff cannot create for others", !!r.error, r);
r = await as(S, `update tasks set status='ready_for_review' where id='${T1}' returning status`); check("staff moves to review", r.rows?.[0]?.status === "ready_for_review", r);
r = await as(S, `update tasks set status='filed' where id='${T1}'`); check("staff cannot file", !!r.error, r);
r = await as(S, `update tasks set assigned_to='${S2}' where id='${T1}'`); check("staff cannot reassign", !!r.error, r);
r = await as(S, `update tasks set status='in_progress' where id='${T2}' returning id`); check("staff cannot touch others' task", r.rows?.length === 0, r);
r = await as(M, `update tasks set status='filed', due_date='2026-12-20' where id='${T1}' returning id`); check("manager files", r.rows?.length === 1, r);
r = await as(S, `select action, old_value, new_value, user_id from task_activity where task_id='${T1}' order by at, action`);
check("activity logged & visible to assignee", r.rows?.length === 4, r);
r = await as(S, `select * from task_activity where task_id='${T2}'`); check("staff cannot see others' activity", r.rows?.length === 0, r);
r = await as(S, `insert into task_activity (task_id, user_id, action, comment) values ('${T1}','${S}','comment','hi') returning id`); check("staff comments own task", r.rows?.length === 1, r);
r = await as(S, `insert into task_activity (task_id, user_id, action, new_value) values ('${T1}','${S}','status_change','filed')`); check("staff cannot forge activity", !!r.error, r);
r = await as(S, `select public.bootstrap_partner('s@x.com','x','Firm A')`); check("staff cannot run bootstrap", !!r.error, r);
r = await as(M, `insert into compliance_types (code,name,category,frequency) values ('GSTR3B','GSTR-3B','GST','monthly') returning id`); const CT = r.rows?.[0]?.id; check("manager adds compliance type", !!CT, r);
r = await as(M, `insert into tasks (client_id, compliance_type_id, period_label, title) values ('${C}','${CT}','Nov-2026','a'),('${C}','${CT}','Nov-2026','b')`); check("unique task per period", !!r.error && /unique|duplicate/.test(r.error), r);
r = await as(S, `insert into follow_ups (task_id, client_id, channel, sent_by) values ('${T1}','${C}','whatsapp','${S}') returning id`); check("staff logs follow-up on own task", r.rows?.length === 1, r);
r = await as(S, `insert into follow_ups (task_id, client_id, channel, sent_by) values ('${T2}','${C}','whatsapp','${S}')`); check("staff cannot log on others' task", !!r.error, r);
// deactivated staff loses everything
await db.exec(`update users set active=false where id='${S2}'`);
r = await as(S2, `select count(*)::int n from users`); check("inactive user sees nothing", r.rows?.[0].n === 0, r);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
