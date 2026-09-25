-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Organisers can delete a team from /admin (frees its slot — spam,
--    duplicates, abandoned rejected payments). Members cascade.
-- 2. Organisers can delete payment-proof files (removed with the team).
-- 3. Payment-proof bucket only accepts images / PDF (5 MB limit already set).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.admin_delete_team(p_registration_id text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_path text;
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;

  delete from teams
   where registration_id = p_registration_id
  returning payment_screenshot_url into v_path;

  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
  return v_path; -- client removes the proof file with this path
end $$;

revoke all on function public.admin_delete_team(text) from public, anon;
grant execute on function public.admin_delete_team(text) to authenticated;

drop policy if exists "tickets_admin_delete" on storage.objects;
create policy "tickets_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'tickets' and public.is_admin());

update storage.buckets
   set allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'
       ],
       file_size_limit = 5242880
 where id = 'tickets';

notify pgrst, 'reload schema';
