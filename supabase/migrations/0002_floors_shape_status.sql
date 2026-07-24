-- Adds: editable table shape/size, multiple floors/rooms, and a richer table
-- status lifecycle (seated -> ordered -> eating -> needs_payment -> closed).
-- Run once in the Supabase SQL editor. Safe to re-run.

-- Floors / rooms
create table if not exists floors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0
);

insert into floors (name, sort_order)
select 'Main Floor', 0
where not exists (select 1 from floors);

alter table floors enable row level security;
drop policy if exists "anon can read floors" on floors;
create policy "anon can read floors" on floors for select to anon using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'floors'
  ) then
    alter publication supabase_realtime add table floors;
  end if;
end $$;

-- Table shape, size, and floor assignment
alter table restaurant_tables add column if not exists shape text not null default 'square' check (shape in ('square', 'round', 'rectangle'));
alter table restaurant_tables add column if not exists width int not null default 96;
alter table restaurant_tables add column if not exists height int not null default 96;
alter table restaurant_tables add column if not exists floor_id uuid references floors(id) on delete cascade;

update restaurant_tables set floor_id = (select id from floors order by sort_order limit 1) where floor_id is null;
alter table restaurant_tables alter column floor_id set not null;

-- Richer table status: no tab row = EMPTY; otherwise seated / ordered / eating / needs_payment / closed
-- Constraint must be dropped before the data update below, since the old
-- constraint (from the very first schema) doesn't allow 'seated' as a value.
alter table tabs drop constraint if exists tabs_status_check;
update tabs set status = 'seated' where status = 'open';
alter table tabs add constraint tabs_status_check check (status in ('seated', 'ordered', 'eating', 'needs_payment', 'closed'));
alter table tabs alter column status set default 'seated';

-- Manual bill adjustments (comps/discounts), applied on top of the order total
alter table tabs add column if not exists adjustment numeric(10, 2) not null default 0;
alter table tabs add column if not exists adjustment_note text;

-- The original view only had (tab_id, total); CREATE OR REPLACE can't
-- reshape existing column names/order, so drop it first.
drop view if exists tab_totals;
create view tab_totals as
select
  t.id as tab_id,
  t.status,
  t.closed_at,
  t.adjustment,
  coalesce(sum(oi.price_snapshot * oi.quantity) filter (where oi.status <> 'cancelled'), 0) + t.adjustment as total
from tabs t
left join orders o on o.tab_id = t.id and o.status <> 'cancelled'
left join order_items oi on oi.order_id = o.id
group by t.id;
