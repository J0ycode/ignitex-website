-- ─────────────────────────────────────────────────────────────────────────────
-- Topic per team, edited by organisers on /admin/print (printable team sheet).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.teams add column if not exists topic text;

create or replace function public.admin_set_topic(p_registration_id text, p_topic text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;
  if length(coalesce(p_topic, '')) > 300 then raise exception 'TOPIC_TOO_LONG'; end if;
  update teams set topic = nullif(btrim(p_topic), '')
   where registration_id = upper(btrim(p_registration_id));
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
end $$;

revoke all on function public.admin_set_topic(text, text) from public, anon;
grant execute on function public.admin_set_topic(text, text) to authenticated;

create or replace function public.admin_list_teams()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'registration_id',        t.registration_id,
      'created_at',             t.created_at,
      'team_name',              t.team_name,
      'topic',                  t.topic,
      'payment_status',         t.payment_status,
      'payment_txn_id',         t.payment_txn_id,
      'payment_screenshot_url', t.payment_screenshot_url,
      'payment_submitted_at',   t.payment_submitted_at,
      'ticket_sent_at',         t.ticket_sent_at,
      'registered_ip',          t.registered_ip,
      'payment_ip',             t.payment_ip,
      'payment_payee_upi',      t.payment_payee_upi,
      'payment_payee_inferred', t.payment_payee_inferred,
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
    ) order by t.created_at desc)
    from teams t
  ), '[]'::jsonb);
end $$;

notify pgrst, 'reload schema';
