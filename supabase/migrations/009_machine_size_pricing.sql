alter table tlp_packages add column if not exists titan_price_cents integer not null default 0;
alter table tlp_job_orders add column if not exists tier text;
