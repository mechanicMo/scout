# Media Detail — Status Button Redesign

**Date:** 2026-04-15
**Status:** Approved — Direction B (primary + overflow sheet)

---

## Problem

The Media Detail screen currently shows up to three vertically-stacked full-width buttons for status actions:

1. `+ Add to Watchlist` / `✓ In Watchlist` (always)
2. `I've seen this` (if not watched)
3. `I'm watching this` (TV only, if not in-progress and not watched)

Plus state-dependent replacements: `✓ Watched · Tap to undo` and `S1 · E3 Tap to edit`.

Mo's testing feedback: "it's too cluttered." Three large buttons compete for attention and don't form a clear hierarchy.

---

## Chosen Direction — Option B: Primary action + overflow sheet

**Always one primary button. A `···` overflow pill (only when saved) opens a bottom sheet with the less-common status actions.**

### States and button labels

| State | Primary button | Overflow `···` sheet contents |
|---|---|---|
| Not saved | `+ Add` (gold) | — (no overflow) |
| Saved, not watching, not watched | `✓ Saved` | Now Watching · Already Seen · Remove |
| In-progress TV (watching) | `▷ S{n} · E{n}` — tap to edit episode | Already Seen · Remove |
| Watched | `✓ Watched` — tap to undo | Remove |

### Interaction details

- **Primary button is always full width**, matching today's `+ Add to Watchlist` button
- **`···` pill** sits to the right of the primary button (same row). Small, rounded, muted. Only visible when the item is saved in some form.
- **Sheet** is a bottom-anchored modal with the listed options. Each option is a row with an icon + label. Tapping an option performs the action and dismisses the sheet.
- **"Now Watching"** from the sheet sets `watchingStatus: 'watching'` with `S1 · E1`
- **"Already Seen"** from the sheet opens the existing `RatingModal` flow
- **"Remove"** removes from watchlist entirely

### State transitions (user flow)

```
[Not saved] ──── + Add ────→ [Saved]
[Saved] ──── ··· → Now Watching ────→ [In-progress]
[Saved] ──── ··· → Already Seen ────→ Rating modal → [Watched]
[In-progress] ──── tap S·E ────→ edit episode modal
[In-progress] ──── ··· → Already Seen ────→ Rating modal → [Watched]
[Watched] ──── tap button ────→ undo → [Saved]
```

### Why B

- Clear primary action in every state
- `···` is a universally understood pattern, no learning curve
- Less cognitive load than three simultaneous buttons
- Status changes are one tap deeper — appropriate since they're less common than the initial save

---

## Alternative Considered — Option C: Single adaptive button

**One button that morphs to always show current state + an action affordance.**

Labels by state:
- Not saved: `+ Save` (gold)
- Saved/not started: `◇ Saved · Set status ▾`
- Watching: `▷ S1 · E3 · Update ▾`
- Seen: `✓ Watched · Rate or undo ▾`

The `▾` always opens a contextual sheet. Always exactly one button on screen.

### Why C was set aside

- Pro: current episode surfaced at a glance — saves a tap when tracking
- Pro: maximum reduction in clutter — one button, always
- Con: `▾` affordance is less universally recognized than `···`
- Con: label changes meaning by state — steeper mental model for new users
- Con: more state-dependent logic in one button = more ways for the UI to feel inconsistent

### When to pivot to C

Pivot if testing reveals:
- Users regularly check the app to look up their current episode (tracking use case dominant over discovery)
- Mo finds himself tapping through to a details screen just to remember where he left off
- The two-tap flow in B (`···` → "Now Watching") becomes the most common action

If we pivot, the sheet infrastructure from B carries over — only the primary button's adaptive labeling changes.

---

## Out of scope

- Movies: B behaves the same as today for movies (no `I'm watching this` button on movies). Only the TV path changes meaningfully.
- Watch history undo flow: kept identical to today's behavior
- RatingModal itself: no changes
