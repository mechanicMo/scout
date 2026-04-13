import React, { useState, useMemo } from 'react'
import {
  View, Text, FlatList, Image, TouchableOpacity,
  ActivityIndicator, StyleSheet, ScrollView,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { trpc } from '../lib/trpc'
import { DismissSheet } from '../components/DismissSheet'
import { RatingModal } from '../components/RatingModal'
import { EpisodeStepper } from '../components/EpisodeStepper'
import { WatchingStatusModal } from '../components/WatchingStatusModal'
import type { RootStackParamList } from '../navigation/MainNavigator'
import { colors, typography, spacing, radius, shadows } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>

const POSTER_BASE = 'https://image.tmdb.org/t/p/w185'

type SortOption = 'added-newest' | 'added-oldest' | 'title-az' | 'title-za' | 'year-newest' | 'year-oldest'
type TypeFilter = 'all' | 'movie' | 'tv'

const SORT_LABELS: Record<SortOption, string> = {
  'added-newest': 'Newest added',
  'added-oldest': 'Oldest added',
  'title-az': 'Title A–Z',
  'title-za': 'Title Z–A',
  'year-newest': 'Year (new)',
  'year-oldest': 'Year (old)',
}
const SORT_OPTIONS: SortOption[] = ['added-newest', 'added-oldest', 'title-az', 'title-za', 'year-newest', 'year-oldest']

type ActionTarget = {
  id: string
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  genres: string[]
}

export function WatchlistScreen() {
  const navigation = useNavigation<Nav>()
  const [activeTab, setActiveTab] = useState<'upcoming' | 'in-progress' | 'watched'>('upcoming')
  const [dismissTarget, setDismissTarget] = useState<ActionTarget | null>(null)
  const [ratingTarget, setRatingTarget] = useState<ActionTarget | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('added-newest')
  const [filterType, setFilterType] = useState<TypeFilter>('all')
  const [filterGenres, setFilterGenres] = useState<string[]>([])
  const [showGenreFilter, setShowGenreFilter] = useState(false)
  const [episodeUpdateTarget, setEpisodeUpdateTarget] = useState<string | null>(null)
  const [manualSetTarget, setManualSetTarget] = useState<{
    id: string; mediaType: 'movie' | 'tv'; title: string; totalSeasons: number | null
  } | null>(null)

  const utils = trpc.useUtils()
  const listQuery = trpc.watchlist.list.useQuery({ status: 'saved' })
  const historyQuery = trpc.watchHistory.list.useQuery()

  const removeMutation = trpc.watchlist.remove.useMutation({
    onSuccess: () => utils.watchlist.list.invalidate(),
  })
  const updateStatusMutation = trpc.watchlist.updateStatus.useMutation({
    onSuccess: () => utils.watchlist.list.invalidate(),
  })
  const addHistoryMutation = trpc.watchHistory.add.useMutation()
  const tasteProfileMutation = trpc.tasteProfile.updateFromRating.useMutation()
  const updateWatchingMutation = trpc.watchlist.updateWatching.useMutation({
    onSuccess: () => {
      utils.watchlist.list.invalidate()
      setEpisodeUpdateTarget(null)
    },
  })
  const tagsQuery = trpc.tmdb.generateTags.useQuery(
    { tmdbId: ratingTarget?.tmdbId ?? 0, mediaType: ratingTarget?.mediaType ?? 'movie' },
    { enabled: !!ratingTarget, staleTime: Infinity }
  )

  const allGenres = useMemo(() => {
    const genres = new Set<string>()
    listQuery.data?.forEach(item => item.genres?.forEach((g: string) => genres.add(g)))
    return Array.from(genres).sort()
  }, [listQuery.data])

  const filteredAndSorted = useMemo(() => {
    let items = [...(listQuery.data ?? [])]
    if (filterType !== 'all') items = items.filter(i => i.mediaType === filterType)
    if (filterGenres.length > 0) items = items.filter(i => i.genres?.some((g: string) => filterGenres.includes(g)))
    switch (sortBy) {
      case 'added-oldest': items.reverse(); break
      case 'title-az': items.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '')); break
      case 'title-za': items.sort((a, b) => (b.title ?? '').localeCompare(a.title ?? '')); break
      case 'year-newest': items.sort((a, b) => (b.year ?? 0) - (a.year ?? 0)); break
      case 'year-oldest': items.sort((a, b) => (a.year ?? 0) - (b.year ?? 0)); break
    }
    return items
  }, [listQuery.data, filterType, filterGenres, sortBy])

  const inProgressItems = useMemo(() => {
    return (listQuery.data ?? []).filter(
      (item: { watchingStatus: string }) => item.watchingStatus === 'watching'
    )
  }, [listQuery.data])

  function cycleSortOption() {
    const idx = SORT_OPTIONS.indexOf(sortBy)
    setSortBy(SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length])
  }

  function toggleGenre(genre: string) {
    setFilterGenres(prev => prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre])
  }

  function handleDismissNotNow() {
    if (!dismissTarget) return
    const resurfaceDate = new Date()
    resurfaceDate.setDate(resurfaceDate.getDate() + 30)
    updateStatusMutation.mutate({
      id: dismissTarget.id,
      status: 'dismissed_not_now',
      resurfaceAfter: resurfaceDate.toISOString().split('T')[0],
    })
    setDismissTarget(null)
  }

  function handleDismissNotInterested() {
    if (!dismissTarget) return
    updateStatusMutation.mutate({ id: dismissTarget.id, status: 'dismissed_never' })
    setDismissTarget(null)
  }

  function handleDismissAlreadyWatched() {
    if (!dismissTarget) return
    setRatingTarget(dismissTarget)
    setDismissTarget(null)
  }

  function handleRatingSubmit(score: number, tags: string[]) {
    if (!ratingTarget) return
    const target = ratingTarget
    // Close modal immediately
    setRatingTarget(null)
    // Continue API calls in background
    addHistoryMutation.mutate(
      { tmdbId: target.tmdbId, mediaType: target.mediaType, score, tags },
      {
        onSuccess: () => {
          if (target.genres && target.genres.length > 0) {
            tasteProfileMutation.mutate({ score, genres: target.genres })
          }
          removeMutation.mutate({ id: target.id })
          historyQuery.refetch()
          listQuery.refetch()
        },
      }
    )
  }

  function handleNextEpisode(item: {
    id: string; currentSeason: number | null; currentEpisode: number | null;
    numberOfEpisodes: number | null; numberOfSeasons: number | null
  }) {
    const season = item.currentSeason ?? 1
    const episode = item.currentEpisode ?? 1
    const totalEps = item.numberOfEpisodes ?? 999
    const totalSeasons = item.numberOfSeasons ?? 999

    let nextSeason = season
    let nextEpisode = episode + 1

    // Simple season boundary: if past total episodes, advance season
    if (nextEpisode > totalEps && season < totalSeasons) {
      nextSeason = season + 1
      nextEpisode = 1
    }

    setEpisodeUpdateTarget(item.id)
    updateWatchingMutation.mutate({
      id: item.id,
      watchingStatus: 'watching',
      currentSeason: nextSeason,
      currentEpisode: nextEpisode,
    })
  }

  function handleManualSetSubmit(watchingStatus: 'not_started' | 'watching', season?: number, episode?: number) {
    if (!manualSetTarget) return
    updateWatchingMutation.mutate(
      {
        id: manualSetTarget.id,
        watchingStatus,
        currentSeason: season,
        currentEpisode: episode,
      },
      { onSuccess: () => setManualSetTarget(null) }
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Watchlist</Text>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'in-progress' && styles.tabActive]}
          onPress={() => setActiveTab('in-progress')}
        >
          <Text style={[styles.tabText, activeTab === 'in-progress' && styles.tabTextActive]}>
            In Progress{inProgressItems.length > 0 ? ` (${inProgressItems.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'watched' && styles.tabActive]}
          onPress={() => setActiveTab('watched')}
        >
          <Text style={[styles.tabText, activeTab === 'watched' && styles.tabTextActive]}>
            Watched
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'upcoming' ? (
        <>
          <View style={styles.controlsRow}>
            <TouchableOpacity style={styles.sortButton} onPress={cycleSortOption}>
              <Text style={styles.sortButtonText}>↑↓ {SORT_LABELS[sortBy]}</Text>
            </TouchableOpacity>
            <View style={styles.typeChips}>
              {(['all', 'movie', 'tv'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, filterType === t && styles.typeChipActive]}
                  onPress={() => setFilterType(t)}
                >
                  <Text style={[styles.typeChipText, filterType === t && styles.typeChipTextActive]}>
                    {t === 'all' ? 'All' : t === 'movie' ? 'Movies' : 'TV'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {allGenres.length > 0 && (
              <TouchableOpacity onPress={() => setShowGenreFilter(v => !v)}>
                <Text style={[styles.sortButtonText, filterGenres.length > 0 && styles.sortButtonTextActive]}>
                  Genre{filterGenres.length > 0 ? ` (${filterGenres.length})` : ' ▾'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {showGenreFilter && allGenres.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreScroll} contentContainerStyle={styles.genreScrollContent}>
              {allGenres.map(genre => (
                <TouchableOpacity
                  key={genre}
                  style={[styles.genreChip, filterGenres.includes(genre) && styles.genreChipActive]}
                  onPress={() => toggleGenre(genre)}
                >
                  <Text style={[styles.genreChipText, filterGenres.includes(genre) && styles.genreChipTextActive]}>
                    {genre}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {(listQuery.isLoading || listQuery.isFetching) && (
            <ActivityIndicator color="#e8a020" style={styles.spinner} />
          )}

          {!listQuery.isLoading && !listQuery.isFetching && filteredAndSorted.length === 0 && (
            <Text style={styles.emptyText}>
              {listQuery.data?.length === 0 ? 'Nothing saved yet.\nSearch for something to watch.' : 'No items match your filters.'}
            </Text>
          )}

          <FlatList
            data={filteredAndSorted}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('MediaDetail', { tmdbId: item.tmdbId, mediaType: item.mediaType })}
                activeOpacity={0.7}
              >
                {item.posterPath ? (
                  <Image
                    source={{ uri: `${POSTER_BASE}${item.posterPath}` }}
                    style={styles.poster}
                  />
                ) : (
                  <View style={[styles.poster, styles.posterFallback]} />
                )}
                <View style={styles.info}>
                  <Text style={styles.title} numberOfLines={2}>
                    {item.title ?? 'Untitled'}
                  </Text>
                  <Text style={styles.meta}>
                    {[item.year, item.mediaType === 'tv' ? 'TV' : 'Movie']
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.watchedButton}
                      onPress={() => setRatingTarget({
                        id: item.id,
                        tmdbId: item.tmdbId,
                        mediaType: item.mediaType,
                        title: item.title ?? 'Untitled',
                        genres: item.genres ?? [],
                      })}
                    >
                      <Text style={styles.watchedButtonText}>Watched</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.notForMeButton}
                      onPress={() => setDismissTarget({
                        id: item.id,
                        tmdbId: item.tmdbId,
                        mediaType: item.mediaType,
                        title: item.title ?? 'Untitled',
                        genres: item.genres ?? [],
                      })}
                    >
                      <Text style={styles.notForMeText}>Pass</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </>
      ) : activeTab === 'in-progress' ? (
        <>
          {(listQuery.isLoading || listQuery.isFetching) && (
            <ActivityIndicator color="#e8a020" style={styles.spinner} />
          )}

          {!listQuery.isLoading && !listQuery.isFetching && inProgressItems.length === 0 && (
            <Text style={styles.emptyText}>
              No shows in progress.{'\n'}Mark a show as "watching" to track your progress.
            </Text>
          )}

          <FlatList
            data={inProgressItems}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('MediaDetail', { tmdbId: item.tmdbId, mediaType: item.mediaType })}
                activeOpacity={0.7}
              >
                {item.posterPath ? (
                  <Image
                    source={{ uri: `${POSTER_BASE}${item.posterPath}` }}
                    style={styles.poster}
                  />
                ) : (
                  <View style={[styles.poster, styles.posterFallback]} />
                )}
                <View style={styles.info}>
                  <Text style={styles.title} numberOfLines={2}>
                    {item.title ?? 'Untitled'}
                  </Text>
                  <Text style={styles.meta}>
                    {[item.year, item.mediaType === 'tv' ? 'TV' : 'Movie']
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {item.mediaType === 'tv' && (
                    <EpisodeStepper
                      currentSeason={item.currentSeason ?? 1}
                      currentEpisode={item.currentEpisode ?? 1}
                      totalSeasons={item.numberOfSeasons ?? null}
                      totalEpisodes={item.numberOfEpisodes ?? null}
                      onAdvance={() => handleNextEpisode(item)}
                      onSetManually={() => setManualSetTarget({
                        id: item.id,
                        mediaType: item.mediaType,
                        title: item.title ?? 'Untitled',
                        totalSeasons: item.numberOfSeasons ?? null,
                      })}
                      isPending={episodeUpdateTarget === item.id && updateWatchingMutation.isPending}
                    />
                  )}
                  <View style={[styles.actions, { marginTop: spacing.sm }]}>
                    <TouchableOpacity
                      style={styles.watchedButton}
                      onPress={() => setRatingTarget({
                        id: item.id,
                        tmdbId: item.tmdbId,
                        mediaType: item.mediaType,
                        title: item.title ?? 'Untitled',
                        genres: item.genres ?? [],
                      })}
                    >
                      <Text style={styles.watchedButtonText}>Finished</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </>
      ) : activeTab === 'watched' ? (
        <>
          {(historyQuery.isLoading || historyQuery.isFetching) && (
            <ActivityIndicator color="#e8a020" style={styles.spinner} />
          )}

          {!historyQuery.isLoading && !historyQuery.isFetching && historyQuery.data?.length === 0 && (
            <Text style={styles.emptyText}>
              Nothing watched yet.{'\n'}Mark items as watched from your Upcoming list.
            </Text>
          )}

          <FlatList
            data={historyQuery.data ?? []}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('MediaDetail', { tmdbId: item.tmdbId, mediaType: item.mediaType })}
                activeOpacity={0.7}
              >
                {item.posterPath ? (
                  <Image
                    source={{ uri: `${POSTER_BASE}${item.posterPath}` }}
                    style={styles.poster}
                  />
                ) : (
                  <View style={[styles.poster, styles.posterFallback]} />
                )}
                <View style={styles.info}>
                  <Text style={styles.title} numberOfLines={2}>{item.title ?? 'Untitled'}</Text>
                  <Text style={styles.meta}>
                    {[item.year, item.mediaType === 'tv' ? 'TV' : 'Movie']
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {item.overallScore != null && (
                    <Text style={styles.score}>
                      {'★'.repeat(item.overallScore)}{'☆'.repeat(5 - item.overallScore)}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
        </>
      ) : null}

      <DismissSheet
        visible={!!dismissTarget}
        title={dismissTarget?.title ?? ''}
        onClose={() => setDismissTarget(null)}
        onNotNow={handleDismissNotNow}
        onAlreadyWatched={handleDismissAlreadyWatched}
        onNotInterested={handleDismissNotInterested}
      />

      <RatingModal
        visible={!!ratingTarget}
        title={ratingTarget?.title ?? ''}
        tags={tagsQuery.data ?? ratingTarget?.genres ?? []}
        onClose={() => setRatingTarget(null)}
        onSubmit={handleRatingSubmit}
        isPending={addHistoryMutation.isPending}
      />

      {manualSetTarget && (
        <WatchingStatusModal
          visible={!!manualSetTarget}
          mediaType={manualSetTarget.mediaType}
          title={manualSetTarget.title}
          totalSeasons={manualSetTarget.totalSeasons}
          onClose={() => setManualSetTarget(null)}
          onSubmit={handleManualSetSubmit}
          isPending={updateWatchingMutation.isPending}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 56 },
  header: { ...typography.heading, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.xs, gap: spacing.xs },
  controlsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  sortButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  sortButtonText: { ...typography.caption, color: colors.textMuted },
  sortButtonTextActive: { color: colors.gold },
  typeChips: { flexDirection: 'row', gap: spacing.xs },
  typeChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  typeChipActive: { backgroundColor: colors.goldSubtle, borderColor: colors.goldBorder },
  typeChipText: { ...typography.caption, color: colors.textMuted },
  typeChipTextActive: { color: colors.gold },
  genreScroll: { maxHeight: 36, marginBottom: spacing.xs },
  genreScrollContent: { paddingHorizontal: spacing.lg, gap: spacing.xs, alignItems: 'center' },
  genreChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xxs, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  genreChipActive: { backgroundColor: colors.goldSubtle, borderColor: colors.goldBorder },
  genreChipText: { ...typography.caption, color: colors.textMuted },
  genreChipTextActive: { color: colors.gold },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  tabText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: colors.bg },
  spinner: { marginTop: spacing.lg },
  emptyText: {
    color: colors.textDim,
    textAlign: 'center',
    marginTop: 48,
    ...typography.body,
    paddingHorizontal: spacing.lg,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    marginBottom: spacing.xs,
    borderRadius: radius.md,
    ...shadows.md,
  },
  poster: { width: 48, height: 72, borderRadius: radius.sm, marginRight: spacing.md },
  posterFallback: { backgroundColor: colors.border },
  info: { flex: 1 },
  title: { ...typography.subtitle, color: colors.text, marginBottom: 2 },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  score: { color: colors.gold, fontSize: 13, letterSpacing: 1 },
  actions: { flexDirection: 'row', gap: spacing.md },
  watchedButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.gold,
  },
  watchedButtonText: { color: colors.bg, fontSize: 12, fontWeight: '700' },
  notForMeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notForMeText: { color: colors.textMuted, fontSize: 12 },
})
