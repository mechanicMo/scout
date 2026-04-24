-- Enable Row-Level Security on all scout.* tables (idempotent)
alter table scout.users enable row level security;
alter table scout.taste_profiles enable row level security;
alter table scout.watchlist enable row level security;
alter table scout.watch_history enable row level security;
alter table scout.survey_answers enable row level security;
alter table scout.survey_question_state enable row level security;
alter table scout.recommendations enable row level security;
alter table scout.mood_searches enable row level security;
alter table scout.usage_logs enable row level security;
alter table scout.media_cache enable row level security;

-- scout.users
do $$ begin create policy "users_select_self" on scout.users for select using (auth.uid() = id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users_update_self" on scout.users for update using (auth.uid() = id) with check (auth.uid() = id); exception when duplicate_object then null; end $$;

-- scout.taste_profiles
do $$ begin create policy "taste_profiles_select_self" on scout.taste_profiles for select using (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "taste_profiles_update_self" on scout.taste_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;

-- scout.watchlist
do $$ begin create policy "watchlist_select_self" on scout.watchlist for select using (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "watchlist_insert_self" on scout.watchlist for insert with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "watchlist_update_self" on scout.watchlist for update using (auth.uid() = user_id) with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "watchlist_delete_self" on scout.watchlist for delete using (auth.uid() = user_id); exception when duplicate_object then null; end $$;

-- scout.watch_history
do $$ begin create policy "watch_history_select_self" on scout.watch_history for select using (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "watch_history_insert_self" on scout.watch_history for insert with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "watch_history_update_self" on scout.watch_history for update using (auth.uid() = user_id) with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "watch_history_delete_self" on scout.watch_history for delete using (auth.uid() = user_id); exception when duplicate_object then null; end $$;

-- scout.survey_answers
do $$ begin create policy "survey_answers_select_self" on scout.survey_answers for select using (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "survey_answers_insert_self" on scout.survey_answers for insert with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;

-- scout.survey_question_state
do $$ begin create policy "survey_question_state_select_self" on scout.survey_question_state for select using (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "survey_question_state_insert_self" on scout.survey_question_state for insert with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "survey_question_state_update_self" on scout.survey_question_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;

-- scout.recommendations
do $$ begin create policy "recommendations_select_self" on scout.recommendations for select using (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "recommendations_delete_self" on scout.recommendations for delete using (auth.uid() = user_id); exception when duplicate_object then null; end $$;

-- scout.mood_searches
do $$ begin create policy "mood_searches_select_self" on scout.mood_searches for select using (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "mood_searches_insert_self" on scout.mood_searches for insert with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "mood_searches_update_self" on scout.mood_searches for update using (auth.uid() = user_id) with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "mood_searches_delete_self" on scout.mood_searches for delete using (auth.uid() = user_id); exception when duplicate_object then null; end $$;

-- scout.usage_logs
do $$ begin create policy "usage_logs_select_self" on scout.usage_logs for select using (auth.uid() = user_id); exception when duplicate_object then null; end $$;

-- scout.media_cache
do $$ begin create policy "media_cache_select_any" on scout.media_cache for select using (true); exception when duplicate_object then null; end $$;

-- Grants for authenticated users
grant select, insert, update, delete on scout.users to authenticated;
grant select, insert, update, delete on scout.taste_profiles to authenticated;
grant select, insert, update, delete on scout.watchlist to authenticated;
grant select, insert, update, delete on scout.watch_history to authenticated;
grant select, insert, update, delete on scout.survey_answers to authenticated;
grant select, insert, update, delete on scout.survey_question_state to authenticated;
grant select, insert, update, delete on scout.recommendations to authenticated;
grant select, insert, update, delete on scout.mood_searches to authenticated;
grant select, insert, update, delete on scout.usage_logs to authenticated;
grant select on scout.media_cache to authenticated;

-- Service role grants
grant select, insert, update, delete on scout.users to service_role;
grant select, insert, update, delete on scout.taste_profiles to service_role;
grant select, insert, update, delete on scout.watchlist to service_role;
grant select, insert, update, delete on scout.watch_history to service_role;
grant select, insert, update, delete on scout.survey_answers to service_role;
grant select, insert, update, delete on scout.survey_question_state to service_role;
grant select, insert, update, delete on scout.recommendations to service_role;
grant select, insert, update, delete on scout.mood_searches to service_role;
grant select, insert, update, delete on scout.usage_logs to service_role;
grant select, insert, update, delete on scout.media_cache to service_role;
