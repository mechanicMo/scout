// apps/mobile/src/components/ScoutChatBar.tsx
import React, { useState } from 'react'
import {
  View, TextInput, TouchableOpacity, Text,
  ActivityIndicator, StyleSheet,
} from 'react-native'
import { colors, typography, spacing, radius, shadows } from '../theme'

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
        placeholderTextColor={colors.textMuted}
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
          ? <ActivityIndicator size="small" color={colors.bg} />
          : <Text style={styles.sendText}>→</Text>}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    gap: spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
    borderColor: colors.border,
  },
  sendText: {
    ...typography.button,
    color: colors.bg,
  },
})
