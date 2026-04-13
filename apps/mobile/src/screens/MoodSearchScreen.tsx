import React, { useState, useMemo, useRef } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform,
  Animated, PanResponder,
} from 'react-native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { colors, typography, spacing, radius, shadows } from '../theme'
import { trpc } from '../lib/trpc'
import type { RootStackParamList } from '../navigation/MainNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>

interface SwipeableCardProps {
  children: React.ReactNode
  onSwipeRight?: () => void
  style?: object
}

function SwipeableCard({ children, onSwipeRight, style }: SwipeableCardProps) {
  const translateX = useRef(new Animated.Value(0)).current

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy),
      onPanResponderMove: Animated.event([null, { dx: translateX }], { useNativeDriver: false }),
      onPanResponderRelease: (_, { dx, vx }) => {
        if (dx > 80 || vx > 0.5) {
          Animated.timing(translateX, { toValue: 500, duration: 200, useNativeDriver: false }).start(() => {
            translateX.setValue(0)
            onSwipeRight?.()
          })
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: false }).start()
        }
      },
    })
  ).current

  const addBgOpacity = translateX.interpolate({ inputRange: [0, 20], outputRange: [0, 1], extrapolate: 'clamp' })
  const addScale = translateX.interpolate({ inputRange: [0, 80], outputRange: [0.8, 1.1], extrapolate: 'clamp' })

  return (
    <View style={style}>
      <Animated.View style={[StyleSheet.absoluteFillObject, swipeStyles.addBg, { opacity: addBgOpacity }]}>
        <Animated.Text style={[swipeStyles.addLabel, { transform: [{ scale: addScale }] }]}>
          + Add
        </Animated.Text>
      </Animated.View>

      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  )
}

const swipeStyles = StyleSheet.create({
  addBg: {
    backgroundColor: colors.gold,
    justifyContent: 'center',
    paddingLeft: spacing.lg + 10,
    borderRadius: radius.md,
  },
  addLabel: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: '700',
  },
})

interface MoodSearchScreenProps {
  navigation: Nav
}

export function MoodSearchScreen({ navigation }: MoodSearchScreenProps) {
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [searchError, setSearchError] = useState<string | null>(null)
  const utils = trpc.useUtils()

  const historyQuery = trpc.moodSearch.history.useQuery()
  const usageQuery = trpc.picks.usage.useQuery()
  const searchMutation = trpc.moodSearch.search.useMutation({
    onSuccess: (data) => {
      setSearchError(null)
      setSelectedSearchId(data.searchId)
      setSearchText('')
      utils.moodSearch.history.invalidate()
      utils.picks.usage.invalidate()
    },
    onError: (error) => {
      setSearchError(error.message || 'Search failed. Try again.')
    },
  })
  const refreshMutation = trpc.moodSearch.refresh.useMutation({
    onSuccess: () => {
      utils.moodSearch.results.invalidate()
    },
  })
  const resultsQuery = trpc.moodSearch.results.useQuery(
    { searchId: selectedSearchId ?? '' },
    { enabled: !!selectedSearchId }
  )
  const watchlistQuery = trpc.watchlist.list.useQuery({})
  const addMutation = trpc.watchlist.add.useMutation({ onSuccess: () => utils.watchlist.list.invalidate() })

  const watchlistedSet = useMemo(
    () => new Set(
      (watchlistQuery.data ?? []).map((i: any) => `${i.tmdbId}-${i.mediaType}`)
    ),
    [watchlistQuery.data]
  )

  function handleSearch() {
    if (!searchText.trim()) return
    searchMutation.mutate({ message: searchText.trim() })
  }

  function handleAdd(item: any) {
    addMutation.mutate({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType as 'movie' | 'tv',
      media: {
        title: item.title,
        posterPath: item.posterPath,
        year: item.year,
        genres: item.genres,
        overview: item.overview,
        runtime: null,
        watchProviders: {},
      },
    })
  }

  function handleRefresh() {
    if (!selectedSearchId) return
    refreshMutation.mutate({ searchId: selectedSearchId })
  }

  // History view
  if (!selectedSearchId) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Tell Scout what you're in the mood for..."
              placeholderTextColor={colors.textMuted}
              value={searchText}
              onChangeText={(text) => { setSearchText(text); setSearchError(null) }}
              editable={!searchMutation.isPending}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={[styles.sendButton, (!searchText.trim() || searchMutation.isPending) && styles.sendButtonDisabled]}
              onPress={handleSearch}
              disabled={!searchText.trim() || searchMutation.isPending}
            >
              {searchMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.bg} />
              ) : (
                <Text style={styles.sendText}>→</Text>
              )}
            </TouchableOpacity>
          </View>

          {searchError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{searchError}</Text>
            </View>
          )}

          {historyQuery.data && historyQuery.data.length > 0 ? (
            <View style={styles.content}>
              <Text style={styles.sectionLabel}>Recent searches</Text>
              <FlatList
                scrollEnabled
                data={historyQuery.data}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.historyCard}
                    onPress={() => setSelectedSearchId(item.id)}
                  >
                    <Text style={styles.historyTitle}>{item.title}</Text>
                    <Text style={styles.historyMeta}>{item.resultCount} results · {formatTime(item.createdAt)}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Describe a vibe, genre, or mood</Text>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {(() => {
                const limit = usageQuery.data?.moodSearch?.limit ?? 3
                const used = usageQuery.data?.moodSearch?.used ?? 0
                const left = limit - used
                return `${left} of ${limit} searches left today`
              })()}
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  // Results view
  const currentSearch = (historyQuery.data ?? []).find((s: any) => s.id === selectedSearchId)
  const isLoading = resultsQuery.isLoading || refreshMutation.isPending

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.resultsHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setSelectedSearchId(null)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.resultsTitle}>{currentSearch?.title || ''}</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={refreshMutation.isPending}
        >
          <Text style={styles.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.resultCount}>{resultsQuery.data?.length ?? 0} results</Text>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : resultsQuery.data && resultsQuery.data.length > 0 ? (
        <FlatList
          data={resultsQuery.data}
          keyExtractor={item => `${item.tmdbId}-${item.mediaType}`}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const key = `${item.tmdbId}-${item.mediaType}`
            const inWatchlist = watchlistedSet.has(key)

            return (
              <SwipeableCard
                style={styles.card}
                onSwipeRight={() => {
                  if (!inWatchlist) handleAdd(item)
                }}
              >
                <TouchableOpacity
                  style={styles.cardInner}
                  onPress={() => navigation.navigate('MediaDetail', { tmdbId: item.tmdbId, mediaType: item.mediaType })}
                  activeOpacity={0.75}
                >
                  <View style={styles.info}>
                    <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.meta}>{item.year ? item.year + ' · ' : ''}{item.mediaType === 'tv' ? 'TV' : 'Movie'}</Text>
                    <View style={styles.actions}>
                      <TouchableOpacity style={styles.passButton}>
                        <Text style={styles.passText}>Pass</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.addButton, inWatchlist && styles.addButtonSaved]}
                        onPress={() => { if (!inWatchlist) handleAdd(item) }}
                        disabled={inWatchlist}
                      >
                        <Text style={styles.addButtonText}>{inWatchlist ? '✓' : '+'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              </SwipeableCard>
            )
          }}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No results</Text>
        </View>
      )}
    </SafeAreaView>
  )
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  return `${diffDays}d ago`
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 24, color: colors.text },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, gap: spacing.sm },
  errorBanner: { marginHorizontal: spacing.md, marginBottom: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: '#3a1a1a', borderRadius: radius.md, borderWidth: 1, borderColor: '#5a2a2a' },
  errorText: { color: '#ff8888', fontSize: 13 },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: colors.border },
  sendText: { ...typography.button, color: colors.bg },
  content: { flex: 1, paddingHorizontal: spacing.lg },
  sectionLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.md, textTransform: 'uppercase', fontSize: 11 },
  historyCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  historyTitle: { ...typography.body, color: colors.text, marginBottom: spacing.xs },
  historyMeta: { fontSize: 11, color: colors.textMuted },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...typography.body, color: colors.textMuted },
  footer: { alignItems: 'center', paddingVertical: spacing.md },
  footerText: { fontSize: 11, color: colors.textMuted },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.md },
  resultsTitle: { ...typography.heading, color: colors.text, flex: 1, fontSize: 17 },
  refreshButton: { width: 32, height: 32, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  refreshText: { color: colors.textMuted, fontSize: 14 },
  resultCount: { paddingHorizontal: spacing.lg, fontSize: 11, color: colors.textMuted, marginBottom: spacing.md },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  card: { backgroundColor: colors.surfaceRaised, marginBottom: spacing.xs, borderRadius: radius.md, ...shadows.md, overflow: 'hidden' },
  cardInner: { padding: spacing.md },
  info: { flex: 1 },
  title: { ...typography.body, color: colors.text, fontWeight: '600', marginBottom: spacing.xs },
  meta: { fontSize: 11, color: colors.textMuted, marginBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  passButton: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  passText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  addButton: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.gold, alignItems: 'center' },
  addButtonSaved: { backgroundColor: colors.border },
  addButtonText: { fontSize: 12, fontWeight: '700', color: colors.bg },
})
