-- Final Round results (29 Sep). Winners get prize certificates in person, so the
-- participation-certificate emails skip them; the prize page presets their award.
alter table public.teams add column if not exists final_award text
  check (final_award in ('first', 'second', 'third'));

update public.teams set final_award = v.award
  from (values ('4C40D7530C', 'first'), ('4F6A0BB5F3', 'second'), ('87D9D0F4E8', 'third')) as v(rid, award)
 where teams.registration_id = v.rid;

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
      'final_topic',            t.final_topic,
      'payment_status',         t.payment_status,
      'payment_txn_id',         t.payment_txn_id,
      'payment_screenshot_url', t.payment_screenshot_url,
      'payment_submitted_at',   t.payment_submitted_at,
      'ticket_sent_at',         t.ticket_sent_at,
      'final_mail_sent_at',     t.final_mail_sent_at,
      'is_finalist',            t.is_finalist,
      'final_award',            t.final_award,
      'certificate_mail',       t.certificate_mail,
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
