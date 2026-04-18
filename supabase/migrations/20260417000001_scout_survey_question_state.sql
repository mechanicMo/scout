create table scout.survey_question_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references scout.users(id) on delete cascade,
  question text not null,
  options text[] not null,
  multi_select boolean not null default false,
  source text not null check (source in ('seed', 'ai')),
  skip_count integer not null default 0,
  queue_order bigint not null,
  consumed_at timestamptz,
  generated_at timestamptz not null default now(),
  unique (user_id, question)
);

create index survey_question_state_queue_idx
  on scout.survey_question_state (user_id, queue_order)
  where consumed_at is null and skip_count < 2;
