create table if not exists tlp_packages (
  id text primary key,
  branch_id text not null default 'b1',
  name text not null,
  description text,
  services jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists tlp_packages_branch_idx on tlp_packages (branch_id, created_at desc);

-- Only the server (service role key) touches this table; browsers never query it directly.
alter table tlp_packages enable row level security;
