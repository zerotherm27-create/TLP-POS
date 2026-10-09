create table if not exists tlp_machine_commands (
  id text primary key,
  branch_id text not null default 'b1',
  machine_id text not null references tlp_machines(id),
  product_id text not null,
  gateway_id text not null default 'z83-local',
  status text not null default 'queued' check (status in ('queued','sent','succeeded','failed')),
  requested_by text,
  requested_at timestamptz not null default now(),
  sent_at timestamptz,
  completed_at timestamptz,
  request jsonb not null,
  result jsonb,
  error text
);

create index if not exists tlp_machine_commands_next_idx
  on tlp_machine_commands (gateway_id, status, requested_at);

alter table tlp_machine_commands enable row level security;
