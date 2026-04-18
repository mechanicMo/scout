-- Prerequisite for auth trigger's ON CONFLICT (user_id) clause.
alter table scout.taste_profiles
  add constraint taste_profiles_user_id_key unique (user_id);
