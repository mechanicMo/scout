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

## Before Launch Checklist

- [ ] **Email confirmation** — currently disabled in Supabase (Authentication → Providers → Email → "Confirm email"). Must be re-enabled and a transactional email provider (e.g. Resend) configured before going public.
- [ ] **API deployment** — API runs locally only. Deploy to Railway or Fly.io and update `EXPO_PUBLIC_API_URL`.
- [ ] **App Store / Play Store** — Expo Go is for development only. Need a production build (`eas build`) for distribution.
