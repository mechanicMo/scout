create or replace function scout.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = scout, public
as $$
begin
  insert into scout.users (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;

  insert into scout.taste_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_scout on auth.users;
create trigger on_auth_user_created_scout
  after insert on auth.users
  for each row execute function scout.handle_new_auth_user();
