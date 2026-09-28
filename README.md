# Hours Tracker

A personal work-hours tracker. It shows weekly, biweekly (pay period), and monthly totals, splits hours by job, and estimates pay. Sign-in uses **passkeys** (Touch ID / Face ID). Each person has their own private account, and each account is limited to a fixed number of devices (default **2**: laptop and phone).

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
   | `MAX_DEVICES` | *(optional)* passkeys per person, defaults to `2` |
5. **Redeploy** (Deployments → ⋯ → Redeploy) so the env vars take effect.
6. **Register your devices** using the **production URL** (e.g. `hours-tracker-sri.vercel.app`), not a preview URL. Passkeys are tied to the exact domain.
   - On your laptop: open the site → enter setup code → Touch ID.
   - On your phone: open the site → "Set up a new device" → setup code → Face ID.

## Accounts and inviting a friend
- You (the owner) sign up with the setup code. Everyone else joins through an invite link, so a leaked setup code alone can't create accounts for other people.
- Settings → **People** → enter your friend's name → **Invite a friend**. Send them the link (single use, expires in 7 days). They open it, tap **Create my passkey**, and land in their own empty tracker.
- Every account has its own jobs, shifts, paychecks and settings. You can't see theirs and they can't see yours. Your existing data is untouched.
- Settings → People also lets you remove someone. Their passkeys are deleted and they're signed out immediately (their data stays in the database, unreachable).
- Friends can't invite others; they can only add their own devices.

## How the device lock works
- Each device creates a passkey in its own secure hardware (Secure Enclave / TPM). The server stores only the public key.
- Each account is capped at `MAX_DEVICES` passkeys (default 2). Extra devices are added from **Settings → Add another device**, which creates a one-time link for your own account (owners can also still use the setup code).
- A signed-in device gets a 30-day session cookie. Every request also checks that the device is still registered, so **removing a device in Settings signs it out immediately**.
- **Apple note:** if your Mac and iPhone share an Apple ID with iCloud Keychain on, the passkey syncs between them, so the site sees **one** passkey that works on both. That's expected: you're not locked out of either device, and you only use one of your device slots.

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
