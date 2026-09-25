# POS Stock (Next.js + Supabase)

Single-shop point of sale and inventory app with:

- Products + image upload
- POS checkout with stock deduction
- Purchase / receiving with stock increase
- Printable sales and purchase receipts
- RBAC (super admin owns roles & permissions)

Project path: `/home/mostafa/pos-app`

## 1. Create a free Supabase project

1. Go to [https://supabase.com](https://supabase.com) and create a project
2. In **Authentication → Providers**, keep Email enabled
3. In **Authentication → URL configuration**, add:
   - Site URL: `http://localhost:3000`
   - Redirect URL: `http://localhost:3000/auth/callback`
4. Copy **Project URL** and the **anon public** key from **Settings → API**. Do not copy the service role key into the app.
5. From **Connect**, copy the direct Postgres URI (port 5432). That is `DATABASE_URL`.

## 2. Configure the app

```bash
cd /home/mostafa/pos-app
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres
SUPER_ADMIN_EMAIL=admin@shop.local
SUPER_ADMIN_PASSWORD=choose-a-password
```

## 3. Run locally

```bash
npm install
npm test
npm run migration
npm run dev
```

`npm run migration` applies only SQL files in `supabase/migrations` that have not run yet. Add a new `*.sql` file there and run the same command again.

Demo products and the super admin are separate and safe to repeat:

```bash
npm run seed
```

That runs every file in `supabase/seeders`, then creates the super admin from `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` in `.env`. Those values are required. The password stays in `.env` and is not stored in the repo. A second run does not create another user and does not change the password. Product seeders are not recorded as migrations. Write them so a second run does nothing harmful (`on conflict do nothing`).

Open [http://localhost:3000](http://localhost:3000) and sign in with that email and password. The sidebar shows Super Admin.

- A later **Sign up** does not become Super Admin. The first signup still does, if you have not seeded an admin yet.
- Use **Users** to assign `owner` / `cashier` to later accounts
- Only Super Admin can open **Roles** / **Permissions** and create new ones

## 4. Deploy on Vercel

1. Push this repo to GitHub
2. Import the repo at [vercel.com](https://vercel.com). Framework is Next.js. Leave the build command as `npm run build`.
3. Add environment variables for Production and Preview:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   Do not add the service role key.
4. Deploy, then copy the Vercel URL (for example `https://your-app.vercel.app`).
5. In Supabase **Authentication → URL configuration**, set Site URL to that domain and add `https://your-app.vercel.app/auth/callback` as a redirect URL.
6. Open the Vercel URL, sign up once, and confirm Dashboard loads. The first account becomes Super Admin.

## Main routes

| Route | Purpose |
|-------|---------|
| `/pos` | Sell |
| `/products` | Catalog + images |
| `/sales` | Sales + print receipt |
| `/purchases` | Receive goods + print receipt |
| `/stock` | Manual adjustments |
| `/admin/users` | Assign roles |
| `/admin/roles` | Role × permission matrix (super admin) |
| `/admin/permissions` | Create permissions (super admin) |

## Security notes

- Stock changes only via RPCs: `create_sale`, `create_purchase`, `adjust_stock`
- RLS enforces permissions; UI mirrors them
- Never put the service role key in the browser or `NEXT_PUBLIC_*` vars
