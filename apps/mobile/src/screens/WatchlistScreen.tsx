import React, { useState } from 'react'
import {
  View, Text, FlatList, Image, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from 'react-native'
import { trpc } from '../lib/trpc'

const POSTER_BASE = 'https://image.tmdb.org/t/p/w185'

export function WatchlistScreen() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'watched'>('upcoming')

  const listQuery = trpc.watchlist.list.useQuery({ status: 'saved' })

  const removeMutation = trpc.watchlist.remove.useMutation({
    onSuccess: () => listQuery.refetch(),
  })

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Watchlist</Text>

      {/* Sub-tabs */}
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
          {listQuery.isLoading && (
            <ActivityIndicator color="#e8a020" style={styles.spinner} />
          )}

          {!listQuery.isLoading && listQuery.data?.length === 0 && (
            <Text style={styles.emptyText}>
              Nothing saved yet.{'\n'}Search for something to watch.
            </Text>
          )}

          <FlatList
            data={listQuery.data ?? []}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.card}>
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
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeMutation.mutate({ id: item.id })}
                  disabled={removeMutation.isPending}
                >
                  <Text style={styles.removeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </>
      ) : (
        <Text style={styles.emptyText}>
          Mark movies as watched to see them here.{'\n'}Coming in a future update.
        </Text>
      )}
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
  info: { flex: 1, marginRight: 12 },
  title: { color: '#fff1e6', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  meta: { color: '#7a5535', fontSize: 12 },
  removeButton: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#1f1208', alignItems: 'center', justifyContent: 'center',
  },
  removeButtonText: { color: '#5a3520', fontSize: 12 },
})
