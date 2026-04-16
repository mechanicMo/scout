import React, { useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { colors, spacing, shadows, radius } from '../theme'

interface Props {
  question: string
  options: string[]
  multiSelect?: boolean
  onAnswer: (answer: string) => void
  onSkip: () => void
  isPending: boolean
}

export function SurveyCard({ question, options, multiSelect = false, onAnswer, onSkip, isPending }: Props) {
  const [selected, setSelected] = useState<string[]>([])

  function toggle(option: string) {
    setSelected(prev =>
      prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]
    )
  }

  function handleSubmit() {
    if (selected.length === 0) return
    onAnswer(selected.join(', '))
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>SCOUT WANTS TO KNOW</Text>
        <TouchableOpacity onPress={onSkip} disabled={isPending}>
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.question}>{question}</Text>
      {multiSelect && (
        <Text style={styles.hint}>Select all that apply</Text>
      )}
      {isPending ? (
        <ActivityIndicator color={colors.gold} style={styles.spinner} />
      ) : (
        <>
          <View style={styles.options}>
            {options.map(option => {
              const isSelected = selected.includes(option)
              if (multiSelect) {
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => toggle(option)}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                )
              }
              return (
                <TouchableOpacity
                  key={option}
                  style={styles.option}
                  onPress={() => onAnswer(option)}
                >
                  <Text style={styles.optionText}>{option}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
          {multiSelect && (
            <TouchableOpacity
              style={[styles.submit, selected.length === 0 && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={selected.length === 0}
            >
              <Text style={styles.submitText}>
                {selected.length === 0 ? 'Select at least one' : `Submit ${selected.length} answer${selected.length > 1 ? 's' : ''}`}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    ...shadows.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  skip: {
    color: colors.textDim,
    fontSize: 12,
  },
  question: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: spacing.xs,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: spacing.md,
  },
  options: {
    gap: spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  optionSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.surfaceRaised,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  checkmark: {
    color: colors.bg,
    fontSize: 12,
    fontWeight: '700',
  },
  optionText: {
    color: colors.textSoft,
    fontSize: 14,
  },
  optionTextSelected: {
    color: colors.text,
    fontWeight: '600',
  },
  submit: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
    alignItems: 'center',
  },
  submitDisabled: {
    backgroundColor: colors.border,
  },
  submitText: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: '700',
  },
  spinner: { marginTop: spacing.xs },
})
