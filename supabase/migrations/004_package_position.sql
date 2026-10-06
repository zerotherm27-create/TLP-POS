alter table tlp_packages add column if not exists position integer not null default 0;

update tlp_packages p set position = r.rn
from (select id, row_number() over (order by created_at asc) as rn from tlp_packages) r
where p.id = r.id;
