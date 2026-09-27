# Hours Tracker

A personal work-hours tracker. It shows weekly, biweekly (pay period), and monthly totals, splits hours by job, and estimates pay. Sign-in uses **passkeys** (Touch ID / Face ID), and only a fixed number of devices (default **2**: your laptop and your phone) can ever be registered.

## What's inside
- **Timesheet**: week / pay-period / month view with a jobs × days grid (like a paper timesheet) and a ledger of entries. Tap any entry to edit.
- **Insights**: plain-language comparisons (week over week, month to date vs last month at the same point, pay period so far), next-paycheck estimate, logged-vs-paid check against your stubs, weekly limit, job split, habits. Charts: hours per week by job, logged vs paid per paycheck, hours by weekday. Every chart has a hover tooltip and a table view.
- **History**: your Sep 3–24 shifts (from Google Calendar) and the 9/11 + 9/25 paychecks load automatically the first time you sign in. Settings → Data can re-import them (duplicates skipped) or import a CSV.

## Features
- Add, edit, delete, and copy entries to next week (date, start, end, unpaid break, note)
- One-tap **Clock in / Clock out** per job
- Totals for **This week / Pay period / This month**, with ‹ › to browse past ranges
- Pay-period view split into Week 1 / Week 2, matching the UMass paystub lines
- Per-job hourly rates and estimated pay
- CSV export of any range, handy for checking against HR Direct
- Works as a home-screen app on iPhone (Share → Add to Home Screen)

## Deploy to Vercel (about 10 minutes)

1. **Push this folder to a private GitHub repo.**
   ```bash
   cd hours-tracker
   git init && git add . && git commit -m "Hours tracker"
   gh repo create hours-tracker --private --source=. --push
   ```
2. **Import it in Vercel.** Go to vercel.com → Add New → Project → pick the repo. Leave the framework as Next.js.
3. **Add a database.** In the project, open **Storage** → **Upstash for Redis** (free tier) → Create → connect it to this project. This adds the `KV_REST_API_*` env vars automatically.
4. **Add two environment variables** (Settings → Environment Variables):
   | Name | Value |
   |---|---|
   | `SESSION_SECRET` | output of `openssl rand -base64 32` |
   | `SETUP_CODE` | a long passphrase only you know |
   | `MAX_DEVICES` | *(optional)* defaults to `2` |
5. **Redeploy** (Deployments → ⋯ → Redeploy) so the env vars take effect.
6. **Register your devices** using the **production URL** (e.g. `hours-tracker-sri.vercel.app`), not a preview URL. Passkeys are tied to the exact domain.
   - On your laptop: open the site → enter setup code → Touch ID.
   - On your phone: open the site → "Set up a new device" → setup code → Face ID.
   - After two devices are registered, registration closes. Nobody else can register, even with the code.

## How the device lock works
- Each device creates a passkey in its own secure hardware (Secure Enclave / TPM). The server stores only the public key.
- Registration needs the setup code and is refused once `MAX_DEVICES` is reached.
- A signed-in device gets a 30-day session cookie. Every request also checks that the device is still registered, so **removing a device in Settings signs it out immediately**.
- To replace a device (e.g. a new phone), remove the old one in Settings from your other device, then register the new one with the setup code.
- **Apple note:** if your Mac and iPhone share an Apple ID with iCloud Keychain on, the passkey syncs between them. That still only covers your own Apple devices, and the device count still caps new registrations.

## Local development
```bash
npm install
cp .env.example .env.local   # fill in SESSION_SECRET and SETUP_CODE
npm run dev                   # http://localhost:3000
```
Without Redis env vars, local dev stores data in `.data/db.json`.

## Settings
- **Jobs:** name, hourly rate, color. Defaults are Isenberg TSS and Digital Evidence Lab at $16/hr.
- **Pay period anchor:** any Sunday that starts a pay period. The default, 2026-09-06, matches the 9/6–9/19 stub.
- **Week start:** Sunday (UMass payroll) or Monday.
