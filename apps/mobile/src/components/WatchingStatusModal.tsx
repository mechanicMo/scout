import React, { useState } from 'react'
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, typography, spacing, radius, shadows } from '../theme'

type SeasonData = { season_number: number; episode_count: number }

type Props = {
  visible: boolean
  mediaType: 'movie' | 'tv'
  title: string
  totalSeasons?: number | null
  seasons?: SeasonData[] | null
  initialSeason?: number | null
  initialEpisode?: number | null
  onClose: () => void
  onSubmit: (watchingStatus: 'not_started' | 'watching', season?: number, episode?: number) => void
  isPending?: boolean
}

export function WatchingStatusModal({
  visible, mediaType, title, totalSeasons, seasons, initialSeason, initialEpisode, onClose, onSubmit, isPending,
}: Props) {
  const isEditing = initialSeason != null || initialEpisode != null
  const [season, setSeason] = useState('')
  const [episode, setEpisode] = useState('')

  const seasonNum = season ? parseInt(season, 10) : NaN
  const maxSeason = totalSeasons ?? null
  const seasonError = !isNaN(seasonNum)
    ? seasonNum < 1
      ? 'Min season is 1'
      : maxSeason != null && seasonNum > maxSeason
        ? `Max season is ${maxSeason}`
        : null
    : null

  const episodeNum = episode ? parseInt(episode, 10) : NaN
  const seasonEntry = !isNaN(seasonNum) && seasons
    ? seasons.find(s => s.season_number === seasonNum) ?? null
    : null
  const maxEpisode = seasonEntry?.episode_count ?? null
  const episodeError = !isNaN(episodeNum)
    ? episodeNum < 1
      ? 'Min episode is 1'
      : maxEpisode != null && episodeNum > maxEpisode
        ? `Max episode for S${seasonNum} is ${maxEpisode}`
        : null
    : null

  // Sync initial values when modal opens
  React.useEffect(() => {
    if (visible) {
      setSeason(initialSeason ? String(initialSeason) : '')
      setEpisode(initialEpisode ? String(initialEpisode) : '')
    }
  }, [visible, initialSeason, initialEpisode])

  function handleSubmit() {
    let s = season ? parseInt(season, 10) : 1
    let e = episode ? parseInt(episode, 10) : 1
    if (isNaN(s) || s < 1) s = 1
    if (maxSeason != null && s > maxSeason) s = maxSeason
    if (isNaN(e) || e < 1) e = 1
    const entry = seasons?.find(x => x.season_number === s) ?? null
    if (entry && e > entry.episode_count) e = entry.episode_count
    onSubmit('watching', s, e)
  }

  function handleStopWatching() {
    onSubmit('not_started')
  }

  function handleClose() {
    setSeason('')
    setEpisode('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{isEditing ? 'Edit progress' : 'Track progress'}</Text>
          <Text style={styles.subtitle}>{title}</Text>

          <View style={styles.seasonEpisodeContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Season{totalSeasons != null ? ` (1–${totalSeasons})` : ''}
              </Text>
              <TextInput
                style={[styles.input, seasonError ? styles.inputError : null]}
                value={season}
                onChangeText={setSeason}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor={colors.textMuted}
                editable={!isPending}
              />
              {seasonError ? <Text style={styles.errorText}>{seasonError}</Text> : null}
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Episode{maxEpisode != null ? ` (1–${maxEpisode})` : ''}
              </Text>
              <TextInput
                style={[styles.input, episodeError ? styles.inputError : null]}
                value={episode}
                onChangeText={setEpisode}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor={colors.textMuted}
                editable={!isPending}
              />
              {episodeError ? <Text style={styles.errorText}>{episodeError}</Text> : null}
            </View>
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={isPending}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={handleSubmit}
              disabled={isPending}
            >
              {isPending ? (
                <ActivityIndicator color={colors.bg} size="small" />
              ) : (
                <Text style={styles.confirmButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          {isEditing && (
            <TouchableOpacity
              style={styles.stopButton}
              onPress={handleStopWatching}
              disabled={isPending}
            >
              <Text style={styles.stopButtonText}>Stop watching</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
    width: '85%',
    marginHorizontal: '7.5%',
    ...shadows.lg,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.md,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.lg,
  },
  seasonEpisodeContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  inputGroup: {
    flex: 1,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 14,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 11,
    marginTop: 4,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButton: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  confirmButtonText: {
    ...typography.button,
    color: colors.bg,
  },
  stopButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  stopButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
})
