# Settled

Personal app for tracking open class action settlements: find the ones you qualify for (no-proof first), file faster with one-tap copy of your claim info, and log every payout.

Live: https://vdeoli00.github.io/settlement-tracker/ (installable: Share → Add to Home Screen)

## Features

- **Home dashboard**: no-proof money matching your profile, received / pending totals, ending-soon rail, matches, new this week.
- **Browse**: instant search, filters (no proof, for you, ending soon, new, all), categories, sort, incremental rendering.
- **Detail sheet**: deadline countdown, payout, proof rules, "I've filed this claim" check with confirmation number and expected payout, payment logging (amount, date, method), notes, calendar reminder, quick-copy claim info.
- **Filing flow**: after you open a claim form and come back, the app asks if you finished and records it.
- **My claims**: Filed → Paid pipeline, received total, payout rate, CSV export.
- **Settings**: account, light/dark/auto theme, brands and state, list filters, encrypted claim info, backup/restore, data source status.
- **PWA**: offline support, installable, update prompt, pull-to-refresh.

## How it's built

- Static site on GitHub Pages; vanilla ES modules, no framework or build step. `css/app.css` holds the design system (tokens, light/dark, motion with reduced-motion support).
- `scripts/update.py` (GitHub Action, every 6h) pulls OpenClassActions' directory and Top Class Actions' RSS feed, classifies proof requirements, merges duplicates, tracks `first_seen`, drops expired items, and writes `data/settlements.json`.
- The deploy job stamps a build id into asset URLs and the service worker for cache busting.

## Accounts, sync and privacy

- Signed out, everything is stored in this browser only.
- Signed in (email + password via Supabase), profile and claim records sync to a `user_data` row protected by row-level security.
- Claim info is AES-GCM encrypted in the browser with a key derived from your password (PBKDF2, 310k iterations) and cached per device as a non-exportable key. Only ciphertext is stored. Resetting your password makes old claim info unreadable.
- Supabase's client is vendored (`vendor/`) and loaded only when needed. A strict Content-Security-Policy allows scripts only from this site and network calls only to this site and the Supabase project.
- `config.js` holds the Supabase URL and publishable key, which are designed to be public.
- The update job pings Supabase every 6 hours so the free project isn't paused.

## Local development

```
python3 scripts/update.py      # refresh data
python3 -m http.server         # then open http://localhost:8000
```

Only file claims you qualify for; claim forms are signed under penalty of perjury.
