import React from 'react'
import {
  Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback, StyleSheet,
} from 'react-native'
import { colors, typography, spacing, radius, shadows } from '../theme'

export type StatusAction = {
  key: string
  icon: string
  label: string
  meta: string
  danger?: boolean
  onPress: () => void
}

interface Props {
  visible: boolean
  title: string
  actions: StatusAction[]
  onClose: () => void
}

export function StatusSheet({ visible, title, actions, onClose }: Props) {
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
        <Text style={styles.heading}>Set Status</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{title}</Text>

        {actions.map((action, idx) => (
          <TouchableOpacity
            key={action.key}
            style={[styles.option, idx === actions.length - 1 && styles.optionLast]}
            onPress={action.onPress}
          >
            <View style={styles.optionRow}>
              <Text style={[styles.optionIcon, action.danger && styles.optionIconDanger]}>{action.icon}</Text>
              <View style={styles.optionTextWrap}>
                <Text style={[styles.optionText, action.danger && styles.optionTextDanger]}>{action.label}</Text>
                <Text style={styles.optionMeta}>{action.meta}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

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
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  optionIcon: {
    fontSize: 18,
    color: colors.gold,
    width: 24,
    textAlign: 'center',
  },
  optionIconDanger: { color: colors.error },
  optionTextWrap: { flex: 1 },
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
