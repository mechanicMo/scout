import React, { useState, useMemo, useRef } from 'react'
import {
  View, Text, FlatList, Image, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, Animated, PanResponder,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { colors, typography, spacing, radius, shadows } from '../theme'
import { useMoodSearch, useMoodSearchHistory, useMoodSearchRefresh } from '../hooks/useMoodSearch'
import { useWatchlist, useAddToWatchlist, useUpdateWatchlistStatus } from '../hooks/useWatchlist'
import { useWatchHistory, useAddToHistory } from '../hooks/useWatchHistory'
import { useUpdateFromRating } from '../hooks/useTasteProfile'
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
  const [searchResults, setSearchResults] = useState<any[]>([])
  const historyQuery = useMoodSearchHistory()
  const searchMutation = useMoodSearch()
  const refreshMutation = useMoodSearchRefresh()
  const watchlistQuery = useWatchlist()
  const addMutation = useAddToWatchlist()
  const updateStatusMutation = useUpdateWatchlistStatus()
  const addHistoryMutation = useAddToHistory()
  const tasteProfileMutation = useUpdateFromRating()

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
    searchMutation.mutate({ query: searchText.trim() })
  }

  function handleAdd(item: any) {
    addMutation.mutate({ ...item, runtime: null })
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
    await addMutation.mutateAsync({ ...target, runtime: null })
    const list = watchlistQuery.data ?? []
    const item = list.find((w: any) => w.tmdbId === target.tmdbId && w.mediaType === target.mediaType)
    if (item) updateStatusMutation.mutate({ id: item.id, status, resurfaceAfter })
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
      { item: { ...target, runtime: null }, score, tags },
      { onSuccess: () => { if (target.genres.length > 0) tasteProfileMutation.mutate({ score, genres: target.genres }) } }
    )
  }

  // ── History view ──────────────────────────────────────────────────────────
  if (!selectedSearchId) {
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient
          colors={['#1a0930', '#0e0520', colors.bg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.3, y: 1 }}
          style={styles.gradientHeader}
        >
          <View>
            <TextInput
              style={styles.input}
              placeholder="Tell Scout what you're in the mood for..."
              placeholderTextColor="rgba(255,255,255,0.5)"
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
  const searchResults_data = searchMutation.data?.results ?? []
  const isLoading = searchMutation.isPending || refreshMutation.isPending

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
      ) : searchResults_data && searchResults_data.length > 0 ? (
        <FlatList
          data={searchResults_data.filter(item => {
            const key = `${item.tmdbId}-${item.mediaType}`
            return !passedIds.has(key)
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
        visible={!!ratingTarget} title={ratingTarget?.title ?? ''} tags={ratingTarget?.genres ?? []}
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
  input: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: 'rgba(192,38,211,0.4)',
    borderRadius: radius.md,
    padding: spacing.md,
    paddingRight: spacing.lg + 10,
    color: colors.text,
    fontSize: 15,
  },
  inlineSpinner: {
    position: 'absolute',
    right: spacing.md,
    top: '50%',
    width: 24,
    height: 24,
    marginTop: -12,
    pointerEvents: 'none',
  },
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
