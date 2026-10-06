alter table tlp_packages add column if not exists price_cents integer not null default 0;
alter table tlp_job_orders add column if not exists package_id text;
alter table tlp_job_orders add column if not exists package_name text;
