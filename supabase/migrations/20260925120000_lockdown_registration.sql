-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Lock down registration & payment.
--
-- Before: the anon key could SELECT/UPDATE/DELETE `teams` (and possibly
-- `members`) directly, and the team cap / registration window were enforced
-- only in the browser.
--
-- After: anon has NO direct table access. The frontend goes through four
-- SECURITY DEFINER functions that enforce every rule server-side:
--   get_registration_count()            â†’ int
--   register_team(team_name, members)   â†’ registration_id
--   get_team_summary(registration_id)   â†’ team_name, payment_status
--   submit_payment(registration_id, screenshot_path, utr)
--
-- Keep these in sync with src/lib/registrationStatus.ts
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- â”€â”€ 0. Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create or replace function public._reg_config()
returns table (max_teams int, opens_at timestamptz, closes_at timestamptz)
language sql immutable as $$
  select 15,
         timestamptz '2026-09-25 12:00:00+05:30',
         timestamptz '2026-09-26 12:00:00+05:30'
$$;

-- â”€â”€ 1. Columns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table public.teams add column if not exists payment_status         text not null default 'pending';
alter table public.teams add column if not exists payment_txn_id         text;
alter table public.teams add column if not exists payment_screenshot_url text;  -- now stores a private storage PATH
alter table public.teams add column if not exists payment_submitted_at   timestamptz;

-- â”€â”€ 2. Drop every existing policy on teams / members, then enable RLS â”€â”€â”€â”€â”€â”€
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('teams', 'members')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table public.teams   enable row level security;
alter table public.members enable row level security;
-- No policies = no direct anon/authenticated access. Service role & the
-- dashboard still see everything.
revoke all on public.teams, public.members from anon, authenticated;

-- â”€â”€ 3. RPCs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create or replace function public.get_registration_count()
returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from teams
$$;

create or replace function public.register_team(p_team_name text, p_members jsonb)
returns text
language plpgsql security definer set search_path = public as $$
declare
  cfg      record;
  v_team   uuid;
  v_reg_id text;
  v_count  int;
  m        jsonb;
  i        int := 0;
begin
  select * into cfg from _reg_config();

  if now() < cfg.opens_at  then raise exception 'REGISTRATION_NOT_OPEN'; end if;
  if now() >= cfg.closes_at then raise exception 'REGISTRATION_CLOSED';  end if;

  p_team_name := btrim(p_team_name);
  if p_team_name !~ '^[a-zA-Z0-9 _!-]{3,40}$' then raise exception 'INVALID_TEAM_NAME'; end if;

  if jsonb_typeof(p_members) <> 'array'
     or jsonb_array_length(p_members) not between 2 and 4 then
    raise exception 'INVALID_MEMBER_COUNT';
  end if;

  -- Serialize registrations so two concurrent inserts can't both squeeze
  -- past the cap.
  lock table teams in share row exclusive mode;

  select count(*) into v_count from teams;
  if v_count >= cfg.max_teams then raise exception 'REGISTRATION_FULL'; end if;

  if exists (select 1 from teams where lower(team_name) = lower(p_team_name)) then
    raise exception 'TEAM_NAME_TAKEN';
  end if;

  -- 10 chars from a v4 UUID (cryptographically random)
  v_reg_id := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into teams (registration_id, team_name)
  values (v_reg_id, p_team_name)
  returning id into v_team;

  for m in select * from jsonb_array_elements(p_members) loop
    if coalesce(length(btrim(m->>'name')), 0)    < 2
       or (m->>'email') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
       or (m->>'phone') !~  '^[6-9][0-9]{9}$'
       or coalesce(length(btrim(m->>'college')), 0) < 2 then
      raise exception 'INVALID_MEMBER';
    end if;

    insert into members (team_id, name, email, phone, college, is_leader)
    values (v_team, btrim(m->>'name'), lower(btrim(m->>'email')), m->>'phone',
            btrim(m->>'college'), i = 0);
    i := i + 1;
  end loop;

  return v_reg_id;
exception
  when unique_violation then
    -- whole function rolls back atomically; no orphaned team row
    raise exception 'MEMBER_ALREADY_REGISTERED';
end $$;

create or replace function public.get_team_summary(p_registration_id text)
returns table (team_name text, payment_status text)
language sql stable security definer set search_path = public as $$
  select t.team_name, t.payment_status from teams t
  where t.registration_id = upper(btrim(p_registration_id))
$$;

create or replace function public.submit_payment(
  p_registration_id text, p_screenshot_path text, p_utr text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_utr !~ '^[0-9A-Za-z]{10,22}$' then raise exception 'INVALID_UTR'; end if;
  if p_screenshot_path !~ '^[A-Z0-9]{6,10}/[0-9a-f-]{36}\.(png|jpe?g|webp|heic|pdf)$' then
    raise exception 'INVALID_SCREENSHOT_PATH';
  end if;

  update teams
     set payment_status         = 'ticket_uploaded',
         payment_screenshot_url = p_screenshot_path,
         payment_txn_id         = upper(p_utr),
         payment_submitted_at   = now()
   where registration_id = upper(btrim(p_registration_id))
     and payment_status in ('pending', 'ticket_uploaded')   -- can't overwrite a verified team
     and split_part(p_screenshot_path, '/', 1) = upper(btrim(p_registration_id));

  if not found then raise exception 'PAYMENT_NOT_ALLOWED'; end if;
end $$;

revoke all on function public.register_team(text, jsonb)          from public;
revoke all on function public.get_team_summary(text)              from public;
revoke all on function public.submit_payment(text, text, text)    from public;
revoke all on function public.get_registration_count()            from public;
revoke all on function public._reg_config()                       from public;
grant execute on function public.register_team(text, jsonb)       to anon, authenticated;
grant execute on function public.get_team_summary(text)           to anon, authenticated;
grant execute on function public.submit_payment(text, text, text) to anon, authenticated;
grant execute on function public.get_registration_count()         to anon, authenticated;

-- â”€â”€ 4. Storage: private bucket, insert-only, no overwrite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
insert into storage.buckets (id, name, public)
values ('tickets', 'tickets', false)
on conflict (id) do update set public = false;

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') ilike '%tickets%' or coalesce(with_check, '') ilike '%tickets%')
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

-- Anyone may upload a new file into tickets/<REGID>/<uuid>.<ext>.
-- No SELECT / UPDATE / DELETE for anon â†’ can't read, list or replace others' proofs.
create policy "tickets_insert_only" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'tickets'
    and name ~ '^[A-Z0-9]{6,10}/[0-9a-f-]{36}\.(png|jpe?g|webp|heic|pdf)$'
  );
