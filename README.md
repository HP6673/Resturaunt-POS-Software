# Restaurant POS

A free-to-host restaurant order/ticket system: PIN-based staff login, a visual
table tracker, order entry (POS), a live kitchen display, and menu management —
built on Next.js + Supabase, deployed on Vercel's free tier.

## How it fits together

- **Next.js (App Router)** — all UI plus API routes, deployed to Vercel.
- **Supabase** — free hosted Postgres database. Also powers realtime updates,
  so when a server sends an order, it appears on the kitchen screen instantly,
  and when the kitchen marks an item ready, the table/POS screens update live.
- **Staff auth** — PIN-based, not email/password. Staff PINs are 6 digits,
  stored **encrypted** (not hashed) in the `staff` table using
  `PIN_ENCRYPTION_KEY` (see `src/lib/pinCrypto.ts`) — deliberately reversible,
  not one-way, so admins can view an employee's current PIN from
  `/admin/staff`. A signed, httpOnly cookie (via `jose`) tracks who's logged in
  and their role (`admin`, `server`, `kitchen`). This is *not* Supabase Auth —
  it's a small custom layer suited to a shared tablet at a host stand or
  kitchen pass.
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
realtime subscriptions and live totals. The `staff` table (encrypted PINs) has
no anon access at all. See `supabase/schema.sql` for the exact policies.

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
   - (Staff logins are seeded separately in step 3 below, since PINs need this
     deployment's own encryption key.)
3. In **Project Settings → API**, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — never
     put it in a `NEXT_PUBLIC_*` variable or commit it)

### 2. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in the three Supabase
values above, plus a random `SESSION_SECRET` and `PIN_ENCRYPTION_KEY` (each a
long random string — e.g. run
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
once per variable).

### 3. Seed the demo staff logins

```bash
node --env-file=.env.local scripts/seed-staff.mjs
```

This creates 3 demo logins with PINs encrypted under your `PIN_ENCRYPTION_KEY`
(**change these before real use** — via `/admin/staff` once logged in):

| Role    | PIN    |
|---------|--------|
| admin   | 100166 |
| server  | 111111 |
| kitchen | 222222 |

### 4. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on the PIN
pad. Log in with one of the demo PINs above (works with the on-screen keypad
or by typing on a physical keyboard).

If you set up your Supabase project before floors/table-shape support was
added, run [`supabase/migrations/0002_floors_shape_status.sql`](supabase/migrations/0002_floors_shape_status.sql)
once in the SQL editor to bring an existing database up to date. If you set it
up before PIN encryption was added, run
[`supabase/migrations/0003_pin_encryption.sql`](supabase/migrations/0003_pin_encryption.sql)
once, then reset every existing employee's PIN from `/admin/staff` (old
bcrypt-hashed PINs can't be recovered or decrypted).

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
- **Staff** (`/admin/staff`, admin only) — add employees with a name, role,
  and 6-digit PIN (rejects duplicates); each employee's current PIN is shown
  in the list. Change role, reset a PIN, deactivate (you can't deactivate
  yourself), or permanently delete an employee (you can't delete yourself
  either) — deleting unlinks them from past orders/tabs rather than removing
  that history.
- **Reports** (`/admin/reports`, admin only) — revenue, tabs closed, and
  average tab size over the last 24 hours / 7 days / 30 days / all time, plus
  a top-selling-items table for the last 30 days.
- **Bill adjustments** — from the Checkout dialog, admins can apply a comp or
  discount (negative amount) or a surcharge (positive amount) with a note.
  It's reflected in the tab's total everywhere immediately (POS, table board,
  and later in Reports once the tab closes).

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

## Hosting a separate copy for another restaurant

Each restaurant needs its **own** Supabase project (its own database) and its
own Vercel project (its own environment variables). Since staff, tables,
orders, and menu all live in one Supabase project per deployment, reusing the
same Supabase project for two restaurants would mix their data together — so
don't do that. Instead, spin up a fully independent copy per restaurant:

1. **Duplicate the code.** On this repo's GitHub page, click **Use this
   template** (or **Fork**) to create a brand-new repository for the new
   restaurant — e.g. `resturaunt-pos-joes-diner`. Don't just push more
   restaurants' data into this same repo/branch.
2. **Create a new, separate Supabase project** for that restaurant (step 1 of
   "One-time setup" above). Run [`supabase/schema.sql`](supabase/schema.sql)
   in its SQL editor — this gives the new restaurant its own empty tables and
   seed data, completely isolated from any other restaurant's data.
3. **Create a new, separate Vercel project** and import the new repo (not the
   original one). In its **Settings → Environment Variables**, set that
   restaurant's own `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, and freshly generated `SESSION_SECRET` and
   `PIN_ENCRYPTION_KEY` values (never reuse these across restaurants — one
   signs the login cookie, the other encrypts staff PINs).
4. Run `node --env-file=.env.local scripts/seed-staff.mjs` once (locally,
   pointed at the new restaurant's `.env.local`) to create its demo staff
   logins.
5. Deploy. That restaurant now has its own URL, its own database, and its own
   staff logins, fully independent of every other copy.
6. **Change the demo PINs immediately** after setup (see the table under
   "One-time setup") — every fresh copy starts with the same default PINs
   until you change them.

Bug fixes or new features you make in one copy don't automatically appear in
the others — each is its own repo/branch from this point on. If you want
updates to propagate, keep this repo as the "template" and periodically merge
its changes into each restaurant's fork.

## Known limitations / good next steps

- No receipt or kitchen-printer integration — everything is on-screen (by
  design, for v1).
- No split-check support (one running total per table).
- Payment is "tracked," not processed — for real card payments you'd add
  Stripe (or similar) at checkout.
- PIN login decrypts every active staff member's PIN to find a match (fine
  for a small staff; would need a rethink at large scale).
- Staff PINs are encrypted (reversible), not hashed, specifically so admins
  can view them — a deliberate tradeoff given these are 6-digit codes for a
  shared tablet, not real account passwords. If `PIN_ENCRYPTION_KEY` ever
  leaks, all staff PINs are exposed; rotate it and reset every PIN if that
  happens.
- Reports use fixed windows (24h/7d/30d/all-time) rather than a custom date
  picker.
