import React, { useState, useEffect } from 'react'
import {
  View, Text, TextInput, FlatList, Image,
  TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { trpc } from '../lib/trpc'
import type { MediaItem } from '@scout/shared'
import type { RootStackParamList } from '../navigation/MainNavigator'
import { colors, typography, spacing, radius, shadows } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>

const POSTER_BASE = 'https://image.tmdb.org/t/p/w185'

export function SearchScreen() {
  const navigation = useNavigation<Nav>()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 400)
    return () => clearTimeout(timer)
  }, [query])

  const utils = trpc.useUtils()
  const searchQuery = trpc.tmdb.search.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length > 1 }
  )

  const watchlistQuery = trpc.watchlist.list.useQuery({})

  const addMutation = trpc.watchlist.add.useMutation({
    onSuccess: () => utils.watchlist.list.invalidate(),
  })

  const watchlistedSet = new Set(
    watchlistQuery.data
      ?.filter(item => item.status === 'saved')
      .map(item => `${item.tmdbId}-${item.mediaType}`) ?? []
  )

  function handleAdd(item: MediaItem) {
    addMutation.mutate({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      media: {
        title: item.title,
        posterPath: item.posterPath,
        year: item.year,
        genres: item.genres,
        overview: item.overview,
        runtime: item.runtime,
        watchProviders: item.watchProviders,
      },
    })
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Search</Text>

      <TextInput
        style={styles.input}
        placeholder="Movies, shows..."
        placeholderTextColor="#5a3520"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        returnKeyType="search"
      />

      {searchQuery.isLoading && debouncedQuery.length > 1 && (
        <ActivityIndicator color="#e8a020" style={styles.spinner} />
      )}

      {debouncedQuery.length <= 1 && (
        <Text style={styles.emptyText}>Search for movies and shows</Text>
      )}

      {searchQuery.isError && (
        <Text style={styles.errorText}>{String(searchQuery.error)}</Text>
      )}

      <FlatList
        data={searchQuery.data ?? []}
        keyExtractor={item => `${item.tmdbId}-${item.mediaType}`}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const key = `${item.tmdbId}-${item.mediaType}`
          const inWatchlist = watchlistedSet.has(key)
          const isAdding = addMutation.isPending &&
            addMutation.variables?.tmdbId === item.tmdbId &&
            addMutation.variables?.mediaType === item.mediaType

          return (
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
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.meta}>
                  {[item.year, item.mediaType === 'tv' ? 'TV' : 'Movie'].filter(Boolean).join(' · ')}
                </Text>
                {item.genres.length > 0 && (
                  <Text style={styles.genres} numberOfLines={1}>
                    {item.genres.slice(0, 3).join(', ')}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={[styles.addButton, inWatchlist && styles.addButtonSaved]}
                onPress={() => { if (!inWatchlist) handleAdd(item) }}
                disabled={inWatchlist || isAdding}
              >
                {isAdding ? (
                  <ActivityIndicator size="small" color="#100a04" />
                ) : (
                  <Text style={styles.addButtonText}>{inWatchlist ? '✓' : '+'}</Text>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 56 },
  header: { ...typography.heading, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  input: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
    marginBottom: spacing.xs,
  },
  spinner: { marginTop: spacing.lg },
  emptyText: { color: colors.textDim, textAlign: 'center', marginTop: 40, fontSize: 15 },
  errorText: { color: colors.error, textAlign: 'center', marginTop: spacing.sm, fontSize: 13, paddingHorizontal: spacing.lg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
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
  info: { flex: 1, marginRight: spacing.md },
  title: { ...typography.subtitle, color: colors.text, marginBottom: 2 },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: 2 },
  genres: { ...typography.caption, color: colors.textMuted },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonSaved: { backgroundColor: colors.border },
  addButtonText: { color: colors.bg, fontSize: 18, fontWeight: '800', lineHeight: 20 },
})
