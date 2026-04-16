import React, { useState } from 'react'
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  ActivityIndicator, StyleSheet, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/MainNavigator'
import { LinearGradient } from 'expo-linear-gradient'
import { trpc } from '../lib/trpc'
import { WatchingStatusModal } from '../components/WatchingStatusModal'
import { RatingModal } from '../components/RatingModal'
import { StatusSheet, type StatusAction } from '../components/StatusSheet'
import colors from '../theme/colors'
import { typography } from '../theme/typography'
import { spacing, radius, shadows } from '../theme/spacing'

const POSTER_BASE = 'https://image.tmdb.org/t/p/w342'
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/w780'
const PROFILE_BASE = 'https://image.tmdb.org/t/p/w185'
const LOGO_BASE = 'https://image.tmdb.org/t/p/w45'

type Props = NativeStackScreenProps<RootStackParamList, 'MediaDetail'>

type Provider = { providerName: string; logoPath: string }

function getStreamingProviders(watchProviders: Record<string, any>): Provider[] {
  const region = watchProviders['US'] ?? watchProviders[Object.keys(watchProviders)[0]] ?? {}
  return region.flatrate ?? region.rent ?? []
}

function formatScore(score: number): string {
  return score.toFixed(1)
}

export function MediaDetailScreen({ route, navigation }: Props) {
  const { tmdbId, mediaType } = route.params
  const [showWatchingModal, setShowWatchingModal] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [watchingTargetId, setWatchingTargetId] = useState<string | null>(null)
  const [isStartingWatch, setIsStartingWatch] = useState(false)
  const [showStatusSheet, setShowStatusSheet] = useState(false)

  const utils = trpc.useUtils()
  const mediaQuery = trpc.tmdb.getMedia.useQuery({ tmdbId, mediaType })
  const watchlistQuery = trpc.watchlist.list.useQuery({})
  const updateWatchingMutation = trpc.watchlist.updateWatching.useMutation()
  const addHistoryMutation = trpc.watchHistory.add.useMutation()
  const removeHistoryMutation = trpc.watchHistory.remove.useMutation({
    onSuccess: () => { utils.watchlist.list.invalidate(); historyQuery.refetch() },
  })
  const tasteProfileMutation = trpc.tasteProfile.updateFromRating.useMutation()
  const historyQuery = trpc.watchHistory.list.useQuery()
  const tagsQuery = trpc.tmdb.generateTags.useQuery(
    { tmdbId, mediaType },
    { enabled: showRatingModal, staleTime: Infinity }
  )

  const addMutation = trpc.watchlist.add.useMutation({
    onSuccess: (data) => {
      utils.watchlist.list.invalidate()
      setWatchingTargetId(data.id)
      if (mediaType === 'tv') {
        // Auto-set to S1E1 in-progress
        updateWatchingMutation.mutate(
          { id: data.id, watchingStatus: 'watching', currentSeason: 1, currentEpisode: 1 },
          { onSuccess: () => { utils.watchlist.list.invalidate(); setIsStartingWatch(false) } }
        )
      } else {
        setIsStartingWatch(false)
      }
    },
    onError: () => setIsStartingWatch(false),
  })
  const removeMutation = trpc.watchlist.remove.useMutation({
    onSuccess: () => utils.watchlist.list.invalidate(),
  })

  const watchlistItem = watchlistQuery.data?.find(
    (w: { id: string; tmdbId: number; mediaType: string; status: string }) =>
      w.tmdbId === tmdbId && w.mediaType === mediaType && w.status === 'saved'
  )
  const inWatchlist = !!watchlistItem

  const isWatched = historyQuery.data?.some(
    (h: { tmdbId: number; mediaType: string }) => h.tmdbId === tmdbId && h.mediaType === mediaType
  ) ?? false

  const watchlistEntry = watchlistQuery.data?.find(
    (w: any) => w.tmdbId === tmdbId && w.mediaType === mediaType
  )
  const isInProgress = watchlistEntry?.watchingStatus === 'watching'

  function handleWatchlistToggle() {
    if (!mediaQuery.data) return
    if (inWatchlist && watchlistItem) {
      removeMutation.mutate({ id: watchlistItem.id })
    } else {
      const m = mediaQuery.data
      addMutation.mutate({
        tmdbId: m.tmdbId,
        mediaType: m.mediaType,
        media: {
          title: m.title,
          posterPath: m.posterPath,
          year: m.year,
          genres: m.genres,
          overview: m.overview,
          runtime: m.runtime,
          watchProviders: (m.watchProviders ?? {}) as Record<string, unknown>,
        },
      })
    }
  }

  function handleWatchingStatusSubmit(watchingStatus: 'not_started' | 'watching', season?: number, episode?: number) {
    const targetId = watchingTargetId ?? watchlistEntry?.id
    if (!targetId) return
    updateWatchingMutation.mutate(
      { id: targetId, watchingStatus, currentSeason: season, currentEpisode: episode },
      { onSuccess: () => { setShowWatchingModal(false); utils.watchlist.list.invalidate() } }
    )
  }

  function handleStartWatching() {
    if (!mediaQuery.data) return
    const m = mediaQuery.data
    if (watchlistEntry) {
      // Optimistic update — immediately mark as watching so UI responds instantly
      const snapshot = utils.watchlist.list.getData({})
      utils.watchlist.list.setData({}, (old: any) =>
        old?.map((w: any) => w.id === watchlistEntry.id
          ? { ...w, watchingStatus: 'watching', currentSeason: 1, currentEpisode: 1 }
          : w
        )
      )
      updateWatchingMutation.mutate(
        { id: watchlistEntry.id, watchingStatus: 'watching', currentSeason: 1, currentEpisode: 1 },
        {
          onSuccess: () => utils.watchlist.list.invalidate(),
          onError: () => utils.watchlist.list.setData({}, snapshot),
        }
      )
    } else {
      // Add to watchlist first — isStartingWatch keeps the button locked until the full chain finishes
      setIsStartingWatch(true)
      addMutation.mutate({
        tmdbId: m.tmdbId,
        mediaType: m.mediaType,
        media: {
          title: m.title,
          posterPath: m.posterPath,
          year: m.year,
          genres: m.genres,
          overview: m.overview,
          runtime: m.runtime,
          watchProviders: (m.watchProviders ?? {}) as Record<string, unknown>,
        },
      })
    }
  }

  function handleEditProgress() {
    setWatchingTargetId(watchlistEntry?.id ?? null)
    setShowWatchingModal(true)
  }

  function handleRemoveWatched() {
    removeHistoryMutation.mutate({ tmdbId, mediaType })
  }

  function handleRatingSubmit(score: number, tags: string[]) {
    if (!mediaQuery.data) return
    const m = mediaQuery.data
    addHistoryMutation.mutate(
      {
        tmdbId,
        mediaType,
        score,
        tags,
        media: {
          title: m.title,
          posterPath: m.posterPath,
          year: m.year,
          genres: m.genres,
          overview: m.overview,
          runtime: m.runtime,
          watchProviders: (m.watchProviders ?? {}) as Record<string, unknown>,
        },
      },
      {
        onSuccess: () => {
          if (m.genres.length > 0) tasteProfileMutation.mutate({ score, genres: m.genres })
          setShowRatingModal(false)
          historyQuery.refetch()
        },
      }
    )
  }

  const isTogglingWatchlist = addMutation.isPending || removeMutation.isPending

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

  if (mediaQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    )
  }

  if (mediaQuery.isError || !mediaQuery.data) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.errorText}>Failed to load. Try again.</Text>
      </SafeAreaView>
    )
  }

  const media = mediaQuery.data
  const providers = getStreamingProviders(media.watchProviders as Record<string, any>)

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Backdrop with gradient fade */}
        {media.backdropPath ? (
          <View style={styles.backdropContainer}>
            <Image
              source={{ uri: `${BACKDROP_BASE}${media.backdropPath}` }}
              style={styles.backdrop}
            />
            <LinearGradient
              colors={['transparent', colors.bg]}
              style={styles.backdropFade}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
          </View>
        ) : null}

        {/* Hero row */}
        <View style={styles.hero}>
          {media.posterPath ? (
            <View style={styles.posterContainer}>
              <Image source={{ uri: `${POSTER_BASE}${media.posterPath}` }} style={styles.poster} />
            </View>
          ) : (
            <View style={[styles.poster, styles.posterFallback]} />
          )}
          <View style={styles.heroInfo}>
            <Text style={styles.title}>{media.title}</Text>

            {media.tagline ? (
              <Text style={styles.tagline}>{media.tagline}</Text>
            ) : null}

            {/* Meta row: year · type · runtime */}
            <Text style={styles.meta}>
              {[
                media.year,
                media.mediaType === 'tv' ? 'TV Series' : 'Movie',
                media.runtime ? `${media.runtime}m` : null,
              ].filter(Boolean).join(' · ')}
            </Text>

            {/* TV extra: seasons / episodes / status */}
            {media.mediaType === 'tv' && (
              <Text style={styles.meta}>
                {[
                  media.numberOfSeasons ? `${media.numberOfSeasons} season${media.numberOfSeasons !== 1 ? 's' : ''}` : null,
                  media.numberOfEpisodes ? `${media.numberOfEpisodes} eps` : null,
                  media.statusText,
                ].filter(Boolean).join(' · ')}
              </Text>
            )}

            {/* Score + content rating */}
            <View style={styles.badgeRow}>
              {media.voteAverage != null && media.voteAverage > 0 ? (
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreStar}>★</Text>
                  <Text style={styles.scoreText}>{formatScore(media.voteAverage)}</Text>
                </View>
              ) : null}
              {media.contentRating ? (
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingText}>{media.contentRating}</Text>
                </View>
              ) : null}
            </View>

            {media.genres.length > 0 && (
              <Text style={styles.genres}>{media.genres.join(', ')}</Text>
            )}

            {/* Network (TV) */}
            {media.network ? (
              <Text style={styles.network}>{media.network}</Text>
            ) : null}

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
          </View>
        </View>

        {/* Overview */}
        {media.overview ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>OVERVIEW</Text>
            <Text style={styles.overview}>{media.overview}</Text>
          </View>
        ) : null}

        {/* Director / Created by */}
        {media.director ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DIRECTOR</Text>
            <Text style={styles.bodyText}>{media.director}</Text>
          </View>
        ) : null}
        {media.createdBy && media.createdBy.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CREATED BY</Text>
            <Text style={styles.bodyText}>{media.createdBy.join(', ')}</Text>
          </View>
        ) : null}

        {/* Cast */}
        {media.cast && media.cast.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CAST</Text>
            <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} style={styles.castScroll}>
              {media.cast.map((member, i) => (
                <View key={`${member.name}-${i}`} style={styles.castItem}>
                  {member.profilePath ? (
                    <Image
                      source={{ uri: `${PROFILE_BASE}${member.profilePath}` }}
                      style={styles.castPhoto}
                    />
                  ) : (
                    <View style={[styles.castPhoto, styles.castPhotoFallback]} />
                  )}
                  <Text style={styles.castName} numberOfLines={2}>{member.name}</Text>
                  <Text style={styles.castCharacter} numberOfLines={2}>{member.character}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Streaming */}
        {providers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>WHERE TO WATCH</Text>
            <View style={styles.providerRow}>
              {providers.slice(0, 6).map((p, i) => (
                <View key={`${p.providerName ?? i}-${i}`} style={styles.providerItem}>
                  <Image
                    source={{ uri: `${LOGO_BASE}${p.logoPath}` }}
                    style={styles.providerLogo}
                  />
                  <Text style={styles.providerName} numberOfLines={2}>{p.providerName}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <WatchingStatusModal
        visible={showWatchingModal}
        mediaType={mediaType}
        title={mediaQuery.data?.title ?? ''}
        totalSeasons={mediaQuery.data?.numberOfSeasons ?? null}
        initialSeason={watchlistEntry?.currentSeason ?? null}
        initialEpisode={watchlistEntry?.currentEpisode ?? null}
        onClose={() => setShowWatchingModal(false)}
        onSubmit={handleWatchingStatusSubmit}
        isPending={updateWatchingMutation.isPending}
      />

      <RatingModal
        visible={showRatingModal}
        title={mediaQuery.data?.title ?? ''}
        tags={tagsQuery.data ?? mediaQuery.data?.genres ?? []}
        onClose={() => setShowRatingModal(false)}
        onSubmit={handleRatingSubmit}
        isPending={addHistoryMutation.isPending}
      />

      <StatusSheet
        visible={showStatusSheet}
        title={media.title}
        actions={statusActions}
        onClose={() => setShowStatusSheet(false)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loadingContainer: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

  backButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  backButtonText: { ...typography.subtitle, color: colors.gold },

  backdropContainer: { position: 'relative' },
  backdrop: { width: '100%', height: 210, resizeMode: 'cover' },
  backdropFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 },

  scroll: { paddingBottom: spacing['3xl'] },

  hero: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.xxl, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  posterContainer: { borderRadius: radius.lg },
  poster: { width: 110, height: 165, borderRadius: radius.lg },
  posterFallback: { backgroundColor: colors.surfaceHigh },
  heroInfo: { flex: 1, justifyContent: 'flex-start', gap: spacing.xs },

  title: { ...typography.heading, color: colors.text, flexShrink: 1, marginBottom: spacing.xs },
  tagline: { ...typography.caption, fontStyle: 'italic', color: colors.textMuted, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textSoft },
  genres: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
  network: { ...typography.caption, color: colors.textMuted, ...({ fontFamily: 'Outfit_600SemiBold' } as any), marginTop: spacing.xs },

  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xxs, alignItems: 'center' },
  scoreBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xxs,
    backgroundColor: colors.goldSubtle,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  scoreStar: { ...typography.caption, color: colors.gold },
  scoreText: { ...typography.micro, color: colors.gold, fontFamily: 'Outfit_700Bold' },
  ratingBadge: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.tight, paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs,
  },
  ratingText: { ...typography.micro, color: colors.textMuted },

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

  section: { marginBottom: spacing.xxl, paddingHorizontal: spacing.lg },
  sectionLabel: { ...typography.label, color: colors.gold, marginBottom: spacing.md, letterSpacing: 0.8 },
  overview: { ...typography.body, color: colors.textSoft, lineHeight: 22 },
  bodyText: { ...typography.body, color: colors.textSoft, lineHeight: 22 },

  castScroll: { marginHorizontal: -spacing.xs },
  castItem: { width: 72, marginHorizontal: spacing.xs },
  castPhoto: { width: 64, height: 96, borderRadius: radius.md, marginBottom: spacing.sm, backgroundColor: colors.surfaceRaised, ...shadows.sm },
  castPhotoFallback: { backgroundColor: colors.surfaceHigh },
  castName: { ...typography.micro, color: colors.text, fontFamily: 'Outfit_600SemiBold', lineHeight: 14, marginBottom: spacing.xxs },
  castCharacter: { ...typography.micro, color: colors.textDim, lineHeight: 13 },

  providerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  providerItem: { alignItems: 'center', width: 56 },
  providerLogo: { width: 40, height: 40, borderRadius: radius.md, marginBottom: spacing.sm, backgroundColor: colors.surfaceRaised, ...shadows.sm },
  providerName: { ...typography.micro, textAlign: 'center', color: colors.textMuted },

  errorText: { ...typography.body, color: colors.error, textAlign: 'center', marginTop: spacing['3xl'] },
})
