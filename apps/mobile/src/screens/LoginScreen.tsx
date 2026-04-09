import React, { useState } from 'react'
import { Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { supabase } from '../lib/supabase'
import { ScreenContainer } from '../components/ScreenContainer'
import { colors, typography, spacing, radius } from '../theme'

export function LoginScreen({ onNavigateSignUp }: { onNavigateSignUp: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) Alert.alert('Login failed', error.message)
  }

  return (
    <ScreenContainer centered>
      <Text style={styles.logo}>scout</Text>
      <Text style={styles.tagline}>finds what's worth your time</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#5a3520"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#5a3520"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign in'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onNavigateSignUp}>
        <Text style={styles.link}>Don't have an account? Sign up</Text>
      </TouchableOpacity>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  logo: {
    ...typography.display,
    marginBottom: spacing.xs,
  },
  tagline: {
    ...typography.caption,
    marginBottom: spacing['3xl'],
  },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    marginBottom: spacing.md,
    ...typography.body,
  },
  button: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonText: {
    color: colors.bg,
    ...typography.button,
  },
  link: {
    ...typography.body,
    color: colors.textSoft,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
})
