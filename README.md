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

The `preview` EAS profile builds a fully standalone APK — no dev server, no local API, installs on any Android phone on any network.

```bash
cd apps/mobile
eas build --platform android --profile preview
```

EAS builds in the cloud. When it finishes you get a download link — install the APK directly on your phone.

**How it works:** `eas.json` overrides `EXPO_PUBLIC_API_URL` at build time to point at the Render deployment (`https://scout-api-3d24.onrender.com`). The local IP in `apps/mobile/.env` is only used during local dev.

> **Note:** The Render API spins down after inactivity (free tier). First request after a cold start can take ~30s. Check it's awake: `curl https://scout-api-3d24.onrender.com/health`

---

## Deployment

| Service | URL | Notes |
|---|---|---|
| API | `https://scout-api-3d24.onrender.com` | Render — auto-deploys on push to main |
| Supabase | `efklpylddmczsiwgqpgn` | Shared "non-monetized" project, `scout` schema |

---

## Before Launch Checklist

- [ ] **Email confirmation** — Supabase's built-in mailer is unreliable (rate-limited, lands in spam). Configure a transactional email provider (e.g. Resend) in Supabase dashboard → Settings → Auth → SMTP before going public. For dev: manually confirm test accounts via dashboard → Authentication → Users.
- [x] **API deployment** — Deployed to Render at `https://scout-api-3d24.onrender.com`.
- [ ] **App Store / Play Store** — Use `eas build` production profile for App Store / Play Store submission. The `preview` profile (APK) is for internal testing only.
