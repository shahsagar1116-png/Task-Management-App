# Task Management App

Compliance task tracker for Sagar B Shah & Associates. Built with Next.js, Supabase (Mumbai region) and Vercel. The full requirements are in [CLAUDE.md](CLAUDE.md).

**Status:** Phase 1 of 8 (setup, login, roles).

## Set up (one time)

You need your Supabase and Vercel accounts. Do not paste any key into chat or into the code; keys go only into Vercel's settings.

### 1. Create the Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and click **New project**.
2. Name: `task-management-app`. Database password: click **Generate a password** and save it in your password manager.
3. Region: **South Asia (Mumbai)**. Click **Create new project** and wait about two minutes.

### 2. Create the database tables

1. In the project, open **SQL Editor** (left menu) and click **New query**.
2. Open [`supabase/migrations/0001_phase1_schema.sql`](supabase/migrations/0001_phase1_schema.sql) on GitHub, click the **Copy raw file** button, and paste it into the query box.
3. Click **Run**. You should see "Success. No rows returned".

### 3. Create your own partner login

1. Open **Authentication > Users**, click **Add user > Create new user**.
2. Enter your email and a strong password, keep **Auto Confirm User** ticked, and click **Create user**.
3. Back in **SQL Editor > New query**, paste this line with your own email and name, then click **Run**:

   ```sql
   select public.bootstrap_partner('your@email.com', 'Sagar Shah', 'Sagar B Shah & Associates');
   ```

   It should answer "your@email.com is now partner of Sagar B Shah & Associates".

### 4. Turn off public sign-up

1. Open **Authentication > Sign In / Providers**.
2. Turn **off** "Allow new users to sign up" and click **Save**. Only a partner adds users, from inside the app.

### 5. Put the app on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the `Task-Management-App` GitHub repository (allow Vercel to see it if asked).
2. Before clicking Deploy, open **Environment Variables** and add these three. Copy each value from Supabase **Project Settings** (gear icon):

   | Name | Where to copy it from |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | **Data API** > Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **API Keys** > Publishable key |
   | `SUPABASE_SECRET_KEY` | **API Keys** > Secret keys > reveal and copy |

   (If your project shows "anon" and "service_role" keys instead, use anon for the publishable one and service_role for the secret one.)
3. Click **Deploy**. When it finishes, copy the app's address, for example `https://task-management-app.vercel.app`.

### 6. Tell Supabase the app's address (for password-reset emails)

1. In Supabase open **Authentication > URL Configuration**.
2. Site URL: paste the Vercel address from step 5.
3. Under Redirect URLs click **Add URL** and add the same address followed by `/**`, for example `https://task-management-app.vercel.app/**`. Click **Save**.

## Phase 1 test

1. Open the Vercel address. You land on the sign-in page. Sign in with your partner login.
2. You see the dashboard with "Partner" next to your name, and a **Users** link at the top.
3. Open **Users** and add a staff user: name, email, role **Staff**, and a temporary password.
4. Sign out. Sign in as the staff user. There is no Users link.
5. As staff, type `/settings/users` at the end of the address. You see **Not allowed**. (This is the Phase 1 acceptance test.)
6. Optional: click **Forgot password?** on the sign-in page and check that the reset email arrives and lets you set a new password. Supabase's built-in email sends only a few emails per hour; the firm's own email is set up in a later phase.
7. Optional: as partner, deactivate the staff user, then try signing in as them. It should fail.

## For developers

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev                  # http://localhost:3000
npm run lint && npm run typecheck && npm run test:db && npm run build
```

- `supabase/migrations/`: database schema and Row Level Security. Run new files in order in the SQL Editor.
- `supabase/tests/rls.test.mjs`: checks the security rules on an in-memory Postgres.
- `src/app/(auth)`: sign-in, forgot and reset password. `src/app/(app)`: signed-in pages.
- `src/lib/session.ts`: the signed-in user and role.
