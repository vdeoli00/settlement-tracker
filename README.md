# Settlement Tracker

Personal tracker for open class action settlements. Filters to no-proof claims and to brands/services you list, tracks what you filed and what got paid, and exports deadline reminders to your calendar.

## Setup (one time)

Settings → Pages → Build and deployment → Source: **GitHub Actions**. Then Actions → "Update settlements and deploy" → Run workflow. Site: https://vdeoli00.github.io/settlement-tracker/

## How it updates

A GitHub Action runs every 6 hours:

1. `scripts/update.py` pulls the open-settlement directory from [OpenClassActions](https://openclassactions.com/llms.txt) and the open-settlements RSS feed from [Top Class Actions](https://topclassactions.com/).
2. It classifies each one (no proof / ID from notice / documentation / automatic), extracts deadline and payout, merges duplicates, drops expired ones, and writes `data/settlements.json`.
3. The site is redeployed to GitHub Pages.

If a source fails or changes format, the last good data for that source is kept and the page shows a warning.

Run locally: `python3 scripts/update.py && python3 -m http.server` then open http://localhost:8000.

## Accounts, sync and privacy

- Signed out, your profile and claim statuses live only in your browser's localStorage.
- Signed in (email magic link via Supabase), they sync to a `user_data` row that row-level security limits to your account.
- The claim-info vault (name, address, payment handles) is encrypted in the browser with AES-GCM using a key derived from your passphrase (PBKDF2, 310k iterations). Only ciphertext is stored or synced. A lost passphrase cannot be recovered.
- `config.js` holds the Supabase URL and publishable key, which are designed to be public.
- The update job pings Supabase every 6 hours so the free project is not paused.

## Notes

- Proof and payout labels are parsed automatically from source text. Confirm on the official settlement site before filing.
- Only file claims you qualify for; claim forms are signed under penalty of perjury.
