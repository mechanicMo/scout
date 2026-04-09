import React, { useState } from 'react'
import {
  View, Text, FlatList, Image, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { trpc } from '../lib/trpc'
import { DismissSheet } from '../components/DismissSheet'
import { RatingModal } from '../components/RatingModal'
import type { RootStackParamList } from '../navigation/MainNavigator'
import { colors, typography, spacing, radius, shadows } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>

const POSTER_BASE = 'https://image.tmdb.org/t/p/w185'

type ActionTarget = {
  id: string
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  genres: string[]
}

export function WatchlistScreen() {
  const navigation = useNavigation<Nav>()
  const [activeTab, setActiveTab] = useState<'upcoming' | 'watched'>('upcoming')
  const [dismissTarget, setDismissTarget] = useState<ActionTarget | null>(null)
  const [ratingTarget, setRatingTarget] = useState<ActionTarget | null>(null)

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
  const tagsQuery = trpc.tmdb.generateTags.useQuery(
    { tmdbId: ratingTarget?.tmdbId ?? 0, mediaType: ratingTarget?.mediaType ?? 'movie' },
    { enabled: !!ratingTarget }
  )

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
    addHistoryMutation.mutate(
      { tmdbId: target.tmdbId, mediaType: target.mediaType, score, tags },
      {
        onSuccess: () => {
          if (target.genres && target.genres.length > 0) {
            tasteProfileMutation.mutate({ score, genres: target.genres })
          }
          removeMutation.mutate({ id: target.id })
          setRatingTarget(null)
          historyQuery.refetch()
          listQuery.refetch()
        },
      }
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
          {(listQuery.isLoading || listQuery.isFetching) && (
            <ActivityIndicator color="#e8a020" style={styles.spinner} />
          )}

          {!listQuery.isLoading && !listQuery.isFetching && listQuery.data?.length === 0 && (
            <Text style={styles.emptyText}>
              Nothing saved yet.{'\n'}Search for something to watch.
            </Text>
          )}

          <FlatList
            data={listQuery.data ?? []}
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
      ) : (
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
      )}

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
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 56 },
  header: { ...typography.heading, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.sm, gap: spacing.xs },
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
  actions: { flexDirection: 'row', gap: spacing.xs },
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
