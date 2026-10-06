create table if not exists tlp_machine_runs (
  id uuid primary key default gen_random_uuid(),
  machine_id text not null,
  order_id text,
  line_id text,
  started_at timestamptz,
  ended_at timestamptz not null default now(),
  minutes integer not null default 0
);

create index if not exists tlp_machine_runs_ended_idx on tlp_machine_runs (ended_at desc);

-- Only the server (service role key) touches this table.
alter table tlp_machine_runs enable row level security;
