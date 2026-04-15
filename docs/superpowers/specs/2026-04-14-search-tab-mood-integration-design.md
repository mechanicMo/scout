# Search Tab — Mood Search Integration

**Date:** 2026-04-14  
**Status:** Approved for implementation

---

## Goal

Move mood search out of its own modal stack screen and into the Search tab, alongside title search. The Picks CTA button stays but now jumps to the Search tab in mood mode. The mood section uses a distinct violet/fuchsia gradient header (Direction C) to feel special while still living inside Scout's dark palette.

---

## UI Design

### SearchScreen — mode toggle

A segmented pill control sits between the "Search" header and the content area. Two segments:
- **Titles** — gold background when active, dim text when inactive
- **✦ Mood** — violet→fuchsia gradient when active, dim text when inactive

Active mode controls what renders below the toggle.

### Titles mode (unchanged behavior)

Standard text input + debounced TMDB search results. No changes to existing logic.

### Mood mode — Direction C layout

**Header zone** (replaces the normal input row):
- Rich `linear-gradient(160deg, #1a0930, #0e0520, bg)` background fading to the dark bg
- Bottom border: `rgba(192,38,211,0.2)`
- Row: pill text input (glass-style, `rgba(255,255,255,0.07)` bg, fuchsia border tint) + fuchsia gradient send button with glow

**Body zone** (normal dark bg):
- **History state** (no search selected): "Recent searches" label + history cards + usage counter footer
- **Results state** (search selected): result title + ↻ refresh button in header row + swipeable media cards + Pass/+ buttons

Back navigation within mood mode is internal state only (history → results is `selectedSearchId`, results → history clears it). No stack navigation.

---

## Component Architecture

### New: `MoodSearchContent` component

Extract all mood search logic from `MoodSearchScreen` into a standalone component:

```
apps/mobile/src/components/MoodSearchContent.tsx
```

Props: none (self-contained, uses its own tRPC hooks).

Handles internally:
- `selectedSearchId` state (history vs results view)
- All tRPC hooks (history, search mutation, results, refresh, watchlist, dismiss, rating)
- DismissSheet + RatingModal
- SwipeableCard (copy the MoodSearchScreen local version)
- Usage counter footer

No `navigation` prop — the "← Back" button from the old screen becomes an internal "← Back" that clears `selectedSearchId`.

### Updated: `SearchScreen`

- Accepts route params: `{ initialMode?: 'mood' }`
- State: `mode: 'titles' | 'mood'`, initialized from `route.params?.initialMode ?? 'titles'`
- Renders the segmented toggle, then either the existing title search UI or `<MoodSearchContent />`
- Uses `useFocusEffect` to switch to mood mode when the screen receives `initialMode: 'mood'` params on re-focus (handles the Picks CTA tap)

### Updated: `PicksScreen`

Change the mood button `onPress` from:
```typescript
navigation.navigate('MoodSearch')
```
to:
```typescript
navigation.getParent()?.navigate('Search', { initialMode: 'mood' })
```

### Navigator cleanup

- Remove `MoodSearch` from `RootStackParamList` in `MainNavigator.tsx`
- Remove the `MoodSearch` stack screen registration
- Remove `MoodSearchScreen` import from `MainNavigator`
- Define `TabParamList` in `TabNavigator.tsx` with `Search: { initialMode?: 'mood' } | undefined`
- `MoodSearchScreen.tsx` — delete the file (logic lives in `MoodSearchContent` now)

---

## Bug fix: spinner on recent search tap

`enrichRecs` in `moodSearch.ts` fetches items sequentially in a `for` loop. On Cloudflare Workers with the Supabase pooler, 10 sequential DB round-trips can exceed response time limits, causing the indefinite spinner.

**Fix:** Replace the sequential loop with `Promise.all`:

```typescript
async function enrichRecs(...): Promise<MediaItem[]> {
  const results = await Promise.all(
    recList.map(rec => getOrFetchMedia(rec.tmdbId, rec.mediaType as 'movie' | 'tv', tmdbToken))
  )
  return results.filter((m): m is MediaItem => m !== null)
}
```

This applies to both `moodSearch.ts` and anywhere else `enrichRecs` is called.

---

## Files changed

| File | Change |
|---|---|
| `apps/mobile/src/components/MoodSearchContent.tsx` | New — extracted mood search logic |
| `apps/mobile/src/screens/SearchScreen.tsx` | Add toggle + render MoodSearchContent in mood mode |
| `apps/mobile/src/screens/PicksScreen.tsx` | Update CTA navigation (counter already removed) |
| `apps/mobile/src/navigation/MainNavigator.tsx` | Remove MoodSearch stack screen |
| `apps/mobile/src/navigation/TabNavigator.tsx` | Add TabParamList type with Search params |
| `apps/mobile/src/screens/MoodSearchScreen.tsx` | Delete |
| `packages/api/src/routers/moodSearch.ts` | Parallelize enrichRecs |

---

## Out of scope

- Web tab (apps/web) — not wired up yet, skip
- MoodSearchContent visual polish (fuchsia vibes per Direction C) — included in this plan as part of the component build
