create table if not exists tlp_machines (
  id text primary key,
  branch_id text not null default 'b1',
  name text not null,
  kind text not null check (kind in ('washer','dryer')),
  tier text,
  public_code text not null,
  esp_ip text not null default '',
  status text not null default 'online' check (status in ('online','offline','running')),
  active_job_order_id text,
  customer_name text,
  remaining_minutes integer,
  started_at timestamptz,
  last_seen_at timestamptz not null default now(),
  cycle_count integer not null default 0,
  total_run_minutes integer not null default 0,
  last_tub_clean_cycle integer not null default 0
);

alter table tlp_machines enable row level security;

insert into tlp_machines (id, name, kind, tier, public_code, esp_ip, cycle_count, total_run_minutes, last_tub_clean_cycle) values
  ('m1','Washer 1','washer','giant','W1','192.168.1.10',43,1632,0),
  ('m2','Washer 2','washer','giant','W2','192.168.1.11',18,684,0),
  ('m3','Washer 3','washer','giant','W3','192.168.1.12',53,2014,0),
  ('m4','Washer 4','washer','giant','W4','192.168.1.13',31,1178,0),
  ('m5','Washer 5','washer','titan','W5','192.168.1.14',9,342,0),
  ('m6','Dryer 1','dryer','giant','D1','192.168.1.20',61,2318,10),
  ('m7','Dryer 2','dryer','giant','D2','192.168.1.21',27,1026,0),
  ('m8','Dryer 3','dryer','giant','D3','192.168.1.22',38,1444,0),
  ('m9','Dryer 4','dryer','giant','D4','192.168.1.23',14,532,0),
  ('m10','Dryer 5','dryer','titan','D5','192.168.1.24',22,836,0)
on conflict (id) do nothing;
