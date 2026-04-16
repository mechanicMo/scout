# UI Feedback Batch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three independent UI fixes from testing feedback: unify the mood search input style with titles search, allow multi-select on some survey questions, and replace the cluttered triple-button status area on Media Detail with a primary-button-plus-overflow-sheet pattern (Option B from the design doc at `docs/superpowers/specs/2026-04-15-media-detail-status-redesign.md`).

**Architecture:** Task 1 edits `MoodSearchContent.tsx` styles only — no prop or API changes. Task 2 extends the `SurveyQuestion` type with an optional `multiSelect` flag, updates the API to accept either a string or a comma-joined string, and widens `SurveyCard` to handle both modes. Task 3 introduces a new `StatusSheet` component (modeled on `DismissSheet`) and replaces three standalone buttons in `MediaDetailScreen` with one adaptive primary button and a `···` overflow pill.

**Tech Stack:** React Native (Expo), TypeScript, tRPC, React Query, `expo-linear-gradient`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/mobile/src/components/MoodSearchContent.tsx` | Modify | Remove send button, change input to rectangular style matching titles search |
| `packages/shared/src/types.ts` | Modify | Add `multiSelect?: boolean` to `SurveyQuestion` |
| `packages/api/src/routers/survey.ts` | Modify | Mark some seed questions multi-select, keep submit as single string (joined by `", "`) |
| `apps/mobile/src/components/SurveyCard.tsx` | Modify | Support multi-select mode (checkboxes + confirm button) |
| `apps/mobile/src/screens/PicksScreen.tsx` | Modify | Pass `multiSelect` flag to `SurveyCard` |
| `apps/mobile/src/components/StatusSheet.tsx` | **Create** | Bottom-sheet modal with status action options |
| `apps/mobile/src/screens/MediaDetailScreen.tsx` | Modify | Replace 3 status buttons with primary + overflow pill + StatusSheet |

---

## Task 1: Unify mood search input with titles search style

**Files:**
- Modify: `apps/mobile/src/components/MoodSearchContent.tsx`

Remove the standalone send button. Change the input shape from fully-rounded pill to the rectangular `radius.md` rounded-corners style used by the titles search input. Keep fuchsia color accents (border). Submit still works via keyboard return key (`onSubmitEditing` already wired up).

- [ ] **Step 1: Remove the send button TouchableOpacity and its inner LinearGradient**

Find the block inside the `LinearGradient` header (around line 300, the `<View style={styles.inputRow}>` block). The current structure is:

```tsx
<View style={styles.inputRow}>
  <TextInput ... />
  <TouchableOpacity
    style={[styles.sendButtonWrapper, (!searchText.trim() || searchMutation.isPending) && styles.sendButtonDisabled]}
    onPress={handleSearch}
    disabled={!searchText.trim() || searchMutation.isPending}
  >
    <LinearGradient
      colors={['#7c3aed', '#c026d3']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.sendButton}
    >
      {searchMutation.isPending
        ? <ActivityIndicator size="small" color="white" />
        : <Text style={styles.sendText}>→</Text>}
    </LinearGradient>
  </TouchableOpacity>
</View>
```

Replace the entire `<View style={styles.inputRow}>` block with:

```tsx
<View>
  <TextInput
    style={styles.input}
    placeholder="Tell Scout what you're in the mood for..."
    placeholderTextColor="rgba(255,255,255,0.3)"
    value={searchText}
    onChangeText={(text) => { setSearchText(text); setSearchError(null) }}
    editable={!searchMutation.isPending}
    onSubmitEditing={handleSearch}
    returnKeyType="search"
  />
  {searchMutation.isPending && (
    <ActivityIndicator size="small" color={colors.gold} style={styles.inlineSpinner} />
  )}
</View>
```

The `inlineSpinner` replaces the visual loading feedback the send button used to provide.

- [ ] **Step 2: Update the `input` style and remove now-unused styles**

In the `StyleSheet.create` block (around line 404), find:

```typescript
inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
input: {
  flex: 1,
  backgroundColor: 'rgba(255,255,255,0.07)',
  borderRadius: radius.pill,
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.md,
  color: colors.text,
  fontSize: 14,
  borderWidth: 1,
  borderColor: 'rgba(192,38,211,0.3)',
},
sendButtonWrapper: { ... },
sendButtonDisabled: { opacity: 0.4 },
sendButton: { ... },
sendText: { color: 'white', fontSize: 16, fontWeight: '700' },
```

Replace with:

```typescript
input: {
  backgroundColor: colors.surfaceRaised,
  borderWidth: 1,
  borderColor: 'rgba(192,38,211,0.4)',
  borderRadius: radius.md,
  padding: spacing.md,
  color: colors.text,
  fontSize: 15,
},
inlineSpinner: {
  position: 'absolute',
  right: spacing.md,
  top: '50%',
  marginTop: -10,
},
```

This mirrors the titles search `input` style (surfaceRaised bg, `radius.md`, same padding, same font size) but keeps the fuchsia border tint so the mood identity reads through.

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/mohitramchandani/Code/scout && npx tsc --noEmit 2>&1 | grep -i "MoodSearchContent"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
cd /Users/mohitramchandani/Code/scout
git add apps/mobile/src/components/MoodSearchContent.tsx
git commit -m "feat: unify mood input style with titles search — remove send button, rectangular input with fuchsia accent"
```

---

## Task 2a: Add multiSelect flag to SurveyQuestion type

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Extend the SurveyQuestion type**

Find (around line 80):

```typescript
export interface SurveyQuestion {
  question: string
  options: string[]
}
```

Replace with:

```typescript
export interface SurveyQuestion {
  question: string
  options: string[]
  multiSelect?: boolean
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mohitramchandani/Code/scout
git add packages/shared/src/types.ts
git commit -m "feat: add optional multiSelect flag to SurveyQuestion type"
```

---

## Task 2b: Mark seed questions and update submit mutation

**Files:**
- Modify: `packages/api/src/routers/survey.ts`

Add a new multi-select seed question and mark the existing genre question as multi-select. Keep the submit mutation accepting a single string — for multi-select, the client joins selections with `", "` before submitting, so no DB schema change is needed.

- [ ] **Step 1: Update SEED_QUESTIONS**

Find the `SEED_QUESTIONS` array (around line 16-33). Replace the entire array with:

```typescript
const SEED_QUESTIONS: SurveyQuestion[] = [
  {
    question: "What genres do you reach for when you're not sure what to watch?",
    options: ['Action / Thriller', 'Drama', 'Comedy', 'Horror / Sci-Fi'],
    multiSelect: true,
  },
  {
    question: 'Do you prefer movies or TV shows?',
    options: ['Mostly movies', 'Mostly TV', 'Equal mix', "Depends on my mood"],
  },
  {
    question: 'How do you feel about foreign language films?',
    options: ['Love them', 'Fine with subtitles sometimes', 'Prefer English', "Depends on the film"],
  },
  {
    question: 'What kind of pacing do you prefer?',
    options: ['Fast and intense', 'Slow burn', 'Mix of both', 'Depends on the story'],
  },
  {
    question: 'How much time are you willing to commit to a single TV series?',
    options: ['Limited series only (1 season)', '2–3 seasons', '4+ seasons', 'However long it takes'],
    multiSelect: true,
  },
]
```

Notes:
- Genre question text changed from "genre" (singular) to "genres" (plural) to reflect multi-select
- New time-commitment question added as multi-select (user-requested example)

- [ ] **Step 2: Verify submit mutation unchanged**

The existing `submit` mutation accepts `answer: z.string()`. No change needed — the client will join multi-select answers with `", "` before submitting, storing them as a single comma-separated string in the `answer` column.

- [ ] **Step 3: Deploy Workers**

```bash
cd /Users/mohitramchandani/Code/scout/packages/api && npx wrangler deploy
```

Expected: `Deployed scout-api triggers` in the final line.

- [ ] **Step 4: Commit**

```bash
cd /Users/mohitramchandani/Code/scout
git add packages/api/src/routers/survey.ts
git commit -m "feat: add multi-select seed questions (genres, TV commitment) — comma-joined on submit"
```

---

## Task 2c: Update SurveyCard to support multi-select

**Files:**
- Modify: `apps/mobile/src/components/SurveyCard.tsx`

Add a `multiSelect` prop. When true, options render with checkboxes and a "Submit" button appears at the bottom. When false (default), keep the current behavior (tap auto-submits).

- [ ] **Step 1: Replace the entire file**

```typescript
import React, { useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { colors, spacing, shadows, radius } from '../theme'

interface Props {
  question: string
  options: string[]
  multiSelect?: boolean
  onAnswer: (answer: string) => void
  onSkip: () => void
  isPending: boolean
}

export function SurveyCard({ question, options, multiSelect = false, onAnswer, onSkip, isPending }: Props) {
  const [selected, setSelected] = useState<string[]>([])

  function toggle(option: string) {
    setSelected(prev =>
      prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]
    )
  }

  function handleSubmit() {
    if (selected.length === 0) return
    onAnswer(selected.join(', '))
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>SCOUT WANTS TO KNOW</Text>
        <TouchableOpacity onPress={onSkip} disabled={isPending}>
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.question}>{question}</Text>
      {multiSelect && (
        <Text style={styles.hint}>Select all that apply</Text>
      )}
      {isPending ? (
        <ActivityIndicator color={colors.gold} style={styles.spinner} />
      ) : (
        <>
          <View style={styles.options}>
            {options.map(option => {
              const isSelected = selected.includes(option)
              if (multiSelect) {
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => toggle(option)}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                )
              }
              return (
                <TouchableOpacity
                  key={option}
                  style={styles.option}
                  onPress={() => onAnswer(option)}
                >
                  <Text style={styles.optionText}>{option}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
          {multiSelect && (
            <TouchableOpacity
              style={[styles.submit, selected.length === 0 && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={selected.length === 0}
            >
              <Text style={styles.submitText}>
                {selected.length === 0 ? 'Select at least one' : `Submit ${selected.length} answer${selected.length > 1 ? 's' : ''}`}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    ...shadows.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  skip: {
    color: colors.textDim,
    fontSize: 12,
  },
  question: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: spacing.xs,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: spacing.md,
  },
  options: {
    gap: spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  optionSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.surfaceRaised,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  checkmark: {
    color: colors.bg,
    fontSize: 12,
    fontWeight: '700',
  },
  optionText: {
    color: colors.textSoft,
    fontSize: 14,
  },
  optionTextSelected: {
    color: colors.text,
    fontWeight: '600',
  },
  submit: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
    alignItems: 'center',
  },
  submitDisabled: {
    backgroundColor: colors.border,
  },
  submitText: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: '700',
  },
  spinner: { marginTop: spacing.xs },
})
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/mohitramchandani/Code/scout && npx tsc --noEmit 2>&1 | grep -i "SurveyCard"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /Users/mohitramchandani/Code/scout
git add apps/mobile/src/components/SurveyCard.tsx
git commit -m "feat: SurveyCard supports multi-select with checkboxes and submit button"
```

---

## Task 2d: Pass multiSelect flag through PicksScreen

**Files:**
- Modify: `apps/mobile/src/screens/PicksScreen.tsx`

- [ ] **Step 1: Update SurveyItem type to include multiSelect**

Find (around line 126):

```typescript
type SurveyItem = { _type: 'survey'; question: string; options: string[] }
```

Replace with:

```typescript
type SurveyItem = { _type: 'survey'; question: string; options: string[]; multiSelect?: boolean }
```

- [ ] **Step 2: Include multiSelect when building the survey card item**

Find (around line 181-184):

```typescript
const surveyCard = surveyQuery.data && !surveyDismissed
  ? { _type: 'survey' as const, question: surveyQuery.data.question, options: surveyQuery.data.options }
  : null
```

Replace with:

```typescript
const surveyCard = surveyQuery.data && !surveyDismissed
  ? { _type: 'survey' as const, question: surveyQuery.data.question, options: surveyQuery.data.options, multiSelect: surveyQuery.data.multiSelect }
  : null
```

- [ ] **Step 3: Pass multiSelect prop to SurveyCard**

Find (around line 300-312):

```tsx
if (isSurveyItem(item)) {
  return (
    <SurveyCard
      question={item.question}
      options={item.options}
      onAnswer={answer => {
        setSurveyDismissed(true)
        submitSurveyMutation.mutate({ question: item.question, answer })
      }}
      onSkip={() => setSurveyDismissed(true)}
      isPending={submitSurveyMutation.isPending}
    />
  )
}
```

Replace with:

```tsx
if (isSurveyItem(item)) {
  return (
    <SurveyCard
      question={item.question}
      options={item.options}
      multiSelect={item.multiSelect}
      onAnswer={answer => {
        setSurveyDismissed(true)
        submitSurveyMutation.mutate({ question: item.question, answer })
      }}
      onSkip={() => setSurveyDismissed(true)}
      isPending={submitSurveyMutation.isPending}
    />
  )
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/mohitramchandani/Code/scout && npx tsc --noEmit 2>&1 | grep -i "PicksScreen"
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
cd /Users/mohitramchandani/Code/scout
git add apps/mobile/src/screens/PicksScreen.tsx
git commit -m "feat: PicksScreen passes multiSelect flag to SurveyCard"
```

---

## Task 3a: Create StatusSheet component

**Files:**
- Create: `apps/mobile/src/components/StatusSheet.tsx`

Bottom-sheet modal with status action options. Options are passed in as an array so the sheet can adapt to different states (saved, in-progress, watched).

- [ ] **Step 1: Create the file**

```typescript
import React from 'react'
import {
  Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback, StyleSheet,
} from 'react-native'
import { colors, typography, spacing, radius, shadows } from '../theme'

export type StatusAction = {
  key: string
  icon: string
  label: string
  meta: string
  danger?: boolean
  onPress: () => void
}

interface Props {
  visible: boolean
  title: string
  actions: StatusAction[]
  onClose: () => void
}

export function StatusSheet({ visible, title, actions, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.heading}>Set Status</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{title}</Text>

        {actions.map((action, idx) => (
          <TouchableOpacity
            key={action.key}
            style={[styles.option, idx === actions.length - 1 && styles.optionLast]}
            onPress={action.onPress}
          >
            <View style={styles.optionRow}>
              <Text style={[styles.optionIcon, action.danger && styles.optionIconDanger]}>{action.icon}</Text>
              <View style={styles.optionTextWrap}>
                <Text style={[styles.optionText, action.danger && styles.optionTextDanger]}>{action.label}</Text>
                <Text style={styles.optionMeta}>{action.meta}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.surfaceHigh,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing['3xl'],
    ...shadows.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  heading: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textSoft,
    fontSize: 13,
    marginBottom: spacing.lg,
  },
  option: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionLast: { borderBottomWidth: 0 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  optionIcon: {
    fontSize: 18,
    color: colors.gold,
    width: 24,
    textAlign: 'center',
  },
  optionIconDanger: { color: colors.error },
  optionTextWrap: { flex: 1 },
  optionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  optionTextDanger: { color: colors.error },
  optionMeta: { color: colors.textMuted, fontSize: 12 },
  cancelButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
})
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/mohitramchandani/Code/scout && npx tsc --noEmit 2>&1 | grep -i "StatusSheet"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /Users/mohitramchandani/Code/scout
git add apps/mobile/src/components/StatusSheet.tsx
git commit -m "feat: add StatusSheet component for status action choices"
```

---

## Task 3b: Rework MediaDetailScreen status area

**Files:**
- Modify: `apps/mobile/src/screens/MediaDetailScreen.tsx`

Replace the stacked trio of status buttons with one adaptive primary button + a `···` overflow pill that opens `StatusSheet`. State-adaptive behavior:

- Not saved → Primary: `+ Add` (gold fill). No overflow pill.
- Saved, not watching, not watched → Primary: `✓ Saved` (gold border). Overflow with "Now Watching", "Already Seen", "Remove".
- In-progress (TV watching) → Primary: `▷ S{n} · E{n}` (tap opens episode-edit modal). Overflow with "Already Seen", "Remove".
- Watched → Primary: `✓ Watched · Tap to undo` (tap removes watch history). Overflow with "Remove".

- [ ] **Step 1: Add the StatusSheet import and state**

At the top of `apps/mobile/src/screens/MediaDetailScreen.tsx`, find the existing imports for components:

```typescript
import { WatchingStatusModal } from '../components/WatchingStatusModal'
import { RatingModal } from '../components/RatingModal'
```

Add below:

```typescript
import { StatusSheet, type StatusAction } from '../components/StatusSheet'
```

Find the existing state declarations (around lines 37-40):

```typescript
const [showWatchingModal, setShowWatchingModal] = useState(false)
const [showRatingModal, setShowRatingModal] = useState(false)
const [watchingTargetId, setWatchingTargetId] = useState<string | null>(null)
const [isStartingWatch, setIsStartingWatch] = useState(false)
```

Add below:

```typescript
const [showStatusSheet, setShowStatusSheet] = useState(false)
```

- [ ] **Step 2: Build the actions list for the current state**

After the existing derived state (`const isTogglingWatchlist = addMutation.isPending || removeMutation.isPending`, around line 184), add:

```typescript
const statusActions: StatusAction[] = (() => {
  if (!watchlistItem && !isInProgress && !isWatched) return []
  const acts: StatusAction[] = []
  if (mediaType === 'tv' && !isInProgress && !isWatched) {
    acts.push({
      key: 'watching',
      icon: '▷',
      label: 'Now Watching',
      meta: 'Start tracking from S1 · E1',
      onPress: () => { setShowStatusSheet(false); handleStartWatching() },
    })
  }
  if (!isWatched) {
    acts.push({
      key: 'seen',
      icon: '✓',
      label: 'Already Seen',
      meta: 'Rate this title',
      onPress: () => { setShowStatusSheet(false); setShowRatingModal(true) },
    })
  }
  acts.push({
    key: 'remove',
    icon: '✕',
    label: 'Remove',
    meta: 'Take out of your watchlist',
    danger: true,
    onPress: () => {
      setShowStatusSheet(false)
      if (watchlistItem) removeMutation.mutate({ id: watchlistItem.id })
    },
  })
  return acts
})()

const showOverflow = (watchlistItem || isInProgress || isWatched) && statusActions.length > 0
```

- [ ] **Step 3: Replace the status button block**

Find the block starting around line 307 with `<TouchableOpacity style={[styles.watchlistButton, ...` and ending after the `progressButton` block (around line 366).

The current block looks like this (for reference):

```tsx
<TouchableOpacity
  style={[styles.watchlistButton, inWatchlist && styles.watchlistButtonSaved]}
  onPress={handleWatchlistToggle}
  disabled={isTogglingWatchlist || watchlistQuery.isLoading}
>
  {/* ... */}
</TouchableOpacity>

{/* "I've seen this" - only show if not already in watch history */}
{!isWatched && (
  <TouchableOpacity style={styles.seenButton} onPress={() => setShowRatingModal(true)}>
    <Text style={styles.seenButtonText}>I've seen this</Text>
  </TouchableOpacity>
)}

{/* Show watched confirmation - tappable to undo */}
{isWatched && (
  <TouchableOpacity style={styles.watchedBadge} onPress={handleRemoveWatched} disabled={removeHistoryMutation.isPending}>
    <Text style={styles.watchedBadgeText}>
      {removeHistoryMutation.isPending ? 'Removing...' : '✓ Watched'}
    </Text>
    <Text style={styles.watchedUndoText}>Tap to undo</Text>
  </TouchableOpacity>
)}

{/* "I'm watching this" for TV - auto-adds to watchlist as S1E1 */}
{mediaType === 'tv' && !isInProgress && !isWatched && (
  <TouchableOpacity
    style={styles.watchingButton}
    onPress={handleStartWatching}
    disabled={addMutation.isPending || updateWatchingMutation.isPending || isStartingWatch}
  >
    <Text style={styles.watchingButtonText}>
      {(addMutation.isPending || updateWatchingMutation.isPending) ? 'Adding...' : "I'm watching this"}
    </Text>
  </TouchableOpacity>
)}

{/* Show in-progress status - tappable to edit */}
{isInProgress && (
  <TouchableOpacity style={styles.progressButton} onPress={handleEditProgress}>
    <Text style={styles.progressButtonText}>
      S{watchlistEntry?.currentSeason ?? 1} · E{watchlistEntry?.currentEpisode ?? 1}
    </Text>
    <Text style={styles.progressEditHint}>Tap to edit</Text>
  </TouchableOpacity>
)}
```

Replace the entire block with:

```tsx
<View style={styles.statusRow}>
  <TouchableOpacity
    style={[
      styles.primaryButton,
      (inWatchlist || isInProgress || isWatched) && styles.primaryButtonSecondary,
      isWatched && styles.primaryButtonWatched,
    ]}
    onPress={() => {
      if (isWatched) { handleRemoveWatched(); return }
      if (isInProgress) { handleEditProgress(); return }
      handleWatchlistToggle()
    }}
    disabled={isTogglingWatchlist || watchlistQuery.isLoading || removeHistoryMutation.isPending}
  >
    {isTogglingWatchlist ? (
      <ActivityIndicator size="small" color={colors.bg} />
    ) : isWatched ? (
      <>
        <Text style={styles.primaryButtonTextWatched}>
          {removeHistoryMutation.isPending ? 'Removing...' : '✓ Watched'}
        </Text>
        <Text style={styles.primaryButtonHint}>Tap to undo</Text>
      </>
    ) : isInProgress ? (
      <>
        <Text style={styles.primaryButtonTextSaved}>
          ▷ S{watchlistEntry?.currentSeason ?? 1} · E{watchlistEntry?.currentEpisode ?? 1}
        </Text>
        <Text style={styles.primaryButtonHint}>Tap to edit episode</Text>
      </>
    ) : inWatchlist ? (
      <Text style={styles.primaryButtonTextSaved}>✓ Saved</Text>
    ) : (
      <Text style={styles.primaryButtonText}>+ Add to Watchlist</Text>
    )}
  </TouchableOpacity>

  {showOverflow && (
    <TouchableOpacity
      style={styles.overflowButton}
      onPress={() => setShowStatusSheet(true)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={styles.overflowText}>···</Text>
    </TouchableOpacity>
  )}
</View>
```

- [ ] **Step 4: Add the StatusSheet at the bottom of the screen**

Find the existing `<RatingModal ... />` usage (around lines 436-442). Add below it (before the closing tags at the bottom):

```tsx
<StatusSheet
  visible={showStatusSheet}
  title={media.title}
  actions={statusActions}
  onClose={() => setShowStatusSheet(false)}
/>
```

- [ ] **Step 5: Replace the styles**

In the `StyleSheet.create` block, find and delete these now-unused styles:

- `seenButton`
- `seenButtonText`
- `watchedBadge`
- `watchedBadgeText`
- `watchedUndoText`
- `watchingButton`
- `watchingButtonText`
- `progressButton`
- (keep `progressButtonText`, `progressEditHint` if referenced elsewhere; otherwise delete)

Also find these and delete:

- `watchlistButton`
- `watchlistButtonSaved`
- `watchlistButtonText`
- `watchlistButtonTextSaved`

Then add the new styles (place them where `watchlistButton` used to be, around line 501):

```typescript
statusRow: {
  flexDirection: 'row',
  gap: spacing.sm,
  marginTop: spacing.md,
  alignItems: 'stretch',
},
primaryButton: {
  flex: 1,
  backgroundColor: colors.gold,
  borderRadius: radius.md,
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.lg,
  alignItems: 'center',
  justifyContent: 'center',
  ...shadows.md,
},
primaryButtonSecondary: {
  backgroundColor: colors.surfaceRaised,
  borderWidth: 1,
  borderColor: colors.gold,
  ...Platform.select({ ios: { shadowOpacity: 0 }, android: { elevation: 0 }, default: {} }),
},
primaryButtonWatched: {
  backgroundColor: colors.surfaceRaised,
  borderWidth: 1,
  borderColor: colors.border,
  ...Platform.select({ ios: { shadowOpacity: 0 }, android: { elevation: 0 }, default: {} }),
},
primaryButtonText: {
  ...typography.button,
  color: colors.bg,
  fontFamily: 'Outfit_600SemiBold',
},
primaryButtonTextSaved: {
  ...typography.button,
  color: colors.gold,
  fontFamily: 'Outfit_600SemiBold',
},
primaryButtonTextWatched: {
  ...typography.button,
  color: colors.gold,
  fontSize: 13,
},
primaryButtonHint: {
  ...typography.micro,
  color: colors.textMuted,
  marginTop: 2,
},
overflowButton: {
  width: 44,
  backgroundColor: colors.surfaceRaised,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: colors.border,
  alignItems: 'center',
  justifyContent: 'center',
},
overflowText: {
  color: colors.text,
  fontSize: 18,
  fontWeight: '700',
  letterSpacing: 2,
},
```

- [ ] **Step 6: TypeScript check**

```bash
cd /Users/mohitramchandani/Code/scout && npx tsc --noEmit 2>&1 | grep -i "MediaDetailScreen\|StatusSheet"
```

Expected: no output. If errors mention deleted styles still being referenced in the file, search for them and remove those references:

```bash
grep -n "seenButton\|watchingButton\|watchedBadge\|progressButton\|watchlistButton" apps/mobile/src/screens/MediaDetailScreen.tsx
```

Expected: no matches (other than inside the deleted-and-replaced region, which should now have no matches).

- [ ] **Step 7: Commit**

```bash
cd /Users/mohitramchandani/Code/scout
git add apps/mobile/src/screens/MediaDetailScreen.tsx
git commit -m "feat: redesign Media Detail status area — primary button + overflow sheet (Option B)"
```

---

## Task 4: Build, install, and verify

- [ ] **Step 1: Build Android APK**

```bash
cd /Users/mohitramchandani/Code/scout/apps/mobile
eas build --local --platform android --profile preview 2>&1 | tail -5
```

Expected: ends with `Build successful`.

- [ ] **Step 2: Install**

```bash
adb install /Users/mohitramchandani/Code/scout/apps/mobile/build-<latest-timestamp>.apk
```

- [ ] **Step 3: Manual verification checklist**

| Scenario | Expected |
|---|---|
| Open Search tab → tap ✦ Mood | Input is rectangular (not pill), fuchsia border, no send button visible |
| Type in mood input + press return | Search fires (same as before) |
| Open Picks tab, scroll to SurveyCard for "genres" question | Shows "Select all that apply" hint, checkboxes on each option |
| Tap 2 genre options + Submit | Both selections submit (comma-joined), card dismisses |
| Open Picks tab, scroll to a single-select seed question | Tapping one option still auto-submits (no checkboxes) |
| Open a movie detail page (not in watchlist) | Single gold `+ Add to Watchlist` button, no `···` pill |
| Tap `+ Add to Watchlist` on a movie | Becomes `✓ Saved`, `···` pill appears beside it |
| Tap `···` on a saved movie | Sheet opens with "Already Seen" + "Remove" options (no "Now Watching" for movie) |
| Open a TV show detail page (not in watchlist) | Single gold `+ Add to Watchlist` button |
| Tap `+ Add`, then tap `···` | Sheet shows "Now Watching" + "Already Seen" + "Remove" |
| Tap "Now Watching" in sheet | Sheet closes, primary button becomes `▷ S1 · E1` |
| Tap `▷ S1 · E1` primary button | Opens the episode-edit modal |
| Tap `···` on in-progress TV | Sheet shows "Already Seen" + "Remove" only |
| Open a movie you've watched | Primary button shows `✓ Watched · Tap to undo`, `···` shows "Remove" only |

- [ ] **Step 4: Push to remote**

```bash
cd /Users/mohitramchandani/Code/scout
git log --oneline -9
git push origin main
```

---

## Self-Review

**Spec coverage:**

| Requirement | Covered in |
|---|---|
| Mood input matches titles search rectangular style with fuchsia accent | Task 1 |
| Send button removed from mood input | Task 1 |
| `multiSelect` flag added to SurveyQuestion type | Task 2a |
| Genre question becomes multi-select, new time-commitment multi-select question added | Task 2b |
| SurveyCard renders checkboxes + Submit button when multiSelect | Task 2c |
| Single-select questions keep current auto-submit behavior | Task 2c (the `!multiSelect` branch) |
| PicksScreen threads multiSelect through to SurveyCard | Task 2d |
| StatusSheet component created with action-list prop | Task 3a |
| MediaDetailScreen uses one primary button + `···` overflow pill | Task 3b |
| Primary button adapts to state (not saved / saved / in-progress / watched) | Task 3b |
| Sheet actions adapt to state (watching/seen/remove filtered appropriately) | Task 3b |
| Movies never show "Now Watching" in sheet | Task 3b (`mediaType === 'tv'` guard) |
| End-to-end verification on device | Task 4 |

No placeholders. All code is complete.
