import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, typography, spacing, radius } from '../theme'

interface Props {
  currentSeason: number
  currentEpisode: number
  totalSeasons: number | null
  totalEpisodes: number | null
  onAdvance: () => void
  onSetManually: () => void
  isPending?: boolean
}

export function EpisodeStepper({
  currentSeason, currentEpisode, totalSeasons, totalEpisodes,
  onAdvance, onSetManually, isPending,
}: Props) {
  const isLastEpisode = totalEpisodes != null && currentEpisode >= totalEpisodes
    && totalSeasons != null && currentSeason >= totalSeasons

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onSetManually} style={styles.progress}>
        <Text style={styles.progressText}>
          S{currentSeason} · E{currentEpisode}
        </Text>
        {totalEpisodes != null && (
          <Text style={styles.totalText}>/ {totalEpisodes} eps</Text>
        )}
      </TouchableOpacity>
      {!isLastEpisode && (
        <TouchableOpacity
          style={[styles.nextButton, isPending && styles.nextButtonDisabled]}
          onPress={onAdvance}
          disabled={isPending}
        >
          <Text style={styles.nextButtonText}>Next →</Text>
        </TouchableOpacity>
      )}
      {isLastEpisode && (
        <View style={styles.finishedBadge}>
          <Text style={styles.finishedText}>Caught up</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xxs,
  },
  progressText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  totalText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  nextButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
    backgroundColor: colors.gold,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    color: colors.bg,
    fontSize: 11,
    fontWeight: '700',
  },
  finishedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  finishedText: {
    color: colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
  },
})
