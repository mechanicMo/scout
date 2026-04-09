import React from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { colors, spacing, shadows, radius } from '../theme'

interface Props {
  question: string
  options: string[]
  onAnswer: (answer: string) => void
  onSkip: () => void
  isPending: boolean
}

export function SurveyCard({ question, options, onAnswer, onSkip, isPending }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>SCOUT WANTS TO KNOW</Text>
        <TouchableOpacity onPress={onSkip} disabled={isPending}>
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.question}>{question}</Text>
      {isPending ? (
        <ActivityIndicator color={colors.gold} style={styles.spinner} />
      ) : (
        <View style={styles.options}>
          {options.map(option => (
            <TouchableOpacity
              key={option}
              style={styles.option}
              onPress={() => onAnswer(option)}
            >
              <Text style={styles.optionText}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
    marginBottom: spacing.md,
  },
  options: {
    gap: spacing.xs,
  },
  option: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  optionText: {
    color: colors.textSoft,
    fontSize: 14,
  },
  spinner: { marginTop: spacing.xs },
})
