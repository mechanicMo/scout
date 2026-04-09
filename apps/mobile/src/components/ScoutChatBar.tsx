// apps/mobile/src/components/ScoutChatBar.tsx
import React, { useState } from 'react'
import {
  View, TextInput, TouchableOpacity, Text,
  ActivityIndicator, StyleSheet,
} from 'react-native'

interface Props {
  onSubmit: (message: string) => void
  isPending: boolean
}

export function ScoutChatBar({ onSubmit, isPending }: Props) {
  const [text, setText] = useState('')

  function handleSubmit() {
    const trimmed = text.trim()
    if (!trimmed || isPending) return
    onSubmit(trimmed)
    setText('')
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Tell Scout what you're in the mood for..."
        placeholderTextColor="#5a3520"
        value={text}
        onChangeText={setText}
        onSubmitEditing={handleSubmit}
        returnKeyType="send"
        editable={!isPending}
        maxLength={500}
      />
      <TouchableOpacity
        style={[styles.sendButton, (!text.trim() || isPending) && styles.sendButtonDisabled]}
        onPress={handleSubmit}
        disabled={!text.trim() || isPending}
      >
        {isPending
          ? <ActivityIndicator size="small" color="#100a04" />
          : <Text style={styles.sendText}>→</Text>}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1f1208',
    backgroundColor: '#100a04',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#1a0f06',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    color: '#fff1e6',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2e1a0a',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e8a020',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#2e1a0a' },
  sendText: { color: '#100a04', fontSize: 16, fontWeight: '800' },
})
