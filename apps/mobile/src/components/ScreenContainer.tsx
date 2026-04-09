import React from 'react'
import {
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  StyleSheet,
} from 'react-native'
import { colors, spacing } from '../theme'

interface ScreenContainerProps {
  children: React.ReactNode
  centered?: boolean
}

export function ScreenContainer({ children, centered = false }: ScreenContainerProps) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scroll, centered && styles.centered]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, padding: spacing['3xl'] },
  centered: { justifyContent: 'center' },
})
