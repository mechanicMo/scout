-- Prerequisite for auth trigger's ON CONFLICT (user_id) clause.
do $$ begin
  alter table scout.taste_profiles add constraint taste_profiles_user_id_key unique (user_id);
exception when duplicate_object then null;
end $$;
