-- ─────────────────────────────────────────────────────────────────────────────
-- Device records, "My Registration" follow-up, and admin payment alerts.
-- Run AFTER 20260925140000_tickets_and_unique_utr.sql.
--
--  • Registration + payment record the client IP and user-agent (audit only —
--    access is NEVER granted by IP; shared college Wi-Fi would leak data).
--  • A random per-device ID (kept in the browser) links a device to the
--    registrations it made, for the "My Registration" page.
--  • Organisers get realtime updates in /admin and Web Push notifications.
--
-- ONE-TIME SETUP for push (see README section in chat):
--   select vault.create_secret('<random string>', 'notify_webhook_secret');
--   and set the same value as the NOTIFY_WEBHOOK_SECRET Edge Function secret.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Columns ─────────────────────────────────────────────────────────────
alter table public.teams add column if not exists device_id             uuid;
alter table public.teams add column if not exists registered_ip         text;
alter table public.teams add column if not exists registered_user_agent text;
alter table public.teams add column if not exists payment_ip            text;
create index if not exists teams_device_id_idx on public.teams (device_id);

-- Client IP as seen by the Supabase API gateway
create or replace function public._client_ip()
returns text
language sql stable as $$
  select nullif(btrim(coalesce(
    current_setting('request.headers', true)::json ->> 'cf-connecting-ip',
    split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1),
    current_setting('request.headers', true)::json ->> 'x-real-ip'
  )), '')
$$;

create or replace function public._client_user_agent()
returns text
language sql stable as $$
  select left(current_setting('request.headers', true)::json ->> 'user-agent', 400)
$$;

-- ── 2. register_team now records device / IP ───────────────────────────────
drop function if exists public.register_team(text, jsonb);

create or replace function public.register_team(
  p_team_name text, p_members jsonb, p_device_id uuid default null
) returns text
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

  lock table teams in share row exclusive mode;

  select count(*) into v_count from teams;
  if v_count >= cfg.max_teams then raise exception 'REGISTRATION_FULL'; end if;

  if exists (select 1 from teams where lower(team_name) = lower(p_team_name)) then
    raise exception 'TEAM_NAME_TAKEN';
  end if;

  v_reg_id := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into teams (registration_id, team_name, device_id, registered_ip, registered_user_agent)
  values (v_reg_id, p_team_name, p_device_id, _client_ip(), _client_user_agent())
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
    raise exception 'MEMBER_ALREADY_REGISTERED';
end $$;

revoke all on function public.register_team(text, jsonb, uuid) from public;
grant execute on function public.register_team(text, jsonb, uuid) to anon, authenticated;

-- ── 3. submit_payment records the paying IP ────────────────────────────────
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
         payment_submitted_at   = now(),
         payment_ip             = _client_ip()
   where registration_id = upper(btrim(p_registration_id))
     and payment_status in ('pending', 'ticket_uploaded', 'rejected')
     and split_part(p_screenshot_path, '/', 1) = upper(btrim(p_registration_id));

  if not found then raise exception 'PAYMENT_NOT_ALLOWED'; end if;
exception
  when unique_violation then raise exception 'UTR_ALREADY_USED';
end $$;

-- ── 4. "My Registration" lookups ───────────────────────────────────────────
-- Registrations made from this device (device_id is a random secret in the browser)
create or replace function public.get_device_registrations(p_device_id uuid)
returns table (registration_id text, team_name text, payment_status text)
language sql stable security definer set search_path = public as $$
  select t.registration_id, t.team_name, t.payment_status
  from teams t
  where p_device_id is not null and t.device_id = p_device_id
  order by t.team_name
$$;

-- Recovery on a new device: team leader's email AND phone must both match
create or replace function public.find_registration(p_email text, p_phone text)
returns table (registration_id text, team_name text, payment_status text)
language sql stable security definer set search_path = public as $$
  select t.registration_id, t.team_name, t.payment_status
  from teams t
  join members m on m.team_id = t.id and m.is_leader
  where m.email = lower(btrim(p_email))
    and m.phone = right(regexp_replace(p_phone, '\D', '', 'g'), 10)
$$;

revoke all on function public.get_device_registrations(uuid) from public;
revoke all on function public.find_registration(text, text)  from public;
grant execute on function public.get_device_registrations(uuid) to anon, authenticated;
grant execute on function public.find_registration(text, text)  to anon, authenticated;

-- ── 5. Admin list: include device / IP + same-device count ────────────────
create or replace function public.admin_list_teams()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'registration_id',        t.registration_id,
      'team_name',              t.team_name,
      'payment_status',         t.payment_status,
      'payment_txn_id',         t.payment_txn_id,
      'payment_screenshot_url', t.payment_screenshot_url,
      'payment_submitted_at',   t.payment_submitted_at,
      'ticket_sent_at',         t.ticket_sent_at,
      'registered_ip',          t.registered_ip,
      'payment_ip',             t.payment_ip,
      'registered_user_agent',  t.registered_user_agent,
      'same_device_count', (
        select count(*) from teams t2
        where t.device_id is not null and t2.device_id = t.device_id
      ),
      'members', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'name', m.name, 'email', m.email, 'phone', m.phone,
          'college', m.college, 'is_leader', m.is_leader
        ) order by m.is_leader desc, m.name), '[]'::jsonb)
        from members m where m.team_id = t.id
      )
    ) order by t.payment_submitted_at desc nulls last, t.team_name)
    from teams t
  ), '[]'::jsonb);
end $$;

-- ── 6. Realtime for /admin (admins only, via RLS) ─────────────────────────
grant select on public.teams to authenticated;
drop policy if exists "admins_read_teams" on public.teams;
create policy "admins_read_teams" on public.teams
  for select to authenticated using (public.is_admin());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'teams'
  ) then
    alter publication supabase_realtime add table public.teams;
  end if;
end $$;

-- ── 7. Web Push subscriptions (one row per organiser device) ──────────────
create table if not exists public.admin_push_subscriptions (
  endpoint   text primary key,
  keys       jsonb not null,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_push_subscriptions enable row level security;
revoke all on public.admin_push_subscriptions from anon, authenticated;

create or replace function public.admin_save_push_subscription(p_subscription jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;
  if coalesce(p_subscription->>'endpoint', '') !~ '^https://' then raise exception 'INVALID_SUBSCRIPTION'; end if;

  insert into admin_push_subscriptions (endpoint, keys, user_id)
  values (p_subscription->>'endpoint', p_subscription->'keys', auth.uid())
  on conflict (endpoint) do update set keys = excluded.keys, user_id = excluded.user_id;
end $$;

revoke all on function public.admin_save_push_subscription(jsonb) from public;
grant execute on function public.admin_save_push_subscription(jsonb) to authenticated;

-- ── 8. Payment submitted → call notify-admins Edge Function ───────────────
create extension if not exists pg_net with schema extensions;

create or replace function public._notify_admins_on_payment()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'notify_webhook_secret' limit 1;
  if v_secret is null then return new; end if;  -- push not configured yet

  perform net.http_post(
    url     := 'https://yufgcqknxdnxrtvwiwfz.supabase.co/functions/v1/notify-admins',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body    := jsonb_build_object(
      'registration_id', new.registration_id,
      'team_name',       new.team_name,
      'utr',             new.payment_txn_id
    )
  );
  return new;
exception when others then
  -- Never block a team's payment submission because a notification failed
  return new;
end $$;

drop trigger if exists teams_notify_admins on public.teams;
create trigger teams_notify_admins
  after update of payment_status on public.teams
  for each row
  -- new proof submitted (first time, or a re-upload after rejection / new UTR)
  when (new.payment_status = 'ticket_uploaded'
        and (old.payment_status is distinct from new.payment_status
             or old.payment_txn_id is distinct from new.payment_txn_id))
  execute function public._notify_admins_on_payment();
