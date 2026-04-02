import React, { useState } from 'react'
import {
  Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback, StyleSheet,
  ActivityIndicator,
} from 'react-native'

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
            <ActivityIndicator size="small" color="#100a04" />
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
    backgroundColor: '#1a0f06', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#3a2010', alignSelf: 'center', marginBottom: 16,
  },
  heading: { color: '#fff1e6', fontSize: 17, fontWeight: '700', marginBottom: 2 },
  subtitle: { color: '#7a5535', fontSize: 13, marginBottom: 20 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 4 },
  starButton: { padding: 6 },
  star: { fontSize: 36, color: '#2e1a0a' },
  starFilled: { color: '#e8a020' },
  starHint: { color: '#3a2010', textAlign: 'center', fontSize: 12, marginBottom: 16 },
  tagsSection: { marginTop: 20, marginBottom: 8 },
  tagsLabel: { color: '#7a5535', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1, borderColor: '#2e1a0a',
    backgroundColor: '#1a0f06',
  },
  chipSelected: { backgroundColor: '#e8a020', borderColor: '#e8a020' },
  chipText: { color: '#5a3520', fontSize: 13 },
  chipTextSelected: { color: '#100a04', fontWeight: '700' },
  saveButton: {
    marginTop: 24, backgroundColor: '#e8a020',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  saveButtonDisabled: { backgroundColor: '#2e1a0a' },
  saveButtonText: { color: '#100a04', fontSize: 16, fontWeight: '800' },
})
