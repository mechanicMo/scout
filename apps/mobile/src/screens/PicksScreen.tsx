import React, { useState } from 'react'
import {
  View, Text, FlatList, Image, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { trpc } from '../lib/trpc'
import { DismissSheet } from '../components/DismissSheet'
import { RatingModal } from '../components/RatingModal'
import type { RootStackParamList } from '../navigation/MainNavigator'
import type { MediaItem } from '@scout/shared'

type Nav = NativeStackNavigationProp<RootStackParamList>
const POSTER_BASE = 'https://image.tmdb.org/t/p/w185'

type FeedTarget = {
  tmdbId: number; mediaType: 'movie' | 'tv'; title: string
  genres: string[]; posterPath: string | null; year: number | null; overview: string
}

export function PicksScreen() {
  const navigation = useNavigation<Nav>()
  const [dismissTarget, setDismissTarget] = useState<FeedTarget | null>(null)
  const [ratingTarget, setRatingTarget] = useState<FeedTarget | null>(null)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  const trendingQuery = trpc.picks.trending.useQuery()
  const watchlistQuery = trpc.watchlist.list.useQuery({})
  const addMutation = trpc.watchlist.add.useMutation({ onSuccess: () => watchlistQuery.refetch() })
  const updateStatusMutation = trpc.watchlist.updateStatus.useMutation({ onSuccess: () => watchlistQuery.refetch() })
  const addHistoryMutation = trpc.watchHistory.add.useMutation()
  const tasteProfileMutation = trpc.tasteProfile.updateFromRating.useMutation()

  const watchlistedSet = new Set(
    watchlistQuery.data?.filter(i => i.status === 'saved').map(i => `${i.tmdbId}-${i.mediaType}`) ?? []
  )
  const items = (trendingQuery.data ?? []).filter(i => !dismissedIds.has(`${i.tmdbId}-${i.mediaType}`))

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
    await addMutation.mutateAsync({ tmdbId: target.tmdbId, mediaType: target.mediaType, media: buildMediaPayload(target) })
    await watchlistQuery.refetch()
    const item = watchlistQuery.data?.find(w => w.tmdbId === target.tmdbId && w.mediaType === target.mediaType)
    if (item) updateStatusMutation.mutate({ id: item.id, status, resurfaceAfter })
    setDismissedIds(prev => new Set([...prev, key]))
    setDismissTarget(null)
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
    addHistoryMutation.mutate(
      { tmdbId: ratingTarget.tmdbId, mediaType: ratingTarget.mediaType, score, tags, media: buildMediaPayload(ratingTarget) },
      {
        onSuccess: () => {
          if (ratingTarget.genres.length > 0) tasteProfileMutation.mutate({ score, genres: ratingTarget.genres })
          setDismissedIds(prev => new Set([...prev, `${ratingTarget.tmdbId}-${ratingTarget.mediaType}`]))
          setRatingTarget(null)
        },
      }
    )
  }

  if (trendingQuery.isLoading) return <View style={styles.centered}><ActivityIndicator color="#e8a020" size="large" /></View>
  if (trendingQuery.isError) return <View style={styles.centered}><Text style={styles.errorText}>Could not load picks.</Text></View>

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Picks</Text>
      <FlatList
        data={items}
        keyExtractor={item => `${item.tmdbId}-${item.mediaType}`}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const key = `${item.tmdbId}-${item.mediaType}`
          const inWatchlist = watchlistedSet.has(key)
          const isAdding = addMutation.isPending && addMutation.variables?.tmdbId === item.tmdbId && addMutation.variables?.mediaType === item.mediaType

          return (
            <TouchableOpacity
              style={styles.card}
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
                    onPress={() => setDismissTarget({ tmdbId: item.tmdbId, mediaType: item.mediaType, title: item.title, genres: item.genres, posterPath: item.posterPath, year: item.year, overview: item.overview })}
                  >
                    <Text style={styles.notForMeText}>Not for me</Text>
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
          )
        }}
      />
      <DismissSheet
        visible={!!dismissTarget} title={dismissTarget?.title ?? ''}
        onClose={() => setDismissTarget(null)} onNotNow={handleDismissNotNow}
        onAlreadyWatched={handleDismissAlreadyWatched} onNotInterested={handleDismissNotInterested}
      />
      <RatingModal
        visible={!!ratingTarget} title={ratingTarget?.title ?? ''} tags={ratingTarget?.genres ?? []}
        onClose={() => setRatingTarget(null)} onSubmit={handleRatingSubmit} isPending={addHistoryMutation.isPending}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#100a04' },
  centered: { flex: 1, backgroundColor: '#100a04', alignItems: 'center', justifyContent: 'center' },
  header: { fontSize: 28, fontWeight: '800', color: '#fff1e6', paddingHorizontal: 16, paddingTop: 8, marginBottom: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1208' },
  poster: { width: 64, height: 96, borderRadius: 8, marginRight: 14 },
  posterFallback: { backgroundColor: '#2e1a0a' },
  info: { flex: 1 },
  title: { color: '#fff1e6', fontSize: 15, fontWeight: '700', marginBottom: 2, lineHeight: 20 },
  meta: { color: '#7a5535', fontSize: 12, marginBottom: 4 },
  overview: { color: '#c8a87a', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  notForMeButton: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#2e1a0a' },
  notForMeText: { color: '#5a3520', fontSize: 12 },
  addButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#e8a020', alignItems: 'center', justifyContent: 'center' },
  addButtonSaved: { backgroundColor: '#2e1a0a' },
  addButtonText: { color: '#100a04', fontSize: 16, fontWeight: '800', lineHeight: 18 },
  errorText: { color: '#e05020', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
})
