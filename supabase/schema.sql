-- Restaurant POS schema
-- Run this whole file once in the Supabase SQL editor (Project -> SQL Editor -> New query).

create extension if not exists "pgcrypto";

-- ============ STAFF ============
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin_hash text not null,
  role text not null check (role in ('admin', 'server', 'kitchen')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ FLOOR TABLES ============
create table if not exists restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  seats int not null default 4,
  pos_x real not null default 10, -- percentage (0-100) position on the floor plan
  pos_y real not null default 10,
  created_at timestamptz not null default now()
);

-- ============ TABS (a seated party's running bill) ============
create table if not exists tabs (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references restaurant_tables(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'needs_payment', 'closed')),
  server_id uuid references staff(id) on delete set null,
  guest_count int not null default 1,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  payment_method text check (payment_method in ('cash', 'card', 'other'))
);

create index if not exists idx_tabs_table_id on tabs(table_id);
create index if not exists idx_tabs_status on tabs(status);

-- ============ MENU ============
create table if not exists menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0
);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references menu_categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  is_available boolean not null default true,
  sort_order int not null default 0
);

create index if not exists idx_menu_items_category on menu_items(category_id);

-- ============ ORDERS (a "fire" sent to the kitchen for a tab) ============
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid not null references tabs(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'ready', 'served', 'cancelled')),
  created_at timestamptz not null default now(),
  created_by uuid references staff(id) on delete set null
);

create index if not exists idx_orders_tab_id on orders(tab_id);
create index if not exists idx_orders_status on orders(status);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  name_snapshot text not null,
  price_snapshot numeric(10, 2) not null,
  quantity int not null default 1 check (quantity > 0),
  note text,
  status text not null default 'pending' check (status in ('pending', 'ready', 'served', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_order_items_order_id on order_items(order_id);

-- ============ VIEW: running total per tab ============
create or replace view tab_totals as
select
  t.id as tab_id,
  coalesce(sum(oi.price_snapshot * oi.quantity) filter (where oi.status <> 'cancelled'), 0) as total
from tabs t
left join orders o on o.tab_id = t.id and o.status <> 'cancelled'
left join order_items oi on oi.order_id = o.id
group by t.id;

-- ============ ROW LEVEL SECURITY ============
-- Auth in this app is a custom PIN + signed cookie handled by Next.js API routes using the
-- Supabase service role key (which bypasses RLS entirely). The anon key is only used in the
-- browser for read-only realtime subscriptions, so anon gets SELECT access on operational
-- data and nothing else. The `staff` table (holds PIN hashes) is never exposed to anon.

alter table staff enable row level security;
alter table restaurant_tables enable row level security;
alter table tabs enable row level security;
alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

create policy "anon can read tables" on restaurant_tables for select to anon using (true);
create policy "anon can read tabs" on tabs for select to anon using (true);
create policy "anon can read menu_categories" on menu_categories for select to anon using (true);
create policy "anon can read menu_items" on menu_items for select to anon using (true);
create policy "anon can read orders" on orders for select to anon using (true);
create policy "anon can read order_items" on order_items for select to anon using (true);
-- No policies on `staff` for anon -> default deny (no reads, no writes).

-- ============ REALTIME ============
alter publication supabase_realtime add table tabs;
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_items;
alter publication supabase_realtime add table restaurant_tables;
alter publication supabase_realtime add table menu_items;

-- ============ SEED DATA ============
-- Demo staff PINs (change these after first login):
--   Admin  -> PIN 1234
--   Server -> PIN 1111
--   Kitchen -> PIN 2222
-- Hashes below are bcrypt hashes of those PINs (cost factor 10).
insert into staff (name, pin_hash, role) values
  ('Manager', '$2b$10$8eBfdJ4iQyNTRX.e0dxJkOnL.73NrQzcl7ZDEv2fJ2ZsDYEuiKfIq', 'admin'),
  ('Server 1', '$2b$10$JC6FMvLNplDvw5RiriQzn.RnwTeEMUAxszmHL7tJhAq.BwrMrWzc6', 'server'),
  ('Kitchen 1', '$2b$10$zkzjjwQ4R3jjHFNFDJvHrOuNhVebACN7dYelGxA1GZjJ0lY0B/pXi', 'kitchen')
on conflict do nothing;

-- 20 tables laid out in a simple grid for the floor plan (edit positions freely later from the admin screen).
insert into restaurant_tables (label, seats, pos_x, pos_y)
select
  (n)::text,
  case when n % 4 = 0 then 6 else 4 end,
  10 + ((n - 1) % 5) * 18,
  15 + ((n - 1) / 5) * 22
from generate_series(1, 20) as n
on conflict do nothing;

insert into menu_categories (name, sort_order) values
  ('Starters', 1),
  ('Mains', 2),
  ('Desserts', 3),
  ('Drinks', 4)
on conflict do nothing;

insert into menu_items (category_id, name, description, price, sort_order)
select id, v.name, v.description, v.price, v.sort_order
from menu_categories, (values
  ('Starters', 'Loaded Nachos', 'Tortilla chips, cheese, jalapenos, salsa', 9.50, 1),
  ('Starters', 'Soup of the Day', 'Ask your server', 6.00, 2),
  ('Mains', 'Classic Cheeseburger', 'Beef patty, cheddar, lettuce, tomato, fries', 14.50, 1),
  ('Mains', 'Grilled Salmon', 'Seasonal vegetables, lemon butter', 19.00, 2),
  ('Mains', 'Margherita Pizza', 'Tomato, mozzarella, basil', 13.00, 3),
  ('Desserts', 'Chocolate Lava Cake', 'Vanilla ice cream', 7.50, 1),
  ('Drinks', 'Soft Drink', 'Coke, Sprite, or Ginger Ale', 3.00, 1),
  ('Drinks', 'Iced Tea', 'Fresh brewed', 3.00, 2)
) as v(category, name, description, price, sort_order)
where menu_categories.name = v.category
on conflict do nothing;
