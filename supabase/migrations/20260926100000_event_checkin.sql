-- ─────────────────────────────────────────────────────────────────────────────
-- Event-day check-in (/registration): organisers scan a team's ticket QR and
-- the team moves from "Absent" to "Present". Only verified teams can check in.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.teams
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by text;

-- Verified teams (the ones holding tickets) with members + check-in state
create or replace function public.admin_checkin_list()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;

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

-- Returns { status: 'checked_in' | 'already', team_name, checked_in_at }
create or replace function public.admin_check_in(p_registration_id text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t teams%rowtype;
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;

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
         checked_in_by = (select email from auth.users where id = auth.uid())
   where id = t.id
  returning * into t;

  return jsonb_build_object('status', 'checked_in', 'team_name', t.team_name, 'checked_in_at', t.checked_in_at);
end $$;

create or replace function public.admin_undo_check_in(p_registration_id text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;
  update teams set checked_in_at = null, checked_in_by = null
   where registration_id = upper(btrim(p_registration_id));
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
end $$;

revoke all on function public.admin_checkin_list()          from public, anon;
revoke all on function public.admin_check_in(text)          from public, anon;
revoke all on function public.admin_undo_check_in(text)     from public, anon;
grant execute on function public.admin_checkin_list()       to authenticated;
grant execute on function public.admin_check_in(text)       to authenticated;
grant execute on function public.admin_undo_check_in(text)  to authenticated;

notify pgrst, 'reload schema';
