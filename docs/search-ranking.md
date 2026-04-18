# Scout — Search & Ranking Systems

Last updated: 2026-04-18

This document explains how Scout ranks results across its three discovery surfaces: title search, mood search, and picks. It covers where scores come from, what signals are used, and how the pipeline works end to end.

---

## 1. What is TMDB Popularity?

Every title in TMDB has a `popularity` float that TMDB recalculates daily. It is a composite of:

- **Page views** on TMDB (people looking up the title)
- **Vote count and vote rate** (how many ratings are being submitted recently)
- **List adds / watchlist activity** on TMDB
- **Time decay** — recent activity is weighted more heavily than older activity

It is NOT a quality rating. A bad movie can have high popularity if it just released. A critically acclaimed older film can have low popularity if no one is actively searching for it. Popularity captures *current public attention*, not enduring quality.

Example ranges:
- Trending blockbuster during release week: 500-2000+
- Established popular series (Breaking Bad): 80-200
- Solid but niche film: 5-30
- Obscure/older title: < 5

---

## 2. Title Search (`tmdb-search`)

**Intent:** User knows what they want. Prioritize exact matches and well-known titles.

**Pipeline:**

```
User query ("the bear")
    → TMDB /search/multi
        → TMDB returns results sorted by their own relevance algorithm
            (text match quality weighted by popularity)
    → Filter: only media_type === 'movie' | 'tv'
    → Re-sort: by popularity DESC
    → Return to client
```

**Signals used:** TMDB `popularity` only (at the re-sort step).

**Trade-off:** Re-sorting entirely by popularity overrides TMDB's text-relevance signal. A perfect exact-title match with low popularity (niche film) will rank below a popular tangential result. This is an intentional choice — for a general discovery app, popular results are usually what the user wants. If we wanted pure text relevance, we'd remove the sort and trust TMDB's default order.

**What TMDB's default order does:** It weights results by a blend of text match quality and popularity. Removing our sort and trusting TMDB would give you something like "popularity-adjusted relevance."

---

## 3. Mood Search (`mood-search`, `mood-search-refresh`)

**Intent:** User describes a vibe. Return titles that match it. The system extracts structured intent from the query to build a targeted candidate pool, then uses Groq to rank by mood fit within that pool.

**Pipeline:**

```
User mood query ("something cozy and nostalgic for a rainy night")

Stage 1: Groq extractMoodIntent() — low temperature (0.1), deterministic
    - Extracts: genres[], yearMin/yearMax, mediaType ('movie'|'tv'|'both'), keywords[]
    - e.g. { genres: ["Drama", "Family"], yearMin: 1985, yearMax: 2000,
             mediaType: "both", keywords: ["cozy", "nostalgic"] }

Stage 2: TMDB Discover with targeted params
    - Genre IDs via OR logic (MOVIE_GENRE_IDS / TV_GENRE_IDS maps in _shared/tmdb.ts)
    - Year range applied if present
    - vote_count.gte=30 to filter noise
    - Sorted by popularity.desc within the targeted set
    - mediaType controls fetch: 'movie' → 60 movies only, 'tv' → 60 TV only,
      'both' → 30 movies + 30 TV

Stage 3: Server-side exclusion filter
    - Edge function queries watch_history + dismissed watchlist items for the user
    - Removes those IDs from candidates before ranking
    - Saved (non-dismissed) watchlist items are NOT excluded — user wants to watch them

Stage 4: Progressive fallback (if filtered results < 8)
    - Level 1: drop year range, keep genres
        → searchBroadened: "No exact matches for [era] — showing similar titles from any year"
    - Level 2: drop genres too, keep year if present
        → searchBroadened: "Couldn't find exact genre matches — showing popular titles from that era instead"
    - Level 3: full fallback, no filters
        → searchBroadened: "Couldn't find close matches — showing popular titles instead"
    - Client receives searchBroadened: { reason: string } when any fallback fires
    - Shown as a subtle gold banner below the results header

Stage 5: Groq rankTitlesByMood() — ALWAYS runs (not conditional)
    - Input: mood string + candidates (tmdbId, title, overview) + intent.keywords
    - keywords give Groq tone context (e.g. "cozy", "nostalgic") within the pool
    - Output: ordered list of tmdbIds, filtered to best matches only

    → Save: ranked IDs stored in mood_searches.result_tmdb_ids
    → Cache: all candidates upserted into media_cache (so history loads work)
    → Return: full media objects in ranked order
```

**Signals used:** This is a five-stage system. Each stage has a distinct role:

| Stage | Signal | Purpose |
|---|---|---|
| Stage 1 (intent extraction) | Groq LLaMA, temp 0.1 | Parse genres, year range, mediaType, keywords from free-text query |
| Stage 2 (candidate selection) | TMDB Discover + popularity | Fetch targeted, recognizable titles matching extracted intent |
| Stage 3 (exclusion filter) | User watch_history + dismissed items | Remove already-seen or dismissed titles server-side |
| Stage 4 (progressive fallback) | Result count threshold | Widen constraints gracefully if targeted pool is too small |
| Stage 5 (Groq ranking) | LLM mood relevance + keywords | Final ordering purely by mood and tone fit |

**Why targeted Discover instead of a generic popularity pool?** The old approach fetched the top 60 globally popular titles and asked Groq to filter them. This meant a query for "80s synth noir cyberpunk thriller" would get the same starting pool as a query for "feel-good family comedy" — the globally trending titles of the week. By extracting structured intent first and using TMDB Discover's filters, the candidate pool is directly relevant to the query before Groq ever sees it.

**Why not a weighted blend at the ranking step?** A blend would penalize niche-but-perfect matches. If you ask for "slow-burn 70s paranoia thriller" and the best matching film is less popular than a generic blockbuster, a blend would rank the blockbuster above it despite it not matching the mood. Stage 5 uses pure mood fit within an already-targeted pool.

**Popularity role in final output:** Zero direct weight. A title ranked #1 by Groq could be at position 55 in the candidate pool's popularity order. Groq doesn't see popularity scores — it only sees title, overview, and the extracted keywords.

**Genre ID mapping:** `_shared/tmdb.ts` contains `MOVIE_GENRE_IDS` and `TV_GENRE_IDS` reverse maps (genre name string → TMDB numeric ID). Cross-type aliases handle cases where the same genre label maps to different IDs by media type (e.g. "Action" → 28 for movies, 10759 for TV). `getGenreIds()` resolves a genre name against the correct map for the requested mediaType.

**Refresh (`mood-search-refresh`):** Re-extracts intent from the stored original query (same deterministic extractMoodIntent call), then fetches a random page 2-4 of the same targeted Discover query. This introduces variety by pulling a different slice of the genre/year-filtered pool rather than re-fetching the same page-1 results. Rate limit: searches + refreshes combined count toward the 3/day total.

---

## 4. Picks — AI Recs (`picks-ai-recs`)

**Intent:** Proactive personalized recommendations based on taste profile. No user query — pure profile matching.

**Pipeline:**

```
User's taste_profile (liked_genres, disliked_genres, liked_themes, services, notes)
    + Recent watch_history (up to 20 items with scores and tags)
    → Groq (llama-3.3-70b-versatile): generate 10-15 recommendations
        - Returns: [{ tmdbId, mediaType }]
    → TMDB: fetch full details for each recommended ID
    → Cache: upsert into media_cache
    → Filter: remove already-watched and watchlisted titles
    → Return
```

**Signals used:** Taste profile + watch history, processed by LLM. No TMDB popularity used — Groq recommends specific IDs directly.

**Rate limit:** 1/day for free tier users.

---

## 5. Picks — Trending (`picks-trending`)

**Intent:** Surface what's popular right now, minus what the user has already seen or dismissed.

**Pipeline:**

```
TMDB /trending/all/week
    → Normalize to TMDBMedia objects
    → Filter: remove already-watched and watchlisted titles (fetched from DB)
    → Return top 20
```

**Signals used:** TMDB trending algorithm (popularity + recency). No AI involved.

---

## 6. Summary Table

| Surface | Popularity Used | AI Used | Primary Signal |
|---|---|---|---|
| Title search | Re-sort by popularity | No | TMDB popularity |
| Mood search (Stage 1) | No | Yes (Groq, temp 0.1) | Structured intent extraction |
| Mood search (Stage 2) | Targeted candidate selection | No | TMDB Discover (genre + year filter) |
| Mood search (Stage 3) | No | No | User exclusion filter (server-side) |
| Mood search (Stage 4) | No | No | Progressive fallback on result count |
| Mood search (Stage 5) | No | Yes (Groq LLaMA + keywords) | LLM mood relevance |
| AI recs | Not used | Yes (Groq LLaMA) | Taste profile + history |
| Trending picks | TMDB trending | No | TMDB weekly trending |

---

## 7. If You Want to Change the Ranking

**Add popularity weighting to mood search final output:**
In `_shared/groq.ts`, pass `popularity` as a field in each candidate object and update the system prompt to instruct Groq to blend mood relevance and popularity. This gives Groq the signal to use; whether it actually uses it well depends on the model.

**Expand the mood search candidate pool:**
Increase the per-type fetch limit in `mood-search/index.ts` (currently 30 per type, 60 for single type). Trade-off: larger prompts = higher latency + cost.

**Make title search relevance-first:**
Remove the `.sort((a, b) => b.popularity - a.popularity)` line in `tmdb-search/index.ts` to trust TMDB's native relevance ordering.

**Add vote_average as a quality signal:**
TMDB also returns `vote_average` (0-10 critic/audience score). This could be used alongside popularity to surface "critically acclaimed but not trending" titles. Currently not used in any ranking.

**Adjust the fallback threshold:**
The progressive fallback triggers at < 8 results. To tolerate narrower pools before widening, lower this threshold in `mood-search/index.ts`.
