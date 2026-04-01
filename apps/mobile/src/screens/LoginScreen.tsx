import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { supabase } from '../lib/supabase'

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
    <View style={styles.container}>
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
