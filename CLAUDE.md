# Scout — Session Start

## Required Reads (in order)

1. `SESSION.md` — current focus, recent work, where to start
2. Current plan file (see SESSION.md for path) — all tasks for active plan

## Context

TV show discovery and tracking app. Web (Next.js) + mobile (Expo). Deployed on Render. Plans 1-3 in progress. Season/episode tracking just added.

**Shared Supabase project (ref: efklpylddmczsiwgqpgn)** — used by 4 apps. Never change project-level settings.

## Google API Billing — Hard Rule

**No non-free tier usage allowed for any Google API in any project under ~/Code.**
Applies to: Gemini models, Firebase, Firestore, Cloud Functions, Cloud Storage, Cloud Run, Vertex AI, and all other Google/GCP services.

- Always use free-tier models (e.g., `gemini-2.0-flash` — never `gemini-2.5-flash` or any paid Gemini variant)
- If free quota is exhausted, stop and surface the issue — do NOT switch to a paid model or tier
- Never enable billing for a new API without explicit approval from Mo
