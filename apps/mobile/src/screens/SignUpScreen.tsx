import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { supabase } from '../lib/supabase'

export function SignUpScreen({ onNavigateLogin }: { onNavigateLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignUp() {
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    setLoading(false)
    if (error) Alert.alert('Sign up failed', error.message)
    else Alert.alert('Check your email', 'Confirm your address to get started.')
  }

  return (
    <View style={styles.container}>
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
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#100a04', padding: 32, justifyContent: 'center' },
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
})
