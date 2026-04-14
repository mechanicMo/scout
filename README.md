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
Copy `.env.example` to `.env` and fill in the values (Supabase URL/keys, TMDB token).

For the mobile app, set `apps/mobile/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_API_URL=http://<your-local-ip>:3000
```

> Use your machine's local IP (not `localhost`) so your phone can reach the API over WiFi.

---

## Running Locally

Two terminals, both from the repo root:

**Terminal 1 — API server:**
```bash
pnpm --filter @scout/api dev
```
Runs on `http://localhost:3000`.

**Terminal 2 — Mobile dev server:**
```bash
pnpm --filter @scout/mobile start
```
Scan the QR code with Expo Go.

---

## Tests
```bash
pnpm test
```

---

## Building a Standalone APK (Android)

The `preview` EAS profile builds a fully standalone APK — no dev server, no local API, installs on any Android phone on any network. `eas.json` bakes in `EXPO_PUBLIC_API_URL=https://scout-api.mohitr35.workers.dev` at build time.

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

| Service | URL | Notes |
|---|---|---|
| API | `https://scout-api.mohitr35.workers.dev` | Cloudflare Workers — deploy with `cd packages/api && npx wrangler deploy` |
| Supabase | `efklpylddmczsiwgqpgn` | Shared "non-monetized" project, `scout` schema |

---

## Before Launch Checklist

- [ ] **Email confirmation** — Supabase's built-in mailer is unreliable (rate-limited, lands in spam). Configure a transactional email provider (e.g. Resend) in Supabase dashboard → Settings → Auth → SMTP before going public. For dev: manually confirm test accounts via dashboard → Authentication → Users.
- [x] **API deployment** — Deployed to Cloudflare Workers at `https://scout-api.mohitr35.workers.dev`.
- [ ] **App Store / Play Store** — Use `eas build` production profile for App Store / Play Store submission. The `preview` profile (APK) is for internal testing only.
