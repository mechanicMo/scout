import React from 'react'
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/MainNavigator'
import { trpc } from '../lib/trpc'

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

  const utils = trpc.useUtils()
  const mediaQuery = trpc.tmdb.getMedia.useQuery({ tmdbId, mediaType })
  const watchlistQuery = trpc.watchlist.list.useQuery({})

  const addMutation = trpc.watchlist.add.useMutation({
    onSuccess: () => utils.watchlist.list.invalidate(),
  })
  const removeMutation = trpc.watchlist.remove.useMutation({
    onSuccess: () => utils.watchlist.list.invalidate(),
  })

  const watchlistItem = watchlistQuery.data?.find(
    (w: { id: string; tmdbId: number; mediaType: string; status: string }) =>
      w.tmdbId === tmdbId && w.mediaType === mediaType && w.status === 'saved'
  )
  const inWatchlist = !!watchlistItem

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

  const isTogglingWatchlist = addMutation.isPending || removeMutation.isPending

  if (mediaQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#e8a020" size="large" />
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

        {/* Backdrop */}
        {media.backdropPath ? (
          <Image
            source={{ uri: `${BACKDROP_BASE}${media.backdropPath}` }}
            style={styles.backdrop}
          />
        ) : null}

        {/* Hero row */}
        <View style={styles.hero}>
          {media.posterPath ? (
            <Image source={{ uri: `${POSTER_BASE}${media.posterPath}` }} style={styles.poster} />
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

            <TouchableOpacity
              style={[styles.watchlistButton, inWatchlist && styles.watchlistButtonSaved]}
              onPress={handleWatchlistToggle}
              disabled={isTogglingWatchlist || watchlistQuery.isLoading}
            >
              {isTogglingWatchlist ? (
                <ActivityIndicator size="small" color="#100a04" />
              ) : (
                <Text style={[styles.watchlistButtonText, inWatchlist && styles.watchlistButtonTextSaved]}>
                  {inWatchlist ? '✓ In Watchlist' : '+ Add to Watchlist'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Overview */}
        {media.overview ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Overview</Text>
            <Text style={styles.overview}>{media.overview}</Text>
          </View>
        ) : null}

        {/* Director / Created by */}
        {media.director ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Director</Text>
            <Text style={styles.bodyText}>{media.director}</Text>
          </View>
        ) : null}
        {media.createdBy && media.createdBy.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Created by</Text>
            <Text style={styles.bodyText}>{media.createdBy.join(', ')}</Text>
          </View>
        ) : null}

        {/* Cast */}
        {media.cast && media.cast.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Cast</Text>
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
            <Text style={styles.sectionLabel}>Where to Watch</Text>
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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#100a04' },
  loadingContainer: { flex: 1, backgroundColor: '#100a04', alignItems: 'center', justifyContent: 'center' },
  backButton: { paddingHorizontal: 16, paddingVertical: 12 },
  backButtonText: { color: '#e8a020', fontSize: 15, fontWeight: '600' },
  backdrop: { width: '100%', height: 200, resizeMode: 'cover', marginBottom: 0 },
  scroll: { paddingBottom: 40 },
  hero: { flexDirection: 'row', gap: 14, marginBottom: 24, paddingHorizontal: 16, marginTop: 16 },
  poster: { width: 110, height: 165, borderRadius: 8 },
  posterFallback: { backgroundColor: '#2e1a0a' },
  heroInfo: { flex: 1, justifyContent: 'flex-start', gap: 4 },
  title: { color: '#fff1e6', fontSize: 18, fontWeight: '800', lineHeight: 24 },
  tagline: { color: '#7a5535', fontSize: 12, fontStyle: 'italic' },
  meta: { color: '#7a5535', fontSize: 11 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 2, alignItems: 'center' },
  scoreBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: '#2a1800', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  scoreStar: { color: '#e8a020', fontSize: 11 },
  scoreText: { color: '#e8a020', fontSize: 11, fontWeight: '700' },
  ratingBadge: {
    borderWidth: 1, borderColor: '#3a2010', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  ratingText: { color: '#7a5535', fontSize: 10, fontWeight: '600' },
  genres: { color: '#5a3520', fontSize: 11 },
  network: { color: '#7a5535', fontSize: 11, fontWeight: '600' },
  watchlistButton: {
    marginTop: 8, backgroundColor: '#e8a020',
    borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14,
    alignItems: 'center',
  },
  watchlistButtonSaved: { backgroundColor: '#2e1a0a', borderWidth: 1, borderColor: '#3a2010' },
  watchlistButtonText: { color: '#100a04', fontSize: 13, fontWeight: '700' },
  watchlistButtonTextSaved: { color: '#7a5535' },
  section: { marginBottom: 24, paddingHorizontal: 16 },
  sectionLabel: { color: '#7a5535', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  overview: { color: '#c8a87a', fontSize: 14, lineHeight: 21 },
  bodyText: { color: '#c8a87a', fontSize: 14 },
  castScroll: { marginHorizontal: -4 },
  castItem: { width: 72, marginHorizontal: 4 },
  castPhoto: { width: 64, height: 96, borderRadius: 8, marginBottom: 6 },
  castPhotoFallback: { backgroundColor: '#2e1a0a' },
  castName: { color: '#fff1e6', fontSize: 11, fontWeight: '600', lineHeight: 14 },
  castCharacter: { color: '#5a3520', fontSize: 10, lineHeight: 13, marginTop: 2 },
  providerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  providerItem: { alignItems: 'center', width: 56 },
  providerLogo: { width: 40, height: 40, borderRadius: 8, marginBottom: 4 },
  providerName: { color: '#7a5535', fontSize: 10, textAlign: 'center' },
  errorText: { color: '#e05020', textAlign: 'center', marginTop: 40, fontSize: 14 },
})
