import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { supabase } from '../lib/supabase'
import { ScreenContainer } from '../components/ScreenContainer'
import { colors, typography, spacing, radius } from '../theme'

export function SignUpScreen({ onNavigateLogin }: { onNavigateLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  async function handleSignUp() {
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    setLoading(false)
    if (error) Alert.alert('Sign up failed', error.message)
    else setConfirmed(true)
  }

  if (confirmed) {
    return (
      <ScreenContainer centered>
        <View style={styles.confirmBox}>
          <Text style={styles.confirmIcon}>✉️</Text>
          <Text style={styles.confirmTitle}>Check your email</Text>
          <Text style={styles.confirmBody}>
            We sent a confirmation link to{'\n'}
            <Text style={styles.confirmEmail}>{email}</Text>
          </Text>
          <TouchableOpacity style={styles.button} onPress={onNavigateLogin}>
            <Text style={styles.buttonText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer centered>
      <Text style={styles.logo}>scout</Text>
      <Text style={styles.tagline}>create your account</Text>
      <TextInput
        style={styles.input}
        placeholder="Your name"
        placeholderTextColor="#5a3520"
        value={displayName}
        onChangeText={setDisplayName}
      />
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
      <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Creating account...' : 'Create account'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onNavigateLogin}>
        <Text style={styles.link}>Already have an account? Sign in</Text>
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
  confirmBox: { alignItems: 'center' },
  confirmIcon: { fontSize: 48, marginBottom: spacing.lg },
  confirmTitle: {
    ...typography.heading,
    marginBottom: spacing.md,
  },
  confirmBody: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing['3xl'],
  },
  confirmEmail: { color: colors.gold, fontWeight: '600' },
})
