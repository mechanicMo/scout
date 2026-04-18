# Scout

Finds what's worth your time.

## Dev Setup

### Prerequisites
- Node 20+
- pnpm

### Install
```bash
pnpm install
```

### Environment

The mobile app connects directly to Supabase — no local API server needed. Create `apps/mobile/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://efklpylddmczsiwgqpgn.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key from Supabase dashboard>
```

These are also baked into standalone APK builds via `apps/mobile/eas.json`.

---

## Running Locally

One terminal from the repo root:

```bash
pnpm --filter @scout/mobile start
```

Scan the QR code with Expo Go. The app talks directly to Supabase (DB queries) and Supabase Edge Functions (AI recs, search, survey). No local API server to run.

> **Edge Functions** live in `supabase/functions/`. To iterate on them locally, use `supabase functions serve` (requires Docker). For most changes, deploy directly: `supabase functions deploy <name>`.

---

## Tests
```bash
pnpm test
```

---

## Building a Standalone APK (Android)

The `preview` EAS profile builds a fully standalone APK — no dev server needed, installs on any Android phone on any network. `eas.json` bakes in the Supabase URL and anon key at build time.

### Option A — Local build (recommended, no quota, no queue)

Requires Android Studio installed.

```bash
cd apps/mobile
eas build --local --platform android --profile preview
```

Outputs an `.apk` file in the current directory. Install it:

```bash
adb install <path-to-file>.apk
```

### Option B — EAS cloud build (15/month free tier limit)

```bash
cd apps/mobile
eas build --platform android --profile preview
```

EAS builds in the cloud (~5-10 min). When it finishes you get a download link — install the APK directly on your phone.

---

## Deployment

| Service | Where | Notes |
|---|---|---|
| Edge Functions | Supabase — `efklpylddmczsiwgqpgn` | Deploy with `supabase functions deploy <name>` from repo root |
| Database | Supabase — `scout` schema | Migrations in `supabase/migrations/` — apply with `supabase db push` |

---

## Before Launch Checklist

- [ ] **Email confirmation** — Supabase's built-in mailer is unreliable (rate-limited, lands in spam). Configure a transactional email provider (e.g. Resend) in Supabase dashboard → Settings → Auth → SMTP before going public. For dev: manually confirm test accounts via dashboard → Authentication → Users.
- [x] **Edge Functions** — All functions deployed to Supabase (`picks-trending`, `picks-ai-recs`, `survey-next`, `tmdb-get-media`, `tmdb-generate-tags`, `tmdb-search`, `mood-search`, `mood-search-refresh`).
- [ ] **App Store / Play Store** — Use `eas build` production profile for App Store / Play Store submission. The `preview` profile (APK) is for internal testing only.
