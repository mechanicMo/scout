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

**Intent:** User describes a vibe. Return titles that match it. Relevance matters more than popularity, but results should still be recognizable titles.

**Pipeline:**

```
User mood query ("something cozy and nostalgic for a rainy night")
    → [If query > 40 chars] Groq summarizes to a short title (e.g., "Cozy Nostalgic Rainy Night")
    → TMDB Discover: fetch top 30 movies sorted by popularity.desc
    → TMDB Discover: fetch top 30 TV shows sorted by popularity.desc
    → Merge: 60 candidates total [movie_1 ... movie_30, tv_1 ... tv_30]
    → Groq (llama-3.3-70b-versatile): rank and filter by mood relevance
        - Input: mood string + up to 60 candidates (tmdbId, title, overview)
        - Output: ordered list of tmdbIds, filtered to best matches only
    → Save: ranked IDs stored in mood_searches.result_tmdb_ids
    → Cache: all 60 candidates upserted into media_cache (so history loads work)
    → Return: full media objects in ranked order
```

**Signals used:** This is a two-stage system — not a blend, by design:

| Stage | Signal | Purpose |
|---|---|---|
| Stage 1 (candidate selection) | TMDB popularity | Ensures pool contains recognizable titles only |
| Stage 2 (Groq ranking) | LLM mood relevance | Final ordering is purely about mood fit |

**Why not a weighted blend?** A blend would penalize niche-but-perfect matches. If you ask for "80s synth noir cyberpunk thriller" and the best matching film is less popular than The Dark Knight, the blend would rank The Dark Knight above it despite it not matching the mood at all. The current design ensures the pool is recognizable (popularity floor), then optimizes purely for mood fit within that pool.

**Popularity role in final output:** Zero direct weight. A title ranked #1 by Groq could be at position 55 in the candidate pool's popularity order. Groq doesn't see popularity scores — it only sees title and overview.

**Groq prompt (paraphrased):**
> "You rank titles by how well they match a mood description. Return { ranked: number[] } — array of tmdbIds in best-to-worst order. Include only titles that match the mood well."

**Known limitation — candidate pool size:** We fetch 30 movies + 30 TV = 60 candidates, drawn from the globally most popular titles at that moment. This means:
- Very good mood-matched titles that aren't currently trending won't appear
- The ↻ refresh button fetches a *different random page* (1-5) of popular titles to introduce variety

**Refresh (`mood-search-refresh`):** Uses the same original query text but fetches a new random page of candidates, re-ranks, and stores the updated IDs. This is how you get different results without spending a new rate-limit credit... except it does actually log a usage event (the rate limit counts searches + refreshes combined at 3/day total).

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
| Mood search (Stage 1) | Candidate selection | No | TMDB popularity (floor) |
| Mood search (Stage 2) | Not used | Yes (Groq LLaMA) | LLM mood relevance |
| AI recs | Not used | Yes (Groq LLaMA) | Taste profile + history |
| Trending picks | TMDB trending | No | TMDB weekly trending |

---

## 7. If You Want to Change the Ranking

**Add popularity weighting to mood search final output:**
In `_shared/groq.ts`, pass `popularity` as a field in each candidate object and update the system prompt to instruct Groq to blend mood relevance and popularity. This gives Groq the signal to use; whether it actually uses it well depends on the model.

**Expand the mood search candidate pool:**
Increase the page count in `mood-search/index.ts` from 30 per type to more, and update the slice limit in `groq.ts` accordingly. Trade-off: larger prompts = higher latency + cost.

**Make title search relevance-first:**
Remove the `.sort((a, b) => b.popularity - a.popularity)` line in `tmdb-search/index.ts` to trust TMDB's native relevance ordering.

**Add vote_average as a quality signal:**
TMDB also returns `vote_average` (0-10 critic/audience score). This could be used alongside popularity to surface "critically acclaimed but not trending" titles. Currently not used in any ranking.
