import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { supabase } from '../lib/supabase'
import { ScreenContainer } from '../components/ScreenContainer'

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
  logo: { fontSize: 48, fontWeight: '800', color: '#fff1e6', letterSpacing: -2, marginBottom: 4 },
  tagline: { fontSize: 14, color: '#7a5535', marginBottom: 40 },
  input: {
    backgroundColor: '#1f1208', borderWidth: 1, borderColor: '#2e1a0a',
    borderRadius: 10, padding: 14, color: '#fff1e6', marginBottom: 12, fontSize: 15,
  },
  button: {
    backgroundColor: '#e8a020', borderRadius: 10, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#100a04', fontWeight: '800', fontSize: 16 },
  link: { color: '#7a5535', textAlign: 'center', marginTop: 20, fontSize: 14 },
  confirmBox: { alignItems: 'center' },
  confirmIcon: { fontSize: 48, marginBottom: 16 },
  confirmTitle: { fontSize: 24, fontWeight: '800', color: '#fff1e6', marginBottom: 12 },
  confirmBody: { color: '#7a5535', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  confirmEmail: { color: '#e8a020', fontWeight: '600' },
})
