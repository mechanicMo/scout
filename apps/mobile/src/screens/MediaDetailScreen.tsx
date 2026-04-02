import React from 'react'
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  ActivityIndicator, StyleSheet, SafeAreaView,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/MainNavigator'
import { trpc } from '../lib/trpc'

const POSTER_BASE = 'https://image.tmdb.org/t/p/w342'
const LOGO_BASE = 'https://image.tmdb.org/t/p/w45'

type Props = NativeStackScreenProps<RootStackParamList, 'MediaDetail'>

type Provider = { provider_name: string; logo_path: string }

function getStreamingProviders(watchProviders: Record<string, any>): Provider[] {
  const region = watchProviders['US'] ?? watchProviders[Object.keys(watchProviders)[0]] ?? {}
  return region.flatrate ?? region.rent ?? []
}

export function MediaDetailScreen({ route, navigation }: Props) {
  const { tmdbId, mediaType } = route.params

  const mediaQuery = trpc.tmdb.getMedia.useQuery({ tmdbId, mediaType })
  const watchlistQuery = trpc.watchlist.list.useQuery({})

  const addMutation = trpc.watchlist.add.useMutation({
    onSuccess: () => watchlistQuery.refetch(),
  })
  const removeMutation = trpc.watchlist.remove.useMutation({
    onSuccess: () => watchlistQuery.refetch(),
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
          watchProviders: m.watchProviders,
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
        {/* Hero row */}
        <View style={styles.hero}>
          {media.posterPath ? (
            <Image source={{ uri: `${POSTER_BASE}${media.posterPath}` }} style={styles.poster} />
          ) : (
            <View style={[styles.poster, styles.posterFallback]} />
          )}
          <View style={styles.heroInfo}>
            <Text style={styles.title}>{media.title}</Text>
            <Text style={styles.meta}>
              {[media.year, media.mediaType === 'tv' ? 'TV Series' : 'Movie', media.runtime ? `${media.runtime}m` : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {media.genres.length > 0 && (
              <Text style={styles.genres}>{media.genres.join(', ')}</Text>
            )}

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

        {/* Streaming */}
        {providers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Where to Watch</Text>
            <View style={styles.providerRow}>
              {providers.slice(0, 6).map((p) => (
                <View key={p.provider_name} style={styles.providerItem}>
                  <Image
                    source={{ uri: `${LOGO_BASE}${p.logo_path}` }}
                    style={styles.providerLogo}
                  />
                  <Text style={styles.providerName} numberOfLines={2}>{p.provider_name}</Text>
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
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  hero: { flexDirection: 'row', gap: 14, marginBottom: 24 },
  poster: { width: 110, height: 165, borderRadius: 8 },
  posterFallback: { backgroundColor: '#2e1a0a' },
  heroInfo: { flex: 1, justifyContent: 'flex-start', gap: 6 },
  title: { color: '#fff1e6', fontSize: 18, fontWeight: '800', lineHeight: 24 },
  meta: { color: '#7a5535', fontSize: 12 },
  genres: { color: '#5a3520', fontSize: 12 },
  watchlistButton: {
    marginTop: 10, backgroundColor: '#e8a020',
    borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14,
    alignItems: 'center',
  },
  watchlistButtonSaved: { backgroundColor: '#2e1a0a', borderWidth: 1, borderColor: '#3a2010' },
  watchlistButtonText: { color: '#100a04', fontSize: 13, fontWeight: '700' },
  watchlistButtonTextSaved: { color: '#7a5535' },
  section: { marginBottom: 24 },
  sectionLabel: { color: '#7a5535', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  overview: { color: '#c8a87a', fontSize: 14, lineHeight: 21 },
  providerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  providerItem: { alignItems: 'center', width: 56 },
  providerLogo: { width: 40, height: 40, borderRadius: 8, marginBottom: 4 },
  providerName: { color: '#7a5535', fontSize: 10, textAlign: 'center' },
  errorText: { color: '#e05020', textAlign: 'center', marginTop: 40, fontSize: 14 },
})
