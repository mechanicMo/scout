import React from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'

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
        <ActivityIndicator color="#e8a020" style={styles.spinner} />
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
    backgroundColor: '#1a0f06',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a2010',
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    color: '#e8a020',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  skip: {
    color: '#5a3520',
    fontSize: 12,
  },
  question: {
    color: '#fff1e6',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 14,
  },
  options: {
    gap: 8,
  },
  option: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2e1a0a',
    backgroundColor: '#0e0905',
  },
  optionText: {
    color: '#c8a87a',
    fontSize: 14,
  },
  spinner: { marginTop: 8 },
})
