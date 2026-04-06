import React, { useState } from 'react'
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type Props = {
  visible: boolean
  mediaType: 'movie' | 'tv'
  title: string
  totalSeasons?: number | null
  onClose: () => void
  onSubmit: (watchingStatus: 'not_started' | 'watching', season?: number, episode?: number) => void
  isPending?: boolean
}

export function WatchingStatusModal({
  visible, mediaType, title, totalSeasons, onClose, onSubmit, isPending,
}: Props) {
  const [isWatching, setIsWatching] = useState(false)
  const [season, setSeason] = useState('')
  const [episode, setEpisode] = useState('')

  function handleSubmit() {
    if (isWatching && mediaType === 'tv') {
      const s = season ? parseInt(season, 10) : 1
      const e = episode ? parseInt(episode, 10) : 1
      onSubmit('watching', s, e)
    } else {
      onSubmit(isWatching ? 'watching' : 'not_started')
    }
    setIsWatching(false)
    setSeason('')
    setEpisode('')
  }

  function handleClose() {
    setIsWatching(false)
    setSeason('')
    setEpisode('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Already watching?</Text>
          <Text style={styles.subtitle}>{title}</Text>

          <View style={styles.options}>
            <TouchableOpacity
              style={[styles.option, !isWatching && styles.optionActive]}
              onPress={() => setIsWatching(false)}
              disabled={isPending}
            >
              <Text style={[styles.optionText, !isWatching && styles.optionTextActive]}>
                Not yet
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.option, isWatching && styles.optionActive]}
              onPress={() => setIsWatching(true)}
              disabled={isPending}
            >
              <Text style={[styles.optionText, isWatching && styles.optionTextActive]}>
                Yes, watching
              </Text>
            </TouchableOpacity>
          </View>

          {isWatching && mediaType === 'tv' && (
            <View style={styles.seasonEpisodeContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Season</Text>
                <TextInput
                  style={styles.input}
                  value={season}
                  onChangeText={setSeason}
                  keyboardType="number-pad"
                  placeholder="1"
                  placeholderTextColor="#5a3520"
                  editable={!isPending}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Episode</Text>
                <TextInput
                  style={styles.input}
                  value={episode}
                  onChangeText={setEpisode}
                  keyboardType="number-pad"
                  placeholder="1"
                  placeholderTextColor="#5a3520"
                  editable={!isPending}
                />
              </View>
            </View>
          )}

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
                <ActivityIndicator color="#100a04" size="small" />
              ) : (
                <Text style={styles.confirmButtonText}>Done</Text>
              )}
            </TouchableOpacity>
          </View>
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
    backgroundColor: '#1f1208',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    marginHorizontal: '7.5%',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff1e6',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#7a5535',
    marginBottom: 20,
  },
  options: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  option: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2e1a0a',
    alignItems: 'center',
  },
  optionActive: {
    backgroundColor: '#e8a020',
    borderColor: '#e8a020',
  },
  optionText: {
    color: '#5a3520',
    fontSize: 13,
    fontWeight: '600',
  },
  optionTextActive: {
    color: '#100a04',
  },
  seasonEpisodeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  inputGroup: {
    flex: 1,
  },
  label: {
    color: '#7a5535',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#100a04',
    borderWidth: 1,
    borderColor: '#2e1a0a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff1e6',
    fontSize: 14,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#2e1a0a',
  },
  cancelButtonText: {
    color: '#5a3520',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#e8a020',
  },
  confirmButtonText: {
    color: '#100a04',
    fontSize: 14,
    fontWeight: '700',
  },
})
