import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

export function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Profile</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#100a04', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff1e6', fontSize: 16 },
})
