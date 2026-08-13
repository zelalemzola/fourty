# Fourty — Inventory & Sales OS

Mobile-first inventory, sales, subagent, and audit platform for **Fourty** cigarette distribution.

## Stack

- Next.js 16 (App Router) + TypeScript
- Supabase (Auth, Postgres, Storage, RLS)
- Redux Toolkit + RTK Query
- shadcn/ui + Lucide + Recharts
- Excel export (ExcelJS)
- Web Push (`web-push` + service worker)
- Sonner toasts

## Roles

| Role | Access |
|------|--------|
| **Owner** | All stores, brands, team, reports, audit, min-stock thresholds, everything |
| **Storekeeper** | Own store only: inventory, restock, sales, subagent batches, store reports |
| **Subagent** | Own batches: sell from issued stock (screenshot required), track in-hand |

## Setup

### 1. Environment

Copy `.env.example` → `.env.local` and fill:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:owner@fourty.local
```

VAPID keys were generated into `vapid-keys.json` (gitignored). Copy `publicKey` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `privateKey` → `VAPID_PRIVATE_KEY`.

To regenerate:

```bash
npx web-push generate-vapid-keys --json
```

### 2. Database

In the Supabase SQL editor, run in order:

1. `supabase/schema.sql`
2. `supabase/storage.sql`
3. `supabase/enterprise.sql` (daily closeout, adjustments, remittances)
4. (optional) `supabase/seed.sql` — deep demo data for every page

### Demo seed accounts

Password for all: `SeedDemo123!`

| Email | Role |
|-------|------|
| `owner@fourty.demo` | owner |
| `keeper.central@fourty.demo` | storekeeper |
| `keeper.east@fourty.demo` | storekeeper |
| `keeper.north@fourty.demo` | storekeeper |
| `agent.abebe@fourty.demo` | subagent |
| `agent.sara@fourty.demo` | subagent |
| `agent.dawit@fourty.demo` | subagent |

### Clear seed before deploy

```sql
-- Run in Supabase SQL Editor
-- File: supabase/clear-seed.sql
```

Only removes `SEED-*` / `@fourty.demo` / fixed seed UUID rows. Real production data is left alone.

### 3. First owner user

1. Create a user in **Supabase Auth** (email + password).
2. Promote them:

```sql
update public.profiles
set role = 'owner'
where email = 'your-owner@email.com';
```

Assign storekeepers/subagents the same way (`role`, `store_id`) from the **Team** page after they sign up, or via SQL.

### 4. Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → redirects to dashboard (login required).

## App map

- `/login` — auth
- `/app/dashboard` — KPI cards, trends, brand/store breakdowns
- `/app/inventory` — stock levels + bulk min-stock (owner)
- `/app/sales` + `/app/sales/new` — sales with **required** transaction screenshot
- `/app/restock` — replenish cartons
- `/app/stores` / `/app/brands` — catalog (owner)
- `/app/subagents` — issue/return batches, in-hand tracking
- `/app/closeout` — end-of-day store submission (sales + stock + notes → owner)
- `/app/adjustments` — inventory corrections with reason codes
- `/app/remittances` — money sent to company account with proof
- `/app/reports` — period/store filters, screenshots, exports
- `/app/audit` — every action (owner)
- `/app/notifications` — in-app + push alerts
- `/app/users` — roles & store assignment
- `/app/settings` — profile + push enable

## Notes

- Collapsible sidebar (icon mode) via shadcn `Sidebar`; theme toggle (light/dark/system) in sidebar + header.
- Corporate navy + coral-red theme; IBM Plex Sans; flat panels (no mesh/glass glow).
- Every mutation notifies owners (in-app + push when subscribed) and writes an audit row.
- Excel export is available on list/report screens.
