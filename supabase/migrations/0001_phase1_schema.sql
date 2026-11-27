-- =====================================================================
-- Task Management App · Phase 1 schema
-- Tables, roles and Row Level Security (RLS) for all ten tables in the
-- spec (Section 4). Run this once in Supabase: SQL Editor > New query.
--
-- Rules followed (spec Section 3):
--   * every table carries firm_id, and RLS filters by it (multi-firm later)
--   * permissions are enforced here in the database, not only on screen
--   * no hard deletes: there are no DELETE policies; use is_deleted
--   * task status / assignee / due-date changes are written to task_activity
-- =====================================================================

-- ---------- Shared helpers ------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- firms ---------------------------------------------------------
-- The firm's own id is its firm_id, so this table has no separate firm_id.

create table public.firms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  email       text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  is_deleted  boolean not null default false
);

-- ---------- users ---------------------------------------------------------
-- One row per login. id is the same as the Supabase Auth user id.

create table public.users (
  id          uuid primary key references auth.users (id) on delete restrict,
  firm_id     uuid not null references public.firms (id),
  name        text not null,
  email       text not null,
  mobile      text,
  role        text not null check (role in ('partner', 'manager', 'staff')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  is_deleted  boolean not null default false
);
create unique index users_firm_email_uniq on public.users (firm_id, lower(email));
create index users_firm_idx on public.users (firm_id);

-- ---------- Who is signed in? (used by every policy) ----------------------
-- SECURITY DEFINER so policies on public.users do not recurse.

create or replace function public.auth_firm_id()
returns uuid language sql stable security definer set search_path = public as $$
  select firm_id from public.users
  where id = auth.uid() and active and not is_deleted
$$;

create or replace function public.auth_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.users
  where id = auth.uid() and active and not is_deleted
$$;

create or replace function public.is_partner()
returns boolean language sql stable as $$
  select coalesce(public.auth_role() = 'partner', false)
$$;

create or replace function public.is_partner_or_manager()
returns boolean language sql stable as $$
  select coalesce(public.auth_role() in ('partner', 'manager'), false)
$$;

-- Fill firm_id from the signed-in user when the app leaves it blank.
create or replace function public.set_firm_id()
returns trigger language plpgsql as $$
begin
  if new.firm_id is null then
    new.firm_id := public.auth_firm_id();
  end if;
  return new;
end $$;

-- Only a partner may set or clear is_deleted (soft delete and restore).
create or replace function public.guard_soft_delete()
returns trigger language plpgsql as $$
begin
  if new.is_deleted is distinct from old.is_deleted
     and auth.uid() is not null and not public.is_partner() then
    raise exception 'Only a partner can delete or restore records';
  end if;
  return new;
end $$;

-- ---------- clients -------------------------------------------------------

create table public.clients (
  id                uuid primary key default gen_random_uuid(),
  firm_id           uuid not null references public.firms (id),
  name              text not null,
  client_code       text,
  type              text check (type in ('individual', 'huf', 'firm', 'llp', 'company', 'trust')),
  pan               text,
  gstins            text[] not null default '{}',
  tan               text,
  cin_llpin         text,
  contact_person    text,
  mobile            text,
  whatsapp_number   text,
  email             text,
  group_name        text,
  default_staff_id  uuid references public.users (id),
  remarks           text,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  is_deleted        boolean not null default false
);
create unique index clients_firm_code_uniq on public.clients (firm_id, client_code)
  where client_code is not null and not is_deleted;
create index clients_firm_idx on public.clients (firm_id);

-- ---------- compliance_types ----------------------------------------------

create table public.compliance_types (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references public.firms (id),
  code               text not null,
  name               text not null,
  category           text not null check (category in ('GST', 'TDS', 'Income Tax', 'ROC', 'Audit', 'Payroll', 'Other')),
  frequency          text not null check (frequency in ('monthly', 'quarterly', 'half-yearly', 'annual', 'one-time')),
  default_due_rule   text,
  default_checklist  text[] not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  is_deleted         boolean not null default false
);
create unique index compliance_types_firm_code_uniq on public.compliance_types (firm_id, code)
  where not is_deleted;

-- ---------- client_compliances --------------------------------------------

create table public.client_compliances (
  id                  uuid primary key default gen_random_uuid(),
  firm_id             uuid not null references public.firms (id),
  client_id           uuid not null references public.clients (id),
  compliance_type_id  uuid not null references public.compliance_types (id),
  assigned_to         uuid references public.users (id),
  start_period        text,
  end_period          text,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  is_deleted          boolean not null default false
);
create unique index client_compliances_uniq on public.client_compliances (client_id, compliance_type_id)
  where not is_deleted;

-- ---------- due_dates -----------------------------------------------------

create table public.due_dates (
  id                  uuid primary key default gen_random_uuid(),
  firm_id             uuid not null references public.firms (id),
  compliance_type_id  uuid not null references public.compliance_types (id),
  period_label        text not null,
  period_start        date,
  period_end          date,
  due_date            date not null,
  extended_due_date   date,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  is_deleted          boolean not null default false
);
create unique index due_dates_uniq on public.due_dates (firm_id, compliance_type_id, period_label)
  where not is_deleted;

-- ---------- tasks ---------------------------------------------------------

create table public.tasks (
  id                  uuid primary key default gen_random_uuid(),
  firm_id             uuid not null references public.firms (id),
  client_id           uuid references public.clients (id),
  compliance_type_id  uuid references public.compliance_types (id),
  period_label        text,
  title               text not null,
  assigned_to         uuid references public.users (id),
  reviewer_id         uuid references public.users (id),
  status              text not null default 'not_started' check (status in
                        ('not_started', 'waiting_on_client', 'in_progress',
                         'ready_for_review', 'filed', 'not_applicable')),
  priority            text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  due_date            date,
  completed_on        date,
  acknowledgement_no  text,
  remarks             text,
  source              text not null default 'manual' check (source in ('recurring', 'manual')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  is_deleted          boolean not null default false
);
-- One task per client + compliance type + period. The recurring engine relies on this.
create unique index tasks_client_compliance_period_uniq
  on public.tasks (firm_id, client_id, compliance_type_id, period_label)
  where compliance_type_id is not null and not is_deleted;
create index tasks_firm_status_idx on public.tasks (firm_id, status);
create index tasks_assigned_idx on public.tasks (assigned_to);
create index tasks_due_idx on public.tasks (due_date);

-- ---------- task_documents ------------------------------------------------

create table public.task_documents (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references public.firms (id),
  task_id        uuid not null references public.tasks (id),
  document_name  text not null,
  received       boolean not null default false,
  received_on    date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  is_deleted     boolean not null default false
);
create index task_documents_task_idx on public.task_documents (task_id);

-- ---------- follow_ups ----------------------------------------------------

create table public.follow_ups (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references public.firms (id),
  task_id            uuid references public.tasks (id),
  client_id          uuid not null references public.clients (id),
  channel            text not null check (channel in ('whatsapp', 'email', 'call')),
  message            text,
  sent_by            uuid references public.users (id),
  sent_on            timestamptz not null default now(),
  client_response    text,
  next_follow_up_on  date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  is_deleted         boolean not null default false
);
create index follow_ups_task_idx on public.follow_ups (task_id);
create index follow_ups_client_idx on public.follow_ups (client_id);

-- ---------- task_activity (audit log) -------------------------------------

create table public.task_activity (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.firms (id),
  task_id     uuid not null references public.tasks (id),
  user_id     uuid references public.users (id),
  action      text not null check (action in
                ('created', 'status_change', 'comment', 'reassigned', 'due_date_change', 'deleted', 'restored')),
  old_value   text,
  new_value   text,
  comment     text,
  at          timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  is_deleted  boolean not null default false
);
create index task_activity_task_idx on public.task_activity (task_id, at);

-- ---------- Triggers: updated_at, firm_id, soft delete ---------------------

do $$
declare t text;
begin
  foreach t in array array['firms','users','clients','compliance_types','client_compliances',
                           'due_dates','tasks','task_documents','follow_ups','task_activity']
  loop
    execute format('create trigger %I_touch before update on public.%I
                    for each row execute function public.touch_updated_at()', t, t);
  end loop;

  foreach t in array array['clients','compliance_types','client_compliances','due_dates',
                           'tasks','task_documents','follow_ups','task_activity']
  loop
    execute format('create trigger %I_firm before insert on public.%I
                    for each row execute function public.set_firm_id()', t, t);
  end loop;

  foreach t in array array['clients','compliance_types','client_compliances','due_dates',
                           'tasks','task_documents','follow_ups']
  loop
    execute format('create trigger %I_soft_delete before update on public.%I
                    for each row execute function public.guard_soft_delete()', t, t);
  end loop;
end $$;

-- ---------- Task rules enforced in the database ----------------------------
-- Staff may only work on their own tasks, cannot reassign them, and cannot
-- mark a task "Filed / Completed" or "Not applicable" (spec Sections 2 and 7).
-- The full status-transition rules arrive in Phase 4.

create or replace function public.guard_task_changes()
returns trigger language plpgsql as $$
begin
  if auth.uid() is null or public.is_partner_or_manager() then
    return new;
  end if;
  if new.status in ('filed', 'not_applicable')
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    raise exception 'Only a partner or manager can mark a task %', new.status;
  end if;
  if tg_op = 'UPDATE' and new.assigned_to is distinct from old.assigned_to then
    raise exception 'Only a partner or manager can reassign a task';
  end if;
  return new;
end $$;

create trigger tasks_guard before insert or update on public.tasks
  for each row execute function public.guard_task_changes();

-- Write every create, status change, reassignment, due-date change and
-- delete/restore to task_activity (who, when, from, to).
create or replace function public.log_task_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into task_activity (firm_id, task_id, user_id, action, new_value)
    values (new.firm_id, new.id, auth.uid(), 'created', new.status);
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into task_activity (firm_id, task_id, user_id, action, old_value, new_value)
    values (new.firm_id, new.id, auth.uid(), 'status_change', old.status, new.status);
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into task_activity (firm_id, task_id, user_id, action, old_value, new_value)
    values (new.firm_id, new.id, auth.uid(), 'reassigned', old.assigned_to::text, new.assigned_to::text);
  end if;
  if new.due_date is distinct from old.due_date then
    insert into task_activity (firm_id, task_id, user_id, action, old_value, new_value)
    values (new.firm_id, new.id, auth.uid(), 'due_date_change', old.due_date::text, new.due_date::text);
  end if;
  if new.is_deleted is distinct from old.is_deleted then
    insert into task_activity (firm_id, task_id, user_id, action)
    values (new.firm_id, new.id, auth.uid(), case when new.is_deleted then 'deleted' else 'restored' end);
  end if;
  return new;
end $$;

create trigger tasks_activity after insert or update on public.tasks
  for each row execute function public.log_task_activity();

-- ---------- Row Level Security --------------------------------------------
-- No DELETE policy anywhere: hard deletes are blocked for app users.

alter table public.firms              enable row level security;
alter table public.users              enable row level security;
alter table public.clients            enable row level security;
alter table public.compliance_types   enable row level security;
alter table public.client_compliances enable row level security;
alter table public.due_dates          enable row level security;
alter table public.tasks              enable row level security;
alter table public.task_documents     enable row level security;
alter table public.follow_ups         enable row level security;
alter table public.task_activity      enable row level security;

-- Can the signed-in user see this task? Partners and managers: any task in
-- the firm. Staff: only tasks assigned to them.
create or replace function public.can_see_task(p_task_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tasks t
    where t.id = p_task_id
      and t.firm_id = auth_firm_id()
      and (is_partner_or_manager() or t.assigned_to = auth.uid())
  )
$$;

-- firms
create policy firms_select on public.firms for select to authenticated
  using (id = public.auth_firm_id());
create policy firms_update on public.firms for update to authenticated
  using (id = public.auth_firm_id() and public.is_partner())
  with check (id = public.auth_firm_id());

-- users: everyone in the firm can see the team list; only partners change it.
-- (New logins are created by the app's server with the secret key.)
create policy users_select on public.users for select to authenticated
  using (firm_id = public.auth_firm_id());
create policy users_insert on public.users for insert to authenticated
  with check (firm_id = public.auth_firm_id() and public.is_partner());
create policy users_update on public.users for update to authenticated
  using (firm_id = public.auth_firm_id() and public.is_partner())
  with check (firm_id = public.auth_firm_id());

-- clients, compliance_types, client_compliances, due_dates:
-- everyone in the firm reads; partners and managers write.
do $$
declare t text;
begin
  foreach t in array array['clients','compliance_types','client_compliances','due_dates']
  loop
    execute format($f$
      create policy %1$s_select on public.%1$I for select to authenticated
        using (firm_id = public.auth_firm_id());
      create policy %1$s_insert on public.%1$I for insert to authenticated
        with check (firm_id = public.auth_firm_id() and public.is_partner_or_manager());
      create policy %1$s_update on public.%1$I for update to authenticated
        using (firm_id = public.auth_firm_id() and public.is_partner_or_manager())
        with check (firm_id = public.auth_firm_id());
    $f$, t);
  end loop;
end $$;

-- tasks
create policy tasks_select on public.tasks for select to authenticated
  using (firm_id = public.auth_firm_id()
         and (public.is_partner_or_manager() or assigned_to = auth.uid()));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (firm_id = public.auth_firm_id()
              and (public.is_partner_or_manager() or assigned_to = auth.uid()));
create policy tasks_update on public.tasks for update to authenticated
  using (firm_id = public.auth_firm_id()
         and (public.is_partner_or_manager() or assigned_to = auth.uid()))
  with check (firm_id = public.auth_firm_id()
              and (public.is_partner_or_manager() or assigned_to = auth.uid()));

-- task_documents: follow the task's visibility
create policy task_documents_select on public.task_documents for select to authenticated
  using (firm_id = public.auth_firm_id() and public.can_see_task(task_id));
create policy task_documents_insert on public.task_documents for insert to authenticated
  with check (firm_id = public.auth_firm_id() and public.can_see_task(task_id));
create policy task_documents_update on public.task_documents for update to authenticated
  using (firm_id = public.auth_firm_id() and public.can_see_task(task_id))
  with check (firm_id = public.auth_firm_id() and public.can_see_task(task_id));

-- follow_ups: partners/managers see all; staff see and log their own tasks' follow-ups
create policy follow_ups_select on public.follow_ups for select to authenticated
  using (firm_id = public.auth_firm_id()
         and (public.is_partner_or_manager() or (task_id is not null and public.can_see_task(task_id))));
create policy follow_ups_insert on public.follow_ups for insert to authenticated
  with check (firm_id = public.auth_firm_id()
              and sent_by = auth.uid()
              and (public.is_partner_or_manager() or (task_id is not null and public.can_see_task(task_id))));
create policy follow_ups_update on public.follow_ups for update to authenticated
  using (firm_id = public.auth_firm_id()
         and (public.is_partner_or_manager() or sent_by = auth.uid()))
  with check (firm_id = public.auth_firm_id());

-- task_activity: read with the task; users may add their own comments only.
-- Other rows are written by the log_task_activity trigger. No updates.
create policy task_activity_select on public.task_activity for select to authenticated
  using (firm_id = public.auth_firm_id() and public.can_see_task(task_id));
create policy task_activity_insert on public.task_activity for insert to authenticated
  with check (firm_id = public.auth_firm_id()
              and action = 'comment'
              and user_id = auth.uid()
              and public.can_see_task(task_id));

-- ---------- First partner (run once by the owner) -------------------------
-- Usage, in the SQL Editor, after creating the login under Authentication:
--   select public.bootstrap_partner('you@example.com', 'Your Name', 'Sagar B Shah & Associates');

create or replace function public.bootstrap_partner(p_email text, p_name text, p_firm_name text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_auth_id uuid;
  v_firm_id uuid;
begin
  select id into v_auth_id from auth.users where lower(email) = lower(p_email);
  if v_auth_id is null then
    raise exception 'No login found for %. Create it first under Authentication > Users > Add user.', p_email;
  end if;

  select id into v_firm_id from firms where name = p_firm_name and not is_deleted;
  if v_firm_id is null then
    insert into firms (name, email) values (p_firm_name, p_email) returning id into v_firm_id;
  end if;

  insert into users (id, firm_id, name, email, role)
  values (v_auth_id, v_firm_id, p_name, lower(p_email), 'partner')
  on conflict (id) do update set role = 'partner', active = true, is_deleted = false;

  return format('%s is now partner of %s', p_email, p_firm_name);
end $$;

-- Only the database owner (SQL Editor) may run bootstrap_partner; app users may not.
revoke execute on function public.bootstrap_partner(text, text, text) from public, anon, authenticated;
