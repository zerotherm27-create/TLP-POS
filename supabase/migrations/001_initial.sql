create table tlp_job_orders (
  id text primary key,
  branch_id text not null,
  source text not null,
  order_number text,
  external_order_id text unique,
  external_order_url text,
  customer_name text not null,
  contact_number text,
  notes text,
  services jsonb not null default '[]',
  assignments jsonb not null default '[]',
  status text not null,
  payment_status text not null,
  fulfillment_stage text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index on tlp_job_orders (source, external_order_id);
create index on tlp_job_orders (status, fulfillment_stage);
create index on tlp_job_orders (branch_id, created_at desc);
