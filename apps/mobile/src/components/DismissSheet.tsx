import React from 'react'
import {
  Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback, StyleSheet,
} from 'react-native'

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
        <Text style={styles.heading}>Not for you?</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{title}</Text>

        <TouchableOpacity style={styles.option} onPress={onNotNow}>
          <Text style={styles.optionText}>Not right now</Text>
          <Text style={styles.optionMeta}>We'll resurface this in 30 days</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.option} onPress={onAlreadyWatched}>
          <Text style={styles.optionText}>Already watched it</Text>
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
    backgroundColor: '#1a0f06', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#3a2010', alignSelf: 'center', marginBottom: 16,
  },
  heading: { color: '#fff1e6', fontSize: 17, fontWeight: '700', marginBottom: 2 },
  subtitle: { color: '#7a5535', fontSize: 13, marginBottom: 20 },
  option: {
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2e1a0a',
  },
  optionLast: { borderBottomWidth: 0 },
  optionText: { color: '#fff1e6', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  optionTextDanger: { color: '#e05020' },
  optionMeta: { color: '#5a3520', fontSize: 12 },
  cancelButton: {
    marginTop: 12, paddingVertical: 14, alignItems: 'center',
    backgroundColor: '#2e1a0a', borderRadius: 12,
  },
  cancelText: { color: '#7a5535', fontSize: 15, fontWeight: '600' },
})
