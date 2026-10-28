-- Lets a signed-in person delete their own account from inside the app (App Store rule 5.1.1(v)).
-- The account is shared by Workout Tracker, Money Tracker and Azkar Tracker, so every app's rows go too.
create function public.delete_my_account() returns void
  language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  delete from public.records where user_id = me;
  delete from public.money_records where user_id = me;
  delete from public.azkar_records where user_id = me;
  delete from public.azkar_rounds where user_id = me;
  delete from auth.users where id = me;
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
