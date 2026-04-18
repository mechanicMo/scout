// apps/mobile/src/screens/SearchScreen.tsx
import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, FlatList, Image,
  TouchableOpacity, ActivityIndicator, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSearchTitles } from '../hooks/useMediaDetail'
import { useWatchlist, useAddToWatchlist } from '../hooks/useWatchlist'
import type { MediaItem } from '@scout/shared'
import type { RootStackParamList } from '../navigation/MainNavigator'
import type { TabParamList } from '../navigation/TabNavigator'
import { colors, typography, spacing, radius, shadows } from '../theme'
import { MoodSearchContent } from '../components/MoodSearchContent'

type Props = BottomTabScreenProps<TabParamList, 'Search'>

export function SearchScreen({ route, navigation }: Props) {
  const stackNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [mode, setMode] = useState<'titles' | 'mood'>('titles')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Auto-activate mood mode when navigated here from Picks CTA
  useFocusEffect(useCallback(() => {
    const initial = route.params?.initialMode
    if (initial) {
      navigation.setParams({ initialMode: undefined })
      if (initial === 'mood') setMode('mood')
    }
  }, [route.params?.initialMode, navigation]))

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 400)
    return () => clearTimeout(timer)
  }, [query])

  const searchQuery = useSearchTitles(mode === 'titles' ? debouncedQuery : '')
  const watchlistQuery = useWatchlist()
  const addMutation = useAddToWatchlist()

  const watchlistedSet = useMemo(() => new Set(
    watchlistQuery.data
      ?.filter((item: any) => item.status === 'saved')
      .map((item: any) => `${item.tmdbId}-${item.mediaType}`) ?? []
  ), [watchlistQuery.data])

  function handleAdd(item: MediaItem) {
    addMutation.mutate(item)
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <Text style={styles.header}>Search</Text>

        {/* Segmented mode toggle */}
        <View style={styles.toggleContainer}>
          <View style={styles.togglePill}>
            <TouchableOpacity
              style={styles.toggleItem}
              onPress={() => setMode('titles')}
              activeOpacity={0.8}
            >
              {mode === 'titles' ? (
                <View style={[styles.toggleActive, styles.toggleActiveGold]}>
                  <Text style={styles.toggleTextActiveGold}>Titles</Text>
                </View>
              ) : (
                <Text style={styles.toggleTextInactive}>Titles</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleItem}
              onPress={() => setMode('mood')}
              activeOpacity={0.8}
            >
              {mode === 'mood' ? (
                <LinearGradient
                  colors={['#7c3aed', '#c026d3']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.toggleActive}
                >
                  <Text style={styles.toggleTextActiveMood}>✦ Mood</Text>
                </LinearGradient>
              ) : (
                <Text style={styles.toggleTextInactive}>✦ Mood</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Content area */}
        {mode === 'titles' ? (
          <View style={{ flex: 1 }}>
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
              <ActivityIndicator color={colors.gold} style={styles.spinner} />
            )}

            {debouncedQuery.length <= 1 && (
              <Text style={styles.emptyText}>Search for movies and shows</Text>
            )}

            {searchQuery.isError && (
              <Text style={styles.errorText}>{searchQuery.error.message}</Text>
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
                    onPress={() => stackNav.navigate('MediaDetail', { tmdbId: item.tmdbId, mediaType: item.mediaType })}
                    activeOpacity={0.7}
                  >
                    {item.posterPath ? (
                      <Image
                        source={{ uri: `https://image.tmdb.org/t/p/w185${item.posterPath}` }}
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
                      {isAdding
                        ? <ActivityIndicator size="small" color={colors.bg} />
                        : <Text style={styles.addButtonText}>{inWatchlist ? '✓' : '+'}</Text>}
                    </TouchableOpacity>
                  </TouchableOpacity>
                )
              }}
            />
          </View>
        ) : (
          <MoodSearchContent />
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { ...typography.heading, paddingHorizontal: spacing.lg, paddingTop: spacing.xs, marginBottom: spacing.sm },
  toggleContainer: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  togglePill: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleItem: { flex: 1, borderRadius: 20, overflow: 'hidden' },
  toggleActive: { borderRadius: 20, paddingVertical: 8, alignItems: 'center' },
  toggleActiveGold: { backgroundColor: colors.gold },
  toggleTextActiveGold: { fontSize: 13, fontWeight: '700', color: colors.bg },
  toggleTextActiveMood: { fontSize: 13, fontWeight: '700', color: 'white' },
  toggleTextInactive: {
    fontSize: 13, fontWeight: '600', color: colors.textDim,
    textAlign: 'center', paddingVertical: 8,
  },
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
  errorText: {
    color: colors.error, textAlign: 'center',
    marginTop: spacing.sm, fontSize: 13, paddingHorizontal: spacing.lg,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  card: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    marginBottom: spacing.xs, borderRadius: radius.md,
    ...shadows.md,
  },
  poster: { width: 48, height: 72, borderRadius: radius.sm, marginRight: spacing.md },
  posterFallback: { backgroundColor: colors.border },
  info: { flex: 1, marginRight: spacing.md },
  title: { ...typography.subtitle, color: colors.text, marginBottom: 2 },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: 2 },
  genres: { ...typography.caption, color: colors.textMuted },
  addButton: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center',
  },
  addButtonSaved: { backgroundColor: colors.border },
  addButtonText: { color: colors.bg, fontSize: 18, fontWeight: '800', lineHeight: 20 },
})
