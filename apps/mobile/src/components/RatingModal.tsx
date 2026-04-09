import React, { useState } from 'react'
import {
  Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback, StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { colors, typography, spacing, radius, shadows } from '../theme'

interface Props {
  visible: boolean
  title: string
  tags: string[]
  onClose: () => void
  onSubmit: (score: number, tags: string[]) => void
  isPending?: boolean
}

export function RatingModal({ visible, title, tags, onClose, onSubmit, isPending }: Props) {
  const [score, setScore] = useState(0)
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  function toggleTag(tag: string) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  function handleSubmit() {
    if (score === 0) return
    onSubmit(score, selectedTags)
  }

  function handleClose() {
    setScore(0)
    setSelectedTags([])
    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.heading}>How was it?</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{title}</Text>

        {/* Stars */}
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map(n => (
            <TouchableOpacity key={n} onPress={() => setScore(n)} style={styles.starButton}>
              <Text style={[styles.star, n <= score && styles.starFilled]}>★</Text>
            </TouchableOpacity>
          ))}
        </View>
        {score === 0 && <Text style={styles.starHint}>Tap to rate</Text>}

        {/* Tag chips */}
        {tags.length > 0 && (
          <View style={styles.tagsSection}>
            <Text style={styles.tagsLabel}>What worked for you?</Text>
            <View style={styles.tagsRow}>
              {tags.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.chip, selectedTags.includes(tag) && styles.chipSelected]}
                  onPress={() => toggleTag(tag)}
                >
                  <Text style={[styles.chipText, selectedTags.includes(tag) && styles.chipTextSelected]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, score === 0 && styles.saveButtonDisabled]}
          onPress={handleSubmit}
          disabled={score === 0 || isPending}
        >
          {isPending ? (
            <ActivityIndicator size="small" color={colors.bg} />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.surfaceHigh,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing['3xl'],
    ...shadows.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  heading: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.lg },
  starsRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.xs },
  starButton: { padding: spacing.xs },
  star: { fontSize: 36, color: colors.border },
  starFilled: { color: colors.gold },
  starHint: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 12,
    marginBottom: spacing.lg,
  },
  tagsSection: { marginTop: spacing.lg, marginBottom: spacing.md },
  tagsLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.textMuted, fontSize: 13 },
  chipTextSelected: { color: colors.bg, fontWeight: '700' },
  saveButton: {
    marginTop: spacing.xxl,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  saveButtonDisabled: { backgroundColor: colors.border },
  saveButtonText: {
    ...typography.button,
    color: colors.bg,
  },
})
