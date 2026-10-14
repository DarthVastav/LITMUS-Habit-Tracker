# Litmus — deploy guide

Tasks, classes, assignments and habits reduced to one 0–100 reading — and the
whole interface changes colour with the result, the way litmus paper does.

A React + Vite PWA on Cloudflare Workers, with Supabase for auth, data and
push reminders. No server to run and no OTP table of your own.

---

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com). Note the project URL.
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
   It's idempotent, so re-running it later is safe.
3. **Authentication → Sign In / Providers → Email**: turn the provider on,
   and turn **Confirm email** on so codes are issued.
4. **Authentication → Emails → Templates → Magic Link**: the default template
   sends a link, not a code. Make sure the body contains `{{ .Token }}` so the
   6-digit code is visible, e.g.

   ```html
   <h2>Your Litmus code</h2>
   <p style="font-size:28px;letter-spacing:8px"><b>{{ .Token }}</b></p>
   <p>It expires in an hour. If you didn't ask for this, ignore this email.</p>
   ```

   Supabase's built-in mailer is rate-limited to a handful of emails per hour.
   For real use, add SMTP under **Project Settings → Authentication → SMTP**
   (Resend, Postmark, SES — any of them).
5. **Project Settings → API**: copy the **Project URL**, the **anon** key, and
   the **service_role** key. The service_role key goes in only as a Worker
   secret — never into anything prefixed `VITE_`.

## 2. VAPID keys

```bash
npm install
npm run vapid
```

Keep both. The public key is safe in the browser; the private one is a secret.

## 3. Cloudflare

```bash
npx wrangler login
```

**Build-time values.** Vite bakes `VITE_*` into the bundle at build time, so
these come from a local `.env`, not from Cloudflare:

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and
`VITE_VAPID_PUBLIC_KEY`. All three end up publicly readable in the JS bundle by
design — the anon key is safe because RLS does the real work.

**Runtime secrets.** Read by the Worker; never in the bundle or in git:

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT      # mailto:you@yourdomain.com
npx wrangler secret put REMINDER_TEST_KEY  # any random string, for step 4
```

Then deploy:

```bash
npm run deploy
```

That runs `vite build` and `wrangler deploy` together, and gives you a
`https://litmus.<your-subdomain>.workers.dev` URL.

## 4. Check it works

1. Open the site, enter a name and email, tap **Continue with email**.
2. The code arrives by email; a wrong one lands on the "Invalid login" screen.
3. **Settings → Reminders**: toggling one on triggers the browser notification
   prompt and writes a row to `push_subscriptions`.
4. **Timetable → Choose file**: upload the master Excel, then tap your course
   chips. Upload the mess sheet on the Mess tab.
5. Reminders run every 15 minutes. To test without waiting:

   ```
   https://YOUR-WORKER-URL/__run-reminders?key=YOUR_REMINDER_TEST_KEY
   ```

   Returns `{"queued":2,"sent":2,"skipped":0,"pruned":0}`. It 404s without the
   right key, so it isn't a public endpoint. Logs: `npx wrangler tail`.

---

## How the pieces fit

**Auth.** Supabase Auth issues and verifies the OTP itself
(`signInWithOtp` → `verifyOtp`), so there's no code table to build or expire.
A trigger on `auth.users` creates the matching `profiles` row on first sign-in.

**Data.** Every user-owned table has RLS with `user_id = auth.uid()`, so the
anon key is safe in the browser. Timetable and mess data are shared: any
signed-in user can read them, and whoever uploads a sheet replaces them.

**Hosting.** One Worker does both jobs. `[assets]` in `wrangler.toml` serves
the built site from Cloudflare's edge, and `not_found_handling =
"single-page-application"` is what makes client-side routing work. The Worker's
`fetch` handler only sees requests the asset router didn't match.

**Reminders.** `worker/index.js` exports a `scheduled` handler on a
`*/15 * * * *` cron trigger. Each pass looks for three things — habit
reminder times landing in this window with habits still unchecked, sessions
starting in ~30 minutes for users who picked that course, and assignments
whose runway opens today (sent in the first pass after 08:00 local). Times are
evaluated in each user's `profiles.timezone`, which defaults to `Asia/Kolkata`.

Every send first claims a row in `reminders_sent`; the unique constraint on
`(user_id, kind, ref, slot)` is what makes a repeat impossible, so overlapping
runs or a retried invocation can't double-notify. Subscriptions that return
404/410 are deleted automatically.

**Push encryption.** The usual `web-push` package is Node-only and won't run
on Workers, so `worker/webpush.js` implements RFC 8291 (aes128gcm payload
encryption) and RFC 8292 (ES256 VAPID signing) directly on Web Crypto. Run
`node verify-push.mjs` to cross-check it against `http_ece`, an independent
implementation: it confirms the encrypt/decrypt round trip, that a tampered
ciphertext is rejected, and that the VAPID JWT verifies.

**Offline.** The service worker caches the app shell, and the store keeps a
localStorage mirror per user, so a cold start without a network shows the last
synced data instead of an empty screen. Writes apply optimistically and toast
if they don't reach the server.

---

## Running locally

```bash
cp .env.example .env    # fill in the VITE_* values
npm install
npm run dev             # plain Vite, no Worker
npm run cf:dev          # builds, then runs the Worker + assets + cron locally
```

Without `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` the app starts in
**local-only mode**: no OTP is sent, sample data is seeded from
`src/data/appData.js`, and everything stays in that browser. Handy for design
work. To remove it once you're live, delete `src/data/seed.js` and
`src/data/appData.js` and drop the import in `src/store/useStore.js`.

Push needs HTTPS, so test notifications on the deployed Worker URL rather
than `localhost`.

## Regenerating the icons

`public/icon-192.png`, `icon-512.png` and `apple-touch-icon.png` are generated
from the score-ring motif:

```bash
python3 scripts/make-icons.py
```

## Project layout

```
src/lib/        theme (hue → CSS vars), dates, supabase, push, excel, db
src/store/      zustand store + pure selectors (score, plans, grids)
src/screens/    Auth, Home, Tasks, Timetable, Assignments, Habits, Settings, About
src/ui/         dropdown, toggle, checkbox, toast, bottom nav
public/sw.js      app-shell cache + push handler
worker/index.js   asset serving + the cron reminder dispatcher
worker/webpush.js RFC 8291/8292 on Web Crypto
supabase/         schema.sql — tables, enums, RLS, triggers
wrangler.toml     Worker config, assets binding, cron trigger
```

The scoring rules live in one place, `src/store/selectors.js`:
a rolling 30-day completion reading:
`30·tasks + 45·habits + 25·assignments` over the measured weight, minus an
escalating overdue penalty (3 first day, +2/day, cap 12/task, 20 total) —
no smoothing layer; every tick moves it symmetrically,
and `src/lib/theme.js` turns that score into the hue every colour derives from.
