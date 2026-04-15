# Search Tab — Mood Search Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move mood search out of a modal stack screen into the Search tab as a mode toggle alongside title search, while keeping the Picks CTA button, and fix the indefinite spinner on results load.

**Architecture:** `MoodSearchContent` is a new self-contained component extracted from `MoodSearchScreen` that handles all mood search state internally and uses the `useNavigation` hook instead of a nav prop. `SearchScreen` gains a segmented pill toggle (gold for Titles, fuchsia gradient for Mood) and renders `MoodSearchContent` when mood mode is active. The Picks CTA navigates to the Search tab via the parent tab navigator with an `initialMode: 'mood'` param that triggers `useFocusEffect`.

**Tech Stack:** React Native (Expo), tRPC, React Query, `expo-linear-gradient`, React Navigation v6 (bottom tabs + native stack), Hono + Cloudflare Workers, Drizzle + Supabase

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/api/src/routers/moodSearch.ts` | Modify | Parallelize `enrichRecs` with `Promise.all` |
| `apps/mobile/src/components/MoodSearchContent.tsx` | **Create** | All mood search UI + logic, no nav prop |
| `apps/mobile/src/screens/SearchScreen.tsx` | Modify | Add toggle pill + render `MoodSearchContent` in mood mode |
| `apps/mobile/src/screens/PicksScreen.tsx` | Modify | Update CTA `onPress` to navigate to Search tab in mood mode |
| `apps/mobile/src/navigation/TabNavigator.tsx` | Modify | Export `TabParamList` type, type the Tab navigator |
| `apps/mobile/src/navigation/MainNavigator.tsx` | Modify | Remove `MoodSearch` from `RootStackParamList` and stack |
| `apps/mobile/src/screens/MoodSearchScreen.tsx` | **Delete** | Replaced by `MoodSearchContent` |

---

## Task 1: Fix enrichRecs — parallelize with Promise.all

**Files:**
- Modify: `packages/api/src/routers/moodSearch.ts:57-67`

This fixes the indefinite spinner when tapping a recent search. Sequential DB calls on Cloudflare Workers' Supabase pooler are slow enough to hit response time limits.

- [ ] **Step 1: Replace the sequential `enrichRecs` loop with `Promise.all`**

Open `packages/api/src/routers/moodSearch.ts` and replace lines 57–67:

```typescript
async function enrichRecs(
  recList: Array<{ tmdbId: number; mediaType: string }>,
  tmdbToken: string
): Promise<MediaItem[]> {
  const results = await Promise.all(
    recList.map(rec => getOrFetchMedia(rec.tmdbId, rec.mediaType as 'movie' | 'tv', tmdbToken))
  )
  return results.filter((m): m is MediaItem => m !== null)
}
```

- [ ] **Step 2: Deploy to Cloudflare Workers**

```bash
cd packages/api && npx wrangler deploy
```

Expected output ends with: `Deployed scout-api triggers`

- [ ] **Step 3: Commit**

```bash
cd /Users/mohitramchandani/Code/scout
git add packages/api/src/routers/moodSearch.ts
git commit -m "fix: parallelize enrichRecs with Promise.all — fixes indefinite spinner on Workers"
```

---

## Task 2: Create MoodSearchContent component

**Files:**
- Create: `apps/mobile/src/components/MoodSearchContent.tsx`

Extracted from `MoodSearchScreen`. Key differences: no `navigation` prop (uses `useNavigation` hook), no outer `SafeAreaView` (SearchScreen provides it), "← Back" clears `selectedSearchId` state instead of calling `navigation.goBack()`, Direction C gradient header on the search input area.

- [ ] **Step 1: Create the file with the full component**

```typescript
// apps/mobile/src/components/MoodSearchContent.tsx
import React, { useState, useMemo, useRef } from 'react'
import {
  View, Text, FlatList, Image, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, Animated, PanResponder,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { colors, typography, spacing, radius, shadows } from '../theme'
import { trpc } from '../lib/trpc'
import type { RootStackParamList } from '../navigation/MainNavigator'
import { DismissSheet } from './DismissSheet'
import { RatingModal } from './RatingModal'

const POSTER_BASE = 'https://image.tmdb.org/t/p/w185'
type Nav = NativeStackNavigationProp<RootStackParamList>

interface SwipeableCardProps {
  children: React.ReactNode
  onSwipeRight?: () => void
  style?: object
}

function SwipeableCard({ children, onSwipeRight, style }: SwipeableCardProps) {
  const translateX = useRef(new Animated.Value(0)).current
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy),
      onPanResponderMove: Animated.event([null, { dx: translateX }], { useNativeDriver: false }),
      onPanResponderRelease: (_, { dx, vx }) => {
        if (dx > 80 || vx > 0.5) {
          Animated.timing(translateX, { toValue: 500, duration: 200, useNativeDriver: false }).start(() => {
            translateX.setValue(0)
            onSwipeRight?.()
          })
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: false }).start()
        }
      },
    })
  ).current

  const addBgOpacity = translateX.interpolate({ inputRange: [0, 20], outputRange: [0, 1], extrapolate: 'clamp' })
  const addScale = translateX.interpolate({ inputRange: [0, 80], outputRange: [0.8, 1.1], extrapolate: 'clamp' })

  return (
    <View style={style}>
      <Animated.View style={[StyleSheet.absoluteFillObject, swipeStyles.addBg, { opacity: addBgOpacity }]}>
        <Animated.Text style={[swipeStyles.addLabel, { transform: [{ scale: addScale }] }]}>
          + Add
        </Animated.Text>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  )
}

const swipeStyles = StyleSheet.create({
  addBg: {
    backgroundColor: colors.gold,
    justifyContent: 'center',
    paddingLeft: spacing.lg + 10,
    borderRadius: radius.md,
  },
  addLabel: { color: colors.bg, fontSize: 14, fontWeight: '700' },
})

type FeedTarget = {
  tmdbId: number; mediaType: 'movie' | 'tv'; title: string
  genres: string[]; posterPath: string | null; year: number | null; overview: string
}

export function MoodSearchContent() {
  const navigation = useNavigation<Nav>()
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [passedIds, setPassedIds] = useState<Set<string>>(new Set())
  const [dismissTarget, setDismissTarget] = useState<FeedTarget | null>(null)
  const [ratingTarget, setRatingTarget] = useState<FeedTarget | null>(null)
  const utils = trpc.useUtils()

  const historyQuery = trpc.moodSearch.history.useQuery()
  const usageQuery = trpc.picks.usage.useQuery()
  const searchMutation = trpc.moodSearch.search.useMutation({
    onSuccess: (data) => {
      setSearchError(null)
      setSelectedSearchId(data.searchId)
      setSearchText('')
      utils.moodSearch.history.invalidate()
      utils.picks.usage.invalidate()
    },
    onError: (error) => {
      setSearchError(error.message || 'Search failed. Try again.')
    },
  })
  const refreshMutation = trpc.moodSearch.refresh.useMutation({
    onSuccess: () => { utils.moodSearch.results.invalidate() },
  })
  const resultsQuery = trpc.moodSearch.results.useQuery(
    { searchId: selectedSearchId ?? '' },
    { enabled: !!selectedSearchId }
  )
  const watchlistQuery = trpc.watchlist.list.useQuery({})
  const addMutation = trpc.watchlist.add.useMutation({ onSuccess: () => utils.watchlist.list.invalidate() })
  const updateStatusMutation = trpc.watchlist.updateStatus.useMutation({ onSuccess: () => utils.watchlist.list.invalidate() })
  const addHistoryMutation = trpc.watchHistory.add.useMutation()
  const tasteProfileMutation = trpc.tasteProfile.updateFromRating.useMutation()
  const tagsQuery = trpc.tmdb.generateTags.useQuery(
    { tmdbId: ratingTarget?.tmdbId ?? 0, mediaType: ratingTarget?.mediaType ?? 'movie' },
    { enabled: !!ratingTarget, staleTime: Infinity }
  )

  const watchlistedSet = useMemo(
    () => new Set(
      (watchlistQuery.data ?? [])
        .filter((i: any) => i.status === 'saved')
        .map((i: any) => `${i.tmdbId}-${i.mediaType}`)
    ),
    [watchlistQuery.data]
  )

  const dismissedSet = useMemo(
    () => new Set(
      (watchlistQuery.data ?? [])
        .filter((i: any) => i.status === 'dismissed_not_now' || i.status === 'dismissed_never')
        .map((i: any) => `${i.tmdbId}-${i.mediaType}`)
    ),
    [watchlistQuery.data]
  )

  function handleSearch() {
    if (!searchText.trim()) return
    searchMutation.mutate({ message: searchText.trim() })
  }

  function handleAdd(item: any) {
    addMutation.mutate({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType as 'movie' | 'tv',
      media: {
        title: item.title, posterPath: item.posterPath, year: item.year,
        genres: item.genres, overview: item.overview, runtime: null, watchProviders: {},
      },
    })
  }

  function handleRefresh() {
    if (!selectedSearchId) return
    refreshMutation.mutate({ searchId: selectedSearchId })
  }

  function buildMediaPayload(item: FeedTarget) {
    return {
      title: item.title, posterPath: item.posterPath, year: item.year,
      genres: item.genres, overview: item.overview, runtime: null, watchProviders: {},
    }
  }

  async function dismissWithStatus(
    target: FeedTarget,
    status: 'dismissed_not_now' | 'dismissed_never',
    resurfaceAfter?: string
  ) {
    const key = `${target.tmdbId}-${target.mediaType}`
    setDismissTarget(null)
    setPassedIds(prev => new Set([...prev, key]))
    try {
      await addMutation.mutateAsync({ tmdbId: target.tmdbId, mediaType: target.mediaType, media: buildMediaPayload(target) })
      const freshList = await utils.watchlist.list.fetch({})
      const item = freshList?.find((w: any) => w.tmdbId === target.tmdbId && w.mediaType === target.mediaType)
      if (item) updateStatusMutation.mutate({ id: item.id, status, resurfaceAfter })
    } catch {
      const freshList = await utils.watchlist.list.fetch({})
      const item = freshList?.find((w: any) => w.tmdbId === target.tmdbId && w.mediaType === target.mediaType)
      if (item) updateStatusMutation.mutate({ id: item.id, status, resurfaceAfter })
    }
  }

  function handleDismissNotNow() {
    if (!dismissTarget) return
    const d = new Date(); d.setDate(d.getDate() + 30)
    dismissWithStatus(dismissTarget, 'dismissed_not_now', d.toISOString().split('T')[0])
  }
  function handleDismissNotInterested() {
    if (!dismissTarget) return
    dismissWithStatus(dismissTarget, 'dismissed_never')
  }
  function handleDismissAlreadyWatched() {
    if (!dismissTarget) return
    const target = dismissTarget
    setRatingTarget(target)
    setDismissTarget(null)
    setPassedIds(prev => new Set([...prev, `${target.tmdbId}-${target.mediaType}`]))
  }
  function handleRatingSubmit(score: number, tags: string[]) {
    if (!ratingTarget) return
    const target = ratingTarget
    setRatingTarget(null)
    setPassedIds(prev => new Set([...prev, `${target.tmdbId}-${target.mediaType}`]))
    addHistoryMutation.mutate(
      { tmdbId: target.tmdbId, mediaType: target.mediaType, score, tags, media: buildMediaPayload(target) },
      { onSuccess: () => { if (target.genres.length > 0) tasteProfileMutation.mutate({ score, genres: target.genres }) } }
    )
  }

  // ── History view ──────────────────────────────────────────────────────────
  if (!selectedSearchId) {
    return (
      <View style={{ flex: 1 }}>
        {/* Direction C: violet-to-dark gradient header containing search input */}
        <LinearGradient
          colors={['#1a0930', '#0e0520', colors.bg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.3, y: 1 }}
          style={styles.gradientHeader}
        >
          <View style={styles.inputRow}>
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
        </LinearGradient>

        {searchError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{searchError}</Text>
          </View>
        )}

        {historyQuery.data && historyQuery.data.length > 0 ? (
          <View style={styles.content}>
            <Text style={styles.sectionLabel}>Recent searches</Text>
            <FlatList
              data={historyQuery.data}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.historyCard}
                  onPress={() => setSelectedSearchId(item.id)}
                >
                  <Text style={styles.historyTitle}>{item.title}</Text>
                  <Text style={styles.historyMeta}>{formatTime(item.createdAt)}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Describe a vibe, genre, or mood</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {(() => {
              const limit = usageQuery.data?.moodSearch?.limit ?? 3
              const used = usageQuery.data?.moodSearch?.used ?? 0
              return `${limit - used} of ${limit} searches left today`
            })()}
          </Text>
        </View>
      </View>
    )
  }

  // ── Results view ──────────────────────────────────────────────────────────
  const currentSearch = (historyQuery.data ?? []).find((s: any) => s.id === selectedSearchId)
  const isLoading = resultsQuery.isLoading || refreshMutation.isPending

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.resultsHeader}>
        <TouchableOpacity onPress={() => setSelectedSearchId(null)}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.resultsTitle} numberOfLines={1}>{currentSearch?.title || ''}</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={refreshMutation.isPending}
        >
          <Text style={styles.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : resultsQuery.data && resultsQuery.data.length > 0 ? (
        <FlatList
          data={resultsQuery.data.filter(item => {
            const key = `${item.tmdbId}-${item.mediaType}`
            return !passedIds.has(key) && !dismissedSet.has(key)
          })}
          keyExtractor={item => `${item.tmdbId}-${item.mediaType}`}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const key = `${item.tmdbId}-${item.mediaType}`
            const inWatchlist = watchlistedSet.has(key)
            const dismissPayload: FeedTarget = {
              tmdbId: item.tmdbId, mediaType: item.mediaType, title: item.title,
              genres: item.genres, posterPath: item.posterPath, year: item.year, overview: item.overview,
            }
            return (
              <SwipeableCard
                style={styles.card}
                onSwipeRight={() => { if (!inWatchlist) handleAdd(item) }}
              >
                <TouchableOpacity
                  style={styles.cardInner}
                  onPress={() => navigation.navigate('MediaDetail', { tmdbId: item.tmdbId, mediaType: item.mediaType })}
                  activeOpacity={0.75}
                >
                  {item.posterPath ? (
                    <Image source={{ uri: `${POSTER_BASE}${item.posterPath}` }} style={styles.poster} />
                  ) : (
                    <View style={[styles.poster, styles.posterFallback]} />
                  )}
                  <View style={styles.info}>
                    <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.meta}>{[item.year, item.mediaType === 'tv' ? 'TV' : 'Movie'].filter(Boolean).join(' · ')}</Text>
                    {item.overview?.length > 0 && (
                      <Text style={styles.overview} numberOfLines={2}>{item.overview}</Text>
                    )}
                    <View style={styles.actions}>
                      <TouchableOpacity style={styles.passButton} onPress={() => setDismissTarget(dismissPayload)}>
                        <Text style={styles.passText}>Pass</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.addButton, inWatchlist && styles.addButtonSaved]}
                        onPress={() => { if (!inWatchlist) handleAdd(item) }}
                        disabled={inWatchlist}
                      >
                        <Text style={styles.addButtonText}>{inWatchlist ? '✓' : '+'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              </SwipeableCard>
            )
          }}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No results</Text>
        </View>
      )}

      <DismissSheet
        visible={!!dismissTarget} title={dismissTarget?.title ?? ''}
        onClose={() => setDismissTarget(null)} onNotNow={handleDismissNotNow}
        onAlreadyWatched={handleDismissAlreadyWatched} onNotInterested={handleDismissNotInterested}
      />
      <RatingModal
        visible={!!ratingTarget} title={ratingTarget?.title ?? ''} tags={tagsQuery.data ?? ratingTarget?.genres ?? []}
        onClose={() => setRatingTarget(null)} onSubmit={handleRatingSubmit} isPending={addHistoryMutation.isPending}
      />
    </View>
  )
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  return `${diffDays}d ago`
}

const styles = StyleSheet.create({
  gradientHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(192,38,211,0.2)',
  },
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
  sendButtonWrapper: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButton: {
    width: 40, height: 40, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  sendText: { color: 'white', fontSize: 16, fontWeight: '700' },
  errorBanner: {
    marginHorizontal: spacing.md, marginTop: spacing.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    backgroundColor: '#3a1a1a', borderRadius: radius.md,
    borderWidth: 1, borderColor: '#5a2a2a',
  },
  errorText: { color: '#ff8888', fontSize: 13 },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  sectionLabel: {
    ...typography.label, color: colors.textMuted,
    marginBottom: spacing.md, textTransform: 'uppercase', fontSize: 11,
  },
  historyCard: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.md,
  },
  historyTitle: { ...typography.body, color: colors.text, marginBottom: spacing.xs },
  historyMeta: { fontSize: 11, color: colors.textMuted },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...typography.body, color: colors.textMuted },
  footer: { alignItems: 'center', paddingVertical: spacing.md },
  footerText: { fontSize: 11, color: colors.textMuted },
  resultsHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backText: { ...typography.subtitle, color: colors.gold, flexShrink: 0 },
  resultsTitle: { ...typography.heading, color: colors.text, flex: 1, fontSize: 15 },
  refreshButton: {
    width: 32, height: 32, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  refreshText: { color: colors.textMuted, fontSize: 14 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  card: {
    backgroundColor: colors.surfaceRaised, marginBottom: spacing.xs,
    borderRadius: radius.md, ...shadows.md, overflow: 'hidden',
  },
  cardInner: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  poster: { width: 64, height: 96, borderRadius: radius.sm, marginRight: spacing.md },
  posterFallback: { backgroundColor: colors.border },
  info: { flex: 1 },
  title: { ...typography.title, color: colors.text, marginBottom: 2 },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  overview: { ...typography.body, color: colors.textSoft, marginBottom: spacing.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  passButton: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  passText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  addButton: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.gold, alignItems: 'center' },
  addButtonSaved: { backgroundColor: colors.border },
  addButtonText: { fontSize: 12, fontWeight: '700', color: colors.bg },
})
```

- [ ] **Step 2: Verify the file compiles — no TypeScript errors**

```bash
cd /Users/mohitramchandani/Code/scout
npx tsc --noEmit 2>&1 | grep MoodSearchContent
```

Expected: no output (no errors). If errors appear, fix them before continuing.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/MoodSearchContent.tsx
git commit -m "feat: create MoodSearchContent component — extracted from MoodSearchScreen with Direction C gradient header"
```

---

## Task 3: Add TabParamList to TabNavigator

**Files:**
- Modify: `apps/mobile/src/navigation/TabNavigator.tsx`

The `Search` tab needs to accept an `initialMode` param so `PicksScreen` can navigate to it in mood mode. Export `TabParamList` so `SearchScreen` and `PicksScreen` can import it.

- [ ] **Step 1: Replace the entire `TabNavigator.tsx`**

```typescript
// apps/mobile/src/navigation/TabNavigator.tsx
import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text } from 'react-native'
import { PicksScreen } from '../screens/PicksScreen'
import { SearchScreen } from '../screens/SearchScreen'
import { WatchlistScreen } from '../screens/WatchlistScreen'
import { ProfileScreen } from '../screens/ProfileScreen'
import colors from '../theme/colors'

export type TabParamList = {
  Picks: undefined
  Search: { initialMode?: 'mood' } | undefined
  Watchlist: undefined
  Profile: undefined
}

const Tab = createBottomTabNavigator<TabParamList>()

const ICONS: Record<string, string> = {
  Picks: '✦', Search: '⌕', Watchlist: '☰', Profile: '◎',
}

function icon(label: string, focused: boolean) {
  return (
    <Text style={{ fontSize: 20, color: focused ? colors.gold : colors.textDim }}>
      {ICONS[label]}
    </Text>
  )
}

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: { fontSize: 10, marginBottom: 4 },
      }}
    >
      <Tab.Screen name="Picks" component={PicksScreen} options={{ tabBarIcon: ({ focused }) => icon('Picks', focused) }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarIcon: ({ focused }) => icon('Search', focused) }} />
      <Tab.Screen name="Watchlist" component={WatchlistScreen} options={{ tabBarIcon: ({ focused }) => icon('Watchlist', focused) }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: ({ focused }) => icon('Profile', focused) }} />
    </Tab.Navigator>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/navigation/TabNavigator.tsx
git commit -m "feat: export TabParamList with Search initialMode param"
```

---

## Task 4: Refactor SearchScreen with mode toggle

**Files:**
- Modify: `apps/mobile/src/screens/SearchScreen.tsx`

Replace the entire file. Adds `SafeAreaView`, `KeyboardAvoidingView`, the segmented pill toggle (gold for Titles, fuchsia gradient for Mood), and renders `MoodSearchContent` when mood is active. Uses `useFocusEffect` to auto-switch to mood mode when navigated here with `initialMode: 'mood'`.

- [ ] **Step 1: Replace the entire `SearchScreen.tsx`**

```typescript
// apps/mobile/src/screens/SearchScreen.tsx
import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, TextInput, FlatList, Image,
  TouchableOpacity, ActivityIndicator, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { trpc } from '../lib/trpc'
import type { MediaItem } from '@scout/shared'
import type { RootStackParamList } from '../navigation/MainNavigator'
import type { TabParamList } from '../navigation/TabNavigator'
import { colors, typography, spacing, radius, shadows } from '../theme'
import { MoodSearchContent } from '../components/MoodSearchContent'

type Props = BottomTabScreenProps<TabParamList, 'Search'>

export function SearchScreen({ route, navigation }: Props) {
  const stackNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [mode, setMode] = useState<'titles' | 'mood'>('titles')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Auto-activate mood mode when navigated here from Picks CTA
  useFocusEffect(useCallback(() => {
    if (route.params?.initialMode === 'mood') {
      setMode('mood')
      navigation.setParams({ initialMode: undefined })
    }
  }, [route.params?.initialMode]))

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 400)
    return () => clearTimeout(timer)
  }, [query])

  const utils = trpc.useUtils()
  const searchQuery = trpc.tmdb.search.useQuery(
    { query: debouncedQuery },
    { enabled: mode === 'titles' && debouncedQuery.length > 1 }
  )
  const watchlistQuery = trpc.watchlist.list.useQuery({})
  const addMutation = trpc.watchlist.add.useMutation({
    onSuccess: () => utils.watchlist.list.invalidate(),
  })

  const watchlistedSet = new Set(
    watchlistQuery.data
      ?.filter(item => item.status === 'saved')
      .map(item => `${item.tmdbId}-${item.mediaType}`) ?? []
  )

  function handleAdd(item: MediaItem) {
    addMutation.mutate({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      media: {
        title: item.title, posterPath: item.posterPath, year: item.year,
        genres: item.genres, overview: item.overview,
        runtime: item.runtime, watchProviders: item.watchProviders,
      },
    })
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <Text style={styles.header}>Search</Text>

        {/* Segmented mode toggle */}
        <View style={styles.toggleContainer}>
          <View style={styles.togglePill}>
            <TouchableOpacity
              style={styles.toggleItem}
              onPress={() => setMode('titles')}
              activeOpacity={0.8}
            >
              {mode === 'titles' ? (
                <View style={[styles.toggleActive, styles.toggleActiveGold]}>
                  <Text style={styles.toggleTextActiveGold}>Titles</Text>
                </View>
              ) : (
                <Text style={styles.toggleTextInactive}>Titles</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleItem}
              onPress={() => setMode('mood')}
              activeOpacity={0.8}
            >
              {mode === 'mood' ? (
                <LinearGradient
                  colors={['#7c3aed', '#c026d3']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.toggleActive}
                >
                  <Text style={styles.toggleTextActiveMood}>✦ Mood</Text>
                </LinearGradient>
              ) : (
                <Text style={styles.toggleTextInactive}>✦ Mood</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Content area */}
        {mode === 'titles' ? (
          <View style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              placeholder="Movies, shows..."
              placeholderTextColor="#5a3520"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              returnKeyType="search"
            />

            {searchQuery.isLoading && debouncedQuery.length > 1 && (
              <ActivityIndicator color={colors.gold} style={styles.spinner} />
            )}

            {debouncedQuery.length <= 1 && (
              <Text style={styles.emptyText}>Search for movies and shows</Text>
            )}

            {searchQuery.isError && (
              <Text style={styles.errorText}>{String(searchQuery.error)}</Text>
            )}

            <FlatList
              data={searchQuery.data ?? []}
              keyExtractor={item => `${item.tmdbId}-${item.mediaType}`}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => {
                const key = `${item.tmdbId}-${item.mediaType}`
                const inWatchlist = watchlistedSet.has(key)
                const isAdding = addMutation.isPending &&
                  addMutation.variables?.tmdbId === item.tmdbId &&
                  addMutation.variables?.mediaType === item.mediaType

                return (
                  <TouchableOpacity
                    style={styles.card}
                    onPress={() => stackNav.navigate('MediaDetail', { tmdbId: item.tmdbId, mediaType: item.mediaType })}
                    activeOpacity={0.7}
                  >
                    {item.posterPath ? (
                      <Image
                        source={{ uri: `https://image.tmdb.org/t/p/w185${item.posterPath}` }}
                        style={styles.poster}
                      />
                    ) : (
                      <View style={[styles.poster, styles.posterFallback]} />
                    )}
                    <View style={styles.info}>
                      <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.meta}>
                        {[item.year, item.mediaType === 'tv' ? 'TV' : 'Movie'].filter(Boolean).join(' · ')}
                      </Text>
                      {item.genres.length > 0 && (
                        <Text style={styles.genres} numberOfLines={1}>
                          {item.genres.slice(0, 3).join(', ')}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[styles.addButton, inWatchlist && styles.addButtonSaved]}
                      onPress={() => { if (!inWatchlist) handleAdd(item) }}
                      disabled={inWatchlist || isAdding}
                    >
                      {isAdding
                        ? <ActivityIndicator size="small" color={colors.bg} />
                        : <Text style={styles.addButtonText}>{inWatchlist ? '✓' : '+'}</Text>}
                    </TouchableOpacity>
                  </TouchableOpacity>
                )
              }}
            />
          </View>
        ) : (
          <MoodSearchContent />
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { ...typography.heading, paddingHorizontal: spacing.lg, paddingTop: spacing.xs, marginBottom: spacing.sm },
  toggleContainer: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  togglePill: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleItem: { flex: 1, borderRadius: 20, overflow: 'hidden' },
  toggleActive: { borderRadius: 20, paddingVertical: 8, alignItems: 'center' },
  toggleActiveGold: { backgroundColor: colors.gold },
  toggleTextActiveGold: { fontSize: 13, fontWeight: '700', color: colors.bg },
  toggleTextActiveMood: { fontSize: 13, fontWeight: '700', color: 'white' },
  toggleTextInactive: {
    fontSize: 13, fontWeight: '600', color: colors.textDim,
    textAlign: 'center', paddingVertical: 8,
  },
  input: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
    marginBottom: spacing.xs,
  },
  spinner: { marginTop: spacing.lg },
  emptyText: { color: colors.textDim, textAlign: 'center', marginTop: 40, fontSize: 15 },
  errorText: {
    color: colors.error, textAlign: 'center',
    marginTop: spacing.sm, fontSize: 13, paddingHorizontal: spacing.lg,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  card: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    marginBottom: spacing.xs, borderRadius: radius.md,
    ...shadows.md,
  },
  poster: { width: 48, height: 72, borderRadius: radius.sm, marginRight: spacing.md },
  posterFallback: { backgroundColor: colors.border },
  info: { flex: 1, marginRight: spacing.md },
  title: { ...typography.subtitle, color: colors.text, marginBottom: 2 },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: 2 },
  genres: { ...typography.caption, color: colors.textMuted },
  addButton: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center',
  },
  addButtonSaved: { backgroundColor: colors.border },
  addButtonText: { color: colors.bg, fontSize: 18, fontWeight: '800', lineHeight: 20 },
})
```

- [ ] **Step 2: Check TypeScript**

```bash
cd /Users/mohitramchandani/Code/scout
npx tsc --noEmit 2>&1 | grep SearchScreen
```

Expected: no output. Fix any errors before continuing.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/SearchScreen.tsx
git commit -m "feat: refactor SearchScreen — add Titles/Mood toggle, render MoodSearchContent in mood mode"
```

---

## Task 5: Update PicksScreen CTA to navigate to Search tab

**Files:**
- Modify: `apps/mobile/src/screens/PicksScreen.tsx`

Change the mood button `onPress` from `navigation.navigate('MoodSearch')` to navigating to the Search tab via the parent tab navigator with `initialMode: 'mood'`.

- [ ] **Step 1: Add `NavigationProp` import**

At the top of `PicksScreen.tsx`, the existing import is:
```typescript
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
```

Replace with:
```typescript
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { NavigationProp } from '@react-navigation/native'
import type { TabParamList } from '../navigation/TabNavigator'
```

- [ ] **Step 2: Update the mood button `onPress`**

Find the current onPress:
```typescript
onPress={() => navigation.navigate('MoodSearch')}
```

Replace with:
```typescript
onPress={() => {
  const tabNav = navigation.getParent<NavigationProp<TabParamList>>()
  tabNav?.navigate('Search', { initialMode: 'mood' })
}}
```

- [ ] **Step 3: Check TypeScript**

```bash
cd /Users/mohitramchandani/Code/scout
npx tsc --noEmit 2>&1 | grep PicksScreen
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/screens/PicksScreen.tsx
git commit -m "feat: update Picks mood CTA to navigate to Search tab in mood mode"
```

---

## Task 6: Clean up MainNavigator and delete MoodSearchScreen

**Files:**
- Modify: `apps/mobile/src/navigation/MainNavigator.tsx`
- Delete: `apps/mobile/src/screens/MoodSearchScreen.tsx`

Remove the `MoodSearch` stack screen. All mood search logic now lives in `MoodSearchContent` rendered by `SearchScreen`.

- [ ] **Step 1: Replace `MainNavigator.tsx`**

```typescript
// apps/mobile/src/navigation/MainNavigator.tsx
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { TabNavigator } from './TabNavigator'
import { MediaDetailScreen } from '../screens/MediaDetailScreen'

export type RootStackParamList = {
  Main: undefined
  MediaDetail: { tmdbId: number; mediaType: 'movie' | 'tv' }
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen
        name="MediaDetail"
        component={MediaDetailScreen}
        options={{ presentation: 'card', animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  )
}
```

- [ ] **Step 2: Delete `MoodSearchScreen.tsx`**

```bash
rm /Users/mohitramchandani/Code/scout/apps/mobile/src/screens/MoodSearchScreen.tsx
```

- [ ] **Step 3: Full TypeScript check**

```bash
cd /Users/mohitramchandani/Code/scout
npx tsc --noEmit 2>&1
```

Expected: no output (zero errors). If `MoodSearch` is referenced anywhere else (other screens, imports), fix those now — search with:

```bash
grep -r "MoodSearch" apps/mobile/src/ --include="*.tsx" --include="*.ts"
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/navigation/MainNavigator.tsx
git rm apps/mobile/src/screens/MoodSearchScreen.tsx
git commit -m "chore: remove MoodSearch modal screen — mood search lives in Search tab"
```

---

## Task 7: Deploy and verify end-to-end

- [ ] **Step 1: Deploy the Workers update (enrichRecs fix)**

Already deployed in Task 1. Confirm it's current:

```bash
cd /Users/mohitramchandani/Code/scout/packages/api
npx wrangler deployments list 2>&1 | head -10
```

The top deployment should be the one from Task 1.

- [ ] **Step 2: Build a local APK and install**

```bash
cd /Users/mohitramchandani/Code/scout/apps/mobile
eas build --local --platform android --profile preview 2>&1 | tail -5
```

Then install:

```bash
adb install <path-to-apk>
```

- [ ] **Step 3: Manual verification checklist**

Test each of the following on device:

| Scenario | Expected |
|---|---|
| Open Search tab directly | Shows "Titles" mode active (gold), title search input visible |
| Tap "✦ Mood" toggle | Switches to mood mode — gradient header appears, search input changes to mood prompt |
| Tap "Titles" toggle | Switches back — standard search input |
| Type in title search | Debounced results appear |
| In mood mode: type a query + tap send | Spinner → results appear |
| Tap a recent search from history | Results appear (not a spinner) — confirms enrichRecs fix |
| Tap a result card | Navigates to MediaDetail |
| Tap Picks tab → "What are you in the mood for?" button | Jumps to Search tab, auto-activates mood mode |
| Tap Search tab icon directly after above | Stays on Search tab, no stale mood activation |

- [ ] **Step 4: Final commit push**

```bash
cd /Users/mohitramchandani/Code/scout
git log --oneline -6
git push origin main
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered in |
|---|---|
| `MoodSearchContent` component, self-contained | Task 2 |
| Direction C gradient header (violet→dark) on mood input | Task 2 |
| `SearchScreen` mode toggle (gold Titles / fuchsia Mood) | Task 4 |
| `useFocusEffect` activates mood mode from Picks param | Task 4 |
| `TabParamList` with `Search: { initialMode? }` | Task 3 |
| PicksScreen CTA → `getParent().navigate('Search', { initialMode: 'mood' })` | Task 5 |
| Remove `MoodSearch` from `RootStackParamList` and stack | Task 6 |
| Delete `MoodSearchScreen.tsx` | Task 6 |
| `enrichRecs` parallelized with `Promise.all` | Task 1 |

All spec requirements have a corresponding task. No gaps.
