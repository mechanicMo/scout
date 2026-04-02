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

  const listQuery = trpc.watchlist.list.useQuery({ status: 'saved' })
  const historyQuery = trpc.watchHistory.list.useQuery()

  const removeMutation = trpc.watchlist.remove.useMutation({
    onSuccess: () => listQuery.refetch(),
  })
  const updateStatusMutation = trpc.watchlist.updateStatus.useMutation({
    onSuccess: () => listQuery.refetch(),
  })
  const addHistoryMutation = trpc.watchHistory.add.useMutation({
    onSuccess: () => {
      // Remove from watchlist only after successful history insert
      if (ratingTarget) {
        removeMutation.mutate({ id: ratingTarget.id })
      }
      setRatingTarget(null)
      historyQuery.refetch()
      listQuery.refetch()
    },
  })

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
    addHistoryMutation.mutate({
      tmdbId: ratingTarget.tmdbId,
      mediaType: ratingTarget.mediaType,
      score,
      tags,
    })
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
                      <Text style={styles.notForMeText}>Not for me</Text>
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
        tags={ratingTarget?.genres ?? []}
        onClose={() => setRatingTarget(null)}
        onSubmit={handleRatingSubmit}
        isPending={addHistoryMutation.isPending}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#100a04', paddingTop: 56 },
  header: { fontSize: 28, fontWeight: '800', color: '#fff1e6', paddingHorizontal: 16, marginBottom: 12 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: '#2e1a0a',
  },
  tabActive: { backgroundColor: '#e8a020', borderColor: '#e8a020' },
  tabText: { color: '#5a3520', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#100a04' },
  spinner: { marginTop: 24 },
  emptyText: {
    color: '#3a2010', textAlign: 'center', marginTop: 48,
    fontSize: 15, lineHeight: 22, paddingHorizontal: 32,
  },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#1f1208',
  },
  poster: { width: 48, height: 72, borderRadius: 6, marginRight: 12 },
  posterFallback: { backgroundColor: '#2e1a0a' },
  info: { flex: 1 },
  title: { color: '#fff1e6', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  meta: { color: '#7a5535', fontSize: 12, marginBottom: 6 },
  score: { color: '#e8a020', fontSize: 13, letterSpacing: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  watchedButton: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, backgroundColor: '#e8a020',
  },
  watchedButtonText: { color: '#100a04', fontSize: 12, fontWeight: '700' },
  notForMeButton: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: '#2e1a0a',
  },
  notForMeText: { color: '#5a3520', fontSize: 12 },
})
