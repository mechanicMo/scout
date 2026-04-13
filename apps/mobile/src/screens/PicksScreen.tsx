import React, { useState, useRef } from 'react'
import {
  View, Text, FlatList, Image, TouchableOpacity,
  ActivityIndicator, StyleSheet, RefreshControl, KeyboardAvoidingView, Platform,
  Animated, PanResponder,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { trpc } from '../lib/trpc'
import { DismissSheet } from '../components/DismissSheet'
import { ScoutChatBar } from '../components/ScoutChatBar'
import { RatingModal } from '../components/RatingModal'
import { SurveyCard } from '../components/SurveyCard'
import type { RootStackParamList } from '../navigation/MainNavigator'
import type { MediaItem } from '@scout/shared'
import { colors, typography, spacing, radius, shadows } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>
const POSTER_BASE = 'https://image.tmdb.org/t/p/w185'

function SwipeableCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  style,
}: {
  children: React.ReactNode
  onSwipeLeft: () => void
  onSwipeRight: () => void
  style?: object
}) {
  const translateX = useRef(new Animated.Value(0)).current

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy),
      onPanResponderMove: Animated.event([null, { dx: translateX }], { useNativeDriver: false }),
      onPanResponderRelease: (_, { dx, vx }) => {
        if (dx < -80 || vx < -0.5) {
          Animated.timing(translateX, { toValue: -500, duration: 200, useNativeDriver: false }).start(() => {
            translateX.setValue(0)
            onSwipeLeft()
          })
        } else if (dx > 80 || vx > 0.5) {
          Animated.timing(translateX, { toValue: 500, duration: 200, useNativeDriver: false }).start(() => {
            translateX.setValue(0)
            onSwipeRight()
          })
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: false }).start()
        }
      },
    })
  ).current

  // Fade in action backgrounds as card moves
  const addBgOpacity = translateX.interpolate({ inputRange: [0, 20], outputRange: [0, 1], extrapolate: 'clamp' })
  const passBgOpacity = translateX.interpolate({ inputRange: [-20, 0], outputRange: [1, 0], extrapolate: 'clamp' })
  // Scale up icon/label when past trigger threshold
  const addScale = translateX.interpolate({ inputRange: [0, 80], outputRange: [0.8, 1.1], extrapolate: 'clamp' })
  const passScale = translateX.interpolate({ inputRange: [-80, 0], outputRange: [1.1, 0.8], extrapolate: 'clamp' })

  return (
    <View style={style}>
      {/* Gold background — right swipe = Add */}
      <Animated.View style={[StyleSheet.absoluteFillObject, swipeStyles.addBg, { opacity: addBgOpacity }]}>
        <Animated.Text style={[swipeStyles.addLabel, { transform: [{ scale: addScale }] }]}>
          + Add
        </Animated.Text>
      </Animated.View>

      {/* Muted background — left swipe = Pass */}
      <Animated.View style={[StyleSheet.absoluteFillObject, swipeStyles.passBg, { opacity: passBgOpacity }]}>
        <Animated.Text style={[swipeStyles.passLabel, { transform: [{ scale: passScale }] }]}>
          Pass ✕
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
  addLabel: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: '700',
  },
  passBg: {
    backgroundColor: '#5a0a0a',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: spacing.lg + 10,
    borderRadius: radius.md,
  },
  passLabel: {
    color: '#ffaaaa',
    fontSize: 14,
    fontWeight: '700',
  },
})

type FeedTarget = {
  tmdbId: number; mediaType: 'movie' | 'tv'; title: string
  genres: string[]; posterPath: string | null; year: number | null; overview: string
}

type SurveyItem = { _type: 'survey'; question: string; options: string[] }
type FeedItem = MediaItem | SurveyItem

function isSurveyItem(item: FeedItem): item is SurveyItem {
  return '_type' in item && item._type === 'survey'
}

export function PicksScreen() {
  const navigation = useNavigation<Nav>()
  const [dismissTarget, setDismissTarget] = useState<FeedTarget | null>(null)
  const [ratingTarget, setRatingTarget] = useState<FeedTarget | null>(null)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [surveyDismissed, setSurveyDismissed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const lastRefreshAt = useRef(0)
  const REFRESH_COOLDOWN_MS = 60_000

  const utils = trpc.useUtils()
  const usageQuery = trpc.picks.usage.useQuery()
  const aiRecsQuery = trpc.picks.aiRecs.useQuery(undefined, { retry: false })
  const trendingQuery = trpc.picks.trending.useQuery(undefined, {
    enabled: aiRecsQuery.isFetched && (aiRecsQuery.data?.length === 0 || aiRecsQuery.isError),
  })
  const surveyQuery = trpc.survey.next.useQuery(undefined, { retry: false })
  const submitSurveyMutation = trpc.survey.submit.useMutation({
    onSuccess: () => {
      setSurveyDismissed(false)
      utils.picks.aiRecs.invalidate()
      utils.survey.next.invalidate()
    },
  })

  const watchlistQuery = trpc.watchlist.list.useQuery({})
  const addMutation = trpc.watchlist.add.useMutation({ onSuccess: () => utils.watchlist.list.invalidate() })
  const updateStatusMutation = trpc.watchlist.updateStatus.useMutation({ onSuccess: () => utils.watchlist.list.invalidate() })
  const addHistoryMutation = trpc.watchHistory.add.useMutation()
  const tasteProfileMutation = trpc.tasteProfile.updateFromRating.useMutation()
  const tagsQuery = trpc.tmdb.generateTags.useQuery(
    { tmdbId: ratingTarget?.tmdbId ?? 0, mediaType: ratingTarget?.mediaType ?? 'movie' },
    { enabled: !!ratingTarget }
  )
  const refineMutation = trpc.picks.refine.useMutation({
    onSuccess: (data) => {
      utils.picks.aiRecs.setData(undefined, data)
    },
  })

  // Use AI recs when available, fall back to trending
  const baseItems: MediaItem[] = (aiRecsQuery.data?.length ?? 0) > 0
    ? (aiRecsQuery.data ?? [])
    : (trendingQuery.data ?? [])

  const watchlistedSet = new Set(
    watchlistQuery.data?.filter(i => i.status === 'saved').map(i => `${i.tmdbId}-${i.mediaType}`) ?? []
  )

  const filteredItems = baseItems.filter(i => {
    const key = `${i.tmdbId}-${i.mediaType}`
    return !dismissedIds.has(key) && !watchlistedSet.has(key)
  })

  // Insert survey card at position 2 (after 2 media items) if available
  const surveyCard = surveyQuery.data && !surveyDismissed
    ? { _type: 'survey' as const, question: surveyQuery.data.question, options: surveyQuery.data.options }
    : null

  const feedItems: FeedItem[] = surveyCard
    ? [...filteredItems.slice(0, 2), surveyCard, ...filteredItems.slice(2)]
    : filteredItems

  const isLoading = aiRecsQuery.isLoading ||
    (aiRecsQuery.isFetched && (aiRecsQuery.data?.length === 0 || aiRecsQuery.isError) && trendingQuery.isLoading)
  const isSparseFallback = aiRecsQuery.isFetched && (aiRecsQuery.data?.length ?? 0) === 0 && (trendingQuery.data?.length ?? 0) > 0

  async function handleRefresh() {
    const now = Date.now()
    if (now - lastRefreshAt.current < REFRESH_COOLDOWN_MS) return
    lastRefreshAt.current = now
    setRefreshing(true)
    try {
      await Promise.allSettled([
        aiRecsQuery.refetch(),
        utils.watchlist.list.refetch(),
      ])
    } finally {
      setRefreshing(false)
    }
  }

  function buildMediaPayload(item: FeedTarget) {
    return {
      title: item.title, posterPath: item.posterPath, year: item.year,
      genres: item.genres, overview: item.overview, runtime: null, watchProviders: {},
    }
  }

  function handleAdd(item: MediaItem) {
    addMutation.mutate({ tmdbId: item.tmdbId, mediaType: item.mediaType, media: buildMediaPayload(item) })
  }

  async function dismissWithStatus(target: FeedTarget, status: 'dismissed_not_now' | 'dismissed_never', resurfaceAfter?: string) {
    const key = `${target.tmdbId}-${target.mediaType}`
    setDismissTarget(null)
    try {
      await addMutation.mutateAsync({ tmdbId: target.tmdbId, mediaType: target.mediaType, media: buildMediaPayload(target) })
      const { data } = await utils.watchlist.list.refetch()
      const item = data?.find(w => w.tmdbId === target.tmdbId && w.mediaType === target.mediaType)
      if (item) updateStatusMutation.mutate({ id: item.id, status, resurfaceAfter })
    } finally {
      setDismissedIds(prev => new Set([...prev, key]))
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
    setRatingTarget(dismissTarget)
    setDismissTarget(null)
  }

  function handleRatingSubmit(score: number, tags: string[]) {
    if (!ratingTarget) return
    const target = ratingTarget
    // Close modal and hide card immediately
    setRatingTarget(null)
    setDismissedIds(prev => new Set([...prev, `${target.tmdbId}-${target.mediaType}`]))
    // Continue API calls in background
    addHistoryMutation.mutate(
      { tmdbId: target.tmdbId, mediaType: target.mediaType, score, tags, media: buildMediaPayload(target) },
      {
        onSuccess: () => {
          if (target.genres.length > 0) tasteProfileMutation.mutate({ score, genres: target.genres })
        },
      }
    )
  }

  if (isLoading) return <View style={styles.centered}><ActivityIndicator color="#e8a020" size="large" /></View>

  const hasError = aiRecsQuery.isError && trendingQuery.isError
  if (hasError) return <View style={styles.centered}><Text style={styles.errorText}>Could not load picks.</Text></View>

  const refineUsed = usageQuery.data?.refine.used ?? 0
  const refineLimit = usageQuery.data?.refine.limit ?? 3
  const refineLeft = refineLimit - refineUsed

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Picks</Text>
        {usageQuery.data && (
          <View style={styles.usageBadge}>
            <Text style={styles.usageText}>
              {refineLeft}/{refineLimit} refines left
            </Text>
            <View style={styles.usageBar}>
              {Array.from({ length: refineLimit }).map((_, i) => (
                <View
                  key={i}
                  style={[styles.usagePip, i < refineLeft ? styles.usagePipFilled : styles.usagePipEmpty]}
                />
              ))}
            </View>
          </View>
        )}
      </View>
      <View style={styles.feedContainer}>
      <FlatList
        data={feedItems}
        keyExtractor={(item, i) => isSurveyItem(item) ? `survey-${i}` : `${item.tmdbId}-${item.mediaType}`}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#e8a020"
            colors={['#e8a020']}
          />
        }
        ListHeaderComponent={isSparseFallback ? (
          <View style={styles.onboardingBanner}>
            <Text style={styles.onboardingTitle}>Scout is getting to know you</Text>
            <Text style={styles.onboardingBody}>Rate a few titles to unlock personalized picks. The more you rate, the better Scout gets.</Text>
          </View>
        ) : null}
        renderItem={({ item }) => {
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

          const key = `${item.tmdbId}-${item.mediaType}`
          const inWatchlist = watchlistedSet.has(key)
          const isAdding = addMutation.isPending && addMutation.variables?.tmdbId === item.tmdbId && addMutation.variables?.mediaType === item.mediaType

          const dismissPayload = { tmdbId: item.tmdbId, mediaType: item.mediaType, title: item.title, genres: item.genres, posterPath: item.posterPath, year: item.year, overview: item.overview }
          return (
            <SwipeableCard
              style={styles.card}
              onSwipeLeft={() => setDismissTarget(dismissPayload)}
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
                  {item.overview.length > 0 && <Text style={styles.overview} numberOfLines={2}>{item.overview}</Text>}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.notForMeButton}
                      onPress={() => setDismissTarget(dismissPayload)}
                    >
                      <Text style={styles.notForMeText}>Pass</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.addButton, inWatchlist && styles.addButtonSaved]}
                      onPress={() => { if (!inWatchlist) handleAdd(item) }}
                      disabled={inWatchlist || isAdding}
                    >
                      {isAdding ? <ActivityIndicator size="small" color="#100a04" /> : <Text style={styles.addButtonText}>{inWatchlist ? '✓' : '+'}</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </SwipeableCard>
          )
        }}
      />
      </View>
      <ScoutChatBar
        onSubmit={message => refineMutation.mutate({ message })}
        isPending={refineMutation.isPending}
      />
      <DismissSheet
        visible={!!dismissTarget} title={dismissTarget?.title ?? ''}
        onClose={() => setDismissTarget(null)} onNotNow={handleDismissNotNow}
        onAlreadyWatched={handleDismissAlreadyWatched} onNotInterested={handleDismissNotInterested}
      />
      <RatingModal
        visible={!!ratingTarget} title={ratingTarget?.title ?? ''} tags={tagsQuery.data ?? ratingTarget?.genres ?? []}
        onClose={() => setRatingTarget(null)} onSubmit={handleRatingSubmit} isPending={addHistoryMutation.isPending}
      />
    </SafeAreaView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.xs, marginBottom: spacing.md },
  header: { ...typography.heading, color: colors.text },
  usageBadge: { alignItems: 'flex-end', gap: spacing.xs },
  usageText: { ...typography.micro, color: colors.textMuted },
  usageBar: { flexDirection: 'row', gap: spacing.xs },
  usagePip: { width: 20, height: 4, borderRadius: 2 },
  usagePipFilled: { backgroundColor: colors.gold },
  usagePipEmpty: { backgroundColor: colors.border },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  card: {
    backgroundColor: colors.surfaceRaised,
    marginBottom: spacing.xs,
    borderRadius: radius.md,
    ...shadows.md,
    overflow: 'hidden',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  poster: { width: 64, height: 96, borderRadius: radius.sm, marginRight: spacing.md },
  posterFallback: { backgroundColor: colors.border },
  info: { flex: 1 },
  title: { ...typography.title, color: colors.text, marginBottom: 2 },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  overview: { ...typography.body, color: colors.textSoft, marginBottom: spacing.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  notForMeButton: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  notForMeText: { color: colors.textMuted, fontSize: 12 },
  addButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  addButtonSaved: { backgroundColor: colors.border },
  addButtonText: { color: colors.bg, fontSize: 16, fontWeight: '800', lineHeight: 18 },
  errorText: { color: colors.error, fontSize: 14, textAlign: 'center', paddingHorizontal: spacing.lg },
  feedContainer: { flex: 1 },
  onboardingBanner: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  onboardingTitle: { color: colors.gold, fontSize: 13, fontWeight: '700', marginBottom: spacing.sm },
  onboardingBody: { ...typography.caption, color: colors.textMuted },
})
