-- ─────────────────────────────────────────────────────────────────────────────
-- Shared desk login for /registration (event-day check-in).
-- Volunteers sign in with a shared ID/password, checked by the checkin-login
-- Edge Function, which signs them into a dedicated "desk" account. That
-- account may ONLY use the check-in RPCs — not payments, proofs or deletes.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.checkin_staff (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.checkin_staff enable row level security;
revoke all on public.checkin_staff from anon, authenticated;

-- Brute-force protection for the shared password (written by the Edge Function)
create table if not exists public.checkin_login_attempts (
  id         bigserial primary key,
  ip         text not null,
  ok         boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists checkin_login_attempts_ip_time on public.checkin_login_attempts (ip, created_at);
alter table public.checkin_login_attempts enable row level security;
revoke all on public.checkin_login_attempts from anon, authenticated;

create or replace function public.can_check_in()
returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (select 1 from checkin_staff where user_id = auth.uid())
$$;
revoke all on function public.can_check_in() from public, anon;
grant execute on function public.can_check_in() to authenticated;

-- Same three RPCs as 20260926100000, now open to desk staff as well
create or replace function public.admin_checkin_list()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not can_check_in() then raise exception 'NOT_ADMIN'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'registration_id', t.registration_id,
      'team_name',       t.team_name,
      'checked_in_at',   t.checked_in_at,
      'checked_in_by',   t.checked_in_by,
      'members', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'name', m.name, 'phone', m.phone, 'college', m.college, 'is_leader', m.is_leader
        ) order by m.is_leader desc, m.name), '[]'::jsonb)
        from members m where m.team_id = t.id
      )
    ) order by t.checked_in_at desc nulls last, t.team_name)
    from teams t
    where t.payment_status = 'verified'
  ), '[]'::jsonb);
end $$;

create or replace function public.admin_check_in(p_registration_id text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t teams%rowtype;
begin
  if not can_check_in() then raise exception 'NOT_ADMIN'; end if;

  select * into t from teams
   where registration_id = upper(btrim(p_registration_id))
   for update;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
  if t.payment_status <> 'verified' then raise exception 'NOT_VERIFIED'; end if;

  if t.checked_in_at is not null then
    return jsonb_build_object('status', 'already', 'team_name', t.team_name, 'checked_in_at', t.checked_in_at);
  end if;

  update teams
     set checked_in_at = now(),
         checked_in_by = case when is_admin()
                              then (select email from auth.users where id = auth.uid())
                              else 'desk' end
   where id = t.id
  returning * into t;

  return jsonb_build_object('status', 'checked_in', 'team_name', t.team_name, 'checked_in_at', t.checked_in_at);
end $$;

create or replace function public.admin_undo_check_in(p_registration_id text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_check_in() then raise exception 'NOT_ADMIN'; end if;
  update teams set checked_in_at = null, checked_in_by = null
   where registration_id = upper(btrim(p_registration_id));
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
end $$;

notify pgrst, 'reload schema';
