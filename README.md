# Restaurant POS

A free-to-host restaurant order/ticket system: PIN-based staff login, a visual
table tracker, order entry (POS), a live kitchen display, and menu management —
built on Next.js + Supabase, deployed on Vercel's free tier.

## How it fits together

- **Next.js (App Router)** — all UI plus API routes, deployed to Vercel.
- **Supabase** — free hosted Postgres database. Also powers realtime updates,
  so when a server sends an order, it appears on the kitchen screen instantly,
  and when the kitchen marks an item ready, the table/POS screens update live.
- **Staff auth** — PIN-based, not email/password. Staff PINs are bcrypt-hashed
  in the `staff` table; a signed, httpOnly cookie (via `jose`) tracks who's
  logged in and their role (`admin`, `server`, `kitchen`). This is *not*
  Supabase Auth — it's a small custom layer suited to a shared tablet at a host
  stand or kitchen pass.
- **Roles**
  - `admin` — everything, plus Menu management and the Floor plan editor.
  - `server` — Tables, POS (order entry + checkout).
  - `kitchen` — Kitchen display only.

### Data flow / security model

All writes (creating orders, closing tabs, editing the menu, etc.) go through
Next.js API routes in `src/app/api/*`, which use the Supabase **service role
key** (server-only secret, bypasses Row Level Security). The browser only ever
holds the public **anon key**, which is restricted by RLS to read-only access
on operational tables (tables, tabs, orders, order_items, menu) — used for
realtime subscriptions and live totals. The `staff` table (PIN hashes) has no
anon access at all. See `supabase/schema.sql` for the exact policies.

This is a reasonable tradeoff for a small internal tool, but the anon key does
ship in the browser bundle, so anyone with it could read (not write) your
order/menu data directly via the Supabase API. If that matters to you, the
natural next step is swapping the custom PIN cookie for real Supabase Auth and
writing RLS policies keyed off `auth.uid()`.

## One-time setup

### 1. Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account/project.
2. In the project dashboard, open **SQL Editor → New query**, paste the
   contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. This
   creates all tables, RLS policies, realtime publications, and seeds:
   - A "Main Floor" with 20 demo tables
   - 4 menu categories with 8 sample items
   - 3 demo staff logins (**change these PINs before real use**):
     | Role    | PIN  |
     |---------|------|
     | admin   | 0166 |
     | server  | 1111 |
     | kitchen | 2222 |
3. In **Project Settings → API**, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — never
     put it in a `NEXT_PUBLIC_*` variable or commit it)

### 2. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in the three Supabase
values above, plus a random `SESSION_SECRET` (any long random string — e.g.
run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).

### 3. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on the PIN
pad. Log in with one of the demo PINs above.

If you set up your Supabase project before floors/table-shape support was
added, run [`supabase/migrations/0002_floors_shape_status.sql`](supabase/migrations/0002_floors_shape_status.sql)
once in the SQL editor to bring an existing database up to date.

## Deploying for free (GitHub + Vercel)

1. Push this repo to GitHub (already set up at
   `https://github.com/HP6673/Resturaunt-POS-Software`).
2. Go to [vercel.com/new](https://vercel.com/new), import the GitHub repo.
3. In the Vercel project's **Settings → Environment Variables**, add the same
   four variables from `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SESSION_SECRET`).
4. Deploy. Vercel's free (Hobby) tier and Supabase's free tier are both
   sufficient for a single restaurant's traffic.

Every push to your main branch redeploys automatically.

## Using it

- **Tables** (`/tables`) — floor plan per floor/room, color-coded by the
  table's lifecycle state:
  - **Empty** (white) — no open tab, tap to seat a new party
  - **Seated** (blue) — tab opened, nothing fired to the kitchen yet
  - **Ordered** (amber) — an order is in with the kitchen
  - **Eating** (green) — food has been served
  - **Payment** (rose) — checkout was opened, bill requested
  - If there's more than one floor, tabs at the top switch between them.
- **POS / ticket** (`/pos/[tabId]`) — browse the menu by category, tap items
  to add them (adjust quantity, attach a note), then **Send to kitchen**
  (bumps the tab to Ordered). **Checkout** marks the tab Payment and opens the
  close-out dialog — pick cash/card/other to close the tab (no real payment is
  processed in-app).
- **Kitchen** (`/kitchen`) — live queue of fired tickets, grouped by table,
  with an elapsed-time badge that turns red past 15 minutes. **Mark ready**
  moves a ticket to the pickup column; **Served / clear** marks it served,
  which also bumps the table to Eating.
- **Menu** (`/admin/menu`, admin only) — add categories/items, edit prices
  inline, toggle sold-out, delete items.
- **Floor plan** (`/admin/tables`, admin only) — switch or add floors/rooms,
  drag tables to reposition them, and click a table to edit its label, seat
  count, shape (square/round/rectangle), and size in pixels.

## Project structure

```
supabase/schema.sql       Full DB schema, RLS policies, realtime setup, seed data
src/lib/session.ts        Signed-cookie session (jose)
src/proxy.ts              Route protection by role (Next.js "proxy"/middleware convention)
src/lib/supabase/client.ts  Browser Supabase client (anon key)
src/lib/supabase/server.ts  Server Supabase client (service role key)
src/app/api/*              All write operations (auth, orders, tabs, menu, tables)
src/app/{tables,pos,kitchen,admin}  Pages
src/components/*           Client components (realtime UI)
```

## Known limitations / good next steps

- No receipt or kitchen-printer integration — everything is on-screen (by
  design, for v1).
- No sales reporting/analytics dashboard yet.
- No split-check support (one running total per table).
- Payment is "tracked," not processed — for real card payments you'd add
  Stripe (or similar) at checkout.
- PIN login checks a PIN against every active staff member's hash (fine for a
  small staff; would need a rethink at large scale).
