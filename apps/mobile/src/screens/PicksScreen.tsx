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
import { ScoutChatBar } from '../components/ScoutChatBar'
import { RatingModal } from '../components/RatingModal'
import { SurveyCard } from '../components/SurveyCard'
import type { RootStackParamList } from '../navigation/MainNavigator'
import type { MediaItem } from '@scout/shared'

type Nav = NativeStackNavigationProp<RootStackParamList>
const POSTER_BASE = 'https://image.tmdb.org/t/p/w185'

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

  const utils = trpc.useUtils()
  const aiRecsQuery = trpc.picks.aiRecs.useQuery(undefined, { retry: false })
  const trendingQuery = trpc.picks.trending.useQuery(undefined, {
    enabled: aiRecsQuery.isFetched && aiRecsQuery.data?.length === 0,
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
  const addMutation = trpc.watchlist.add.useMutation({ onSuccess: () => watchlistQuery.refetch() })
  const updateStatusMutation = trpc.watchlist.updateStatus.useMutation({ onSuccess: () => watchlistQuery.refetch() })
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

  const filteredItems = baseItems.filter(i => !dismissedIds.has(`${i.tmdbId}-${i.mediaType}`))

  // Insert survey card at position 2 (after 2 media items) if available
  const surveyCard = surveyQuery.data && !surveyDismissed
    ? { _type: 'survey' as const, question: surveyQuery.data.question, options: surveyQuery.data.options }
    : null

  const feedItems: FeedItem[] = surveyCard
    ? [...filteredItems.slice(0, 2), surveyCard, ...filteredItems.slice(2)]
    : filteredItems

  const isLoading = aiRecsQuery.isLoading || (aiRecsQuery.data?.length === 0 && trendingQuery.isLoading)
  const isSparseFallback = aiRecsQuery.isFetched && (aiRecsQuery.data?.length ?? 0) === 0 && (trendingQuery.data?.length ?? 0) > 0

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
    const target = ratingTarget
    addHistoryMutation.mutate(
      { tmdbId: target.tmdbId, mediaType: target.mediaType, score, tags, media: buildMediaPayload(target) },
      {
        onSuccess: () => {
          if (target.genres.length > 0) tasteProfileMutation.mutate({ score, genres: target.genres })
          setDismissedIds(prev => new Set([...prev, `${target.tmdbId}-${target.mediaType}`]))
          setRatingTarget(null)
        },
      }
    )
  }

  if (isLoading) return <View style={styles.centered}><ActivityIndicator color="#e8a020" size="large" /></View>

  const hasError = aiRecsQuery.isError && trendingQuery.isError
  if (hasError) return <View style={styles.centered}><Text style={styles.errorText}>Could not load picks.</Text></View>

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Picks</Text>
      <View style={styles.feedContainer}>
      <FlatList
        data={feedItems}
        keyExtractor={(item, i) => isSurveyItem(item) ? `survey-${i}` : `${item.tmdbId}-${item.mediaType}`}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
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
                onAnswer={answer => submitSurveyMutation.mutate({ question: item.question, answer })}
                onSkip={() => setSurveyDismissed(true)}
                isPending={submitSurveyMutation.isPending}
              />
            )
          }

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
  feedContainer: { flex: 1 },
  onboardingBanner: {
    backgroundColor: '#1a0f06',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a2010',
    padding: 16,
    marginBottom: 16,
  },
  onboardingTitle: { color: '#e8a020', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  onboardingBody: { color: '#7a5535', fontSize: 13, lineHeight: 19 },
})
