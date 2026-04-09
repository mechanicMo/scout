import React from 'react'
import {
  Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback, StyleSheet,
} from 'react-native'
import { colors, typography, spacing, radius, shadows } from '../theme'

interface Props {
  visible: boolean
  title: string
  onClose: () => void
  onNotNow: () => void
  onAlreadyWatched: () => void
  onNotInterested: () => void
}

export function DismissSheet({ visible, title, onClose, onNotNow, onAlreadyWatched, onNotInterested }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.heading}>Passing on this?</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{title}</Text>

        <TouchableOpacity style={styles.option} onPress={onNotNow}>
          <Text style={styles.optionText}>Not right now</Text>
          <Text style={styles.optionMeta}>Remind me again in 30 days</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.option} onPress={onAlreadyWatched}>
          <Text style={styles.optionText}>Already seen this</Text>
          <Text style={styles.optionMeta}>Add a rating</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.option, styles.optionLast]} onPress={onNotInterested}>
          <Text style={[styles.optionText, styles.optionTextDanger]}>Not interested</Text>
          <Text style={styles.optionMeta}>Never show this again</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
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
  subtitle: {
    color: colors.textSoft,
    fontSize: 13,
    marginBottom: spacing.lg,
  },
  option: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionLast: { borderBottomWidth: 0 },
  optionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  optionTextDanger: { color: colors.error },
  optionMeta: { color: colors.textMuted, fontSize: 12 },
  cancelButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
})
