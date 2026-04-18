import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTasteProfile, useUpdateServices } from '../hooks/useTasteProfile'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { colors, typography, spacing, radius, shadows } from '../theme'

const ALL_SERVICES = ['Netflix', 'Prime Video', 'Disney+', 'Max', 'Hulu', 'Apple TV+', 'Peacock', 'Paramount+']

export function ProfileScreen() {
  const setSession = useAuthStore(state => state.setSession)

  const profileQuery = useTasteProfile()
  const updateServicesMutation = useUpdateServices()

  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [servicesDirty, setServicesDirty] = useState(false)
  const [userEmail, setUserEmail] = useState<string>('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? '')
    })
  }, [])

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

  if (profileQuery.isLoading) {
    return <View style={styles.centered}><ActivityIndicator color="#e8a020" size="large" /></View>
  }

  const profile = profileQuery.data
  const likedGenres = profile?.likedGenres ?? []
  const dislikedGenres = profile?.dislikedGenres ?? []

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>Profile</Text>

        <View style={styles.userCard}>
          <Text style={styles.displayName}>{userEmail.split('@')[0] ?? '—'}</Text>
          <Text style={styles.email}>{userEmail ?? '—'}</Text>
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
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.lg, paddingBottom: spacing.lg },
  header: { ...typography.heading, marginBottom: spacing.lg },
  userCard: { backgroundColor: colors.surfaceRaised, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.sm },
  displayName: { ...typography.title, color: colors.text, marginBottom: spacing.xs },
  email: { ...typography.caption, color: colors.textMuted },
  section: { marginBottom: spacing.lg },
  sectionLabel: { ...typography.label, color: colors.gold, marginBottom: spacing.md },
  emptyHint: { color: colors.textDim, fontSize: 13, lineHeight: 18 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pillLiked: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.gold },
  pillLikedText: { color: colors.gold, fontSize: 13, fontWeight: '600' },
  pillDisliked: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.error },
  pillDislikedText: { color: colors.error, fontSize: 13 },
  surveyHint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.lg },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised },
  chipSelected: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.textMuted, fontSize: 13 },
  chipTextSelected: { color: colors.bg, fontWeight: '700' },
  saveButton: { backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: colors.border },
  saveButtonText: { color: colors.bg, ...typography.button },
  savedConfirm: { color: colors.gold, fontSize: 12, textAlign: 'center', marginTop: spacing.sm },
  signOutButton: { marginTop: spacing.xs, paddingVertical: spacing.md, alignItems: 'center', backgroundColor: colors.surfaceRaised, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  signOutText: { color: colors.error, ...typography.body },
})
