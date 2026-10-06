create table if not exists tlp_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Only the server (service role key) touches this table; browsers never query it directly.
alter table tlp_settings enable row level security;
