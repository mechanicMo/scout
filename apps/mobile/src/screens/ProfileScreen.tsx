import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { trpc } from '../lib/trpc'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'

const ALL_SERVICES = ['Netflix', 'Prime Video', 'Disney+', 'Max', 'Hulu', 'Apple TV+', 'Peacock', 'Paramount+']

export function ProfileScreen() {
  const setSession = useAuthStore(state => state.setSession)

  const userQuery = trpc.user.me.useQuery()
  const profileQuery = trpc.tasteProfile.get.useQuery()
  const updateServicesMutation = trpc.tasteProfile.updateServices.useMutation({
    onSuccess: () => profileQuery.refetch(),
  })

  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [servicesDirty, setServicesDirty] = useState(false)

  useEffect(() => {
    if (profileQuery.data && !servicesDirty) {
      setSelectedServices(profileQuery.data.services ?? [])
    }
  }, [profileQuery.data, servicesDirty])

  function toggleService(service: string) {
    setServicesDirty(true)
    setSelectedServices(prev => prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service])
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setSession(null)
  }

  if (userQuery.isLoading || profileQuery.isLoading) {
    return <View style={styles.centered}><ActivityIndicator color="#e8a020" size="large" /></View>
  }

  const user = userQuery.data
  const profile = profileQuery.data
  const likedGenres = profile?.likedGenres ?? []
  const dislikedGenres = profile?.dislikedGenres ?? []

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>Profile</Text>

        <View style={styles.userCard}>
          <Text style={styles.displayName}>{user?.displayName ?? '—'}</Text>
          <Text style={styles.email}>{user?.email ?? '—'}</Text>
        </View>

        {/* Liked genres */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Genres you like</Text>
          {likedGenres.length === 0 ? (
            <Text style={styles.emptyHint}>Rate things to build your taste profile.</Text>
          ) : (
            <View style={styles.pillRow}>
              {likedGenres.map(genre => (
                <View key={genre} style={styles.pillLiked}>
                  <Text style={styles.pillLikedText}>{genre}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {dislikedGenres.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Genres you skip</Text>
            <View style={styles.pillRow}>
              {dislikedGenres.map(genre => (
                <View key={genre} style={styles.pillDisliked}>
                  <Text style={styles.pillDislikedText}>{genre}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Services survey */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>What streaming services do you have?</Text>
          <Text style={styles.surveyHint}>Scout uses this to surface what's available to you.</Text>
          <View style={styles.chipRow}>
            {ALL_SERVICES.map(service => {
              const selected = selectedServices.includes(service)
              return (
                <TouchableOpacity
                  key={service}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => toggleService(service)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{service}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
          <TouchableOpacity
            style={[styles.saveButton, (!servicesDirty || updateServicesMutation.isPending) && styles.saveButtonDisabled]}
            onPress={() => updateServicesMutation.mutate({ services: selectedServices }, { onSuccess: () => setServicesDirty(false) })}
            disabled={!servicesDirty || updateServicesMutation.isPending}
          >
            {updateServicesMutation.isPending
              ? <ActivityIndicator size="small" color="#100a04" />
              : <Text style={styles.saveButtonText}>Save Services</Text>}
          </TouchableOpacity>
          {updateServicesMutation.isSuccess && !servicesDirty && (
            <Text style={styles.savedConfirm}>Saved</Text>
          )}
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#100a04' },
  centered: { flex: 1, backgroundColor: '#100a04', alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 48 },
  header: { fontSize: 28, fontWeight: '800', color: '#fff1e6', marginBottom: 20 },
  userCard: { backgroundColor: '#1a0f06', borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#2e1a0a' },
  displayName: { color: '#fff1e6', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  email: { color: '#7a5535', fontSize: 13 },
  section: { marginBottom: 28 },
  sectionLabel: { color: '#7a5535', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  emptyHint: { color: '#3a2010', fontSize: 13, lineHeight: 18 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pillLiked: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, backgroundColor: '#2a1800', borderWidth: 1, borderColor: '#e8a020' },
  pillLikedText: { color: '#e8a020', fontSize: 13, fontWeight: '600' },
  pillDisliked: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, backgroundColor: '#200808', borderWidth: 1, borderColor: '#6b2020' },
  pillDislikedText: { color: '#c05050', fontSize: 13 },
  surveyHint: { color: '#5a3520', fontSize: 12, marginBottom: 12, lineHeight: 17 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#2e1a0a', backgroundColor: '#1a0f06' },
  chipSelected: { backgroundColor: '#e8a020', borderColor: '#e8a020' },
  chipText: { color: '#5a3520', fontSize: 13 },
  chipTextSelected: { color: '#100a04', fontWeight: '700' },
  saveButton: { backgroundColor: '#e8a020', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: '#2e1a0a' },
  saveButtonText: { color: '#100a04', fontSize: 15, fontWeight: '800' },
  savedConfirm: { color: '#e8a020', fontSize: 12, textAlign: 'center', marginTop: 8 },
  signOutButton: { marginTop: 8, paddingVertical: 14, alignItems: 'center', backgroundColor: '#1a0f06', borderRadius: 12, borderWidth: 1, borderColor: '#2e1a0a' },
  signOutText: { color: '#5a3520', fontSize: 15, fontWeight: '600' },
})
