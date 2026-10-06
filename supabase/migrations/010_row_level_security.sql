-- Row level security on every table. The app only reaches these tables through its own API with the service
-- key (which bypasses RLS), so no policies are added: the public anon key can read and write nothing.
-- Safe to run more than once. (The live database already has this; this keeps a fresh setup the same.)
alter table tlp_job_orders  enable row level security;
alter table tlp_packages    enable row level security;
alter table tlp_settings    enable row level security;
alter table tlp_machines    enable row level security;
alter table tlp_machine_runs enable row level security;
